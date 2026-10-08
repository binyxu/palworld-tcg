'use strict';
const L = require('./cardlib');
module.exports = {
  'BP01-098': { name: '温柔光辉 精灵龙', text: '【自】【攻击时】可以公开你的1张手牌。若公开了【龙】属性的帕鲁，直至回合结束，此卡【战斗力】+500。',
    autos: [L.onAttack('可公开手牌龙帕鲁+500', function* (g, c, pi) {
      const d = yield* g.choose(pi, g.p[pi].hand, 0, 1, '可以公开1张手牌（龙属性帕鲁则+500）', { always: true });
      for (const x of d) { L.reveal(g, [x]); if (g.isPal(x) && x.def.types.includes('龙')) g.addMod(c, { power: 500 }); }
    })] },
  'BP01-099': { name: '高傲之牙 猎狼', text: '' },
  'BP01-100': { name: '冒险的开始', text: '若你在本局游戏中没有使用过其他卡片，抽2张卡。\n若你的卡名中含有《起始》且卡名互不相同的帕鲁有3种以上，选择你所有的帕鲁，直至回合结束【战斗力】+1000/【打击力】+5。',
    play: function* (g, c, pi, ctx) {
      if (ctx.prevPlayed === 0) g.draw(pi, 2);
      // Q97：宣言追加的卡名不计入
      const ps = g.myPals(pi, x => x.def.ja.includes('始まりの'));
      const kinds = new Set(ps.map(x => x.def.ja));
      if (kinds.size >= 3) for (const x of g.myPals(pi)) g.addMod(x, { power: 1000, strike: 5 });
    } },
  'TD01-023': { name: '起始帕鲁 棉悠悠', text: '【永】此卡不会被◇4以上的帕鲁攻击。',
    statics: [{ notAttackedBy: (g, s, att) => att.def.cost >= 4 }] },
  'TD01-024': { name: '小小公主 姬小兔', text: '【自】此卡被放置于墓地时，获得1个【素材】。',
    autos: [L.onGrave('获得1素材', function* (g, c, pi) { g.gain(pi, 'material', 1); })] },
  'TD02-023': { name: '起始帕鲁 捣蛋猫', text: '【永】此卡不会被◇3以下的帕鲁攻击。',
    statics: [{ notAttackedBy: (g, s, att) => att.def.cost <= 3 }] },
  'TD02-024': { name: '起始帕鲁 皮皮鸡', text: '【自】此卡被放置于墓地时，获得1个【食材】。',
    autos: [L.onGrave('获得1食材', function* (g, c, pi) { g.gain(pi, 'ingredient', 1); })] },
  'SS01-004': { name: '自信满满 捣蛋猫', text: '【永】你的灵魂在5张以上时，此卡【战斗力】+200。\n【永】你的灵魂在10张以上时，此卡【战斗力】+200。',
    statics: [{ power: (g, s, c) => c === s ? (g.p[s.ctrl].souls.length >= 5 ? 200 : 0) + (g.p[s.ctrl].souls.length >= 10 ? 200 : 0) : 0 }] },
  'SS01-005': { name: '翼龙的吐息 天羽龙', text: '【自】此卡攻击帕鲁或建筑物时，选择至多1张帕鲁或建筑物，给予700【伤害】。',
    autos: [{ text: '攻击帕鲁/建筑物时700伤害', when: (g, ev, c) => ev.t === 'attack' && ev.card === c && ev.target !== 'player',
      run: function* (g, c, pi) { yield* L.dmg(g, c, pi, 700, { kinds: ['pal', 'building'], prompt: '选择至多1张帕鲁或建筑物，给予700伤害' }); } }] },
};
