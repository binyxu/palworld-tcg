'use strict';
// 残局求解器：完全信息 AND-OR 搜索。
// 玩家 hero 的决策点为 OR（存在一步可胜即可），对手决策点为 AND（对手所有应对都必须仍能获胜）。
// 用于：① 验证残局存在必胜解；② 作为残局中"最聪明的对手"（选择让玩家无法取胜、或解最难的应对）。
const { Game } = require('../engine');

function combos(arr, min, max, cap = 400) {
  const out = [];
  const rec = (i, cur) => {
    if (out.length >= cap) return;
    if (cur.length >= min && cur.length <= max) out.push(cur.slice());
    if (cur.length === max) return;
    for (let j = i; j < arr.length; j++) { cur.push(arr[j]); rec(j + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}
function moves(g) {
  const q = g.pending; if (!q) return [];
  if (q.kind === 'main') {
    // 先尝试"做事"，结束/不再使用放最后
    const idx = q.actions.map((a, i) => i);
    return idx.sort((a, b) => (q.actions[a].t === 'end') - (q.actions[b].t === 'end'));
  }
  if (q.kind === 'option') return q.options.map((_, i) => i);
  // select：去重同名同状态的候选（对称剪枝）
  const seen = new Map();
  for (const u of q.cands) {
    const c = g.findCard(u) || g.p.flatMap(p => p.deck).find(x => x.uid === u);
    const k = c ? [c.id, c.zone, c.ctrl, c.rested, c.damage, c.zone === 'deck' ? g.p[c.owner].deck.indexOf(c) : 0].join(':') : u;
    if (!seen.has(k)) seen.set(k, []);
    seen.get(k).push(u);
  }
  const groups = [...seen.values()];
  if (q.max <= 0) return [[]];
  if (q.max <= 1) { const r = groups.map(gr => [gr[0]]); if (q.min === 0) r.push([]); return r.reverse(); }
  return combos(q.cands, q.min, q.max).sort((a, b) => b.length - a.length);
}
function sig(g) {
  const cv = c => [c.id, c.rested ? 1 : 0, c.damage, g.power ? g.power(c) : 0, g.isPal(c) ? g.strike(c) : 0, Object.keys(c.used || {}).filter(k => c.used[k] === g.turnNo).join('.'), c.noStand.length, c.assignedTurn === g.turnNo ? 1 : 0].join(',');
  const pv = p => [p.life, p.deck.map(c => c.id).join(','), p.hand.map(c => c.id).sort().join(','), p.grave.length, p.exile.map(c => c.id).sort().join(','),
    p.base.map(cv).sort().join('|'), p.souls.length, p.souls.filter(s => !s.rested).length, p.soulDeck, p.material, p.ingredient, p.soulDrawTurn === g.turnNo ? 1 : 0, p.played].join(';');
  const q = g.pending;
  const qs = q ? [q.player, q.kind, q.prompt, (q.actions || []).map(a => a.label).join('/'), (q.options || []).join('/'), q.min, q.max, (q.cands || []).length].join('#') : 'none';
  const B = g.battle;
  return [g.turnNo, g.active, g.phase, g.isNight() ? 1 : 0, B ? [B.att.id, B.target === 'player' ? 'P' : B.target.id, B.blocked, B.failed].join(':') : '', g.queue.length, pv(g.p[0]), pv(g.p[1]), qs].join('§');
}
function child(g, ans) { const c = g.clone(); c.answer(c.pending.player, ans); return c; }

class Solver {
  constructor({ hero = 0, maxNodes = 300000 } = {}) { this.hero = hero; this.memo = new Map(); this.nodes = 0; this.maxNodes = maxNodes; }
  // 返回 true=hero 必胜，false=无法保证
  win(g) {
    if (g.over) return g.over.winner === this.hero;
    if (!g.pending) return false;
    const k = sig(g);
    if (this.memo.has(k)) return this.memo.get(k);
    if (++this.nodes > this.maxNodes || (this.until && (this.nodes & 63) === 0 && Date.now() > this.until)) throw new Error('搜索超出节点上限');
    this.memo.set(k, false); // 防环
    const ms = moves(g), heroTurn = g.pending.player === this.hero;
    let r;
    if (heroTurn) { r = false; for (const m of ms) if (this.win(child(g, m))) { r = true; break; } }
    else { r = true; for (const m of ms) if (!this.win(child(g, m))) { r = false; break; } }
    this.memo.set(k, r);
    return r;
  }
  // hero 的所有必胜着法
  winningMoves(g) { return moves(g).filter(m => this.win(child(g, m))); }
  // 对手的最佳应对：优先让 hero 无法必胜；否则选使 hero 证明树最大的（最难的）
  refute(g) {
    const ms = moves(g); let best = ms[0], bestN = -1;
    for (const m of ms) {
      const c = child(g, m);
      const n0 = this.nodes;
      const sub = new Solver({ hero: this.hero, maxNodes: this.maxNodes }); sub.memo = this.memo;
      const w = sub.win(c); this.nodes += sub.nodes;
      if (!w) return m;
      const size = sub.nodes; if (size > bestN) { bestN = size; best = m; }
      void n0;
    }
    return best;
  }
}
// 求一条主线（hero 走必胜着，对手走最强应对），用于展示答案
function mainLine(g, hero = 0, limit = 200) {
  const S = new Solver({ hero }); const line = [];
  if (!S.win(g)) return null;
  while (!g.over && g.pending && line.length < limit) {
    const q = g.pending, me = q.player === hero;
    const m = me ? S.winningMoves(g)[0] : S.refute(g);
    line.push({ p: q.player, prompt: q.prompt, label: q.kind === 'main' ? q.actions[m].label : q.kind === 'option' ? (q.prompt ? q.prompt + ' → ' : '') + q.options[m] : (q.prompt || '选择') + '：' + (m.length ? m.map(u => { const c = g.findCard(u); return c ? '《' + c.def.name + '》' : '#' + u; }).join('、') : '不选'), ans: m });
    g = child(g, m);
  }
  return { line, over: g.over };
}
module.exports = { Solver, moves, child, sig, mainLine };
// 残局对手：用求解器寻找"让玩家无法必胜"的应对；搜索超限时退回困难 AI
// hero 最少还需要多少次"主动行动"（主要阶段行动 + 选择/选项）才能强制获胜（对手每步都取最顽强的应对）
// 返回 Infinity 表示在 maxD 内无法强制获胜
function forcedDepth(g, hero, maxD, budget) {
  const memo = new Map();
  const rec = (g, k) => {
    if (g.over) return g.over.winner === hero;
    if (!g.pending) return false;
    const key = sig(g) + '|' + k; const m0 = memo.get(key); if (m0 !== undefined) return m0;
    if (--budget.n < 0 || (budget.n & 255) === 0 && Date.now() > budget.until) throw new Error('budget');
    const q = g.pending, me = q.player === hero;
    let r;
    if (me) {
      const pass = q.kind === 'main' && q.quick;  // 快速步骤里"不再使用"不计步
      r = false;
      for (const m of moves(g)) {
        const free = pass && q.actions[m].t === 'end';
        const nk = free ? k : k - 1; if (nk < 0) continue;
        if (rec(child(g, m), nk)) { r = true; break; }
      }
    } else { r = true; for (const m of moves(g)) if (!rec(child(g, m), k)) { r = false; break; } }
    memo.set(key, r); return r;
  };
  for (let d = 0; d <= maxD; d++) if (rec(g, d)) return d;
  return Infinity;
}
// 残局对手：
// ① 若存在让玩家无法必胜的应对，选它；
// ② 否则"苟延残喘"：选让玩家最少所需步数最多的应对（尽量阻挡、尽量吃下最大伤害）；
//    步数相同再按"困难 AI 的直觉 + 自身生命/场面"打破平局。
class PuzzleAI {
  constructor(hero = 0) { const { AI } = require('./ai'); this.hero = hero; this.fb = new AI('hard', 1); this.memo = new Map(); }
  // 用困难 AI 把当前回合快速走完，看对手还剩多少生命/场面（衡量"挡住了多少伤害"）
  rollout(c, pi) {
    const { evalM } = require('./ai_master'); const { AI } = require('./ai');
    const p = [new AI('hard', 3), new AI('hard', 4)]; p[0].noSim = p[1].noSim = true;
    const t = c.turnNo;
    for (let k = 0; k < 120 && c.pending && !c.over && c.turnNo === t; k++) { const q = c.pending; c.answer(q.player, p[q.player].decide(c, q.player)); }
    if (c.over) return c.over.winner === pi ? 1e5 : -1e5;
    return c.p[pi].life * 50 + evalM(c, pi);
  }
  decide(g, pi) {
    const ms = moves(g); if (ms.length <= 1) return ms.length ? ms[0] : this.fb.decide(g, pi);
    const t0 = Date.now();
    // ① 找能让玩家无法必胜的应对
    try {
      const S = new Solver({ hero: this.hero, maxNodes: 20000 }); S.memo = this.memo; S.until = t0 + 2200;
      for (const m of ms) if (!S.win(child(g, m))) return m;
    } catch (e) { this.memo = new Map(); }
    // ② 全部会输（或算不完）：苟延残喘
    const budget = { n: 60000, until: Math.max(Date.now() + 600, t0 + 3000) };
    let best = null;
    for (const m of ms) {
      const c = child(g, m);
      let d = -1;
      if (Date.now() < budget.until) { try { d = forcedDepth(c, this.hero, 14, budget); } catch (e) { d = -1; } }
      let ro = 0; try { ro = this.rollout(c.clone(), pi); } catch (e) { }
      const sc = (d === Infinity ? 1e9 : d < 0 ? 0 : d * 1e6) + ro;
      if (!best || sc > best.sc) best = { sc, m, d };
    }
    if (process.env.AIDBG) console.log('[puzzle-ai] stall', best.d, Date.now() - t0, 'ms');
    return best.m;
  }
}
module.exports.PuzzleAI = PuzzleAI;
