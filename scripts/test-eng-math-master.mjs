import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMasterHandler, isEngMathMaster } from '../server/engMathMaster.js';
import { normalizeEngMathReturnTo } from '../src/engMathAccess.js';
import { splitEnglishBlankText } from '../src/englishBlankText.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'data-eng-math-master');
const read = file => JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
const master = { id:'test-master', email:'downfall121@gmail.com', email_confirmed_at:'2026-01-01T00:00:00Z', is_anonymous:false };
let checks=0;
function check(value, label) { assert.ok(value,label); checks++; }
async function request(user, query={}, token='valid', dir=directory, method='GET') {
  const res={code:0, headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},send(body){this.body=body;return this;}};
  let authCalls=0;
  await createMasterHandler({getUser:async()=>{authCalls++;if(user instanceof Error)throw user;return user;},directory:dir})({method,headers:token?{authorization:`Bearer ${token}`}:{},query},res);
  check(res.headers['Cache-Control'].includes('no-store'),'all responses no-store');
  check(res.headers.Vary==='Authorization','vary by authorization');
  return {...res,authCalls};
}
check(isEngMathMaster(master),'confirmed account accepted');
for(const user of [null,{}, {...master,id:''}, {...master,email_confirmed_at:null}, {...master,is_anonymous:true}, {...master,email:'student@example.com',user_metadata:{email:master.email,role:'master'}}, {...master,email:'downfall121@gmail.com.attacker.test'}, {...master,email:'downfall121+master@gmail.com'}]) check(!isEngMathMaster(user),'reject forged or unverified identity');
check((await request(master,{},null)).code===401,'missing token rejected');
check((await request(null)).code===401,'invalid token rejected');
check((await request({...master,email:'student@example.com'}, {asset:'anything'}, 'valid', 'missing-private-directory')).code===403,'authorization precedes any private file access');
check((await request(new Error('offline'))).code===503,'auth failure closed');
check((await request(master,{},'valid',directory,'POST')).code===405,'only GET');
check((await request(master,{status:'1'})).body.access==='master','capability check');
const catalogResponse=await request(master);
const catalog=catalogResponse.body.questions;
check(catalogResponse.code===200&&catalog.length===1632,'full local canonical scope: 896+736');
check(!JSON.stringify(catalog).includes('rawText'),'catalog contains no question body');
check(new Set(catalog.map(q=>q.id)).size===catalog.length,'unique IDs');
for(const query of [{question:'../english/data/english_exam_db_v2_1'},{question:['english--2027_09_18']},{question:'math--does-not-exist'},{asset:'../catalog.json'},{asset:['a'.repeat(64)]},{question:catalog[0].id,asset:'a'.repeat(64)}]) check((await request(master,query)).code>=400,'invalid selectors rejected');
check((await request(master,{asset:'a'.repeat(64)})).code===404,'unlisted asset rejected');
const qResponse=await request(master,{question:'english--2027_09_18'});
check(qResponse.code===200&&qResponse.body.number===18&&qResponse.body.answer===2,'registered English question available');
check((await request(master,{question:'math--2027_09_geo_30'})).body.answer==='457','registered math question available');
for(const q of catalog) {
  check(/^(english|math)--[a-zA-Z0-9_]+$/.test(q.id),'safe generated IDs');
  const item=read(`${q.id}.json`);
  check(item.id===q.id&&item.subject===q.subject,'catalog matches private detail');
  check(Boolean(item.rawText||item.prompt),'no empty question');
  check(!('sourceArtifacts' in item)&&!('meta' in item)&&!('notes' in item),'no raw metadata or unchecked generated solutions');
  if(item.review) check(String(item.review.answer)===String(item.answer),'review answer matches question');
}
const manifest=read('assets.json');
const imageId=Object.keys(manifest)[0];
const image=await request(master,{asset:imageId});
check(image.code===200&&image.headers['Content-Type']==='image/png'&&Buffer.isBuffer(image.body),'authenticated image served');
check((await request({...master,email:'student@example.com'},{asset:imageId})).code===403,'other student cannot fetch image');
check((await request(null,{question:catalog[0].id})).code===401,'logout blocks detail');
const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
check(config.functions['api/eng-math-master.js'].includeFiles==='data-eng-math-master/**','server bundle explicit');
check(config.rewrites.some(r=>r.source==='/eng-math/master'&&r.destination==='/index.html'),'direct route works');
check(normalizeEngMathReturnTo('/eng-math/master')==='/eng-math/master','login return allowed');
for(const folder of ['public','dist'])check(!fs.existsSync(path.join(root,folder,'data-eng-math-master')),'private directory absent from public output');
for(const name of ['EngMathMaster.jsx','EngMathMasterEntry.jsx','engMathMasterClient.js']) {
  const text=fs.readFileSync(path.join(root,'src',name),'utf8');
  check(!text.includes(master.email)&&!text.includes('data-eng-math-master')&&!text.includes('fulltext_review_export'),'no client identity allowlist or private import');
}
check(!fs.readdirSync(directory).some(f=>f.includes('fulltext_review_export')),'review-only export never packaged');
check(!read('english--2027_09_24.json').rawText.includes('㢨ٻⱬ㥐㫴'),'known corrupted footer removed from display only');
console.log(`ENG_MATH_MASTER: PASS ${checks} checks; default-deny auth, token verification, assets, private content, routes`);

