const sweep=require('./sweep.js');const N='BP01-099',L='TD02-006',B='BP01-061';
const vs=[];for(const life of [2,3,4,5])for(const souls of [3,4])for(const lp of [99,2])for(const bl of [[],['TD02-001'],['TD02-001','BP01-037']])vs.push({life,souls,lp,bl});
sweep(v=>{const d=[N,N,N,N,N,N,N];if(v.lp<9)d.splice(v.lp,0,L);return{turnNo:5,limit:{pi:0,turn:5},players:[
 {name:'你',life:3,souls:v.souls,ingredient:1,base:['BP01-053','BP01-066'],hand:[],deck:[B,B,'TD02-002',B,B,N,N,N]},
 {name:'敌',life:v.life,base:v.bl,hand:[],deck:d}]}},vs);
