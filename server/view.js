'use strict';
// 生成玩家视角的游戏状态（隐藏非公开信息）
const PHASE_CN = { setup: '准备', stand: '竖置阶段', draw: '抽卡阶段', soul: '灵魂阶段', main: '主要阶段', battle: '战斗', end: '结束阶段' };
const KW_CN = { brave: '勇敢', serious: '认真', interrupt: '妨碍', taunt: '嘲讽', stealth: '隐秘', assault: '袭击', nocturnal: '夜行性', vigilance: '警戒', breakthrough: '突破', retaliate: '复仇' };

function cardView(g, c, full) {
  const v = { uid: c.uid, id: c.id, owner: c.owner };
  if (c.zone === 'base') {
    Object.assign(v, { ctrl: c.ctrl, rested: c.rested, damage: c.damage, kind: c.def.kind });
    if (c.def.kind === 'pal' || c.def.kind === 'building') v.power = g.power(c);
    if (c.def.kind === 'pal') v.strike = g.strike(c);
    const k = g.kw(c); v.kw = Object.entries(k).filter(([n, x]) => x && KW_CN[n]).map(([n, x]) => KW_CN[n] + (typeof x === 'number' && (n === 'brave' || n === 'serious') ? x : (typeof x === 'number' && x > 1 ? '×' + x : '')));
    if (c.names.length) v.extraNames = c.names.map(n => (g.db._byJa[n] || {}).name);
    if (g.cantStand(c) || c.noStand.length) v.noStand = true;
  }
  return v;
}
function viewFor(g, me, opt = {}) {
  const op = 1 - me;
  const pv = (pi) => {
    const p = g.p[pi];
    return {
      name: p.name, life: p.life, material: p.material, ingredient: p.ingredient,
      souls: p.souls.length, soulsStanding: p.souls.filter(s => !s.rested).length, soulDeck: p.soulDeck,
      deck: p.deck.length, handCount: p.hand.length,
      hand: pi === me || opt.all ? p.hand.map(c => cardView(g, c)) : undefined,
      deckList: pi === me || opt.all ? p.deck.map(c => c.id).sort() : undefined,
      base: p.base.map(c => cardView(g, c)),
      grave: p.grave.map(c => ({ uid: c.uid, id: c.id })),
      exile: p.exile.map(c => ({ uid: c.uid, id: c.id })),
    };
  };
  const q = g.pending;
  let ask = null;
  if (q && q.player === me) {
    ask = { kind: q.kind, prompt: q.prompt, quick: !!q.quick, v: g.version };
    if (q.kind === 'main') ask.actions = q.actions.map(a => ({ t: a.t, uid: a.uid, label: a.label }));
    if (q.kind === 'option') { ask.options = q.options; if (q.meta) ask.meta = q.meta; }
    if (q.view) ask.view = q.view.map(u => { const c = g.findCard(u) || g.p.flatMap(p => p.deck).find(x => x.uid === u); return { uid: u, id: c ? c.id : null }; });
    if (q.kind === 'select') {
      ask.min = q.min; ask.max = q.max;
      ask.cands = q.cands.map(u => { const c = g.findCard(u) || g.p.flatMap(p => p.deck).find(x => x.uid === u); return { uid: u, id: c ? c.id : null, zone: c ? c.zone : null, owner: c ? c.owner : null }; });
    }
  }
  const B = g.battle;
  return {
    me, turn: g.turnNo, active: g.active, phase: PHASE_CN[g.phase] || g.phase, night: g.isNight(),
    players: [pv(me), pv(op)],
    battle: B ? { att: B.att.uid, target: B.target === 'player' ? 'player' : B.target.uid, blocked: B.blocked, failed: B.failed } : null,
    ask, waiting: q && q.player !== me ? g.p[q.player].name : null,
    reveals: (g.reveals || []).slice(-4), revealN: (g.reveals || []).length,
    log: g.log.slice(-60), logN: g.log.length, over: g.over, version: g.version,
  };
}
module.exports = { viewFor };
