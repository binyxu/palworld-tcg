'use strict';
// 新手教程：每课是一个固定局面（与残局同格式，见 engine/flow.js runScenario）+ 分步引导。
// 步骤字段：
//   text   引导文字（可含 <b>）
//   hl     需要高亮的界面元素：卡牌编号（如 'TD01-003'，可加前缀 me:/op: 区分双方），或 'end' 结束按钮 / 'op' 对手头像 / 'me' 我的头像 / 'souls' 我的灵魂 / 'deck' 我的卡组 / 'hand' 手牌区 / 'mpal' 'mbld' 我的帕鲁/建筑区
//   drag   [起点, 终点]：播放「手指拖动」演示动画
//   tap    元素：播放「手指点击」演示动画
//   next   true = 显示「继续」按钮，点击后进入下一步
//   log    正则字符串：对局记录中出现匹配的新行时自动进入下一步
//   win    true = 获胜即完成
// opp：教程对手的行为  block 是否阻挡 / hinder 是否使用妨碍等快速应对
const RL = n => Array(n).fill('BP01-099');   // 填充用卡组（高傲之牙 猎狼，无☆）
const TUTORIALS = [
  {
    id: 't1', title: '第 1 课 · 出牌与攻击', desc: '回合流程、灵魂、使用帕鲁、攻击对手玩家。',
    opp: {},
    sc: {
      turnNo: 2, first: 1, active: 0,
      players: [
        { name: '你', life: 10, souls: 3, hand: ['TD01-003'], deck: ['TD01-002', ...RL(10)] },
        { name: '教练', life: 3, souls: 2, hand: [], deck: RL(12) },
      ],
    },
    steps: [
      { text: '欢迎来到<b>幻兽帕鲁卡牌游戏</b>！每人有 <b>10 点生命</b>，把对手的生命打到 <b>0</b> 就获胜（卡组被抽空也会输）。<br>这一课的对手只剩 <b>3</b> 点生命。', hl: ['op'], next: true },
      { text: '左下角是你的<b>灵魂</b>，它就是出牌的「费用」，现在你有 <b>3</b> 个。<br>每个回合开始会自动：① 竖置你所有的卡 ② <b>抽 1 张卡</b> ③ <b>灵魂 +2</b>。', hl: ['souls'], next: true },
      { text: '手里的「火灵儿」费用 ◇3。把它从手牌<b>拖到我的据点</b>（或点击它）来使用。', drag: ['TD01-003', 'mpal'], log: '使用了.*火灵儿' },
      { text: '帕鲁<b>登场当回合就能攻击</b>。卡上 ⚔ 是战斗力，✱ 是打击力（打到玩家时造成的伤害）。<br>把火灵儿<b>拖到对手头像</b>上发起攻击！', drag: ['TD01-003', 'op'], log: '教练 失去 1 点生命' },
      { text: '命中！对手生命 3 → 2。攻击过的帕鲁会<b>横置</b>（横过来），本回合不能再攻击。<br>灵魂也用完了，点击<b>结束回合</b>。', tap: 'end', log: '第 4 回合' },
      { text: '新的回合：你抽到了「电棘鼠」，灵魂又增加了 2 个，横置的卡也都竖了回来。<br>使用电棘鼠，然后用<b>两只帕鲁各攻击一次</b>，打完最后 2 点生命！', drag: ['TD01-002', 'mpal'], hl: ['TD01-003', 'op'], win: true },
    ],
  },
  {
    id: 't2', title: '第 2 课 · 战斗与阻挡', desc: '攻击目标、阻挡、战斗力比较。',
    opp: { block: true },
    sc: {
      turnNo: 5, active: 0,
      players: [
        { name: '你', life: 6, souls: 4, base: ['BP01-013', 'TD01-003'], hand: [], deck: RL(10) },
        { name: '教练', life: 2, souls: 4, base: [{ id: 'BP01-099', rested: true }, 'BP01-056'], hand: [], deck: RL(10) },
      ],
    },
    steps: [
      { text: '攻击可以指向：<b>对手玩家</b>、对手的<b>建筑物</b>、或对手<b>横置</b>的帕鲁。<br>对手<b>竖置</b>的帕鲁不能被攻击，但它可以<b>阻挡</b>你的攻击，把攻击引到自己身上。', hl: ['BP01-056'], next: true },
      { text: '对手的「翠叶鼠」是竖置的，一定会来阻挡。先派战斗力较低的<b>火灵儿</b>去攻击对手玩家，让它把阻挡用掉。', drag: ['TD01-003', 'op'], log: '进行阻挡' },
      { text: '翠叶鼠阻挡了！帕鲁之间战斗时，双方<b>同时</b>对彼此造成等于自身 ⚔ 战斗力的伤害，伤害 ≥ 对方战斗力就会被送入墓地。500 对 500 —— 同归于尽。', next: true },
      { text: '对手已经没有能阻挡的帕鲁了。用<b>火麒麟</b>（✱ 打击力 2）攻击对手玩家，一击制胜！', drag: ['BP01-013', 'op'], win: true },
    ],
  },
  {
    id: 't3', title: '第 3 课 · 伤害翻卡与幸运☆', desc: '伤害如何结算、☆卡抵消伤害。',
    opp: {},
    sc: {
      turnNo: 5, active: 0,
      players: [
        { name: '你', life: 5, souls: 2, base: ['BP01-013', 'TD01-002'], hand: [], deck: RL(10) },
        { name: '教练', life: 2, souls: 4, base: [], hand: [], deck: ['TD02-006', ...RL(10)] },
      ],
    },
    steps: [
      { text: '对玩家造成 N 点伤害时，会从他的<b>卡组顶依次翻开至多 N 张</b>。翻开的卡中有带 <b>☆</b> 的（幸运卡），这<b>整次伤害就被抵消</b>，☆卡进入墓地。', next: true },
      { text: '本课对手卡组顶<b>正好是一张☆卡</b>（教程里你可以看到，真实对局中看不到）。<br>如果先用火麒麟打 2 点，☆会抵消掉这 2 点。先用打击力 1 的<b>电棘鼠</b>去「踩掉」它！', drag: ['TD01-002', 'op'], hl: ['opdeck'], log: '电棘鼠.*战斗结束|伤害.*抵消|抵消' },
      { text: '☆被翻开，这次伤害被抵消了 —— 但☆已经进入墓地。现在用<b>火麒麟</b>打出 2 点致命伤害！', drag: ['BP01-013', 'op'], win: true },
    ],
  },
  {
    id: 't4', title: '第 4 课 · 建筑物与任命', desc: '建筑物能力、任命帕鲁、素材。',
    opp: { block: true },
    sc: {
      turnNo: 5, active: 0,
      players: [
        { name: '你', life: 5, souls: 2, material: 1, base: ['TD01-009', 'TD01-002', 'TD01-003'], hand: [], deck: RL(10) },
        { name: '教练', life: 1, souls: 4, base: ['BP01-099'], hand: [], deck: RL(10) },
      ],
    },
    steps: [
      { text: '<b>建筑物</b>放在据点下方一排，不会攻击，但有各种能力。「武器工作台」：消费 1 个<b>素材</b>、<b>任命</b> 1 只帕鲁，就能对一只帕鲁造成 <b>800 伤害</b>。<br>「任命」= 把自己一只竖置的帕鲁横置，派它去建筑物里干活。', hl: ['TD01-009'], next: true },
      { text: '对手的「猎狼」竖置着，会阻挡你的攻击。点击发光的<b>武器工作台</b>起动能力：任命<b>电棘鼠</b>，把 800 伤害打在猎狼身上（500 战斗力，必死）。<br>也可以直接把电棘鼠<b>拖到工作台</b>上任命。', drag: ['TD01-002', 'TD01-009'], hl: ['op:BP01-099'], log: '高傲之牙 猎狼.*墓地|猎狼.*放置于墓地|破坏' },
      { text: '阻挡者没了！电棘鼠被任命后横置，不能攻击了，但还有<b>火灵儿</b>（武器工作台还让你所有帕鲁本回合 ✱ 打击力 +1）。去攻击对手玩家，拿下胜利！', drag: ['TD01-003', 'op'], win: true },
    ],
  },
  {
    id: 'ev', title: '第 5 课 · 事件卡', desc: '事件卡：用完即进墓地的一次性效果。',
    opp: { block: true },
    sc: {
      turnNo: 5, active: 0,
      players: [
        { name: '你', life: 5, souls: 4, base: ['BP01-013'], hand: ['TD02-021'], deck: RL(10) },
        { name: '教练', life: 2, souls: 2, base: ['TD01-006'], hand: [], deck: RL(10) },
      ],
    },
    steps: [
      { text: '卡牌一共 <b>4 类</b>：🐾帕鲁 · 🏠建筑物 · 🗡装备 · ⚡<b>事件</b>。<br>事件卡打出后立刻生效，然后进入墓地。', hl: ['TD02-021'], next: true },
      { text: '对手的雷胖达会挡住你。把「来自黑暗的一击」<b>拖到场上</b>使用。', drag: ['TD02-021', 'mpal'], log: '使用了.*来自黑暗的一击' },
      { text: '选择目标：<b>点对手的雷胖达</b>，再点确定。', tap: 'op:TD01-006', log: '雷胖达.*(墓地|被破坏)' },
      { text: '挡路的没了！<b>火麒麟 → 对手</b>，拿下！', drag: ['BP01-013', 'op'], win: true },
    ],
  },
  {
    id: 'gear', title: '第 6 课 · 装备、技能与灵魂抽卡', desc: '支付 3 灵魂抽卡、装备、帕鲁的【起】能力。',
    opp: { block: true },
    sc: {
      turnNo: 5, active: 0,
      players: [
        { name: '你', life: 4, souls: 7, material: 2, base: ['TD01-006', 'TD01-003'], hand: [], deck: ['TD01-010', ...RL(10)] },
        { name: '教练', life: 1, souls: 2, base: ['BP01-013', 'TD01-006'], hand: [], deck: RL(10) },
      ],
    },
    steps: [
      { text: '手里没牌，但有 7 个灵魂。<b>支付 3 灵魂可以抽 1 张</b>（每回合 1 次）：把<b>卡组拖到手牌区</b>。', drag: ['deck', 'hand'], log: '支付 3 灵魂抽卡' },
      { text: '抽到 🗡<b>装备</b>「单发步枪」：登场时给 1 只帕鲁 <b>1500 伤害</b>。拖到右侧建筑物/装备区。', drag: ['TD01-010', 'mbld'], log: '使用了.*单发步枪' },
      { text: '目标：<b>点对手的火麒麟</b>（1200），确定。', tap: 'op:BP01-013', log: '火麒麟.*(墓地|被破坏)' },
      { text: '装备还能<b>横置</b>来强化帕鲁：点「单发步枪」起动，给<b>你的雷胖达</b> ⚔+200。', tap: 'me:TD01-010', log: '单发步枪.*起动|战斗力.*\\+200|\\+200' },
      { text: '帕鲁自己也有【起】能力：点<b>你的雷胖达</b>，消费 2 素材 ⚔+500。', tap: 'me:TD01-006', log: '雷胖达.*起动|\\+500' },
      { text: '雷胖达现在 ⚔1800，对手的雷胖达只有 1100。<b>雷胖达 → 对手</b>，它敢挡就打爆它！', drag: ['me:TD01-006', 'op'], log: '进行阻挡' },
      { text: '阻挡者被击败。最后让<b>火灵儿 → 对手</b>！', drag: ['TD01-003', 'op'], win: true },
    ],
  },
  {
    id: 't5', title: '第 7 课 · 妨碍与试探', desc: '对手回合外的应对：妨碍、快速。',
    opp: { hinder: true },
    sc: {
      turnNo: 5, active: 0,
      players: [
        { name: '你', life: 5, souls: 2, base: ['TD01-002', 'BP01-013'], hand: [], deck: RL(10) },
        { name: '教练', life: 2, souls: 2, base: [], hand: ['TD01-004'], deck: RL(10) },
      ],
    },
    steps: [
      { text: '在你攻击时，对手可以在<b>快速步骤</b>里使用带【快速】的卡。其中最常见的是<b>【妨碍】</b>：直接让一次攻击失败。<br>对手手里有 1 张牌，而且留着灵魂没用 —— 很可疑。', hl: ['op'], next: true },
      { text: '如果先用主力火麒麟攻击，很可能被妨碍掉。先用不重要的<b>电棘鼠</b>攻击对手玩家，<b>试探</b>一下！', drag: ['TD01-002', 'op'], log: '攻击失败|妨碍' },
      { text: '果然，对手用「火绒狐」的<b>妨碍</b>挡下了电棘鼠（妨碍卡会被丢弃）。现在对手没牌了，用<b>火麒麟</b>打出 2 点致命伤害！', drag: ['BP01-013', 'op'], win: true },
    ],
  },
  {
    id: 'def', title: '第 8 课 · 防守回合', desc: '对手回合：阻挡、快速事件、妨碍的两种付法。',
    opp: { attacks: ['TD01-003', 'BP01-013', 'TD01-006'] },
    sc: {
      turnNo: 6, first: 0, active: 1,
      players: [
        { name: '你', life: 2, souls: 3, base: ['BP01-056', { id: 'TD01-002', rested: true }], hand: ['TD01-011', 'TD01-004', 'TD01-016', 'TD01-002'], deck: RL(10) },
        { name: '教练', life: 1, souls: 2, base: ['TD01-003', 'BP01-099', 'BP01-013', 'TD01-006'], hand: [], deck: RL(10) },
      ],
    },
    steps: [
      { text: '现在是<b>对手的回合</b>，你只剩 <b>2</b> 点生命，对手有 4 只帕鲁要进攻 —— 守住！', hl: ['me', 'op:*'], next: true },
      { text: '① <b>阻挡</b>：火灵儿来了。<b>点你竖置的翠叶鼠</b>挡住它（500 对 500 同归于尽）。', tap: 'me:BP01-056', log: '进行阻挡' },
      { text: '② <b>快速事件</b>：带【快速】的事件在对手回合也能用。<b>点「火焰吐息」</b>，再点对手的<b>猎狼</b>，趁它还没攻击先烧掉（500 伤害）。', tap: 'TD01-011', hl: ['op:BP01-099'], log: '火麒麟》 攻击' },
      { text: '③ <b>妨碍·付灵魂</b>：火麒麟（✱2）来了，挨打就输！<b>点「火绒狐」</b>，选［支付1灵魂、丢弃此卡］。', tap: 'TD01-004', log: '雷胖达》 攻击' },
      { text: '④ <b>妨碍·弃牌</b>：雷胖达来了，但灵魂用完了。<b>点「严冬鹿」</b>，选［丢弃此卡、丢弃1张其他手牌］，弃掉手里的电棘鼠。', tap: 'TD01-016', log: '攻击失败' },
      { text: '全部守住！对手回合结束后，<b>电棘鼠 → 对手</b>，反杀！', drag: ['TD01-002', 'op'], win: true },
    ],
  },
];
TUTORIALS.forEach((t, i) => { t.no = i + 1; t.sc.limit = t.sc.limit || null; });

