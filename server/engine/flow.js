'use strict';
// 游戏准备与回合流程（规则 6、7）
const { Game } = require('./core');
const P = Game.prototype;

P.run = function* () {
  if (this.init.scenario) { yield* this.runScenario(this.init.scenario); return; }
  // 6.2 游戏前步骤
  for (const pl of this.p) this.shuffle(pl.deck);
  this.first = this.rng() < 0.5 ? 0 : 1;
  const chooser = this.first; // 随机选中的玩家决定先后攻（Q8）
  const goFirst = (yield* this.option(chooser, '你获得了先后攻的选择权，请选择', ['先攻', '后攻'])) === 0;
  this.first = goFirst ? chooser : 1 - chooser;
  this.say(`${this.p[this.first].name} 先攻`);
  this.addSoul(1 - this.first, 1, false);
  for (const pl of this.p) this.draw(pl.idx, 5);
  for (const pi of [this.first, 1 - this.first]) {
    if (yield* this.yesno(pi, '是否重新抽取起手 5 张手牌？（每局仅 1 次，须全部更换）')) {
      const pl = this.p[pi];
      for (const c of [...pl.hand]) this.move(c, 'deck');
      this.shuffle(pl.deck); this.draw(pi, 5);
      this.say(`${pl.name} 重抽了手牌`);
    }
  }
  this.active = this.first;
  while (true) {
    yield* this.turn();
    this.active = 1 - this.active;
  }
};

// 残局：直接从给定局面开始（不洗牌，卡组按给定顺序，顶部在前）
P.runScenario = function* (sc) {
  sc.players.forEach((ps, pi) => {
    const pl = this.p[pi];
    for (const c of pl.deck) c.zone = 'none';
    pl.deck = [];
    const mk = (id, zone) => { const c = this.mk(id, pi); c.zone = zone; return c; };
    for (const id of ps.deck || []) pl.deck.push(mk(id, 'deck'));
    for (const id of ps.hand || []) pl.hand.push(mk(id, 'hand'));
    for (const id of ps.grave || []) pl.grave.push(mk(id, 'grave'));
    for (const b of ps.base || []) {
      const o = typeof b === 'string' ? { id: b } : b;
      const c = mk(o.id, 'base'); c.ctrl = pi; c.rested = !!o.rested; c.damage = o.damage || 0; c.seq = ++this.seq;
      pl.base.push(c);
    }
    pl.life = ps.life ?? 10;
    pl.souls = Array.from({ length: ps.souls || 0 }, (_, i) => ({ rested: i < (ps.soulsRested || 0) }));
    pl.soulDeck = ps.soulDeck ?? Math.max(0, 10 - (ps.souls || 0));
    pl.material = ps.material || 0; pl.ingredient = ps.ingredient || 0;
    if (ps.name) pl.name = ps.name;
  });
  this.first = sc.first ?? 0;
  this.active = sc.active ?? 0;
  this.turnNo = (sc.turnNo ?? 3) - 1;
  this.limit = sc.limit || null; // {pi, turn}: pi 须在第 turn 回合结束前获胜
  this.say('—— 残局开始 ——');
  let first = true;
  while (true) {
    yield* this.turn(first ? sc.startPhase || 'main' : null);
    first = false;
    if (this.limit && this.turnNo >= this.limit.turn && !this.over) {
      this.over = { winner: 1 - this.limit.pi, reason: '未能在限定回合内获胜' };
      this.say('游戏结束：' + this.over.reason); this.pending = null;
      throw require('./core').GAMEOVER;
    }
    this.active = 1 - this.active;
  }
};

P.turn = function* (startAt) {
  this.turnNo++;
  const pi = this.active, pl = this.p[pi];
  this.say(`—— 第 ${this.turnNo} 回合：${pl.name} ——`);
  if (startAt === 'main') { this.phase = 'main'; yield* this.checkTiming(); yield* this.mainPhase(); yield* this.endPhase(pi); return; }
  // 7.2 竖置阶段
  this.phase = 'stand';
  for (const c of pl.base) {
    if (c.noStand.some(n => n.type === 'nextStand' && n.pi === pi)) continue;
    if (this.cantStand(c)) continue;
    c.rested = false;
  }
  for (const c of pl.base) c.noStand = c.noStand.filter(n => !(n.type === 'nextStand' && n.pi === pi));
  for (const s of pl.souls) s.rested = false;
  this.emit({ t: 'turnStart', pi });
  yield* this.checkTiming();
  // 7.3 抽卡阶段
  this.phase = 'draw';
  if (!(pi === this.first && this.turnNo === 1)) {
    yield* this.checkTiming();
    this.draw(pi, 1);
    yield* this.checkTiming();
  }
  // 7.4 灵魂阶段
  this.phase = 'soul';
  yield* this.checkTiming();
  const k = this.addSoul(pi, 2, false);
  if (k) this.say(`${pl.name} 灵魂 +${k}`);
  yield* this.checkTiming();
  // 7.5 主要阶段
  this.phase = 'main';
  yield* this.checkTiming();
  yield* this.mainPhase();
  yield* this.endPhase(pi);
};
P.endPhase = function* (pi) {
  const pl = this.p[pi];
  // 7.6 结束阶段
  this.phase = 'end';
  const fired = new Set();
  for (let loop = 0; loop < 20; loop++) {
    const before = this.queue.length;
    this.emit({ t: 'turnEnd', pi, fired });
    const newTrig = this.queue.length > before;
    yield* this.checkTiming();
    for (const c of this.allBase()) c.damage = 0;
    for (const c of this.allBase()) c.mods = c.mods.filter(m => m.until === 'perm' || m.until > this.turnNo);
    for (const c of this.allBase()) { c.grants = c.grants.filter(g => g.until > this.turnNo); c.names = []; }
    if (!newTrig && !this.queue.length) break;
  }
  this.nights = this.nights.filter(n => n.until > this.turnNo);
  pl.gearDiscount = null;
};
module.exports = {};
