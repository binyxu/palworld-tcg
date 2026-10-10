// 用当前深度 AI 重打指定卡组（与其余全部卡组），替换 deck_winrates_deep.json 中对应的行与列
// KEYS=meta-starter,meta-gp-ramp G=4 node tools/deck/deep_redo.js
const fs = require('fs'), path = require('path'), os = require('os'); const { spawn } = require('child_process');
const { META } = require('../../server/engine/meta_decks'); const tuned = require('../../server/engine/tuned_decks.json'); const { expand } = require('./lib');
const F = path.join(__dirname, '../../server/engine/deck_winrates_deep.json'), D = JSON.parse(fs.readFileSync(F, 'utf8')), M = D.matrix;
const all = [...tuned, ...META], byName = n => all.find(d => d.name === n);
const L = M.names.map(n => { const d = byName(n); return Array.isArray(d.list) ? d.list : expand(d.list); });
const keys = (process.env.KEYS || 'meta-starter,meta-gp-ramp').split(','), G = +process.env.G || 4;
const R = keys.map(k => M.names.indexOf(all.find(d => d.key === k).name));
const pairs = []; const done = new Set();
for (const i of R) for (let j = 0; j < L.length; j++) { if (i === j || done.has([i, j].sort().join())) continue; done.add([i, j].sort().join());
  for (let g = 0; g < G; g++) pairs.push(g % 2 ? [j, i, 9000 + g * 37 + i * 101 + j] : [i, j, 9000 + g * 37 + i * 101 + j]); }
for (const i of R) for (let j = 0; j < L.length; j++) { M.w[i][j] = M.w[j][i] = 0; M.t[i][j] = M.t[j][i] = 0; }
console.log('重打', keys.join(','), pairs.length, '局'); const t0 = Date.now(); let next = 0, n = 0;
function run() { if (next >= pairs.length) return Promise.resolve(); const p = pairs[next++];
  return new Promise(ok => { const ch = spawn(process.execPath, [path.join(__dirname, 'worker.js')]); let o = '';
    ch.stdout.on('data', d => o += d); ch.on('close', () => { try { const [[a, b, r]] = JSON.parse(o); M.t[a][b]++; M.t[b][a]++;
      if (r === 0) M.w[a][b]++; else if (r === 1) M.w[b][a]++; else { M.w[a][b] += .5; M.w[b][a] += .5; } } catch (e) {}
      if (++n % 10 === 0) console.log(n + '/' + pairs.length, ((Date.now() - t0) / 60000).toFixed(0) + ' 分钟'); ok(); });
    ch.stdin.end(JSON.stringify({ pairs: [p], decks: L, ai: 'deep' })); }).then(run); }
Promise.all(Array.from({ length: Math.max(1, os.cpus().length - 1) }, run)).then(() => {
  M.rows = M.names.map((nm, i) => { let w = 0, t = 0; for (let j = 0; j < L.length; j++) { w += M.w[i][j]; t += M.t[i][j]; } return { nm, i, wr: w / t, T: t }; }).sort((a, b) => b.wr - a.wr);
  D.rows = {}; M.rows.forEach(x => D.rows[byName(x.nm).key] = +x.wr.toFixed(3)); D.redo = { keys, at: new Date().toISOString() };
  fs.writeFileSync(F, JSON.stringify(D, null, 1));
  M.rows.forEach((x, k) => console.log(String(k + 1).padStart(2), (x.wr * 100).toFixed(1) + '%', x.nm, keys.includes(byName(x.nm).key) ? '←重打' : ''));
});
