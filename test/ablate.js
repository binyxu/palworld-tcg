'use strict';
// 消融实验：hard vs normal，分别关闭不同特性
const { db, Game } = require('../server/engine');
const { randomDeck } = require('../server/engine/decks');
const { AI } = require('../server/ai');
const N = +process.argv[2] || 100;
function match(patch) {
  let w = 0;
  for (let i = 0; i < N; i++) {
    let s = (i >> 1) * 7919 + 13; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const decks = [randomDeck(rnd), randomDeck(rnd)];
    const g = new Game({ db, decks, names: ['h', 'n'], seed: (i >> 1) * 31 + 7 });
    const h = new AI('hard', i); patch(h);
    const ais = i % 2 ? [h, new AI('normal', i + 5)] : [new AI('normal', i + 5), h];
    const hi = i % 2 ? 0 : 1;
    let k = 0;
    while (g.pending && k++ < 3000) { const pi = g.pending.player; g.answer(pi, ais[pi].decide(g, pi)); }
    if (g.over && g.over.winner === hi) w++;
  }
  return w / N;
}
const P = AI.prototype;
const variants = {
  full: () => {},
  aggroFace: h => { const o = P.targetScore; h.targetScore = function (g, pi, a, t) { return t === 'player' ? 50 + g.strike(a) : o.call(this, g, pi, a, t); }; },
  noBlock: h => { h.blockHook = (g, pi, q) => { const B = g.battle; return B && B.target === 'player' && g.strike(B.att) >= g.p[pi].life ? q.cands.slice(0, 1) : []; }; },
  soulDraw: h => { const o = P.heur; h.heur = function (g, pi, a, acts) { return a.t === 'soulDraw' ? 3 : o.call(this, g, pi, a, acts); }; },
  noPalAttack: h => { const o = P.targetScore; h.targetScore = function (g, pi, a, t) { return t !== 'player' && t.def.kind === 'pal' ? -1 : o.call(this, g, pi, a, t); }; },
};
for (const [k, f] of Object.entries(variants)) console.log(k, match(f));
