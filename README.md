# EFTAIOS Companion

Web companion for the physical board game *Escape from the Aliens in Outer Space* (Black Edition maps: Galilei, Fermi, Galvani). Cards are **not** included: you keep using the real deck. The app replaces the paper map and pencil:

- hex map with pan / pinch-zoom, reachable sectors highlighted (Human 1, Alien 2, fed Alien 3, Adrenaline 2)
- your private route with turn numbers, 39-turn counter
- exact wording to announce (noise, silence, attack, hatch), item and attack helpers
- shared-table notes: announcements heard, hatch status, Spotlight range warning
- Basic, Advanced and Infection rule sets; map editor / import / export; offline (PWA)

Run: `python3 -m http.server` in this folder and open http://localhost:8000.

Map format (`maps/maps.json`): `rows_data` is 14 strings of 23 characters (row 01..14, columns A..W): `.` dangerous, `s` secure, `x` empty space, `H` human, `A` alien, `1`-`4` hatches.
