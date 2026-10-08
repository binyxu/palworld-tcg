// 装备简单排查：逐张从手牌使用，处理登场效果，再试起动能力
const { db, Game } = require('../server/engine');
const gears = Object.values(db).filter(c => c.kind === 'gear');
let fail = 0;
for (const c of gears) {
  const sc = { players: [{ hand: [c.id], souls: 10, base: ['BP01-099', 'BP01-028'], deck: Array(12).fill('BP01-056') },
    { base: ['BP01-099', 'BP01-013'], deck: Array(12).fill('BP01-099') }], active: 0, turnNo: 3 };
  const g = new Game({ db, decks: [[], []], names: ['a', 'b'], seed: 1, scenario: sc });
  const out = [];
  try {
    const pi = g.pending.actions.findIndex(x => x.t === 'play' && g.findCard(x.uid).id === c.id);
    if (pi < 0) { out.push('无法使用!'); fail++; console.log(c.id, c.name, out.join(' ')); continue; }
    const L0 = g.log.length; g.answer(0, pi);
    for (let k = 0; k < 6 && g.pending && g.pending.kind !== 'main'; k++) g.answer(0, g.pending.kind === 'select' ? g.pending.cands.slice(0, Math.max(1, g.pending.min)).slice(0, g.pending.max) : 0);
    const onBase = g.p[0].base.some(x => x.id === c.id);
    out.push(onBase ? '登场✓' : '未登场!'); if (!onBase) fail++;
    const act = g.pending.actions.find(x => x.t === 'act' && g.findCard(x.uid).id === c.id);
    if (act) { g.answer(0, g.pending.actions.indexOf(act)); for (let k = 0; k < 6 && g.pending && g.pending.kind !== 'main'; k++) g.answer(0, g.pending.kind === 'select' ? g.pending.cands.slice(0, Math.max(1, g.pending.min)).slice(0, g.pending.max) : 0); out.push('起动✓'); }
    else out.push('(无可用起动)');
    out.push('| ' + g.log.slice(L0).filter(l => !/^——/.test(l)).join(' / ').slice(0, 160));
  } catch (e) { fail++; out.push('异常 ' + e.message); }
  console.log(c.id, c.name, out.join(' '));
}
console.log('gears', gears.length, 'fail', fail);
