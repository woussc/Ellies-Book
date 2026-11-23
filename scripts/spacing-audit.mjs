// Cross-page UI quality gate. See docs/UI-QUALITY.md for scope and manual checks.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as m from '../app/book/model.mjs';
import * as lm from '../app/book/library-model.mjs';
import {prepareRepeats,openPeriod} from '../app/book/repeat-model.mjs';
import {carryoverFixture} from './carryover-fixtures.mjs';
const root=process.env.SPACING_OUT||'artifacts/spacing';
const base=process.env.BASE_URL||'http://localhost:3000/';
await fs.mkdir(root,{recursive:true});
const template=m.exampleBudget();
template.sample=false;
template.categories[0].name='Home, bills and long-term improvements';
template.expenses=Array.from({length:5},(_,i)=>({
 ...template.expenses[0],id:'spacing-entry-'+i,
 description:i===0?'A longer spending entry with a receipt and project details':'Spending entry '+(i+1),
 amount:i===4?999999999.99:125.5+i,notes:'## Receipt\nA note attached to this entry. [[Home, bills and long-term improvements]] #home'
}));
const modes=['Household','Just me','Team'],widths=[320,390,430,768,1440];
let library=lm.emptyLibrary();
for(const [i,profile] of modes.entries()){
 let b=structuredClone(template);b.id='spacing-'+i;b.name=profile+' November project';b.profile=profile;b.total=[1200,3000,10000][i];b.notes='Existing project note for spacing review.';
 b.categories=b.categories.map(c=>({...c,owner:profile==='Team'?'SHUAI':'',glCode:profile==='Team'?'001230':''}));
 b.expenses=b.expenses.map((e,j)=>{const status=['planned','committed','paid','paid','paid'][j];return {...e,status,history:[status]};});
 b.period='2026-11';b.startDate='2026-11-01';b.endDate='2026-11-30';
 const repeatEntry=b.expenses.at(-1),repeatId='spacing-repeat-'+i;
 repeatEntry.repeatId=repeatId;repeatEntry.occurrenceDate='2026-11-01';repeatEntry.date='2026-11-01';
 b.repeatRules=[{id:repeatId,frequency:'monthly',startDate:'2026-11-01',description:repeatEntry.description,amount:repeatEntry.amount,categoryId:repeatEntry.categoryId,skipped:[]}];
 b=prepareRepeats(b);
 library=lm.changeLibrary(library,{type:'book',name:profile+' book',project:b});
 const future={...openPeriod(structuredClone(b),'2026-12',{startDate:'2026-12-01',endDate:'2026-12-31'}),id:'spacing-future-'+i,name:'Future '+profile};
 library=lm.changeLibrary(library,{type:'book',name:'Future '+profile+' book',project:future});
 const empty={...m.blankBudget(profile),id:'spacing-empty-'+i,name:'Empty '+profile,total:100,created:true,categories:[],startDate:'2026-11-01',endDate:'2026-11-30'};
 library=lm.changeLibrary(library,{type:'book',name:'Empty '+profile+' book',project:empty});
 for(const variant of ['unset','adjusted','empty'])library=lm.changeLibrary(library,{type:'book',name:`Carryover ${variant} ${profile}`,project:carryoverFixture(profile,variant)});
}
library=lm.changeLibrary(library,{type:'select',id:'spacing-0'});
await fs.writeFile(root+'/fixtures.md',lm.serializeLibrary(library));
let rows=[];
const engines=process.env.ENGINES?.split(',')||['chromium','webkit'];
const selectedWidths=process.env.WIDTHS?process.env.WIDTHS.split(',').map(Number):widths;
const selectedModes=process.env.MODES?process.env.MODES.split(','):modes;
for(const engine of engines){
 const browser=await ({chromium,webkit}[engine]).launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1,...(engine==='webkit'?{isMobile:true}:{})});
 const p=await context.newPage();p.setDefaultTimeout(8000);
 const runtimeErrors=[];
 p.on('pageerror',e=>runtimeErrors.push(String(e)));
 const click=n=>p.getByRole('button',{name:n,exact:true}).click();
 const nav=async n=>{await p.locator(p.viewportSize().width<=640?'.mobile-nav':'.product-topbar nav').getByRole('button',{name:n,exact:true}).click();};
 const mode=async n=>{await p.getByRole('group',{name:'Budget mode'}).getByRole('button',{name:n,exact:true}).click();};
 const getLibrary=async()=>{const s=await p.evaluate(()=>localStorage.getItem('ellies-book:library:v1.md'));return s?lm.parseLibrary(s):lm.emptyLibrary();};
 const finances=l=>JSON.stringify(l.books.flatMap(b=>b.projects).map(b=>{const x=structuredClone(b);delete x.board;return x;}).sort((a,b)=>a.id.localeCompare(b.id)));
 let baseline=null;
 async function snap(state,md,w,{shot=true}={}){
  await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(90);
  const data=await p.evaluate((state)=>{
   const modal=document.querySelector('dialog[open],.ai-sheet');
   const visible=e=>{let r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&(!modal||modal.contains(e));};
   const rr=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const text=e=>(e.getAttribute('aria-label')||e.textContent||e.getAttribute('name')||e.type||'').trim().replace(/\s+/g,' ').slice(0,110);
   const fields=[...document.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=radio]):not([type=checkbox]),textarea,select')].filter(visible).map(e=>{
    const label=e.closest('label'),r=rr(e),l=label?rr(label):null;
    return {name:text(label||e),type:e.type,rect:r,label:l,overflow:l?Math.max(0,r.right-l.right,l.x-r.x):0,appearance:getComputedStyle(e).appearance};
   });
   const controls=[...document.querySelectorAll('main button,main summary,dialog button,.ai-sheet button')].filter(visible);
   const small=controls.filter(e=>{let r=rr(e);return r.w<43.5||r.h<43.5;}).map(e=>({name:text(e),rect:rr(e)}));
   const overlaps=[];
   for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
    const a=controls[i],b=controls[j];if(a.contains(b)||b.contains(a))continue;
    const x=rr(a),y=rr(b),iw=Math.min(x.right,y.right)-Math.max(x.x,y.x),ih=Math.min(x.bottom,y.bottom)-Math.max(x.y,y.y);
    if(iw>1&&ih>1)overlaps.push({a:text(a),b:text(b),width:iw,height:ih});
   }
   const dates=fields.filter(e=>e.type==='date');
   const dateOverlap=[];
   for(let i=0;i<dates.length;i++)for(let j=i+1;j<dates.length;j++){
    const a=dates[i].rect,b=dates[j].rect;if(Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1)dateOverlap.push([dates[i].name,dates[j].name]);
   }
   const crossings=[];
   const headings=[...document.querySelectorAll('.garden-section-label h2')].filter(visible);
   for(const path of document.querySelectorAll('.garden-links path')){
    const matrix=path.getScreenCTM();if(!matrix)continue;
    for(const h of headings){
     const range=document.createRange();range.selectNodeContents(h);const boxes=[...range.getClientRects()];
     let found=false;for(let n=0;n<path.getTotalLength();n+=1){let pt=path.getPointAtLength(n).matrixTransform(matrix);if(boxes.some(r=>pt.x>r.left&&pt.x<r.right&&pt.y>r.top&&pt.y<r.bottom)){found=true;break;}}
     if(found)crossings.push({heading:h.textContent,path:path.getAttribute('data-relationship')});
    }
   }
   const fills=[...document.querySelectorAll('.garden-entry-open,.mode-switch button')].filter(visible).map(e=>({name:text(e),background:getComputedStyle(e).backgroundColor,appearance:getComputedStyle(e).appearance}));
   const spacingIssues=[];
   const actionContentInsets=[];
   for(const button of document.querySelectorAll('.expense-row>.text-button')){
    if(!visible(button))continue;
    const b=rr(button),range=document.createRange(),walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);
    const content=[];let node;
    while((node=walker.nextNode()))if(node.textContent.trim()){range.selectNodeContents(node);content.push(...range.getClientRects());}
    content.push(...[...button.querySelectorAll('svg')].map(e=>e.getBoundingClientRect()));
    if(!content.length)continue;
    const insets={name:text(button),left:Math.min(...content.map(r=>r.left))-b.x,right:b.right-Math.max(...content.map(r=>r.right))};
    actionContentInsets.push(insets);
    if(insets.left<15.5||insets.right<15.5)spacingIssues.push('Entry stage action needs 16px text/icon insets');
   }
   for(const card of document.querySelectorAll('.expense-row')){
    if(!visible(card))continue;
    const style=getComputedStyle(card);
    if(parseFloat(style.borderTopLeftRadius)<16||parseFloat(style.paddingLeft)<16||parseFloat(style.paddingRight)<16||parseFloat(style.borderTopWidth)<1)spacingIssues.push('Entry needs a rounded bordered card with 16px insets');
    const stage=card.querySelector('.garden-stage');
    if(!stage?.querySelector('svg'))spacingIssues.push('Entry stage needs its visible mark');
   }
   const addCategory=document.querySelector('.add-category');
   if(addCategory&&visible(addCategory)){
    const input=addCategory.querySelector('input'),button=addCategory.querySelector('button');
    const a=rr(input),b=rr(button),range=document.createRange();
    const content=[...button.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()).map(n=>{range.selectNode(n);return range.getBoundingClientRect();});
    content.push(button.querySelector('svg').getBoundingClientRect());
    const insets={name:text(button),left:Math.min(...content.map(r=>r.left))-b.x,right:b.right-Math.max(...content.map(r=>r.right))};
    actionContentInsets.push(insets);
    if(insets.left<15.5||insets.right<15.5)spacingIssues.push('Category action needs 16px content insets');
    const shareRow=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
    const gap=shareRow?b.x-a.right:b.y-a.bottom;
    if(gap<7.5)spacingIssues.push('Category field/action need an 8px gap');
    if(Math.abs(a.h-b.h)>1||(shareRow&&Math.abs(a.bottom-b.bottom)>1))spacingIssues.push('Category field/action alignment');
    const style=getComputedStyle(input);
    if(Math.min(parseFloat(style.paddingLeft),parseFloat(style.paddingRight))<16)spacingIssues.push('Category input needs 16px text insets');
   }
   const listSpacing=[];
   for(const list of document.querySelectorAll('.ai-sheet ul')){
    if(!visible(list))continue;
    const context=document.createElement('canvas').getContext('2d');
    const items=[...list.children].map(li=>{
     const range=document.createRange();range.selectNodeContents(li);
     const style=getComputedStyle(li);context.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
     return {name:text(li),rect:rr(li),textRight:range.getBoundingClientRect().right,markerAdvance:context.measureText('• ').width};
    });
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
     const a=items[i],b=items[j];
     if(Math.min(a.rect.bottom,b.rect.bottom)>Math.max(a.rect.y,b.rect.y)+1&&a.rect.x<b.rect.x){
      const gap=b.rect.x-b.markerAdvance-a.textRight;
      listSpacing.push({from:a.name,to:b.name,axis:'horizontal',gap});
      if(gap<11.5)spacingIssues.push('AI list text needs 12px before the next marker');
     }else if(Math.abs(a.rect.x-b.rect.x)<1&&b.rect.y>=a.rect.bottom){
      const gap=b.rect.y-a.rect.bottom;
      listSpacing.push({from:a.name,to:b.name,axis:'vertical',gap});
      if(gap<7.5)spacingIssues.push('AI list rows need an 8px gap');
     }
    }
   }
   const context=document.createElement('canvas').getContext('2d');
   for(const input of document.querySelectorAll('.input-wrap input[type=number]')){
    if(!visible(input))continue;
    const style=getComputedStyle(input);
    context.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const contentWidth=input.getBoundingClientRect().width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth);
    if(contentWidth<context.measureText('0.00').width+16)spacingIssues.push('Currency input text clearance');
   }
   for(const select of document.querySelectorAll('select')){
    if(!visible(select))continue;
    const style=getComputedStyle(select),height=select.getBoundingClientRect().height;
    const contentHeight=height-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth);
    if(contentHeight<parseFloat(style.lineHeight)-1||style.appearance!=='none'||parseFloat(style.fontSize)<16)spacingIssues.push('Native select text clearance');
   }
   if(state==='entries-action-clearance'){
    const nav=document.querySelector('.mobile-nav'),remove=document.querySelector('.remove-entry');
    if(nav&&remove&&visible(nav)&&visible(remove)&&(rr(remove).bottom>rr(nav).y||rr(remove).y<0))spacingIssues.push('Remove action hidden by phone navigation');
   }
   for(const f of fills)if(f.appearance!=='none')spacingIssues.push('Native button appearance: '+f.name);
   for(const selector of ['.garden-detail-actions','.garden-dialog .garden-toolbar']){
    const group=document.querySelector(selector);if(!group||!visible(group))continue;
    const buttons=[...group.querySelectorAll('button')].map(rr);
    if(buttons.length===2){
     const [a,b]=buttons,overlapY=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
     const gap=overlapY>1?Math.max(b.x-a.right,a.x-b.right):Math.max(b.y-a.bottom,a.y-b.bottom);
     if(gap<7.5)spacingIssues.push('Related actions need an 8px gap');
     if(Math.abs(a.h-b.h)>1)spacingIssues.push('Related action heights differ');
    }
   }
   const amount=document.querySelector('.spending-form .form-pair .input-wrap');
   const select=document.querySelector('.spending-form .form-pair select');
   if(amount&&select&&visible(amount)&&visible(select)){
    const a=rr(amount),b=rr(select);
    const shareRow=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
    if(Math.abs(a.h-b.h)>1||(shareRow&&Math.abs(a.bottom-b.bottom)>1))spacingIssues.push('Amount/category alignment');
   }
   for(const [first,last,gap] of [['.empty-library p','.empty-library button',24],['.profile-person button','.profile-person .safe-note',16]]){
    const a=document.querySelector(first),b=document.querySelector(last);
    if(a&&b&&visible(a)&&visible(b)&&rr(b).y-rr(a).bottom<gap-1)spacingIssues.push('Text/action spacing: '+first);
   }
   for(const field of fields.filter(f=>f.type==='date')){
    if(innerWidth<=640&&field.rect.w<220)spacingIssues.push('Date field needs full phone width');
   }
   const textInsets=[];
   for(const el of document.querySelectorAll('.garden-node h2,.garden-node h3,.garden-node .money')){
    if(!visible(el))continue;
    const node=rr(el.closest('.garden-node')),range=document.createRange();range.selectNodeContents(el);
    for(const r of range.getClientRects())if(r.width>0&&(r.left<node.x+15||r.right>node.right-15)){textInsets.push(text(el));break;}
   }
   return {spacingIssues,actionContentInsets,listSpacing,textInsets,documentOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),fields,small,overlaps,dateOverlap,crossings,fills,headings:[...document.querySelectorAll('main h1,dialog h1,.ai-sheet h1')].filter(visible).map(e=>e.textContent)};
  },state);
  const failures=[];
  if(data.documentOverflow>1)failures.push('Document overflow');
  if(data.fields.some(f=>f.overflow>1))failures.push('Field escapes its label');
  for(const key of ['small','overlaps','dateOverlap','crossings','spacingIssues','textInsets'])if(data[key].length)failures.push(key);
  if(runtimeErrors.length)failures.push(...runtimeErrors);
  let file=null;
  if(shot||failures.length){file=`${root}/${engine}-${md.replaceAll(' ','-')}-${w}-${state}.png`;await p.screenshot({path:file,fullPage:true});}
  const fin=baseline===null?null:finances(await getLibrary())===baseline;
  if(fin===false)throw new Error('View-only financial mutation at '+state);
  const row={engine,mode:md,width:w,state,screenshot:file,financialInvariant:fin,failures,...data};rows.push(row);
  await fs.writeFile(root+`/ledger-${engine}.json`,JSON.stringify(rows.filter(row=>row.engine===engine),null,2));
  console.log('AUDITED',engine,md,w,state,JSON.stringify({overflow:data.documentOverflow,fields:data.fields.filter(x=>x.overflow>1).map(x=>[x.name,x.overflow]),dateOverlap:data.dateOverlap,crossings:data.crossings,small:data.small.map(x=>x.name),overlaps:data.overlaps}));
 }
 await p.goto(base);
 await nav('Books');await p.getByRole('heading',{name:'A place for your next chapter.',exact:true}).waitFor();
 for(const md of selectedModes){
  await mode(md);
  for(const w of selectedWidths){await p.setViewportSize({width:w,height:w===320?700:w===390?844:w===430?932:w===768?1024:900});await snap('empty-books',md,w,{shot:w===390});}
 }
 await p.getByLabel('Restore / add books',{exact:true}).setInputFiles(root+'/fixtures.md');
 await mode('Household');await nav('Books');
 await p.getByRole('button',{name:'Open Household November project',exact:true}).click();
 if(await p.getByRole('button',{name:'Dismiss notification',exact:true}).count())await click('Dismiss notification');
 baseline=finances(await getLibrary());
 for(const md of selectedModes){
  await mode(md);
  await nav('Books');
  await p.getByRole('button',{name:'Open '+md+' November project',exact:true}).click();
  assert.equal(lm.activeBudget(await getLibrary()).profile,md);
  for(const w of selectedWidths){
   await p.setViewportSize({width:w,height:w===320?700:w===390?844:w===430?932:w===768?1024:900});
   const shots=(w===390&&md==='Household')||(w===1440&&md==='Team');
   await nav('Board');
   if(await p.getByRole('button',{name:'Show categories',exact:true}).count())await click('Show categories');
   await p.evaluate(()=>scrollTo(0,0));
   await snap('board',md,w,{shot:shots});
   await click('Arrange');await snap('arrange',md,w,{shot:shots});await click('Done arranging');
   await click('Legend');await snap('legend',md,w,{shot:shots});await p.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
   await p.locator('.garden-project').click();await snap('project-detail',md,w,{shot:shots});await p.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
   await click('Open budget details');await snap('budget-detail',md,w,{shot:shots});
   await p.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
   await p.locator('.garden-category').first().click();
   await snap('trail-folded',md,w,{shot:shots});
   await p.locator('.garden-section-label').scrollIntoViewIfNeeded();await p.evaluate(()=>scrollBy(0,-110));
   if(w<=430)await p.screenshot({path:root+`/${engine}-${md.replaceAll(' ','-')}-${w}-heading-viewport.png`});
   await p.locator('.garden-entry-open').first().scrollIntoViewIfNeeded();await p.evaluate(()=>scrollBy(0,-90));
   if(w<=430)await p.screenshot({path:root+`/${engine}-${md.replaceAll(' ','-')}-${w}-entry-button-viewport.png`});
   await p.locator('.garden-category').first().click();await snap('category-detail',md,w,{shot:shots});await p.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
   await p.locator('.garden-entry-open').first().click();await snap('entry-detail',md,w,{shot:shots});await p.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
   await click('Next 4');await snap('trail-last-page',md,w,{shot:shots});
   await p.locator('.garden-folded>button').first().click();await p.getByText('No entries in this category yet.',{exact:true}).waitFor();await snap('trail-empty',md,w,{shot:shots});
   await nav('Entries');await p.locator('.entry-filters').getByRole('button',{name:'All',exact:true}).click();await snap('entries-add',md,w,{shot:shots});
   await click('Import statement');await p.getByLabel('Account label',{exact:true}).fill('Statement spacing account');await snap('statement-source-choice',md,w,{shot:shots});
   await p.getByLabel('Choose CSV file',{exact:true}).setInputFiles('tests/fixtures/statement-import/statement.csv');
   await p.getByRole('heading',{name:'Check your columns',exact:true}).waitFor();await snap('statement-csv-columns',md,w,{shot:shots});
   await click('Check extracted rows');await snap('statement-reading',md,w,{shot:shots});
   await p.getByLabel('Bank wording',{exact:true}).fill('A long bank merchant name that still needs to stay inside the row correction field');
   await p.getByLabel('Payment amount (USD)',{exact:true}).fill('999999999.99');await p.getByLabel('This is a separate purchase, even if another payment looks the same.',{exact:true}).check();await snap('statement-large-reading',md,w,{shot:shots});
   await click('Checked, next row');await click('Leave row out');await click('Leave row out');await snap('statement-review-needs',md,w,{shot:shots});
   await p.getByRole('group',{name:'Payment review groups'}).getByRole('button',{name:/^Ready/}).click();await snap('statement-review-ready',md,w,{shot:shots});
   await p.getByRole('group',{name:'Payment review groups'}).getByRole('button',{name:/^Left out/}).click();await snap('statement-review-left-out',md,w,{shot:shots});await click('Cancel import');
   await click('Import statement');await p.getByLabel('Account label',{exact:true}).fill('Statement spacing account');await p.getByLabel('Choose PDF statement',{exact:true}).setInputFiles('tests/fixtures/statement-import/protected.pdf');
   await p.getByRole('heading',{name:'This PDF has a password',exact:true}).waitFor();await snap('statement-password',md,w,{shot:shots});
   await p.getByLabel('PDF password',{exact:true}).fill('wrong');await click('Open PDF');await p.getByText('That password did not open the PDF. Try again, or cancel and use screenshots.',{exact:true}).waitFor();await snap('statement-wrong-password',md,w,{shot:shots});
   await p.getByLabel('PDF password',{exact:true}).fill('fixture-only');await click('Open PDF');await p.getByRole('heading',{name:'How does your bank write payments?',exact:true}).waitFor();await snap('statement-pdf-column',md,w,{shot:shots});await click('Check extracted rows');await snap('statement-pdf-reading',md,w,{shot:shots});await click('Cancel import');
   await click('Import statement');await p.getByLabel('Account label',{exact:true}).fill('Statement spacing account');await p.getByLabel('Choose Screenshots',{exact:true}).setInputFiles('tests/fixtures/statement-import/screenshot.png');await snap('statement-image-order',md,w,{shot:shots});
   await p.getByText('Crop edges',{exact:true}).click();await snap('statement-image-crop',md,w,{shot:shots});await click('Read these images');await p.getByRole('heading',{name:'How does your bank write payments?',exact:true}).waitFor({timeout:45000});await click('Check extracted rows');await snap('statement-ocr-reading',md,w,{shot:shots});await click('Cancel import');
   await p.getByLabel('Repeat',{exact:true}).selectOption('monthly');await snap('repeat-monthly-preview',md,w,{shot:shots});
   await p.getByLabel('End repeat',{exact:true}).selectOption('date');await p.getByLabel('Last bill date',{exact:true}).fill('2027-03-01');await snap('repeat-end-date',md,w,{shot:shots});
   await p.getByLabel('Repeat',{exact:true}).selectOption('none');
   await p.locator('.expense-edit').first().click();await snap('entries-edit',md,w,{shot:shots});
   await p.waitForFunction(()=>document.activeElement===document.querySelector('.spending-form input'));
   await p.getByLabel('Apply changes to',{exact:true}).selectOption('future');await snap('repeat-edit-future',md,w,{shot:shots});
   await click('Stop repeating');await snap('repeat-stop-confirm',md,w,{shot:shots});await click('Keep repeating');
   await p.getByLabel('Apply changes to',{exact:true}).selectOption('this');
   await p.locator('.remove-entry').evaluate(el=>el.scrollIntoView({block:'center'}));await snap('entries-action-clearance',md,w,{shot:shots});
   await click('Remove entry');await snap('entries-remove-confirm',md,w,{shot:shots});await click('Keep entry');
   await click('Cancel');
   await p.getByRole('button',{name:/^Next period/}).click();await snap('period-date-confirm',md,w,{shot:shots});await p.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
   await p.locator('.entry-filters').getByRole('button',{name:'Committed',exact:true}).click();await snap('entries-filter',md,w,{shot:shots});
   await nav('Books');await snap('books',md,w,{shot:shots});
   await p.locator('.library-book').filter({has:p.getByRole('button',{name:'Open '+md+' November project',exact:true})}).getByRole('button',{name:'+ New project',exact:true}).click();await snap('new-project',md,w,{shot:shots});await click('Cancel');
   await nav('Books');await click('+ New book');await snap('setup-book',md,w,{shot:shots});
   await p.getByRole('textbox',{name:'Book name',exact:true}).fill('Spacing review book');await p.getByRole('button',{name:/^Continue/}).click();
   await snap('setup-project',md,w,{shot:shots});
   await p.getByRole('textbox',{name:'Project name',exact:true}).fill('Spacing review project');await p.getByRole('spinbutton',{name:'Project budget ($)',exact:true}).fill('1200');
   await p.getByRole('button',{name:/^Continue/}).click();await snap('setup-categories',md,w,{shot:shots});await click('Back');await click('Back');await click('Cancel');
   await nav('Profile');await snap('profile-data',md,w,{shot:shots});
   await click('Edit project details');await p.getByRole('heading',{name:'Budget settings',exact:true}).waitFor();await snap('budget-settings',md,w,{shot:shots});
   await p.getByLabel('Start date',{exact:true}).scrollIntoViewIfNeeded();await p.evaluate(()=>scrollBy(0,-200));
   if(w<=430)await p.screenshot({path:root+`/${engine}-${md.replaceAll(' ','-')}-${w}-dates-viewport.png`});
   await click('Edit category allocations');await snap('allocations',md,w,{shot:shots});
   await p.locator('.advanced>summary').first().click();await snap('allocations-advanced',md,w,{shot:shots});
   await nav('Board');await click('Report');await snap('report',md,w,{shot:shots});
   await click('Ask AI');await snap('ask-ai',md,w,{shot:shots});
   await p.locator('.ai-exact-copy summary').click();await snap('ask-ai-expanded',md,w,{shot:shots});await p.locator('.ai-sheet').getByRole('button',{name:'Close',exact:true}).click();
  }
  await nav('Books');await click('Open Future '+md);
  for(const w of selectedWidths){
   await p.setViewportSize({width:w,height:w<=430?844:900});
   await nav('Board');await snap('future-budget-unset',md,w,{shot:w===390});
   await click('Start from November');await snap('carryover-ahead-large',md,w,{shot:w===390||w===1440});await click('Cancel');
   await p.locator('.garden-category').first().click();await snap('future-repeat-card',md,w,{shot:w===390});
   if(await p.locator('.garden-dialog[open]').count())await p.locator('.garden-dialog[open]').getByRole('button',{name:'Close',exact:true}).click();
   await nav('Entries');await snap('future-planned-entries',md,w,{shot:w===390});
   await p.locator('.expense-edit').first().click();await snap('future-repeat-edit',md,w,{shot:w===390});await click('Cancel');
   await nav('Board');await click('Report');await snap('future-report',md,w,{shot:w===390});
  }
  await nav('Books');await click('Open Carryover unset '+md);
  for(const w of selectedWidths){
   await p.setViewportSize({width:w,height:w<=430?844:900});
   await nav('Board');await click('Start from October');await snap('carryover-review',md,w,{shot:w===390||w===1440});
   assert.equal(await p.locator('.carryover-toggle[aria-pressed=true]').count(),0);
   await p.locator('.carryover-toggle').nth(0).click();await p.locator('.carryover-toggle').nth(1).click();
   await snap('carryover-selected',md,w,{shot:w===390||w===1440});
   await p.getByRole('spinbutton',{name:/^New base for /}).nth(2).fill('10');
   await p.getByRole('button',{name:/^(Set|Approve) November budget/}).click();
   await p.getByRole('alert').filter({hasText:'negative'}).waitFor();await snap('carryover-negative-error',md,w,{shot:w===390});await click('Cancel');
  }
  await nav('Books');await click('Open Carryover adjusted '+md);
  for(const w of selectedWidths){
   await p.setViewportSize({width:w,height:w<=430?844:900});
   await nav('Board');await snap('carryover-source-changed',md,w,{shot:w===390});
   await click('Open budget details');await p.getByRole('dialog').getByRole('button',{name:'Review carryover',exact:true}).click();
   await snap('carryover-adjustment',md,w,{shot:w===390||w===1440});await click('Cancel');
   await click('Open budget details');await p.getByRole('dialog').getByText('Budget approval history',{exact:true}).click();await snap('carryover-history',md,w,{shot:w===390});await p.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  }
  await nav('Books');await click('Open Carryover empty '+md);
  for(const w of selectedWidths){await p.setViewportSize({width:w,height:w<=430?844:900});await nav('Board');await click('Start from October');await snap('carryover-empty',md,w,{shot:w===390});await click('Cancel');}
  await nav('Books');await click('Open Empty '+md);
  for(const w of selectedWidths){
   await p.setViewportSize({width:w,height:w<=430?844:900});
   await nav('Board');await snap('empty-board',md,w,{shot:w===390});
   await nav('Entries');await snap('empty-entries',md,w,{shot:w===390});
  }
 }
 await browser.close();
}
const failed=rows.filter(row=>row.failures.length);
assert.equal(failed.length,0,JSON.stringify(failed.map(({engine,mode,width,state,failures})=>({engine,mode,width,state,failures})),null,2));
console.log('COMPLETE',rows.length,'view snapshots');
