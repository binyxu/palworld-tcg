'use strict';
const L = require('./cardlib');
const NOCT = '【永】夜行性（若为黑夜，此卡【战斗力】+300）';
const NIGHT_ACT = { name: '变为黑夜', once: true, costs: [{ mill: 3 }], run: function* (g, c, pi) { g.setNight(g.untilOppNext(pi)); } };
const hasNoct = (g, c) => (g.kw(c).nocturnal || 0) > 0;
module.exports = {
  'BP01-073': { name: '暗夜之翼 雷冥鸟', kw: { nocturnal: 1 }, text: NOCT + '\n【自】你持有〈夜行性〉的帕鲁登场时，若为黑夜，选择至多1只费用在其费用以下的帕鲁，放置于墓地。若放置了1张以上，该回合结束时，将此卡横置。',
    autos: [{ text: '夜行性帕鲁登场时，破坏帕鲁', when: (g, ev, c) => ev.t === 'deploy' && g.isPal(ev.card) && ev.card.ctrl === c.ctrl && hasNoct(g, ev.card),
      run: function* (g, c, pi, ev) {
        if (!g.isNight()) return;
        const cost = ev.card.def.cost;
        const ts = yield* g.choose(pi, g.pals(x => x.def.cost <= cost), 0, 1, `选择至多1只费用◇${cost}以下的帕鲁放置于墓地`, { always: true });
        for (const t of ts) L.toGrave(g, t);
        if (ts.length) { const inst = c.inst, turn = g.turnNo; g.delayed.push({ card: c, ctrl: pi, text: '回合结束时横置此卡', when: (g2, e2) => e2.t === 'turnEnd' && g2.turnNo === turn, run: function* (g2) { if (g2.same(c, inst)) g2.rest(c); } }); }
      } }] },
  'BP01-074': { name: '绝望的基因 异构格里芬', nightWhileRested: true, doubleAuto: true, text: '【永】此卡处于横置状态期间，为黑夜。\n【永】若为黑夜，你的帕鲁的【自】发动2次。\n【自】你的回合结束时，选择至多1只你的帕鲁，将其解体。若解体了1张以上，对方选择1只自己的帕鲁，放置于墓地。',
    autos: [L.onMyTurnEnd('回合结束时解体', function* (g, c, pi) {
      const ts = yield* g.choose(pi, g.myPals(pi), 0, 1, '选择至多1只你的帕鲁解体', { always: true });
      for (const t of ts) g.butcher(t, pi);
      if (ts.length) { const os = yield* g.choose(1 - pi, g.myPals(1 - pi), 1, 1, '选择你的1只帕鲁放置于墓地'); for (const o of os) L.toGrave(g, o); }
    })] },
  'BP01-075': { name: '深渊魔导师 暗巫猫', text: '【起】【1回合1次】［解体1只其他帕鲁］直至回合结束，此卡【战斗力】+1000/【打击力】+1。\n【自】你的帕鲁被解体时，选择至多1只你墓地中费用为X的普通帕鲁，以横置状态登场。X为被解体帕鲁的费用-1。',
    acts: [{ name: '+1000/+1', once: true, costs: [{ butcher: 1, butcherOther: true }], run: function* (g, c, pi, p) { if (g.same(c, p.inst)) g.addMod(c, { power: 1000, strike: 1 }); } }],
    autos: [{ text: '帕鲁被解体时，墓地普通帕鲁登场', when: (g, ev, c) => ev.t === 'butcher' && ev.pi === (c.zone === 'base' ? c.ctrl : c.lki && c.lki.ctrl),
      run: function* (g, c, pi, ev) {
        const x = ev.cost - 1;
        const ts = yield* g.choose(pi, g.p[pi].grave.filter(y => g.isPal(y) && !y.def.lucky && y.def.cost === x), 0, 1, `选择至多1只墓地中费用◇${x}的普通帕鲁横置登场`, { always: true });
        for (const t of ts) yield* L.deploy(g, t, pi, { rested: true });
      } }] },
  'BP01-076': { name: '就在那里！？ 猫蝠怪', text: '【自】【登场时】公开你的卡组顶3张卡，选择至多1只帕鲁加入手牌，其余放置于墓地。',
    autos: [L.onDeploy('公开3张选帕鲁', function* (g, c, pi) {
      const cs = L.top(g, pi, 3); L.reveal(g, cs);
      const pk = yield* g.choose(pi, cs.filter(x => g.isPal(x)), 0, 1, '选择至多1只帕鲁加入手牌', { always: true, view: cs });
      for (const x of pk) L.toHand(g, x);
      for (const x of cs) if (!pk.includes(x)) g.move(x, 'grave');
    })] },
  'BP01-077': { name: '苍炎骏马 邪麒麟', kw: { nocturnal: 1, interrupt: true }, text: NOCT + '\n【起】妨碍（【手牌】【快速】［①、丢弃此卡］或者［丢弃此卡与其他1张手牌］使对方的攻击失败。不发生战斗伤害）' },
  'BP01-078': { name: '女神的冥加 黑月女王', text: '【起】［横置此卡、丢弃1张手牌］选择你墓地中1只◇6以下的帕鲁，以横置状态登场。',
    acts: [{ name: '墓地帕鲁登场', costs: [{ restSelf: true, discard: 1 }], run: function* (g, c, pi) {
      const ts = yield* g.choose(pi, g.p[pi].grave.filter(x => g.isPal(x) && x.def.cost <= 6), 1, 1, '选择墓地中1只◇6以下帕鲁横置登场');
      for (const t of ts) yield* L.deploy(g, t, pi, { rested: true });
    } }] },
  'BP01-079': { name: '晚上才动真格 瞅什魔', kw: { nocturnal: 2 }, text: NOCT + '\n' + NOCT },
  'BP01-080': { name: '梦的开始 寐魔', kw: { nocturnal: 1 }, text: NOCT },
  'BP01-081': { name: '偷心贼 博爱蜥', text: '【自】【攻击时】可以丢弃你的1张手牌。若丢弃了，获得1点生命。',
    autos: [L.onAttack('可弃1张，生命+1', function* (g, c, pi) {
      const d = yield* g.choose(pi, g.p[pi].hand, 0, 1, '可以丢弃1张手牌（生命+1）', { always: true });
      for (const x of d) g.move(x, 'grave'); if (d.length) g.gainLife(pi, 1);
    })] },
  'BP01-082': { name: '梦的延续 寐魔', kw: { nocturnal: 1 }, text: NOCT },
  'BP01-083': { name: '天空袭击者 烽歌龙', text: '【自】【登场时】选择至多1只帕鲁，直至回合结束【战斗力】-300（【战斗力】降至0以下也不会被放置于墓地）。',
    autos: [L.onDeploy('至多1只帕鲁-300', function* (g, c, pi) { yield* L.buff(g, pi, { power: -300 }, { upTo: true }); })] },
  'BP01-084': { name: '潜伏暗中的蝎 冥铠蝎', kw: { retaliate: 1 }, text: '【自】复仇（此卡在战斗中被放置于墓地时，将战斗对手的帕鲁放置于墓地）\n【自】此卡被放置于墓地时，选择至多1只你墓地中的普通帕鲁，返回手牌。',
    autos: [L.onGrave('墓地普通帕鲁返回手牌', function* (g, c, pi) {
      const ts = yield* g.choose(pi, g.p[pi].grave.filter(x => g.isPal(x) && !x.def.lucky), 0, 1, '选择至多1只墓地普通帕鲁返回手牌', { always: true });
      for (const t of ts) L.toHand(g, t);
    })] },
  'BP01-085': { name: '逢魔时的使者 噬魂兽', nightWhileRested: true, text: '【永】此卡处于横置状态期间，为黑夜。\n【永】若为黑夜，对方所有帕鲁【战斗力】-200（【战斗力】降至0以下也不会被放置于墓地）。',
    statics: [{ power: (g, s, c) => g.isPal(c) && c.ctrl !== s.ctrl && g.isNight() ? -200 : 0 }] },
  'BP01-086': { name: '沉默的孩子 露娜蒂', text: '' },
  'BP01-087': { name: '闪耀月光 月镰魔', text: '【自】【登场时】若为黑夜，选择至多1只竖置状态的◇6以下的帕鲁，放置于墓地。',
    autos: [L.onDeploy('黑夜时破坏竖置帕鲁', function* (g, c, pi) {
      if (!g.isNight()) return;
      const ts = yield* g.choose(pi, g.pals(x => !x.rested && x.def.cost <= 6), 0, 1, '选择至多1只竖置的◇6以下帕鲁放置于墓地', { always: true });
      for (const t of ts) L.toGrave(g, t);
    })] },
  'BP01-088': { name: '固定式电灯', text: '【起】【1回合1次】［将卡组顶3张放置于墓地］直至下一个对方的回合结束，变为黑夜。\n【永】赋予你所有的帕鲁〈〉内的能力。〈' + NOCT + '〉。',
    acts: [NIGHT_ACT], statics: [{ grantKw: (g, s, c) => g.isPal(c) && c.ctrl === s.ctrl ? { nocturnal: 1 } : null }] },
  'BP01-089': { name: '劣质床', text: '【起】【1回合1次】［将卡组顶3张放置于墓地］直至下一个对方的回合结束，变为黑夜。\n【自】你的回合结束时，若你有横置状态的持有〈夜行性〉的帕鲁，抽1张卡。',
    acts: [NIGHT_ACT], autos: [L.onMyTurnEnd('回合结束时抽1', function* (g, c, pi) { if (g.myPals(pi, x => x.rested && hasNoct(g, x)).length) g.draw(pi, 1); })] },
  'BP01-090': { name: '中世纪制药台', text: '【起】【1回合1次】［③、任命1只帕鲁］选择你墓地中1只费用X以下的帕鲁，以横置状态登场。X为任命的帕鲁费用+2。',
    acts: [{ name: '墓地帕鲁登场', once: true, costs: [{ soul: 3, assign: 1 }], run: function* (g, c, pi, p) {
      const x = (p.assigned[0] ? p.assigned[0].def.cost : 0) + 2;
      const ts = yield* g.choose(pi, g.p[pi].grave.filter(y => g.isPal(y) && y.def.cost <= x), 1, 1, `选择墓地中1只费用◇${x}以下的帕鲁横置登场`);
      for (const t of ts) yield* L.deploy(g, t, pi, { rested: true });
    } }] },
  'BP01-091': { name: '木墙', kw: { taunt: true }, text: '【永】嘲讽（对方在可能的情况下，须选择此卡作为攻击目标）\n【自】此卡被放置于墓地时，抽1张卡。',
    autos: [L.onGrave('被放置于墓地时抽1', function* (g, c, pi) { g.draw(pi, 1); })] },
  'BP01-092': { name: '观赏用笼子', text: '【起】【1回合1次】［任命1只帕鲁］将任命的帕鲁放逐。选择1只费用X以下的帕鲁，将其放逐。X为任命的帕鲁费用+2。\n【自】此卡离开据点时，将此卡放逐中的帕鲁全部返回所有者的手牌。',
    acts: [{ name: '放逐帕鲁', once: true, costs: [{ assign: 1 }], run: function* (g, c, pi, p) {
      const a = p.assigned[0]; const x = (a ? a.def.cost : 0) + 2;
      if (a && a.zone === 'base') { g.move(a, 'exile'); a.exiledBy = { uid: c.uid, inst: c.inst }; g.say(`${g.cname(a)} 被放逐`); }
      const ts = yield* g.choose(pi, g.pals(y => y.def.cost <= x), 1, 1, `选择1只费用◇${x}以下帕鲁放逐`);
      for (const t of ts) { g.move(t, 'exile'); t.exiledBy = { uid: c.uid, inst: c.inst }; g.say(`${g.cname(t)} 被放逐`); }
    } }],
    autos: [{ text: '离开据点时返回被放逐帕鲁', when: (g, ev, c) => ev.t === 'leave' && ev.card === c,
      run: function* (g, c, pi, ev) { for (const pl of g.p) for (const x of [...pl.exile]) if (x.exiledBy && x.exiledBy.uid === c.uid && x.exiledBy.inst === ev.lki.inst) L.bounce(g, x); } }] },
  'BP01-093': { name: '切肉刀', text: '【起】［横置此卡、解体1只帕鲁］公开你的卡组顶3张卡，选择1张加入手牌，其余放置于墓地。',
    acts: [{ name: '公开3张选1', costs: [{ restSelf: true, butcher: 1 }], run: function* (g, c, pi) {
      const cs = L.top(g, pi, 3); L.reveal(g, cs);
      const pk = yield* g.choose(pi, cs, 1, 1, '选择1张加入手牌', { always: true, view: cs });
      for (const x of pk) L.toHand(g, x);
      for (const x of cs) if (!pk.includes(x)) g.move(x, 'grave');
    } }] },
  'BP01-094': { name: '寐魔的项圈', text: '【自】【登场时】选择至多1只你手牌中主名称为《寐魔》的帕鲁，使其登场。\n【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200。直至下一个对方的回合结束，变为黑夜。',
    autos: [L.onDeploy('手牌中寐魔登场', function* (g, c, pi) {
      const ts = yield* g.choose(pi, g.p[pi].hand.filter(x => g.isPal(x) && x.def.main === '寐魔'), 0, 1, '选择至多1只手牌中的寐魔登场', { always: true });
      for (const t of ts) yield* L.deploy(g, t, pi);
    })],
    acts: [L.gearAct(200, function* (g, c, pi) { g.setNight(g.untilOppNext(pi)); }, '战斗力+200并变为黑夜')] },
  'BP01-095': { name: '佐伊的作战', text: '从以下选择1项。\n・选择对方的【素材】与【食材】合计至多5个，对方失去它们。\n・选择至多1只你墓地中的帕鲁，返回手牌。对方选择自己的1张手牌丢弃。\n・选择你的1只帕鲁，将其解体。若解体了1张以上，选择对方的1只帕鲁，放置于墓地。',
    play: function* (g, c, pi) {
      const i = yield* g.option(pi, '佐伊的作战：选择1项', ['对方失去至多5个素材/食材', '墓地帕鲁回手，对方弃1张', '解体1只己方帕鲁，破坏对方1只帕鲁']);
      const op = g.p[1 - pi];
      if (i === 0) {
        const m = yield* g.chooseNum(pi, '让对方失去几个【素材】？', 0, Math.min(5, op.material));
        const n = yield* g.chooseNum(pi, '让对方失去几个【食材】？', 0, Math.min(5 - m, op.ingredient));
        op.material -= m; op.ingredient -= n; g.say(`${op.name} 失去 ${m} 素材、${n} 食材`);
      } else if (i === 1) {
        const ts = yield* g.choose(pi, g.p[pi].grave.filter(x => g.isPal(x)), 0, 1, '选择至多1只墓地帕鲁返回手牌', { always: true });
        for (const t of ts) L.toHand(g, t);
        const d = yield* g.choose(1 - pi, op.hand, 1, 1, '选择你的1张手牌丢弃', { always: true }); for (const x of d) g.move(x, 'grave');
      } else {
        const ts = yield* g.choose(pi, g.myPals(pi), 1, 1, '选择你的1只帕鲁解体');
        for (const t of ts) g.butcher(t, pi);
        if (ts.length) { const os = yield* g.choose(pi, g.opPals(pi), 1, 1, '选择对方1只帕鲁放置于墓地'); for (const o of os) L.toGrave(g, o); }
      }
    } },
  'BP01-096': { name: '暗黑炮', text: '【快速】选择1只◇5以下的帕鲁，放置于墓地。',
    play: function* (g, c, pi) { const ts = yield* g.choose(pi, g.pals(L.cmpCost('<=', 5)), 1, 1, '选择1只◇5以下帕鲁放置于墓地'); for (const t of ts) L.toGrave(g, t); } },
  'BP01-097': { name: '黑市商人', text: '选择至多2只你墓地中不持有〈妨碍〉的帕鲁，返回手牌。直至下一个对方的回合结束，变为黑夜。',
    play: function* (g, c, pi) {
      const ts = yield* g.choose(pi, g.p[pi].grave.filter(x => g.isPal(x) && !(x.def.kw && x.def.kw.interrupt)), 0, 2, '选择至多2只墓地帕鲁返回手牌', { always: true });
      for (const t of ts) L.toHand(g, t); g.setNight(g.untilOppNext(pi));
    } },
  'TD02-012': { name: '唤死铠龙 魔渊龙', text: '【自】【登场时】选择至多1只帕鲁，直至回合结束【战斗力】-1000（【战斗力】降至0以下也不会被放置于墓地）。\n【自】【攻击时】选择【战斗力】300以下的所有帕鲁，放置于墓地（也选择你的帕鲁）。',
    autos: [L.onDeploy('至多1只帕鲁-1000', function* (g, c, pi) { yield* L.buff(g, pi, { power: -1000 }, { upTo: true }); }),
      L.onAttack('战斗力300以下的帕鲁全部破坏', function* (g, c) { const ts = g.pals(x => g.power(x) <= 300); for (const t of ts) g.say(`${g.cname(t)} 被放置入墓地`); g.moveMany(ts, 'grave'); })] },
  'TD02-013': { name: '睿智结晶 啼卡尔', text: '' },
  'TD02-014': { name: '宝藏预感 朋克蜥', text: '【自】此卡被放置于墓地时，对方选择自己的1张手牌丢弃。',
    autos: [L.onGrave('对方弃1张', function* (g, c, pi) { const d = yield* g.choose(1 - pi, g.p[1 - pi].hand, 1, 1, '选择你的1张手牌丢弃', { always: true }); for (const x of d) g.move(x, 'grave'); })] },
  'TD02-015': { name: '暗中活跃之影 黑鸦隐士', kw: { stealth: true }, text: '【永】隐秘（此卡无法被阻挡）' },
  'TD02-016': { name: '埋伏的猎人 炎魔羊', text: '' },
  'TD02-017': { name: '挡路黑炎 狱阎王', kw: { interrupt: true }, text: '【起】妨碍（【手牌】【快速】［①、丢弃此卡］或者［丢弃此卡与其他1张手牌］使对方的攻击失败。不发生战斗伤害）' },
  'TD02-018': { name: '盗命者 夜幕魔蝠', kw: { stealth: true }, text: '【永】隐秘（此卡无法被阻挡）\n【自】【攻击时】获得1点生命。',
    autos: [L.onAttack('生命+1', function* (g, c, pi) { g.gainLife(pi, 1); })] },
  'TD02-019': { name: '悬吊陷阱', text: '【起】【1回合1次】［任命1只帕鲁］若此卡放逐的帕鲁不在放逐区域，选择1只帕鲁，将其放逐。\n【自】此卡离开据点时，将此卡放逐的帕鲁以横置状态在其所有者的据点登场。',
    acts: [{ name: '放逐1只帕鲁', once: true, costs: [{ assign: 1 }], run: function* (g, c, pi) {
      if (g.p.some(pl => pl.exile.some(x => x.exiledBy && x.exiledBy.uid === c.uid && x.exiledBy.inst === c.inst))) return;
      const ts = yield* g.choose(pi, g.pals(), 1, 1, '选择1只帕鲁放逐');
      for (const t of ts) { g.move(t, 'exile'); t.exiledBy = { uid: c.uid, inst: c.inst }; g.say(`${g.cname(t)} 被放逐`); }
    } }],
    autos: [{ text: '离开据点时被放逐帕鲁登场', when: (g, ev, c) => ev.t === 'leave' && ev.card === c,
      run: function* (g, c, pi, ev) { for (const pl of g.p) for (const x of [...pl.exile]) if (x.exiledBy && x.exiledBy.uid === c.uid && x.exiledBy.inst === ev.lki.inst) yield* L.deploy(g, x, x.owner, { rested: true }); } }] },
  'TD02-020': { name: '黑鸦隐士帽', text: '【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200，并赋予其〈〉内的能力。〈【永】隐秘（此卡无法被阻挡）〉。',
    acts: [L.gearAct(200, function* (g, c, pi, t) { if (t) t.grants.push({ until: g.turnNo, kw: { stealth: true } }); })] },
  'TD02-021': { name: '来自黑暗的一击', text: '选择1只帕鲁，放置于墓地。',
    play: function* (g, c, pi) { const ts = yield* g.choose(pi, g.pals(), 1, 1, '选择1只帕鲁放置于墓地'); for (const t of ts) L.toGrave(g, t); } },
  'TD02-022': { name: '医药品', text: '选择你墓地中1只◇8以下的帕鲁，以横置状态登场。',
    play: function* (g, c, pi) { const ts = yield* g.choose(pi, g.p[pi].grave.filter(x => g.isPal(x) && x.def.cost <= 8), 1, 1, '选择墓地中1只◇8以下帕鲁横置登场'); for (const t of ts) yield* L.deploy(g, t, pi, { rested: true }); } },
  'SS01-003': { name: '深夜的认真 瞅什魔', kw: { nocturnal: 1 }, text: NOCT + '\n【自】【登场时】若为黑夜，选择至多1张建筑物，直至回合结束【耐久力】-500（【耐久力】降至0以下也不会被放置于墓地）。',
    autos: [L.onDeploy('黑夜时建筑物耐久-500', function* (g, c, pi) {
      if (!g.isNight()) return;
      const ts = yield* g.choose(pi, g.allBase().filter(x => g.isBld(x)), 0, 1, '选择至多1张建筑物耐久力-500', { always: true });
      for (const t of ts) g.addMod(t, { power: -500 });
    })] },
};
