// 卡组耗尽残局生成：node tools/pz/genmill.js THEME 次数
const { db, Game } = require('../../server/engine');
const { Solver, moves, child } = require('../../server/solver');
const { AI } = require('../../server/ai');
const N='BP01-099', LS=['TD02-006','TD01-017','BP01-055','BP01-033','TD01-018'];
const T = {
 bird:{souls:0,base:['BP01-010','BP01-013','TD01-002','TD01-003','BP01-006']},
 bench:{souls:0,material:0,base:['TD01-009','TD01-008','BP01-013','TD01-002','TD01-003','BP01-011']},
 dragon:{souls:2,base:['BP01-001','TD01-002'],hand:['TD01-003','BP01-011','TD01-011']},
 blade:{souls:6,base:['BP01-004','TD01-002','TD01-003'],hand:['BP01-011']},
 bell:{souls:2,material:0,base:['TD01-008','BP01-018','BP01-013','TD01-002','BP01-011','BP01-009']},
 dresser:{souls:0,base:['BP01-040','BP01-037','TD01-013','BP01-034','BP01-028'],hand:[N,N,N]},
 adv:{souls:4,base:['TD01-023','TD02-023','BP01-099'],hand:['BP01-100','TD02-024','TD01-011']},
};
let seed = +(process.argv[4] || 1); const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647, ri = n => Math.floor(R() * n);
const theme = process.argv[2], tries = +process.argv[3] || 30;
const mk = sc => new Game({ db, decks: [[], []], names: ['你', '残局对手'], seed: 7, scenario: JSON.parse(JSON.stringify(sc)) });
const res = [];
for (let t = 0; t < tries; t++) {
  const len = 5 + ri(8), deck = Array(len).fill(N); const k = 1 + ri(3);
  for (let i = 0; i < k; i++) deck[ri(len - 1)] = LS[ri(LS.length)];
  const bl = [[], ['BP01-099'], ['TD02-001'], ['BP01-099', 'BP01-032']][ri(4)];
  const hand = R() < 0.3 ? ['TD02-017'] : [];
  const you = Object.assign({ name: '你', life: 3, deck: Array(8).fill(N), hand: [] }, JSON.parse(JSON.stringify(T[theme])));
  const sc = { turnNo: 5, limit: { pi: 0, turn: 5 }, players: [you, { name: '残局对手', life: 10, souls: hand.length ? 1 : 0, base: bl, hand, deck }] };
  const S = new Solver({ hero: 0, maxNodes: 60000 }); let ok; try { ok = S.win(mk(sc)); } catch (e) { continue; }
  if (ok !== true) continue;
  // 主线 + 随机命中率
  let g = mk(sc), prod = 1, crit = 0, steps = 0;
  while (!g.over && g.pending) { if (g.pending.player === 0) { const a = moves(g), w = S.winningMoves(g); steps++; prod *= w.length / a.length; if (w.length === 1 && a.length >= 3) crit++; g = child(g, w[0]); } else g = child(g, S.refute(g)); }
  if (!/卡组耗尽/.test(g.over.reason)) continue;
  let ai = 0; for (let j = 0; j < 3; j++) { let x = mk(sc); const A = new AI('hard', j + 3); let gd = 0; try { while (!x.over && x.pending && gd++ < 300) x = child(x, x.pending.player === 0 ? A.decide(x, 0) : S.refute(x)); } catch (e) { } if (x.over && x.over.winner === 0) ai++; }
  res.push({ score: -Math.log10(prod) + crit - ai * 2, prod, crit, ai, steps, nodes: S.nodes, sc });
}
res.sort((a, b) => b.score - a.score);
for (const r of res.slice(0, 3)) console.log(theme, 'score', r.score.toFixed(2), 'rnd%', (r.prod * 100).toPrecision(2), 'crit', r.crit, 'ai', r.ai + '/3', 'nodes', r.nodes, JSON.stringify({ deck: r.sc.players[1].deck.map(x => x === N ? '.' : '☆').join(''), bl: r.sc.players[1].base, h: r.sc.players[1].hand }));
require('fs').writeFileSync(`/tmp/mill_${theme}.json`, JSON.stringify(res.slice(0, 3).map(r => r.sc)));
console.log(theme, 'found', res.length, '/', tries);
