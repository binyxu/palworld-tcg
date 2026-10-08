'use strict';
// 大师级 AI：每个决策点对所有候选行动做「蒙特卡洛前瞻」——
// 执行该行动后，用强化启发式策略把本回合打完、再模拟对手完整一回合，
// 在多次「公平化」采样（重洗未知信息）上取平均局面评估，选期望最高的行动。
// 共同随机数（同一采样种子比较不同行动）降低方差。
const { AI } = require('./ai');
const { cardValue, evaluate } = require('./ai_eval');

// 更深入的局面评估（从 pi 视角）
function evalM(g, pi) {
  if (g.over) return g.over.winner === pi ? +(process.env.TV || 400) - g.turnNo : g.over.winner === -1 ? -150 : -(process.env.TV || 400) + g.turnNo;
  const me = g.p[pi], op = g.p[1 - pi];
  const lifeV = l => { l = Math.max(l, 0); return l * 22 + Math.min(l, 6) * 14 + Math.min(l, 3) * 20; };
  let s = lifeV(me.life) - lifeV(op.life);
  const palV = (c, mine) => {
    const d = c.def;
    if (d.kind === 'pal') {
      let v = g.power(c) / 100 + g.strike(c) * 3.2 + d.cost * 0.5 + 3;
      const k = g.kw(c);
      if (k.stealth) v += 2; if (k.taunt) v += 1.5; if (k.assault) v += 1.5;
      if (d.acts && d.acts.length) v += 1.5;
      return v;
    }
    if (d.kind === 'building') return 4 + d.cost * 0.7;
    if (d.kind === 'gear') return 3 + d.cost * 0.5;
    return 0;
  };
  for (const c of me.base) s += palV(c, true);
  for (const c of op.base) s -= palV(c, false);
  // 压制力：轮到谁行动，谁的竖置帕鲁能造成的打击（对方可阻挡数折减）
  const pressure = (a, b) => {
    const atk = g.myPals(a).map(c => g.strike(c)).sort((x, y) => y - x);
    const blk = g.myPals(b, c => !c.rested).length;
    const dmg = atk.slice(blk).reduce((x, y) => x + y, 0);
    const L = Math.max(g.p[b].life, 1);
    return dmg >= L ? 40 : dmg * (L <= 4 ? 6 : 2.5);
  };
  s += pressure(pi, 1 - pi) * (g.active === pi ? 1 : 0.6) - pressure(1 - pi, pi) * (g.active === pi ? 0.6 : 1);
  s += (me.hand.length - op.hand.length) * 2.6;
  // 灵魂每回合补充，几乎不影响长期局面；只保留少量价值（快速/妨碍时可用）
  s += (me.souls.length - op.souls.length) * 0.4;
  s += (me.material + me.ingredient - op.material - op.ingredient) * 0.5;
  if (me.deck.length < 8) s -= (8 - me.deck.length) * 5;
  if (op.deck.length < 8) s += (8 - op.deck.length) * 5;
  return s;
}

// 推演策略中的起动能力估值：资源/抽卡/伤害类能力通常值得用（无模拟时的近似）
function actHeur(g, pi, a) {
  const L = a.label || '';
  if (/妨碍/.test(L)) return -5;
  if (/抽|获得|伤害|登场|竖置|横置|强化|战斗力|放逐|墓地/.test(L)) return 3;
  return 1.5;
}
class MasterAI extends AI {
  constructor(level = 'master', seed = Date.now(), opt = {}) {
    super('hard', seed);
    this.level = 'master';
    this.samples = opt.samples || +process.env.MS || 8;
    this.budgetMs = opt.budgetMs || 2500;
    this.cheat = !!opt.cheat; // 残局：信息全公开时不做公平化
    this.policy = (sd) => { const a = new AI('hard', sd); a.noSim = true; if (process.env.ACT !== '0') a.actHeur = actHeur; return a; };
  }
  decide(g, pi) {
    const q = g.pending;
    if (!q || q.player !== pi) return null;
    if (q.kind === 'option') {
      if (/先攻/.test(q.options.join()) || /重新抽取/.test(q.prompt)) return super.decide(g, pi);
      return this.search(g, pi, q.options.map((_, i) => i));
    }
    if (q.kind === 'select') {
      if (q.max <= 1 && q.cands.length <= 7) {
        const opts = q.cands.map(u => [u]); if (q.min === 0) opts.unshift([]);
        return this.search(g, pi, opts);
      }
      // 多选：启发式给出基准，再与若干变体比较
      const base = super.decide(g, pi);
      const alts = [base];
      if (q.min === 0 && base.length) alts.push([]);
      return this.search(g, pi, alts);
    }
    // main / quick
    const acts = q.actions, seen = new Map(), idx = [];
    acts.forEach((a, i) => {
      const c = a.uid ? g.findCard(a.uid) : null;
      const key = a.t + '|' + (c ? (c.zone === 'hand' ? 'h:' + c.id : c.uid) : '') + '|' + (a.label || '').replace(/《[^》]*》/g, '');
      if (!seen.has(key)) { seen.set(key, i); idx.push(i); }
    });
    if (idx.length === 1) return idx[0];
    return this.search(g, pi, idx);
  }
  // 对候选答案做共同随机数蒙特卡洛评估
  search(g, pi, answers) {
    if (answers.length === 1) return answers[0];
    const t0 = Date.now();
    const tot = answers.map(() => 0), n = answers.map(() => 0);
    const S = this.samples;
    for (let s = 0; s < S; s++) {
      const sd = Math.floor(this.rng() * 1e9);
      for (let k = 0; k < answers.length; k++) {
        if (s > 0 && Date.now() - t0 > this.budgetMs) break;
        let v;
        try {
          const g2 = g.clone();
          if (!this.cheat) this.fair(g2, pi, sd);
          g2.answer(pi, answers[k]);
          v = this.roll(g2, pi, sd);
        } catch (e) { v = -1e9; this.errs = (this.errs || 0) + 1; if (process.env.AIDBG) console.error(e.stack); }
        tot[k] += v; n[k]++;
      }
    }
    let best = 0, bv = -Infinity;
    answers.forEach((_, k) => { const v = n[k] ? tot[k] / n[k] : -Infinity; if (v > bv) { bv = v; best = k; } });
    if (process.env.AIDBG2) { const q = g.pending; console.log('T' + g.turnNo, q.kind, q.prompt.slice(0, 30), answers.map((a, k) => (q.kind === 'main' ? q.actions[a].label : q.kind === 'option' ? q.options[a] : JSON.stringify(a)) + '=' + (tot[k] / n[k]).toFixed(1)).join(' | ')); }
    return answers[best];
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
  // 推演到「下一次轮到 pi 的主要阶段开始」为止
  roll(g2, pi, sd) {
    const pol = [this.policy(sd), this.policy(sd + 1)];
    const start = g2.turnNo, myTurn = g2.active === pi;
    const stopTurn = process.env.HZ === 'short' ? start + 1 : myTurn ? start + 2 : start + 1;
    for (let k = 0; k < 600 && g2.pending; k++) {
      if (g2.turnNo >= stopTurn) break;
      const q = g2.pending;
      g2.answer(q.player, pol[q.player].decide(g2, q.player));
    }
    return process.env.EV === 'old' ? evaluate(g2, pi) : evalM(g2, pi);
  }
}
module.exports = { MasterAI, evalM };
