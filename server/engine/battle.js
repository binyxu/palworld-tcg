'use strict';
// 战斗（规则 9）
const { Game } = require('./core');
const P = Game.prototype;

// 攻击目标候选：{type:'player'} 或卡
P.rawTargets = function (att) {
  const op = 1 - att.ctrl, k = this.kw(att), out = [];
  if (!att.rested && att.ctrl === this.active && !(att.flags && att.flags.noAttack)) {
    if (!this.attackBanned(att)) {
      out.push('player');
      for (const c of this.p[op].base) {
        if (this.isBld(c)) out.push(c);
        else if (this.isPal(c) && (c.rested || k.assault)) out.push(c);
      }
    }
  }
  return out.filter(t => t === 'player' || !this.protectedFrom(t, att));
};
P.attackBanned = function () { return false; };
P.protectedFrom = function (t, att) {
  for (const st of t.def.statics || []) if (st.notAttackedBy && st.notAttackedBy(this, t, att)) return true;
  return false;
};
P.legalTargets = function (att) {
  const raw = this.rawTargets(att);
  const taunts = raw.filter(t => t !== 'player' && this.kw(t).taunt);
  return taunts.length ? taunts : raw;
};
P.targetName = function (t) { return t === 'player' ? '对手玩家' : this.cname(t); };

P.doBattle = function* (att) {
  const pi = this.active, op = 1 - pi;
  // 9.3 攻击宣言
  const ts = this.legalTargets(att);
  if (!ts.length) return;
  let target;
  if (ts.length === 1) target = ts[0];
  else {
    this.declaring = att;
    const i = yield* this.option(pi, `选择 ${this.cname(att)} 的攻击目标`, ts.map(t => this.targetName(t)), { attacker: att.uid, targets: ts.map(t => t === 'player' ? 'player' : t.uid) });
    this.declaring = null;
    target = ts[i];
  }
  const B = this.battle = { att, attInst: att.inst, target, tInst: target === 'player' ? null : target.inst, blocked: false, failed: false, opp: null };
  att.rested = true;
  this.say(`${this.cname(att)} 攻击 ${this.targetName(target)}`);
  this.emit({ t: 'attack', card: att, target });
  if (target !== 'player') this.emit({ t: 'attacked', card: target, by: att });
  this.phase = 'battle';
  yield* this.checkTiming();
  // 9.4 阻挡
  if (!B.failed) {
    this.emit({ t: 'blockStep' });
    yield* this.checkTiming();
    if (this.same(att, B.attInst) && !this.kw(att).stealth) {
      const blockers = this.myPals(op, c => !c.rested && c !== B.target && !c.mods.some(m => m.noBlock));
      if (blockers.length) {
        const bs = yield* this.choose(op, blockers, 0, 1, `${this.cname(att)} 正在攻击 ${this.targetName(B.target)}，是否选择 1 只帕鲁阻挡？`, { always: true });
        if (bs.length) {
          const b = bs[0]; b.rested = true; B.target = b; B.tInst = b.inst; B.blocked = true;
          this.say(`${this.cname(b)} 进行阻挡`);
          this.emit({ t: 'block', card: b });
        }
      }
    }
    if (B.target !== 'player' && this.isPal(B.target)) B.opp = B.target;
    yield* this.checkTiming();
  }
  // 9.5 快速步骤
  if (!B.failed) {
    this.emit({ t: 'quickStep' });
    yield* this.checkTiming();
    while (!B.failed) {
      const acts = [];
      for (const c of this.p[op].hand) if (this.canPlay(c, op, true)) acts.push({ t: 'play', uid: c.uid, label: `使用 ${this.cname(c)}（${this.playCost(c, op)}灵魂）` });
      acts.push(...this.listActs(op, true));
      if (!acts.length) break;
      acts.push({ t: 'end', label: '不再使用（进入伤害步骤）' });
      const i = yield* this.ask(op, { kind: 'main', prompt: '快速步骤：可使用【快速】卡片或能力', actions: acts, quick: true });
      if (acts[i].t === 'end') break;
      yield* this.doAction(op, acts[i]);
      yield* this.checkTiming();
    }
  }
  // 9.6 伤害步骤
  if (!B.failed) {
    this.emit({ t: 'damageStep' });
    yield* this.checkTiming();
    const attOk = this.same(att, B.attInst);
    const t = B.target;
    const tOk = t === 'player' || this.same(t, B.tInst);
    if (!B.failed && attOk && tOk) {
      if (t === 'player') {
        const s = this.strike(att);
        if (s > 0) this.damagePlayer(op, s);
      } else if (this.isPal(t)) {
        const pa = this.power(att), pt = this.power(t);
        if (pa > 0) { t.damage += pa; this.say(`${this.cname(t)} 受到 ${pa} 战斗伤害`); }
        if (pt > 0) { att.damage += pt; this.say(`${this.cname(att)} 受到 ${pt} 战斗伤害`); }
      } else {
        const pa = this.power(att);
        if (pa > 0) { t.damage += pa; this.say(`${this.cname(t)} 受到 ${pa} 战斗伤害`); }
      }
    }
    yield* this.checkTiming();
  }
  // 9.7 战斗结束
  this.emit({ t: 'battleEnd', att, attInst: B.attInst });
  yield* this.checkTiming();
  for (const c of this.allBase()) c.mods = c.mods.filter(m => m.until !== 'battle');
  this.battle = null;
  this.phase = 'main';
};
// 使攻击失败（5.18）
P.failAttack = function () {
  if (this.battle) { this.battle.failed = true; this.say('攻击失败！'); }
};
// 某卡是否为正在进行战斗中的帕鲁
P.inBattle = function (c, lkiInst) {
  const B = this.battle; if (!B) return false;
  const inst = lkiInst !== undefined ? lkiInst : c.inst;
  return (c === B.att && inst === B.attInst) || (B.opp && c === B.opp && inst === B.tInst);
};
module.exports = {};
