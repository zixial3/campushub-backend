# CampusHub client

React + TypeScript (Vite) frontend for the CampusHub reservation API. It
consumes `../docs/openapi.yaml` and imports the API types from
`../shared/contract.ts`; see section 4 of `../AGENTS.md` for the rules it
follows.

## Run

The backend must be running first (from the repository root):

```bash
npm run seed   # reset MongoDB to the fixed seed data
npm run dev    # API on http://localhost:3000
```

Then, in `client/`:

```bash
npm install
npm run dev    # UI on http://localhost:5173
```

The Vite dev server proxies `/api` to the backend, so no CORS setup is needed.
Override the target with `CAMPUSHUB_API_ORIGIN` in `.env.local` (see
`.env.example`).

## Checks

```bash
npm run build  # type-checks (strict) and bundles
npm run lint   # oxlint
```

## Layout

```
src/
├── api/
│   ├── campushubApi.ts   # the only module that calls fetch
│   ├── guards.ts         # runtime checks that responses match the contract
│   └── errorMessages.ts  # UI copy keyed on ErrorResponse.code
├── hooks/
│   ├── useApiQuery.ts      # fetch-on-mount with abort, loading, error
│   ├── useResources.ts     # resource list
│   ├── useReservations.ts  # a user's reservations: list, cancel, create
│   └── useBookingForm.ts   # booking form state and submit flow
├── components/
│   ├── ResourceList.tsx      # resource cards + type filter
│   ├── BookingForm.tsx       # time-slot form (renders useBookingForm)
│   └── UserReservations.tsx  # active bookings + cancel
└── utils/                # date formatting, booking validation
```

API data types (`Resource`, `Reservation`, `ErrorResponse`, ...) are not
declared here: they come from `../shared/contract.ts`, the same file the
backend imports. The Vite dev server is allowed to serve that directory
(`server.fs.allow` in `vite.config.ts`).

There is no authentication yet, so the student is selected by ID in the
header (default `user-456`, the spec's example user).
