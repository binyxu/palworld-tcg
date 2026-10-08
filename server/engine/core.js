'use strict';
// 规则引擎核心：状态、区域、移动、事件、数值计算
const GAMEOVER = { gameover: true };
let INST = 1;

class Game {
  constructor({ db, decks, names, seed, scenario }) {
    this.db = db;
    this.init = { decks, names, scenario, seed: seed === undefined ? Math.floor(Math.random() * 2 ** 31) : seed };
    let s = this.init.seed >>> 0;
    this.rng = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    this.hist = [];
    this.uid = 1;
    this.p = [0, 1].map(i => ({
      idx: i, name: names[i], deck: [], hand: [], grave: [], base: [], exile: [],
      souls: [], soulDeck: 10, life: 10, dmg: 0, material: 0, ingredient: 0,
      palLimit: 5, soulLimit: 10, soulDrawTurn: -1, played: 0, flags: {}, gearDiscount: null,
    }));
    decks.forEach((list, i) => { for (const id of list) this.p[i].deck.push(this.mk(id, i)); });
    this.turnNo = 0; this.active = 0; this.first = 0; this.phase = 'setup';
    this.battle = null; this.nights = []; this.queue = []; this.delayed = [];
    this.log = []; this.over = null; this.seq = 0; this._batch = null; this.version = 0;
    this.gen = this.run(); this.pending = null;
    this.advance();
  }

  mk(id, owner) {
    const def = this.db[id];
    if (!def) throw new Error('未知卡牌 ' + id);
    return { uid: this.uid++, id, def, owner, ctrl: owner, zone: 'deck', inst: INST++,
      rested: false, damage: 0, mods: [], grants: [], names: [], noStand: [], used: {},
      assignedTurn: -1, seq: 0, exiledBy: null };
  }

  // ---------- 交互 ----------
  advance(ans) {
    try {
      const r = this.gen.next(ans);
      this.pending = r.done ? null : r.value;
    } catch (e) {
      if (e !== GAMEOVER) throw e;
      this.pending = null;
    }
    this.version++;
  }
  *ask(pi, req) { req.player = pi; return yield req; }
  answer(pi, ans) {
    const q = this.pending;
    if (!q || q.player !== pi) throw new Error('现在不是你的操作时机');
    if (q.kind === 'main' || q.kind === 'option') {
      const n = q.kind === 'main' ? q.actions.length : q.options.length;
      if (!Number.isInteger(ans) || ans < 0 || ans >= n) throw new Error('非法选项');
    } else if (q.kind === 'select') {
      if (!Array.isArray(ans)) throw new Error('需要数组');
      const s = new Set(ans);
      if (s.size !== ans.length || ans.some(u => !q.cands.includes(u))) throw new Error('非法选择');
      if (ans.length < q.min || ans.length > q.max) throw new Error(`需要选择 ${q.min}~${q.max} 张`);
    }
    // 可悔棋点：主要阶段行动、选择、选项（不含快速步骤里的"不再使用"）
    const pass = q.kind === 'main' && q.quick && q.actions[ans] && q.actions[ans].t === 'end';
    // 第 4 位：m = 主要阶段发起的行动（取消的回退点），e = 结束回合
    const mk = q.kind === 'main' && !q.quick ? (q.actions[ans] && q.actions[ans].t === 'end' ? 'e' : 'm') : '';
    this.hist.push([pi, ans, pass ? 0 : 1, mk]);
    this.advance(ans);
  }
  clone() {
    const g = new Game({ db: this.db, decks: this.init.decks, names: this.init.names, seed: this.init.seed, scenario: this.init.scenario });
    g.quiet = true;
    // muts：在历史第 at 步之前对副本施加的修改（AI 的隐藏信息重抽样），克隆时按原位置重放
    const M = this.muts || [];
    this.hist.forEach((h, i) => { for (const m of M) if (m.at === i) m.fn(g); g.advance(h[1]); g.hist.push(h); });
    for (const m of M) if (m.at === this.hist.length) m.fn(g);
    if (M.length) g.muts = M.slice();
    return g;
  }
  // 悔棋：回到 pi 最近一次可悔操作之前（之后所有操作一并撤销）
  undoPoint(pi) {
    for (let i = this.hist.length - 1; i >= 0; i--) if (this.hist[i][0] === pi && this.hist[i][2]) return i;
    return -1;
  }
  // 取消：当前处于 pi 某个行动的结算过程中（选目标/选卡/选项），回到发起该行动之前
  // strict=true（联机）时，若对手在此期间做过应对则不可取消
  cancelPoint(pi, strict) {
    const q = this.pending;
    if (!q || q.player !== pi || this.over) return -1;
    if (q.kind === 'main' && !q.quick) return -1;
    for (let i = this.hist.length - 1; i >= 0; i--) {
      const h = this.hist[i];
      if (h[0] !== pi) { if (strict || h[3]) return -1; continue; }
      if (h[3] === 'm') return i;
      if (h[3] === 'e') return -1;
    }
    return -1;
  }
  rewind(n) {
    const g = new Game({ db: this.db, decks: this.init.decks, names: this.init.names, seed: this.init.seed, scenario: this.init.scenario });
    for (const h of this.hist.slice(0, n)) g.advance(h[1]), g.hist.push(h);
    return g;
  }
  concede(pi) {
    if (this.over) return;
    this.over = { winner: 1 - pi, reason: `${this.p[pi].name} 投降` };
    this.say(this.over.reason);
    this.pending = null; this.version++;
  }
  say(s) { this.log.push(s); if (this.log.length > 400) this.log.shift(); }
  cname(c) { return '《' + c.def.name + '》'; }

