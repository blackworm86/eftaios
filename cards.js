'use strict';
/* Card definitions for the digital (full online) game. Quantities follow the printed game. */
const ITEMS = {
  attack: ['Attack', 'Attack as an Alien would'],
  teleport: ['Teleport', 'Jump to the Human sector, plus your normal move'],
  adrenaline: ['Adrenaline', 'Move 2 sectors this turn'],
  sedatives: ['Sedatives', 'No Dangerous Sector card this turn'],
  spotlight: ['Spotlight', 'Name a sector: it and its 6 neighbours must reveal'],
  defense: ['Defense', 'Survive an attack (played automatically)']
};
const rep_ = (n, v) => Array(n).fill(v);
const ITEM_DECK = [...rep_(2, 'attack'), ...rep_(2, 'teleport'), ...rep_(2, 'adrenaline'), ...rep_(3, 'sedatives'), ...rep_(2, 'spotlight'), 'defense']; // 12
const SECTOR_DECK = [...rep_(6, 'noise-self'), ...rep_(4, 'noise-self-item'), ...rep_(6, 'noise-any'), ...rep_(4, 'noise-any-item'), ...rep_(5, 'silence')]; // 25
const HATCH_DECK = [...rep_(3, 'green'), ...rep_(3, 'red')]; // 6
const CHARS = {
  human: ['Captain Ennio Maria Dominoni', 'Pilot Julia Niguloti', 'Psychologist Silvano Porpora', 'Soldier Tuccio Brendon'],
  alien: ['First Alien Piero Ceccarella', 'Second Alien Vittorio Martana', 'Third Alien Maria Galbani', 'Fourth Alien Paolo Landon']
};

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
const RESHUFFLED = { sector: 'Sector deck reshuffled', item: 'Item deck reshuffled', hatch: 'Escape Hatch deck reshuffled' };
