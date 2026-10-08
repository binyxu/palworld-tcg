// node tools/deck/rank.js [games] [ai]
const { runTourney } = require('./tourney');
const { PRESETS } = require('../../server/engine/presets');
const { META } = require('../../server/engine/meta_decks');
(async () => {
  const G = +process.argv[2] || 8, ai = process.argv[3] || 'hard';
  const named = {};
  for (const m of META) named[m.name] = m.list;
  for (const p of PRESETS) named['旧预设·' + p.name] = p.cards;
  named['随机'] = 'RANDOM'; named['强力随机'] = 'RANDOM_STRONG';
  if (process.env.EXTRA) { const X = require(require('path').resolve(process.env.EXTRA)); for (const d of X) named[d.name] = d.list; }
  const t0 = Date.now(); const r = await runTourney(named, G, ai);
  r.rows.sort((a, b) => b.wr - a.wr).forEach(x => console.log((x.wr * 100).toFixed(1).padStart(5) + '%', String(x.T).padStart(4), x.nm));
  console.log('time', (Date.now() - t0) / 1000 | 0, 's');
  require('fs').writeFileSync('/tmp/rank.json', JSON.stringify(r));
})();
