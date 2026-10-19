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

## Three ways to play

**Online table** (digital): the host taps *Host a table*, picks the map and the rules (Basic, Advanced or Infection) and shares the code, QR or link. Players join by typing the code, opening the link or scanning the QR code with the camera (the QR button next to *Join*), tap *Ready*, and the host taps *Start game*; a random first player is announced. The host device deals the 8 Character cards and shuffles the 25 Sector, 12 Item and 6 Escape Hatch cards, tracks the draw and discard piles and reshuffles the discards when a pile runs out. Items, Spotlights and attacks are resolved automatically (Defense is played for you, Spotlight positions are revealed, attacks after movement). Positions and routes stay on each device; the host must keep the app open while playing. The host arranges the order of play in the lobby; only the player whose turn it is can act. Eliminated or escaped players are skipped, and the host can skip an absent player. Bots can fill seats (Easy, Normal, Hard).

**Pass and play** (digital, one device): *Pass and play* lets 2–8 players share one phone or tablet, with bots if you like. After each turn a hand-over screen hides everything until the next player taps their name; roles, routes and items stay private per player.

**Companion** (the paper sheet): you play the real game with the real cards and use the app instead of paper and pencil. You pick your Character card (Human or Alien), the app tracks your own route and gives you the exact words to announce, and you write down what the other players declare. Tap ✎ on the map strip, pick a player (or add one with +) and record what they said: Noise in a sector (tap the sector), an Attack, Silence, a Silent Sector, or an item played (Spotlight and Attack also ask for a sector). Everything lands on the map as markers and arrows, in the table log, and feeds the follow zone that predicts where a player can be now.

**Printed icons:** the icons of the physical game (the three Dangerous Sector cards and the six items, traced from the original artwork in `gicons.js`, plus Silent Sector and Alien attack drawn in the same style) are on the card buttons, the item hand and its sheet, announcements, the table log and the map. On the map every step carries the icons of what that player declared on that turn (an attack, an item, Silence or Silent Sector, Noise; a bluffed noise shows Noise in any sector), and a Spotlight marks the sector it named.

**Map markers:** every player is a rounded hexagon in their own colour; routes are drawn as arrows showing the direction of each move; an attack shows a starburst on the sector with a claw badge (Alien) or the Attack icon (Human with an Attack card);  the border shows the faction you suspect (black = you, yellow = undecided, blue = Human, red = Alien). Your bluffs (noise announced away from where you really are) appear as semi-transparent markers in your colour with the turn number. Tap a player on the map strip to see only their timeline.

**Notes:** tap 📝 on the map, pick a sector, choose a sticker and write an optional note. Tap the sector later to read, edit or delete it. Notes are private.

**Bots** (pass and play, and online tables) track every other player from the public announcements only: where they can be, how likely they are to be an Alien, how well their announcements fit a Human heading for a hatch. Easy plays soundly but reads little into movement, Normal reads movement and plans routes, Hard adds item play, bluffing, and Aliens that camp the hatch approaches.

Offline or without Firebase, *Play without a table* works on a single device.

Tests: serve the folder on port 8123 and run `node tests/lobby.test.js`, `tests/turns.test.js`, `tests/online.test.js`, `tests/online2.test.js`, `tests/hot.test.js`, `tests/markers.test.js`, `tests/overlap.test.js`, `tests/undo.test.js` and `tests/close.test.js` (uses an in-memory Firebase stand-in, `tests/fake-firebase.js`).

## Deploy: GitHub Pages + Firebase

**GitHub Pages**: *Settings → Pages → Source: GitHub Actions*. `.github/workflows/pages.yml` publishes on every push.

**Firebase** (Realtime Database): enable *Authentication → Anonymous*, create the database, put the web config in `firebase-config.js`, publish `database.rules.json` (Realtime Database → Rules), and add `<user>.github.io` under *Authentication → Settings → Authorized domains*. The rules must be re-published whenever `database.rules.json` changes.
