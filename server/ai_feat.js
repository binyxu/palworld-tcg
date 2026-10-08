'use strict';
// 局面特征编码（与卡牌 ID 无关）：每张卡只用"属性 + 规则文本语义标签"描述，
// 所以新卡只要有费用/战斗力/打击力/关键字/效果文本，就能直接编码，无需重新训练。
// 只使用 pi 视角下可见的信息（对手手牌只用张数，双方卡组只用张数和已知构成）。

const KW = ['interrupt', 'brave', 'serious', 'taunt', 'nocturnal', 'retaliate', 'assault', 'vigilance', 'stealth'];
// 规则文本语义标签：按效果文字匹配（新卡文本也同样适用）
const TAGS = [
  ['deploy', /登场时/], ['onatk', /攻击时/], ['ondie', /被破坏|放置于墓地时|放置入墓地时/], ['turnend', /回合结束时/],
  ['draw', /抽\d*张|抽1|抽卡/], ['dmg', /伤害/], ['destroy', /破坏/], ['exile', /放逐/], ['grave', /墓地/],
  ['rest', /横置/], ['stand', /竖置/], ['powup', /战斗力】?\+|\+\d+/], ['powdown', /-\d+/], ['search', /卡组顶|检视|公开/],
  ['food', /食材/], ['mat', /素材/], ['life', /生命/], ['night', /黑夜|夜/], ['summon', /使其登场|登场/], ['hand', /手牌/],
];
const NTAG = TAGS.length, NKW = KW.length;
const cache = new Map();
function staticVec(def) {
  let v = cache.get(def);
  if (v) return v;
  const t = (def.text || '') + ' ' + (def.acts ? def.acts.map(a => a.name || '').join(' ') : '');
  v = {
    tags: TAGS.map(([, re]) => re.test(t) ? 1 : 0),
    acts: def.acts ? def.acts.length : 0, autos: def.autos ? def.autos.length : 0, statics: def.statics ? def.statics.length : 0,
    quick: def.quick ? 1 : 0, lucky: def.lucky ? 1 : 0, len: Math.min(t.length, 200) / 200,
  };
  cache.set(def, v); return v;
}
// 单卡（场上）向量
const CARD_D = 12 + NKW + NTAG;
function cardVec(g, c, out, o, w = 1) {
  const d = c.def, s = staticVec(d), pal = d.kind === 'pal', k = c.zone === 'base' ? g.kw(c) : (d.kw || {});
  out[o++] += w * (pal ? 1 : 0); out[o++] += w * (d.kind === 'building' ? 1 : 0); out[o++] += w * (d.kind === 'gear' ? 1 : 0); out[o++] += w * (d.kind === 'event' ? 1 : 0);
  const pw = c.zone === 'base' ? g.power(c) : (d.power || 0);
  out[o++] += w * pw / 1000; out[o++] += w * (pal ? (c.zone === 'base' ? g.strike(c) : d.strike || 0) : 0) / 2; out[o++] += w * (d.cost || 0) / 6;
  out[o++] += w * (c.rested ? 1 : 0); out[o++] += w * (c.damage || 0) / 1000;
  out[o++] += w * Math.min(s.acts, 3) / 2; out[o++] += w * Math.min(s.autos, 3) / 2; out[o++] += w * (s.quick + s.lucky * 0.5 + s.statics * 0.5);
  for (const n of KW) out[o++] += w * (k[n] ? (typeof k[n] === 'number' ? Math.min(k[n], 3) : 1) : 0);
  for (let i = 0; i < NTAG; i++) out[o++] += w * s.tags[i];
  return o;
}
// 一方的特征
const SIDE_D = 24 + CARD_D * 3 + 6 * 3 + 4;
function sideVec(g, pi, viewer, out, o) {
  const p = g.p[pi], mine = pi === viewer, op = g.p[1 - pi];
  const L = Math.max(p.life, 0);
  const pals = p.base.filter(c => c.def.kind === 'pal'), stand = pals.filter(c => !c.rested);
  const oppStand = op.base.filter(c => c.def.kind === 'pal' && !c.rested);
  out[o++] = L / 10; out[o++] = Math.min(L, 3) / 3; out[o++] = Math.min(L, 6) / 6; out[o++] = L <= 2 ? 1 : 0;
  out[o++] = p.hand.length / 8; out[o++] = p.deck.length / 40; out[o++] = p.deck.length < 8 ? (8 - p.deck.length) / 8 : 0;
  out[o++] = p.grave.length / 20; out[o++] = p.exile.length / 10;
  out[o++] = p.souls.length / 10; out[o++] = p.souls.filter(s => !s.rested).length / 10; out[o++] = p.soulDeck / 10;
  out[o++] = Math.min(p.material, 10) / 5; out[o++] = Math.min(p.ingredient, 10) / 5;
  out[o++] = pals.length / 5; out[o++] = stand.length / 5; out[o++] = (p.base.length - pals.length) / 4;
  // 攻防关系：按打击力排序，扣除对方可阻挡数后的未阻挡打击
  const atk = stand.map(c => g.strike(c)).sort((a, b) => b - a);
  const unb = atk.slice(oppStand.length).reduce((a, b) => a + b, 0), tot = atk.reduce((a, b) => a + b, 0);
  const opL = Math.max(op.life, 1);
  out[o++] = unb / 5; out[o++] = tot / 8; out[o++] = unb >= opL ? 1 : 0; out[o++] = tot >= opL ? 1 : 0;
  // 我方竖置帕鲁能否在战斗中打赢对方最强竖置帕鲁
  const maxOp = Math.max(0, ...oppStand.map(c => g.power(c))), maxMe = Math.max(0, ...stand.map(c => g.power(c)));
  out[o++] = (maxMe - maxOp) / 1000; out[o++] = stand.filter(c => g.power(c) > maxOp).length / 5;
  out[o++] = mine ? 1 : 0;
  // 场上：全部卡求和；帕鲁求最大值（逐维）；手牌求和（仅自己可见）
  const base0 = o; for (const c of p.base) cardVec(g, c, out, base0); o += CARD_D;
  const mx = new Float32Array(CARD_D), tmp = new Float32Array(CARD_D);
  for (const c of pals) { tmp.fill(0); cardVec(g, c, tmp, 0); for (let i = 0; i < CARD_D; i++) mx[i] = Math.max(mx[i], tmp[i]); }
  for (let i = 0; i < CARD_D; i++) out[o + i] = mx[i]; o += CARD_D;
  if (mine) { for (const c of p.hand) cardVec(g, c, out, o, 1 / 4); }
  o += CARD_D;
  // 战斗力最高的 6 只帕鲁（排序）：战斗力、打击力、竖置
  const top = pals.slice().sort((a, b) => g.power(b) - g.power(a)).slice(0, 6);
  for (let i = 0; i < 6; i++) { const c = top[i]; out[o++] = c ? g.power(c) / 1000 : 0; out[o++] = c ? g.strike(c) / 2 : 0; out[o++] = c ? (c.rested ? 0 : 1) : 0; }
  // 卡组剩余构成（自己知道自己卡组的构成；对手的卡组只能用已知的公开信息，这里不使用）
  if (mine) {
    const dk = p.deck; const n = Math.max(dk.length, 1);
    out[o++] = dk.filter(c => c.def.lucky).length / n; out[o++] = dk.filter(c => c.def.kind === 'pal').length / n;
    out[o++] = dk.reduce((a, c) => a + (c.def.cost || 0), 0) / n / 6; out[o++] = dk.reduce((a, c) => a + (c.def.power || 0), 0) / n / 1000;
  } else o += 4;
  return o;
}
const DIM = SIDE_D * 2 + 8;
function encode(g, pi) {
  const out = new Float32Array(DIM);
  let o = sideVec(g, pi, pi, out, 0);
  o = sideVec(g, 1 - pi, pi, out, o);
  out[o++] = g.active === pi ? 1 : 0; out[o++] = Math.min(g.turnNo, 20) / 20; out[o++] = g.isNight() ? 1 : 0;
  out[o++] = g.first === pi ? 1 : 0; const ph = g.phase; out[o++] = ph === 'main' ? 1 : 0; out[o++] = ph === 'end' ? 1 : 0;
  out[o++] = g.battle ? 1 : 0; out[o++] = 1; // bias
  return out;
}
module.exports = { encode, DIM, TAGS, KW };
