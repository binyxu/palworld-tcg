// 一致性检查：同一组卡组、同一个种子（相同初始手牌/卡组顺序），快速 AI 与深度 AI 各打 1 局，比较胜负
// node tools/deck/deep_vs_fast.js [G=1]   结果：tools/deck/deep_vs_fast.json（边跑边写）
const fs = require('fs'), path = require('path'), os = require('os'); const { spawn } = require('child_process');
const { META } = require('../../server/engine/meta_decks');
const tuned = require('../../server/engine/tuned_decks.json');
const { play, expand } = require('./lib');
const decks = [...tuned, ...META].map(d => ({ key: d.key, name: d.name, list: Array.isArray(d.list) ? d.list : expand(d.list) }));
const G = +process.env.G || 1, OUT = path.join(__dirname, 'deep_vs_fast.json');
const games = [];
for (let i = 0; i < decks.length; i++) for (let j = i + 1; j < decks.length; j++) for (let g = 0; g < G; g++) games.push({ i, j, seed: 5000 + g + i * 131 + j * 17 });
for (const x of games) x.fast = play(decks[x.i].list, decks[x.j].list, x.seed, 'hard');
const save = () => fs.writeFileSync(OUT, JSON.stringify({ decks: decks.map(d => ({ key: d.key, name: d.name })), games }, null, 0));
save(); console.log('快速版完成', games.length, '局，开始深度版');
const W = Math.max(1, os.cpus().length - 1); let next = 0, done = 0; const t0 = Date.now();
function run() {
  if (next >= games.length) return Promise.resolve();
  const x = games[next++];
  return new Promise(ok => {
    const ch = spawn(process.execPath, [path.join(__dirname, 'worker.js')]); let o = '';
    ch.stdout.on('data', d => o += d); ch.stderr.on('data', d => process.stderr.write(d));
    ch.on('close', () => { try { x.deep = JSON.parse(o)[0][2]; } catch (e) { x.deep = 'err'; } done++; save();
      if (done % 10 === 0) console.log(done + '/' + games.length, ((Date.now() - t0) / 60000).toFixed(0) + ' 分钟'); ok(); });
    ch.stdin.end(JSON.stringify({ pairs: [[x.i, x.j, x.seed]], decks: decks.map(d => d.list), ai: 'deep' }));
  }).then(run);
}
Promise.all(Array.from({ length: W }, run)).then(() => {
  const n = games.filter(x => x.deep !== 'err').length, same = games.filter(x => x.deep === x.fast).length;
  console.log(`一致 ${same}/${n}（${(same / n * 100).toFixed(1)}%），用时 ${((Date.now() - t0) / 3600000).toFixed(2)} 小时`);
});
