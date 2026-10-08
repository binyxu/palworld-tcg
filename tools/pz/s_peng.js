const sweep=require('./sweep.js');const N='BP01-099',L='TD02-006';
const vs=[];for(const life of [3,4,5])for(const lp of [99,0,1,2,3,4])vs.push({life,lp});
sweep(v=>{const d=[N,N,N,N,N,N,N];if(v.lp<9)d.splice(v.lp,0,L);return{turnNo:5,limit:{pi:0,turn:5},players:[
 {name:'你',life:3,souls:2,base:['BP01-031','TD01-014','BP01-028','BP01-044'],hand:[],deck:['TD01-022','BP01-099','BP01-099']},
 {name:'敌',life:v.life,base:['TD02-001','BP01-013','TD01-018'],hand:[],deck:d}]}},vs);
