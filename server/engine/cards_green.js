'use strict';
const L = require('./cardlib');
const TAUNT = '【永】嘲讽（对方在可能的情况下，须选择此卡作��攻击目标）';
const BREAK = { kw: { breakthrough: 1 } };
module.exports = {
  'BP01-049': { name: '女神的祝福 百合女王', text: '【自】【登场时】获得3个【食材】。\n【起】【1回合1次】［消费3个【食材】］检视你的卡组顶5张卡，选择至多1只◇6以下的帕鲁使其登场，其余与卡组洗切。',
    autos: [L.onDeploy('获得3个食材', function* (g, c, pi) { g.gain(pi, 'ingredient', 3); })],
    acts: [{ name: '检视5张，帕鲁登场', once: true, costs: [{ ingredient: 3 }], run: function* (g, c, pi) {
      yield* L.lookPick(g, pi, 5, 1, x => g.isPal(x) && x.def.cost <= 6, '选择至多1只◇6以下的帕鲁登场', function* (x) { yield* L.deploy(g, x, pi); });
    } }] },
  'BP01-050': { name: '轰鸣刚矛 碎岩龟', text: '【永】你的灵魂在10张以上时，此卡【战斗力】+1000/【打击力】+1。\n【起】【1回合1次】［消费2个【食材】］直至回合结束，此卡【战斗力】+500，并获得〈〉内的能力。〈【自】突破（此卡攻击中战斗对手的帕鲁被放置于墓地时，也给予对方玩家【伤害】）〉。',
    statics: [{ power: (g, s, c) => c === s && g.p[s.ctrl].souls.length >= 10 ? 1000 : 0, strike: (g, s, c) => c === s && g.p[s.ctrl].souls.length >= 10 ? 1 : 0 }],
    acts: [{ name: '+500并获得突破', once: true, costs: [{ ingredient: 2 }], run: function* (g, c, pi, p) { if (g.same(c, p.inst)) { g.addMod(c, { power: 500 }); c.grants.push({ until: g.turnNo, ...BREAK }); } } }] },
  'BP01-051': { name: '甜蜜祝福 花丽娜', text: '【自】【登场时】获得1点生命，选择2张灵魂，将其竖置。',
    autos: [L.onDeploy('生命+1，竖置2灵魂', function* (g, c, pi) { g.gainLife(pi, 1); g.standSouls(pi, 2); })] },
  'BP01-052': { name: '猪突粉碎 草莽猪', text: '【自】此卡攻击建筑物时，直至回合结束，此卡【战斗力】+800。',
    autos: [{ text: '攻击建筑物时+800', when: (g, ev, c) => ev.t === 'attack' && ev.card === c && ev.target !== 'player' && g.isBld(ev.target), run: function* (g, c) { g.addMod(c, { power: 800 }); } }] },
  'BP01-053': { name: '花园女王 女皇蜂', text: '【永】你每有1只主名称为《骑士蜂》的帕鲁，此卡【战斗力】+300。\n【起】［消费1个【食材】］检视你的卡组顶1张卡，若其为主名称为《骑士蜂》的帕鲁，可以将费用减少◇2来使用。不会因此能力变为◇0以下。',
    statics: [{ power: (g, s, c) => c === s ? 300 * g.myPals(s.ctrl, x => g.hasMain(x, '骑士蜂')).length : 0 }],
    acts: [{ name: '检视顶1张骑士蜂', costs: [{ ingredient: 1 }], run: function* (g, c, pi) {
      const t = g.p[pi].deck[0]; if (!t) return;
      g.say(`${g.p[pi].name} 检视了卡组顶的卡`);
      const cost = Math.max(1, t.def.cost - 2);
      if (g.isPal(t) && g.hasMain(t, '骑士蜂') && g.untapSouls(pi) >= cost && (yield* g.yesno(pi, `顶牌是 ${g.cname(t)}，是否支付 ${cost} 灵魂使用？`))) yield* g.playCard(t, pi, { cost, fromDeck: true });
    } }] },
  'BP01-054': { name: '黑铁要塞 铠格力斯', kw: { taunt: true }, text: TAUNT },
  'BP01-055': { name: '魅惑花旦 薇莉塔', text: '【起】【1回合1次】［丢弃1张手牌］若此卡在该回合中被任命过，将此卡竖置。',
    acts: [{ name: '竖置此卡', once: true, costs: [{ discard: 1 }], canUse: (g, c) => true, run: function* (g, c, pi, p) { if (g.same(c, p.inst) && c.assignedTurn === g.turnNo) g.stand(c); } }] },
  'BP01-056': { name: '期待的新人 翠叶鼠', text: '' },
  'BP01-057': { name: '醇厚恩惠 趴趴鲶', text: '【自】【登场时】获得2个【食材】。\n【自】此卡被任命至「牧场」的建筑物时，以横置状态增加你的1张灵魂。',
    autos: [L.onDeploy('获得2个食材', function* (g, c, pi) { g.gain(pi, 'ingredient', 2); }),
      { text: '任命至牧场时增加1灵魂', when: (g, ev, c) => ev.t === 'assign' && ev.card === c && L.isRanch(ev.bld), run: function* (g, c, pi) { if (g.addSoul(pi, 1, true)) g.say('灵魂 +1（横置）'); } }] },
  'BP01-058': { name: '不可思议的树液 叶泥泥', text: '【自】【登场时】直至回合结束，此卡【战斗力】+300，并获得〈〉内的能力。〈【永】袭击（此卡可以选择处于竖置状态的帕鲁作为攻击目标）〉。',
    autos: [L.onDeploy('+300并获得袭击', function* (g, c) { if (c.zone !== 'base') return; g.addMod(c, { power: 300 }); c.grants.push({ until: g.turnNo, kw: { assault: true } }); })] },
  'BP01-059': { name: '低吼锐矛 碎岩龟', text: '【起】【1回合1次】［消费2个【食材】］直至回合结束，此卡【战斗力】+500，并获得〈〉内的能力。〈【自】突破（此卡攻击中战斗对手的帕鲁被放置于墓地时，也给予对方玩家【伤害】）〉。',
    acts: [{ name: '+500并获得突破', once: true, costs: [{ ingredient: 2 }], run: function* (g, c, pi, p) { if (g.same(c, p.inst)) { g.addMod(c, { power: 500 }); c.grants.push({ until: g.turnNo, ...BREAK }); } } }] },
  'BP01-060': { name: '欢乐工人 新叶猿', kw: { serious: 400 }, text: '【自】认真400（【任命时】选择1只帕鲁，直至回合结束，【战斗力】+400）' },
  'BP01-061': { name: '花园骑士 骑士蜂', anyNumber: true, text: '【永】与此卡同名的卡片，可以在卡组中投入任意张数。\n【自】【登场时】获得1个【食材】。若你有「牧场」的建筑物，直至回合结束，此卡【战斗力】+500。',
    autos: [L.onDeploy('获得1食材，有牧场则+500', function* (g, c, pi) { g.gain(pi, 'ingredient', 1); if (g.p[pi].base.some(L.isRanch)) g.addMod(c, { power: 500 }); })] },
  'BP01-062': { name: '南国看守者 绿苔绒怪', kw: { interrupt: true }, text: '【起】妨碍（【手牌】【快速】［①、丢弃此卡］或者［丢弃此卡与其他1张手牌］使对方的攻击失败。不发生战斗伤害）' },
  'BP01-063': { name: '配种牧场', text: '【起】【1回合1次】［消费2个【食材】］公开你的卡组顶1张卡，若其为◇8以下的帕鲁则加入手牌，否则放置于墓地。\n【起】【1回合1次】［消费2个【食材】、任命2只帕鲁］从你的手牌中选择1只◇8以下的帕鲁，使其登场。',
    acts: [{ name: '公开顶1张', once: true, costs: [{ ingredient: 2 }], run: function* (g, c, pi) {
      const t = g.p[pi].deck[0]; if (!t) return; L.reveal(g, [t]);
      if (g.isPal(t) && t.def.cost <= 8) L.toHand(g, t); else L.toGrave(g, t);
    } }, { name: '手牌帕鲁登场', once: true, costs: [{ ingredient: 2, assign: 2 }], run: function* (g, c, pi) {
      const ts = yield* g.choose(pi, g.p[pi].hand.filter(x => g.isPal(x) && x.def.cost <= 8), 1, 1, '选择手牌中1只◇8以下的帕鲁登场');
      for (const t of ts) yield* L.deploy(g, t, pi);
    } }] },
  'BP01-064': { name: '可乐自动售货机', text: '【起】【1回合1次】［消费X个【食材】、任命1只帕鲁］选择1张灵魂，将其竖置。并且，选择至多X的3倍张数的灵魂，将其竖置。',
    acts: [{ name: '竖置灵魂', once: true, costs: [{ ingredient: 'X', assign: 1 }], run: function* (g, c, pi, p) { const k = g.standSouls(pi, 1 + 3 * p.x); g.say(`竖置了 ${k} 张灵魂`); } }] },
  'BP01-065': { name: '饲料箱', text: '【起】【1回合1次】［消费1个【食材】］以横置状态增加你的1张灵魂。增加前的灵魂在10张以上时，选择2张灵魂，将其竖置。',
    acts: [{ name: '增加1灵魂', once: true, costs: [{ ingredient: 1 }], run: function* (g, c, pi) {
      const before = g.p[pi].souls.length; g.addSoul(pi, 1, true);
      if (before >= 10) g.standSouls(pi, 2);
    } }] },
  'BP01-066': { name: '家畜牧场', text: '【起】【1回合1次】［任命1只帕鲁］获得【素材】或【食材】中任意一种3个，抽1张卡。',
    acts: [{ name: '获得3资源并抽1', once: true, costs: [{ assign: 1 }], run: function* (g, c, pi) { yield* L.chooseRes(g, pi, 3); g.draw(pi, 1); } }] },
  'BP01-067': { name: '帕鲁禁止通行的道路标识', text: '【起】【1回合1次】［任命1只帕鲁］直至下一个对方的回合结束，赋予任命至此卡的帕鲁〈〉内的能力。〈' + TAUNT + '〉。',
    acts: [{ name: '赋予嘲讽', once: true, costs: [{ assign: 1 }], run: function* (g, c, pi, p) { for (const a of p.assigned) if (a.zone === 'base') a.grants.push({ until: g.untilOppNext(pi), kw: { taunt: true } }); } }] },
  'BP01-068': { name: '碎岩龟的头巾', text: '【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200。若其主名称为《碎岩龟》，获得【素材】或【食材】中任意一种2个。',
    acts: [L.gearAct(200, function* (g, c, pi, t) { if (t && g.hasMain(t, '碎岩龟')) yield* L.chooseRes(g, pi, 2); })] },
  'BP01-069': { name: '农业帽子', text: '【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200，获得1个【食材】。',
    acts: [L.gearAct(200, function* (g, c, pi) { g.gain(pi, 'ingredient', 1); })] },
  'BP01-070': { name: '莉莉的作战', text: '从以下选择1项。\n・选择你所有的帕鲁，直至回合结束【战斗力】+1000。\n・选择1张建筑物或装备，将其放置于墓地。\n・以横置状态增加你的1张灵魂。',
    play: function* (g, c, pi) {
      const i = yield* g.option(pi, '莉莉的作战：选择1项', ['你所有帕鲁+1000', '1张建筑物/装备放置于墓地', '增加1灵魂（横置）']);
      if (i === 0) for (const x of g.myPals(pi)) g.addMod(x, { power: 1000 });
      else if (i === 1) { const ts = yield* g.choose(pi, g.allBase().filter(x => g.isBld(x) || g.isGear(x)), 1, 1, '选择1张建筑物或装备'); for (const t of ts) L.toGrave(g, t); }
      else g.addSoul(pi, 1, true);
    } },
  'BP01-071': { name: '发现帕鲁蛋！', text: '检视你的卡组顶5张卡，选择至多1只帕鲁加入手牌，其余与卡组洗切。选择了0张时，获得3个【食材】。',
    play: function* (g, c, pi) {
      const pk = yield* L.lookPick(g, pi, 5, 1, x => g.isPal(x), '选择至多1只帕鲁加入手牌', function* (x) { L.toHand(g, x); });
      if (!pk.length) g.gain(pi, 'ingredient', 3);
    } },
  'BP01-072': { name: '花精灵的祝福', text: '获得1点生命，抽1张卡。', play: function* (g, c, pi) { g.gainLife(pi, 1); g.draw(pi, 1); } },
  'TD02-001': { name: '亲卫队长 叶胖达', text: '' },
  'TD02-002': { name: '梦见双叶 叶泥泥', text: '' },
  'TD02-003': { name: '点心时间 波娜兔', text: '【自】【登场时】获得2个【食材】。', autos: [L.onDeploy('获得2个食材', function* (g, c, pi) { g.gain(pi, 'ingredient', 2); })] },
  'TD02-004': { name: '华丽香气 花冠龙', kw: { interrupt: true }, text: '【起】妨碍（【手牌】【快速】［①、丢弃此卡］或者［丢弃此卡与其他1张手牌］使对方的攻击失败。不发生战斗伤害）' },
  'TD02-005': { name: '自然守护者 祇岳鹿', kw: { taunt: true }, text: TAUNT + '\n【起】［消费2个【食材】］直至回合结束，此卡【战斗力】+500。',
    acts: [{ name: '战斗力+500', costs: [{ ingredient: 2 }], run: function* (g, c, pi, p) { if (g.same(c, p.inst)) g.addMod(c, { power: 500 }); } }] },
  'TD02-006': { name: '满溢爱情 连理龙', kw: { taunt: true }, text: TAUNT },
  'TD02-007': { name: '大地轰鸣者 森猛犸', text: '【自】此卡被放置于墓地时，获得3个【食材】。', autos: [L.onGrave('被放置于墓地时获得3食材', function* (g, c, pi) { g.gain(pi, 'ingredient', 3); })] },
  'TD02-008': { name: '浆果农园', text: '【起】【1回合1次】［任命1只帕鲁］获得3个【食材】，抽1张卡。（可以通过横置你竖置的帕鲁进行任命）',
    acts: [{ name: '获得3食材并抽1', once: true, costs: [{ assign: 1 }], run: function* (g, c, pi) { g.gain(pi, 'ingredient', 3); g.draw(pi, 1); } }] },
  'TD02-009': { name: '营火', text: '【起】【1回合1次】［消费2个【食材】、任命1只帕鲁］你获得1点生命，选择你所有的帕鲁，直至回合结束【战斗力】+1000。',
    acts: [{ name: '生命+1，全体+1000', once: true, costs: [{ ingredient: 2, assign: 1 }], run: function* (g, c, pi) { g.gainLife(pi, 1); for (const x of g.myPals(pi)) g.addMod(x, { power: 1000 }); } }] },
  'TD02-010': { name: '精炼金属长枪', text: '【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+900。', acts: [L.gearAct(900)] },
  'TD02-011': { name: '岩石冲击', text: '【快速】选择1只帕鲁，直至回合结束【战斗力】+500。', play: function* (g, c, pi) { yield* L.buff(g, pi, { power: 500 }); } },
};
