'use strict';
const L = require('./cardlib');
const gear200 = L.gearAct(200);
const NOSTAND_WHILE = c => ({ type: 'while', srcUid: c.uid, srcInst: c.inst });
module.exports = {
  'BP01-025': { name: '唤龙之声 疾旋鼬', text: '【自】【登场时】公开你的卡组顶1张卡，若其为◇8以下的【龙】属性帕鲁，可以使其登场。不使其登场的场合，将其加入手牌。',
    autos: [L.onDeploy('公开顶1张，龙属性帕鲁可登场', function* (g, c, pi) {
      const t = g.p[pi].deck[0]; if (!t) return; L.reveal(g, [t]);
      if (g.isPal(t) && t.def.cost <= 8 && t.def.types.includes('龙') && (yield* g.yesno(pi, `是否使 ${g.cname(t)} 登场？`))) yield* L.deploy(g, t, pi);
      else L.toHand(g, t);
    })] },
  'BP01-026': { name: '饿饿射手 佩克龙', text: '【自】【登场时】选择至多1只◇6以下的帕鲁，将其横置。只要此卡在据点，其不竖置。',
    autos: [L.onDeploy('◇6以下帕鲁横置且不竖置', function* (g, c, pi) { yield* L.restUpTo(g, pi, 1, L.cmpCost('<=', 6), NOSTAND_WHILE(c)); })] },
  'BP01-027': { name: '逆卷海龙 覆海龙', text: '【自】【登场时】抽1张卡，选择至多1只◇7以下的帕鲁，将其横置。其在下一个对方的竖置阶段中不竖置。',
    autos: [L.onDeploy('抽1，◇7以下帕鲁横置', function* (g, c, pi) { g.draw(pi, 1); yield* L.restUpTo(g, pi, 1, L.cmpCost('<=', 7), 'next'); })] },
  'BP01-028': { name: '憧憬天空 企丸丸', text: '【自】此卡被放置于墓地时，抽1张卡。',
    autos: [L.onGrave('被放置于墓地时抽1', function* (g, c, pi) { g.draw(pi, 1); })] },
  'BP01-029': { name: '水龙之舞 碧海龙', text: '【自】【登场时】抽1张卡，选择至多1只帕鲁，将其横置。',
    autos: [L.onDeploy('抽1，横置至多1只帕鲁', function* (g, c, pi) { g.draw(pi, 1); yield* L.restUpTo(g, pi, 1); })] },
  'BP01-030': { name: '冰霜的暴食兽 寒霜兽', text: '【自】【登场时】抽1张卡。\n【起】【1回合1次】［丢弃1张手牌］检视你的卡组顶5张卡，选择至多2张◇6以下的建筑物使其登场，其余与卡组洗切。',
    autos: [L.onDeploy('抽1张卡', function* (g, c, pi) { g.draw(pi, 1); })],
    acts: [{ name: '检视5张，建筑物登场', once: true, costs: [{ discard: 1 }], run: function* (g, c, pi) {
      const pk = [];
      yield* L.lookPick(g, pi, 5, 2, x => x.def.kind === 'building' && x.def.cost <= 6, '选择至多2张◇6以下的建筑物登场', function* (x) { pk.push(x); });
      g.moveMany(pk, 'base', { ctrl: pi }); for (const x of pk) g.say(`${g.cname(x)} 登场`);
    } }] },
  'BP01-031': { name: '大海原的大战士 企丸王', text: '【永】你所有主名称为《企丸丸》的帕鲁【战斗力】+700。',
    statics: [{ power: (g, s, c) => c.ctrl === s.ctrl && g.isPal(c) && g.hasMain(c, '企丸丸') ? 700 : 0 }] },
  'BP01-032': { name: '兴致冲浪手 冲浪鸭', text: '【自】此卡被攻击时，直至回合结束，此卡【战斗力】+300。',
    autos: [{ text: '被攻击时战斗力+300', when: (g, ev, c) => ev.t === 'attacked' && ev.card === c, run: function* (g, c) { g.addMod(c, { power: 300 }); } }] },
  'BP01-033': { name: '雪山看守者 白绒雪怪', text: '【永】此卡处于横置状态时，对方所有帕鲁【打击力】-1。',
    statics: [{ strike: (g, s, c) => s.rested && g.isPal(c) && c.ctrl !== s.ctrl ? -1 : 0 }] },
  'BP01-034': { name: '倾注元气 壶小象', kw: { serious: 400 }, text: '【自】认真400（【任命时】选择1只帕鲁，直至回合结束，【战斗力】+400）' },
  'BP01-035': { name: '招财进宝 冰丝特', text: '【自】此卡被任命至「牧场」的建筑物时，抽1张卡。',
    autos: [{ text: '任命至牧场时抽1', when: (g, ev, c) => ev.t === 'assign' && ev.card === c && L.isRanch(ev.bld), run: function* (g, c, pi) { g.draw(pi, 1); } }] },
  'BP01-036': { name: '翻身回旋 鲁米儿', text: '【自】【攻击时】抽1张卡，选择你的1张手牌丢弃。',
    autos: [L.onAttack('抽1弃1', function* (g, c, pi) { g.draw(pi, 1); const d = yield* g.choose(pi, g.p[pi].hand, 1, 1, '选择1张手牌丢弃', { always: true }); for (const x of d) g.move(x, 'grave'); })] },
  'BP01-037': { name: '畅游泳者 滑水蛇', text: '' },
  'BP01-038': { name: '冰冻试炼 冰棘兽', kw: { interrupt: true }, text: '【起】妨碍（【手牌】【快速】［①、丢弃此卡］或者［丢弃此卡与其他1张手牌］使对方的攻击失败。不发生战斗伤害）' },
  'BP01-039': { name: '古典式窗帘', text: '【自】【登场时】选择至多X只对方的帕鲁，将其返回手牌。X为你的卡名中含有《古典式》的建筑物中不同卡名的数量。',
    autos: [L.onDeploy('返回对方至多X只帕鲁', function* (g, c, pi) {
      const x = g.distinctCount(g.p[pi].base.filter(b => g.isBld(b) && g.namesOf(b).some(n => n.includes('アンティーク'))));
      const ts = yield* g.choose(pi, g.opPals(pi), 0, x, `选择至多 ${x} 只对方帕鲁返回手牌`, { always: true });
      g.moveMany(ts, 'hand'); for (const t of ts) g.say(`${g.cname(t)} 返回手牌`);
    })] },
  'BP01-040': { name: '古典式化妆台', text: '【起】【1回合1次】［丢弃1张手牌］宣言1个卡名。选择你所有的卡片，直至回合结束，追加被宣言的卡名。\n【起】【1回合1次】［丢弃X张手牌］选择你的X只帕鲁，直至回合结束，【战斗力】+1000/【打击力】+1。',
    acts: [{ name: '宣言卡名', once: true, costs: [{ discard: 1 }], run: function* (g, c, pi) {
      const names = [...new Set(Object.values(g.db).filter(d => d && d.ja).map(d => d.ja))];
      const i = yield* g.option(pi, '宣言1个卡名', names.map(n => g.db._byJa[n].name));
      for (const x of g.p[pi].base) x.names.push(names[i]);
      g.say(`宣言卡名：${g.db._byJa[names[i]].name}`);
    } }, { name: 'X只帕鲁+1000/+1', once: true, costs: [{ discard: 'X' }], run: function* (g, c, pi, p) {
      const ts = yield* g.choose(pi, g.myPals(pi), p.x, p.x, `选择你的 ${p.x} 只帕鲁`);
      for (const t of ts) g.addMod(t, { power: 1000, strike: 1 });
    } }] },
  'BP01-041': { name: '温泉', text: '【起】【1回合1次】［任命1只帕鲁］选择至多2只◇6以下的帕鲁，将其横置。其在下一个对方的竖置阶段中不竖置。',
    acts: [{ name: '横置至多2只帕鲁', once: true, costs: [{ assign: 1 }], run: function* (g, c, pi) { yield* L.restUpTo(g, pi, 2, L.cmpCost('<=', 6), 'next'); } }] },
  'BP01-042': { name: '古典式镜子', text: '【自】【登场时】抽1张卡。', autos: [L.onDeploy('抽1张卡', function* (g, c, pi) { g.draw(pi, 1); })] },
  'BP01-043': { name: '帕鲁球工作台', text: '【起】【1回合1次】［任命1只帕鲁］抽2张卡，选择你的1张手牌丢弃。',
    acts: [{ name: '抽2弃1', once: true, costs: [{ assign: 1 }], run: function* (g, c, pi) {
      g.draw(pi, 2); const d = yield* g.choose(pi, g.p[pi].hand, 1, 1, '选择1张手牌丢弃', { always: true }); for (const x of d) g.move(x, 'grave');
    } }] },
  'BP01-044': { name: '企丸丸的火箭发射器', text: '【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200。若其主名称为《企丸丸》，作为替代【战斗力】+500，并直至回合结束赋予其〈〉内的能力。〈【起】［横置此卡］选择对方所有的帕鲁，给予X【伤害】。X为此卡的【战斗力】。将此卡放置于墓地〉。',
    acts: [{ name: '选择1只帕鲁强化', costs: [{ restSelf: true }], run: function* (g, c, pi) {
      const ts = yield* g.choose(pi, g.pals(), 1, 1, '选择1只帕鲁（企丸丸则+500并获得能力）');
      const t = ts[0]; if (!t) return;
      if (g.hasMain(t, '企丸丸')) {
        g.addMod(t, { power: 500 });
        t.grants.push({ until: g.turnNo, act: { name: '火箭发射', costs: [{ restSelf: true }], run: function* (g2, x, pi2, p) {
          const amt = g2.power(x); L.dmgAllOpp(g2, x, pi2, amt); if (g2.same(x, p.inst)) L.toGrave(g2, x);
        } } });
      } else g.addMod(t, { power: 200 });
    } }] },
  'BP01-045': { name: '抓钩枪', text: '【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200，并赋予其〈〉内的能力。〈【自】警戒（你的回合结束时，将此卡竖置）〉。',
    acts: [L.gearAct(200, function* (g, c, pi, t) { if (t) t.grants.push({ until: g.turnNo, kw: { vigilance: 1 } }); })] },
  'BP01-046': { name: '维克托的作战', text: '从以下选择1项。\n・检视你的卡组顶5张卡，选择1张加入手牌，其余与卡组洗切。\n・选择1只帕鲁，将其返回手牌。\n・抽X张卡。X为你的建筑物数量。',
    play: function* (g, c, pi) {
      const x = g.p[pi].base.filter(b => g.isBld(b)).length;
      const i = yield* g.option(pi, '维克托的作战：选择1项', ['检视5张选1加入手牌', '1只帕鲁返回手牌', `抽X张（X=${x}）`]);
      if (i === 0) yield* L.lookPick(g, pi, 5, 1, null, '选择1张加入手牌', function* (y) { L.toHand(g, y); }, { min: 1, revealPick: false });
      else if (i === 1) { const ts = yield* g.choose(pi, g.pals(), 1, 1, '选择1只帕鲁返回手牌'); for (const t of ts) L.bounce(g, t); }
      else g.draw(pi, x);
    } },
  'BP01-047': { name: '帕鲁球', text: '抽3张卡。', play: function* (g, c, pi) { g.draw(pi, 3); } },
  'BP01-048': { name: '极光的指引', text: '【快速】抽1张卡，选择至多1张你的手牌，将其放置于卡组顶。',
    play: function* (g, c, pi) { g.draw(pi, 1); const d = yield* g.choose(pi, g.p[pi].hand, 0, 1, '选择至多1张手牌放置于卡组顶', { always: true }); for (const x of d) g.move(x, 'deck', { top: true }); } },
  'TD01-012': { name: '温柔波纹 水灵龙', text: '【自】【登场时】抽2张卡，选择你的1张手牌，将其放置于卡组顶。',
    autos: [L.onDeploy('抽2，1张放回卡组顶', function* (g, c, pi) { g.draw(pi, 2); const d = yield* g.choose(pi, g.p[pi].hand, 1, 1, '选择1张手牌放置于卡组顶', { always: true }); for (const x of d) g.move(x, 'deck', { top: true }); })] },
  'TD01-013': { name: '固执又纯真 冰刺鼠', text: '' },
  'TD01-014': { name: '飞得远的炮弹 企丸丸', text: '' },
  'TD01-015': { name: '冻夜徘徊 冰缚灵', text: '【自】【登场时】选择至多1只◇3以下的帕鲁，将其横置。',
    autos: [L.onDeploy('◇3以下帕鲁横置', function* (g, c, pi) { yield* L.restUpTo(g, pi, 1, L.cmpCost('<=', 3)); })] },
  'TD01-016': { name: '冰冷眼神 严冬鹿', kw: { interrupt: true }, text: '【起】妨碍（【手牌】【快速】［①、丢弃此卡］或者［丢弃此卡与其他1张手牌］使对方的攻击失败。不发生战斗伤害）' },
  'TD01-017': { name: '流水之理 清雀', kw: { vigilance: 1 }, text: '【自】警戒（你的回合结束时，将此卡竖置）' },
  'TD01-018': { name: '冰原轰鸣者 雪猛犸', text: '【永】你每有1张建筑物，此卡【战斗力】+200。\n【起】［丢弃1张手牌中的建筑物］直至回合结束，此卡【打击力】+1。',
    statics: [{ power: (g, s, c) => c === s ? 200 * g.p[s.ctrl].base.filter(b => g.isBld(b)).length : 0 }],
    acts: [{ name: '打击力+1', costs: [{ discardBuilding: true }], run: function* (g, c, pi, p) { if (g.same(c, p.inst)) g.addMod(c, { strike: 1 }); } }] },
  'TD01-019': { name: '古典式木椅', text: '【自】【登场时】选择至多1只帕鲁，直至回合结束【战斗力】+1000。',
    autos: [L.onDeploy('至多1只帕鲁+1000', function* (g, c, pi) { yield* L.buff(g, pi, { power: 1000 }, { upTo: true }); })] },
  'TD01-020': { name: '原始工作台', text: '【起】【1回合1次】［任命1只帕鲁］公开你的卡组顶1张卡，若其为◇6以下的建筑物或装备，可以使其登场。不使其登场的场合，将其加入手牌。',
    acts: [{ name: '公开顶1张', once: true, costs: [{ assign: 1 }], run: function* (g, c, pi) {
      const t = g.p[pi].deck[0]; if (!t) return; L.reveal(g, [t]);
      if ((t.def.kind === 'building' || t.def.kind === 'gear') && t.def.cost <= 6 && (yield* g.yesno(pi, `是否使 ${g.cname(t)} 登场？`))) yield* L.deploy(g, t, pi);
      else L.toHand(g, t);
    } }] },
  'TD01-021': { name: '单发式帕鲁球发射器', text: '【自】【登场时】抽1张卡。\n【起】［横置此卡］选择1只帕鲁，直至回合结束【战斗力】+200。',
    autos: [L.onDeploy('抽1张卡', function* (g, c, pi) { g.draw(pi, 1); })], acts: [gear200] },
  'TD01-022': { name: '寒冰吐息', text: '【快速】选择1只帕鲁，直至回合结束【打击力】-3。其在下一个对方的竖置阶段中不竖置。',
    play: function* (g, c, pi) {
      const ts = yield* g.choose(pi, g.pals(), 1, 1, '选择1只帕鲁，打击力-3');
      for (const t of ts) { g.addMod(t, { strike: -3 }); t.noStand.push({ type: 'nextStand', pi: 1 - pi }); }
    } },
  'SS01-002': { name: '收尾冰刃 疾旋鼬', text: '【自】此卡的战斗对手帕鲁被放置于墓地时，抽1张卡。',
    autos: [{ text: '战斗对手被放置于墓地时抽1', when: (g, ev, c) => { const B = g.battle; if (!B || ev.t !== 'toGrave') return false;
      return (B.att === c && B.opp === ev.card && ev.lki.inst === B.tInst) || (B.opp === c && B.att === ev.card && ev.lki.inst === B.attInst); },
      run: function* (g, c, pi) { g.draw(pi, 1); } }] },
};
