'use strict';
const { db, Game } = require('../server/engine');
const { randomDeck } = require('../server/engine/decks');
const { AI } = require('../server/ai');
const { MasterAI } = require('../server/ai_master');
const mk = (l, s) => l === 'master' ? new MasterAI('master', s) : new AI(l, s);
const [a, b, n] = [process.argv[2] || 'easy', process.argv[3] || 'normal', +process.argv[4] || 20];
let w = [0, 0, 0], t0 = Date.now(), maxDecide = 0;
for (let i = 0; i < n; i++) {
  const g = new Game({ db, decks: [randomDeck(), randomDeck()], names: [a, b], seed: i * 77 + 1 });
  const sw = i % 2; const ais = sw ? [mk(b, i + 99), mk(a, i)] : [mk(a, i), mk(b, i + 99)];
  let k = 0;
  while (g.pending && k++ < 3000) {
    const pi = g.pending.player; const t = Date.now();
    const ans = ais[pi].decide(g, pi);
    maxDecide = Math.max(maxDecide, Date.now() - t);
    try { g.answer(pi, ans); } catch (e) { console.log('ERR', e.message, JSON.stringify(g.pending).slice(0, 400), ans); process.exit(1); }
  }
  if (!g.over) console.log('unfinished', k, g.turnNo);
  else w[g.over.winner === -1 ? 2 : (g.over.winner ^ sw)]++;
  if (process.env.V) console.log(i, w.join(','), g.turnNo);
}
console.log(`${a} vs ${b}:`, w, 'time', (Date.now() - t0) / n | 0, 'ms/game, max decide', maxDecide, 'ms');
