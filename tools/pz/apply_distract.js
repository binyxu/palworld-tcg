// 把 distract_out.json 的干扰项写入 server/puzzles.js（sc 与 desc 备注）
const fs = require('fs'), path = require('path');
const f = path.join(__dirname, '../../server/puzzles.js');
let s = fs.readFileSync(f, 'utf8');
const out = JSON.parse(fs.readFileSync(path.join(__dirname, 'distract_out.json'), 'utf8'));
let n = 0;
for (const [id, v] of Object.entries(out)) {
  const lines = s.split('\n'); let i = lines.findIndex(l => l.includes(`id: "${id}"`)); if (i < 0) continue;
  let j = i; while (!/^\s+sc: /.test(lines[j])) j++;
  const tail = lines[j].match(/ \},?\s*$/)[0];
  lines[j] = '    sc: ' + JSON.stringify(v.sc) + tail.replace(/^ \}/, ' }');
  if (!lines[i].includes('与解法无关')) lines[i] = lines[i].replace(/(desc: "[^"]*?)"/, '$1 （场上和手牌里有些牌与解法无关。）"');
  s = lines.join('\n'); n++;
}
fs.writeFileSync(f, s); console.log('applied', n);
