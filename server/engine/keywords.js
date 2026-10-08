'use strict';
// 关键词能力（规则 12）
const { Game } = require('./core');
const P = Game.prototype;

P.kwAutos = {
  // 勇敢X：【攻击时】直至回合结束，此卡战斗力+X
  brave: v => ({ text: `勇敢${v}`, when: (g, ev, c) => ev.t === 'attack' && ev.card === c,
    run: function* (g, c) { g.addMod(c, { power: v }); } }),
  // 认真X：【任命时】选择1只帕鲁，直至回合结束战斗力+X
  serious: v => ({ text: `认真${v}`, when: (g, ev, c) => ev.t === 'assign' && ev.card === c,
    run: function* (g, c, pi) {
      const t = yield* g.choose(pi, g.pals(), 1, 1, `认真${v}：选择 1 只帕鲁，战斗力+${v}`);
      for (const x of t) g.addMod(x, { power: v });
    } }),
  // 警戒：你的回合结束时，将此卡竖置
  vigilance: () => ({ text: '警戒', when: (g, ev, c) => ev.t === 'turnEnd' && ev.pi === c.ctrl && c.zone === 'base',
    run: function* (g, c) { if (g.stand(c)) g.say(`${g.cname(c)} 因警戒竖置`); } }),
  // 复仇：此卡在战斗中被放置于墓地时，将战斗对手放置于墓地
  retaliate: () => ({ text: '复仇', when: (g, ev, c) => ev.t === 'toGrave' && ev.card === c && g.inBattle(c, ev.lki.inst),
    run: function* (g, c) {
      const B = g.battle; if (!B) return;
      const foe = c === B.att ? B.opp : B.att;
      const foeInst = c === B.att ? B.tInst : B.attInst;
      if (foe && g.same(foe, foeInst)) { g.say(`复仇：${g.cname(foe)} 被放置入墓地`); g.move(foe, 'grave'); }
    } }),
  // 突破：此卡攻击中战斗对手帕鲁被放置于墓地时，给予其主体等同打击力的伤害
  breakthrough: () => ({ text: '突破',
    when: (g, ev, c) => { const B = g.battle; return ev.t === 'toGrave' && B && B.att === c && (B.attInst === c.inst || (c.lki && c.lki.inst === B.attInst)) && B.opp === ev.card && ev.lki.inst === B.tInst; },
    run: function* (g, c, pi, ev) {
      const s = g.battle && g.battle.attStrikeSnap !== undefined ? g.battle.attStrikeSnap : g.strike(c);
      g.say(`突破：给予对手 ${s} 伤害`);
      if (s > 0) g.damagePlayer(ev.lki.ctrl, s);
    } }),
};

// 妨碍：【手牌】【快速】［①、丢弃此卡］或［丢弃此卡与另1张手牌］使对方的攻击失败
P.interruptAct = {
  name: '妨碍', zone: 'hand', quick: true, needsBattle: true,
  costs: [{ soul: 1, discardSelf: true }, { discardSelf: true, discard: 1 }],
  canUse: (g, c, pi) => g.battle && g.active !== pi,
  run: function* (g) { g.failAttack(); },
};
module.exports = {};
