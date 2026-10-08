'use strict';
// 主要阶段可选行动（规则 8）、卡片使用、起动能力
const { Game } = require('./core');
const P = Game.prototype;

P.playCost = function (c, pi) {
  let cost = c.def.cost;
  const gd = this.p[pi].gearDiscount;
  if (c.def.kind === 'gear' && gd && gd.until >= this.turnNo && gd.x > 0) cost = Math.max(Math.min(cost, 1), cost - gd.x);
  return cost;
};
P.canPlay = function (c, pi, quickOnly) {
  if (c.zone !== 'hand' || c.owner !== pi) return false;
  if (quickOnly && !(c.def.kind === 'event' && c.def.quick)) return false;
  if (c.def.canPlay && !c.def.canPlay(this, c, pi)) return false;
  return this.untapSouls(pi) >= this.playCost(c, pi);
};
P.actUsable = function (c, pi, a, quickStep) {
  if (a.zone === 'hand' ? c.zone !== 'hand' || c.owner !== pi : !(c.zone === 'base' && c.ctrl === pi)) return false;
  if (quickStep ? !a.quick : a.needsBattle) return false;
  if (a.needsBattle && !(this.battle && this.battle.att && !this.battle.failed)) return false;
  if (a.once && c.used[a.key] === this.turnNo) return false;
  if (a.canUse && !a.canUse(this, c, pi)) return false;
  return true;
};
P.listActs = function (pi, quickStep) {
  const out = [];
  const pl = this.p[pi];
  for (const c of [...pl.base, ...pl.hand]) for (const a of this.actsOf(c)) {
    if (!this.actUsable(c, pi, a, quickStep)) continue;
    a.costs.forEach((alt, ai) => {
      if (!this.canPay(c, pi, alt)) return;
      out.push({ t: 'act', uid: c.uid, key: a.key, alt: ai, label: `${this.cname(c)} 起动：${a.name || ''}［${this.costText(alt)}］` });
    });
  }
  return out;
};
P.mainActions = function () {
  const pi = this.active, pl = this.p[pi], out = [];
  for (const c of pl.hand) if (this.canPlay(c, pi)) out.push({ t: 'play', uid: c.uid, label: `使用 ${this.cname(c)}（${this.playCost(c, pi)}灵魂）` });
  out.push(...this.listActs(pi, false));
  for (const c of this.myPals(pi)) if (this.legalTargets(c).length) out.push({ t: 'attack', uid: c.uid, label: `${this.cname(c)} 发起攻击` });
  if (pl.soulDrawTurn !== this.turnNo && this.untapSouls(pi) >= 3) out.push({ t: 'soulDraw', label: '支付 3 灵魂抽 1 张卡' });
  const must = pl.flags.mustAttack === this.turnNo && out.some(a => a.t === 'attack');
  if (!must) out.push({ t: 'end', label: '结束回合' });
  return out;
};
P.mainPhase = function* () {
  while (true) {
    yield* this.checkTiming();
    const req = { kind: 'main', prompt: '主要阶段：选择行动', actions: this.mainActions() };
    const i = yield* this.ask(this.active, req);
    const a = req.actions[i];
    if (a.t === 'end') return;
    yield* this.doAction(this.active, a);
  }
};
// 重新计算当前主要阶段可选行动（测试/外部改动局面后使用）
P.refreshMain = function () { const q = this.pending; if (q && q.kind === 'main' && !q.quick) q.actions = this.mainActions(); };
P.findCard = function (uid) {
  for (const pl of this.p) for (const z of ['hand', 'base', 'grave', 'deck', 'exile']) { const c = pl[z].find(x => x.uid === uid); if (c) return c; }
  return null;
};
P.doAction = function* (pi, a) {
  const c = a.uid ? this.findCard(a.uid) : null;
  if (a.t === 'play') yield* this.playCard(c, pi);
  else if (a.t === 'act') yield* this.useAct(c, pi, a.key, a.alt);
  else if (a.t === 'attack') yield* this.doBattle(c);
  else if (a.t === 'soulDraw') {
    this.paySouls(pi, 3); this.p[pi].soulDrawTurn = this.turnNo;
    this.say(`${this.p[pi].name} 支付 3 灵魂抽卡`); this.draw(pi, 1);
  }
};
// 10.6.2 使用手牌中的卡片
P.playCard = function* (c, pi, opt = {}) {
  const pl = this.p[pi];
  const cost = opt.cost !== undefined ? opt.cost : this.playCost(c, pi);
  if (c.def.kind === 'gear' && !opt.fromDeck && pl.gearDiscount && pl.gearDiscount.until >= this.turnNo) pl.gearDiscount = null;
  const prevPlayed = pl.played;
  this.move(c, 'res');
  this.paySouls(pi, cost);
  this.say(`${pl.name} 使用了 ${this.cname(c)}`);
  pl.played++;
  if (c.def.kind === 'event') {
    yield* c.def.play(this, c, pi, { prevPlayed });
    if (c.zone === 'res') this.move(c, 'grave');
  } else {
    this.move(c, 'base');
  }
  this.emit({ t: 'play', card: c, pi });
};
P.useAct = function* (c, pi, key, ai) {
  const a = this.actsOf(c).find(x => x.key === key);
  const alt = a.costs[ai];
  if (a.once) c.used[key] = this.turnNo;
  const inst = c.inst;
  this.say(`${this.cname(c)} 起动能力：${a.name || this.costText(alt)}`);
  const paid = yield* this.payCost(c, pi, alt, a.name || this.cname(c));
  paid.inst = inst;
  yield* a.run(this, c, pi, paid);
};
// 是否仍为同一张在据点的卡
P.same = function (c, inst) { return c.zone === 'base' && c.inst === inst; };
module.exports = {};
