const N='BP01-099',L='TD02-006',f=(n,id=N)=>Array(n).fill(id);
const S=(you,op,turn=5)=>({turnNo:5,limit:{pi:0,turn},players:[Object.assign({name:'你',life:3,deck:f(8)},you),Object.assign({name:'残局对手',life:3,deck:f(10)},op)]});
const out=[];
for(const life of [3,4]) for(const lk of [9,1]) { const d=f(6); if(lk<9)d.splice(lk,0,L);
 out.push({id:`moon${life}_${lk}`,sc:S({souls:4,base:['BP01-074','BP01-073','BP01-080','BP01-088','BP01-090'],grave:['BP01-087','BP01-099','TD02-016'],hand:[],deck:[N,N,N]},
   {life,base:['TD02-001','BP01-099','BP01-032','TD01-024','BP01-035'],deck:d})}); }
for(const life of [3,4]) out.push({id:`dresser${life}`,sc:S({souls:4,base:['BP01-031','BP01-040','BP01-044','BP01-037','TD01-013'],hand:['TD01-013','BP01-042'],deck:[N,N,N]},
   {life,base:['TD02-001','BP01-013','TD01-018'],deck:f(6)})});
module.exports=out;
