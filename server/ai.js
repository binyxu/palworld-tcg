'use strict';
const { evaluate, pickSelect, cardValue } = require('./ai_eval');

class AI {
  constructor(level = 'normal', seed = Date.now()) {
    this.level = level; let s = seed >>> 0;
    this.rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  decide(g, pi) {
    const q = g.pending;
    if (!q || q.player !== pi) return null;
    if (q.kind === 'select') {
      if (this.blockHook && /阻挡/.test(q.prompt)) return this.blockHook(g, pi, q);
      return pickSelect(g, pi, q, this.level, this.rng);
    }
    if (q.kind === 'option') return this.option(g, pi, q);
    return this.main(g, pi, q);
  }

  // ---------- 选项 ----------
  option(g, pi, q) {
    const pr = q.prompt, o = q.options;
    if (/先攻/.test(o.join())) return 0;
    if (/重新抽取/.test(pr)) {
      const h = g.p[pi].hand;
      const cheap = h.filter(c => c.def.kind === 'pal' && c.def.cost <= 3).length;
      return cheap === 0 || (this.level !== 'easy' && h.filter(c => c.def.cost >= 7).length >= 3) ? 0 : 1;
    }
    if (/攻击目标/.test(pr)) return this.attackTarget(g, pi, q);
    if (/^是否/.test(pr) || o.length === 2 && o[0] === '是') {
      if (/返回手牌/.test(pr)) { const B = g.battle; return B && B.att && B.att.damage > 0 ? 0 : 1; }
      return 0;
    }
    if (/（X）/.test(pr)) {
      const n = o.length - 1;
      if (/丢弃/.test(pr)) return Math.min(n, Math.max(0, g.p[pi].hand.length - 3));
      return n;
    }
    if (/失去几个/.test(pr)) return o.length - 1;
    if (/宣言1个卡名/.test(pr)) return this.declareName(g, pi, q);
    if (this.level !== 'easy' && o.length <= 6) {
      const r = this.simBest(g, pi, o.map((_, i) => i));
      if (r !== null) return r;
    }
    return Math.floor(this.rng() * o.length);
  }
  declareName(g, pi, q) {
    // 宣言《家畜牧场》等无意义；尝试宣言能让《冒险的开始》或牧场条件成立的卡名 —— 简化：选第一个
    return 0;
  }
  attackTarget(g, pi, q) {
    const a = g.declaring;
    const targets = g.legalTargets(a);
    let best = 0, bs = -1e9;
    targets.forEach((t, i) => {
      const s = this.targetScore(g, pi, a, t) + (this.level === 'hard' ? this.hardTarget(g, pi, a, t) : 0);
      if (s > bs) { bs = s; best = i; }
    });
    return best;
  }
  targetScore(g, pi, a, t) {
    const op = 1 - pi, ap = g.power(a);
    const blockers = g.myPals(op, c => !c.rested);
    if (t === 'player') {
      const st = g.strike(a);
      let s = st * 6 + (g.p[op].life <= st ? 80 : 0);
      const strongBlock = blockers.some(b => g.power(b) >= ap - a.damage);
      if (strongBlock && !g.kw(a).stealth) s -= 8;
      return s;
    }
    const tp = g.power(t), left = tp - t.damage;
    if (g.isBld(t)) return ap >= left ? 6 + cardValue(g, t) : -5;
    const kills = ap >= left && ap > 0, dies = tp >= ap - a.damage && tp > 0;
    if (kills && !dies) return 12 + cardValue(g, t);
    if (kills && dies) return cardValue(g, t) - cardValue(g, a) + 2;
    return -20;
  }

  // ---------- 主要阶段 / 快速步骤 ----------
  main(g, pi, q) {
    const acts = q.actions;
    const endI = acts.findIndex(a => a.t === 'end');
    if (q.quick) return this.quick(g, pi, q);
    if (this.level === 'easy') {
      if (endI >= 0 && this.rng() < 0.12) return endI;
      const good = acts.map((a, i) => [a, i]).filter(([a]) => a.t === 'play' || (a.t === 'attack' && this.rng() < 0.7) || (a.t === 'act' && this.rng() < 0.3));
      if (good.length) return good[Math.floor(this.rng() * good.length)][1];
      return endI >= 0 ? endI : 0;
    }
    if (this.level === 'hard' && this.useDeep) {
      const r = this.simBest(g, pi, acts.map((_, i) => i), endI);
      if (r !== null) return r;
    }
    let best = endI >= 0 ? endI : 0, bs = 0.5;
    acts.forEach((a, i) => {
      const s = this.heur(g, pi, a, acts) + (this.level === 'hard' ? this.hardAdj(g, pi, a) : 0);
      if (s > bs) { bs = s; best = i; }
    });
    return best;
  }
  // 困难难度附加规则
  lethal(g, pi) {
    const op = 1 - pi;
    const atks = g.myPals(pi, c => !c.rested && g.legalTargets(c).includes('player')).map(c => ({ c, s: g.strike(c), st: !!g.kw(c).stealth }));
    const blockers = g.myPals(op, c => !c.rested).length;
    const stealthDmg = atks.filter(a => a.st).reduce((s, a) => s + a.s, 0);
    const rest = atks.filter(a => !a.st).map(a => a.s).sort((x, y) => y - x).slice(blockers);
    const interrupts = g.p[op].hand.length >= 1 ? 1 : 0; // 对方可能持有妨碍
    return stealthDmg + rest.reduce((s, x) => s + x, 0) >= g.p[op].life + interrupts * 2;
  }
  hardAdj(g, pi, a) {
    const c = a.uid ? g.findCard(a.uid) : null, me = g.p[pi];
    if (a.t === 'attack') {
      const ts = g.legalTargets(c);
      if (this.lethal(g, pi) && ts.includes('player')) return 200;
      // 攻击后横置，可能被对方攻击
      const maxOp = Math.max(0, ...g.opPals(pi).map(x => g.power(x)));
      if (maxOp >= g.power(c)) return -cardValue(g, c) * 0.25;
      return 2;
    }
    if (a.t === 'play') {
      const d = c.def;
      const hasInt = me.hand.some(h => h !== c && h.def.kw && h.def.kw.interrupt);
      const left = g.untapSouls(pi) - g.playCost(c, pi);
      if (hasInt && left < 1 && g.myPals(pi).length > 0 && d.kind !== 'pal') return -8;
      if (d.kw && d.kw.interrupt && me.hand.length <= 3 && g.myPals(pi).length >= 2) return -12;
      if (d.kind === 'pal' && /登场时/.test(d.text)) return 4;
    }
    return 0;
  }
  // 困难：攻击目标额外考虑斩杀
  hardTarget(g, pi, a, t) {
    if (t === 'player' && this.lethal(g, pi)) return 300;
    return 0;
  }
  heur(g, pi, a, acts) {
    const me = g.p[pi];
    const c = a.uid ? g.findCard(a.uid) : null;
    const palCount = g.myPals(pi).length;
    const hasAttack = acts.some(x => x.t === 'attack');
    if (a.t === 'play') {
      const d = c.def;
      if (d.kind === 'pal') return palCount >= 5 ? (cardValue(g, c) > 10 ? 3 : -1) : 20 + d.cost;
      if (d.kind === 'building') return 14 + d.cost;
      if (d.kind === 'gear') return palCount ? 12 + d.cost : 2;
      return this.simDelta(g, pi, a);
    }
    if (a.t === 'attack') {
      const ts = g.legalTargets(c);
      const s = Math.max(...ts.map(t => this.targetScore(g, pi, c, t)));
      return s > 0 ? 10 + s : -1;
    }
    if (a.t === 'act') {
      if (c && /选择1只帕鲁[^。]*直至回合结束[^。]*(战斗力|打击力)】?\+/.test(c.def.text || '')) { if (!g.myPals(pi).length) return -9; if (hasAttack) return 40; }
      if (/任命/.test(a.label) && hasAttack) {
        if (this.level !== 'hard') return -1;
        // 困难：存在无法有效攻击的竖置帕鲁时，用其任命
        const idle = g.myPals(pi, x => !x.rested && !g.legalTargets(x).some(t => this.targetScore(g, pi, x, t) > 0));
        if (!idle.length) return -1;
      }
      const d = this.simDelta(g, pi, a);
      return d > 1 ? 5 + d : -1;
    }
    if (a.t === 'soulDraw') return me.hand.length <= 2 && !acts.some(x => x.t === 'play') ? 4 : -1;
    return -1;
  }
  quick(g, pi, q) {
    const acts = q.actions, endI = acts.findIndex(a => a.t === 'end');
    if (this.level === 'easy' && this.rng() < 0.5) return endI;
    const B = g.battle;
    let best = endI, bs = 0;
    acts.forEach((a, i) => {
      if (a.t === 'end') return;
      let s;
      if (a.key === 'interrupt') {
        const threat = B && B.target === 'player' ? g.strike(B.att) * (g.p[pi].life <= 4 ? 10 : 3) : B && B.target && B.target.def ? cardValue(g, B.target) : 0;
        const lethal = B && B.target === 'player' && g.strike(B.att) >= g.p[pi].life;
        s = lethal ? 100 : threat - (/①/.test(a.label) ? 6 : 9);
      } else s = this.simDelta(g, pi, a, i);
      if (s > bs) { bs = s; best = i; }
    });
    return best;
  }

  // ---------- 模拟 ----------
  // 公平化：模拟前随机重排对己方未知的信息（对手手牌+卡组、己方卡组）
  determinize(g2, pi) {
    const r = this.rng;
    const sh = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } };
    sh(g2.p[pi].deck);
    const op = g2.p[1 - pi]; const pool = [...op.hand, ...op.deck]; sh(pool);
    const hn = op.hand.length;
    op.hand = pool.slice(0, hn); op.deck = pool.slice(hn);
    for (const c of op.hand) c.zone = 'hand'; for (const c of op.deck) c.zone = 'deck';
  }
  rollout(g2, pi, deep) {
    const sub = new AI('normal', Math.floor(this.rng() * 1e9)); sub.noSim = true;
    const turn = g2.turnNo;
    for (let k = 0; k < (deep ? 400 : 120) && g2.pending; k++) {
      const q = g2.pending;
      if (!deep && q.player === pi && q.kind === 'main' && !q.quick) break;
      if (g2.turnNo !== turn && !deep) break;
      if (deep && g2.turnNo >= turn + 2) break;
      g2.answer(q.player, sub.decide(g2, q.player));
    }
    return evaluate(g2, pi);
  }
  simIdx(g, pi, i) {
    const deep = false;
    const samples = this.level === 'hard' ? 3 : 1;
    let tot = 0;
    for (let s = 0; s < samples; s++) {
      try {
        const g2 = g.clone();
        if (this.level === 'hard') this.determinize(g2, pi);
        g2.answer(pi, i); tot += this.rollout(g2, pi, deep);
      } catch (e) { return -1e9; }
    }
    return tot / samples;
  }
  simBest(g, pi, idxs, endI) {
    if (this.noSim) return null;
    let best = null, bs = -1e18;
    for (const i of idxs.slice(0, 18)) {
      const v = this.simIdx(g, pi, i) + (i === endI ? 0.3 : 0);
      if (v > bs) { bs = v; best = i; }
    }
    return best;
  }
  simDelta(g, pi, a, idx) {
    if (this.noSim) return a && a.t === 'act' ? (this.actHeur ? this.actHeur(g, pi, a) : 1) : 1;
    const q = g.pending; const i = idx !== undefined ? idx : q.actions.indexOf(a);
    return this.simIdx(g, pi, i) - evaluate(g, pi);
  }
}
module.exports = { AI };
