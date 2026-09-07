// d213_para_label.mjs — 2027_9월 독서 4세트 para 부여 + 갈래 라벨 분리 (발주 D-213)
//
// 지문이 문단 구분 없이 한 덩어리로 렌더되고, r20279b 는 「(가)」·「(나)」가
// 본문 문장 앞에 접두로 붙어 있었다(심사관 채증 9/7).
//
// ★ 정본 선례 `2026수능::r2026b` — 갈래 라벨은 **별도 workTag 문장**이고 자기
//   para 를 차지한다. 독서·문학 규약이 같다.
//     {"id":"r2026bs1","t":"(가)","sentType":"workTag","para":1}
//     {"id":"r2026bs2","t":"법조문으로…","sentType":"body","para":2}
//
// ★ para 는 지면 들여쓰기로 확정했다(본문 x=96.4/455.3, 문단 시작 x=106.7/455.3).
//   판정기를 두 번 고쳤다 — 단별 기준선(2단 조판이라 한 값으로 잡으면 다른 단
//   전체가 「들여쓴 줄」이 된다)과 쪽번호 제외. 매핑 미매칭 0건.
//
// ★ 신규 문장 id 는 900번대 규약(코퍼스 72건). r20279b 는 이미 s901 을 쓰므로
//   s902·s903 을 쓰고, **배열 위치가 렌더 순서**다(s901 선례).
//
// ★ s1·s16 은 접두 「(가) 」·「(나) 」 4글자만 떼고 나머지 바이트 무변.
//   오프셋 참조 전수 조회 결과 0건(cs_spans 0 · annotations 0 · 오프셋 필드 0),
//   cs_ids 2건은 문장 단위 참조라 무관하다.
//
// ★ 문학 4세트 불가침 — 산문 para 미사용이 정상이다(7/29 감사).
//
// 사용: node pipeline/d213_para_label.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const PLANS = path.join(ROOT, "pipeline/fixtures/d213_plans.json");
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const YK = "2027_9월";
const LBL = /^[(（]\s*([가-힣])\s*[)）]\s*/;

const raw = fs.readFileSync(DATA, "utf8");
const j = JSON.parse(raw);
const plans = JSON.parse(fs.readFileSync(PLANS, "utf8"));

console.log("# 문단(para) 부여 + 갈래 라벨 분리 (D-213)");
console.log("");
console.log(`- \`data-source/all_data_204.json\` 적용 전 MD5 \`${md5(raw)}\``);
console.log("");

const fail = [];
const setOf = (sid) => (j[YK].reading || []).find((x) => (x.setId || x.id) === sid);

// ── 사전 대조 ────────────────────────────────────────────────────────────
const jobs = [];
for (const p of plans) {
  const s = setOf(p.sid);
  if (!s) { fail.push(`${p.sid} 없음`); continue; }
  if ((s.sents || []).some((x) => x.para !== undefined)) { fail.push(`${p.sid} 에 para 가 이미 있다`); continue; }
  if (p.unmatched.length) { fail.push(`${p.sid} 미매칭 ${p.unmatched.length}건`); continue; }
  if (p.para.length !== (s.sents || []).length) { fail.push(`${p.sid} 계획 ${p.para.length} ≠ 문장 ${s.sents.length}`); continue; }
  // 계획의 문장 순서가 실제와 같은가
  const bad = p.para.findIndex((x, i) => x.id !== s.sents[i].id);
  if (bad >= 0) { fail.push(`${p.sid} [${bad}] 계획 ${p.para[bad].id} ≠ 실제 ${s.sents[bad].id}`); continue; }
  jobs.push({ ...p, s });
}
if (jobs.length !== plans.length) fail.push(`대상 ${jobs.length}/${plans.length}`);

// 라벨 분리 대상 — 계획에 label 이 있는 문장
const labels = jobs.flatMap((jb) => jb.labels.map((L) => ({ sid: jb.sid, ...L })));
for (const L of labels) {
  const sn = setOf(L.sid).sents.find((x) => x.id === L.id);
  if (!LBL.test(sn.t)) fail.push(`${L.id} 에 라벨 접두가 없다`);
}

console.log("| 세트 | 문장 | 문단 수 | 라벨 분리 |");
console.log("|---|--:|--:|---|");
for (const jb of jobs)
  console.log(`| \`${jb.sid}\` | ${jb.para.length} | ${jb.nPara} | ${jb.labels.length ? jb.labels.map((L) => `${L.label.trim()}@${L.id}`).join(" · ") : "—"} |`);
console.log("");

