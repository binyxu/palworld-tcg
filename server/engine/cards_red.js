'use strict';
const L = require('./cardlib');
const red = L.isColor('red');
const gear200 = L.gearAct(200);
module.exports = {
  'BP01-001': { name: '狂暴熔岩龙 腾炎龙', text: '【起】【1回合1次】［③］或者［丢弃2张手牌］将此卡竖置。',
    acts: [{ name: '竖置此卡', once: true, costs: [{ soul: 3 }, { discard: 2 }], run: function* (g, c, pi, p) { if (g.same(c, p.inst)) g.stand(c); } }] },
  'BP01-002': { name: '业火之翼 朱雀', redDmgBoost: true, text: '【永】你的红色卡片给予帕鲁战斗伤害以外的【伤害】时，作为替代给予+200的【伤害】（也强化自身能力）。\n【自】【登场时】选择至多1只帕鲁，给予700【伤害】。',
    autos: [L.onDeploy('选择至多1只帕鲁，给予700伤害', function* (g, c, pi) { yield* L.dmg(g, c, pi, 700); })] },
  'BP01-003': { name: '红色暴脾气 红小鲨', text: '【永】你的其他所有红色帕鲁【战斗力】+300。',
    statics: [{ power: (g, s, c) => c !== s && c.ctrl === s.ctrl && g.isPal(c) && red(c) ? 300 : 0 }] },
  'BP01-004': { name: '刹那之刃 浪刃武士', kw: { interrupt: true }, text: '【自】此卡进行攻击的战斗结束时，可以将此卡返回手牌。\n【起】妨碍（【手牌】【快速】［①、丢弃此卡］或者［丢弃此卡与其他1张手牌］使对方的攻击失败。不发生战斗伤害）',
    autos: [{ text: '战斗结束时可返回手牌', when: (g, ev, c) => ev.t === 'battleEnd' && ev.att === c && ev.attInst === c.inst,
      run: function* (g, c, pi) { if (c.zone === 'base' && (yield* g.yesno(pi, `是否将 ${g.cname(c)} 返回手牌？`))) L.bounce(g, c); } }] },
  'BP01-005': { name: '矿石暴食兽 熔岩兽', text: '【自】【登场时】获得3个【素材】。\n【起】【1回合1次】［消费3个【素材】］检视你的卡组顶5张卡，选择至多1张◇8以下的装备使其登场，其余与卡组洗切。',
    autos: [L.onDeploy('获得3个素材', function* (g, c, pi) { g.gain(pi, 'material', 3); })],
    acts: [{ name: '检视5张，装备登场', once: true, costs: [{ material: 3 }], run: function* (g, c, pi) {
      yield* L.lookPick(g, pi, 5, 1, x => x.def.kind === 'gear' && x.def.cost <= 8, '选择至多1张◇8以下的装备登场', function* (x) { yield* L.deploy(g, x, pi); });
    } }] },
  'BP01-006': { name: '勇气之火 火绒狐', kw: { brave: 300 }, text: '【自】勇敢300（【攻击时】直至回合结束，此卡【战斗力】+300）' },
  'BP01-007': { name: '屠龙之牙 苍焰狼', text: '【自】【登场时】选择至多1只◇7以上的帕鲁，给予1200【伤害】。',
    autos: [L.onDeploy('◇7以上帕鲁1200伤害', function* (g, c, pi) { yield* L.dmg(g, c, pi, 1200, { filter: L.cmpCost('>=', 7) }); })] },
  'BP01-008': { name: '危险勿碰 伏特喵', text: '【自】【登场时】选择至多1只竖置状态的帕鲁，给予500【伤害】。',
    autos: [L.onDeploy('竖置帕鲁500伤害', function* (g, c, pi) { yield* L.dmg(g, c, pi, 500, { filter: x => !x.rested }); })] },
  'BP01-009': { name: '勇猛迅雷 雷角马', kw: { brave: 300 }, text: '【自】勇敢300（【攻击时】直至回合结束，此卡【战斗力】+300）' },
  'BP01-010': { name: '炎击之翼 燧火鸟', text: '【自】【攻击时】选择你所有的红色帕鲁，直至回合结束，【战斗力】+500/【打击力】+1。',
    autos: [L.onAttack('所有红色帕鲁+500/+1', function* (g, c, pi) { for (const x of g.myPals(pi, red)) g.addMod(x, { power: 500, strike: 1 }); })] },
  'BP01-011': { name: '坚强火种 燎火鹿', kw: { serious: 400 }, text: '【自】认真400（【任命时】选择1只帕鲁，直至回合结束，【战斗力】+400）' },
  'BP01-012': { name: '灼热之泪 融焰娘', text: '【自】【登场时】获得2个【素材】。',
    autos: [L.onDeploy('获得2个素材', function* (g, c, pi) { g.gain(pi, 'material', 2); })] },
  'BP01-013': { name: '烈火骏马 火麒麟', text: '' },
  'BP01-014': { name: '挡路狱炎 狱焰王', kw: { interrupt: true }, text: '【起】妨碍（【手牌】【快速】［①、丢弃此卡］或者［丢弃此卡与其他1张手牌］使对方的攻击失败。不发生战斗伤害）' },
  'BP01-015': { name: '固定式机关枪', text: '【起】【1回合1次】［消费X个【素材】、任命1只帕鲁］执行X次〈选择1只帕鲁，给予500【伤害】。〉',
    acts: [{ name: 'X次500伤害', once: true, costs: [{ material: 'X', assign: 1 }], run: function* (g, c, pi, p) {
      for (let i = 0; i < p.x; i++) yield* L.dmg(g, c, pi, 500, { upTo: false, prompt: `第 ${i + 1}/${p.x} 次：选择1只帕鲁，给予500伤害` });
    } }] },
  'BP01-016': { name: '原始熔炉', text: '【起】【1回合1次】［任命1只帕鲁］获得3个【素材】，抽1张卡。\n【起】【1回合1次】［消费X个【素材】］直至回合结束，你下一次从手牌使用装备的费用减少X。不会因此能力变为◇0以下。',
    acts: [{ name: '获得3素材并抽1', once: true, costs: [{ assign: 1 }], run: function* (g, c, pi) { g.gain(pi, 'material', 3); g.draw(pi, 1); } },
      { name: '下一张装备费用-X', once: true, costs: [{ material: 'X' }], run: function* (g, c, pi, p) { g.p[pi].gearDiscount = { x: p.x, until: g.turnNo }; g.say(`下一张装备费用 -${p.x}`); } }] },
  'BP01-017': { name: '圣火台', text: '【永】你所有的红色帕鲁【战斗力】+200。\n【自】你的红色帕鲁登场时，获得1个【素材】。',
    statics: [{ power: (g, s, c) => c.ctrl === s.ctrl && g.isPal(c) && red(c) ? 200 : 0 }],
    autos: [{ text: '红色帕鲁登场时获得1素材', when: (g, ev, c) => ev.t === 'deploy' && g.isPal(ev.card) && red(ev.card) && ev.card.ctrl === c.ctrl, run: function* (g, c, pi) { g.gain(pi, 'material', 1); } }] },
  'BP01-018': { name: '警钟', text: '【起】【1回合1次】［①、任命1只帕鲁］将该回合中已任命的帕鲁全部竖置。直至回合结束，你无法用帕鲁进行任命，且须尽可能进行攻击（包括发动此能力后登场的帕鲁）。',
    acts: [{ name: '竖置已任命帕鲁', once: true, costs: [{ soul: 1, assign: 1 }], run: function* (g, c, pi) {
      for (const x of g.myPals(pi, x => x.assignedTurn === g.turnNo)) g.stand(x);
      g.p[pi].flags.noAssign = g.turnNo; g.p[pi].flags.mustAttack = g.turnNo;
    } }] },
  'BP01-019': { name: '火绒狐的背带', text: '【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200。若其主名称为《火绒狐》，直至回合结束，赋予其〈〉内的能力。〈【自】【攻击时】选择至多1只帕鲁，给予700【伤害】〉。',
    acts: [L.gearAct(200, function* (g, c, pi, t) {
      if (t && g.hasMain(t, '火绒狐')) t.grants.push({ until: g.turnNo, src: c, auto: L.onAttack('选择至多1只帕鲁，给予700伤害', function* (g2, x, pi2) { yield* L.dmg(g2, c, pi2, 700); }) });
    })] },
  'BP01-020': { name: '泵动式霰弹枪', text: '【自】【登场时】选择对方所有的帕鲁，给予1200【伤害】。\n【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200。',
    autos: [L.onDeploy('对方所有帕鲁1200伤害', function* (g, c, pi) { L.dmgAllOpp(g, c, pi, 1200); })], acts: [gear200] },
  'BP01-021': { name: '粗制手枪', text: '【自】【登场时】选择至多1只帕鲁，给予500【伤害】。\n【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200。',
    autos: [L.onDeploy('至多1只帕鲁500伤害', function* (g, c, pi) { yield* L.dmg(g, c, pi, 500); })], acts: [gear200] },
  'BP01-022': { name: '石镐', text: '【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200，获得1个【素材】。',
    acts: [L.gearAct(200, function* (g, c, pi) { g.gain(pi, 'material', 1); })] },
  'BP01-023': { name: '阿克塞尔的作战', text: '从以下选择1项。\n・选择1只帕鲁，给予1500【伤害】。\n・选择至多X只帕鲁，将其竖置。X为你的装备数量。\n・选择对方所有◇5以上的帕鲁，直至回合结束，其无法阻挡。',
    play: function* (g, c, pi) {
      const i = yield* g.option(pi, '阿克塞尔的作战：选择1项', ['1只帕鲁1500伤害', `竖置至多X只帕鲁（X=${g.p[pi].base.filter(g.isGear).length}）`, '对方◇5以上帕鲁无法阻挡']);
      if (i === 0) yield* L.dmg(g, c, pi, 1500, { upTo: false });
      else if (i === 1) { const x = g.p[pi].base.filter(g.isGear).length; const ts = yield* g.choose(pi, g.pals(), 0, x, `选择至多 ${x} 只帕鲁竖置`, { always: true }); for (const t of ts) g.stand(t); }
      else for (const t of g.opPals(pi, L.cmpCost('>=', 5))) g.addMod(t, { noBlock: true });
    } },
  'BP01-024': { name: '发现宝箱！', text: '检视你的卡组顶5张卡，选择至多1张红色的建筑物或红色的装备加入手牌，其余与卡组洗切。选择了0张时，获得3个【素材】。',
    play: function* (g, c, pi) {
      const pk = yield* L.lookPick(g, pi, 5, 1, x => red(x) && (x.def.kind === 'building' || x.def.kind === 'gear'), '选择至多1张红色建筑物/装备加入手牌', function* (x) { L.toHand(g, x); });
      if (!pk.length) g.gain(pi, 'material', 3);
    } },
  'TD01-001': { name: '暴走重战车 暴电熊', kw: { assault: true }, text: '【永】袭击（此卡可以选择处于竖置状态的帕鲁作为攻击目标）' },
  'TD01-002': { name: '刺激又纯真 电棘鼠', text: '' },
  'TD01-003': { name: '熔岩好天气 火灵儿', text: '' },
  'TD01-004': { name: '暖烘烘抱抱 火绒狐', kw: { interrupt: true }, text: '【起】妨碍（【手牌】【快速】［①、丢弃此卡］或者［丢弃此卡与其他1张手牌］使对方的攻击失败。不发生战斗伤害）' },
  'TD01-005': { name: '热腾腾的掉落物 炽焰牛', text: '【自】【登场时】获得2个【素材】。',
    autos: [L.onDeploy('获得2个素材', function* (g, c, pi) { g.gain(pi, 'material', 2); })] },
  'TD01-006': { name: '特攻队长 雷胖达', text: '【起】［消费2个【素材】］直至回合结束，此卡【战斗力】+500。',
    acts: [{ name: '战斗力+500', costs: [{ material: 2 }], run: function* (g, c, pi, p) { if (g.same(c, p.inst)) g.addMod(c, { power: 500 }); } }] },
  'TD01-007': { name: '统御熔岩者 焰煌', text: '【自】【登场时】选择至多1只帕鲁，给予1000【伤害】。',
    autos: [L.onDeploy('至多1只帕鲁1000伤害', function* (g, c, pi) { yield* L.dmg(g, c, pi, 1000); })] },
  'TD01-008': { name: '采石场', text: '【起】【1回合1次】［任命1只帕鲁］获得3个【素材】，抽1张卡。（可以通过横置你竖置的帕鲁进行任命）',
    acts: [{ name: '获得3素材并抽1', once: true, costs: [{ assign: 1 }], run: function* (g, c, pi) { g.gain(pi, 'material', 3); g.draw(pi, 1); } }] },
  'TD01-009': { name: '武器工作台', text: '【起】【1回合1次】［消费1个【素材】、任命1只帕鲁］选择至多1只帕鲁，给予800【伤害】。选择你所有的帕鲁，直至回合结束【打击力】+1。',
    acts: [{ name: '800伤害并全体打击力+1', once: true, costs: [{ material: 1, assign: 1 }], run: function* (g, c, pi) {
      yield* L.dmg(g, c, pi, 800); for (const x of g.myPals(pi)) g.addMod(x, { strike: 1 });
    } }] },
  'TD01-010': { name: '单发步枪', text: '【自】【登场时】选择至多1只帕鲁，给予1500【伤害】。\n【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200。',
    autos: [L.onDeploy('至多1只帕鲁1500伤害', function* (g, c, pi) { yield* L.dmg(g, c, pi, 1500); })], acts: [gear200] },
  'TD01-011': { name: '火焰吐息', text: '【快速】选择1只帕鲁，给予500【伤害】。',
    play: function* (g, c, pi) { yield* L.dmg(g, c, pi, 500, { upTo: false }); } },
  'SS01-001': { name: '倾泻电击 暴电熊', text: '【自】【登场时】选择对方所有的帕鲁，给予300【伤害】。',
    autos: [L.onDeploy('对方所有帕鲁300伤害', function* (g, c, pi) { L.dmgAllOpp(g, c, pi, 300); })] },
};
