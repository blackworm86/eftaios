# Architecture

A static app with no build step. GitHub Pages serves the files; Firebase provides identity and the shared table. Everything game-related runs in the browser — there is no server of ours.

## Modules

| File | Role |
|---|---|
| `app.js` | State (`S`), save/checkpoint, map rendering, panels, toasts, dialogs, icons |
| `game.js` | Rules in play: movement, announcements, items, attacks, turn order, game over |
| `cards.js` | Deck data and pure helpers (deal, draw, pod cards, hit resolution) |
| `online.js` | Digital dealer: roles, decks, bot turns, attack/Spotlight fan-out, host duties |
| `hot.js` | Pass and play, one device |
| `bot.js` | The AI planner behind `Bot.turn`; reads only the public view plus its own seat |
| `sync.js` | Firebase init, auth, room subscription, accounts, room index, checkpoints |
| `auth.js` | Sign-in, account, My games screens |
| `admin.js` | Admin panel (players, rooms, maps, reports, audit) |
| `flow.js` | Welcome, host setup, lobby, join, restore |
| `mapman.js` | Map manager and editor |
| `i18n.js`, `style.css`, `index.html` | Copy, design system, shell |

## Who may do what

Three authorities, deliberately separate:

- **Host** (`rooms/<code>/settings/host`): the account that created the table. Controls the lobby, can start, can hand over, can close. Only the host or an admin may write settings.
- **Lease holder** (`rooms/<code>/lease/uid`): the device currently running bots and dealing cards. Usually the host, movable to any player via takeover or hand-over. The lease is released on unload and by `onDisconnect`.
- **Admin** (`auth.token.admin` claim): moderation only. Can read metadata, logs, reports and finished routes, but never `secret/*` or `seats/*`, so live positions stay private.

A player's own seat (`seats/<uid>`) and role (`secret/<uid>`) are readable only by that uid.

## Data model

```
users/<uid>/profile        handle, display name, created
users/<uid>/rooms/<code>   that player's game list (role, last at)
users/<uid>/games/<code>   finished-game summary (last 20)
users/<uid>/stats          running totals
users/<uid>/maps/<id>      private map vault
handles/<handle>           uniqueness reservation
pubmaps/<id>               published maps (owner, rows, hidden)
reports/<id>               map/user reports
adminlog/<id>              append-only audit
bans/<uid>                 admin-only ban flag
roomIndex/<code>           code, host, map, status, seats, last activity (admin-readable)
rooms/<code>/
  created, settings, players, turn, log, hatches, counts
  lease, kicks/<uid>
  attacks/<id>/replies, spots/<id>/replies, requests
  secret/<uid>             role, char, inbox
  seats/<uid>              pos, path, items, over, turn, at — owner only
  hostdata                 decks and bot state — host/lease only
```

## Flows

- **Start**: host creates `settings` (status `lobby`), their player row and the lease; `roomIndex` records the table. Starting deals `secret/<uid>` for every seat, builds `hostdata`, sets `turn` and flips `settings.status` to `playing`.
- **Turn**: the active player edits their own `seats/<uid>` and writes public `log` entries; attacks and Spotlights go to their own node and every other device answers for itself.
- **Bot turn**: only the lease holder plays it; `hostdata` holds every bot seat. Takeover loads `hostdata` and re-attaches the request listener for the current room generation.
- **Resume**: a device with no local game reads `seats/<uid>` (owner-only) plus `secret/<uid>` and rebuilds the view. There is no local per-room copy anymore.
- **Table and games**: a room is a table that hosts many games. `settings.n` counts them. When a game ends (`status = over`) the host can **Play again**: `Sync.rematch` wipes the per-game nodes (turn, log, hatches, counts, attacks, spots, requests, hostdata, secrets) in one multi-path update and puts the table back in `lobby` with `n + 1`. Each player clears their own row and seat (`Sync.resetMine`), since rules let only them write those.
- **Records**: each registered player's result is written once per game to `users/<uid>/games/<code>[-n]` (last 20) and added to `stats`.
- **Close**: the host's close sets `over`/`closed` so every device sees it, then deletes `roomIndex/<code>` and `rooms/<code>` after a short grace. The rules allow deleting a whole room only to the host or the admin. The admin panel's *Delete closed and idle rooms* sweeps leftovers (closed, or idle over 7 days); `tools/cleanup-rooms.js` does the same from a terminal.

## Invariants the rules enforce

1. A seat is required for every room write (log, hatches, attacks, spots, replies, requests).
2. A seat cannot be created once a game is playing; rejoining an existing seat works.
3. `secret`, `seats` and `hostdata` are never readable by other players or the admin.
4. The audit log is append-only and self-attributed.
5. Only a registered, unbanned account creates a table; a kicked account cannot rewrite its seat.
6. Every write path is covered by `npm run rules:check`; the emulator suite is the next step.

## Local work

```
npm install
npm run serve        # http://localhost:8123
npm test             # browser suite (headless Chrome, in-memory Firebase)
npm run rules:check  # rule invariants
node tools/verify-live.js   # real Firebase, needs the service-account key
```

## Known limits

- No server-side engine: client results are trusted; App Check is deferred (provider deprecation).
- Guests are anonymous per browser; only registered accounts travel.
- Bots need a lease holder online; the table pauses when nobody hosts.
- Spark allows 100 concurrent database connections.