if (fail.length) { console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log(`✅ 사전 검사 통과 — ${jobs.length}세트 · 라벨 분리 ${labels.length}건`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

// ── 적용 ─────────────────────────────────────────────────────────────────
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.json.before_d213"), raw, "utf8");
const before = {};   // 검산용 — 라벨 제거 전 원문
let nextId = 902;
for (const jb of jobs) {
  const s = setOf(jb.sid);
  // ① para 부여 (계획 그대로)
  jb.para.forEach((x, i) => { s.sents[i].para = x.para; });
  // ② 라벨 분리 — 뒤에서부터 삽입해야 앞 index 가 밀리지 않는다
  // ★ id 는 **앞에서부터** 매기고 삽입만 뒤에서부터 한다. 둘을 한 루프로 묶으면
  //   (가)=s903 · (나)=s902 로 뒤집혀 읽는 사람이 혼란스럽다(발주 지정은 그 반대).
  const ins = jb.labels.map((L) => ({ L, i: s.sents.findIndex((x) => x.id === L.id) }))
    .sort((a, b) => a.i - b.i)
    .map((o) => ({ ...o, newId: `${jb.sid}s${nextId++}` }))
    .sort((a, b) => b.i - a.i);
  for (const { L, i, newId } of ins) {
    const sn = s.sents[i];
    before[sn.id] = sn.t;
    const lab = LBL.exec(sn.t)[0];
    sn.t = sn.t.slice(lab.length);
    const node = { id: newId, t: lab.trim(), sentType: "workTag", para: sn.para };
    s.sents.splice(i, 0, node);
  }
  // ③ 라벨이 자기 para 를 차지하므로 그 뒤 문단 번호를 +1 씩 민다(선례 r2026b)
  let bump = 0;
  for (const sn of s.sents) {
    if (sn.sentType === "workTag" && LBL.test(sn.t + " ")) { sn.para = sn.para + bump; bump++; continue; }
    sn.para = sn.para + bump;
  }
}
fs.writeFileSync(DATA, JSON.stringify(j), "utf8");   // §13⑪ minified 유지

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const raw2 = fs.readFileSync(DATA, "utf8");
const j2 = JSON.parse(raw2);
const bad = [];
const setOf2 = (sid) => (j2[YK].reading || []).find((x) => (x.setId || x.id) === sid);
console.log("| 세트 | 문장 | para 범위 | workTag |");
console.log("|---|--:|---|---|");
for (const jb of jobs) {
  const s = setOf2(jb.sid);
  const ps = s.sents.map((x) => x.para);
  const wt = s.sents.filter((x) => x.sentType === "workTag");
  console.log(`| \`${jb.sid}\` | ${s.sents.length} | ${Math.min(...ps)}~${Math.max(...ps)} | ${wt.map((x) => x.t + "@" + x.id).join(" · ") || "—"} |`);
  if (s.sents.some((x) => x.para === undefined)) bad.push(`${jb.sid} para 없는 문장이 있다`);
  // para 는 1부터 시작하고 단조 비감소여야 한다
  if (Math.min(...ps) !== 1) bad.push(`${jb.sid} para 가 1 로 시작하지 않는다`);
  for (let i = 1; i < ps.length; i++) if (ps[i] < ps[i - 1]) bad.push(`${jb.sid} para 가 감소한다 (${ps[i - 1]}→${ps[i]})`);
  if (wt.length !== jb.labels.length) bad.push(`${jb.sid} workTag ${wt.length} ≠ ${jb.labels.length}`);
}
// ★ 라벨 제거가 접두만 뗐는가 — 나머지 바이트 동일
for (const [id, orig] of Object.entries(before)) {
  const sid = id.replace(/s\d+$/, "");
  const sn = setOf2(sid).sents.find((x) => x.id === id);
  const lab = LBL.exec(orig)[0];
  if (Buffer.from(sn.t, "utf8").compare(Buffer.from(orig.slice(lab.length), "utf8")) !== 0)
    bad.push(`🔴 ${id} 라벨 제거 후 나머지가 원문과 다르다`);
}
// ★ 역방향 — para 를 지우고 workTag 를 빼고 라벨을 되붙이면 원본과 같아야 한다
const j3 = JSON.parse(raw2);
for (const jb of jobs) {
  const s = (j3[YK].reading || []).find((x) => (x.setId || x.id) === jb.sid);
  s.sents = s.sents.filter((x) => !/s90[2-9]$/.test(x.id));
  for (const sn of s.sents) {
    delete sn.para;
    if (before[sn.id] !== undefined) sn.t = before[sn.id];
  }
}
if (JSON.stringify(j3) !== JSON.stringify(JSON.parse(raw)))
  bad.push("🔴 역방향 바이트 일치 실패 — 지정 변경 외에 달라진 곳이 있다");

console.log("");
console.log(`- 적용 후 MD5 \`${md5(raw2)}\` (${raw2.length - raw.length}B)`);
console.log("- 백업 `pipeline/backups/all_data_204.json.before_d213`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log(`- ${jobs.length}세트 para 부여 · 라벨 ${labels.length}건 분리 · 라벨 외 바이트 무변 · 역방향 바이트 일치`);
console.log("- 문학 4세트·annotations 는 열지도 쓰지도 않았다");
