---
name: EFTAIOS Companion
description: A private navigation computer for Escape from the Aliens in Outer Space, drawn like the printed map.
colors:
  night-bg: "#070b14"
  night-surface: "#0d1424"
  night-panel: "#101a2e"
  night-panel-raised: "#16233c"
  night-line: "#26385a"
  night-void: "#0b1222"
  ink: "#e8ecf5"
  ink-dim: "#8c9bb8"
  amber: "#ffb41f"
  alien-red: "#ff4a2b"
  human-blue: "#38a3ff"
  hatch-green: "#3ecf7a"
  sector-dangerous: "#59627a"
  sector-secure: "#ece6d3"
  paper: "#f4f2ec"
  paper-dangerous: "#c9c9c9"
  paper-secure: "#ffffff"
  paper-line: "#555555"
  paper-start: "#151515"
  paper-hatching: "#9a9a9a"
  border-me: "#000000"
  border-undecided: "#ffd23f"
  border-human: "#2f7dff"
  border-alien: "#ff3b30"
  player-teal: "#2ec4b6"
  player-violet: "#9b5de5"
  player-lime: "#a3e048"
  player-pink: "#ff6fb5"
  player-brown: "#8d6e63"
  player-white: "#f4f4f4"
  player-slate: "#7d8a96"
  player-green: "#1f7a4d"
typography:
  display:
    fontFamily: "Arial Narrow, Roboto Condensed, Helvetica Neue, Impact, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.04em"
  headline:
    fontFamily: "Arial Narrow, Roboto Condensed, Helvetica Neue, Impact, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.06em"
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.06em"
  data:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "22px"
    fontWeight: 700
rounded:
  sm: "10px"
  md: "12px"
  lg: "14px"
  card: "20px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
  tap: "48px"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "#1a1200"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "10px 16px"
  button-default:
    backgroundColor: "{colors.night-panel-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.night-panel-raised}"
    textColor: "#ff9d8a"
    rounded: "{rounded.md}"
  segmented-selected:
    backgroundColor: "#ffb41f1f"
    textColor: "{colors.amber}"
    rounded: "{rounded.sm}"
  list-row:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "44px"
  announcement:
    backgroundColor: "#ffb41f14"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
---

# Design System: EFTAIOS Companion

## Overview

**Creative North Star: "The Paper Map"**

The printed board is the reference and the screen is its working copy. The Classic map style (white paper, diagonal hatching for empty space, grey Dangerous sectors, white Secure sectors, black start sectors and hatches) is the source of truth for how the board looks. The dark style is the same board seen at night: the same sector vocabulary on a deep navy ground, so the table can play in a dim room without a glaring screen.

The interface around the map is a quiet instrument panel. It is a tool used mid-conversation with one hand, so it is familiar, dense where needed and never decorative. One amber accent marks the one action that matters now. Faction colours (human blue, alien red) appear only where they carry meaning. Nothing glows, nothing is ornamental.

**Key Characteristics:**
- The map takes the largest area on every screen size; the panel sits beneath it on phones and beside it on wide screens.
- One primary action per moment; long content opens in a full-screen sheet instead of scrolling the panel.
- Solid grounded surfaces, thin borders, tint for state. No glows, gradients, thick side stripes or hard shadows.
- One drawn icon family; no emoji or Unicode glyphs as icons.

## Colors

A restrained navy neutral set with a single amber accent, plus fixed faction and player vocabularies.

