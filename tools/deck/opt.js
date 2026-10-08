// 卡组爬山优化：node tools/deck/opt.js <archetypeKey> [iters]
// 评估 = 对"门槛卡组集"（7 套名卡组 + 强力随机 + 随机）的胜率，共同随机种子降低噪声
const fs = require('fs'), path = require('path');
const { db, expand, play, randomDeck, validateDeck } = require('./lib');
const { META } = require('../../server/engine/meta_decks');
const { ARCH } = require('./archetypes');
const key = process.argv[2], ITERS = +process.argv[3] || 80, G = +process.env.G || 6;
const A = ARCH.find(a => a.key === key); if (!A) throw new Error('no arch ' + key);
function mul(s) { let x = s * 2654435761 >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
const GAUNT = [...META.map(m => expand(m.list)), s => randomDeck(mul(s), null, true), s => randomDeck(mul(s + 7))];
if (process.env.GAUNT_EXTRA) for (const f of process.env.GAUNT_EXTRA.split(',')) { try { const X = JSON.parse(fs.readFileSync(f)); GAUNT.push(expand(X.list)); } catch (e) { } }
let seedBase = 5000;
function evalDeck(list, seeds) {
  const d = expand(list); let w = 0, n = 0;
  for (let o = 0; o < GAUNT.length; o++) for (const s of seeds) { const r = play(d, GAUNT[o], s + o * 97); w += r === 0 ? 1 : r === -1 ? .5 : 0; n++; }
  return w / n;
}
let rs = (key.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 3) >>> 0) || 1;
const R = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
const pool = Object.values(db).filter(c => !c.color || A.colors.includes(c.color)).map(c => c.id).filter(id => !(A.ban || []).includes(id));
const total = l => Object.values(l).reduce((a, b) => a + b, 0);
const lucky = l => Object.entries(l).reduce((a, [k, n]) => a + (db[k].lucky ? n : 0), 0);
function fix(l) {
  for (const k of Object.keys(l)) if (l[k] <= 0) delete l[k];
  // 补足 / 削减到 50
  let guard = 0;
  while (total(l) > 50 && guard++ < 200) { const ks = Object.keys(l).filter(k => !(A.core || {})[k] || l[k] > A.core[k]); const k = ks[Math.floor(R() * ks.length)]; l[k]--; if (!l[k]) delete l[k]; }
  while (total(l) < 50 && guard++ < 400) { const k = pool[Math.floor(R() * pool.length)]; const max = db[k].anyNumber ? 30 : 4; if ((l[k] || 0) < max && !(db[k].lucky && lucky(l) >= 8)) l[k] = (l[k] || 0) + 1; }
  return l;
}
function mutate(p) {
  const l = { ...p }, n = 1 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const t = R(), ks = Object.keys(l);
    if (t < 0.55) { // 把 1~2 张 A 换成 B
      const a = ks[Math.floor(R() * ks.length)]; if ((A.core || {})[a] && l[a] <= A.core[a]) continue;
      const b = R() < 0.6 ? ks[Math.floor(R() * ks.length)] : pool[Math.floor(R() * pool.length)];
      const k = 1 + Math.floor(R() * 2); const max = db[b].anyNumber ? 30 : 4;
      for (let j = 0; j < k && l[a] > 0 && (l[b] || 0) < max; j++) { if (db[b].lucky && !db[a].lucky && lucky(l) >= 8) break; l[a]--; l[b] = (l[b] || 0) + 1; }
    } else if (t < 0.8) { // 删掉一张卡的所有副本，换新卡
      const a = ks[Math.floor(R() * ks.length)]; if ((A.core || {})[a]) continue; const n0 = l[a]; delete l[a];
      const b = pool[Math.floor(R() * pool.length)]; l[b] = Math.min(db[b].anyNumber ? 30 : 4, (l[b] || 0) + n0);
    } else { // 数量微调
      const a = ks[Math.floor(R() * ks.length)], b = ks[Math.floor(R() * ks.length)];
      if (a !== b && l[a] > 1 && l[b] < (db[b].anyNumber ? 30 : 4) && !((A.core || {})[a] && l[a] <= A.core[a]) && !(db[b].lucky && !db[a].lucky && lucky(l) >= 8)) { l[a]--; l[b]++; }
    }
  }
  return fix(l);
}
const outF = path.join(__dirname, 'out', key + '.json'); fs.mkdirSync(path.dirname(outF), { recursive: true });
let cur = fs.existsSync(outF) ? JSON.parse(fs.readFileSync(outF)).list : fix({ ...A.seed });
if (validateDeck(expand(cur)).length) throw new Error(key + ' 初始卡组不合法 ' + validateDeck(expand(cur)));
const seeds = k => Array.from({ length: G }, (_, i) => seedBase + k * 1000 + i);
let curV = evalDeck(cur, seeds(0)), t0 = Date.now();
console.log(key, 'start', curV.toFixed(3));
for (let it = 1; it <= ITERS; it++) {
  const cand = mutate(cur); if (validateDeck(expand(cand)).length) continue;
  const S = seeds(it % 5);
  const vC = evalDeck(cand, S), vP = evalDeck(cur, S);
  if (vC > vP + 0.02) {
    // 二次确认（新种子）
    const S2 = seeds(10 + it); const c2 = evalDeck(cand, S2), p2 = evalDeck(cur, S2);
    if (c2 + vC > p2 + vP + 0.03) { cur = cand; curV = (vC + c2) / 2; console.log(key, 'it', it, 'accept', vP.toFixed(3), '→', vC.toFixed(3), '/', p2.toFixed(3), '→', c2.toFixed(3)); fs.writeFileSync(outF, JSON.stringify({ key, list: cur, v: curV })); }
  }
}
const fin = evalDeck(cur, Array.from({ length: 12 }, (_, i) => 90000 + i));
fs.writeFileSync(outF, JSON.stringify({ key, list: cur, v: fin }));
console.log(key, 'final', fin.toFixed(3), ((Date.now() - t0) / 60000).toFixed(1) + 'min');
