// word_split_audit.mjs — 어절 분리 (발주 D-68)
//
// [기존 (c) 축의 구멍]
//   원문이 「붙여 쓴」 곳만 잡았다. 원문이 **줄 끝에서 갈린** 자리는
//   줄바꿈을 공백으로 바꾼 판에 그대로 있어 「진짜 어절 경계」로 보고 제외했다.
//   실증: l2025bs23 — 데이터 「배반 하는」 / 원문 「배반(줄바꿈)하는」
//
// [보완 판정식]
//   ① 원문이 아예 붙여 쓴 자리 → 확정
//   ② 원문이 줄 끝에서 갈린 자리 중
//      · 뒤 조각이 결합형(하·되·시키·당하·스럽·답·롭)으로 시작하고
//      · 앞 조각이 조사로 끝나지 않을 때 → 후보
//      ★ 앞이 조사면 별개 어절이다(「단서가 되기」). 없으면 2025수능만 67건이 뜬다.
//
// ★ 읽기 전용. 인자 없이 돌리면 무료 5개년만 본다.
// 사용: node pipeline/word_split_audit.mjs [회차]   (PDF_DIR 환경변수로 원문 경로 지정)

import fs from "node:fs";
import { buildIndex, locateSpan, hard } from "./anchor.mjs";
const SP=process.env.PDF_DIR || "C:/Users/downf/AppData/Local/Temp/claude/C--Users-downf-suneung-viewer/8c51d2eb-5f22-4331-9ae9-75ba84946ea5/scratchpad";
const data=JSON.parse(fs.readFileSync(new URL("../data-source/all_data_204.json", import.meta.url),"utf8"));
const src=fs.readFileSync(new URL("../src/dataLoader.js", import.meta.url),"utf8");const _s=src.indexOf("const RELEASE_KEYS = new Set([");
const RK=new Set([...src.slice(_s,src.indexOf("]);",_s)).matchAll(/"([^"]+)"/g)].map(m=>m[1]).filter(k=>k.includes("::")));
const FREE5=["2022수능","2023수능","2024수능","2025수능","2026수능"];
const YKS=process.argv[2]?[process.argv[2]]:FREE5;
function profile(s){
  const ch=[],sp=[],nl=[]; const a=[...String(s||"")];
  for(let i=0;i<a.length;i++){
    if(!hard(a[i]))continue;
    ch.push(a[i]);
    let j=i+1,blank=false,isNL=false;
    while(j<a.length&&!hard(a[j])){ if(/[\s\u00a0]/.test(a[j])){blank=true; if(a[j]==="\n"||a[j]==="\r")isNL=true;} j++; }
    sp.push(blank); nl.push(isNL);
  }
  return {ch:ch.join(""),sp,nl};
}
// 붙이면 한 낱말이 되는 결합형 — 뒤 조각이 이 형태로 시작하면 앞과 붙는다.
// 붙이면 한 낱말이 되는 결합형. 「되·받·있」 등은 독립 용언으로도 쓰여 오탐이 커서 뺐다.
const BOUND=/^(하|되|시키|당하|스럽|답|롭)/;
// 앞 조각이 조사로 끝나면 그 뒤는 별개 어절이다 — 「단서가 되기」는 정상이다.
const JOSA=/(이|가|은|는|을|를|에|의|로|과|와|도|만|서|며|고|다|게|나|야|랑|처럼|부터|까지|보다|마다|조차|밖에|커녕|든지|라도|이나|으로|에서|에게|한테|께서|라고|하고)$/;
const rows=[];
for(const yk of YKS){
  let idx; try{ idx=buildIndex(fs.readFileSync(`${SP}/pdf_${yk}.txt`,"utf8")); }catch{continue;}
  for(const sec of["reading","literature"])for(const set of data[yk][sec]||[]){
    const live=RK.has(`${yk}::${set.id}`);
    const units=[];
    for(const t of set.sents||[]) if(t.sentType!=="footnote") units.push([`지문 ${t.id}`,t.t]);
    for(const q of set.questions||[]){ units.push([`Q${q.id} 발문`,q.t]);
      if(typeof q.bogi==="string") units.push([`Q${q.id} 보기`,q.bogi]);
      for(const c of q.choices||[]) if(!/src:|\[\[sym:/.test(c.t||"")) units.push([`Q${q.id} 선지${c.num}`,c.t]); }
    for(const [where,txt] of units){
      const r=locateSpan(idx,txt,{minLen:16}); if(!r.ok)continue;
      const D=profile(txt), O=profile(r.span);
      if(D.ch!==O.ch)continue;
      for(let i=0;i<D.sp.length-1;i++){
        if(!D.sp[i])continue;
        const tight = !O.sp[i];      // 원문이 아예 붙여 씀
        const lineBreak = O.sp[i] && O.nl[i];   // 원문이 줄 끝에서 갈림
        if(!tight && !lineBreak)continue;
        const tail=D.ch.slice(i+1,i+7);
        const headTok=D.ch.slice(Math.max(0,i-6),i+1);
        if(!tight && (!BOUND.test(tail) || JOSA.test(headTok))) continue;
        rows.push({yk,setId:set.id,where,live,kind:tight?"붙여씀":"줄바꿈",
          at:D.ch.slice(Math.max(0,i-9),i+1)+" ␣ "+D.ch.slice(i+1,i+9)});
      }
    }
  }
}
console.log(`## 어절 분리 재검 — ${YKS.join(", ")}\n`);
console.log(`🔴 ${rows.length}건 (LIVE ${rows.filter(r=>r.live).length}) · 원문 붙여씀 ${rows.filter(r=>r.kind==="붙여씀").length} / 원문 줄바꿈+결합형 ${rows.filter(r=>r.kind==="줄바꿈").length}\n`);
for(const r of rows) console.log(`${r.live?"LIVE ":"     "}${r.yk} ${r.setId} ${r.where} [${r.kind}]  「…${r.at}…」`);
