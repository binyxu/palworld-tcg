'use strict';
// 深度搜索 AI（困难）：在自己回合的每个决策点，
// 对「本回合内所有可能的行动序列」做深度优先搜索（含子选择：目标、选项、选卡），
// 一直推演到回合结束（轮到对手），用局面评估函数给最终局面打分，选择分数最高的路径。
// - 对手在我方回合内的应对（阻挡、妨碍等）用启发式策略模拟；
// - 未知信息（对手手牌/卡组、我方卡组顺序）在搜索前做一次随机「公平化」，不偷看；
// - 转置表合并"同一局面不同顺序"；按节点预算在兄弟分支间均分，预算用尽的分支用贪心策略补完本回合；
// - 找到的整条路径会缓存，后续决策若局面与计划一致则直接沿用，不一致（如抽到新牌）则重新搜索。
const { AI } = require('./ai');
const { evalM } = require('./ai_master');
const { sig } = require('./solver');

function actHeur(g, pi, a) {
  const L = a.label || '';
  if (/妨碍/.test(L)) return -5;
  if (/抽|获得|伤害|登场|竖置|横置|强化|战斗力|放逐|墓地/.test(L)) return 3;
  return 1.5;
}
// 不含隐藏信息的局面指纹：用于判断真实局面是否仍在计划路径上
function fp(g, pi) {
  const cv = c => [c.id, c.rested ? 1 : 0, c.damage, g.power(c), g.isPal(c) ? g.strike(c) : 0, Object.keys(c.used || {}).filter(k => c.used[k] === g.turnNo).join('.')].join(',');
  const pv = (p, mine) => [p.life, mine ? p.hand.map(c => c.id).sort().join(',') : p.hand.length, p.deck.length, p.grave.length, p.exile.length,
    p.base.map(cv).sort().join('|'), p.souls.length, p.souls.filter(s => !s.rested).length, p.material, p.ingredient, p.played].join(';');
  const q = g.pending, B = g.battle;
  const qs = q ? [q.player, q.kind, q.prompt, (q.actions || []).map(a => a.label).join('/'), (q.options || []).join('/'), (q.cands || []).join(',')].join('#') : '';
  return [g.turnNo, g.phase, B ? [B.att.uid, B.target === 'player' ? 'P' : B.target.uid, B.blocked].join(':') : '', g.queue.length, pv(g.p[pi], true), pv(g.p[1 - pi], false), qs].join('§');
}

class DeepAI extends AI {
  constructor(seed = Date.now(), opt = {}) {
    super('hard', seed);
    this.noSim = true; this.actHeur = actHeur;          // 自身启发式（用于排序与贪心补完）不再嵌套模拟
    this.budgetMs = opt.budgetMs || +process.env.DEEP_MS || 1800;
    this.maxNodes = opt.maxNodes || +process.env.DEEP_NODES || 2500;
    this.oppTurn = opt.oppTurn !== undefined ? opt.oppTurn : process.env.DEEP_OPP !== '0';
    this.plan = null;
  }
  pol(sd) { const a = new AI('hard', sd); a.noSim = true; a.actHeur = actHeur; return a; }

  decide(g, pi) {
    const q = g.pending;
    if (!q || q.player !== pi) return null;
    // 只在自己回合深搜；对手回合中的应对（阻挡/妨碍）沿用困难启发式
    if (g.active !== pi || g.over) { this.noSim = false; try { return super.decide(g, pi); } finally { this.noSim = true; } }
    if (q.kind === 'option' && (/先攻/.test(q.options.join()) || /重新抽取/.test(q.prompt))) return super.decide(g, pi);
    const opts = this.answers(g, pi);
    if (opts.length === 1) { this.plan = null; return opts[0]; }
    // 沿用已有计划
    const f = fp(g, pi);
    if (this.plan && this.plan.length && this.plan[0].fp === f) return this.plan.shift().ans;
    return this.search(g, pi);
  }

  // 某决策点的候选答案（已按启发式从好到坏排序）
  answers(g, pi) {
    const q = g.pending;
    if (q.kind === 'main') {
      const seen = new Set(), out = [];
      q.actions.forEach((a, i) => {
        const c = a.uid ? g.findCard(a.uid) : null;
        const key = a.t + '|' + (c ? (c.zone === 'hand' ? 'h:' + c.id : c.uid) : '') + '|' + (a.label || '').replace(/《[^》]*》/g, '');
        if (seen.has(key)) return; seen.add(key);
        let h = 0; try { h = a.t === 'end' ? 0.4 : this.heur(g, pi, a, q.actions); } catch (e) { }
        out.push([i, h]);
      });
      return out.sort((x, y) => y[1] - x[1]).map(x => x[0]);
    }
    if (q.kind === 'option') {
      const base = super.decide(g, pi);
      if (q.options.length > 8) return [base];
      return [base, ...q.options.map((_, i) => i).filter(i => i !== base)];
    }
    // select
    const base = super.decide(g, pi);
    const out = [base]; const k = JSON.stringify;
    if (q.max <= 1 && q.cands.length <= 8) {
      const seen = new Map();
      for (const u of q.cands) { const c = g.findCard(u) || g.p.flatMap(p => p.deck).find(x => x.uid === u); const kk = c ? [c.id, c.zone, c.ctrl, c.rested, c.damage].join(':') : u; if (!seen.has(kk)) seen.set(kk, u); }
      for (const u of seen.values()) out.push([u]);
      if (q.min === 0) out.push([]);
    } else if (q.min === 0 && base.length) out.push([]);
    const s = new Set(); return out.filter(a => { const x = k(a); if (s.has(x)) return false; s.add(x); return true; });
  }

