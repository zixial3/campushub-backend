# AGENTS.md — CampusHub

Rules for any AI coding agent working in this repository. They are
constraints, not suggestions: if a request conflicts with one, say so and
propose a compliant alternative instead of breaking it silently.

CampusHub is a campus resource reservation system: an Express + MongoDB API
in `src/`, a React client in `client/`, and the API types both share in
`shared/`. **`docs/openapi.yaml` is the authoritative contract**; code
follows the spec, never the reverse. History lives in `git log`; this file
holds only current rules. `.ignore` keeps lockfiles, build output, and logs
out of agent search.

## 1. Stack and dependencies

| Area            | Allowed                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend         | TypeScript (`.ts` only), Node.js, Express, Mongoose + MongoDB, dotenv                                                                                |
| Backend tooling | `typescript` 5.x, `ts-node`, `@types/*`, `eslint` + `typescript-eslint`, `prettier`, `nodemon`; `@redocly/cli` via pinned `npx` (`npm run lint:api`) |
| Client          | React function components, Vite + `@vitejs/plugin-react`, CSS Modules, `oxlint`                                                                      |

- **No new dependencies** without asking first and saying why the platform
  or an allowed package cannot do it. Client packages go in
  `client/package.json`, never the root one.
- Never: raw `.js` in `src/`, axios (use `fetch`), lodash, moment,
  body-parser, another ORM or HTTP framework, raw MongoDB driver calls, or a
  client state library, router, UI kit, or Tailwind.
- Keep `typescript` at 5.x in the backend: `typescript-eslint` does not
  support 7.x, and 7.x removed `"moduleResolution": "node"`.

## 2. Shared contract — `shared/contract.ts`

- The **only** declaration of the API's data types (`components/schemas`),
  their enum values, and the type guards both sides need. Backend and
  client import from it; never redeclare a contract type elsewhere.
- Field names match the spec exactly. Change the spec first, then this file.
- No imports and no runtime dependencies, so both builds can compile it.
- Backend-only types (parsed query params, validated input) live in
  `src/types/`; client-only types live next to the code that uses them.

## 3. Backend architecture — `src/`

```
Route -> Controller -> Service -> Repository -> Model
             |
             +-> Validator (pure input parsing)
```

Never skip a layer or call back up the chain.

- **Routes** (`routes/`): map paths to named controller functions, wrapped
  in `asyncHandler`. No inline handlers, logic, or `try/catch`.
- **Controllers** (`controllers/`): parse `req` with a validator, call one
  service function, send the response with `HttpStatus` constants. Never
  import models or catch errors; rejections reach `errorHandler`.
- **Validators** (`validators/`): `(input: unknown) => TypedDto`, throwing
  `ValidationError`. Implement the spec's schema, including
  `additionalProperties: false`. No Express, no I/O.
- **Services** (`services/`): all business rules, including the
  double-booking rule and the status transitions (`ALLOWED_FROM`). No
  Express imports or HTTP status codes. Throw domain errors from `errors/`.
- **Repositories** (`repositories/`): Mongoose access behind Promise-based
  interfaces. They supply atomicity, not rules: the service runs its
  double-booking check-then-insert inside `runExclusive(resourceId, work)`
  (a per-resource `ResourceLock`, because standalone MongoDB has no
  multi-document transactions). A check-then-insert outside `runExclusive`
  is a race. Status changes use one conditional write (`updateStatusIf`).
  A malformed ObjectId means "not found"; never let it reach Mongoose as a
  `CastError` 500.
- **Models** (`models/`): schema plus its `I`-prefixed interface, indexes,
  and schema-level validation only.
- **Errors**: `middleware/errorHandler.ts` is the one place that maps domain
  errors to HTTP status codes and `ErrorResponse { code, message }`.
- Seed data lives in `src/scripts/seed.ts`; `npm run seed` resets the
  database with fixed ObjectIds. Scripts set `process.exitCode`;
  `process.exit()` is only allowed in `src/server.ts`.
- Config comes from `process.env` in `src/config/` only. Never commit `.env`;
  mirror new variables into `.env-example`.

## 4. Client architecture — `client/src/`

- `api/campushubApi.ts` is the only module that calls `fetch`. Non-2xx
  responses throw `ApiError` with the HTTP status and `ErrorResponse.code`;
  UI branches on `code`, never on message text. `api/guards.ts` checks
  responses against the contract at runtime.
- `hooks/` owns all async and server state. `useReservations.ts` holds a
  user's reservations, cancellation, and creation; `useBookingForm.ts` holds
  the booking form's state; `useApiQuery.ts` is the shared fetch-on-mount
  primitive. Components never call `api/` directly.
- `components/` render state and raise events. Keep a component under about
  150 lines; move state and handlers into a hook before it grows past that.
- Every async flow exposes `isLoading` and `error` and clears loading on
  every exit path. Fetching effects abort on cleanup.
- Each exported component has an exported `Props` interface and an
  explicit return type. One CSS Module per component; tokens live in
  `index.css`.
- `/api` is proxied by the Vite dev server, so the backend needs no CORS.

## 5. Code standards (both sides)

- No `any`, `as any`, `@ts-ignore`, or non-null `!`. Use `unknown` and
  narrow. Never loosen `strict` compiler flags to make code compile.
- Explicit parameter and return types on every function.
- `async`/`await` only; every promise is awaited or explicitly handled. No
  empty `catch {}`.
- Named exports only (tool configs such as `vite.config.ts` excepted).
- Date-times are RFC 3339: input carries an explicit offset, and output and
  requests use `toISOString()`.
- Keep functions under about 40 lines. Comment _why_, not _what_. No
  generated-by banners.
- Multi-tenancy is deferred until authentication exists. Then `tenantId`
  comes from the authenticated user, never from request input; until then,
  do not add or fake it.

## 6. Workflow

- Before coding, say which layers you will touch. After coding, run the
  checks and report real results:
  - backend: `npm run typecheck`, `npm run lint`, and `npm run lint:api`
    after a spec change
  - client: `npm run build` (type-checks) and `npm run lint` in `client/`
- Conventional Commits (`type(scope): subject`, imperative, under 72
  characters). The body says what changed, why, and which rule here shaped
  it, in a few lines.
- Never push, amend, `reset --hard`, or rebase unless asked. Never use
  `--no-verify`. Do not stage `node_modules/`, `dist/`, or `.env`.
- Run Prettier only on files you changed; running it on a whole directory
  rewrites line endings in untouched files.
- If a rule here is wrong or blocking, say so; this file is maintained, not
  worked around.
