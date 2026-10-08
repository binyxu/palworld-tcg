'use strict';
// 规则型电脑 AI（不使用 LLM）。难度：easy / normal / hard
// easy：随机性高、只做简单判断；normal：启发式规则；hard：启发式 + 对主要阶段行动做1步模拟评估

function cardValue(g, c) {
  if (!c) return 0;
  const d = c.def;
  if (d.kind === 'pal') return g.power(c) / 100 + g.strike(c) * 3 + d.cost * 0.6 + (c.rested ? 0 : 1.5);
  if (d.kind === 'building') return 4 + d.cost * 0.6;
  if (d.kind === 'gear') return 3 + d.cost * 0.5;
  return d.cost * 0.5;
}
// 局面评估（从 pi 视角）
function evaluate(g, pi) {
  if (g.over) return g.over.winner === pi ? 1e6 : g.over.winner === -1 ? 0 : -1e6;
  const me = g.p[pi], op = g.p[1 - pi];
  let s = 0;
  const lifeW = w => Math.max(w, 0) * 26 + (w <= 4 ? Math.max(w, 0) * 12 : 0);
  s += lifeW(me.life) - lifeW(op.life);
  for (const c of me.base) s += cardValue(g, c);
  for (const c of op.base) s -= cardValue(g, c);
  s += (me.hand.length - op.hand.length) * 2.2;
  s += (me.souls.length - op.souls.length) * 2.5;
  s += (me.material + me.ingredient - op.material - op.ingredient) * 0.4;
  if (me.deck.length < 8) s -= (8 - me.deck.length) * 4;
  if (op.deck.length < 8) s += (8 - op.deck.length) * 4;
  return s;
}

function mineOf(g, uid) { const c = g.findCard(uid); return c; }
// 选择卡片：根据提示语判断是"有利"还是"有害"效果
function harmful(prompt) { return /伤害|墓地|横置|放逐|返回手牌|-\d|无法|解体|丢弃/.test(prompt) && !/墓地中|墓地的|墓地帕鲁/.test(prompt); }

function pickSelect(g, pi, q, level, rng) {
  const cands = q.cands.map(u => mineOf(g, u)).filter(Boolean);
  const pr = q.prompt;
  if (level === 'easy' && rng() < 0.4) {
    const n = q.min + Math.floor(rng() * (q.max - q.min + 1));
    return q.cands.slice().sort(() => rng() - 0.5).slice(0, n);
  }
  let score;
  if (/阻挡/.test(pr)) return blockChoice(g, pi, cands, level);
  if (/丢弃/.test(pr) && cands.every(c => c.zone === 'hand' && c.owner === pi)) {
    score = c => -handKeep(g, pi, c);
  } else if (/卡组顶/.test(pr) && cands.every(c => c.zone === 'hand')) {
    score = c => -handKeep(g, pi, c);
  } else if (/任命/.test(pr)) {
    score = c => -(g.power(c) + (c.def.kw && c.def.kw.serious ? -500 : 0));
  } else if (/解体/.test(pr) || /超过上限/.test(pr) || (/放置于墓地/.test(pr) && /你的/.test(pr) && cands.every(c => c.ctrl === pi))) {
    score = c => -cardValue(g, c) + (c.def.autos && c.def.autos.some(a => /墓地/.test(a.text || '')) ? 3 : 0);
  } else if (harmful(pr)) {
    score = c => (c.ctrl === pi || (c.zone !== 'base' && c.owner === pi) ? -50 - cardValue(g, c) : cardValue(g, c) + killBonus(g, c, pr));
  } else {
    // 有益：选己方高价值
    score = c => ((c.zone === 'base' ? c.ctrl : c.owner) === pi ? 20 + cardValue(g, c) + (c.rested ? 0 : 3) : -20 - cardValue(g, c));
  }
  const sorted = cands.slice().sort((a, b) => score(b) - score(a));
  let n = q.min;
  for (let i = q.min; i < q.max && i < sorted.length; i++) if (score(sorted[i]) > 0) n = i + 1;
  if (q.max > 0 && n === 0 && q.min === 0 && /加入手牌|登场|返回手牌/.test(pr) && !harmful(pr)) n = Math.min(q.max, sorted.length);
  return sorted.slice(0, n).map(c => c.uid);
}
function killBonus(g, c, pr) {
  const m = pr.match(/(\d+)\s*伤害/);
  if (m && c.zone === 'base') { const left = g.power(c) - c.damage; return +m[1] >= left ? 15 : -5; }
  return 0;
}
function handKeep(g, pi, c) {
  const d = c.def; const souls = g.p[pi].souls.length;
  let v = d.cost <= souls + 2 ? 5 : 2;
  if (d.kind === 'pal') v += 2 + (g.p[pi].base.filter(x => x.def.kind === 'pal').length < 2 ? 3 : 0);
  if (d.kw && d.kw.interrupt) v += 2;
  return v + d.cost * 0.3;
}
function blockChoice(g, pi, cands, level) {
  const B = g.battle; if (!B) return [];
  const att = B.att, tgt = B.target;
  const ap = g.power(att) - att.damage * 0;
  let best = null, bestS = 0;
  for (const c of cands) {
    const bp = g.power(c);
    let s = 0;
    const kills = bp >= g.power(att) - att.damage && bp > 0;
    const dies = ap >= bp - c.damage;
    if (kills && !dies) s = 30;
    else if (kills && dies) s = cardValue(g, att) - cardValue(g, c);
    else if (!dies) s = 3;
    else s = -cardValue(g, c);
    if (tgt === 'player') { const st = g.strike(att); const life = g.p[pi].life; s += st >= life ? 100 : st * (life <= 4 ? 6 : 2.5); }
    else if (tgt && tgt.def) s += cardValue(g, tgt) * 0.8;
    if (s > bestS) { bestS = s; best = c; }
  }
  if (level === 'easy' && best && Math.random() < 0.5) return [];
  return best ? [best.uid] : [];
}
module.exports = { evaluate, pickSelect, cardValue, handKeep, harmful };
