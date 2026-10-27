# AGENTS.md — CampusHub Backend

Governing context for any AI coding agent working in this repository.
These are constraints, not suggestions. If a request conflicts with a rule
below, say so and propose a compliant alternative instead of silently
breaking the rule.

CampusHub is a **multi-tenant campus resource management system**. Every
data model and query will be scoped to a tenant once authentication exists
(see Multi-Tenancy).

**`docs/openapi.yaml` is the authoritative API contract** (see section 3,
API Contract). Code follows the spec; the spec never follows the code.

Sections 1–5 govern the backend (`src/`). The React client in `client/` is
governed by section 6, which also inherits the typing, async, and commit
rules of sections 3 and 4.

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
| API contract lint | `@redocly/cli`, run via a version-pinned `npx` in `npm run lint:api` (not installed as a dependency) |

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

Strict 3-tier separation (routes/controllers, services, data access). A
request flows in exactly one direction:

```
Route  ->  Controller  ->  Service  ->  Repository  ->  Model / store
               |
               +-> Validator   (pure input parsing, called by controllers)
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
├── repositories/           # data access behind async interfaces
├── models/                 # Mongoose schemas + interfaces
├── validators/             # parse unknown input into typed DTOs
├── errors/                 # framework-free domain error classes
├── middleware/             # cross-cutting Express middleware
├── scripts/                # CLI entry points (e.g. `npm run seed`)
└── types/                  # shared type declarations
```

### Routes — `src/routes/`
- Route definitions and middleware mapping **only**.
- Each file exports an `express.Router`.
- **No** inline handler bodies. Every handler is a named import from a
  controller: `router.get('/', getHealth)` — never `router.get('/', (req, res) => {...})`.
- No business logic, no database access, no `try/catch`.

### Controllers — `src/controllers/`
- Translate HTTP to and from the service layer: read `req`, parse it with a
  validator from `src/validators/`, call exactly one service function, set
  the status code, send the response.
- **No direct database queries.** A controller must never import from
  `src/models/` or call `.find()`, `.save()`, `.aggregate()`, etc.
- No business rules, validation rules, or computation beyond shaping the
  response payload. Calling a validator is fine; writing field checks inline
  is not.
- Use the `HttpStatus` constants from `src/types/http.ts`, not bare numbers.
- Signature is always `(req: Request, res: Response, next: NextFunction)`.
- Errors are forwarded with `next(err)`, never handled locally.

### Services — `src/services/`
- Pure business logic. This is the only layer allowed to call repositories.
- Business rules live here, including the double-booking rule and the
  reservation status transitions (`ALLOWED_FROM` in
  `reservation.service.ts`). A repository may execute a query a rule needs,
  but it does not decide the outcome.
- **Framework-free**: never import from `express`, and never reference `req`,
  `res`, or HTTP status codes. A service must be callable from a CLI or test
  with no HTTP involved.
- Accept and return plain typed objects/DTOs, not Express types.
- Throw typed domain errors; do not return `null` to signal failure.

### Repositories — `src/repositories/`
- Data access only, behind an exported interface whose methods return
  `Promise`s, so the in-memory implementation can be swapped for Mongoose
  without changing any service.
- Repositories provide the atomicity that business rules need, but do not
  contain the rules. For double-booking, the repository exposes
  `runExclusive(resourceId, work)` (a per-resource lock) and
  `existsActiveInRange(...)`; the service runs its check-then-insert inside
  `runExclusive`. A check-then-insert **outside** `runExclusive` is a race
  and is forbidden.
- Single-document state changes use one conditional write
  (`updateStatusIf`: `findOneAndUpdate` filtered on the current status), never
  a read followed by a separate save.
- Repositories are backed by Mongoose models. Seed data lives in
  `src/scripts/seed.ts`, not in a repository; `npm run seed` resets the
  database to it with fixed ObjectIds so manual tests are reproducible.
- MongoDB may run standalone, without multi-document transactions, so
  invariants cannot rely on them. The per-resource lock is a short-lived
  `ResourceLock` document.
