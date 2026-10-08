// 验证所有残局：①存在必胜解 ②首步必胜着法占比 ③给出主线 ④"困难 AI 当玩家"能否解出（衡量难度）
const { db, Game } = require('../server/engine');
const { PUZZLES } = require('../server/puzzles');
const { Solver, moves, child, mainLine } = require('../server/solver');
const { AI } = require('../server/ai');
const only = process.argv[2];
const mk = p => new Game({ db, decks: [[], []], names: ['你', '残局对手'], seed: 7, scenario: JSON.parse(JSON.stringify(p.sc)) });
for (const p of PUZZLES) {
  if (only && p.id !== only) continue;
  const t0 = Date.now();
  const g = mk(p);
  const S = new Solver({ hero: 0, maxNodes: +process.env.MAXN || 400000 });
  let ok, err = '';
  try { ok = S.win(g); } catch (e) { ok = false; err = e.message; }
  const all = moves(g), wm = ok ? S.winningMoves(g) : [];
  console.log(`\n${p.id} Lv${p.level} ${p.title}: ${ok ? '✔ 必胜' : '✘ 无解 ' + err}  节点 ${S.nodes}  首步必胜 ${wm.length}/${all.length}  ${Date.now() - t0}ms`);
  if (ok && process.env.LINE) {
    const ml = mainLine(mk(p));
    for (const s of ml.line) console.log(`   ${s.p === 0 ? '你  ' : '对手'} ${s.label}`);
    console.log('   =>', ml.over && ml.over.reason);
  }
  // 困难 AI 当玩家，对手为求解器最强应对
  if (ok && process.env.AI !== '0') {
    let wins = 0; const T = 5;
    for (let k = 0; k < T; k++) {
      let x = mk(p); const ai = new AI('hard', k + 1); const R = new Solver({ hero: 0 });
      let guard = 0;
      while (!x.over && x.pending && guard++ < 300) {
        const q = x.pending;
        const a = q.player === 0 ? ai.decide(x, 0) : R.refute(x);
        x = child(x, a);
      }
      if (x.over && x.over.winner === 0) wins++;
    }
    console.log(`   困难AI当玩家：${wins}/${T} 解出`);
  }
}
