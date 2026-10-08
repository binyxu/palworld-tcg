'use strict';
const { db, Game } = require('../server/engine');
const { randomDeck, validateDeck } = require('../server/engine/decks');
let seed = +process.argv[2] || 1;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const N = +process.argv[3] || 200;
let wins = [0, 0, 0], steps = 0;
for (let i = 0; i < N; i++) {
  const d = [randomDeck(rnd), randomDeck(rnd)];
  for (const x of d) { const e = validateDeck(x); if (e.length) throw new Error(e.join(';')); }
  const g = new Game({ db, decks: d, names: ['A', 'B'], seed: Math.floor(rnd()*1e9) });
  let k = 0;
  while (g.pending && k++ < 5000) {
    const q = g.pending;
    let ans;
    if (q.kind === 'main') { const ends = q.actions.findIndex(a => a.t === 'end'); ans = rnd() < 0.15 && ends >= 0 ? ends : Math.floor(rnd() * q.actions.length); }
    else if (q.kind === 'option') ans = Math.floor(rnd() * q.options.length);
    else { const n = q.min + Math.floor(rnd() * (q.max - q.min + 1)); ans = q.cands.slice().sort(() => rnd() - 0.5).slice(0, n); }
    try { g.answer(q.player, ans); } catch (e) { console.log('ERR', e.stack, JSON.stringify(q).slice(0, 300)); console.log(g.log.slice(-15).join('\n')); process.exit(1); }
  }
  steps += k;
  if (g.over) wins[g.over.winner === -1 ? 2 : g.over.winner]++;
  else { console.log('no finish', k, g.turnNo); }
}
console.log('done', wins, 'avg steps', steps / N);
