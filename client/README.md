# CampusHub client

React + TypeScript (Vite) frontend for the CampusHub reservation API. It
consumes `../docs/openapi.yaml`; see section 6 of `../AGENTS.md` for the rules
it follows.

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
│   ├── types.ts          # mirrors components/schemas in the spec
│   ├── guards.ts         # runtime checks that responses match the contract
│   └── errorMessages.ts  # UI copy keyed on ErrorResponse.code
├── hooks/                # data and mutation state (isLoading / error)
├── components/
│   ├── ResourceList.tsx      # resource cards + type filter
│   ├── BookingForm.tsx       # time-slot form with validation
│   └── UserReservations.tsx  # active bookings + cancel
└── utils/                # date formatting, booking validation
```

There is no authentication yet, so the student is selected by ID in the
header (default `user-456`, the spec's example user).
