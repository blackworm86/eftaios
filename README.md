# EFTAIOS Companion

Web companion for the physical board game *Escape from the Aliens in Outer Space* (Black Edition maps: Galilei, Fermi, Galvani). Cards are **not** included: you keep using the real deck. The app replaces the paper map and pencil:

- hex map with pan / pinch-zoom, reachable sectors highlighted (Human 1, Alien 2, fed Alien 3, Adrenaline 2)
- your private route with turn numbers, 39-turn counter
- exact wording to announce (noise, silence, attack, hatch), item and attack helpers
- shared-table notes: announcements heard, hatch status, Spotlight range warning
- Basic, Advanced and Infection rule sets; map editor / import / export; offline (PWA)

Run: `python3 -m http.server` in this folder and open http://localhost:8000.

Map format (`maps/maps.json`): `rows_data` is 14 strings of 23 characters (row 01..14, columns A..W): `.` dangerous, `s` secure, `x` empty space, `H` human, `A` alien, `1`-`4` hatches.

## Deploy: GitHub Pages + Firebase

**GitHub Pages** (static hosting): in the repo go to *Settings → Pages → Source: GitHub Actions*. `.github/workflows/pages.yml` publishes the site on every push to `main`.

**Firebase** (optional table sync between devices, Realtime Database):
1. Create a Firebase project, add a Web app, enable *Authentication → Anonymous* and create a *Realtime Database*.
2. Paste the web config into `firebase-config.js` (safe to commit).
3. Publish the rules: `npx firebase-tools deploy --only database` (uses `database.rules.json`).
4. In the Firebase console *Authentication → Settings → Authorized domains*, add `<user>.github.io`.

Players then open *Notes → Table sync*: one creates a room, the others join with the 4-letter code. Only announcements and hatch status are shared; positions never leave the device.
