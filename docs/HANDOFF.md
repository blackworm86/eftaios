# Session handoff

Written at the end of a long development session (2026-10-17 to 2026-11-08) so a fresh session can start cold.
Read this file first, then `CLAUDE.md`. Everything below was checked against `main` at commit `c832fbd`, not from memory.

## 1. First ten minutes

1. `git fetch origin main`. **Always do this first**: a Windows PC pushes automated "Network training: iteration N" commits to `main`
   (they only touch `nn/*`), so any branch goes stale within hours. This session's own branch was 510 commits behind by the end.
2. Read, in this order: `CLAUDE.md`, this file, `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md`, `README.md`.
   For bot work also `docs/BOT_PLAN.md`, `docs/BOT_HANDOVER.md`, `tools/rounds/NOTES.md`, `nn/status.md`.
3. Start the static server and run the tests (section 5). A green suite is the baseline for any change.
4. Confirm the two skills are live (section 3): the first message of a session should show "PONYTAIL MODE ACTIVE", and
   `.claude/skills/impeccable/scripts/impeccable context` should resolve `PRODUCT.md` and `DESIGN.md`.

## 2. State of the repository

- Remote `blackworm86/eftaios`. **`main` is the only branch and there are no open pull requests.** Everything built in the previous
  sessions is merged. GitHub Pages deploys from `main` only (`.github/workflows/pages.yml`); `checks.yml` runs on pull requests.
- Live app: static files, no build step. Firebase Realtime Database + anonymous/Google/email auth. See `ARCHITECTURE.md` for modules,
  the data model, who may write what, and known limits.
- Service worker cache name is the `V` constant in `sw.js` (currently `eftaios-v80`); bump it when shipping changes users must see.
  The footer version comes from `version.json`, stamped by the Pages workflow.
- **Firebase rules** live in `database.rules.json` and are *not* deployed by git. Whenever that file changes, the owner must republish it
  from `firebase-rules.html` (copy button, paste into the console, Publish). `progress.md` says the current rules are published.
  `npm run rules:check` asserts 19 invariants; the emulator suite (`npm run test:rules`) needs Java 21 and runs in CI.
