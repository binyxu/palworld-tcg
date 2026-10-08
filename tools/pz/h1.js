const N='BP01-099',L='TD02-006',f=(n,id=N)=>Array(n).fill(id);
const S=(you,op,turn=5)=>({turnNo:5,limit:{pi:0,turn},players:[Object.assign({name:'你',life:3,deck:f(8)},you),Object.assign({name:'残局对手',life:3,deck:f(10)},op)]});
module.exports=[
 {id:'bell',title:'警钟',sc:S({life:1,souls:3,base:['TD01-008','BP01-015','BP01-018','BP01-011','BP01-006','BP01-009'],hand:[],deck:['TD01-011',N,N,N]},
   {life:4,base:['TD02-001','BP01-099','BP01-032'],deck:[N,N,L,N,N,N]})},
 {id:'griffin',title:'异构格里芬',sc:S({souls:6,base:['BP01-074','BP01-073','BP01-089'],hand:['BP01-080','BP01-087'],deck:[N,N,N]},
   {life:6,base:['TD01-024','TD01-023','TD02-001','BP01-099'],deck:[N,L,N,N,N,N]})},
 {id:'adv',title:'冒险的开始',sc:S({souls:8,base:['TD01-023','BP01-099'],hand:['BP01-100','BP01-100','SS01-004','TD02-024'],deck:['TD02-023',N,N,N]},
   {life:7,base:['TD02-001','BP01-013'],deck:[N,N,L,N,N,N,N,N]})},
];
