'use strict';
// 费用：灵魂/丢弃/横置自身/消费资源/任命/解体/卡组顶送墓
// alt 字段: soul, discard(数字|'X'), discardSelf, discardBuilding, restSelf, material(数字|'X'),
//          ingredient(数字|'X'), assign(数字), butcher(数字), butcherOther, mill
const { Game } = require('./core');
const P = Game.prototype;

P.assignable = function (pi, bld) {
  if (this.p[pi].flags.noAssign === this.turnNo) return [];
  return this.myPals(pi, c => !c.rested && c !== bld);
};
P.costText = function (alt) {
  const t = [];
  if (alt.soul) t.push(`支付${alt.soul}灵魂`);
  if (alt.restSelf) t.push('横置此卡');
  if (alt.discardSelf) t.push('丢弃此卡');
  if (alt.discard) t.push(alt.discard === 'X' ? '丢弃X张手牌' : `丢弃${alt.discard}张${alt.discardSelf ? '其他' : ''}手牌`);
  if (alt.discardBuilding) t.push('丢弃1张手牌中的建筑物');
  if (alt.material !== undefined) t.push(alt.material === 'X' ? '消费X个素材' : `消费${alt.material}个素材`);
  if (alt.ingredient !== undefined) t.push(alt.ingredient === 'X' ? '消费X个食材' : `消费${alt.ingredient}个食材`);
  if (alt.assign) t.push(`任命${alt.assign}只帕鲁`);
  if (alt.butcher) t.push(`解体${alt.butcher}只${alt.butcherOther ? '其他' : ''}帕鲁`);
  if (alt.mill) t.push(`将卡组顶${alt.mill}张放置入墓地`);
  return t.join('、') || '无费用';
};
P.canPay = function (c, pi, alt) {
  const pl = this.p[pi];
  if (alt.soul && this.untapSouls(pi) < alt.soul) return false;
  if (alt.restSelf && (c.zone !== 'base' || c.rested)) return false;
  const handOthers = pl.hand.filter(h => h !== c).length;
  if (alt.discardSelf && c.zone !== 'hand') return false;
  if (typeof alt.discard === 'number' && handOthers < alt.discard) return false;
  if (alt.discardBuilding && !pl.hand.some(h => h.def.kind === 'building' && h !== c)) return false;
  if (typeof alt.material === 'number' && pl.material < alt.material) return false;
  if (typeof alt.ingredient === 'number' && pl.ingredient < alt.ingredient) return false;
  if (alt.assign && this.assignable(pi, c).length < alt.assign) return false;
  if (alt.butcher && this.myPals(pi, x => !alt.butcherOther || x !== c).length < alt.butcher) return false;
  if (alt.mill && pl.deck.length < alt.mill) return false;
  return true;
};
// 返回 {x, assigned:[], butchered:[]}
P.payCost = function* (c, pi, alt, label) {
  const pl = this.p[pi]; const paid = { x: 0, assigned: [], butchered: [] };
  if (alt.material === 'X') paid.x = yield* this.chooseNum(pi, `${label}：消费几个素材（X）？`, 0, pl.material);
  if (alt.ingredient === 'X') paid.x = yield* this.chooseNum(pi, `${label}：消费几个食材（X）？`, 0, pl.ingredient);
  if (alt.discard === 'X') paid.x = yield* this.chooseNum(pi, `${label}：丢弃几张手牌（X）？`, 0, Math.min(pl.hand.length, this.myPals(pi).length));
  if (alt.soul) this.paySouls(pi, alt.soul);
  if (alt.restSelf) c.rested = true;
  if (alt.discardSelf) this.move(c, 'grave');
  const nd = alt.discard === 'X' ? paid.x : alt.discard;
  if (nd) {
    const ds = yield* this.choose(pi, pl.hand.filter(h => h !== c), nd, nd, `${label}：选择要丢弃的 ${nd} 张手牌`, { always: true });
    for (const d of ds) this.move(d, 'grave');
  }
  if (alt.discardBuilding) {
    const ds = yield* this.choose(pi, pl.hand.filter(h => h.def.kind === 'building'), 1, 1, `${label}：选择要丢弃的建筑物`, { always: true });
    for (const d of ds) this.move(d, 'grave');
  }
  if (alt.material !== undefined) pl.material -= alt.material === 'X' ? paid.x : alt.material;
  if (alt.ingredient !== undefined) pl.ingredient -= alt.ingredient === 'X' ? paid.x : alt.ingredient;
  if (alt.mill) { for (let i = 0; i < alt.mill; i++) if (pl.deck[0]) this.move(pl.deck[0], 'grave'); this.say(`${pl.name} 将卡组顶 ${alt.mill} 张放置入墓地`); }
  if (alt.assign) {
    const as = yield* this.choose(pi, this.assignable(pi, c), alt.assign, alt.assign, `${label}：选择要任命的帕鲁`, { always: true });
    for (const a of as) {
      a.rested = true; a.assignedTurn = this.turnNo; paid.assigned.push(a);
      this.say(`${this.cname(a)} 被任命至 ${this.cname(c)}`);
      this.emit({ t: 'assign', card: a, bld: c });
    }
  }
  if (alt.butcher) {
    const bs = yield* this.choose(pi, this.myPals(pi, x => !alt.butcherOther || x !== c), alt.butcher, alt.butcher, `${label}：选择要解体的帕鲁`, { always: true });
    for (const b of bs) paid.butchered.push(this.butcher(b, pi));
  }
  return paid;
};
// 解体：返回离场信息
P.butcher = function (card, pi) {
  const cost = card.def.cost;
  this.say(`${this.cname(card)} 被解体`);
  this.move(card, 'grave', { cause: 'butcher' });
  this.emit({ t: 'butcher', card, cost, pi }, [card]);
  return { card, cost };
};
module.exports = {};
