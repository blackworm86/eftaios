# Progress

Tracks the security and maintenance work. One row per item, updated as it lands.

## Priority 1 — security

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Room membership required for log, hatches, attacks, spots, replies and card requests | **done (code)** | Any signed-in user with a code could write these; now a player entry is required |
| 2 | A new seat cannot be taken once a game is in progress | **done (code)** | Rejoining an existing seat still works; joining late is refused by the rules, not only by the client |
| 3 | Six-character room codes | **done (code)** | `Sync.newCode` generates 6; the rules still accept 4–8 so existing rooms keep working |
| 4 | Append-only admin log | **done (code)** | Entries can be created, never changed or deleted; `by` must be the admin |
| 5 | Structural rule checks | **done** | `npm run rules:check`, 19 invariants asserted against `database.rules.json` |
| 6 | Firebase Emulator rules tests | **blocked** | Needs Java 11+ and `firebase-tools`; this machine has Java 1.8. Plan is written below |
| 7 | App Check for RTDB | **deferred** | Google closed new reCAPTCHA v3 registrations (the console field is disabled); the replacement, Fraud Defense / reCAPTCHA Enterprise, needs a Cloud billing account. Decision: skip — membership rules and CSP cover room abuse. |
| 8 | CSP meta tag | **done** | `default-src 'self'`, scripts only from self + gstatic, Firebase and wss endpoints, no objects; verified live (sign-in, RTDB reads/writes, no CSP console errors) |
| 9 | Publish rules in Firebase | **done** | Membership rules and the kick marker are live |
| 10 | Live verification of the published rules | **done** | `tools/verify-live.js`: six-letter code, member write, outsider log and mid-game seat denied, kick marker, live ban |
| 11 | Kicked player cannot lift the kick | **done** | `kicks/<uid>` written only by the host/lease; the seat guard refuses a kicked account; verified live |
| 12 | A ban ends the open session | **done** | The client watches `bans/<uid>` and signs the tab out; verified live |
| 13 | Room retention | **done** | `npm run cleanup:rooms` (dry run) deletes closed tables older than 14 days, optionally abandoned lobbies/games with `--stale-live`, prunes stale index entries and player-list references; 4 stale entries removed on first run |

## What changed in this pass

- `database.rules.json`
  - membership checks on `log`, `hatches`, `attacks` (create + replies), `spots` (create + replies), `requests`;
  - `players/<uid>` cannot be created while `settings/status === 'playing'`;
  - `adminlog` is create-only and attributed (`by === auth.uid`);
  - `kicks/<uid>` can only be written by the host/lease, and a kicked account cannot rewrite its seat;
  - a ban also ends an open session (client watcher).
- `sync.js` — room codes are six characters.
- `tools/rules-check.js` — invariant checker; `npm run rules:check`.
- `package.json` — dev dependencies and scripts (`serve`, `test`, `rules:check`, `admin`).

## Verify locally

```powershell
npm install          # one-time; installs playwright-core and firebase-admin together
npm run rules:check  # 19 invariants
npm run serve        # then open http://localhost:8123/
npm test             # browser suite
```

## Deploy

1. Publish `database.rules.json` from `firebase-rules.html` (unchanged procedure).
2. Push the code; Pages updates automatically.
3. New tables get 6-character codes; old links and rooms keep working.

## Blocked: emulator suite

The Firebase Emulator needs **Java 11+**; only Java 8 is installed, and `firebase-tools` is not in the repo.
To unblock:

1. Install a JRE 11+ (Temurin) and `npm install --save-dev firebase-tools`;
2. add `firebase.json` with `database.rules` and an emulator port;
3. add `@firebase/rules-unit-testing` and one test per write path (guest join, seat in progress, log as non-member, seat checkpoint owner, ban, admin close, append-only audit);
4. add `npm run test:rules` and a CI workflow.

Until then, `tools/rules-check.js` is the regression guard: it catches an invariant being deleted, not a wrong expression.

## Next in Priority 1

- **App Check** — deferred: classic reCAPTCHA registration is closed, Fraud Defense needs billing. Revisit only if the project goes public.
- **Emulator tests** remain the main gap.
- **Retention**: run `npm run cleanup:rooms` monthly; use `--stale-live 30` to also clear lobbies and games that were abandoned a month ago.

## Priority 2 — maintenance and clean code

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Dead helpers removed | **done** | `Sync.watchRooms`, `writeIndexFor`, the duplicate `Auth.adminopen`, unused `readProfile` export, `.accountbar` CSS, `tools/cleanup-e2e.js` |
| 2 | One restore path | **done** | The local per-room snapshot is gone; `seats/<uid>` is the only source. Two resume functions remain by design: rebuild (no local game) and adopt-if-newer (reload) |
| 3 | Architecture map | **done** | `ARCHITECTURE.md`: modules, the three authorities, data model, flows, invariants, limits |
| 4 | Reproducible toolchain | **done** | `package.json`, lockfile, `npm` scripts |
| 5 | Emulator and CI | **blocked** | Java 11+ needed |

## Log

- 2026-10-22 — Priority 1 items 1–5 implemented; rules invariant checker added; `package.json` + lockfile; lobby/online/rejoin/close/online-bots tests pass; `rules:check` 19/19.
- 2026-10-22 — Published rules verified against the real project with `tools/verify-live.js`: member write, outsider denials, kick marker, and a ban that signs the open tab out. CSP added and verified. App Check deferred (provider deprecation) — decision recorded.
- 2026-10-22 — Kick rules verified live (table can mark, kicked seat cannot rewrite itself, self-read allowed). Added the CSP meta tag and verified it against the real project: sign-in, RTDB reads/writes and the app boot with no CSP console errors; browser suite green.
- 2026-10-22 — Room retention tool added and run: 4 stale index entries removed, no rooms old enough yet. Command: `npm run cleanup:rooms` (dry run) and `--apply`.
- 2026-10-22 — Clean-code pass: removed five dead symbols/tools, deleted the duplicate local resume path (server seat is now the only one), wrote `ARCHITECTURE.md`. Lobby/online/rejoin/layout tests green.
