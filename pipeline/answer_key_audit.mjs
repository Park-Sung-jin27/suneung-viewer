// answer_key_audit.mjs — 정답표 전수 대조 (발주 D-54)
//
// 공식 정답 PDF(_done/<회차>/<회차>_정답.pdf)에서 뽑은 정답표와 데이터의 ok 값을 맞춘다.
// ★ 원문·앵커·사람 판독이 전혀 필요 없다. 정답표는 pipeline/answer_key.json 에 캐시돼 있다.
// ★ ok 은 「정답」이 아니라 「선지 진술의 참/거짓」이다. 이 구분을 놓치면 542건이 가짜로 뜬다.
//     「적절하지 않은 것은?」 → 정답 = ok:false 인 유일한 선지
//     「가장 적절한 것은?」   → 정답 = ok:true  인 유일한 선지
// 사용: node pipeline/answer_key_audit.mjs
import fs from "node:fs";
const data=JSON.parse(fs.readFileSync(new URL("../data-source/all_data_204.json", import.meta.url),"utf8"));
const A=JSON.parse(fs.readFileSync(new URL("./answer_key.json", import.meta.url),"utf8"));
const KEY=(yk)=>A[yk]?.ans;
const src=fs.readFileSync(new URL("../src/dataLoader.js", import.meta.url),"utf8");const _s=src.indexOf("const RELEASE_KEYS = new Set([");
const RK=new Set([...src.slice(_s,src.indexOf("]);",_s)).matchAll(/"([^"]+)"/g)].map(m=>m[1]).filter(k=>k.includes("::")));
const NEG=/(?:적절|알맞|옳|바르|타당)하?지\s*(?:않은|않는)|아닌\s*것은|일치하지\s*않는|보기\s*어려운|찾을\s*수\s*없는|할\s*수\s*없는|볼\s*수\s*없는|없는\s*것은|어려운\s*것은|부적절/;
// --expect <회차> : 그 회차가 반드시 대조되어야 한다. 빠지면 크게 경고하고 exit 1.
//   ★ 정답표가 answer_key.json 에 없으면 이 도구는 그 회차를 조용히 건너뛴다.
//     신규 회차에서 이 옵션 없이 돌리면 「불일치 0건」이 나오지만 실은 아무것도 안 본 것이다.
//     (D-140 ① — 런북에서 이 연결이 빠져 있었다)
const _ei = process.argv.indexOf("--expect");
const EXPECT = _ei >= 0 ? process.argv[_ei + 1] : null;
const bad=[], shape=[]; let checked=0; const skip=[];
for(const yk of Object.keys(data)){
  const tab=A[yk]?.ans;
  if(!tab||Object.keys(tab).length<34){skip.push(yk);continue;}
  for(const sec of["reading","literature"])for(const s of data[yk][sec]||[]){
    const live=RK.has(`${yk}::${s.id}`);
    for(const q of s.questions||[]){
      const n=Number(q.id); if(!(n>=1&&n<=45))continue;
      const want=tab[n]; if(want===undefined)continue;
      const neg=NEG.test(String(q.t||""));
      const cs=q.choices||[];
      const pick=neg?cs.filter(c=>!c.ok):cs.filter(c=>c.ok);
      checked++;
      if(pick.length!==1){shape.push({yk,sid:s.id,n,live,neg,cnt:pick.length,stem:String(q.t).slice(0,44)});continue;}
      if(pick[0].num!==want) bad.push({yk,sid:s.id,n,live,neg,got:pick[0].num,want,stem:String(q.t).slice(0,44)});
    }
  }
}
console.log(`## 정답표 전수 대조 (발문 유형 반영) — ${checked}문항\n`);
console.log(`🔴 정답 불일치        : ${bad.length}건 (LIVE ${bad.filter(x=>x.live).length})`);
console.log(`🟡 ok 배치가 1개가 아님: ${shape.length}건 (LIVE ${shape.filter(x=>x.live).length})`);
console.log(`   대조 제외 회차 ${skip.length}개: ${skip.join(", ")}\n`);
if (EXPECT) {
  // skip 목록만 보면 안 된다 — all_data 에 아직 없는 회차는 순회 자체를 안 해
  //   skip 에도 안 들어가고 「대조됨」으로 잘못 통과한다(D-140 ① 실증).
  //   그래서 세 가지를 다 본다: 정답표 있음 · 데이터 있음 · 실제로 대조됨.
  const keyN = Object.keys(A[EXPECT]?.ans || {}).length;
  const inData = !!data[EXPECT];
  const done = inData && keyN >= 34 && !skip.includes(EXPECT);
  if (!done) {
    console.log(``);
    console.log(`🔴🔴🔴 ${EXPECT} 은 대조되지 않았다.`);
    console.log(`       정답표(answer_key.json): ${keyN ? keyN + "문항" : "없음"}`);
    console.log(`       데이터(all_data_204.json): ${inData ? "있음" : "없음"}`);
    console.log(`       위 「불일치 0건」은 이 회차를 본 결과가 아니다. 공개하면 안 된다.`);
    if (!keyN) console.log(`       → step1_answer.js 산출물을 answer_key.json 에 넣는다.`);
    if (!inData) console.log(`       → step6_merge.js 로 all_data 에 병합한다.`);
    process.exit(1);
  }
  console.log(`   ✅ ${EXPECT} 대조됨 — 정답표 ${keyN}문항이 실제로 쓰였다`);
}
if(bad.length){console.log("| 회차 | 세트 | 문항 | 유형 | 데이터 | 정답표 | LIVE |\n|---|---|--:|:-:|:-:|:-:|:-:|");
  for(const b of bad.slice(0,30)) console.log(`| ${b.yk} | \`${b.sid}\` | ${b.n} | ${b.neg?"부정":"긍정"} | ${b.got} | **${b.want}** | ${b.live?"**LIVE**":"-"} |`);
  if(bad.length>30)console.log(`… 외 ${bad.length-30}건`);}
if(shape.length){console.log(`\n### ok 배치 이상 (상위 10)`);
  shape.slice(0,10).forEach(x=>console.log(`  ${x.live?"LIVE ":"     "}${x.yk} ${x.sid} Q${x.n} [${x.neg?"부정":"긍정"}] 후보 ${x.cnt}개 — ${x.stem}`));}
