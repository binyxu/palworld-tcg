'use strict';
// 卡组构筑规则（规则 4）与随机卡组生成
const { db } = require('./index');

function resolve(id) { return db[id] || null; }

function validateDeck(list) {
  const errs = [];
  if (!Array.isArray(list)) return ['卡组格式错误'];
  if (list.length !== 50) errs.push(`主卡组必须恰好 50 张（当前 ${list.length} 张）`);
  const byName = {}; let lucky = 0; const colors = new Set();
  for (const id of list) {
    const c = resolve(id);
    if (!c) { errs.push(`未知卡牌 ${id}`); continue; }
    byName[c.ja] = (byName[c.ja] || 0) + 1;
    if (c.lucky) lucky++;
    if (c.color) colors.add(c.color);
  }
  for (const [ja, n] of Object.entries(byName)) {
    const c = db._byJa[ja];
    if (n > 4 && !c.anyNumber) errs.push(`同名卡至多 4 张：${c.name}（${n} 张）`);
  }
  if (lucky > 8) errs.push(`幸运卡（☆）至多 8 张（当前 ${lucky} 张）`);
  if (colors.size > 2) errs.push(`卡组至多使用 2 种颜色（加无色）（当前 ${colors.size} 种）`);
  return errs;
}

// ---- 随机卡组的几种模式 ----
const COLS = ['red', 'blue', 'green', 'purple'];
function pickColors(rng, want) {
  if (want && want.length) return want.slice(0, 2);
  const a = COLS[Math.floor(rng() * 4)], r = COLS.filter(x => x !== a);
  return rng() < 0.5 ? [a] : [a, r[Math.floor(rng() * 3)]];
}
// 把每个卡名的 4 张副本都放进"卡池"，再从中等概率抽取：同名 4 张的概率自然很低
function drawCopies(rng, cards, n, deck, count, st) {
  const bag = [];
  for (const c of cards) { const k = c.anyNumber ? 4 : 4 - (count[c.id] || 0); for (let i = 0; i < k; i++) bag.push(c); }
  while (n > 0 && bag.length) {
    const i = Math.floor(rng() * bag.length), c = bag[i]; bag[i] = bag[bag.length - 1]; bag.pop();
    if (c.lucky && st.lucky >= 8) continue;
    deck.push(c.id); count[c.id] = (count[c.id] || 0) + 1; if (c.lucky) st.lucky++; n--;
  }
}
// 真随机：所选颜色（+无色）的全部卡牌副本中均匀抽 50 张
function trueRandomDeck(rng = Math.random, colorsWanted) {
  const picks = pickColors(rng, colorsWanted);
  const pool = Object.values(db).filter(c => !c.color || picks.includes(c.color));
  const deck = [], count = {}, st = { lucky: 0 };
  drawCopies(rng, pool, 50, deck, count, st);
  return deck;
}
// 牌型随机：固定牌型（帕鲁 32 / 建筑物 7 / 装备 4 / 事件 7），每类内部真随机
function shapeRandomDeck(rng = Math.random, colorsWanted) {
  const picks = pickColors(rng, colorsWanted);
  const pool = Object.values(db).filter(c => !c.color || picks.includes(c.color));
  const deck = [], count = {}, st = { lucky: 0 };
  const shape = { building: 7, gear: 4, event: 7 };
  for (const [k, n] of Object.entries(shape)) drawCopies(rng, pool.filter(c => c.kind === k), n, deck, count, st);
  drawCopies(rng, pool.filter(c => c.kind === 'pal'), 50 - deck.length, deck, count, st);
  if (deck.length < 50) drawCopies(rng, pool, 50 - deck.length, deck, count, st);
  return deck;
}
// mode: 'true' 真随机 | 'shape' 牌型随机 | 'curve' 曲线随机（偏向低费、成套投入）
function randomDeck(rng = Math.random, colorsWanted, strong = false, mode) {
  if (mode === 'true' || (!mode && !strong)) return trueRandomDeck(rng, colorsWanted);
  if (mode === 'shape') return shapeRandomDeck(rng, colorsWanted);
  const all = Object.values(db);
  const cols = ['red', 'blue', 'green', 'purple'];
  let picks = colorsWanted;
  if (!picks) {
    const a = cols[Math.floor(rng() * 4)];
    picks = [a];
    if (rng() < 0.6) { const rest = cols.filter(x => x !== a); picks.push(rest[Math.floor(rng() * 3)]); }
  }
  const pool = all.filter(c => !c.color || picks.includes(c.color));
  const deck = []; let lucky = 0;
  const count = {};
  const add = (c, n) => {
    for (let i = 0; i < n && deck.length < 50; i++) {
      if (c.lucky && lucky >= 8) return;
      if ((count[c.id] || 0) >= 4 && !c.anyNumber) return;
      deck.push(c.id); count[c.id] = (count[c.id] || 0) + 1; if (c.lucky) lucky++;
    }
  };
  // 帕鲁优先，费用曲线：低费多
  const weight = c => {
    let w = c.kind === 'pal' ? 3 : c.kind === 'building' ? 1.6 : 1.2;
    if (c.cost <= 3) w *= 1.4; else if (c.cost >= 7) w *= 0.7;
    if (!c.color) w *= 0.5;
    if (c.kind === 'pal' && !c.text) w *= 0.8;
    if (strong) {
      if (c.lucky) w *= 3;
      if (c.kw && c.kw.interrupt) w *= 2;
      if (c.kind === 'pal' && c.power / Math.max(c.cost, 1) >= 200) w *= 1.5;
      if (c.kind === 'pal' && !c.text && c.power / Math.max(c.cost, 1) < 150) w *= 0.4;
      if (c.kind === 'event' && !c.quick && c.cost >= 4) w *= 0.7;
    }
    return w;
  };
  const shuffled = pool.slice().sort(() => rng() - 0.5);
  let guard = 0;
  while (deck.length < 50 && guard++ < 5000) {
    const tot = shuffled.reduce((s, c) => s + weight(c), 0);
    let r = rng() * tot; let pick = shuffled[0];
    for (const c of shuffled) { r -= weight(c); if (r <= 0) { pick = c; break; } }
    add(pick, rng() < 0.5 ? 2 : (rng() < 0.5 ? 3 : 4));
  }
  while (deck.length < 50) deck.push(shuffled.find(c => !c.lucky && (count[c.id] || 0) < 4).id), count[deck[deck.length - 1]]++;
  return deck;
}

// 官方预组：从 TD01 / TD02 构造近似 50 张预组
function starterDeck(tag) {
  const ids = Object.values(db).filter(c => c.variants.some(v => v.startsWith(tag)));
  const deck = [];
  let k = 0;
  while (deck.length < 50 && k < 400) { const c = ids[k % ids.length]; const n = deck.filter(x => x === c.id).length; if (n < 4 && !(c.lucky && deck.filter(x => db[x].lucky).length >= 8)) deck.push(c.id); k++; }
  return deck;
}
module.exports = { validateDeck, randomDeck, trueRandomDeck, shapeRandomDeck, starterDeck };
