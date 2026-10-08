const N='BP01-099',L='TD02-006',f=(n,id=N)=>Array(n).fill(id);
const S=(you,op,turn=5)=>({turnNo:5,limit:{pi:0,turn},players:[Object.assign({name:'你',life:3,deck:f(8)},you),Object.assign({name:'残局对手',life:3,deck:f(10)},op)]});
module.exports=[
 {id:'griffin',title:'异构格里芬',sc:S({souls:6,base:['BP01-074','BP01-073','BP01-089'],hand:['BP01-080','BP01-087'],deck:[N,N,N]},
   {life:6,base:['TD01-024','TD01-023','TD02-001','BP01-099'],deck:[N,L,N,N,N,N]})},
 {id:'curtain',title:'古典式窗帘',sc:S({souls:4,base:['TD01-020','BP01-042','TD01-019','BP01-037','TD01-014','TD01-013'],hand:['BP01-039','BP01-048'],deck:['BP01-047',N,N,N,N]},
   {life:3,base:['TD02-001','BP01-013','TD01-018'],deck:[N,N,N,N,N,N]})},
 {id:'pharm',title:'中世纪制药台',sc:S({souls:3,base:['BP01-089','BP01-090','BP01-080','TD02-016','TD02-015'],hand:[],deck:[N,'BP01-087',N,N,N,N]},
   {life:3,base:['TD02-001','BP01-099'],deck:[N,N,L,N,N,N]})},
 {id:'abyss',title:'魔渊龙',sc:S({souls:4,base:['TD02-012','TD02-014','TD02-016'],hand:['BP01-083'],deck:[N,N,N]},
   {life:4,souls:2,base:['BP01-032','TD01-024','BP01-099'],hand:['TD02-017'],deck:[N,N,N,N,N]})},
 {id:'bell',title:'警钟',sc:S({life:1,souls:3,material:0,base:['TD01-008','BP01-015','BP01-018','BP01-011','BP01-006','BP01-009'],hand:[],deck:[N,N,N,N]},
   {life:3,base:['TD02-001','BP01-099','BP01-032'],deck:[N,N,N,N,N,N]})},
];
