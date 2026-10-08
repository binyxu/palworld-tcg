// 给残局添加干扰项：node tools/pz/distract.js [id...]   → 输出 tools/pz/distract_out.json
// 约束：①仍有必胜解 ②最短必胜步数不低于原题（不出现捷径）③求解节点数在上限内
// 目标：必胜着法占比越低、求解越难越好。
const fs = require('fs'), path = require('path');
const { db, Game } = require('../../server/engine');
const { Solver, moves, child, sig } = require('../../server/solver');
const { PUZZLES } = require('../../server/puzzles');
const { metric } = require('./metric');

function mk(sc) { return new Game({ db, decks: [[], []], names: ['你', '敌'], seed: 7, scenario: JSON.parse(JSON.stringify(sc)) }); }
// 最短必胜步数（我方"主要阶段行动"计数），迭代加深
function minDepth(sc, maxD, maxNodes) {
  const memo = new Map(); let nodes = 0;
  const win = (g, k) => {
    if (g.over) return g.over.winner === 0;
    if (!g.pending) return false;
    const q = g.pending, hero = q.player === 0;
    const cost = hero && q.kind === 'main' && q.actions.length && !q.quick ? 1 : 0;
    const key = sig(g) + '|' + k; if (memo.has(key)) return memo.get(key);
    if (++nodes > maxNodes) throw new Error('nodes');
    memo.set(key, false);
    let r;
    const ms = moves(g);
    if (hero) {
      r = false;
      for (const m of ms) {
        const isEnd = q.kind === 'main' && q.actions[m].t === 'end';
        const nk = k - (q.kind === 'main' && !isEnd && !q.quick ? 1 : 0);
        if (nk < 0) continue;
        if (win(child(g, m), nk)) { r = true; break; }
      }
    } else { r = true; for (const m of ms) if (!win(child(g, m), k)) { r = false; break; } }
    void cost; memo.set(key, r); return r;
  };
  for (let d = 1; d <= maxD; d++) { try { if (win(mk(sc), d)) return d; } catch (e) { return -1; } }
  return maxD + 1;
}
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const ALL = Object.values(db).filter(c => !c.lucky && c.id !== 'BP01-099' && c.cost <= 6);
const colorsOf = sc => { const s = new Set(); for (const b of sc.players[0].base) { const c = db[b.id || b]; if (c && c.color) s.add(c.color); } for (const h of sc.players[0].hand) { const c = db[h]; if (c && c.color) s.add(c.color); } return s; };
const LV = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4 };

function propose(p, r) {
  const sc = JSON.parse(JSON.stringify(p.sc)), n = LV[p.level] || 2, cols = colorsOf(sc);
  const souls = sc.players[0].souls || 0;
  const pool = ALL.filter(c => !c.color || cols.has(c.color));
  const pick = f => { const l = pool.filter(f); return l.length ? l[Math.floor(r() * l.length)] : null; };
  const added = [];
  for (let i = 0; i < n; i++) {
    const t = r();
    if (t < 0.5 && sc.players[0].hand.length < 6) {            // 手牌里的诱饵
      const c = pick(x => x.kind !== 'pal' || x.cost >= 2); if (c) { sc.players[0].hand.push(c.id); added.push('手:' + c.name); }
    } else if (t < 0.75) {                                      // 我方场上的无关单位
      const c = pick(x => (x.kind === 'pal' || x.kind === 'gear' || x.kind === 'building') && x.cost <= 5); if (c) { sc.players[0].base.push(c.id); added.push('场:' + c.name); }
    } else {                                                    // 对方场上的横置单位（多出攻击目标/可被打的东西）或阻挡者
      const c = pick(x => x.kind === 'pal' && x.cost <= 5); if (c) { sc.players[1].base.push(r() < 0.6 ? { id: c.id, rested: true } : c.id); added.push('敌:' + c.name); }
    }
  }
  return { sc, added };
}
function score(m) { return Math.log2(m.nodes + 2) * 1.0 + 6 * (1 - (m.avg ?? 1)) + 5 * (1 - (m.first ?? 1)); }

const only = new Set(process.argv.slice(2));
const outF = process.env.OUT || path.join(__dirname, 'distract_out.json');
const out = fs.existsSync(outF) ? JSON.parse(fs.readFileSync(outF, 'utf8')) : {};
const TRIES = +process.env.TRIES || 14, CAP = +process.env.CAP || 150000;
for (const p of PUZZLES) {
  if (only.size && !only.has(p.id)) continue;
  if (out[p.id]) { continue; }
  const base = metric(p.sc, CAP); if (base.ok !== true) { console.log(p.id, '原题求解失败，跳过'); continue; }
  const d0 = minDepth(p.sc, 14, CAP); const b0 = score(base);
  let best = null;
  const r = rng(p.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  for (let t = 0; t < TRIES; t++) {
    const { sc, added } = propose(p, r);
    if (!added.length) continue;
    let m; try { m = metric(sc, CAP); } catch (e) { continue; }
    if (m.ok !== true) continue;
    const d = minDepth(sc, d0 + 1, CAP); if (d !== d0) continue;   // 不能有捷径，也不能被改成更长
    const s = score(m);
    if (!best || s > best.s) best = { s, m, sc, added };
  }
  if (best && best.s > b0 + 0.5) { out[p.id] = { added: best.added, sc: best.sc, before: { nodes: base.nodes, avg: base.avg, first: +base.first.toFixed(2), depth: d0 }, after: { nodes: best.m.nodes, avg: best.m.avg, first: +best.m.first.toFixed(2) } }; console.log(p.id, 'L' + p.level, '✔', best.added.join(' '), JSON.stringify(out[p.id].before), '→', JSON.stringify(out[p.id].after)); }
  else console.log(p.id, 'L' + p.level, '无合适干扰项（保持原题）');
  fs.writeFileSync(outF, JSON.stringify(out));
}