  // ---------- 区域 ----------
  zoneArr(c) {
    if (c.zone === 'res' || c.zone === 'none') return null;
    return this.p[c.zone === 'base' ? c.ctrl : c.owner][c.zone];
  }
  allBase() { return [...this.p[0].base, ...this.p[1].base]; }
  inBase(c, inst) { return c.zone === 'base' && (inst === undefined || c.inst === inst); }
  isPal(c) { return c.def.kind === 'pal'; }
  isBld(c) { return c.def.kind === 'building'; }
  isGear(c) { return c.def.kind === 'gear'; }
  pals(f) { return this.allBase().filter(c => this.isPal(c) && (!f || f(c))); }
  myPals(pi, f) { return this.p[pi].base.filter(c => this.isPal(c) && (!f || f(c))); }
  opPals(pi, f) { return this.myPals(1 - pi, f); }

  snapshot(c) {
    return { rested: c.rested, power: this.power(c), strike: this.strike(c), cost: c.def.cost,
      kw: this.kw(c), autos: this.autosOf(c), ctrl: c.ctrl, inst: c.inst, names: this.namesOf(c) };
  }

  // 移动卡牌。to: base/hand/grave/deck/exile/res/none
  move(c, to, opt = {}) {
    const from = c.zone;
    const lki = from === 'base' ? this.snapshot(c) : null;
    if (lki && this.battle) this.battle.attStrikeSnap = this.strike(this.battle.att);
    const arr = this.zoneArr(c);
    if (arr) { const i = arr.indexOf(c); if (i >= 0) arr.splice(i, 1); }
    if (to !== 'base' || from !== 'base') {
      Object.assign(c, { rested: false, damage: 0, mods: [], grants: [], names: [], noStand: [],
        used: {}, assignedTurn: -1, exiledBy: null, inst: INST++ });
    }
    c.zone = to;
    if (to === 'base') c.ctrl = opt.ctrl !== undefined ? opt.ctrl : c.owner;
    const dest = this.zoneArr(c);
    if (dest) { if (opt.top) dest.unshift(c); else dest.push(c); }
    if (to === 'base') { c.rested = !!opt.rested; c.seq = ++this.seq; }
    const evs = [];
    if (from === 'base') {
      c.lki = lki;
      evs.push({ t: 'leave', card: c, to, lki, cause: opt.cause });
      if (to === 'grave') evs.push({ t: 'toGrave', card: c, lki, cause: opt.cause });
    }
    if (to === 'base' && from !== 'base') evs.push({ t: 'deploy', card: c, from });
    for (const ev of evs) this.emit(ev, from === 'base' ? [c] : []);
    return c;
  }
  // 同时移动多张（共享离场信息）
  moveMany(list, to, opt = {}) {
    this._batch = { evs: [], leavers: [] };
    const b = this._batch;
    try { for (const c of list) this.move(c, to, opt); } finally { this._batch = null; }
    for (const [ev] of b.evs) this.emit(ev, b.leavers);
  }

