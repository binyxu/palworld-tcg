// 残局生成器：随机局面 → 求解器筛选（必胜、首步必胜着少、困难 AI 解不出、解答长）
// 用法：node test/gen.js <seed> <count> [turns=1|2]  输出到 tools/puzzle_cands/<seed>.json
const fs = require('fs'), path = require('path');
const { db, Game } = require('../server/engine');
const { Solver, moves, child, mainLine } = require('../server/solver');
const { AI } = require('../server/ai');
const seed0 = +process.argv[2] || 1, COUNT = +process.argv[3] || 200, TURNS = +process.argv[4] || 1;
let s = seed0 >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const ALL = Object.values(db);
const COLS = ['red', 'blue', 'green', 'purple'];
const filler = 'BP01-099', lucky = ALL.filter(c => c.lucky && c.kind === 'pal').map(c => c.id);
function gen() {
  const col = pick(COLS), ocol = pick(COLS);
  const pool = ALL.filter(c => !c.color || c.color === col), opool = ALL.filter(c => !c.color || c.color === ocol);
  const pals = pool.filter(c => c.kind === 'pal' && c.cost <= 8), nonpal = pool.filter(c => c.kind !== 'pal' && c.cost <= 6);
  const opals = opool.filter(c => c.kind === 'pal' && c.cost <= 8);
  const hero = { name: '你', life: TURNS > 1 ? ri(1, 3) : ri(2, 5), souls: ri(2, 7), material: pick([0, 0, 1, 3]), ingredient: pick([0, 0, 2, 3]),
    base: Array.from({ length: ri(1, 3) }, () => pick(pals).id), hand: Array.from({ length: ri(1, 3) }, () => pick(rnd() < .5 ? nonpal : pals).id), deck: [] };
  if (rnd() < .4) hero.base.push(pick(nonpal.filter(c => c.kind !== 'event')).id);
  for (let i = 0; i < 8; i++) hero.deck.push(rnd() < .15 ? pick(lucky) : pick(pals).id);
  const op = { name: '残局对手', life: ri(2, 5), souls: ri(1, 6), base: [], hand: [], deck: [] };
  const nOp = ri(0, 3);
  for (let i = 0; i < nOp; i++) { const c = pick(opals); op.base.push({ id: c.id, rested: rnd() < .45 }); }
  if (rnd() < .25) op.base.push(pick(['BP01-091', 'TD01-019', 'BP01-042', 'TD01-008', 'BP01-066']));
  if (rnd() < .35) op.hand.push(pick(opals.filter(c => /妨碍|快速/.test(c.text || '')).map(c => c.id).concat(['TD02-011', 'TD01-011', 'BP01-096'].filter(id => !db[id].color || db[id].color === ocol))) || filler);
  for (let i = 0; i < 10; i++) op.deck.push(rnd() < .22 ? pick(lucky) : filler);
  return { turnNo: 5, limit: { pi: 0, turn: 5 + 2 * (TURNS - 1) }, players: [hero, op] };
}
const mk = sc => new Game({ db, decks: [[], []], names: ['你', '残局对手'], seed: 7, scenario: JSON.parse(JSON.stringify(sc)) });
const out = [], st = { gen: 0, solv: 0, few: 0, aifail: 0 };
for (let n = 0; n < COUNT; n++) { try { one(); } catch (e) { } }
function one() {
  let sc; try { sc = gen(); mk(sc); } catch (e) { return; }
  const g = mk(sc);
  if (!g.pending || g.pending.player !== 0) return;
  st.gen++; const S = new Solver({ hero: 0, maxNodes: 40000 });
  let ok; try { ok = S.win(g); } catch (e) { return; }
  if (!ok) return; st.solv++;
  // 收紧：提高对手生命直到无解，取最后一个可解的
  let S2 = S;
  for (let lf = sc.players[1].life + 1; lf <= 10; lf++) {
    const t = JSON.parse(JSON.stringify(sc)); t.players[1].life = lf;
    const X = new Solver({ hero: 0, maxNodes: 40000 }); let w; try { w = X.win(mk(t)); } catch (e) { w = false; }
    if (!w) break; sc = t; S2 = X;
  }
  const S_ = S2;
  const g2 = mk(sc), all = moves(g2), wm = S_.winningMoves(g2);
  if (wm.length * 2 > all.length) return; st.few++;
  // 困难 AI 当玩家
  let aiw = 0;
  for (let k = 0; k < 3; k++) {
    let x = mk(sc); const ai = new AI('hard', k + 11); const R = new Solver({ hero: 0, maxNodes: 40000 }); let guard = 0;
    try { while (!x.over && x.pending && guard++ < 300) x = child(x, x.pending.player === 0 ? ai.decide(x, 0) : R.refute(x)); } catch (e) { aiw = 9; break; }
    if (x.over && x.over.winner === 0) aiw++;
  }
  if (aiw > 0) return; st.aifail++;
  let ml; try { ml = mainLine(mk(sc)); } catch (e) { return; }
  if (!ml) return;
  const heroSteps = ml.line.filter(x => x.p === 0).length;
  out.push({ score: S_.nodes * (all.length / wm.length) * heroSteps, nodes: S_.nodes, first: `${wm.length}/${all.length}`, heroSteps, sc, line: ml.line.map(x => (x.p ? '对手 ' : '你 ') + x.label), end: ml.over && ml.over.reason });
  process.stdout.write('+'); fs.mkdirSync(path.join(__dirname, '../tools/puzzle_cands'), { recursive: true }); fs.writeFileSync(path.join(__dirname, `../tools/puzzle_cands/t${TURNS}_${seed0}.json`), JSON.stringify(out, null, 1));
}
out.sort((a, b) => b.score - a.score);
fs.mkdirSync(path.join(__dirname, '../tools/puzzle_cands'), { recursive: true });
fs.writeFileSync(path.join(__dirname, `../tools/puzzle_cands/t${TURNS}_${seed0}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify(st)); console.log(`\nseed ${seed0} turns ${TURNS}: ${out.length} candidates`);
