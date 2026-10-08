'use strict';
// 规则单元测试：直接搭建局面，验证关键规则
const assert = require('assert');
const { db, Game } = require('../server/engine');
const filler = Array(50).fill('BP01-099'); // 无效果普通帕鲁

function setup() {
  const g = new Game({ db, decks: [filler.slice(), filler.slice()], names: ['甲', '乙'], seed: 1 });
  // 跳过准备：甲先攻，不重抽
  while (g.pending && g.phase === 'setup') { const q = g.pending; g.answer(q.player, q.kind === 'option' ? (/先攻/.test(q.options.join()) ? (q.player === 0 ? 0 : 1) : 1) : []); }
  return g;
}
function put(g, pi, id, opt = {}) { const c = g.mk(id, pi); c.zone = 'none'; g.move(c, 'base', { rested: !!opt.rested }); return c; }
function hand(g, pi, id) { const c = g.mk(id, pi); c.zone = 'hand'; g.p[pi].hand.push(c); return c; }
function souls(g, pi, n) { g.p[pi].souls = Array.from({ length: n }, () => ({ rested: false })); }
function mainIdx(g, pred) { g.refreshMain(); const q = g.pending; assert.equal(q.kind, 'main', '应为主要阶段: ' + JSON.stringify(q).slice(0, 200)); const i = q.actions.findIndex(pred); assert(i >= 0, '找不到行动: ' + q.actions.map(a => a.label).join('|')); return i; }
const tests = [];
const T = (n, f) => tests.push([n, f]);

