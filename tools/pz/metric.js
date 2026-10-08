// 难度指标：根节点必胜着法占比、求解节点数、必胜线中"不能乱走"的程度（随机玩家胜率）
const { db, Game } = require('../../server/engine');
const { Solver, moves, child } = require('../../server/solver');
function metric(sc, maxNodes = 400000) {
  const g = new Game({ db, decks: [[], []], names: ['你', '敌'], seed: 7, scenario: JSON.parse(JSON.stringify(sc)) });
  const S = new Solver({ hero: 0, maxNodes }); let ok; try { ok = S.win(g); } catch (e) { return { ok: 'X', nodes: S.nodes }; }
  if (!ok) return { ok: false, nodes: S.nodes };
  // 沿"所有走法里有多少还能赢"估计自由度：递归采样，统计每个我方决策点 必胜着法/总着法 的平均
  let ratios = [], cur = g, depth = 0;
  const S2 = new Solver({ hero: 0, maxNodes }); S2.memo = S.memo;
  while (!cur.over && cur.pending && depth++ < 80) {
    const ms = moves(cur), me = cur.pending.player === 0;
    if (me) { const w = ms.filter(m => S2.win(child(cur, m))); if (ms.length > 1) ratios.push(w.length / ms.length); cur = child(cur, w[0]); }
    else cur = child(cur, S2.refute(cur));
  }
  return { ok: true, nodes: S.nodes, steps: ratios.length, avg: ratios.length ? +(ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(2) : 1, first: ratios[0] };
}
module.exports = { metric };
if (require.main === module) {
  const { PUZZLES } = require('../../server/puzzles');
  for (const p of PUZZLES) console.log(p.id, 'L' + p.level, JSON.stringify(metric(p.sc)));
}
