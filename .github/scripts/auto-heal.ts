// Auto-heal step for CI: asks a model to fix the source behind a failing Jest
// run, applies the edits, and keeps them only if lint, typecheck and the full
// suite pass. Run by .github/workflows/ci.yml; see that file for inputs.
//
// Safety rules enforced here rather than trusted to the model:
// - Only files under src/ that were shown to the model may change, and never
//   tests (__tests__/) or the test harness (src/test/).
// - Edits are exact find/replace pairs; a `find` must match exactly once.
// - Nothing is kept unless the whole suite passes afterwards.

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_ATTEMPTS = 2;
const LOG_CHARS = 6000;
const DIFF_CHARS = 4000;
const CONTEXT_CHARS = 14000;
// Gemini's OpenAI-compatible endpoint. (GitHub Models, the original choice,
// was retired on 2026-07-30 and now answers every request with a plain "OK".)
const CHAT_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
// Tried in order: free-tier eligibility is not documented per model, so a
// quota or not-found error on one moves on to the next.
const DEFAULT_MODELS = 'gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite';
const FALLBACK_STATUSES: ReadonlySet<number> = new Set([403, 404, 429]);

/** The model service itself failed: retrying the prompt cannot help. */
class ProviderError extends Error {}

let answeredBy = 'mock';

interface Edit {
  readonly path: string;
  readonly find: string;
  readonly replace: string;
}

interface ModelAnswer {
  readonly rootCause: string;
  readonly summary: string;
  readonly edits: readonly Edit[];
}

interface CheckResult {
  readonly passed: boolean;
  readonly log: string;
}

interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

function env(name: string, fallback?: string): string {
  const value: string | undefined = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function run(command: string, args: readonly string[]): CheckResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 32 * 1024 * 1024,
  });
  return { passed: result.status === 0, log: `${result.stdout}${result.stderr}` };
}

