// 自对弈数据生成：node gen.js <out前缀> <局数> <种子偏移> [policy]
// 每个位置记录双方视角的特征 + 最终胜负；同时记录卡组是否含紫色（用于新卡泛化测试）
const V = __dirname + '/../..'; 
const fs = require('fs');
const { Game, db } = require(V + '/server/engine');
const { AI } = require(V + '/server/ai');
const { DeepAI } = require(V + '/server/ai_deep');
const { randomDeck } = require(V + '/server/engine/decks');
const { PRESETS } = require(V + '/server/engine/presets');
const { encode, DIM } = require(V + '/server/ai_feat');
const { evalM } = require(V + '/server/ai_master');
const [, , out, N, off, pol = 'heur'] = process.argv;
let s0 = +off >>> 0; const rng = () => { s0 = (s0 * 1664525 + 1013904223) >>> 0; return s0 / 4294967296; };
const X = [], Y = [], META = [];
const t0 = Date.now();
for (let gi = 0; gi < +N; gi++) {
  const deck = () => rng() < 0.4 ? PRESETS[Math.floor(rng() * PRESETS.length)].cards : randomDeck(rng, null, rng() < 0.6);
  const decks = [deck(), deck()];
  const purple = decks.some(d => d.some(id => db[id] && db[id].color === 'purple')) ? 1 : 0;
  const g = new Game({ db, decks, names: ['a', 'b'], seed: Math.floor(rng() * 1e9) });
  const mk = sd => { if (pol === 'deep') return new DeepAI(sd, { budgetMs: 120, maxNodes: 120, reply: false }); const a = new AI('hard', sd); a.noSim = true; return a; };
  const ais = [mk(gi * 2 + +off), mk(gi * 2 + 1 + +off)];
  const eps = 0.08 + rng() * 0.12;   // 少量随机行动增加局面多样性
  const pos = [];
  let n = 0, lastTurn = -1;
  try {
    while (!g.over && n++ < 3000) {
      const q = g.pending;
      if (q.kind === 'main' && !q.quick && g.turnNo !== lastTurn) { lastTurn = g.turnNo; }
      if (q.kind === 'main' && !q.quick && rng() < 0.35) pos.push([encode(g, 0), encode(g, 1), g.turnNo, evalM(g, 0)]);
      let ans = ais[q.player].decide(g, q.player);
      if (q.kind === 'main' && rng() < eps) ans = Math.floor(rng() * q.actions.length);
      g.answer(q.player, ans);
    }
  } catch (e) { continue; }
  if (!g.over) continue;
  const w = g.over.winner; if (w !== 0 && w !== 1) continue;
  const T = g.turnNo;
  for (const [a, b, t, e] of pos) {
    X.push(a, b); Y.push(w === 0 ? 1 : -1, w === 1 ? 1 : -1);
    META.push(purple, T - t, e, purple, T - t, -e);
  }
}
const buf = new Float32Array(X.length * DIM); X.forEach((x, i) => buf.set(x, i * DIM));
fs.writeFileSync(out + '.x', Buffer.from(buf.buffer));
fs.writeFileSync(out + '.y', Buffer.from(new Float32Array(Y).buffer));
fs.writeFileSync(out + '.m', Buffer.from(new Float32Array(META).buffer));
console.log(out, 'positions', Y.length, 'dim', DIM, 'sec', ((Date.now() - t0) / 1000).toFixed(0));