// 教程对手：按课程设定做最简单、可预测的应对
class TutorAI {
  constructor(opp = {}) { this.opp = opp; }
  decide(g, pi) {
    const q = g.pending;
    if (q.kind === 'main') {
      if (q.quick && this.opp.hinder) { const i = q.actions.findIndex(a => a.t !== 'end'); if (i >= 0) return i; }
      if (!q.quick && this.opp.attacks) {
        for (const id of this.opp.attacks) { const i = q.actions.findIndex(a => a.t === 'attack' && g.findCard(a.uid).id === id); if (i >= 0) return i; }
      }
      const e = q.actions.findIndex(a => a.t === 'end'); return e >= 0 ? e : 0;
    }
    if (q.kind === 'option') {
      if (q.meta && q.meta.targets) { const i = q.meta.targets.indexOf('player'); if (i >= 0) return i; }
      if (/阻挡/.test(q.prompt)) return this.opp.block ? 0 : q.options.length - 1;
      return 0;
    }
    if (q.kind === 'select') {
      if (/阻挡/.test(q.prompt)) return this.opp.block ? q.cands.slice(0, Math.max(1, q.min || 0)) : q.cands.slice(0, q.min || 0);
      if (/丢弃|费用|支付/.test(q.prompt)) return q.cands.slice(0, Math.max(q.min || 0, 1)).slice(0, q.max ?? 1);
      return q.cands.slice(0, q.min || 0);
    }
    if (q.kind === 'num') return q.min || 0;
    return 0;
  }
}
module.exports = { TUTORIALS, TutorAI };