- Model, bots and training: `bot.js` (planner), `nn.js` + `nn/net.json` (distilled network level), `rl/` (Python training, run on the
  owner's Windows PC via `rl/NN.bat`), `tools/` (simulator, reports, admin). Current network is level with the Hard copy
  (+3.1 points, `nn/status.md`). Do not retrain or overwrite `nn/*` from a cloud session.

## 3. Skills and hooks (Impeccable UI and Ponytail)

Both are **vendored into the repository** and wired in `.claude/settings.json`, so they load in local and cloud sessions alike.
Cloud sessions do not install plugins declared under `enabledPlugins` / `extraKnownMarketplaces`, but they do honour `.claude/settings.json`
hooks and `.claude/skills/`, which is why the vendored form is used. Do not add the plugin keys on top (duplicate hooks).

| | Ponytail | Impeccable |
|---|---|---|
| What | "Lazy senior dev" rules: smallest complete change, reuse before writing, name what was skipped | UI design fluency: `/impeccable critique, audit, polish, layout, typeset, clarify, distill, adapt, harden …`, plus a mechanical design detector |
| Files | `.claude/ponytail/` (hooks), `.claude/skills/ponytail*` (skill and `ponytail-audit/-debt/-gain/-help/-review`) | `.claude/skills/impeccable/`, `.claude/agents/impeccable-*.md` |
| Hooks | SessionStart (injects the ruleset), UserPromptSubmit (mode tracker), SubagentStart | SessionStart, PostToolUse on Edit/Write (checks UI edits), Stop (deep pass) |
| Use | Levels `/ponytail lite\|full\|ultra`; "stop ponytail" turns it off | Context files: `PRODUCT.md`, `DESIGN.md`. Manual scan: `.claude/skills/impeccable/scripts/impeccable detect --json index.html style.css` |
| Needs | `node` on PATH | `env.IMPECCABLE_NO_TELEMETRY=1` is set in settings; hook state is machine-local (`.impeccable/`, git-ignored) |
| Version here | 5.3.2 (upstream 5.3.3) | launcher 0.1.16 (skill 4.6.0) |

Verified on 2026-11-08 in a cloud container: `settings.json` is valid JSON, Ponytail's SessionStart hook runs and emits its ruleset,
Impeccable's `context` resolves both context files, its hook runs, and the detector runs. Ponytail's hooks only write local state
(a mode flag, possibly a task CSV under `~/.config/ponytail`); its webhook is off by default. Impeccable's detector currently reports
**35 findings** on `index.html` + `style.css` (e.g. `side-tab`, `pulsing-dot`, design-system radius and font-size drift). That is
existing UI debt, not a regression; new UI should not add to it.

To update either skill: re-copy from `pbakaus/impeccable` (`plugin/skills/impeccable`, `plugin/agents`) or `DietrichGebert/ponytail`
(`hooks/`, `skills/`, `plugin.json`), keep the `.claude/settings.json` hook commands, and re-run the checks above.

## 3b. Conventions the owner expects

- **Branch and PRs:** work on the branch the session is given and push after each commit. Never open a pull request unless asked.
  (`docs/BOT_HANDOVER.md` names an older work branch; that text is stale, the branch no longer exists.)
- **Every user-visible string needs Italian** in `i18n.js`, using the wording of the Italian rulebook (e.g. Scialuppe, carta Personaggio).
- **UI work follows `DESIGN.md`** and Impeccable's rules: no glow or gradient washes, no thick side borders, no emoji as icons, one icon
  family, fixed type scale, touch targets of 44 px, no scrolling in the main play panel (use sub-tabs, sheets, dialogs).
  Check phone (360x640, 390x844), tablet portrait and landscape, desktop, English and Italian, and large system text.
- **Secrets stay on the device**: a bot or a player only ever reads the public view plus its own seat. Bots must not cheat.
- Run the tests before every push; add a test for new behaviour.
- The owner reads English and Italian, writes quickly with typos, and tests on an Android phone in Italian. Screenshots of what is
  wrong are the best bug reports; the phone may be running a cached older version (close and reopen the app twice).

## 4. What this session built (all merged; later work changed some of it)

Companion and tracking: lobby flow (host, code/QR/link, faction pick), Italian translation, turn order, full digital-card mode with
automatic items, attacks and Spotlight, undo, host closes the table for everyone, pass and play, manual ("by hand") tracking,
map notes, the map packs and gallery, Classic map style, the usability pass (no-scroll panels, sub-tabs, settings list), the
marking system (colour-blind-safe palette, bluff lines, follow-a-player zones, tracking sheet), bots at three levels in pass and play
and online, end-of-game real routes and eliminated/escaped markers on the player strip, GPU-composited map panning.
Since then other sessions replaced the first bot with the probability-map planner, added accounts, admin panel, games viewer, printed
icons, route arrows and the neural-network level. **Trust the code and `README.md` over this paragraph.**

## 5. Running things

- Dev server: `npm run serve` (port 8123) or `python3 -m http.server 8123`. It stops now and then; if every test fails with
  `ERR_CONNECTION_REFUSED`, restart it.
- Tests (88 files in `tests/`): on Windows `npm test [filter]` (shim maps Playwright). In a Linux cloud container the tests import
  `/opt/node22/lib/node_modules/playwright`, so `node tests/<name>.test.js` works with the server running; run them one by one
  (`for f in tests/*.test.js; do node $f; done`), a few are slow. `tests/fake-firebase.js` is an in-memory database; never point the
  suite at the real one (scripted browsers are blocked from writing games anyway).
- Also: `node tests/maps.check.js`, `npm run rules:check`, simulator `node tools/sim.js` and `tools/report.js` (see `docs/BOT_HANDOVER.md`).
- Screenshots for UI checks: Playwright with headless Chromium (already installed; do not run `playwright install`).

## 6. Open items

- **Bots:** targets and plan in `docs/BOT_PLAN.md`; experiments and what not to repeat in `tools/rounds/NOTES.md`. Open problem: on 8-player
  Marconi with seven Hard bots the Aliens cluster. The network is level with Hard, not better.
- **Security backlog** (`progress.md`): emulator rules tests need Java 21 locally (CI covers them); App Check deferred.
- **UI debt:** the 35 detector findings above.
- **Android install** ("Impossibile aprire l'app"): the manifest was given a fresh `id` and `start_url=./?source=pwa` to bypass a stale
  installed copy; whether the owner confirmed it works is unknown. The fix on the phone is uninstall, clear site data, reinstall.
- **Ponytail's task ledger:** its mode tracker may append a per-project CSV under `~/.config/ponytail` (local only). Not verified in this
  vendored setup; harmless, but the owner has not been asked whether they want it.
- The owner had not yet seen the very latest game-over route reveal working online on a real phone (routes need the rules that were
  published at the time; if only the player's own route shows, check the rules and the "Routes could not be shared" message).