for (const number of [31, 32, 33, 34]) {
  const q = read(`english--2027_09_${number}.json`);
  check(q.blankSpans?.length === 1, `official blank restored: ${number}`);
  const parts = splitEnglishBlankText(q.rawText, q.blankSpans);
  check(parts.filter(p => p.blank).length === 1, 'one visible blank');
  check(parts.map(p => p.blank ? '\t' : p.text).join('') === q.rawText, 'source wording and choice spacing preserved');
}
check(splitEnglishBlankText('31.\ttext\n① A\t② B').every(p=>!p.blank), 'ordinary tabs are not blanks');
assert.throws(()=>splitEnglishBlankText('hello', [{start:1,length:1}]), /Invalid English blank/);
console.log('ENGLISH_BLANK_DISPLAY: PASS official 2027_09 31–34, source preservation, non-blank tabs');

// Isolated browser QA: localhost only, no real login, database calls or event writes.
// Not part of the application or deployment entry points.
if (process.argv.includes('--serve')) {
  const { createServer } = await import('vite');
  const qaHandler = createMasterHandler({getUser:async token=>token==='local-master-test'?master:null,directory});
  const qa = await createServer({
    configFile:false, root, server:{host:'127.0.0.1',port:4191,strictPort:true},
    plugins:[{
      name:'master-local-qa',
      resolveId(id) { if(id==='/__master_test.jsx') return '\0master-test'; },
      load(id) { if(id==='\0master-test') return `import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter}from'react-router-dom';import Page from '/src/EngMathMaster.jsx';createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(Page,{user:{id:'test-master'},authReady:true})));`; },
      transform(code,id) {
        if (id.replaceAll('\\','/').endsWith('/src/engMathMasterClient.js')) return {code:`export async function fetchMaster(query, userId, signal) { const r=await fetch('/api/eng-math-master'+(query?'?'+query:''),{headers:{Authorization:'Bearer local-master-test'},signal,cache:'no-store'});if(!r.ok)throw new Error('Local test failed');return r;}`,map:null};
      },
      configureServer(server) {
        server.middlewares.use((req,res,next)=>{
          const url=new URL(req.url,'http://127.0.0.1:4191');
          if(url.pathname==='/api/eng-math-master') {
            req.query=Object.fromEntries(url.searchParams);res.status=c=>{res.statusCode=c;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};res.send=data=>res.end(data);void qaHandler(req,res);return;
          }
          if(url.pathname==='/__master_test') {
            res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><p>로컬 검증 · 가상 인증 · 실제 학습 기록 저장 없음</p><div id="root"></div><script type="module" src="/__master_test.jsx"></script></body></html>`);return;
          }
          next();
        });
      },
    }], esbuild:{jsx:'automatic'}, optimizeDeps:{include:['react','react-dom/client','react-router-dom']},
  });
  await qa.listen();console.log('Master local QA: http://127.0.0.1:4191/__master_test');
}
