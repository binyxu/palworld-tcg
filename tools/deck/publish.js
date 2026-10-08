// 把优化结果写入 server/engine/tuned_decks.json，并跑循环赛写入 deck_winrates.json
const fs = require('fs'), path = require('path');
const { ARCH } = require('./archetypes');
const { META } = require('../../server/engine/meta_decks');
const { runTourney } = require('./tourney');
const { expand, validateDeck } = require('./lib');
(async () => {
  const tuned = [];
  for (const a of ARCH) {
    const f = path.join(__dirname, 'out', a.key + '.json'); if (!fs.existsSync(f)) continue;
    const { list } = JSON.parse(fs.readFileSync(f));
    const e = validateDeck(expand(list)); if (e.length) { console.log('invalid', a.key, e); continue; }
    tuned.push({ key: 'v8-' + a.key, name: a.name, desc: a.desc, colors: a.colors, list });
  }
  fs.writeFileSync(path.join(__dirname, '../../server/engine/tuned_decks.json'), JSON.stringify(tuned, null, 1));
  const named = {}; const keyOf = {};
  for (const t of tuned) { named[t.name] = t.list; keyOf[t.name] = t.key; }
  for (const m of META) { named[m.name] = m.list; keyOf[m.name] = m.key; }
  named['随机'] = 'RANDOM'; named['强力随机'] = 'RANDOM_STRONG';
  const r = await runTourney(named, +process.env.G || 10, 'hard');
  const wr = {};
  r.rows.sort((a, b) => b.wr - a.wr).forEach(x => { console.log((x.wr * 100).toFixed(1).padStart(5) + '%', x.nm); if (keyOf[x.nm]) wr[keyOf[x.nm]] = +x.wr.toFixed(3); });
  fs.writeFileSync(path.join(__dirname, '../../server/engine/deck_winrates.json'), JSON.stringify(wr, null, 1));
  fs.writeFileSync(path.join(__dirname, 'last_tourney.json'), JSON.stringify(r));
})();
