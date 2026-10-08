'use strict';
// 卡牌效果辅助函数
const L = {};
L.onDeploy = (text, run) => ({ text: '【登场时】' + text, when: (g, ev, c) => ev.t === 'deploy' && ev.card === c, run });
L.onAttack = (text, run) => ({ text: '【攻击时】' + text, when: (g, ev, c) => ev.t === 'attack' && ev.card === c, run });
L.onAssign = (text, run) => ({ text: '【任命时】' + text, when: (g, ev, c) => ev.t === 'assign' && ev.card === c, run });
L.onGrave = (text, run) => ({ text, when: (g, ev, c) => ev.t === 'toGrave' && ev.card === c, run });
L.onMyTurnEnd = (text, run) => ({ text, when: (g, ev, c) => ev.t === 'turnEnd' && ev.pi === c.ctrl && c.zone === 'base', run });

// 选择至多 n 只满足条件的帕鲁，给予 amt 伤害
L.dmg = function* (g, src, pi, amt, { n = 1, upTo = true, filter, prompt, kinds = ['pal'] } = {}) {
  const cands = g.allBase().filter(c => kinds.includes(c.def.kind) && (!filter || filter(c)));
  const ts = yield* g.choose(pi, cands, upTo ? 0 : n, n, prompt || `选择${upTo ? '至多' : ''} ${n} 张，给予 ${amt} 伤害`, { always: upTo });
  for (const t of ts) g.dealDamage(src, pi, t, amt);
  return ts;
};
L.dmgAllOpp = (g, src, pi, amt) => { for (const t of g.opPals(pi)) g.dealDamage(src, pi, t, amt); };
L.buff = function* (g, pi, mod, { n = 1, upTo = false, filter, prompt } = {}) {
  const ts = yield* g.choose(pi, g.pals(filter), upTo ? 0 : n, n, prompt || '选择帕鲁', { always: upTo });
  for (const t of ts) g.addMod(t, mod);
  return ts;
};
L.restUpTo = function* (g, pi, n, filter, noStand) {
  const ts = yield* g.choose(pi, g.pals(filter), 0, n, `选择至多 ${n} 只帕鲁横置`, { always: true });
  for (const t of ts) {
    g.rest(t); g.say(`${g.cname(t)} 被横置`);
    if (noStand === 'next') t.noStand.push({ type: 'nextStand', pi: 1 - pi });
    else if (noStand) t.noStand.push(noStand);
  }
  return ts;
};
// 检视卡组顶 n 张（返回卡数组，仍在卡组中）
L.top = (g, pi, n) => g.p[pi].deck.slice(0, n);
L.reveal = (g, cards, who) => {
  if (!cards.length) return;
  g.say(`${who || ''}公开：${cards.map(c => g.cname(c)).join('、')}`);
  // 公开事件：双方客户端都会播放翻牌展示
  const pi = g.p.findIndex(p => p.deck.includes(cards[0]) || p.hand.includes(cards[0]));
  const from = pi >= 0 && g.p[pi].hand.includes(cards[0]) ? 'hand' : 'deck';
  (g.reveals || (g.reveals = [])).push({ n: g.reveals.length + 1, pi: pi < 0 ? (cards[0].owner ?? 0) : pi, from, cards: cards.map(c => ({ uid: c.uid, id: c.id })) });
};
// 检视顶 n 张，选择至多 k 张满足条件的卡执行 fn，其余洗回
L.lookPick = function* (g, pi, n, k, filter, prompt, fn, { min = 0, revealPick = true } = {}) {
  const cards = L.top(g, pi, n);
  const ok = cards.filter(c => !filter || filter(c));
  const pick = yield* g.choose(pi, ok, Math.min(min, ok.length), k, prompt + `（检视：${cards.map(c => g.cname(c)).join('、') || '无'}）`, { always: true, reveal: true, view: cards });
  if (revealPick) L.reveal(g, pick, '');
  for (const c of pick) yield* fn(c);
  g.shuffle(g.p[pi].deck);
  return pick;
};
L.deploy = function* (g, c, pi, opt = {}) {
  g.move(c, 'base', { ctrl: pi, rested: !!opt.rested });
  g.say(`${g.cname(c)} 登场${opt.rested ? '（横置）' : ''}`);
};
L.toHand = (g, c) => { g.move(c, 'hand'); g.say(`${g.cname(c)} 加入手牌`); };
L.toGrave = (g, c) => { g.move(c, 'grave'); g.say(`${g.cname(c)} 被放置入墓地`); };
L.bounce = (g, c) => { g.move(c, 'hand'); g.say(`${g.cname(c)} 返回手牌`); };
// 横置此卡的装备通用能力：选择1只帕鲁战斗力+n
L.gearAct = (n, extra, name) => ({
  name: name || `选择1只帕鲁战斗力+${n}`, costs: [{ restSelf: true }],
  run: function* (g, c, pi, paid) {
    const ts = yield* g.choose(pi, g.pals(), 1, 1, `选择 1 只帕鲁，直至回合结束战斗力+${n}`);
    for (const t of ts) g.addMod(t, { power: n });
    if (extra) yield* extra(g, c, pi, ts[0], paid);
  },
});
L.cmpCost = (op, x) => c => op === '<=' ? c.def.cost <= x : c.def.cost >= x;
L.chooseRes = function* (g, pi, n) {
  const i = yield* g.option(pi, `获得 ${n} 个素材或食材`, [`${n} 个【素材】`, `${n} 个【食材】`]);
  g.gain(pi, i === 0 ? 'material' : 'ingredient', n);
};
L.night = g => g.isNight();
L.isColor = col => c => c.def.color === col;
// 「牧场」建筑物
L.isRanch = c => c.def.kind === 'building' && c.def.apts.includes('牧场');
module.exports = L;
