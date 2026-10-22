# Progress

Tracks the security and maintenance work. One row per item, updated as it lands.

## Priority 1 — security

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Room membership required for log, hatches, attacks, spots, replies and card requests | **done (code)** | Any signed-in user with a code could write these; now a player entry is required |
| 2 | A new seat cannot be taken once a game is in progress | **done (code)** | Rejoining an existing seat still works; joining late is refused by the rules, not only by the client |
| 3 | Six-character room codes | **done (code)** | `Sync.newCode` generates 6; the rules still accept 4–8 so existing rooms keep working |
| 4 | Append-only admin log | **done (code)** | Entries can be created, never changed or deleted; `by` must be the admin |
| 5 | Structural rule checks | **done** | `npm run rules:check`, 17 invariants asserted against `database.rules.json` |
| 6 | Firebase Emulator rules tests | **blocked** | Needs Java 11+ and `firebase-tools`; this machine has Java 1.8. Plan is written below |
| 7 | App Check for RTDB | **todo** | Needs the console, a reCAPTCHA key and live testing |
| 8 | CSP meta tag | **deferred** | Must be verified against real Firebase auth first; a wrong `connect-src` breaks sign-in silently |
| 9 | Republish rules in Firebase | **pending owner** | None of the above protects anything until the rules are published |

## What changed in this pass

- `database.rules.json`
  - membership checks on `log`, `hatches`, `attacks` (create + replies), `spots` (create + replies), `requests`;
  - `players/<uid>` cannot be created while `settings/status === 'playing'`;
  - `adminlog` is create-only and attributed (`by === auth.uid`).
- `sync.js` — room codes are six characters.
- `tools/rules-check.js` — invariant checker; `npm run rules:check`.
- `package.json` — dev dependencies and scripts (`serve`, `test`, `rules:check`, `admin`).

## Verify locally

```powershell
npm install          # one-time; installs playwright-core and firebase-admin together
npm run rules:check  # 17 invariants
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

- Publish the rules (owner).
- App Check + CSP once there is a live-auth test path.
- A kick cannot be undone by the player today? Rules allow clearing `out`; needs an owner-only write on that field.

## Log

- 2026-10-22 — Priority 1 items 1–5 implemented; rules invariant checker added; `package.json` + lockfile; lobby/online/rejoin/close/online-bots tests pass; `rules:check` 17/17. Emulator still blocked on Java.
