'use strict';
// 深度搜索 AI（困难）：在自己回合的每个决策点，
// 对「本回合内所有可能的行动序列」做深度优先搜索（含子选择：目标、选项、选卡），
// 一直推演到回合结束（轮到对手），用局面评估函数给最终局面打分，选择分数最高的路径。
// - 对手在我方回合内的应对（阻挡、妨碍等）用启发式策略模拟；
// - 未知信息（对手手牌/卡组、我方卡组顺序）在搜索前做一次随机「公平化」，不偷看；
// - 转置表合并"同一局面不同顺序"；按节点预算在兄弟分支间均分，预算用尽的分支用贪心策略补完本回合；
// - 找到的整条路径会缓存，后续决策若局面与计划一致则直接沿用，不一致（如抽到新牌）则重新搜索。
const { AI } = require('./ai');
const harmfulP = p => /伤害|墓地|横置|放逐|返回手牌|-\d|无法|解体|丢弃/.test(p) && !/墓地中|墓地的|墓地帕鲁/.test(p);
const { evalM } = require('./ai_master');
const { sig, Solver, moves: solverMoves, child: solverChild } = require('./solver');
const VN = require('./ai_value');
// 局面评估：value='net' 用学习到的价值网络（终局 ±1000），否则用手写评估 evalM
function evalOf(ai, g, pi) {
  if (ai.value === 'net' && VN.ready()) { if (g.over) return g.over.winner === pi ? 1000 - g.turnNo : g.over.winner === -1 ? -300 : -1000 + g.turnNo; return 300 * VN.value(g, pi, ai.vfile); }
  return evalM(g, pi);
}
// 长线计划加分（价值网络看不到的组合/引擎）：
//  · 场上有【起】【1回合1次】的资源型建筑（抽卡/素材/食材/灵魂）→ 越早越值
//  · 卡组里带「冒险的开始」时，场上不同《起始》帕鲁的种类数
const PLAN_B = /【起】【1回合1次】[^。]*(抽|【素材】|【食材】|灵魂)/;
function plan(g, pi) {
  const P = g.p[pi]; let v = 0;
  const late = Math.max(0, 1 - g.turnNo / 14);
  for (const c of P.base) if (c.def.kind === 'building' && PLAN_B.test(c.def.text || '')) v += 14 * late;
  const adv = P.hand.concat(P.deck).some(c => c.id === 'BP01-100');
  if (adv) { const k = new Set(g.myPals(pi, x => x.def.ja.includes('始まりの')).map(x => x.def.ja)).size; v += [0, 6, 16, 34][Math.min(3, k)]; }
  return v;
}

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
    this.rollouts = opt.rollouts || +process.env.DEEP_R || 1;
    this.value = opt.value || process.env.DEEP_VALUE || 'net';
    this.vfile = opt.vfile || null;
    this.forceMs = opt.forceMs || +process.env.DEEP_FMS || 1500; this.puzzleMs = opt.puzzleMs || +process.env.DEEP_PMS || 20000; this.forceNodes = opt.forceNodes || 60000;
    this.minOpp = opt.minOpp !== undefined ? opt.minOpp : process.env.DEEP_MINOPP !== '0';
    this.cheat = !!opt.cheat;                                   // 地狱：完全信息（看得到对手手牌与双方卡组顺序）
    this.inner = !!opt.inner;                                   // 内层（对手回合）搜索
    this.reply = opt.reply !== undefined ? opt.reply : process.env.DEEP_REPLY !== '0';
    this.topM = opt.topM || +process.env.DEEP_M || 6;             // 复核的候选数
    this.samples = opt.samples || +process.env.DEEP_K || 3;       // 每个候选抽样对手手牌次数
    this.replyMs = opt.replyMs || +process.env.DEEP_RMS || 2400;  // 第二阶段总时间
    this.replyNodes = opt.replyNodes || +process.env.DEEP_RN || 100;
    this.plan = null;
  }
  pol(sd) { const a = new AI('hard', sd); a.noSim = true; a.actHeur = actHeur; return a; }

  decide(g, pi) {
    const q = g.pending;
    if (!q || q.player !== pi) return null;
    // 只在自己回合深搜；对手回合中的应对（阻挡/妨碍）沿用困难启发式
    if (g.active !== pi && !g.over) { const fw = this.forced(g, pi); if (fw !== null) return fw; }
    if (g.active !== pi || g.over) { this.noSim = false; try { return super.decide(g, pi); } finally { this.noSim = true; } }
    if (q.kind === 'option' && (/先攻/.test(q.options.join()) || /重新抽取/.test(q.prompt))) return super.decide(g, pi);
    const fw = this.forced(g, pi); if (fw !== null) { this.plan = null; return fw; }
    const opts = this.answers(g, pi);
    if (opts.length === 1) { this.plan = null; return opts[0]; }
    // 沿用已有计划
    const f = fp(g, pi);
    if (this.plan && this.plan.length && this.plan[0].fp === f) return this.plan.shift().ans;
    return this.search(g, pi);
  }

  // 必胜检查（AND-OR 求解）：在隐藏信息重抽样后的副本上找"无论对手如何应对都能获胜"的着法。
  // 只在可能接近终局时尝试（有回合限制、对手生命低、卡组将尽），同一局面失败过不再重试。
  forced(g, pi) {
    if (this.inner || this.noForce) return null;
    const op = g.p[1 - pi], me = g.p[pi];
    const near = g.limit || op.life <= 6 || op.deck.length <= 6 || me.life <= 3;
    if (!near) return null;
    const f = fp(g, pi) + '|' + g.hist.length;
    this.fmemo = this.fmemo || new Map();
    if (this.fmemo.has(f)) return null;
    const c = g.clone();
    this.fair(c, pi, Math.floor(this.rng() * 1e9));
    // 残局（公开信息）：求解器可跨步复用（已证明的结论仍有效），预算放宽
    const sc = !!(g.init && g.init.scenario);
    const S = sc && this.psolver && this.psolver.hero === pi ? this.psolver : new Solver({ hero: pi, maxNodes: sc ? 400000 : this.forceNodes });
    S.nodes = 0; S.until = Date.now() + (sc ? this.puzzleMs : this.forceMs);
    let mv = null;
    try { if (S.win(c)) { const ms = solverMoves(c); for (const m of ms) if (S.win(solverChild(c, m))) { mv = m; break; } } } catch (e) { mv = null; }
    // 超时抛出后 memo 中可能残留"进行中=false"的条目，不能复用
    if (sc) this.psolver = mv !== null ? S : null;
    if (mv === null) { this.fmemo.set(f, 1); return null; }
    if (process.env.AIDBG) console.log(`[forced] T${g.turnNo} win found nodes=${S.nodes}`);
    // 着法需映射回真实局面：main/option 用下标；select 用 uid（重抽样只交换手牌/卡组内容，场上 uid 一致）
    const q = g.pending;
    if (q.kind === 'select') { if (!Array.isArray(mv) || mv.some(u => !q.cands.includes(u))) return null; }
    else if (!Number.isInteger(mv) || mv >= (q.kind === 'main' ? q.actions.length : q.options.length)) return null;
    return mv;
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
        // 强化类起动（直至回合结束 战斗力/打击力+）：有可攻击的帕鲁时先强化再攻击；己方没有帕鲁时不要起动（只能强化对手）
        if (a.t === 'act' && c && /选择1只帕鲁[^。]*直至回合结束[^。]*(战斗力|打击力)】?\+/.test(c.def.text || '')) {
          if (!g.myPals(pi).length) return;   // 只会强化到对手：不考虑
          else if (q.actions.some(x => x.t === 'attack')) h += 30;
        }
        // 「冒险的开始」组合：集齐 3 种《起始》帕鲁再用（全体 +1000/打击力 +5）；否则只在本局第一张卡时用来抽 2
        if (c && a.t === 'play' && c.id === 'BP01-100') {
          const kinds = new Set(g.myPals(pi, x => x.def.ja.includes('始まりの')).map(x => x.def.ja)).size;
          const canHit = g.myPals(pi, x => !x.rested).length > 0 && q.actions.some(x => x.t === 'attack');
          if (kinds >= 3 && canHit) h += 80; else if (g.p[pi].played === 0) h += 5; else return;
        }
        if (c && a.t === 'play' && c.zone === 'hand' && c.def.ja && c.def.ja.includes('始まりの') && g.p[pi].hand.some(x => x.id === 'BP01-100')) {
          const have = new Set(g.myPals(pi, x => x.def.ja.includes('始まりの')).map(x => x.def.ja));
          if (!have.has(c.def.ja)) h += 25 + have.size * 15;
        }
        out.push([i, h]);
      });
      return out.sort((x, y) => y[1] - x[1]).map(x => x[0]);
    }
    if (q.kind === 'option') {
      const base = super.decide(g, pi);
      if (q.options.length > 8) return [base];
      const all = [base, ...q.options.map((_, i) => i).filter(i => i !== base)];
      const ok = all.filter(i => !this.badTarget(g, q, i));
      return ok.length ? ok : all;
    }
    // select
    const base = super.decide(g, pi);
    const out = [base]; const k = JSON.stringify;
    // 增益类选择：只要有己方候选，就绝不选对方的卡
    const buff = !harmfulP(q.prompt) && /\+\d|赋予|竖置|回复|获得/.test(q.prompt);
    const ownU = u => { const c = g.findCard(u); return c && (c.zone === 'base' ? c.ctrl : c.owner) === pi; };
    const hasOwn = q.cands.some(ownU);
    if (q.max <= 1 && q.cands.length <= 8) {
      const seen = new Map();
      for (const u of q.cands) { const c = g.findCard(u) || g.p.flatMap(p => p.deck).find(x => x.uid === u); const kk = c ? [c.id, c.zone, c.ctrl, c.rested, c.damage].join(':') : u; if (!seen.has(kk)) seen.set(kk, u); }
      for (const u of seen.values()) out.push([u]);
      if (q.min === 0) out.push([]);
    } else if (q.min === 0 && base.length) out.push([]);
    const s = new Set(); return out.filter(a => { if (buff && hasOwn && Array.isArray(a) && a.some(u => !ownU(u))) return false; const x = k(a); if (s.has(x)) return false; s.add(x); return true; })
      .concat(buff && hasOwn && !out.some(a => Array.isArray(a) && a.length && a.every(ownU)) ? [q.cands.filter(ownU).slice(0, Math.max(1, q.min))] : []);
  }

  // 白送：攻击帕鲁却打不死、自己还会被反杀（攻击时增益按 +500 宽容估计）
  badTarget(g, q, i) {
    const m = q.meta; if (!m || !m.attacker || !m.targets) return false;
    const t = m.targets[i]; if (t === 'player') return false;
    const a = g.findCard(m.attacker), c = g.findCard(t); if (!a || !c || !g.isPal(c)) return false;
    // 只有"攻击时 …战斗力+X"这类能力才计入增益（抽卡等攻击时能力不算）
    const m2 = /攻击时[^。]*?战斗力】?\+(\d+)/.exec((a.def && a.def.text) || ''); const bonus = m2 ? +m2[1] : 0;
    const ap = g.power(a) + bonus, left = g.power(c) - c.damage;
    const kills = ap >= left && ap > 0, dies = g.power(c) >= g.power(a) + bonus - a.damage && g.power(c) > 0;
    if (!kills && dies) return true;
    // 对换：若我方另有尚未攻击的帕鲁能单独击杀它且自己存活，就不该用会死的帕鲁去换（交给那只去打）
    if (kills && dies) {
      const tp = g.power(c);
      const alt = g.myPals(a.ctrl, x => x !== a && !x.rested && g.rawTargets && g.legalTargets(x).includes(c))
        .some(x => g.power(x) >= left && tp < g.power(x) - x.damage);
      if (alt) return true;
    }
    return false;
  }
  search(g, pi) {
    this.t0 = Date.now(); this.nodes = 0; this.memo = new Map(); this.turn = g.turnNo; this.pi = pi;
    this.leaves = []; this.stack = [];
    const root = g.clone();
    this.fair(root, pi, Math.floor(this.rng() * 1e9));
    this.sd = Math.floor(this.rng() * 1e9);
    const r = this.dfs(root, this.maxNodes);
    let best = r;
    // 第二阶段：对本回合的若干候选结束局面，搜索对手下一回合的最强应对（多次抽样对手手牌，取均值）
    if (this.reply && !this.inner) best = this.rescore(r) || r;
    const first = best.path.length ? best.path[0].ans : super.decide(g, pi);
    this.plan = best.path.slice(1);
    if (process.env.AIDBG) console.log(`[deep] T${g.turnNo} nodes=${this.nodes} cands=${this.leaves.length} ${Date.now() - this.t0}ms v=${r.v.toFixed(1)}→${best.v.toFixed(1)} steps=${best.path.length}`);
    return first;
  }
  rescore(r) {
    const seen = new Set(), cands = [];
    for (const L of this.leaves.sort((a, b) => b.v - a.v)) {
      const k = sig(L.g); if (seen.has(k)) continue; seen.add(k); cands.push(L);
      if (cands.length >= this.topM) break;
    }
    if (cands.length <= 1) return null;
    const t1 = Date.now(), budget = this.replyMs, op = 1 - this.pi;
    let best = null;
    cands.forEach((L, ci) => {
      let v;
      if (L.g.over || L.g.turnNo === this.turn && L.g.active === this.pi && L.g.pending) v = L.base;
      else {
        let sum = 0, n = 0;
        const S = this.cheat ? 1 : this.samples;
        for (let k = 0; k < S; k++) {
          // 只按节点数限制（不按时间），保证各候选得到同等深度的对手搜索；总时间超出 3 倍预算时才放弃
          if (Date.now() - t1 > budget * 3) break;
          const c = L.g.clone();
          this.fair(c, op, this.sd + 101 * k, true);   // 公共随机数：各候选用同一组抽样，差异只来自候选本身   // 对手视角：对手知道自己的手牌，我们只能抽样；我方卡组顺序也未知
          const opAI = new DeepAI(this.sd + k, { inner: true, cheat: this.cheat, value: this.value, vfile: this.vfile, maxNodes: this.cheat ? this.replyNodes * 2 : this.replyNodes, budgetMs: 1e9 });
          sum += -opAI.bestValue(c, op); n++;
        }
        v = n ? 0.35 * L.base + 0.65 * sum / n : L.v;
      }
      if (process.env.AIDBG) console.log(`   cand ${ci}: stage1=${L.v.toFixed(1)} base=${L.base.toFixed(1)} → ${v.toFixed(1)}  ` + L.g.p.map(p => p.life + ":" + p.base.map(c => L.g.cname(c).slice(-4, -1) + (c.rested ? "R" : "")).join(",")).join(" | "));
      if (!best || v > best.v) best = { v, path: L.path };
    });
    return best;
  }
  // 内层：从对手（pi）的回合开始，搜索其整回合的最佳行动，返回 pi 视角的分数
  bestValue(g, pi) {
    this.t0 = Date.now(); this.nodes = 0; this.memo = new Map(); this.pi = pi; this.leaves = []; this.stack = [];
    this.sd = Math.floor(this.rng() * 1e9);
    // 推进到 pi 的第一个决策点（对手回合开始的抽卡等）
    for (let k = 0; k < 200 && g.pending && !g.over && g.pending.player !== pi; k++) { const q = g.pending; g.answer(q.player, this.pol(this.sd).decide(g, q.player)); }
    if (g.over || !g.pending) return evalOf(this, g, pi);
    this.turn = g.turnNo;
    if (g.active !== pi) return evalOf(this, g, pi);
    return this.dfs(g, this.maxNodes).v;
  }
  fair(g2, pi, sd, oppHandOnly) {
    if (this.cheat) return;
    if (g2.init && g2.init.scenario) return;   // 残局：局面（含卡组顺序）是公开给玩家的题面信息，不需要重抽样
    // 隐藏信息重抽样：写入 muts，使之后的 clone() 仍保持（否则克隆按历史重放会还原真实手牌）
    const fn = h => {
      let s = sd >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const sh = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } };
      if (!oppHandOnly) sh(h.p[pi].deck);
      const op = h.p[1 - pi]; const pool = [...op.hand, ...op.deck]; sh(pool);
      const hn = op.hand.length;
      op.hand = pool.slice(0, hn); op.deck = pool.slice(hn);
      for (const c of op.hand) c.zone = 'hand'; for (const c of op.deck) c.zone = 'deck';
      if (oppHandOnly) sh(h.p[pi].deck);
    };
    // oppHandOnly：pi 是"对手"，pi 的手牌由我们抽样 —— 即对 pi 之外一方做 fair 的反面
    if (oppHandOnly) { const q = 1 - pi; return this.fair(g2, q, sd, false); }
    fn(g2);
    g2.muts = [...(g2.muts || []), { at: g2.hist.length, fn }];
  }
  // 对手的应对用启发式自动走完，直到轮到我方决策 / 回合结束 / 对局结束
  advance(g2) {
    const op = this.pol(this.sd);
    for (let k = 0; k < 200 && g2.pending && !g2.over; k++) {
      if (g2.turnNo !== this.turn || g2.active !== this.pi) return;
      const q = g2.pending;
      if (q.player === this.pi) return;
      if (this.opBranch(g2, q)) return;              // 对手的关键应对（妨碍/快速/阻挡）交给搜索取最坏情况
      g2.answer(q.player, op.decide(g2, q.player));
    }
  }
  // 对手在我方回合中的关键决策点：返回候选答案（≥2 个时作为 MIN 节点搜索），否则 null
  opBranch(g2, q) {
    if (!this.minOpp) return null;
    if (q.kind === 'main' && q.quick) {
      const seen = new Set(), out = [];
      q.actions.forEach((a, i) => { const k = a.t === 'end' ? 'end' : (a.label || '').replace(/《[^》]*》/, '') + '|' + (g2.findCard(a.uid) || {}).id; if (!seen.has(k)) { seen.add(k); out.push(i); } });
      return out.length >= 2 ? out.slice(0, 4) : null;
    }
    if (q.kind === 'option' && /阻挡/.test(q.prompt) && q.options.length >= 2) return q.options.map((_, i) => i).slice(0, 4);
    return null;
  }
  // 叶子评估：回合结束时的局面分；可选再用启发式模拟对手一整回合（考虑反击）
  score(g2) {
    const base = evalOf(this, g2, this.pi);
    if (!this.oppTurn || g2.over || this.inner) return base;
    let sum = 0; const R = this.rollouts;
    for (let j = 0; j < R; j++) {
      const c = g2.clone(), p = [this.pol(this.sd + 2 + j * 11), this.pol(this.sd + 3 + j * 11)], t = c.turnNo;
      for (let k = 0; k < 400 && c.pending && !c.over && c.turnNo <= t; k++) { const q = c.pending; c.answer(q.player, p[q.player].decide(c, q.player)); }
      sum += evalOf(this, c, this.pi);
    }
    return 0.5 * base + 0.5 * sum / R;
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
    if (this.leaf(g2)) {
      const v = this.score(g2);
      if (!this.inner) this.leaves.push({ v, base: evalOf(this, g2, this.pi), g: g2, path: this.stack.slice() });
      return { v, path: [] };
    }
    const key = sig(g2);
    if (this.memo.has(key)) return this.memo.get(key);
    const out = Date.now() - this.t0 > this.budgetMs || this.nodes >= this.maxNodes;
    if (budget < 1 || out) {
      const gg = g2.clone(), v = this.greedy(gg);
      if (!this.inner) this.leaves.push({ v, base: evalOf(this, gg, this.pi), g: gg, path: this.stack.slice() });
      const r = { v, path: [] }; this.memo.set(key, r); return r;
    }
    const oq = g2.pending;
    if (oq.player !== this.pi) {
      // MIN 节点：对手选择对我最不利的应对；只保留最坏分支下的候选叶子
      const oa = this.opBranch(g2, oq); let worst = null, wl = null, left = budget - 1;
      for (let i = 0; i < oa.length; i++) {
        const share = left / (oa.length - i), l0 = this.leaves.length; let r;
        try { const c = g2.clone(); this.nodes++; c.answer(oq.player, oa[i]); const b0 = this.nodes; r = this.dfs(c, share - 1); left -= Math.max(1, this.nodes - b0 + 1); }
        catch (e) { this.leaves.length = l0; continue; }
        const mine = this.leaves.splice(l0);
        if (!worst || r.v < worst.v - 1e-9) { worst = r; wl = mine; }
      }
      if (!worst) { worst = { v: this.greedy(g2.clone()), path: [] }; wl = []; }
      this.leaves.push(...wl);
      this.memo.set(key, worst);
      return worst;
    }
    const ans = this.answers(g2, this.pi), f = fp(g2, this.pi);
    let best = null, left = budget - 1;
    for (let i = 0; i < ans.length; i++) {
      const share = left / (ans.length - i);
      let r;
      try {
        const c = g2.clone(); this.nodes++;
        c.answer(this.pi, ans[i]);
        const before = this.nodes;
        this.stack.push({ fp: f, ans: ans[i] });
        try { r = this.dfs(c, share - 1); } finally { this.stack.pop(); }
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