  search(g, pi) {
    this.t0 = Date.now(); this.nodes = 0; this.memo = new Map(); this.turn = g.turnNo; this.pi = pi;
    const root = g.clone();
    this.fair(root, pi, Math.floor(this.rng() * 1e9));
    this.sd = Math.floor(this.rng() * 1e9);
    const r = this.dfs(root, this.maxNodes);
    // r.path: [{fp, ans}]，fp 在公平化后的副本上计算，但 fp 不含隐藏信息，可与真实局面比对
    const first = r.path.length ? r.path[0].ans : super.decide(g, pi);
    this.plan = r.path.slice(1);
    if (process.env.AIDBG) console.log(`[deep] T${g.turnNo} nodes=${this.nodes} ${Date.now() - this.t0}ms value=${r.v.toFixed(1)} steps=${r.path.length}`);
    return first;
  }
  fair(g2, pi, sd) {
    let s = sd >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const sh = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } };
    sh(g2.p[pi].deck);
    const op = g2.p[1 - pi]; const pool = [...op.hand, ...op.deck]; sh(pool);
    const hn = op.hand.length;
    op.hand = pool.slice(0, hn); op.deck = pool.slice(hn);
    for (const c of op.hand) c.zone = 'hand'; for (const c of op.deck) c.zone = 'deck';
  }
  // 对手的应对用启发式自动走完，直到轮到我方决策 / 回合结束 / 对局结束
  advance(g2) {
    const op = this.pol(this.sd);
    for (let k = 0; k < 200 && g2.pending && !g2.over; k++) {
      if (g2.turnNo !== this.turn || g2.active !== this.pi) return;
      const q = g2.pending;
      if (q.player === this.pi) return;
      g2.answer(q.player, op.decide(g2, q.player));
    }
  }
  // 叶子评估：回合结束时的局面分；可选再用启发式模拟对手一整回合（考虑反击）
  score(g2) {
    const base = evalM(g2, this.pi);
    if (!this.oppTurn || g2.over) return base;
    const c = g2.clone(), p = [this.pol(this.sd + 2), this.pol(this.sd + 3)], t = c.turnNo;
    for (let k = 0; k < 400 && c.pending && !c.over && c.turnNo <= t; k++) { const q = c.pending; c.answer(q.player, p[q.player].decide(c, q.player)); }
    return 0.5 * base + 0.5 * evalM(c, this.pi);
  }
  leaf(g2) { return g2.turnNo !== this.turn || g2.active !== this.pi || g2.over || !g2.pending; }
  // 预算用尽：贪心策略补完本回合
  greedy(g2) {
    const p = [this.pol(this.sd), this.pol(this.sd + 1)];
    for (let k = 0; k < 300 && g2.pending && !this.leaf(g2); k++) { const q = g2.pending; g2.answer(q.player, p[q.player].decide(g2, q.player)); }
    return this.score(g2);
  }
  dfs(g2, budget) {
    this.advance(g2);
    if (this.leaf(g2)) return { v: this.score(g2), path: [] };
    const key = sig(g2);
    if (this.memo.has(key)) return this.memo.get(key);
    const out = Date.now() - this.t0 > this.budgetMs || this.nodes >= this.maxNodes;
    if (budget < 1 || out) { const r = { v: this.greedy(g2.clone()), path: [] }; this.memo.set(key, r); return r; }
    const ans = this.answers(g2, this.pi), f = fp(g2, this.pi);
    let best = null, left = budget - 1;
    for (let i = 0; i < ans.length; i++) {
      const share = left / (ans.length - i);
      let r;
      try {
        const c = g2.clone(); this.nodes++;
        c.answer(this.pi, ans[i]);
        const before = this.nodes;
        r = this.dfs(c, share - 1);
        left -= Math.max(1, this.nodes - before + 1);
      } catch (e) { if (process.env.AIDBG) console.error(e.message); continue; }
      // 同分时偏好"结束回合"之外的行动顺序中靠前者（启发式排序）
      if (!best || r.v > best.v + 1e-9) best = { v: r.v, path: [{ fp: f, ans: ans[i] }, ...r.path] };
    }
    if (!best) best = { v: this.greedy(g2.clone()), path: [] };
    this.memo.set(key, best);
    return best;
  }
}
module.exports = { DeepAI };
