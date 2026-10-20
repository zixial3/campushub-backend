# Lab 4 Steering Log

Failure loops and hallucinations found while the AI agent implemented the
Lab 4 reservation engine, and how each one was steered back on course.

**Scope built in this lab:** `isAvailable` filter on `GET /resources`,
double-booking check moved into `src/services/reservation.service.ts`,
`PATCH /reservations/{id}/confirm`, and `PATCH /reservations/{id}/cancel`.

**Verification baseline:** before any code changed, the 25-case regression
suite from Labs 1–3 was run against the Lab 3 code (25/25 passing). After the
change: 25/25 regression and 21/21 new Lab 4 cases, against a real `mongod`
7.0. Separately, stopping MongoDB mid-run returned `500 INTERNAL_ERROR`.

---

### Incident 1: Double-booking check in the wrong layer

- **Initial Agent Output:** The Lab 4 spec requires the double-booking check in
  `src/services/reservation.service.ts`, but the existing code (generated in
  Lab 3) ran the whole overlap check inside the repository's
  `insertIfSlotFree`. The service only turned `inserted: false` into a 409.
  The obvious fix, an `exists()` query in the service followed by a separate
  `create()`, would have brought back the race the Lab 3 lock was built to
  stop: two concurrent requests could both see the slot as free and both
  insert.
- **Root Cause:** The context file and the new requirement contradicted each
  other. AGENTS.md (Lab 3) said invariants are enforced atomically in the
  repository, "not as a check-then-write in the service". The agent was
  following the older rule, and nothing in the context said how to satisfy
  both.
- **Remediation Prompt:** "The Lab 4 spec requires the double-booking check
  in src/services/reservation.service.ts, but AGENTS.md forbids a
  check-then-write in the service because it races. Keep atomicity in the
  repository and the rule in the service: expose the per-resource lock as
  `runExclusive(resourceId, work)` and a range query
  `existsActiveInRange({ resourceId, startsBefore, endsAfter })`, then have
  `createReservation` run the overlap check and the insert inside
  `runExclusive`. Update AGENTS.md so the two rules no longer contradict."
- **Resolution:** The overlap formula (existing starts before new `endTime`
  AND ends after new `startTime`) is now visible in the service as
  `startsBefore: input.endTime, endsAfter: input.startTime`. Verified with
  20 concurrent POSTs for one slot (exactly one 201, nineteen 409s), and
  with 10 rounds of "cancel, then 5 parallel rebooks of the freed slot"
  (exactly one 201 in every round). The AGENTS.md changelog entry for
  2026-10-19 records the new rule.

### Incident 2: Generated test referenced an undefined variable and could not fail

- **Initial Agent Output:** The first version of the cancel-and-rebook race
  test in the manual test script used `$R104`, a resource ID that was never
  defined. It built slot dates with substring arithmetic on the round
  number, and it redirected request output to a file named `/tmp/null`
  instead of `/dev/null`. It also counted a PASS whenever setup succeeded,
  without checking the race outcome at all. The undefined `$R104` also broke
  the separate "cancel a PENDING reservation" case. Its setup would have
  sent an empty `resourceId` (400), leaving an empty ID in the PATCH URL
  (404 route not found). That case would have failed for a reason unrelated
  to the code under test.
- **Root Cause:** The test was generated in one pass and not re-read. Bash
  without `set -u` expands an undefined variable to an empty string, so
  nothing would have flagged it. A test that asserts nothing passes no
  matter what the code does.
- **Remediation Prompt:** "Rewrite the race test so it can fail: define
  every resource ID it uses, give each round its own valid RFC 3339 slot,
  write each request's status code to a temp directory, and assert exactly
  one 201 per round. Do not redirect to /tmp/null."
- **Resolution:** Caught on review before the first run. The rewritten test
  defines `R104`, uses one slot per day (`2026-12-10` through `2026-12-19`),
  and fails the round unless exactly one of five rebooks returns 201. It
  passed all 10 rounds.

### Incident 3: Formatter rewrote untouched files, and the first fix silently did nothing

- **Initial Agent Output:** Running `prettier --write src` to format the new
  code converted line endings from CRLF to LF in 10 files this lab never
  touched (models, config, server, seed script). `git status` showed 20
  modified files, but only 10 had real changes. The first fix was a loop
  meant to restore every file whose diff disappears when line endings are
  ignored. It restored nothing and reported no error.
- **Root Cause:** Prettier was run on the whole directory instead of the
  changed files. On this Windows checkout, Git keeps CRLF in the working
  tree, while Prettier writes LF. The restore loop relied on an assumption
  about `git diff --quiet --ignore-cr-at-eol` that was never checked against
  real output, so its condition never matched.
- **Remediation Prompt:** "Only the 10 files listed by `git diff --stat`
  have real changes. Restore the others explicitly by name with
  `git checkout -- <files>`, then show `git status` to prove only those 10
  remain. From now on, run Prettier only on files you changed."
- **Resolution:** `git status` listed exactly the 10 intended files.
  Typecheck and lint were re-run cleanly afterwards. AGENTS.md section 4 now
  limits Prettier to changed files.

---

## Takeaways

- The most dangerous failure (Incident 1) did not look like a failure. The
  naive fix compiles, passes every single-request test, and is still wrong
  under concurrency. Only a deliberate concurrency test exposes it.
- Two incidents came from "verification" that verified nothing: a test with
  no assertion, and a fix with no visible effect. Every check needs an
  outcome that could have come out the other way.
- When a new requirement conflicts with the context file, update the context
  file in the same change. Otherwise the next session rediscovers the
  conflict and the agent follows whichever rule it reads first.
