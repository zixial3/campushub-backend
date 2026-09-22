# AGENTS.md — CampusHub Backend

Governing context for any AI coding agent working in this repository.
These are constraints, not suggestions. If a request conflicts with a rule
below, say so and propose a compliant alternative instead of silently
breaking the rule.

CampusHub is a **multi-tenant campus resource management system**. Every
data model and query must be scoped to a tenant (see Multi-Tenancy).

---

## 1. Tech Stack & Libraries

**Authorized runtime and libraries — nothing else without my approval:**

| Purpose | Allowed |
|---|---|
| Language | TypeScript (`.ts` only) |
| Runtime | Node.js |
| HTTP framework | Express |
| ODM / database | Mongoose + MongoDB |
| Config | dotenv |
| Tooling | `typescript` (pinned to 5.x), `ts-node`, `@types/node`, `@types/express`, `eslint`, `typescript-eslint`, `prettier`, `nodemon` |

**Forbidden:**

- **No raw JavaScript.** Do not create `.js`, `.mjs`, or `.cjs` files anywhere
  under `src/`. Compiled `.js` belongs only in `dist/`, which is generated.
- **No new dependencies.** Do not run `npm install <pkg>` or add anything to
  `package.json`. Ask first and justify why the stdlib or an authorized
  package cannot do it.
- Specifically do not reach for: `lodash`, `moment`, `axios` (use `fetch`),
  `body-parser` (use `express.json()`), `sequelize`/`prisma`/`typeorm`,
  `nest`, or any alternate HTTP framework.
- No raw MongoDB driver calls. All database access goes through Mongoose
  models.

**Version constraints:**

- `typescript` is pinned to `^5.9.0`, not 7.x. TypeScript 7 is the new native
  compiler and `typescript-eslint` does not support it yet (peer range
  `>=4.8.4 <6.1.0`). Do not bump the major version.
- `moduleResolution` is not set explicitly; `"module": "node18"` implies it.
  TypeScript 7 removed `node10`, so do not reintroduce `"moduleResolution": "node"`.

---

## 2. Architectural Boundaries

Strict 3-tier separation. A request flows in exactly one direction:

```
Route  ->  Controller  ->  Service  ->  Model
```

Never skip a layer. Never call backwards up the chain.

```
src/
├── app.ts                  # Express app assembly only
├── server.ts               # Process bootstrap / listen
├── config/                 # env loading, db connection
├── routes/                 # route definitions + middleware mapping
├── controllers/            # req/res handling, status codes
├── services/               # pure business logic
├── models/                 # Mongoose schemas + interfaces
├── middleware/             # cross-cutting Express middleware
└── types/                  # shared type declarations
```

### Routes — `src/routes/`
- Route definitions and middleware mapping **only**.
- Each file exports an `express.Router`.
- **No** inline handler bodies. Every handler is a named import from a
  controller: `router.get('/', getHealth)` — never `router.get('/', (req, res) => {...})`.
- No business logic, no database access, no `try/catch`.

### Controllers — `src/controllers/`
- Translate HTTP to and from the service layer: read `req`, call exactly one
  service function, set the status code, send the response.
- **No direct database queries.** A controller must never import from
  `src/models/` or call `.find()`, `.save()`, `.aggregate()`, etc.
- No business rules, validation logic, or computation beyond shaping the
  response payload.
- Signature is always `(req: Request, res: Response, next: NextFunction)`.
- Errors are forwarded with `next(err)`, never handled locally.

### Services — `src/services/`
- Pure business logic. This is the only layer allowed to touch models.
- **Framework-free**: never import from `express`, and never reference `req`,
  `res`, or HTTP status codes. A service must be callable from a CLI or test
  with no HTTP involved.
- Accept and return plain typed objects/DTOs, not Express types.
- Throw typed domain errors; do not return `null` to signal failure.

