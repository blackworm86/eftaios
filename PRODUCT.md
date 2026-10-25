# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Plain static HTML, CSS and vanilla JavaScript (classic scripts, no build step), hosted on GitHub Pages. Firebase Realtime Database with anonymous auth for shared tables. Installable PWA with a network-first service worker (`sw.js`).

## Users
Groups of friends playing *Escape from the Aliens in Outer Space*: two to eight players, each on their own phone, tablet or laptop, in the same room or remotely. One of them hosts the table. The same person also uses it alone (map only) or passes one device around.

Anyone can play online as a guest with just a table code. A registered account keeps the player's games, maps and statistics, and is required to create a table. Registration offers Google, an emailed sign-in link, or email and password.

Current use: mostly the owner testing bots and maps, with occasional real games among close friends. There is no public launch and no audience beyond that group.

## Product Purpose
A full online port of the game that also works as the paper companion: it tracks a player's secret route, the turn order, the public announcements and the suspected factions of other players, and can deal roles and cards and resolve items, attacks and Spotlight so a group can play with no physical pieces. Success means a turn takes seconds, nobody argues about what was announced, and secret information never leaks. The bot difficulty ladder is a product promise, not a tuning detail: Easy must stay beatable by a newcomer, Normal sits between, and Hard should be very hard to beat.

## Positioning
A private navigation computer per player, not a shared screen: faction, position and route are readable only by their owner, and only public announcements travel through the table. Maps are drawn like the printed sheets (a Classic style) next to the dark app style. Accounts exist so a table can be left and resumed, not to centralise play: bots keep running on a player's device, and the table only pauses when nobody hosts it.

## Operating Context
Played in the evening around a table with the physical box. Phones are held in one hand; a tablet or laptop may sit on the table. Other players can glance at the screen, so a "hide screen" cover exists. Turns are strictly one player at a time, ordered by the host. A game lasts at most 39 rounds.

## Capabilities and Constraints
- Lobby: the host creates a table with options (rules: Basic or Ultimate, idle-player timeout), shares a code, QR or link, the host starts and roles and cards are dealt digitally. Maximum 8 players. Registered players keep a list of their last 20 tables, in progress or finished.
- Accounts: a guest is an anonymous session; signing in upgrades it in place, so rooms and maps are kept. Each account reserves a unique handle and keeps running totals (games, wins, escapes, kills, win streak) plus the last 50 finished games. Guest games are not recorded.
- Hosting: the host device runs the bots. A lease records which device is doing it; any player may take over when the host is away, and the host can hand the role to another player. After a reload the runner re-arms itself instead of dying with the tab. Bots pause when nobody holds the lease.
- Admin: one account carries the admin claim and reaches a panel for players (ban, unban, delete data, send a reset), rooms (force close), maps (hide, delete) and reports. The admin sees metadata, logs and finished games, never a live game's roles or positions. Every admin action is appended to an audit log.
- Idle players: the lobby sets a timeout; past it the table may remove an idle player's seat.
- Modes: online table and pass and play (both fully digital: roles and cards are dealt by the app), and Companion (no table: the player uses the real cards and the app as the paper sheet, recording their own route and what the other players declare).
- Bots (pass and play): any seat can be a bot at Easy, Normal or Hard. Bots see only the public view of the table (seat list, announcements, turn, rules) plus their own seat; they estimate each player's faction and position from announcements, bluff with "noise in any sector", attack and use items by the same rules. With one person at the device the hand-over screen is skipped and a summary of the announcements since the last turn is shown. At online tables the host adds bots in the lobby (+ Add bot, level per bot); the host's device plays their turns and answers attacks and Spotlights for them, and their private state lives in the host-only hostdata node. Bots need digital cards. The Firebase rules let the host write for players whose id starts with bot_. Intended ladder: Easy beatable by a newcomer, Normal in between, Hard very hard to beat.
- Digital play: the host device deals roles and decks; attacks and Spotlight are broadcast and every device answers for itself. A player's position, route and items are checkpointed to a node only that account can read, so a closed tab or a new device can rebuild the seat; other players, the host and the admin never see them. Decks reshuffle from discards when empty.
- Moves can be undone until something public or random has happened.
- Marker model: one colour per player; the circle border carries the faction guess (black = me, yellow = undecided, blue = suspected Human, red = suspected Alien). Markers never overlap. Bluffs are kept as semi-transparent markers of the player's own colour.
- Maps: 18 official maps in two groups (Ultimate Edition: Galilei, Marconi, Fermi, Galvani, Socrates, Morgenland, Volta, Levi-Montalcini; Expansion Maps: the rest), plus custom maps from the editor. A registered player keeps maps on the device and in a private vault; any map can be published to a public catalogue, copied into a vault, and reported. A room snapshots its map when the game starts. Some maps have fewer than four escape hatches.
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
