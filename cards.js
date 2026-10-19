'use strict';
/* Card definitions for the digital (full online) game. Quantities follow the printed game. */
const ITEMS = {
  attack: ['Attack', 'Attack as an Alien would, after moving'],
  teleport: ['Teleport', 'Jump to the Human sector, plus your normal move'],
  adrenaline: ['Adrenaline', 'Move 1 extra sector this turn'],
  sedatives: ['Sedatives', 'No Dangerous Sector card this turn'],
  spotlight: ['Spotlight', 'Name a sector: it and its 6 neighbours must reveal'],
  defense: ['Defense', 'Survive an attack (played automatically)'],
  clone: ['Clone', 'Survive an attack and restart from the Human sector (played automatically)'],
  sensor: ['Sensor', 'Another player must announce their exact position'],
  mutation: ['Mutation', 'Turn into an Alien, right where you stand'],
  cat: ['Cat', 'Announce noise in two sectors instead of one']
};
const rep_ = (n, v) => Array(n).fill(v);
/* the 77 Dangerous Sector cards of the Ultimate Edition: 17 of them are Item cards */
const ITEM_COUNTS = { adrenaline: 3, sedatives: 3, attack: 2, cat: 2, spotlight: 2, teleport: 1, defense: 1, clone: 1, sensor: 1, mutation: 1 };
const SECTOR_DECK = [...rep_(27, 'noise-self'), ...rep_(27, 'noise-any'), ...rep_(6, 'silence'), ...Object.entries(ITEM_COUNTS).flatMap(([k, n]) => rep_(n, 'item:' + k))];   // 77
const HATCH_DECK = [...rep_(4, 'green'), 'red'];   // the 5 Escape Pod cards
/* the 16 Characters: their abilities (used only in the Ultimate rules) */
const CHARS = {
  human: ['Captain', 'Pilot', 'Psychologist', 'Soldier', 'Executive Officer', 'Co-pilot', 'Engineer', 'Medic'],
  alien: ['Blink Alien', 'Silent Alien', 'Surge Alien', 'Brute Alien', 'Invisible Alien', 'Lurking Alien', 'Fast Alien', 'Psychic Alien']
};
const ABILITIES = {
  'Captain': 'Does not draw a Dangerous Sector card the first time he enters a Dangerous Sector.',
  'Pilot': 'Once: announce two noises when drawing a Dangerous Sector card, as with a Cat card.',
  'Psychologist': 'Begins the game in the Alien Sector.',
  'Soldier': 'Once: Attack, as with an Attack card.',
  'Executive Officer': 'Once: stay still instead of moving.',
  'Co-pilot': 'Once: Teleport to the Human sector. Reveals your identity.',
  'Engineer': 'Draws two Escape Pod cards and picks one. The other goes back into the pile.',
  'Medic': 'Once: force another player to reveal their identity. Reveals yours.',
  'Blink Alien': 'Can use Teleport cards without revealing the identity.',
  'Silent Alien': 'Can use Sedatives cards without revealing the identity.',
  'Surge Alien': 'Can use Adrenaline cards without revealing the identity.',
  'Brute Alien': 'Immune to all attacks. Reveals the identity when attacked.',
  'Invisible Alien': 'Immune to Sensor and Spotlight. Reveals the identity when targeted.',
  'Lurking Alien': 'Can attack in its own sector instead of moving.',
  'Fast Alien': 'Can move up to three sectors on the first move of the game.',
  'Psychic Alien': 'Draws a Silence card as if it were a Noise in Any Sector.'
};
/* the ability a player has right now: none in the Basic game, none for a Human reborn as an Alien */
const abilOf = (st, mode) => (mode === 'basic' || !st || st.reborn) ? '' : (st.char || '');
const UNIQUE_ABIL = ['Pilot', 'Soldier', 'Executive Officer', 'Co-pilot', 'Medic'];   // once per game
const abUsed = (st, k) => !!(st.ab && st.ab[k]);
const abUse = (st, k) => { st.ab = Object.assign({}, st.ab, { [k]: 1 }); };
/* an Alien may use these Item cards because of its Character */
const ALIEN_ITEM = { 'Blink Alien': 'teleport', 'Silent Alien': 'sedatives', 'Surge Alien': 'adrenaline' };
/* what one attack does to a player standing in the sector. Mutates the player's state `st`.
   Returns { immune } (not hit), { def } / { clone } (survived), { reveal } (Brute: survives but is revealed), or { killed, conv } */
