'use strict';
/* The agreed table suite and map split for bot evaluation. */
const TRAIN = ['socrates', 'galvani', 'morgenland', 'volta', 'levimontalcini', 'engarde', 'sinistra', 'dilemma', 'cavour', 'balena', 'ascesa', 'garibaldi'];
const HOLDOUT = ['galilei', 'marconi', 'fermi', 'frenzy', 'machiavelli', 'soundofsilence'];

/* pair: [strong, weak] for mixed tables, used for the ladder gap */
const TABLES = {
  hard3: { players: 3, levels: 'hard' },
  hard6: { players: 6, levels: 'hard' },
  hard8: { players: 8, levels: 'hard' },
  easy6: { players: 6, levels: 'easy' },
  normal6: { players: 6, levels: 'normal' },
  h1n5: { mix: 'hard:1,normal:5', pair: ['hard', 'normal'] },
  n1h5: { mix: 'normal:1,hard:5', pair: ['hard', 'normal'] },
  n1e5: { mix: 'normal:1,easy:5', pair: ['normal', 'easy'] },
  e1n5: { mix: 'easy:1,normal:5', pair: ['normal', 'easy'] },
  h1n2: { mix: 'hard:1,normal:2', pair: ['hard', 'normal'] },
  n1e2: { mix: 'normal:1,easy:2', pair: ['normal', 'easy'] },
  marconi8: { players: 8, levels: 'hard', maps: ['marconi'] }
};

module.exports = { TRAIN, HOLDOUT, TABLES };
