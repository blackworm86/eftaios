# EFTAIOS: instructions for Claude

Companion and online port of the board game *Escape from the Aliens in Outer Space*. Static app (vanilla JS, no build step) on GitHub Pages + Firebase.

**Start every session by reading `docs/HANDOFF.md`**, then `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md`. Run `git fetch origin main` first:
an automated training job commits to `main` constantly.

## Always on (vendored in `.claude/`, wired in `.claude/settings.json`)

- **Ponytail**: smallest complete change, reuse before writing, finish with what you skipped. `/ponytail lite|full|ultra`.
- **Impeccable**: for any UI work use `/impeccable <command>` (critique, audit, polish, layout, typeset, clarify, adapt, harden).
  Its hook checks every UI edit; the context files are `PRODUCT.md` and `DESIGN.md`. New UI must not add detector findings:
  `.claude/skills/impeccable/scripts/impeccable detect --json index.html style.css`.

## Rules

- Push to the branch you are given after each commit. **Do not open a pull request unless asked.**
- Every user-visible string needs an Italian translation in `i18n.js` (wording from the Italian rulebook).
- A bot or player may only use the public view plus its own seat. Never leak a position, role or route before the rules allow it.
- If you change `database.rules.json`, tell the owner to republish it via `firebase-rules.html`; git does not deploy it.
- Bump `V` in `sw.js` when a change must reach installed apps.
- Run the relevant `tests/*.test.js` (server on port 8123) before pushing; add a test for new behaviour.
- No scrolling in the main play panel, no emoji as icons, 44 px touch targets; check phone, tablet and desktop, English and Italian.
