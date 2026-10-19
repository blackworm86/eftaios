# EFTAIOS Companion

Web companion for the physical board game *Escape from the Aliens in Outer Space* (Black Edition maps: Galilei, Fermi, Galvani). Cards are **not** included: you keep using the real deck. The app replaces the paper map and pencil:

- hex map with pan / pinch-zoom, reachable sectors highlighted (Human 1, Alien 2, fed Alien 3, Adrenaline 2)
- your private route with turn numbers, 39-turn counter
- exact wording to announce (noise, silence, attack, hatch), item and attack helpers
- shared-table notes: announcements heard, hatch status, Spotlight range warning
- Basic, Advanced and Infection rule sets; map editor / import / export; offline (PWA)

Run: `python3 -m http.server` in this folder and open http://localhost:8000.

Maps: Black Edition (Galilei, Fermi, Galvani), *Before the World Ends* (Machiavelli, Frenzy, Morgenland, En Garde, Sinistra, Sound of Silence) and *Spring* (Dilemma, Cavour, Balena, Ascesa, Garibaldi, Socrates). The map picker groups them by pack and shows a preview. `node tests/maps.check.js` verifies every map.

Map format (`maps/maps.json`): `rows_data` is 14 strings of 23 characters (row 01..14, columns A..W): `.` dangerous, `s` secure, `x` empty space, `H` human, `A` alien, `1`-`4` hatches.

## Playing

1. **Host** taps *Host a table*, picks map and rules, and shares the code, QR or link.
2. **Players** join, then each draws a Character card from the physical deck and picks Human or Alien in the app (never shared with anyone).
3. When everybody is *Ready* the host taps *Start game*; a random first player is announced.

**Turns:** the host arranges the order of play in the lobby; only the player whose turn it is can act, and everyone else sees whose turn it is. Eliminated or escaped players are skipped, and the host can skip an absent player.

**Digital cards (full online):** pick *Digital cards* when creating the table. The host device deals the 8 Character cards and shuffles the 25 Sector, 12 Item and 6 Escape Hatch cards, tracks the draw and discard piles and reshuffles the discards when a pile runs out. Items, Spotlights and attacks are resolved automatically (Defense is played for you, Spotlight positions are revealed, attacks after movement). Positions and routes stay on each device; the host must keep the app open while playing.

**Pass and play:** *Pass and play (one device)* on the start screen lets 2–8 players share one phone or tablet with digital cards. After each turn a hand-over screen hides everything until the next player taps their name; roles, routes and items stay private per player.

**Map markers:** every player is a rounded hexagon in their own colour; routes are drawn as arrows showing the direction of each move; an attack shows a starburst on the sector with a claw badge (Alien) or a crosshair badge (Human with an Attack card);  the border shows the faction you suspect (black = you, yellow = undecided, blue = Human, red = Alien). Your bluffs (noise announced away from where you really are) appear as semi-transparent markers in your colour with the turn number. Tap a player on the map strip to see only their timeline.

**Tracking by hand:** chosen at setup (by the host for a table) and applies to all players. Other players are no longer marked automatically; tap ✎ on the map strip, pick a player and tap the sectors to mark their steps (the turn number can be adjusted).

**Notes:** tap 📝 on the map, pick a sector, choose a sticker and write an optional note. Tap the sector later to read, edit or delete it. Notes are private.

Offline or without Firebase, *Play without a table* works on a single device.

Tests: serve the folder on port 8123 and run `node tests/lobby.test.js`, `tests/turns.test.js`, `tests/online.test.js`, `tests/online2.test.js`, `tests/hot.test.js`, `tests/markers.test.js`, `tests/overlap.test.js`, `tests/undo.test.js` and `tests/close.test.js` (uses an in-memory Firebase stand-in, `tests/fake-firebase.js`).

## Deploy: GitHub Pages + Firebase

**GitHub Pages**: *Settings → Pages → Source: GitHub Actions*. `.github/workflows/pages.yml` publishes on every push.

**Firebase** (Realtime Database): enable *Authentication → Anonymous*, create the database, put the web config in `firebase-config.js`, publish `database.rules.json` (Realtime Database → Rules), and add `<user>.github.io` under *Authentication → Settings → Authorized domains*. The rules must be re-published whenever `database.rules.json` changes.
