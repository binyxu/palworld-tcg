const N='BP01-099',L='TD02-006',L2='TD01-017',L3='BP01-055',f=(n,id=N)=>Array(n).fill(id);
const S=(you,op,turn=5)=>({turnNo:5,limit:{pi:0,turn},players:[Object.assign({name:'你',life:3,deck:f(8)},you),Object.assign({name:'残局对手',life:10},op)]});
module.exports=[
 // 燧火鸟：全体红色+1打击，☆墙分段 3/4/2
 {id:'m_bird',sc:S({souls:0,base:['BP01-010','BP01-013','TD01-002','TD01-003']},{base:[],deck:[N,N,L,N,N,N,L2,N,N]})},
 {id:'m_bird2',sc:S({souls:0,base:['BP01-010','BP01-013','TD01-002','TD01-003']},{base:['BP01-099'],deck:[N,N,L,N,N,N,L2,N]})},
 // 武器工作台：任命也算"用掉"一只攻击者
 {id:'m_bench',sc:S({souls:0,material:1,base:['TD01-009','BP01-013','TD01-002','TD01-003','BP01-006']},{base:[],deck:[N,N,L,N,L2,N,N,N]})},
 // 突破磨牌
 {id:'m_break',sc:S({souls:3,ingredient:2,base:['BP01-059','BP01-068','TD01-002']},{base:[{id:'BP01-054',rested:true},'TD02-001'],deck:[N,N,L,N,N]})},
 // 两回合：对手抽卡也会磨
 {id:'m_draw',sc:S({souls:2,base:['BP01-013','TD01-002','BP01-033']},{base:['BP01-099'],souls:0,deck:[N,L,N,L2,N]},7)},
];