### Primary
- **Signal Amber** (#ffb41f): the primary action, the current selection, the player's own position glow and reachable sectors. Used on a small share of any screen.

### Secondary
- **Alien Red** (#ff4a2b) and **Human Blue** (#38a3ff): role identity, and alert announcements for red. Never decoration.
- **Hatch Green** (#3ecf7a): escape hatches and success states (ready, escaped).

### Neutral
- **Night Bg / Surface / Panel / Raised** (#070b14, #0d1424, #101a2e, #16233c): the ground, inset rows, panels, raised buttons. Each layer is a small step cooler or lighter than the one below.
- **Night Line** (#26385a): all borders and dividers.
- **Ink / Ink Dim** (#e8ecf5, #8c9bb8): text and secondary text, both above 4.5:1 on the panels.
- **Paper set** (#f4f2ec ground, #c9c9c9 Dangerous, #ffffff Secure, #555555 lines, #151515 start sectors and hatches, #9a9a9a hatching): the Classic map style.

### Player markers
Eight player colours chosen to stay distinct from each other and from the four border colours: teal, violet, lime, pink, brown, white, slate, green. The circle border carries the faction guess: **black** me, **yellow** undecided, **blue** suspected Human, **red** suspected Alien. Every marker also has a thin outline (white around mine, dark around others) so it reads on both map styles.

### Named Rules
**The One Amber Rule.** Amber marks the single thing to do next, or where you are. If two things on a screen are amber, one is wrong.
**The Border Means Faction Rule.** A marker's fill is the player; its border is the guess about their faction. Never swap the two.

## Typography

**Display Font:** Arial Narrow stack (condensed), for headings and the big "say aloud" announcement.
**Body Font:** system sans, for every control, label and sentence.
**Data Font:** system monospace, for numbers only (turn counter, table code, marker turn numbers).

**Character:** a condensed, uppercase headline voice over a neutral system sans. Controls and labels stay in the sans so they read as tools, not as decoration.

### Hierarchy
- **Display** (700, 28px, 1.1): the announcement the player must read aloud.
- **Headline** (700, 24px on desktop, scaling down to 18px on phones, 1.1): panel titles such as the sector name.
- **Body** (400, 16px, 1.45): sentences, hints; keep prose to 65–75ch.
- **Label** (700, 12px, +0.06em, uppercase): field labels, table headers, tab names.
- **Data** (700, 18–22px mono): turn, table code, counts.

### Named Rules
**The Sans Labels Rule.** Monospace and the condensed face are never used for buttons or form labels.

## Layout

Phones: a top bar with turn, role, sector and a hide-screen button; the map; then a panel with its content above a three-tab bar (Play, Table, More). The panel's content never scrolls on the main play flow at 360×640. Wide screens (≥900px) and short landscape screens put the panel at 400px beside the map with the tabs above it and the content using the full height.

Spacing runs on a small scale (6, 10, 14, 20px) with generous separation between groups and tighter spacing inside them. Touch targets are at least 44px; the player strip is the one place buttons drop to 36px.

The Table tab uses sub-tabs on phones (Announcements, Players, Hatches) and shows all three together on wide screens. Long reference content (rules, map list, map gallery) opens as a full-screen sheet.

## Elevation & Depth

Flat by default. Depth comes from tonal layering (ground, panel, raised) and 1px borders. The only shadow is the standard elevation under dialogs and toasts (offset, soft blur, black). Map glow is reserved for the player's own position ring, which is an SVG state indicator, not decoration.

### Named Rules
**The No Halo Rule.** No coloured glow shadows, radial-gradient washes or hard offset shadows anywhere.

## Shapes

Rounded rectangles, radius 10–14px for controls and rows, 20px for the setup card, full pills for chips. Markers are circles. Hexagons (flat-top, odd columns lower) are the only other recurring form and belong to the map. Rows and cards use a full 1px border; state is shown by border colour and a light tint, never a thick side stripe.

## Components

### Buttons
- **Shape:** 12px radius, 48px minimum height (60px for primary "big" actions).
- **Primary:** amber fill with dark text, one per screen.
- **Default:** raised panel fill with a 1.5px line border. **Danger:** same, with red-tinted text and border.
- **Link:** no fill, dim text, for low-priority actions such as Undo.

### Segmented control
Equal-width options in a framed track; the selected option gets an amber tint and a 2px amber inset ring. Used for options with two or three values (rules, cards, tracking, map style, language). An ⓘ button next to the label opens a short explanation popup.

### Rows and lists
Players, announcements and turn order are 1px-bordered rows on the surface colour. The current turn gets an amber border and tint; a ready player gets a green border and tint.

### Announcement ("Say aloud")
A bordered callout with a small label and a large condensed headline. Amber for normal noises, red for attacks, neutral grey for silence.

### Map controls and player strip
Icon buttons (fit, centre on me, add note, plus zoom with a mouse) stacked at the map's right edge; a vertical strip of players on the left that focuses one player's timeline and sets the faction guess. Strip and controls turn white on the Classic map style.

### Sheets and dialogs
Short confirmations use the native dialog. Long content (rules, maps, gallery) uses a full-screen sheet with a close button. Toasts appear at the top of the map, never over the action buttons.

### Icons
One family drawn on a 24px grid with 2.2px round strokes: close, check, up, down, next, undo, pencil, turn marker, and six note stickers (alert, question, alien, crew, skull, star).

## Do's and Don'ts

### Do
- Keep the map the largest element and the next action the most prominent button.
- Name controls by their action ("Confirm move", "End turn") and use the rulebook's terms in both languages.
- Check every change at 360×640, 390×844, a tablet and a desktop width, on both map styles.
- Show state with tint and border; show meaning with shape or text as well as colour.

### Don't
- Don't add a second amber element to a screen or use amber for decoration.
- Don't use emoji or Unicode symbols as icons, glow or gradient backgrounds, thick coloured side borders, or hard offset shadows.
- Don't scroll the main play panel; move content into a sub-tab, sheet or popup.
- Don't send anything about a player's faction, position or route to the shared table.
- Don't put an eyebrow or kicker label above headings, or nest cards inside cards.
