// 残局分析：node tools/pz/an.js drafts.js [id] [-v]
// 求解 + 主线每个己方决策点的"必胜选项/总选项" + 困难AI/随机玩家的通过率
const { db, Game } = require('../../server/engine');
const { Solver, moves, child } = require('../../server/solver');
const { AI } = require('../../server/ai');
const D = require(require('path').resolve(process.argv[2]));
const V = process.argv.includes('-v'), only = process.argv[3] && process.argv[3] !== '-v' ? process.argv[3] : null;
const mk = sc => new Game({ db, decks: [[], []], names: ['你', '残局对手'], seed: 7, scenario: JSON.parse(JSON.stringify(sc)) });
const lab = (g, m) => { const q = g.pending; return q.kind === 'main' ? q.actions[m].label : q.kind === 'option' ? q.options[m] : '[' + m.map(u => { const c = g.findCard(u); return c ? c.def.name.split(' ').pop() : u; }).join(',') + ']'; };
for (const p of D) {
  if (only && p.id !== only) continue;
  const t0 = Date.now(); let g = mk(p.sc); const S = new Solver({ hero: 0, maxNodes: +process.env.MAXN || 800000 });
  let ok; try { ok = S.win(g); } catch (e) { ok = 'X'; }
  if (ok !== true) { console.log(`\n== ${p.id} ${p.title || ''}: ${ok === 'X' ? '超限' : '无解'} nodes=${S.nodes}`); continue; }
  // 主线
  const crit = []; let steps = 0, prod = 1; const line = [];
  while (!g.over && g.pending) {
    const q = g.pending;
    if (q.player === 0) {
      const all = moves(g), wm = S.winningMoves(g); steps++;
      if (all.length > 1) { prod *= wm.length / all.length; if (wm.length === 1 && all.length >= 3) crit.push(lab(g, wm[0])); }
      line.push(`${wm.length}/${all.length} ${lab(g, wm[0])}`);
      g = child(g, wm[0]);
    } else { const r = S.refute(g); line.push(`   敌: ${lab(g, r)}`); g = child(g, r); }
  }
  let ai = 0; for (let k = 0; k < 4; k++) { let x = mk(p.sc); const A = new AI('hard', k + 3); let gd = 0;
    try { while (!x.over && x.pending && gd++ < 400) x = child(x, x.pending.player === 0 ? A.decide(x, 0) : S.refute(x)); } catch (e) { }
    if (x.over && x.over.winner === 0) ai++; }
  let rnd = 0; const R = 40; for (let k = 0; k < R; k++) { let x = mk(p.sc); let gd = 0, s = k * 7 + 1; const rr = () => (s = (s * 16807) % 2147483647) / 2147483647;
    try { while (!x.over && x.pending && gd++ < 400) { if (x.pending.player === 0) { const ms = moves(x); x = child(x, ms[Math.floor(rr() * ms.length)]); } else x = child(x, S.refute(x)); } } catch (e) { }
    if (x.over && x.over.winner === 0) rnd++; }
  console.log(`\n== ${p.id} ${p.title || ''}: 必胜 nodes=${S.nodes} 己方决策=${steps} 唯一关键步=${crit.length} 随机命中率=${(prod * 100).toPrecision(2)}% 困难AI=${ai}/4 随机玩家=${rnd}/${R} ${Date.now() - t0}ms`);
  if (V) console.log(line.map(x => '   ' + x).join('\n')); else console.log('   关键：' + crit.join(' | '));
}
