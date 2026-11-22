// Synthetic books for the spacing gate and repeatable manual acceptance.
import {blankBudget} from '../app/book/model.mjs';
import {openPeriod,prepareRepeats} from '../app/book/repeat-model.mjs';
import {previewBudgetStart,confirmBudgetStart} from '../app/book/carryover-model.mjs';

export function carryoverFixture(profile='Household',variant='unset') {
 const names=profile==='Team'?['Workspace','Meals','Travel','Supplies']:profile==='Just me'?['Rent','Food','Getting around','Personal']:['Home','Groceries','Getting around','Everyday'];
 const b={...blankBudget(profile),id:`carryover-${profile}-${variant}`,name:`Carryover ${variant} ${profile}`,sample:false,created:true,
  period:'2026-10',startDate:'2026-10-01',endDate:'2026-10-31',total:3000,
  categories:names.map((name,i)=>({id:'carry-c'+i,name,amount:[1500,600,300,600][i],owner:profile==='Team'?['Alex','Sam','Jo','Alex'][i]:'',glCode:profile==='Team'?'001230':''})),
  expenses:[['paid',1500,0],['paid',420,1],['committed',80,1],['paid',340,2],['paid',90,3],['committed',60,3],['planned',900,1]].map(([status,amount,i],j)=>({id:'carry-e'+j,categoryId:'carry-c'+i,description:names[i]+' October '+j,amount,status,history:[status],date:'2026-10-10',notes:'Receipt note stays in October.'})),
  repeatRules:[{id:'carry-rent',frequency:'monthly',startDate:'2026-11-01',description:profile==='Team'?'Workspace rent':'Monthly rent',amount:1500,categoryId:'carry-c0',skipped:[]},{id:'carry-pass',frequency:'monthly',startDate:'2026-11-01',description:profile==='Team'?'Design tools':'Travel pass',amount:80,categoryId:'carry-c2',skipped:[]}]};
 let next=openPeriod(prepareRepeats(b),'2026-11',{startDate:'2026-11-01',endDate:'2026-11-30'});
 if(variant==='adjusted') {
  const p=previewBudgetStart(next,'2026-11-22');
  next=confirmBudgetStart(next,{revision:p.revision,baseTotal:p.baseTotal,baseAmounts:Object.fromEntries(p.rows.map(r=>[r.category.id,r.base])),carryIds:['carry-c1','carry-c2']},'2026-11-22');
  next.periods.find(p=>p.period==='2026-10').expenses.find(e=>e.id==='carry-e1').amount=430;
 }
 if(variant==='empty') {next.categories=[];next.expenses=[];next.repeatRules=[];next.total=0;next.periods.forEach(p=>{p.categories=[];p.expenses=[];p.total=100;});}
 return next;
}
