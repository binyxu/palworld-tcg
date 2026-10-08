'use strict';
const { db, Game } = require('../../server/engine');
const { randomDeck, validateDeck } = require('../../server/engine/decks');
const { AI } = require('../../server/ai');
const { DeepAI } = require('../../server/ai_deep');
const expand = list => { const d = []; for (const [k, n] of Object.entries(list)) for (let i = 0; i < n; i++) d.push(k); return d; };
function mkAI(kind, seed) { return kind === 'deep' ? new DeepAI(seed, { budgetMs: +process.env.DMS || 400, maxNodes: +process.env.DN || 600 }) : new AI(kind, seed); }
// 返回 0/1 胜者（相对 decks 下标），-1 平局
function play(d0, d1, seed, ai = 'hard') {
  const sw = seed % 2;
  const decks = sw ? [d1, d0] : [d0, d1];
  const g = new Game({ db, decks: decks.map(d => typeof d === 'function' ? d(seed) : d), names: ['a', 'b'], seed });
  const ais = [mkAI(ai, seed * 3 + 1), mkAI(ai, seed * 3 + 2)];
  let k = 0;
  while (g.pending && k++ < 4000) { const pi = g.pending.player; g.answer(pi, ais[pi].decide(g, pi)); }
  if (!g.over || g.over.winner === -1) return -1;
  return g.over.winner ^ sw;
}
module.exports = { db, expand, play, randomDeck, validateDeck };
