# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Plain static HTML, CSS and vanilla JavaScript (classic scripts, no build step), hosted on GitHub Pages. Firebase Realtime Database with anonymous auth for shared tables. Installable PWA with a network-first service worker (`sw.js`).

## Users
Groups of friends playing *Escape from the Aliens in Outer Space*: two to eight players, each on their own phone, tablet or laptop, in the same room or remotely. One of them hosts the table. The same person also uses it alone (map only) or passes one device around.

Current use: mostly the owner testing bots and maps, with occasional real games among close friends. There is no public launch and no audience beyond that group.

## Product Purpose
A companion for the board game that replaces pencil, paper map and memory. It tracks a player's secret route, the turn order, the public announcements and the suspected factions of other players. An optional full digital mode deals roles and cards and resolves items, attacks and Spotlight, so a group can play with no physical pieces. Success means a turn takes seconds, nobody argues about what was announced, and secret information never leaks. The bot difficulty ladder is a product promise, not a tuning detail: Easy must stay beatable by a newcomer, Normal sits between, and Hard should be very hard to beat.

## Positioning
A private navigation computer per player, not a shared screen: faction, position and route stay on the player's own device, and only public announcements travel through the table. Maps are drawn like the printed sheets (a Classic style) next to the dark app style.

## Operating Context
Played in the evening around a table with the physical box. Phones are held in one hand; a tablet or laptop may sit on the table. Other players can glance at the screen, so a "hide screen" cover exists. Turns are strictly one player at a time, ordered by the host. A game lasts at most 39 rounds.

## Capabilities and Constraints
- Lobby: the host creates a table with options (rules: Basic or Ultimate), shares a code, QR or link, the host starts and roles and cards are dealt digitally. Maximum 8 players.
- Modes: online table and pass and play (both fully digital: roles and cards are dealt by the app), and Companion (no table: the player uses the real cards and the app as the paper sheet, recording their own route and what the other players declare).
- Bots (pass and play): any seat can be a bot at Easy, Normal or Hard. Bots see only the public view of the table (seat list, announcements, turn, rules) plus their own seat; they estimate each player's faction and position from announcements, bluff with "noise in any sector", attack and use items by the same rules. With one person at the device the hand-over screen is skipped and a summary of the announcements since the last turn is shown. At online tables the host adds bots in the lobby (+ Add bot, level per bot); the host's device plays their turns and answers attacks and Spotlights for them, and their private state lives in the host-only hostdata node. Bots need digital cards. The Firebase rules let the host write for players whose id starts with bot_. Intended ladder: Easy beatable by a newcomer, Normal in between, Hard very hard to beat.
- Digital play: the host device deals roles and decks; attacks and Spotlight are broadcast and every device answers for itself, so positions never leave a device. Decks reshuffle from discards when empty.
- Moves can be undone until something public or random has happened.
- Marker model: one colour per player; the circle border carries the faction guess (black = me, yellow = undecided, blue = suspected Human, red = suspected Alien). Markers never overlap. Bluffs are kept as semi-transparent markers of the player's own colour.
- Maps: 18 official maps in two groups (Ultimate Edition: Galilei, Marconi, Fermi, Galvani, Socrates, Morgenland, Volta, Levi-Montalcini; Expansion Maps: the rest), plus custom maps from the editor. Some maps have fewer than four escape hatches.
- Turns and follow view: the turns button cycles 1, 3, 5, 7 and all known steps; following a player centres each of their sectors and draws only their route; arrows are solid at game over.
- Cards in front of players: face-down Silence and Item cards are counted per marker and in the hand, from the public log; used items, kills and attacks carry the game's own icons.
- Notes and drawings: private stickers with optional text, plus pen, straight line, rectangle and ellipse outlines, a hand to move them, and an eraser.
- Save game log: at game over the app downloads a JSON with every player's real route, role, items, the full log, the map and the result, to study how the bots played.
- Mobile layout: tapping the open Play/Table/More tab hides the panel so the map fills the screen; the player strip can focus one or two players.
- Languages: English and Italian; Italian wording follows the Italian rulebook.
- The app is an unofficial fan companion. It includes no official art, logos or card text, and the physical game is required only in Companion mode.
- Firebase rules must be republished by the owner through `firebase-rules.html` when they change.
- Undecided: installing as an Android app is known to fail and is on hold.

## Brand Commitments
- Rules follow the official rulebook (for example, an attack happens in the sector the attacker moved into). The rulebook is authoritative; the in-app summary says so.
- The visual style keeps the look of the game: hex sectors, start sectors, numbered pods, announcements in the game's own words.

## Evidence on Hand
- Rulebooks (English and Italian) and map images were supplied by the owner. The app is live only for the owner and close friends, with no public launch; no testimonials, usage metrics or real-game screenshots exist yet — do not invent them.
- Automated tests in `tests/` (Playwright, run against a static server on port 8123) cover lobby, turns, online and digital modes, pass and play, layout, markers, bluffs, undo, close, gallery and map reachability.

## Product Principles
1. **The map is the hero.** Everything else is a small, quiet panel under or beside it; the player's eyes stay on the board.
2. **One action per moment.** The panel shows only the next thing to do; everything else is one tap away in a sheet or tab, never a scroll.
3. **Secrets stay put.** Nothing about a player's faction or position is shared unless the rules make it public.
4. **Say it the way the game says it.** Announcements, sector names and item names use the rulebook's words, in the player's language.
5. **Never trap the table.** Any player can leave, the host can close the game for everyone, and a mistaken move can be undone before it becomes public.

## Accessibility & Inclusion
Phones are the main device, so touch targets are at least 44px and the layout works one-handed. Marker meaning never relies on colour alone: the number inside gives the turn and the border is paired with a legend. Body text meets 4.5:1 contrast on both map styles. Reduced-motion preferences are honoured.
