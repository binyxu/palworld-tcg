// 快速检验草稿：node test/pz.js drafts.js [id]
const { db, Game } = require('../server/engine');
const { Solver, moves, child, mainLine } = require('../server/solver');
const { AI } = require('../server/ai');
const D = require(require('path').resolve(process.argv[2]));
const mk = sc => new Game({ db, decks: [[], []], names: ['你', '残局对手'], seed: 7, scenario: JSON.parse(JSON.stringify(sc)) });
for (const p of D) {
  if (process.argv[3] && p.id !== process.argv[3]) continue;
  const g = mk(p.sc), S = new Solver({ hero: 0, maxNodes: 600000 }); let ok, e = '';
  const t0 = Date.now();
  try { ok = S.win(g); } catch (x) { ok = false; e = x.message; }
  const all = moves(g), wm = ok ? S.winningMoves(g) : [];
  console.log(`\n== ${p.id} ${p.title}: ${ok ? '必胜' : '无解 ' + e} nodes=${S.nodes} first=${wm.length}/${all.length} ${Date.now() - t0}ms`);
  if (!ok) continue;
  const ml = mainLine(mk(p.sc)); console.log('  ' + ml.line.map(x => (x.p ? '【敌】' : '') + x.label).join(' → '), '⇒', ml.over && ml.over.reason);
  let w = 0; for (let k = 0; k < 4; k++) { let x = mk(p.sc); const ai = new AI('hard', k + 3), R = new Solver({ hero: 0, maxNodes: 600000 }); let gd = 0;
    while (!x.over && x.pending && gd++ < 400) x = child(x, x.pending.player === 0 ? ai.decide(x, 0) : R.refute(x)); if (x.over && x.over.winner === 0) w++; }
  console.log('  困难AI解出', w, '/4');
}
