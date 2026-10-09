'use strict';
// 基础行动：抽卡、灵魂、资源、伤害、选择辅助
const { Game, GAMEOVER } = require('./core');
const P = Game.prototype;

P.shuffle = function (arr) {
  if (this.hist) this.leak = this.hist.length;   // 随机结果已产生
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
};
P.draw = function (pi, n = 1) {
  const pl = this.p[pi]; let k = 0;
  for (let i = 0; i < n; i++) { const c = pl.deck[0]; if (!c) break; this.move(c, 'hand'); k++; }
  if (k) this.say(`${pl.name} 抽了 ${k} 张卡`);
  return k;
};
P.untapSouls = function (pi) { return this.p[pi].souls.filter(s => !s.rested).length; };
P.paySouls = function (pi, n) {
  const st = this.p[pi].souls.filter(s => !s.rested);
  if (st.length < n) return false;
  for (let i = 0; i < n; i++) st[i].rested = true;
  return true;
};
P.addSoul = function (pi, n, rested) {
  const pl = this.p[pi]; let k = 0;
  while (k < n && pl.soulDeck > 0 && pl.souls.length < pl.soulLimit) {
    pl.soulDeck--; pl.souls.push({ rested: !!rested }); k++;
  }
  return k;
};
P.standSouls = function (pi, n) {
  let k = 0; for (const s of this.p[pi].souls) if (k < n && s.rested) { s.rested = false; k++; }
  return k;
};
P.gain = function (pi, res, n) { this.p[pi][res] += n; this.say(`${this.p[pi].name} 获得 ${n} 个${res === 'material' ? '【素材】' : '【食材】'}`); };
P.gainLife = function (pi, n) { this.p[pi].life += n; this.say(`${this.p[pi].name} 生命 +${n}`); };
P.lifeOf = function (pi) { return Math.max(0, this.p[pi].life); };

// 给予帕鲁/建筑物效果伤害（含朱雀置换）
P.dealDamage = function (src, ctrlOfSrc, target, n, battle = false) {
  if (!this.inBase(target)) return;
  if (!battle && this.isPal(target) && src && src.def.color === 'red') {
    let k = 0;
    for (const c of this.p[ctrlOfSrc].base) if (c.def.redDmgBoost) k++;
    n += 200 * k;
  }
  if (n <= 0) return;
  target.damage += n;
  this.say(`${this.cname(target)} 受到 ${n} 伤害`);
};
// 对玩家伤害（插入型规则处理，立即执行 11.2）
P.damagePlayer = function (pi, n) {
  if (n <= 0) return;
  const pl = this.p[pi];
  pl.dmg += n;
  let milled = 0, lucky = false;
  this.say(`${pl.name} 受到 ${n} 点伤害`);
  while (true) {
    const c = pl.deck[0];
    if (!c) break;
    this.move(c, 'grave'); milled++;
    if (c.def.lucky) { lucky = true; this.say(`翻开 ${this.cname(c)}（幸运帕鲁）—— 伤害被抵消！`); break; }
    if (milled >= pl.dmg) break;
  }
  if (!lucky) { pl.life -= pl.dmg; this.say(`${pl.name} 失去 ${pl.dmg} 点生命（剩余 ${pl.life}）`); }
  pl.dmg = 0;
};
P.addMod = function (c, mod) { if (this.inBase(c)) c.mods.push({ until: this.turnNo, ...mod }); };
P.rest = function (c) { if (this.inBase(c) && !c.rested) { c.rested = true; return true; } return false; };
P.stand = function (c) {
  if (!this.inBase(c) || !c.rested) return false;
  if (this.cantStand(c)) return false;
  c.rested = false; return true;
};
P.cantStand = function (c) {
  return c.noStand.some(n => n.type === 'while' ? this.allBase().some(x => x.uid === n.srcUid && x.inst === n.srcInst) : false);
};
P.setNight = function (until) { this.nights.push({ until }); this.say('变为黑夜！'); };

