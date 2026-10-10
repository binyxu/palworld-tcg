// 用深度 AI（游戏里的困难难度）复测快速版排名前 N 的卡组：node tools/deck/deep_top.js  [N=10 G=6]
const fs = require('fs'), path = require('path');
const { runTourney } = require('./tourney');
const { META } = require('../../server/engine/meta_decks');
const tuned = require('../../server/engine/tuned_decks.json');
const wr = require('../../server/engine/deck_winrates.json');
const N = +process.env.N || 10, G = +process.env.G || 6;
const all = {}; for (const t of tuned) all[t.key] = t; for (const m of META) all[m.key] = m;
const keys = Object.keys(wr).sort((a, b) => wr[b] - wr[a]).filter(k => all[k]).slice(0, N);
const named = {}, keyOf = {}; for (const k of keys) { named[all[k].name] = all[k].list; keyOf[all[k].name] = k; }
const t0 = Date.now();
runTourney(named, G, 'deep').then(r => {
  const out = { at: new Date().toISOString(), games: G, ms: Date.now() - t0, rows: {}, matrix: r };
  r.rows.sort((a, b) => b.wr - a.wr).forEach(x => { out.rows[keyOf[x.nm]] = +x.wr.toFixed(3); console.log((x.wr * 100).toFixed(1).padStart(5) + '%', x.nm, '（快速版', (wr[keyOf[x.nm]] * 100).toFixed(1) + '%）'); });
  fs.writeFileSync(path.join(__dirname, '../../server/engine/deck_winrates_deep.json'), JSON.stringify(out, null, 1));
  console.log('用时', ((Date.now() - t0) / 3600000).toFixed(2), '小时');
});
