const N='BP01-099',L='TD02-006',f=(n,id=N)=>Array(n).fill(id);
const S=(you,op,turn=5)=>({turnNo:5,limit:{pi:0,turn},players:[Object.assign({name:'你',life:3,deck:f(8)},you),Object.assign({name:'残局对手',life:3,deck:f(10)},op)]});
module.exports=[
 {id:'dr_a',sc:S({souls:1,base:['BP01-031','BP01-040','BP01-044','BP01-037','TD01-013'],hand:['BP01-099','TD01-013']},{life:3,base:['TD02-001','BP01-013','TD01-018'],deck:f(6)})},
 {id:'dr_b',sc:S({souls:1,base:['BP01-031','BP01-040','BP01-044','BP01-037','TD01-013'],hand:['BP01-099','TD01-013']},{life:3,base:['TD02-001','BP01-013','TD01-018'],deck:[N,L,N,N,N]})},
 {id:'dr_c',sc:S({souls:1,base:['BP01-031','BP01-040','BP01-044','BP01-037','TD01-013'],hand:['BP01-099','TD01-013']},{life:4,base:['TD02-001','BP01-013','TD01-018'],deck:f(6)})},
];