### Models — `src/models/`
- Mongoose schemas and their TypeScript interfaces **only**.
- Export both the interface and the model: `export interface IBooking {...}`
  and `export const Booking = model<IBooking>('Booking', bookingSchema)`.
- No business logic. Schema-level validators and indexes are fine; anything
  requiring knowledge of another collection belongs in a service.

---

## 3. Coding Standards & Safety

### Typing
- **`any` is banned.** No `any`, no implicit `any`, no `as any`, no
  `@ts-ignore` / `@ts-expect-error` to silence a type error. Use `unknown`
  plus a narrowing guard when a type is genuinely unknown.
- Every function has an **explicit** parameter and return type annotation.
  Do not rely on inferred return types for exported functions.
- Every DB schema has a corresponding `interface` in the same file.
- Prefix model interfaces with `I` (`IUser`, `IResource`). Use `type` for
  unions and DTOs.
- No non-null assertions (`!`). Narrow properly or handle the nullish case.
- `tsconfig.json` runs with `strict: true`. Do not weaken any compiler flag
  to make code compile — fix the code.

### Async & error handling
- `async`/`await` only. No `.then()` chains, no raw callbacks.
- **No unhandled promises.** Every promise is awaited or explicitly
  `.catch()`-ed. Never leave a floating async call.
- Every `async` Express handler is wrapped in the `asyncHandler` utility
  (`src/middleware/asyncHandler.ts`) so rejections reach the error
  middleware. Do not write `try/catch` in a route file.
- One centralized error-handling middleware, registered last in `app.ts`.
- Never swallow an error with an empty `catch {}`.
- `process.exit()` is only allowed in `src/server.ts`.

### General
- Config is read from `process.env` in `src/config/` and nowhere else. No
  hardcoded ports, URIs, secrets, or magic strings in handlers.
- Never commit `.env`. Mirror every new variable into `.env-example`.
- Named exports only; no `export default`.
- Prefer `const`; `let` only when reassigned; never `var`.
- Keep functions under ~40 lines. Extract rather than nest deeply.
- Comment *why*, not *what*. Do not narrate obvious code.
- Do not add a comment banner or "Generated by AI" header to files.

### Multi-Tenancy
- Every tenant-owned schema carries a required, indexed `tenantId`.
- Every service-layer query filters on `tenantId`. A query that reads or
  writes tenant data without a `tenantId` filter is a bug, not a shortcut.

---

## 4. Git & Commit Formatting

- Conventional Commits: `type(scope): subject`, subject in the imperative
  mood, under 72 characters.
  Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`.
  Example: `feat(health): add GET /api/v1/health endpoint`
- Commit body (and any PR/diff description you produce) must state:
  1. **What** was built or changed.
  2. **Why** — the reason for the change.
  3. **Which context rules from this file shaped the implementation**, and
     any rule that forced you to reject an otherwise obvious approach.
- Keep it concise: a short paragraph or a few bullets, not an essay.
- Never run `git push`, `git commit --amend`, `git reset --hard`, or
  `git rebase` without being asked. Do not add `--no-verify`.
- Do not stage `node_modules/`, `dist/`, or `.env`.

---

## 5. Working Agreement

- Before writing code, state which layers you will touch and why.
- After writing code, run `npm run typecheck` and report the real result.
  Do not claim something compiles or passes without having run it.
- If a rule here is wrong or blocking, tell me — this file is a living
  document and I will change it. Do not work around it unilaterally.

---

## Changelog

- **2026-09-21** — Initial version (Lab 1).
- **2026-09-21** — Added `typescript-eslint` to authorized tooling. ESLint's
  default parser cannot read `.ts` at all, so the no-dependency rule made
  `npm run lint` impossible. It now enforces the section 3 rules mechanically
  (`no-explicit-any`, `no-floating-promises`, `explicit-function-return-type`)
  rather than leaving them as prose. Pinned `typescript` to 5.x as a
  consequence.