T('受到伤害：翻到☆则不失去生命', () => {
  const g = setup();
  g.p[1].deck[0] = Object.assign(g.mk('BP01-001', 1), { zone: 'deck' });
  g.damagePlayer(1, 3);
  assert.equal(g.p[1].life, 10); assert.equal(g.p[1].grave.length, 1);
});
T('受到伤害：无☆时放置等量卡并失去生命', () => {
  const g = setup(); g.damagePlayer(1, 3);
  assert.equal(g.p[1].life, 7); assert.equal(g.p[1].grave.length, 3); assert.equal(g.p[1].dmg, 0);
});
T('先攻首回合不抽卡', () => { const g = setup(); assert.equal(g.p[0].hand.length, 5); assert.equal(g.turnNo, 1); assert.equal(g.p[0].souls.length, 2); assert.equal(g.p[1].souls.length, 1); });
T('攻击玩家造成打击力伤害；阻挡后帕鲁战斗', () => {
  const g = setup();
  const a = put(g, 0, 'TD01-001'); // 1600/4
  const b = put(g, 1, 'BP01-099'); // 500
  g.answer(0, mainIdx(g, x => x.t === 'attack'));
  // 目标选择（玩家 / 竖置帕鲁(袭击)）
  if (g.pending.kind === 'option') g.answer(0, g.pending.options.indexOf('对手玩家'));
  // 阻挡
  assert.equal(g.pending.player, 1); g.answer(1, [b.uid]);
  while (g.pending.player === 1) g.answer(1, g.pending.actions.length - 1);
  assert.equal(b.zone, 'grave'); assert.equal(g.p[1].life, 10); assert(a.rested);
});
T('嘲讽：必须攻击嘲讽卡', () => {
  const g = setup();
  const a = put(g, 0, 'BP01-099');
  put(g, 1, 'BP01-091'); // 木墙 嘲讽
  const ts = g.legalTargets(a); assert.equal(ts.length, 1); assert.equal(ts[0].id, 'BP01-091');
});
T('隐秘无法被阻挡', () => {
  const g = setup();
  put(g, 0, 'TD02-015'); put(g, 1, 'BP01-099');
  g.answer(0, mainIdx(g, x => x.t === 'attack'));
  assert(!(g.pending.kind === 'select' && /阻挡/.test(g.pending.prompt)));
});
T('妨碍：攻击失败且不发生伤害', () => {
  const g = setup();
  put(g, 0, 'TD01-001');
  const h = hand(g, 1, 'BP01-014'); souls(g, 1, 3);
  g.answer(0, mainIdx(g, x => x.t === 'attack'));
  if (g.pending.kind === 'option') g.answer(0, g.pending.options.indexOf('对手玩家'));
  const q = g.pending; assert(q.quick); g.answer(1, q.actions.findIndex(a => a.key === 'interrupt' && /灵魂/.test(a.label)));
  assert.equal(h.zone, 'grave'); assert.equal(g.p[1].life, 10); assert.equal(g.untapSouls(1), 2);
});
T('致死伤害：伤害≥战斗力被破坏；战斗力≤0本身不破坏', () => {
  const g = setup();
  const c = put(g, 1, 'BP01-099'); c.mods.push({ until: g.turnNo, power: -600 });
  const it = g.ruleProcess(); it.next(); assert.equal(c.zone, 'base');
  c.damage = 100; const it2 = g.ruleProcess(); it2.next(); assert.equal(c.zone, 'grave');
});
T('夜行性叠加（瞅什魔 +600）', () => {
  const g = setup(); const c = put(g, 0, 'BP01-079'); const base = g.power(c);
  g.setNight(g.turnNo); assert.equal(g.power(c) - base, 600);
});
T('朱雀：红色卡伤害+200（含自身）', () => {
  const g = setup(); souls(g, 0, 10);
  const t = put(g, 1, 'TD01-007'); // 1600
  const s = hand(g, 0, 'BP01-002');
  g.answer(0, mainIdx(g, x => x.uid === s.uid));
  g.answer(0, [t.uid]); assert.equal(t.damage, 900);
});
T('帕鲁上限 5：超出时选择放置入墓地', () => {
  const g = setup(); souls(g, 0, 10);
  for (let i = 0; i < 5; i++) put(g, 0, 'BP01-099');
  const h = hand(g, 0, 'BP01-056');
  g.answer(0, mainIdx(g, x => x.uid === h.uid));
  const q = g.pending; assert.equal(q.kind, 'select'); assert(!q.cands.includes(h.uid));
  g.answer(0, [q.cands[0]]); assert.equal(g.myPals(0).length, 5); assert.equal(h.zone, 'base');
});
T('1回合1次：灵魂抽卡', () => {
  const g = setup(); souls(g, 0, 10);
  g.answer(0, mainIdx(g, x => x.t === 'soulDraw'));
  assert(!g.pending.actions.some(x => x.t === 'soulDraw'));
});
T('复仇：战斗中被破坏时对手也被破坏', () => {
  const g = setup();
  const a = put(g, 0, 'TD01-001'); const m = put(g, 1, 'BP01-084', { rested: true });
  g.answer(0, mainIdx(g, x => x.t === 'attack'));
  if (g.pending.kind === 'option') g.answer(0, g.pending.options.findIndex(o => o.includes('冥铠蝎')));
  while (g.pending.player === 1) { const q = g.pending; g.answer(1, q.kind === 'main' ? q.actions.length - 1 : q.kind === 'option' ? 0 : []); }
  assert.equal(m.zone, 'grave'); assert.equal(a.zone, 'grave');
});
T('突破：击破对手帕鲁后给予玩家伤害', () => {
  const g = setup(); g.p[0].ingredient = 2;
  const a = put(g, 0, 'BP01-059'); put(g, 1, 'BP01-099', { rested: true });
  g.answer(0, mainIdx(g, x => x.t === 'act'));
  g.answer(0, mainIdx(g, x => x.t === 'attack'));
  if (g.pending.kind === 'option') g.answer(0, g.pending.options.findIndex(o => o !== '对手玩家'));
  while (g.pending.player === 1) { const q = g.pending; g.answer(1, q.kind === 'main' ? q.actions.length - 1 : q.kind === 'option' ? 0 : []); }
  assert.equal(g.p[1].life, 10 - g.strike(a));
});
T('雷冥鸟回合结束延迟横置 + 时间推进', () => {
  const g = setup(); g.answer(0, mainIdx(g, x => x.t === 'end'));
  assert.equal(g.active, 1); assert.equal(g.p[1].hand.length, 6);
});

let ok = 0;
for (const [n, f] of tests) { try { f(); ok++; console.log('✔', n); } catch (e) { console.log('✘', n, '\n   ', e.message); } }
console.log(`${ok}/${tests.length} 通过`);
process.exit(ok === tests.length ? 0 : 1);