- Identifiers are opaque in the contract. A string that is not a valid
  ObjectId is "not found"; never pass it to Mongoose, where the `CastError`
  would surface as a 500.

### Validators — `src/validators/`
- Pure functions `(input: unknown) => TypedDto` that throw `ValidationError`.
- Each one implements the matching `docs/openapi.yaml` schema: required
  fields, types, formats, and `additionalProperties: false`.
- No Express imports, no I/O.

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
- `process.exit()` is only allowed in `src/server.ts`. Scripts under
  `src/scripts/` set `process.exitCode` instead.

### API Contract
- `docs/openapi.yaml` (OpenAPI 3.0.3) defines every route, parameter, request
  body, response, and status code. **Do not add, rename, or remove an
  endpoint, field, or status code unless the spec changes first.** If a task
  needs a change to the HTTP surface, update the spec in the same change and
  say so.
- Interfaces in `src/types/reservation.ts` mirror `components/schemas` field
  for field. Use the spec's names exactly; do not invent aliases.
- Every error response body is `ErrorResponse` (`{ code, message }`), with
  `code` in SCREAMING_SNAKE_CASE. Map domain errors to HTTP status codes only
  in `errorHandler`.
- Date-times are RFC 3339 strings with an explicit offset on input, and UTC
  (`toISOString()`) on output.
- Run `npm run lint:api` after any spec change and report the real result.

### General
- Config is read from `process.env` in `src/config/` and nowhere else. No
  hardcoded ports, URIs, secrets, or magic strings in handlers.
- Never commit `.env`. Mirror every new variable into `.env-example`.
- Named exports only; no `export default`.
- Prefer `const`; `let` only when reassigned; never `var`.
- Keep functions under ~40 lines. Extract rather than nest deeply.
- Comment *why*, not *what*. Do not narrate obvious code.
- Do not add a comment banner or "Generated by AI" header to files.

### Multi-Tenancy (deferred until authentication exists)
- Once authentication exists, every tenant-owned schema carries a required,
  indexed `tenantId`, and every repository query filters on it. A query
  without a `tenantId` filter is then a bug, not a shortcut.
- `tenantId` will come from the authenticated principal, **never** from the
  request body, query, or path. Until then, the API is single-tenant: do not
  add a `tenantId` field to the contract or fake one with a default value.

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
- Run Prettier only on the files you changed. Running it on all of `src/`
  rewrites line endings in untouched files and buries the real diff.

---

## 5. Working Agreement

- Before writing code, state which layers you will touch and why.
- After writing code, run `npm run typecheck` and `npm run lint` and report
  the real results.
  Do not claim something compiles or passes without having run it.
- If a rule here is wrong or blocking, tell me — this file is a living
  document and I will change it. Do not work around it unilaterally.

---

## 6. Frontend (`client/`)

The client is a React + TypeScript single-page app built with Vite. It is a
consumer of `docs/openapi.yaml`, never a second source of truth.

### Tech stack
| Purpose | Allowed |
|---|---|
| UI | React (function components) |
| Build / dev server | Vite, `@vitejs/plugin-react` |
| Language | TypeScript (`.ts` / `.tsx` only) |
| HTTP | `fetch` (no axios, same as the backend) |
| Styling | CSS Modules (`*.module.css`), plus one global `index.css` for tokens |
| Lint | `oxlint` (from the Vite template) |

No other runtime dependency (state library, router, UI kit, Tailwind, date
library) without approval. `client/` has its own `package.json`; never add
frontend packages to the root one.

### Component architecture
- Function components only, each with an explicit `Props` interface
  (`interface ResourceListProps {...}`, exported for every exported
  component) and an explicit return type (`: JSX.Element` or
  `: JSX.Element | null`).
- Named exports only, as in the backend. The one exception is tool config
  that requires a default export (`vite.config.ts`).
- `src/components/` holds presentational and form components. A component
  renders state and raises events; it never builds a URL or calls `fetch`.

