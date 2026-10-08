'use strict';
// 主题预设卡组（有体系的卡放在一起）。不足 50 张时用同色基础帕鲁补齐。
const { db } = require('./index');
const P = [
  { key: 'red-burn', name: '红·火力压制', desc: '伏特喵/手枪/步枪/朱雀：用【伤害】效果清场，配合武器工作台与机关枪', colors: ['red'],
    list: { 'BP01-008': 4, 'BP01-021': 3, 'TD01-011': 3, 'TD01-010': 2, 'BP01-002': 2, 'BP01-007': 3, 'SS01-001': 2, 'TD01-007': 2, 'TD01-009': 2, 'BP01-015': 2, 'TD01-008': 3, 'BP01-012': 4, 'TD01-005': 3, 'BP01-023': 2, 'BP01-014': 2, 'TD01-004': 3, 'BP01-013': 4, 'TD01-002': 4 } },
  { key: 'red-army', name: '红·红色军团', desc: '火绒狐+背带、红小鲨、圣火台、燧火鸟：全体红色帕鲁一起变强', colors: ['red'],
    list: { 'BP01-006': 4, 'TD01-004': 3, 'BP01-019': 3, 'BP01-003': 4, 'BP01-017': 3, 'BP01-010': 3, 'BP01-009': 4, 'TD01-002': 4, 'TD01-003': 4, 'BP01-011': 3, 'TD01-006': 3, 'BP01-013': 3, 'TD01-001': 2, 'BP01-004': 2, 'TD01-008': 3, 'BP01-024': 2 } },
  { key: 'blue-classic', name: '蓝·古典式建筑', desc: '古典式镜子/木椅/化妆台/窗帘 + 雪猛犸、寒霜兽：建筑越多越强', colors: ['blue'],
    list: { 'BP01-042': 4, 'TD01-019': 3, 'BP01-040': 2, 'BP01-039': 3, 'TD01-018': 3, 'BP01-030': 3, 'BP01-046': 3, 'TD01-020': 3, 'BP01-043': 3, 'BP01-034': 3, 'BP01-035': 3, 'TD01-013': 4, 'BP01-037': 4, 'BP01-038': 3, 'TD01-012': 3, 'BP01-029': 3 } },
  { key: 'blue-penguin', name: '蓝·企丸丸冲锋', desc: '企丸丸、企丸王、火箭发射器，配合冰缚灵/佩克龙/覆海龙横置控制', colors: ['blue'],
    list: { 'TD01-014': 4, 'BP01-028': 4, 'BP01-031': 4, 'BP01-044': 3, 'TD01-015': 3, 'BP01-026': 2, 'BP01-027': 2, 'BP01-029': 2, 'TD01-022': 3, 'BP01-048': 3, 'BP01-047': 2, 'TD01-016': 3, 'BP01-032': 4, 'BP01-036': 4, 'TD01-021': 3, 'TD01-017': 2, 'TD01-019': 2 } },
  { key: 'green-bee', name: '绿·花园蜂群', desc: '骑士蜂可投入任意张数；女皇蜂随蜂群成长，牧场让骑士蜂+500', colors: ['green'],
    list: { 'BP01-061': 18, 'BP01-053': 4, 'BP01-066': 3, 'TD02-008': 3, 'BP01-063': 2, 'TD02-009': 3, 'BP01-070': 3, 'TD02-011': 3, 'TD02-004': 3, 'BP01-062': 2, 'BP01-060': 3, 'BP01-072': 3 } },
  { key: 'green-ramp', name: '绿·食材与灵魂', desc: '趴趴鲶/波娜兔攒食材，饲料箱/售货机加速灵魂，碎岩龟10魂爆发', colors: ['green'],
    list: { 'BP01-057': 4, 'TD02-003': 4, 'BP01-065': 3, 'BP01-064': 2, 'BP01-059': 3, 'BP01-050': 3, 'BP01-051': 3, 'TD02-007': 2, 'BP01-049': 2, 'TD02-005': 3, 'BP01-066': 3, 'TD02-008': 3, 'BP01-071': 3, 'BP01-056': 4, 'TD02-002': 4, 'BP01-054': 2, 'TD02-004': 2 } },
  { key: 'purple-night', name: '紫·夜行性', desc: '寐魔家族、瞅什魔 + 劣质床/电灯/项圈造黑夜，雷冥鸟、噬魂兽收割', colors: ['purple'],
    list: { 'BP01-080': 4, 'BP01-082': 4, 'BP01-079': 4, 'SS01-003': 3, 'BP01-089': 3, 'BP01-088': 2, 'BP01-094': 3, 'BP01-073': 2, 'BP01-085': 3, 'BP01-087': 4, 'BP01-077': 3, 'BP01-097': 2, 'BP01-096': 3, 'TD02-016': 4, 'TD02-017': 2, 'BP01-074': 2, 'BP01-086': 2 } },
  { key: 'purple-grave', name: '紫·墓地轮回', desc: '猫蝠怪/切肉刀填墓地，制药台、医药品、黑月女王从墓地复活', colors: ['purple'],
    list: { 'BP01-076': 4, 'BP01-093': 3, 'BP01-090': 3, 'TD02-022': 2, 'BP01-078': 3, 'BP01-075': 2, 'BP01-084': 3, 'TD02-014': 4, 'BP01-095': 3, 'BP01-097': 2, 'TD02-021': 2, 'TD02-012': 2, 'BP01-086': 4, 'TD02-013': 4, 'TD02-016': 4, 'TD02-017': 3, 'BP01-081': 2 } },
  { key: 'starter', name: '无色·起始帕鲁', desc: '集齐3种「起始」帕鲁后用「冒险的开始」全体+1000/打击+5（红绿混合）', colors: ['red', 'green'],
    list: { 'TD01-023': 4, 'TD02-023': 4, 'TD02-024': 4, 'BP01-100': 4, 'TD01-024': 3, 'SS01-004': 3, 'TD02-008': 3, 'TD01-008': 3, 'BP01-006': 3, 'BP01-060': 3, 'TD02-011': 3, 'TD01-011': 3, 'BP01-099': 4, 'TD02-001': 2, 'BP01-013': 2, 'TD02-006': 2 } },
  { key: 'bluepurple-control', name: '蓝紫·妨碍控制', desc: '大量【妨碍】让对手攻击失败，暗黑炮/来自黑暗的一击精确除去，悬吊陷阱放逐', colors: ['blue', 'purple'],
    list: { 'TD01-016': 3, 'BP01-038': 3, 'TD02-017': 3, 'BP01-077': 3, 'BP01-096': 3, 'TD02-021': 3, 'TD02-019': 3, 'TD01-022': 3, 'BP01-048': 3, 'BP01-091': 3, 'TD02-015': 3, 'TD02-018': 2, 'BP01-027': 2, 'TD01-012': 3, 'BP01-086': 4, 'TD01-014': 4, 'BP01-095': 2 } },
];
function build(p) {
  const deck = [];
  for (const [id, n] of Object.entries(p.list)) { if (!db[id]) throw new Error('preset ' + p.key + ' unknown ' + id); for (let i = 0; i < n; i++) deck.push(id); }
  const filler = Object.values(db).filter(c => c.kind === 'pal' && !c.text && !c.lucky && (p.colors.includes(c.color) || !c.color));
  let k = 0; const cnt = id => deck.filter(x => x === id).length;
  while (deck.length < 50 && k < 200) { const c = filler[k++ % filler.length]; if (cnt(c.id) < 4) deck.push(c.id); }
  return deck.slice(0, 50);
}
const PRESETS = P.map(p => ({ key: p.key, name: p.name, desc: p.desc, colors: p.colors, cards: build(p) }));
module.exports = { PRESETS };

