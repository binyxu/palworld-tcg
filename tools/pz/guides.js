// 生成残局攻略步骤：node tools/pz/guides.js
const { db, Game } = require('../../server/engine');
const { mainLine } = require('../../server/solver');
const { PUZZLES } = require('../../server/puzzles');
const out = {};
for (const p of PUZZLES) {
  const g = new Game({ db, decks: [[], []], names: ['你', '残局对手'], seed: 7, scenario: JSON.parse(JSON.stringify(p.sc)) });
  const ml = mainLine(g);
  if (!ml || !ml.over || ml.over.winner !== 0) throw new Error(p.id + ' 无解');
  out[p.id] = ml.line.filter(x => !/是否选择 1 只帕鲁阻挡？：不选|不再使用/.test(x.label)).map(x => (x.p ? '（对手）' : '') + x.label);
  console.log(p.id, out[p.id].length);
}
require('fs').writeFileSync(require('path').join(__dirname, '../../server/puzzle_guides.json'), JSON.stringify(out, null, 1));