function resolveHit(st, mode, turn) {
  const map = T.map;
  if ('1234'.includes(at(map, st.pos))) return { immune: 1 };   // a damaged Escape Pod: nobody can attack there
  const ab = abilOf(st, mode);
  if (st.role === 'alien' && ab === 'Brute Alien') return { reveal: 1, role: st.role, char: st.char };
  const info = { role: st.role, char: st.char || '' };
  if (st.role === 'human') {
    const has = k => (st.items || []).includes(k);
    if (has('defense')) { st.items.splice(st.items.indexOf('defense'), 1); return Object.assign({ def: 1 }, info); }
    if (has('clone')) {
      st.items = []; st.pos = find(map, 'H'); st.path = (st.path || []).concat([{ turn, pos: st.pos, note: 'clone' }]);
      return Object.assign({ clone: 1 }, info);
    }
    st.role = 'alien'; st.fed = false; st.reborn = true; st.items = []; st.char = ''; st.pos = find(map, 'A'); st.path = (st.path || []).concat([{ turn, pos: st.pos, note: 'reborn' }]);
    return Object.assign({ killed: 1, conv: 1 }, info);
  }
  st.over = 'dead';
  return Object.assign({ killed: 1 }, info);
}

/* deck helpers shared by the online dealer and pass-and-play */
const deckRnd = () => (window.__rng ? window.__rng() : Math.random());
const deckShuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(deckRnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const deckNew = cards => ({ draw: deckShuffle(cards), disc: [] });
/* draw the top card; if the pile is empty, shuffle the discards into a new pile first */
function deckDraw(d) { let reshuffled = false; if (!d.draw.length && d.disc.length) { d.draw = deckShuffle(d.disc); d.disc = []; reshuffled = true; } return { card: d.draw.length ? d.draw.pop() : null, reshuffled }; }
/* half the players are Aliens, half Humans; with an odd number there is one extra Alien */
function dealRoles(n) {
  const humans = Math.floor(n / 2), roles = deckShuffle([...rep_(humans, 'human'), ...rep_(n - humans, 'alien')]);
  const hc = deckShuffle(CHARS.human), ac = deckShuffle(CHARS.alien);
  return roles.map(role => ({ role, char: role === 'human' ? hc.pop() : ac.pop() }));
}
const RESHUFFLED = { sector: 'Sector deck reshuffled', hatch: 'Escape Pod deck reshuffled' };
/* only noise cards go to the discard pile and are reshuffled; Silence and Item cards stay with the player */
const discardable = c => !!c && c.startsWith('noise');

/* the sector where a player starts: Humans on the Human sector (the Psychologist on the Alien one), Aliens on the Alien sector */
const startSector = (map, role, char, mode) => find(map, role === 'human' && !(abilOf({ char }, mode) === 'Psychologist') ? 'H' : 'A');
/* draw an Escape Pod card; the Engineer draws two, keeps the better one and shuffles the other back */
function drawPod(d, two) {
  const a = deckDraw(d).card; if (!two || !a) return { card: a || '' };
  const b = deckDraw(d).card; if (!b) return { card: a };
  const [keep, back] = b === 'green' && a !== 'green' ? [b, a] : [a, b];
  d.draw = deckShuffle(d.draw.concat([back]));
  return { card: keep, two: [a, b] };
}