  // ---------- 事件 / 自动能力 ----------
  emit(ev, leavers = []) {
    if (this._batch) { this._batch.evs.push([ev]); for (const l of leavers) if (!this._batch.leavers.includes(l)) this._batch.leavers.push(l); return; }
    ev.leavers = leavers;
    const srcs = [...this.allBase().map(c => [c, this.autosOf(c), c.ctrl]),
      ...leavers.map(c => [c, c.lki.autos, c.lki.ctrl])];
    for (const [c, autos, ctrl] of srcs) {
      for (const a of autos) {
        let ok = false;
        try { ok = a.when(this, ev, c); } catch (e) { ok = false; }
        if (!ok) continue;
        if (ev.fired) { const key = c.inst + ':' + autos.indexOf(a) + ':' + (a.text || ''); if (ev.fired.has(key)) continue; ev.fired.add(key); }
        const count = this.isDoubled(c, ctrl, ev) ? 2 : 1;
        this.queue.push({ card: c, ctrl, a, ev, count, inst: c.lki && c.zone !== 'base' ? c.lki.inst : c.inst });
      }
    }
    // 时限诱发（延迟能力）
    for (const d of this.delayed) if (!d.done && d.when(this, ev)) {
      d.done = true; this.queue.push({ card: d.card, ctrl: d.ctrl, a: d, ev, count: 1 });
    }
    this.delayed = this.delayed.filter(d => !d.done);
  }
  isDoubled(c, ctrl, ev) {
    if (c.def.kind !== 'pal') return false;
    const lv = ev.leavers || [];
    const doubler = this.p[ctrl].base.some(x => x.def.doubleAuto) || lv.some(x => x.def.doubleAuto && x.lki.ctrl === ctrl);
    return doubler && this.isNight(lv);
  }
  isNight(leavers = []) {
    if (this.nights.some(n => n.until >= this.turnNo)) return true;
    if (this.allBase().some(c => c.def.nightWhileRested && c.rested)) return true;
    return leavers.some(c => c.def.nightWhileRested && c.lki && c.lki.rested);
  }

  // ---------- 能力集合 ----------
  activeGrants(c) { return c.grants; }
  kw(c) {
    const k = { ...(c.def.kw || {}) };
    const add = g => { for (const [n, v] of Object.entries(g)) k[n] = (typeof v === 'number' && typeof k[n] === 'number') ? k[n] + v : (k[n] || v); };
    for (const g of c.grants) if (g.kw) add(g.kw);
    if (c.zone === 'base') for (const s of this.allBase()) for (const st of s.def.statics || [])
      if (st.grantKw) { const g = st.grantKw(this, s, c); if (g) add(g); }
    return k;
  }
  autosOf(c) {
    const out = [...(c.def.autos || [])];
    for (const g of c.grants) if (g.auto) out.push(g.auto);
    const k = this.kw(c);
    for (const [n, v] of Object.entries(k)) {
      const mk = this.kwAutos[n];
      if (mk) { const times = typeof v === 'number' && n !== 'brave' && n !== 'serious' ? v : 1; for (let i = 0; i < times; i++) out.push(mk(v)); }
    }
    return out;
  }
  actsOf(c) {
    const out = (c.def.acts || []).map((a, i) => ({ ...a, key: 'a' + i }));
    c.grants.forEach((g, i) => { if (g.act) out.push({ ...g.act, key: 'g' + i + g.act.name }); });
    if (this.kw(c).interrupt) out.push({ ...this.interruptAct, key: 'interrupt' });
    return out;
  }

  // ---------- 数值 ----------
  statSum(c, key) {
    let v = 0;
    for (const m of c.mods) v += m[key] || 0;
    if (c.zone === 'base') for (const s of this.allBase()) for (const st of s.def.statics || [])
      if (st[key]) v += st[key](this, s, c) || 0;
    return v;
  }
  power(c) {
    if (c.def.kind !== 'pal' && c.def.kind !== 'building') return 0;
    let v = (c.def.power || 0) + this.statSum(c, 'power');
    if (c.def.kind === 'pal' && this.isNight()) v += 300 * (this.kw(c).nocturnal || 0);
    return v;
  }
  strike(c) { return c.def.kind === 'pal' ? (c.def.strike || 0) + this.statSum(c, 'strike') : 0; }
  namesOf(c) { return [c.def.ja, ...c.names]; }
  mainNames(c) {
    const out = [c.def.main];
    for (const n of c.names) { const d = this.db._byJa[n]; if (d && d.main) out.push(d.main); }
    return out.filter(Boolean);
  }
  hasMain(c, m) { return this.mainNames(c).includes(m); }
  sameName(a, b) { const s = this.namesOf(b); return this.namesOf(a).some(n => s.includes(n)); }
  // 互不同名的最大张数（贪心）
  distinctCount(cards) {
    const picked = [];
    for (const c of cards) if (!picked.some(p => this.sameName(p, c))) picked.push(c);
    return picked.length;
  }
  untilTurnEnd() { return this.turnNo; }
  untilOppNext(pi) { return this.active === pi ? this.turnNo + 1 : this.turnNo + 2; }
}

module.exports = { Game, GAMEOVER };
