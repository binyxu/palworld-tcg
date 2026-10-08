'use strict';
// 学习到的价值网络（与卡牌 ID 无关，见 ai_feat.js）。输出 pi 视角的胜率估计 [-1,1]。
const fs = require('fs'), path = require('path');
const { encode } = require('./ai_feat');
let M = null; const MS = new Map();
function load(file) {
  const f = file || process.env.AI_VALUE || path.join(__dirname, 'ai_value.json');
  try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); M = { ...j, W1: j.W1.map(r => Float32Array.from(r)), W2: j.W2.map(r => Float32Array.from(r)) }; } catch (e) { M = null; }
  return M;
}
function raw(g, pi, M) {
  const x = encode(g, pi), D = M.dim, H1 = M.b1.length, H2 = M.b2.length;
  const h1 = Float32Array.from(M.b1);
  for (let i = 0; i < D; i++) { const v = (x[i] - M.mu[i]) / M.sd[i]; if (v === 0) continue; const w = M.W1[i]; for (let j = 0; j < H1; j++) h1[j] += v * w[j]; }
  const h2 = Float32Array.from(M.b2);
  for (let i = 0; i < H1; i++) { const v = h1[i] > 0 ? h1[i] : 0; if (!v) continue; const w = M.W2[i]; for (let j = 0; j < H2; j++) h2[j] += v * w[j]; }
  let o = M.b3; for (let j = 0; j < H2; j++) if (h2[j] > 0) o += h2[j] * M.W3[j];
  return Math.tanh(o);
}
// 双视角对称化：v = (net(pi) - net(对手)) / 2，满足零和
function value(g, pi, file) {
  if (g.over) return g.over.winner === pi ? 1 : g.over.winner === -1 ? 0 : -1;
  let m;
  if (file) { if (!MS.has(file)) { const keep = M; MS.set(file, load(file)); M = keep; } m = MS.get(file); }
  else m = M || load();
  if (!m) return null;
  return (raw(g, pi, m) - raw(g, 1 - pi, m)) / 2;
}
module.exports = { value, load, ready: () => !!(M || load()) };