### State management
- React hooks only (`useState`, `useEffect`, `useCallback`, `useMemo`) and
  custom hooks in `src/hooks/`. No global store.
- **No inline API calls inside JSX or component bodies.** Components call a
  custom hook or a handler that calls a hook; hooks call `src/api/`.
- Every async workflow exposes explicit `isLoading` and `error` state, and
  every path out of it (success, API error, network error, unmount) clears
  the loading flag. A spinner that can hang is a bug.
- Effects that fetch abort on cleanup (`AbortController`) so a stale
  response never overwrites newer state.

### API layer — `src/api/`
- `campushubApi.ts` is the only module that talks HTTP. Its types live in
  `src/api/types.ts` and mirror `components/schemas` field for field,
  with the spec's names.
- Non-2xx responses are thrown as `ApiError` carrying the HTTP status and the
  `ErrorResponse.code`. Components branch on `code` (`DOUBLE_BOOKING`,
  `RESOURCE_UNAVAILABLE`, ...), never on message text.
- The base URL comes from `import.meta.env.VITE_API_BASE_URL`, defaulting to
  `/api/v1`, which the Vite dev server proxies to the backend. The backend
  therefore needs no CORS change.
- Date-times are sent with `toISOString()` (UTC, explicit `Z`), as the
  contract requires.

### Styling
- One CSS Module per component, colocated (`BookingForm.module.css`).
- Shared colours and spacing are CSS custom properties in `src/index.css`.
  No inline `style={{...}}` objects except for truly dynamic values.

### Verification
- After changing client code, run `npm run build` (which type-checks) and
  `npm run lint` inside `client/`, and report the real results.

---

## Changelog

- **2026-09-21** — Initial version (Lab 1).
- **2026-09-21** — Added `typescript-eslint` to authorized tooling. ESLint's
  default parser cannot read `.ts` at all, so the no-dependency rule made
  `npm run lint` impossible. It now enforces the section 3 rules mechanically
  (`no-explicit-any`, `no-floating-promises`, `explicit-function-return-type`)
  rather than leaving them as prose. Pinned `typescript` to 5.x as a
  consequence.
- **2026-09-28** — Lab 2: made `docs/openapi.yaml` the authoritative contract
  and added the API Contract rules. Added `repositories/`, `validators/`, and
  `errors/` to the architecture. The lab requires runnable endpoints with no
  database, and the rule that services talk only to Mongoose models left no
  compliant place for in-memory state. Controllers may now call validators,
  because no validation library is authorized and controllers may not
  contain field checks. Deferred the multi-tenancy rule: the contract has no
  tenant, and without authentication any `tenantId` would come from
  untrusted input.
- **2026-10-05** — Lab 3: repositories now use Mongoose instead of in-memory
  arrays. `src/app.ts` exposes `initializeApp()`, which connects to MongoDB
  (`MONGODB_URI`, now required) before building the app. Models use ObjectId
  `_id`s and an ObjectId `resourceId` reference. Added `src/scripts/` for the
  seed script, and documented the per-resource lock that replaces the
  in-memory store's synchronous check-and-insert.
- **2026-10-19** — Lab 4: moved the double-booking decision from the
  repository into `reservation.service.ts`. The lab requires the collision
  check in the service layer, while the previous rule kept it inside the
  repository so the check and the insert could not be separated. Both now
  hold: the repository supplies the lock (`runExclusive`) and the range
  query, and the service runs the rule inside the lock. Added the
  conditional-write rule for status changes (confirm/cancel). Added the
  formatter-scope rule from the Lab 4 steering log.
- **2026-10-26** — Lab 5: added section 6 for the React client in
  `client/`. Chose `fetch` over axios to stay consistent with the backend's
  ban, and CSS Modules over Tailwind because Tailwind adds build
  dependencies. Calls go through a Vite dev proxy so the backend's HTTP
  surface (and the spec) did not need a CORS change. Made explicit
  `isLoading`/`error` state mandatory, because unhandled 409s and hanging
  spinners are the failure mode this lab audits.
