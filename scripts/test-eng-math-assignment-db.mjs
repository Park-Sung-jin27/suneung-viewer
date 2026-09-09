import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { evaluateAssignmentReceipts } from '../src/engMathAssignments.js';

const db = new PGlite();
const [teacher, student, outsider, second] = [1,2,3,4].map(n => `20000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let checks = 0;
const check = (v,label) => { assert.ok(v,label); checks++; };
const reject = async (fn,pattern) => { await assert.rejects(fn,pattern); checks++; };
async function as(id,role='authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id || '']);
  await db.exec(`set role ${role}`);
}
async function call(method,args=[],prefix='assignment') {
  const {rows} = await db.query(`select public.eng_math_${prefix}_${method}(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`,args);
  return rows[0].result;
}
const migration = readFileSync(new URL('../supabase/migrations/20260909_eng_math_assignments.sql',import.meta.url),'utf8');
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
for (const id of [teacher,student,outsider,second]) await db.query('insert into auth.users values($1)',[id]);
for (const file of ['20260831_learning_events.sql','20260907_eng_math_classrooms.sql'])
  await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
await db.exec(migration);
for (const subject of ['english','math']) {
  const content = JSON.parse(readFileSync(new URL(`../public/data/eng-math/${subject}-free-public.json`,import.meta.url),'utf8'));
  const {rows} = await db.query('select * from public.eng_math_assignment_items where pack_id=$1 order by position',[content.packId]);
  assert.deepEqual(rows.map(r=>[r.problem_key,r.answer]),content.questions.map(q=>[q.id,String(q.answer)])); checks++;
}
const tables=['packs','items','recipients','receipts','changes'].map(n=>`eng_math_assignment_${n}`).concat('eng_math_assignments');
for (const role of ['anon','authenticated']) {
  await as(student,role);
  for (const table of tables) {
    await reject(()=>db.query(`select * from public.${table}`),/permission denied/);
    await reject(()=>db.query(`delete from public.${table}`),/permission denied/);
  }
}
await as(null,'anon');
for (const [fn,args] of [['list',[]],['detail',[randomUUID()]],['submit',[randomUUID(),1,randomUUID(),'q','1','answered']],['change',[randomUUID(),1,'cancel',null,'test']],['create',[randomUUID(),randomUUID(),'x','english-01','2026-09-09',new Date().toISOString(),[student]]]])
  await reject(()=>call(fn,args),/permission denied/);
await as(null); await reject(()=>call('list'),/ASSIGN_AUTH_REQUIRED/);
await as(teacher);
const classId = await call('create',['권한 검증 수업반'],'classroom');
const code = (await call('list',[],'classroom')).owned[0].invite_code;
for(const id of [student,second]) { await as(id); await call('join',[code,id===student?'가상 학생 A':'가상 학생 B'],'classroom'); }
await as(teacher);
const {rows:[clock]}=await db.query("select (clock_timestamp() at time zone 'Asia/Seoul')::date::text as today, clock_timestamp() + interval '2 hours' as due");
const due=clock.due.toISOString(), today=clock.today;
const id=randomUUID(), create=[id,classId,'오늘 영어','english-01',today,due,[student,second]];
check(await call('create',create)===id,'created');
check(await call('create',create)===id,'create retry no duplicate');
await reject(()=>call('create',[...create.slice(0,2),'다른 이름',...create.slice(3)]),/ASSIGN_REQUEST_CONFLICT/);
await reject(()=>call('create',[randomUUID(),classId,'x','locked-pack',today,due,[student]]),/ASSIGN_PACK_UNAVAILABLE/);
await reject(()=>call('create',[randomUUID(),classId,'x','english-01',today,due,[outsider]]),/ASSIGN_MEMBER_MISSING/);
await reject(()=>call('create',[randomUUID(),classId,'x','english-01',today,due,[student,student]]),/ASSIGN_INVALID_INPUT/);
await reject(()=>call('create',[randomUUID(),classId,'x','english-01',null,due,[student]]),/ASSIGN_INVALID_DATE/);
await reject(()=>call('create',[randomUUID(),classId,'x','english-01',today,'2000-01-01',[student]]),/ASSIGN_INVALID_DATE/);
await as(outsider);
for (const [fn,args] of [['list',[classId]],['detail',[id]],['submit',[id,1,randomUUID(),'2026_csat_19','1','answered']],['change',[id,1,'cancel',null,'x']],['create',[randomUUID(),classId,'x','english-01',today,due,[student]]]])
  await reject(()=>call(fn,args),/ASSIGN_FORBIDDEN/);
check((await call('list')).items.length===0,'unrelated student sees none');
await as(student);
const detail=await call('detail',[id]);
check(detail.recipients.length===1 && detail.recipients[0].studentId===student,'student cannot see other recipients');
check(!JSON.stringify(detail).includes('submitted_answer') && !JSON.stringify(detail).includes('"answer":'),'no answer key in detail');
check((await call('list')).items.length===1,'student own assignments');
await reject(()=>call('submit',[id,2,randomUUID(),'2026_csat_19','1','answered']),/ASSIGN_VERSION_MISMATCH/);
await reject(()=>call('submit',[id,1,randomUUID(),'other-question','1','answered']),/ASSIGN_PROBLEM_MISMATCH/);
await reject(()=>call('submit',[id,1,randomUUID(),'2026_csat_19',null,'answered']),/ASSIGN_INVALID_INPUT/);
await reject(()=>call('submit',[id,1,randomUUID(),'2026_csat_19','1','gave_up']),/ASSIGN_INVALID_INPUT/);
const first=randomUUID(), firstArgs=[id,1,first,'2026_csat_19',null,'gave_up'];
const receipt=await call('submit',firstArgs);
check(!receipt.correct,'gave up not correct');
assert.deepEqual(await call('submit',firstArgs),receipt);checks++;
await reject(()=>call('submit',[id,1,first,'2026_csat_19','1','answered']),/ASSIGN_REQUEST_CONFLICT/);
await reject(()=>call('submit',[id,1,randomUUID(),'2026_csat_19','1','answered']),/ASSIGN_ALREADY_ANSWERED/);
await reject(()=>call('submit',[id,1,randomUUID(),'2026_csat_20','2','answered',first]),/ASSIGN_PARENT_MISMATCH/);
await as(second);
await reject(()=>call('submit',[id,1,randomUUID(),'2026_csat_19','1','answered',first]),/ASSIGN_PARENT_MISMATCH/);
check((await call('detail',[id])).receipts.length===0,'other student receipts hidden');
await as(student);
const correction=await call('submit',[id,1,randomUUID(),'2026_csat_19','1','answered',first]);
check(correction.correct,'server grades correction');
for(const [q,answer] of [[20,'2'],[21,'2'],[22,'1'],[23,'3']]) await call('submit',[id,1,randomUUID(),`2026_csat_${q}`,answer,'answered']);
const complete=await call('detail',[id]);
check(evaluateAssignmentReceipts(complete.assignment,student,complete.receipts,complete.asOf).status==='completed_on_time','actual DB receipts complete assignment');
await as(teacher);
check((await call('detail',[id])).receipts.length===6,'teacher sees own class receipts');
const extended=new Date(Date.parse(due)+3600000).toISOString();
check(await call('change',[id,1,'extend',extended,'수업 일정 변경'])===2,'extend revision');
await reject(()=>call('change',[id,1,'cancel',null,'stale']),/ASSIGN_STALE_REVISION/);
await reject(()=>call('change',[id,2,'extend',due,'shorten']),/ASSIGN_INVALID_DATE/);
const afterExtend=await call('detail',[id]);
check(afterExtend.changes.length===1 && Date.parse(afterExtend.changes[0].previousDueAt)===Date.parse(due),'deadline history retained');
check(afterExtend.receipts.length===6,'extension retains receipts');
await call('member_update',[classId,student,'leave'],'classroom');
check((await call('detail',[id])).receipts.length===0,'teacher stops seeing disconnected student receipts');
await as(student); await reject(()=>call('detail',[id]),/ASSIGN_FORBIDDEN/);
await reject(()=>call('submit',firstArgs),/ASSIGN_FORBIDDEN/);
await call('join',[code,'다시 연결'],'classroom');
check((await call('list')).items.length===0,'rejoining does not revive previous assignments');
await as(teacher);
await call('change',[id,2,'cancel',null,'취소 테스트']);
await as(second); await reject(()=>call('submit',[id,1,randomUUID(),'2026_csat_19','1','answered']),/ASSIGN_CANCELLED/);

// Future and late cases use only this isolated fixture; no production timestamps are edited.
await as(teacher);
const lateId=randomUUID(); await call('create',[lateId,classId,'마감 판정','english-01',today,due,[second]]);
await db.exec('reset role');
await db.query("update public.eng_math_assignments set assigned_at=clock_timestamp()-interval '2 hours', opens_at=clock_timestamp()-interval '3 hours', due_at=clock_timestamp()-interval '1 hour' where id=$1",[lateId]);
await as(second);
for(const [q,answer] of [[19,'1'],[20,'2'],[21,'2'],[22,'1'],[23,'3']]) await call('submit',[lateId,1,randomUUID(),`2026_csat_${q}`,answer,'answered']);
const late=await call('detail',[lateId]);
check(evaluateAssignmentReceipts(late.assignment,second,late.receipts,late.asOf).status==='completed_late','server receipts mark late');
await db.exec('reset role');
check((await db.query('select count(*)::int as n from public.learning_events')).rows[0].n===0,'legacy learning events untouched');
check((await db.query("select count(*)::int as n from pg_class where relname=any($1) and relrowsecurity",[tables])).rows[0].n===6,'all tables RLS enabled');
await as(teacher);
const tomorrow=new Date(Date.parse(`${today}T12:00:00Z`)+86400000).toISOString().slice(0,10),futureId=randomUUID();
await call('create',[futureId,classId,'내일 과제','english-01',tomorrow,`${tomorrow}T23:00:00+09:00`,[student]]);
await as(student);
await reject(()=>call('submit',[futureId,1,randomUUID(),'2026_csat_19','1','answered']),/ASSIGN_NOT_OPEN/);
console.log(`[ENG_MATH_ASSIGNMENT_DB] PASS ${checks} checks; real PostgreSQL permissions, membership, grading, replay, correction, deadlines`);
if(process.argv.includes('--fingerprint')) console.log((await db.query("select p.proname,md5(replace(p.prosrc,chr(13),'')) as body_md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'eng_math_assignment_%' order by p.proname")).rows);
const browserCheck=process.argv.includes('--browser');
if(!process.argv.includes('--serve')&&!browserCheck) await db.close();
else {
  await as(teacher);
  const browserAssignment=randomUUID();
  await call('create',[browserAssignment,classId,'로컬 과제 검증 · 영어','english-01',today,due,[student,second]]);
  const browserMathAssignment=randomUUID();
  if(browserCheck)await call('create',[browserMathAssignment,classId,'로컬 저장 실패 검증 · 수학','math-2022_06-common-01',today,due,[student]]);
  const {createServer}=await import('vite');
  const {fileURLToPath}=await import('node:url');
  let queue=Promise.resolve();
  const port=browserCheck?4193:4192;
  const server=await createServer({configFile:false,root:fileURLToPath(new URL('../',import.meta.url)),server:{host:'127.0.0.1',port,strictPort:true},esbuild:{jsx:'automatic'},plugins:[{
    name:'assignment-db-local-qa',
    resolveId(id){if(id==='/__assignment_test.jsx')return '\0assignment-test';},
    load(id){if(id==='\0assignment-test')return `import React from'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import Classroom from'/src/EngMathClassroom.jsx';const role=new URLSearchParams(location.search).get('qaRole')||sessionStorage.getItem('assignmentQaRole')||'student';sessionStorage.setItem('assignmentQaRole',role);const user={id:role==='teacher'?'${teacher}':'${student}'};document.getElementById('qa-role').textContent='로컬 가상 '+role+' · 운영 계정·DB와 무관';createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Classroom,{user,authReady:true})));`;},
    transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/supabase.js'))return {code:`export const supabase={rpc:async(name,args)=>{const response=await fetch('/__assignment_rpc',{method:'POST',headers:{'Content-Type':'application/json','x-qa-role':sessionStorage.getItem('assignmentQaRole')||'student'},body:JSON.stringify({name,args})});return response.json();},from:()=>({upsert:async()=>({error:null}),select:()=>({eq:()=>({order:async()=>({data:[],error:null})})})})};`,map:null};},
    configureServer(server){server.middlewares.use((req,res,next)=>{
      const url=new URL(req.url,'http://127.0.0.1:4192');
      if(url.pathname==='/__assignment_rpc'&&req.method==='POST'){
        let body='';req.on('data',chunk=>{body+=chunk;if(body.length>30000)req.destroy();});req.on('end',()=>{queue=queue.then(async()=>{
          try{const {name,args={}}=JSON.parse(body);if(!/^eng_math_(classroom|assignment)_[a-z_]+$/.test(name)||Object.keys(args).some(k=>!/^p_[a-z_]+$/.test(k)))throw new Error('Invalid local RPC');
            await as(req.headers['x-qa-role']==='teacher'?teacher:student);
            const entries=Object.entries(args), invocation=`public.${name}(${entries.map(([k],i)=>`${k} => $${i+1}`).join(',')})`;
            const isRows=name==='eng_math_classroom_events';
            const {rows}=await db.query(isRows?`select * from ${invocation}`:`select ${invocation} as result`,entries.map(([,v])=>v));
            res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:isRows?rows:rows[0].result,error:null}));
          }catch(e){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:null,error:{message:e.message}}));}
        });});return;
      }
      if(url.pathname==='/eng-math/classroom'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><p id="qa-role"></p><div id="root"></div><script type="module" src="/__assignment_test.jsx"></script></body></html>');return;}
      next();
    });},
  }]});await server.listen();console.log(`Assignment local PostgreSQL QA: http://127.0.0.1:${port}/eng-math/classroom?qaRole=teacher`);
  if(browserCheck){
    let browser;
    try {
      // Optional existing Playwright runtime only; this test never installs software.
      const modulePath=process.env.ASSIGNMENT_QA_PLAYWRIGHT;
      const {pathToFileURL}=await import('node:url');
      const {chromium}=await import(modulePath?pathToFileURL(modulePath).href:'playwright');
      browser=await chromium.launch({channel:'chrome',headless:true});
      const context=await browser.newContext({viewport:{width:390,height:844}});
      const page=await context.newPage();page.setDefaultTimeout(12000);
      const base=`http://127.0.0.1:${port}/eng-math/classroom?assignment=${browserAssignment}`;
      const url=`${base}&role=student&qaRole=student`;
      const uiCheck=label=>console.log(`PASS browser: ${label}`);
      const count=async(p,n)=>{await p.getByRole('heading',{name:new RegExp(`${n}/5문항`)}).waitFor();};
      const open=async(p,index)=>{await p.locator('.assignment-preview-list article').nth(index).getByRole('button').click();};
      const choose=async(p,n)=>{await p.getByRole('group',{name:'답 선택',exact:true}).getByRole('button').nth(n-1).click();await p.getByRole('button',{name:'정답 확인하기',exact:true}).click();};
      const saved=async p=>{await p.getByText('과제 답안이 서버에 접수됐습니다. 과제 목록에서 완료 분량을 확인하세요.',{exact:true}).waitFor();};
      // Teacher requests must retain their original ID/payload across reloads.
      const creatorContext=await browser.newContext({viewport:{width:390,height:844}});
      let creator=await creatorContext.newPage();creator.setDefaultTimeout(12000);
      const teacherHome=`http://127.0.0.1:${port}/eng-math/classroom?qaRole=teacher`;
      let createFailure='before';const createRequests=[];
      await creatorContext.route('**/__assignment_rpc',async route=>{
        const body=route.request().postDataJSON();
        if(body?.name==='eng_math_assignment_create'){
          createRequests.push(body.args);
          if(createFailure==='before')return route.abort('failed');
          if(createFailure==='after'){await route.fetch();createFailure='normal';return route.abort('failed');}
        }
        return route.continue();
      });
      const showForm=async p=>{await p.getByText('새 과제 배정',{exact:true}).click();return p.locator('.assignment-live-form');};
      const createSaved=async p=>p.getByText('과제를 배정했습니다. 대상 학생의 내 과제에 표시됩니다.',{exact:true}).waitFor();
      await creator.goto(teacherHome);let createForm=await showForm(creator);
      await createForm.getByLabel('과제 이름',{exact:true}).fill('배정 전송 실패 복구');
      await createForm.getByLabel('마감일',{exact:true}).fill(tomorrow);
      await createForm.getByLabel('마감 시간',{exact:true}).fill('23:59');
      await createForm.getByLabel('가상 학생 B',{exact:true}).check();
      await createForm.getByRole('button',{name:'선택한 학생에게 과제 배정',exact:true}).click();
      await createForm.getByRole('button',{name:'같은 배정 다시 확인',exact:true}).waitFor();
      await creator.reload();createForm=await showForm(creator);
      assert.equal(await createForm.getByLabel('과제 이름',{exact:true}).inputValue(),'배정 전송 실패 복구');
      assert.equal(await createForm.getByLabel('가상 학생 B',{exact:true}).isChecked(),true);
      assert.equal(await createForm.getByLabel('과제 이름',{exact:true}).isDisabled(),true);
      createFailure='normal';await createForm.getByRole('button',{name:'같은 배정 다시 확인',exact:true}).click();await createSaved(creator);
      assert.deepEqual(createRequests[0],createRequests[1]);
      assert.equal(await createForm.getByRole('button',{name:'배정 확인 완료',exact:true}).isDisabled(),true);
      uiCheck('teacher failed send restores exact title/recipients/deadline and request ID after refresh');
      await createForm.getByLabel('과제 이름',{exact:true}).fill('배정 응답 유실 복구');
      createFailure='after';await createForm.getByRole('button',{name:'선택한 학생에게 과제 배정',exact:true}).click();
      await createForm.getByRole('button',{name:'같은 배정 다시 확인',exact:true}).waitFor();await creator.close();
      creator=await creatorContext.newPage();creator.setDefaultTimeout(12000);await creator.goto(teacherHome);createForm=await showForm(creator);
      assert.equal(await createForm.getByLabel('과제 이름',{exact:true}).inputValue(),'배정 응답 유실 복구');
      await createForm.getByRole('button',{name:'같은 배정 다시 확인',exact:true}).click();await createSaved(creator);
      assert.deepEqual(createRequests[2],createRequests[3]);
      assert.equal(await creator.getByText('배정 응답 유실 복구',{exact:true}).count(),1);
      uiCheck('teacher lost create response survives tab closure and confirms one original assignment');
      await createForm.getByLabel('과제 이름',{exact:true}).fill('배정 빠른 두 번 클릭');
      const beforeDouble=createRequests.length;
      await createForm.getByRole('button',{name:'선택한 학생에게 과제 배정',exact:true}).dblclick();await createSaved(creator);
      assert.equal(createRequests.length-beforeDouble,1);
      assert.equal(await creator.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      uiCheck('teacher rapid double click sends once; 390px form no horizontal overflow');
      const createNoDisk=await browser.newContext();
      await createNoDisk.addInitScript(()=>{
        const set=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value){if(key.startsWith('eng_math_assignment_create_pending_v1:'))throw new DOMException('QA quota','QuotaExceededError');return set.call(this,key,value);};
      });
      let blockedCreateCalls=0;
      await createNoDisk.route('**/__assignment_rpc',route=>{if(route.request().postDataJSON()?.name==='eng_math_assignment_create')blockedCreateCalls++;return route.continue();});
      const blockedCreator=await createNoDisk.newPage();await blockedCreator.goto(teacherHome);
      const blockedForm=await showForm(blockedCreator);
      await blockedForm.getByLabel('과제 이름',{exact:true}).fill('저장 실패로 미전송');
      await blockedForm.getByLabel('마감일',{exact:true}).fill(tomorrow);
      await blockedForm.getByLabel('가상 학생 B',{exact:true}).check();
      await blockedForm.getByRole('button',{name:'선택한 학생에게 과제 배정',exact:true}).click();
      await blockedForm.getByText('이 기기에 배정 확인 정보를 저장하지 못해 전송하지 않았습니다. 저장 공간·브라우저 설정을 확인한 후 다시 눌러 주세요.',{exact:true}).waitFor();
      assert.equal(blockedCreateCalls,0);assert.equal(await blockedForm.getByLabel('과제 이름',{exact:true}).isEnabled(),true);
      uiCheck('teacher local quota failure sends no create RPC and leaves input editable');
      const expiredContext=await browser.newContext();
      await expiredContext.addInitScript(({teacher,classId})=>{
        localStorage.setItem(`eng_math_assignment_create_pending_v1:${teacher}:${classId}`,JSON.stringify({teacherId:teacher,subject:'english',request:{p_id:'30000000-0000-4000-8000-000000000099',p_class_id:classId,p_title:'미전송 후 마감 경과',p_pack_id:'english-01',p_study_date:'2000-01-01',p_due_at:'2000-01-01T14:00:00Z',p_students:['20000000-0000-4000-8000-000000000004']}}));
      },{teacher,classId});
      const expiredCreator=await expiredContext.newPage();await expiredCreator.goto(teacherHome);
      const expiredForm=await showForm(expiredCreator);
      await expiredForm.getByRole('button',{name:'같은 배정 다시 확인',exact:true}).click();
      await expiredForm.getByText('학습일과 마감을 확인해 주세요. 마감 연장은 기존 마감보다 뒤여야 합니다.',{exact:true}).waitFor();
      assert.equal(await expiredForm.getByLabel('과제 이름',{exact:true}).isEnabled(),true);
      assert.equal(await expiredCreator.evaluate(({teacher,classId})=>localStorage.getItem(`eng_math_assignment_create_pending_v1:${teacher}:${classId}`),{teacher,classId}),null);
      uiCheck('server rejects expired unsent create; unlocks correction without inventing a successful assignment');
      const mode={value:'before'};
      await page.route('**/__assignment_rpc',async route=>{
        const name=route.request().postDataJSON()?.name;
        if(name==='eng_math_assignment_submit'&&mode.value==='before')return route.abort('failed');
        if(name==='eng_math_assignment_submit'&&mode.value==='after'){
          await route.fetch();mode.value='normal';return route.abort('failed');
        }
        return route.continue();
      });
      await page.goto(url);await count(page,0);await open(page,0);await choose(page,1);
      await page.getByRole('button',{name:'같은 답안 다시 접수',exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'과제 진행 확인',exact:true}).isDisabled(),true);
      await page.reload();await count(page,0);
      await page.getByText('접수 확인이 끝나지 않은 답안이 있습니다. 같은 답안 다시 접수를 눌러 주세요.',{exact:true}).waitFor();
      mode.value='normal';await page.getByRole('button',{name:'같은 답안 다시 접수',exact:true}).click();await count(page,1);
      uiCheck('failed send survives refresh, blocks false completion, retry completes only once');
      mode.value='after';await open(page,1);await choose(page,2);
      await page.getByRole('button',{name:'같은 답안 다시 접수',exact:true}).waitFor();
      await page.reload();await count(page,2);
      await page.getByRole('button',{name:'같은 답안 다시 접수',exact:true}).click();
      await page.getByRole('button',{name:'같은 답안 다시 접수',exact:true}).waitFor({state:'hidden'});await count(page,2);
      uiCheck('lost response after DB commit replays without duplicating completion');
      await page.close();
      const returning=await context.newPage();returning.setDefaultTimeout(12000);
      await returning.goto(url);await count(returning,2);
      uiCheck('closing and reopening retains confirmed progress');
      assert.equal(await returning.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      uiCheck('390px assignment list has no horizontal overflow');
      // Two separate device-like contexts must preserve the first receipt and unblock stale UI.
      const otherContext=await browser.newContext();const otherPage=await otherContext.newPage();
      await otherPage.goto(url);await count(otherPage,2);
      await open(returning,2);await open(otherPage,2);await choose(otherPage,1);await saved(otherPage);
      await choose(returning,2);
      await returning.getByText('다른 화면에서 먼저 접수된 첫 답안을 불러왔습니다. 이 화면의 답안은 추가 접수하지 않았습니다. 재풀이 필요 여부를 확인해 주세요.',{exact:true}).waitFor();
      await count(returning,2);await open(returning,2);await choose(returning,2);await saved(returning);
      await returning.getByRole('button',{name:'과제 진행 확인',exact:true}).click();await count(returning,3);
      uiCheck('stale second-device first answer recovers into explicit correction without overwriting original');
      let failDetail=false;
      await returning.route('**/__assignment_rpc',async route=>{
        const name=route.request().postDataJSON()?.name;
        if(name==='eng_math_assignment_submit')failDetail=true;
        if(name==='eng_math_assignment_detail'&&failDetail){failDetail=false;return route.abort('failed');}
        return route.continue();
      });
      await open(returning,3);await choose(returning,1);
      await returning.getByRole('button',{name:'같은 답안 다시 접수',exact:true}).waitFor();
      assert.equal(await returning.getByRole('button',{name:'과제 진행 확인',exact:true}).isDisabled(),true);
      await returning.unroute('**/__assignment_rpc');await returning.reload();await count(returning,4);
      await returning.getByRole('button',{name:'같은 답안 다시 접수',exact:true}).click();
      await returning.getByRole('button',{name:'같은 답안 다시 접수',exact:true}).waitFor({state:'hidden'});
      uiCheck('receipt-detail fetch failure retains request until a confirmed retry; refresh recovers 4/5');
      const teacherContext=await browser.newContext({viewport:{width:390,height:844}}),teacherPage=await teacherContext.newPage();
      await teacherPage.goto(`${base}&qaRole=teacher`);
      await teacherPage.getByRole('cell',{name:'4 / 5',exact:true}).waitFor();
      assert.equal(await teacherPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      uiCheck('teacher separate context sees exactly 4/5; mobile no document overflow');
      const noDisk=await browser.newContext({viewport:{width:390,height:844}});
      await noDisk.addInitScript(()=>{
        const set=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value){if(key.startsWith('eng_math_assignment_pending_v1:'))throw new DOMException('QA quota','QuotaExceededError');return set.call(this,key,value);};
      });
      const mathPage=await noDisk.newPage();mathPage.setDefaultTimeout(12000);
      let failSend=true;
      await mathPage.route('**/__assignment_rpc',route=>route.request().postDataJSON()?.name==='eng_math_assignment_submit'&&failSend?route.abort('failed'):route.continue());
      await mathPage.goto(`http://127.0.0.1:${port}/eng-math/classroom?assignment=${browserMathAssignment}&qaRole=student&role=student`);
      await count(mathPage,0);await open(mathPage,0);await choose(mathPage,4);
      await mathPage.getByText('이 기기에 재접수용 답안을 저장하지 못했습니다. 서버 접수 확인 전에는 화면을 닫지 마세요.',{exact:true}).waitFor();
      await mathPage.getByRole('button',{name:'같은 답안 다시 접수',exact:true}).waitFor();
      assert.equal(await mathPage.getByRole('button',{name:'과제 진행 확인',exact:true}).isDisabled(),true);
      assert.equal(await mathPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      failSend=false;await mathPage.getByRole('button',{name:'같은 답안 다시 접수',exact:true}).click();await saved(mathPage);
      await mathPage.reload();await count(mathPage,1);
      uiCheck('math storage quota + send failure warns before closing, blocks completion, same-page retry persists server record after refresh');
      // Read isolated DB after browser traffic only; never read production student data.
      await as(teacher);const result=await call('detail',[browserAssignment]);
      const own=result.receipts.filter(r=>r.studentId===student);
      assert.equal(own.length,5);assert.equal(own.filter(r=>r.problemKey==='2026_csat_21'&&r.kind==='answer'&&!r.correct).length,1);
      assert.equal((await call('detail',[browserMathAssignment])).receipts.length,1);
      uiCheck('DB confirms five English receipts for four completed questions and one math receipt, no duplicate writes');
      for(const title of ['배정 전송 실패 복구','배정 응답 유실 복구','배정 빠른 두 번 클릭']){
        const matches=(await call('list',[classId])).items.filter(a=>a.title===title);assert.equal(matches.length,1);
        assert.deepEqual((await call('detail',[matches[0].id])).assignment.recipientIds,[second]);
      }
      uiCheck('DB has exactly one of each teacher request and only the chosen recipient');
      assert.equal((await call('list',[classId])).items.some(a=>['저장 실패로 미전송','미전송 후 마감 경과'].includes(a.title)),false);
      console.log('[ENG_MATH_ASSIGNMENT_BROWSER] PASS; local fake auth + real isolated SQL, not production authentication or physical devices');
    } finally {await browser?.close();await server.close();await db.close();}
  }
}
