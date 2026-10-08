// 新手教程：按引导的预期操作把每一课打完，验证能获胜、每一步的触发条件都会出现
'use strict';
const { db, Game } = require('../server/engine');
const { TUTORIALS, TutorAI } = require('../server/tutorials');
// 学生的操作脚本：[正则, 选择] —— main 阶段匹配行动 label；option 匹配选项；select 匹配候选卡名
const PLAN = {
  t1: ['使用.*火灵儿', '火灵儿.*发起攻击', '对手玩家', '结束回合', '使用.*电棘鼠', '火灵儿.*发起攻击', '对手玩家', '电棘鼠.*发起攻击', '对手玩家'],
  t2: ['火灵儿.*发起攻击', '对手玩家', '火麒麟.*发起攻击', '对手玩家'],
  t3: ['电棘鼠.*发起攻击', '对手玩家', '火麒麟.*发起攻击', '对手玩家'],
  t4: ['武器工作台.*起动', '电棘鼠', '猎狼', '火灵儿.*发起攻击', '对手玩家'],
  t5: ['电棘鼠.*发起攻击', '对手玩家', '火麒麟.*发起攻击', '对手玩家'],
};
const V = process.argv.includes('-v');
let fail = 0;
for (const T of TUTORIALS) {
  const g = new Game({ db, decks: [[], []], names: ['你', '教练'], seed: 1, scenario: JSON.parse(JSON.stringify(T.sc)) });
  const ai = new TutorAI(T.opp), plan = [...PLAN[T.id]];
  let n = 0, logN = 0, si = 0; const steps = T.steps;
  const advance = () => {
    const nl = g.log.slice(logN); logN = g.log.length;
    if (V) nl.forEach(l => console.log('   |', l));
    while (si < steps.length) { const s = steps[si]; if (s.next) { si++; continue; } if (s.log && nl.some(l => new RegExp(s.log).test(l))) { si++; continue; } break; }
  };
  advance();
  while (!g.over && n++ < 60) {
    const q = g.pending; if (!q) break;
    let a;
    if (q.player === 1) a = ai.decide(g, 1);
    else {
      const nm = u => { const c = g.findCard(u); return c ? g.cname(c) : String(u); };
      if (plan[0] === '对手玩家' && q.kind !== 'option') plan.shift();   // 只有一个合法目标时不会询问
      const want = plan[0] ? new RegExp(plan[0]) : null;
      if (q.kind === 'main') { const i = want ? q.actions.findIndex(x => want.test(x.label)) : -1; if (i >= 0) { plan.shift(); a = i; } else a = q.actions.findIndex(x => x.t === 'end'); }
      else if (q.kind === 'option') { const i = want ? q.options.findIndex(o => want.test(o)) : -1; if (i >= 0) { plan.shift(); a = i; } else a = 0; }
      else if (q.kind === 'select') { const c = want ? q.cands.filter(u => want.test(nm(u))) : []; if (c.length) { plan.shift(); a = c.slice(0, Math.max(1, q.min || 0)); } else a = q.cands.slice(0, q.min || 0); }
      else a = q.min || 0;
      if (V) console.log(`  [${q.kind}] ${q.prompt} → ${JSON.stringify(a)} ${q.kind === 'main' ? '(' + q.actions.map(x => x.label).join(' / ') + ')' : q.kind === 'option' ? '(' + q.options.join(' / ') + ')' : q.kind === 'select' ? '(' + q.cands.map(nm).join(' / ') + ')' : ''}`);
    }
    g.answer(q.player, a); advance();
  }
  advance();
  while (plan[0] === '对手玩家') plan.shift();
  const won = g.over && g.over.winner === 0, stepOk = si === steps.length - 1 && steps[si].win;
  console.log(`${T.id} ${T.title}: ${won ? '胜利' : '未获胜 ' + JSON.stringify(g.over)}，引导走到第 ${si + 1}/${steps.length} 步 ${won && stepOk && !plan.length ? '✔' : '✘ 剩余操作 ' + JSON.stringify(plan)}`);
  if (!(won && stepOk && !plan.length)) fail++;
}
process.exit(fail ? 1 : 0);
