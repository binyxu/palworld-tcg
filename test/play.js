// node test/play.js drafts.js id "label substr|idx" ...  逐步执行并打印
const { db, Game } = require('../server/engine');
const D = require(require('path').resolve(process.argv[2])); const p = D.find(x => x.id === process.argv[3]);
const g = new Game({ db, decks: [[], []], names: ['你', '敌'], seed: 7, scenario: JSON.parse(JSON.stringify(p.sc)) });
const show = () => { const q = g.pending; if (!q) return console.log('OVER', g.over);
  const P = i => g.p[i]; console.log(`  [P${q.player}] ${q.kind}: ${q.prompt || ''}`);
  for (let i = 0; i < 2; i++) console.log(`    P${i} L${P(i).life} 魂${P(i).souls.filter(s=>!s.rested).length}/${P(i).souls.length} 食${P(i).ingredient} 素${P(i).material} 场:${P(i).base.map(c=>c.def.name.split(' ').pop()+(c.rested?'(横)':'')+(g.isPal(c)?g.power(c)+'/'+g.strike(c):'')).join(',')} 手:${P(i).hand.map(c=>c.def.name.split(' ').pop()).join(',')}`);
  if (q.kind === 'main') q.actions.forEach((a, i) => console.log(`     ${i}: ${a.label}`));
  if (q.kind === 'option') q.options.forEach((a, i) => console.log(`     ${i}: ${a}`));
  if (q.kind === 'select') console.log('     cands', q.cands.map(u => { const c = g.findCard(u); return u + ':' + (c ? c.def.name.split(' ').pop() : '?'); }).join(' '), 'min', q.min, 'max', q.max); };
show();
for (const st of process.argv.slice(4)) {
  const q = g.pending; let a;
  if (q.kind === 'select') a = st === '-' ? [] : st.split(',').map(Number);
  else if (/^\d+$/.test(st)) a = +st;
  else { const L = q.kind === 'main' ? q.actions.map(x => x.label) : q.options; a = L.findIndex(x => x.includes(st)); if (a < 0) { console.log('no match', st); break; } }
  console.log('>>', st); g.answer(q.player, a); show();
}
console.log(g.log.slice(-12).map(x => typeof x === 'string' ? x : x.text || JSON.stringify(x)).join('\n'));