// ---- v8：精调预设（tools/deck/opt.js 对战爬山优化）+ 社区知名卡组 ----
{
  const fs = require('fs'), path = require('path');
  const { META } = require('./meta_decks');
  const expand = l => { const d = []; for (const [k, n] of Object.entries(l)) for (let i = 0; i < n; i++) d.push(k); return d; };
  let tuned = []; try { tuned = JSON.parse(fs.readFileSync(path.join(__dirname, 'tuned_decks.json'), 'utf8')); } catch (e) { }
  const wr = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'deck_winrates.json'), 'utf8')); } catch (e) { return {}; } })();
  const usedArt = new Set();
  const art = l => { const c = Object.entries(l).filter(([k]) => db[k].kind === 'pal').sort((a, b) => (!!db[b[0]].color - !!db[a[0]].color) || (db[b[0]].cost - db[a[0]].cost) || (b[1] - a[1])).map(x => x[0]);
    const k = c.find(x => !usedArt.has(x)) || c[0]; usedArt.add(k); return k; };
  const out = [];
  for (const t of tuned) out.push({ key: t.key, name: t.name, desc: t.desc, colors: t.colors, cards: expand(t.list), group: 'preset', wr: wr[t.key], art: t.art || art(t.list) });
  for (const m of META) out.push({ key: m.key, name: m.name, desc: m.desc, colors: m.colors, cards: expand(m.list), group: 'meta', wr: wr[m.key], art: art(m.list) });
  if (out.length) { module.exports.PRESETS.length = 0; module.exports.PRESETS.push(...out); }
}
