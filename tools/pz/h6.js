const N='BP01-099',L='TD02-006',f=(n,id=N)=>Array(n).fill(id);
const S=(you,op,turn=5)=>({turnNo:5,limit:{pi:0,turn},players:[Object.assign({name:'你',life:3,deck:f(8)},you),Object.assign({name:'残局对手',life:3,deck:f(10)},op)]});
module.exports=[
 {id:'griffin',sc:S({souls:6,base:['BP01-074','BP01-073','BP01-089'],hand:['BP01-080','BP01-087'],deck:[N,N,N]},{life:6,base:['TD01-024','TD01-023','TD02-001','BP01-099'],deck:[N,L,N,N,N,N,N,N,N,N,N]})},
 {id:'adv',sc:S({souls:8,base:['TD01-023','BP01-099'],hand:['BP01-100','BP01-100','SS01-004','TD02-024'],deck:['TD02-023',N,N,N]},{life:6,base:['TD02-001','BP01-013'],deck:[N,N,L,N,N,N,N,N,N,N,N,N]})},
];
