const N='BP01-099',L='TD02-006',f=(n,id=N)=>Array(n).fill(id);
const S=(you,op,turn=5)=>({turnNo:5,limit:{pi:0,turn},players:[Object.assign({name:'你',life:3,deck:f(8)},you),Object.assign({name:'残局对手',life:3,deck:f(10)},op)]});
const out=[];
for(const life of [3,4,5]) out.push({id:'abyss'+life,sc:S({souls:4,base:['TD02-012','TD02-014','TD02-016'],hand:['BP01-083'],deck:[N,N,N]},
   {life,souls:2,base:['BP01-099','BP01-032','TD01-024','TD02-001'],hand:['TD02-017'],deck:[N,N,N,N,N,N]})});
for(const life of [2,3]) for(const lk of [9,1]) { const d=f(6); if(lk<9)d.splice(lk,0,L);
  out.push({id:`bell${life}_${lk}`,sc:S({life:1,souls:3,base:['TD01-008','BP01-015','BP01-018','BP01-011','BP01-006','BP01-009'],hand:[],deck:[N,N,N,N]},
   {life,base:['TD02-001','BP01-099','BP01-032'],deck:d})}); }
for(const life of [2,3]) for(const bl of [['TD02-001'],['TD02-001','BP01-099']]) for(const lk of [9,0,1]) { const d=f(6); if(lk<9)d.splice(lk,0,L);
  out.push({id:`pharm${life}_${bl.length}_${lk}`,sc:S({souls:3,base:['BP01-089','BP01-090','BP01-080','TD02-016','TD02-015'],hand:[],deck:[N,'BP01-087',N,N,N,N]},
   {life,base:bl,deck:d})}); }
module.exports=out;
