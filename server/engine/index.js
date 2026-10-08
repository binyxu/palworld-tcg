'use strict';
// 合并官方卡牌数据与效果定义
const fs = require('fs');
const path = require('path');
require('./actions'); require('./costs'); require('./flow'); require('./main'); require('./battle'); require('./keywords');
const { Game } = require('./core');

const defs = Object.assign({}, require('./cards_red'), require('./cards_blue'), require('./cards_green'), require('./cards_purple'), require('./cards_none'));
const base = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cards_base.json'), 'utf8'));
const KIND_CN = { pal: '帕鲁', building: '建筑物', gear: '装备', event: '事件' };
const COLOR_CN = { red: '红', blue: '蓝', green: '绿', purple: '紫' };

const db = {};
Object.defineProperty(db, '_byJa', { value: {}, enumerable: false });
const missing = [];
for (const b of base) {
  const d = defs[b.id];
  if (!d) { missing.push(b.id); continue; }
  const card = { ...b, ...d, kindCn: KIND_CN[b.kind], colorCn: b.color ? COLOR_CN[b.color] : '无' };
  db[b.id] = card;
  db._byJa[b.ja] = card;
  for (const v of b.variants) if (v !== b.id) Object.defineProperty(db, v, { value: card, enumerable: false });
}
if (missing.length) console.warn('缺少效果定义：', missing.join(','));

// 发给前端的公开卡表
function publicList() {
  return Object.values(db).map(c => ({
    id: c.id, name: c.name, ja: c.ja, en: c.en, kind: c.kind, kindCn: c.kindCn, color: c.color, colorCn: c.colorCn,
    types: c.types, apts: c.apts, cost: c.cost, power: c.power, strike: c.strike, lucky: c.lucky, quick: !!c.quick,
    main: c.main, text: c.text, imgs: c.imgs, variants: c.variants, anyNumber: !!c.anyNumber,
  }));
}
module.exports = { db, Game, publicList, missing };