// ---------- 选择辅助（生成器） ----------
// cands: 卡数组；返回所选卡数组
P.choose = function* (pi, cands, min, max, prompt, extra = {}) {
  cands = cands.filter(Boolean);
  const view = extra.view ? extra.view.filter(Boolean).map(c => c.uid) : undefined;
  if (!cands.length) {
    // 检视类效果：即使没有可选的卡，也让玩家看到检视结果
    if (view && view.length) yield* this.ask(pi, { kind: 'option', prompt: prompt.replace(/（检视：.*）$/, '') + '——没有符合条件的卡', options: ['确定'], view });
    return [];
  }
  max = Math.min(max, cands.length); min = Math.min(min, max);
  if (min === max && min === cands.length && !extra.always) return cands.slice();
  const ans = yield* this.ask(pi, { kind: 'select', prompt, cands: cands.map(c => c.uid), min, max, reveal: extra.reveal ? cands.map(c => c.uid) : undefined, view });
  return ans.map(u => cands.find(c => c.uid === u));
};
P.option = function* (pi, prompt, options, meta) {
  return yield* this.ask(pi, { kind: 'option', prompt, options, meta });
};
P.yesno = function* (pi, prompt) { return (yield* this.option(pi, prompt, ['是', '否'])) === 0; };
P.chooseNum = function* (pi, prompt, lo, hi) {
  if (hi <= lo) return lo;
  const opts = []; for (let i = lo; i <= hi; i++) opts.push(String(i));
  return lo + (yield* this.option(pi, prompt, opts));
};

// ---------- 判定时点：规则处理 + 自动能力 ----------
P.ruleProcess = function* () {
  let changed = true;
  while (changed) {
    changed = false;
    // 败北（判定型）
    const lose = [0, 1].map(i => this.p[i].life <= 0 || this.p[i].deck.length === 0);
    if (lose[0] || lose[1]) {
      if (lose[0] && lose[1]) this.over = { winner: -1, reason: '双方同时败北，平局' };
      else { const l = lose[0] ? 0 : 1; this.over = { winner: 1 - l, reason: `${this.p[l].name} ${this.p[l].life <= 0 ? '生命归零' : '卡组耗尽'}` }; }
      this.say('游戏结束：' + this.over.reason);
      throw GAMEOVER;
    }
    // 致死伤害（同时）
    const dead = this.allBase().filter(c => (this.isPal(c) || this.isBld(c)) && c.damage > 0 && c.damage >= this.power(c));
    // 超额帕鲁（11.5）：保留最晚放置的帕鲁，其余由据点主体选择
    const excess = [];
    for (const pl of [this.p[this.active], this.p[1 - this.active]]) {
      const ps = pl.base.filter(c => this.isPal(c) && !dead.includes(c));
      if (ps.length > pl.palLimit) {
        const newest = Math.max(...ps.map(c => c.seq));
        const older = ps.filter(c => c.seq !== newest);
        const n = ps.length - pl.palLimit;
        const pick = yield* this.choose(pl.idx, older, n, n, `帕鲁超过上限，选择 ${n} 只放置入墓地`);
        excess.push(...pick);
      }
    }
    const all = [...dead, ...excess.filter(c => !dead.includes(c))];
    if (all.length) {
      for (const c of dead) this.say(`${this.cname(c)} 被破坏`);
      for (const c of excess) this.say(`${this.cname(c)} 因超过帕鲁上限被放置入墓地`);
      this.moveMany(all, 'grave', { cause: 'rule' });
      changed = true;
    }
  }
};
P.checkTiming = function* () {
  while (true) {
    yield* this.ruleProcess();
    let any = false;
    for (const pi of [this.active, 1 - this.active]) {
      const mine = this.queue.filter(q => q.ctrl === pi);
      if (!mine.length) continue;
      let q = mine[0];
      if (mine.length > 1 && pi !== undefined) {
        const i = yield* this.option(pi, '选择先解决的自动能力', mine.map(x => `${this.cname(x.card)}：${x.a.text || '自动能力'}${x.count > 1 ? ' ×' + x.count : ''}`));
        q = mine[i];
      }
      q.count--;
      if (q.count <= 0) this.queue.splice(this.queue.indexOf(q), 1);
      this.say(`${this.cname(q.card)} 的【自】能力发动`);
      yield* q.a.run(this, q.card, q.ctrl, q.ev, q);
      any = true; break;
    }
    if (!any) return;
  }
};
module.exports = { Game, GAMEOVER };
