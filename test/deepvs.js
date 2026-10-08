'use strict';
// node test/deepvs.js [对手 hard|normal|master] [局数]
const { db, Game } = require('../server/engine');
const { randomDeck } = require('../server/engine/decks');
const { AI } = require('../server/ai');
const { MasterAI } = require('../server/ai_master');
const { DeepAI } = require('../server/ai_deep');
const opp = process.argv[2] || 'hard', n = +process.argv[3] || 10;
let w = [0, 0, 0], t0 = Date.now(), maxD = 0, dec = 0, dt = 0;
for (let i = 0; i < n; i++) {
  const g = new Game({ db, decks: [randomDeck(Math.random, null, true), randomDeck(Math.random, null, true)], names: ['deep', opp], seed: i * 31 + 5 });
  const sw = i % 2;
  const mk = k => k === 'deep' ? new DeepAI(i * 7 + 1) : opp === 'master' ? new MasterAI('master', i) : new AI(opp, i + 99);
  const ais = sw ? [mk('o'), mk('deep')] : [mk('deep'), mk('o')];
  let k = 0;
  while (g.pending && k++ < 4000) {
    const pi = g.pending.player, t = Date.now();
    const a = ais[pi].decide(g, pi);
    const d = Date.now() - t; if (ais[pi] instanceof DeepAI) { maxD = Math.max(maxD, d); dec++; dt += d; }
    g.answer(pi, a);
  }
  if (g.over) w[g.over.winner === -1 ? 2 : (g.over.winner ^ sw)]++;
  console.log(i, 'deep/opp/draw', w.join('/'), 'turns', g.turnNo);
}
console.log(`deep vs ${opp}:`, w, 'avg decide', (dt / dec | 0), 'ms, max', maxD, 'ms, total', (Date.now() - t0) / 1000 | 0, 's');