function git(args: readonly string[]): string {
  const result: CheckResult = run('git', args);
  if (!result.passed) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.log}`);
  }
  return result.log;
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

/** Keeps the Jest failure blocks, which carry the assertion and stack trace. */
function compactLog(raw: string): string {
  const log: string = stripAnsi(raw);
  const start: number = log.indexOf('●');
  const relevant: string = start === -1 ? log : log.slice(start);
  return relevant.length > LOG_CHARS
    ? `${relevant.slice(0, LOG_CHARS)}\n[log truncated]`
    : relevant;
}

function isEditable(path: string): boolean {
  return (
    /^src\/[\w./-]+\.ts$/.test(path) &&
    !path.includes('/__tests__/') &&
    !path.startsWith('src/test/') &&
    !path.includes('..')
  );
}

/** Files the model may see and edit: changed source first, then stack-trace hits. */
function contextFiles(baseRef: string, log: string): string[] {
  const changed: string[] = git(['diff', '--name-only', `${baseRef}...HEAD`, '--', 'src'])
    .split('\n')
    .map((line: string): string => line.trim());
  const fromStack: string[] = [...stripAnsi(log).matchAll(/src\/[\w./-]+\.ts/g)].map(
    (match: RegExpMatchArray): string => match[0],
  );
  const unique: string[] = [...new Set([...changed, ...fromStack])].filter(
    (path: string): boolean => isEditable(path) && existsSync(path),
  );

  const chosen: string[] = [];
  let budget: number = CONTEXT_CHARS;
  for (const path of unique) {
    const size: number = readFileSync(path, 'utf8').length;
    if (size <= budget) {
      chosen.push(path);
      budget -= size;
    }
  }
  return chosen;
}

function buildPrompt(log: string, diff: string, files: readonly string[]): ChatMessage[] {
  const system: string = [
    'You fix bugs in a TypeScript Express + Mongoose backend so that its Jest suite passes.',
    'The tests are the specification: never change, weaken, or delete a test.',
    'Fix the source code that the failing tests and the recent diff point to.',
    'Make the smallest change that restores the intended behaviour; keep the existing style.',
    'Respond with JSON only, in this shape:',
    '{"rootCause": string, "summary": string, "edits": [{"path": string, "find": string, "replace": string}]}',
    '`path` must be one of the provided files. `find` must be copied exactly from that file,',
    'including whitespace, and must occur exactly once in it.',
  ].join('\n');

  const fileBlocks: string = files
    .map((path: string): string => `--- FILE ${path} ---\n${readFileSync(path, 'utf8')}`)
    .join('\n\n');
  const user: string = [
    'Parse the attached Jest failure log. Locate the source code causing the failure in src/',
    'and generate a patch that fixes the bug without breaking existing tests.',
    '',
    '=== Jest failure log ===',
    log,
    '',
    '=== Diff of this pull request (src/, tests excluded) ===',
    diff.length > DIFF_CHARS ? `${diff.slice(0, DIFF_CHARS)}\n[diff truncated]` : diff,
    '',
    '=== Source files you may edit ===',
    fileBlocks,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** Pulls the JSON object out of a reply that may wrap it in a code fence. */
function extractJson(text: string): unknown {
  const start: number = text.indexOf('{');
  const end: number = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('Model answer contains no JSON object.');
  }
  return JSON.parse(text.slice(start, end + 1));
}

function parseAnswer(text: string): ModelAnswer {
  const parsed: unknown = extractJson(text);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Model answer is not a JSON object.');
  }
  const { rootCause, summary, edits } = parsed as Record<string, unknown>;
  if (
    typeof rootCause !== 'string' ||
    typeof summary !== 'string' ||
    !Array.isArray(edits)
  ) {
    throw new Error('Model answer is missing rootCause, summary or edits.');
  }
  const typedEdits: Edit[] = edits.map((edit: unknown): Edit => {
    const { path, find, replace } = (edit ?? {}) as Record<string, unknown>;
    if (
      typeof path !== 'string' ||
      typeof find !== 'string' ||
      typeof replace !== 'string'
    ) {
      throw new Error('Each edit needs string path, find and replace.');
    }
    return { path, find, replace };
  });
  return { rootCause, summary, edits: typedEdits };
}

async function callModel(
  model: string,
  messages: readonly ChatMessage[],
): Promise<Response> {
  const apiKey: string | undefined = process.env['GEMINI_API_KEY'];
  if (apiKey === undefined || apiKey === '') {
    throw new ProviderError('GEMINI_API_KEY is not set; add it as a repository secret.');
  }
  return fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    // No response_format: the compatibility layer does not document
    // json_object, so the prompt asks for JSON and extractJson() reads it.
    body: JSON.stringify({ model, messages, temperature: 0 }),
  });
}

async function askModel(messages: readonly ChatMessage[]): Promise<string> {
  // Local dry runs can supply a canned answer instead of calling the API.
  const mock: string | undefined = process.env['AUTO_HEAL_MOCK_RESPONSE'];
  if (mock !== undefined) {
    return readFileSync(mock, 'utf8');
  }
  const models: string[] = env('AUTO_HEAL_MODELS', DEFAULT_MODELS)
    .split(',')
    .map((model: string): string => model.trim())
    .filter((model: string): boolean => model !== '');
  const failures: string[] = [];
  for (const model of models) {
    let response: Response;
    try {
      response = await callModel(model, messages);
    } catch (err: unknown) {
      if (err instanceof ProviderError) {
        throw err;
      }
      throw new ProviderError(`Could not reach the model service: ${String(err)}`);
    }
    const body: string = await response.text();
    if (!response.ok) {
      failures.push(`${model}: HTTP ${response.status} ${body.slice(0, 300)}`);
      if (FALLBACK_STATUSES.has(response.status)) {
        continue;
      }
      break;
    }
    if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
      throw new ProviderError(
        `${model} returned a non-JSON response: ${body.slice(0, 200)}`,
      );
    }
    const content: unknown = (
      JSON.parse(body) as { choices?: { message?: { content?: unknown } }[] }
    ).choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new ProviderError(
        `${model} returned no message content: ${body.slice(0, 300)}`,
      );
    }
    answeredBy = model;
    return content;
  }
  throw new ProviderError(`No model answered:\n${failures.join('\n')}`);
}

function applyEdits(edits: readonly Edit[], allowed: ReadonlySet<string>): void {
  if (edits.length === 0) {
    throw new Error('Model proposed no edits.');
  }
  for (const edit of edits) {
    if (!allowed.has(edit.path)) {
      throw new Error(
        `Refusing to edit ${edit.path}: not one of the provided source files.`,
      );
    }
    const source: string = readFileSync(edit.path, 'utf8');
    const occurrences: number = source.split(edit.find).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `"find" text occurs ${occurrences} times in ${edit.path}; expected exactly 1.`,
      );
    }
    writeFileSync(
      edit.path,
      source.replace(edit.find, (): string => edit.replace),
    );
  }
}

function verify(): CheckResult {
  for (const [label, args] of [
    ['lint', ['run', 'lint']],
    ['typecheck', ['run', 'typecheck']],
    ['tests', ['test', '--', '--ci']],
  ] as const) {
    const result: CheckResult = run('npm', args);
    if (!result.passed) {
      return { passed: false, log: `[${label} failed]\n${result.log}` };
    }
  }
  return { passed: true, log: '' };
}

function setOutput(name: string, value: string): void {
  const file: string | undefined = process.env['GITHUB_OUTPUT'];
  if (file !== undefined) {
    appendFileSync(file, `${name}=${value}\n`);
  }
}

function summarise(markdown: string): void {
  const file: string | undefined = process.env['GITHUB_STEP_SUMMARY'];
  if (file !== undefined) {
    appendFileSync(file, `${markdown}\n`);
  }
  console.log(markdown);
}

const LISTED_FAILURES = 15;

/** Markdown bullets for the failing tests, capped, with a count of the rest. */
function failingTests(log: string): string[] {
  const names: string[] = [...stripAnsi(log).matchAll(/^\s*● (.+)$/gm)].map(
    (match: RegExpMatchArray): string => match[1] ?? '',
  );
  // Jest also uses "●" for "Console" output blocks and suite-level errors.
  const tests: string[] = [...new Set(names)].filter(
    (name: string): boolean =>
      name !== '' && name !== 'Console' && !name.startsWith('Test suite failed'),
  );
  const listed: string[] = tests
    .slice(0, LISTED_FAILURES)
    .map((name: string): string => `- ${name}`);
  const hidden: number = tests.length - LISTED_FAILURES;
  return hidden > 0 ? [...listed, `- …and ${hidden} more`] : listed;
}

function writePullRequest(
  answer: ModelAnswer,
  originalLog: string,
  attempt: number,
): void {
  const tmp: string = env('RUNNER_TEMP', '.');
  const changed: string = git(['diff', '--stat', '--', 'src']).trim();
  const sourcePr: string | undefined = process.env['SOURCE_PR'];
  const onPr: string = sourcePr === undefined ? '' : ` on #${sourcePr}`;

  writeFileSync(
    join(tmp, 'auto-heal-commit.txt'),
    `fix: auto-heal failing tests${onPr}\n\n${answer.summary}\n`,
  );
  writeFileSync(
    join(tmp, 'auto-heal-pr.md'),
    [
      `Automated fix for the failing CI run${onPr}.`,
      '',
      '## Failing tests',
      ...failingTests(originalLog),
      '',
      '## Root cause (model analysis)',
      answer.rootCause,
      '',
      '## Change',
      answer.summary,
      '',
      '```',
      changed,
      '```',
      '',
      '## Automated verification',
      `- Model: \`${answeredBy}\` (Gemini API), accepted on attempt ${attempt} of ${MAX_ATTEMPTS}`,
      '- `npm run lint`, `npm run typecheck` and the full `npm test` suite passed on the patched code',
      '- Only source files under `src/` changed; no test files were modified',
      `- Run: ${env('RUN_URL', 'local')}`,
      '',
      '## Audit log (human-in-the-loop review)',
      '_To be completed by the reviewer before accepting this patch._',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const baseRef: string = env('BASE_REF', 'origin/main');
  const originalLog: string = readFileSync(env('TEST_LOG', 'test-results.log'), 'utf8');
  const files: string[] = contextFiles(baseRef, originalLog);
  if (files.length === 0) {
    summarise('Auto-heal: no editable source files found in the diff or stack traces.');
    setOutput('fixed', 'false');
    return;
  }
  const allowed: ReadonlySet<string> = new Set(files);
  const diff: string = git([
    'diff',
    `${baseRef}...HEAD`,
    '--',
    'src',
    ':(exclude)src/**/__tests__/**',
  ]);
  const messages: ChatMessage[] = buildPrompt(compactLog(originalLog), diff, files);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let feedback: string;
    try {
      const raw: string = await askModel(messages);
      messages.push({ role: 'assistant', content: raw });
      const answer: ModelAnswer = parseAnswer(raw);
      applyEdits(answer.edits, allowed);
      const check: CheckResult = verify();
      if (check.passed) {
        writePullRequest(answer, originalLog, attempt);
        summarise(
          `Auto-heal: fix verified on attempt ${attempt}.\n\n${answer.rootCause}`,
        );
        setOutput('fixed', 'true');
        return;
      }
      feedback = `Your patch was applied but checks still fail:\n${compactLog(check.log)}`;
    } catch (err: unknown) {
      if (err instanceof ProviderError) {
        git(['checkout', '--', ...files]);
        throw err;
      }
      const reason: string = err instanceof Error ? err.message : String(err);
      feedback = `Your answer could not be applied: ${reason}`;
    }
    git(['checkout', '--', ...files]);
    console.log(`Attempt ${attempt} rejected: ${feedback.slice(0, 800)}`);
    messages.push({
      role: 'user',
      content: `${feedback}\nThe files were reset to their original content. Try again with a corrected patch.`,
    });
  }

  summarise(
    `Auto-heal: no verified fix after ${MAX_ATTEMPTS} attempts; no pull request opened.`,
  );
  setOutput('fixed', 'false');
}

// A provider failure fails the job (exit code 1) so it shows red in CI; a run
// that reached the model but found no verified fix still exits 0.
main().catch((err: unknown): void => {
  console.error('Auto-heal failed:', err);
  summarise(
    `Auto-heal could not run: ${err instanceof Error ? err.message : String(err)}`,
  );
  setOutput('fixed', 'false');
  process.exitCode = 1;
});
