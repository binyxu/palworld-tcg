// 并行循环赛：runTourney(decks{name:list|'RANDOM'}, games, ai) → 胜率矩阵
const { spawn } = require('child_process'); const os = require('os'); const path = require('path');
const { expand } = require('./lib');
async function runTourney(named, games = 10, ai = 'hard', only = null) {
  const names = Object.keys(named), decks = names.map(n => typeof named[n] === 'string' ? named[n] : Array.isArray(named[n]) ? named[n] : expand(named[n]));
  const pairs = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    if (only && !only.includes(i) && !only.includes(j)) continue;
    for (let g = 0; g < games; g++) pairs.push([i, j, 1000 + g + i * 131 + j * 17]);
  }
  const W = Math.max(1, os.cpus().length - 1), chunks = Array.from({ length: W }, () => []);
  pairs.forEach((p, k) => chunks[k % W].push(p));
  const res = (await Promise.all(chunks.filter(c => c.length).map(c => new Promise((ok, no) => {
    const ch = spawn(process.execPath, [path.join(__dirname, 'worker.js')]); let o = '';
    ch.stdout.on('data', d => o += d); ch.stderr.on('data', d => process.stderr.write(d));
    ch.on('close', code => code ? no(new Error('worker ' + code)) : ok(JSON.parse(o)));
    ch.stdin.end(JSON.stringify({ pairs: c, decks, ai }));
  })))).flat();
  const n = names.length, w = Array.from({ length: n }, () => Array(n).fill(0)), t = Array.from({ length: n }, () => Array(n).fill(0));
  for (const [i, j, r] of res) { t[i][j]++; t[j][i]++; if (r === 0) w[i][j]++; else if (r === 1) w[j][i]++; else { w[i][j] += .5; w[j][i] += .5; } }
  const rows = names.map((nm, i) => { let W2 = 0, T = 0; for (let j = 0; j < n; j++) { W2 += w[i][j]; T += t[i][j]; } return { nm, i, wr: T ? W2 / T : 0, T }; });
  return { names, w, t, rows };
}
module.exports = { runTourney };
