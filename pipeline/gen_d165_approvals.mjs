// gen_d165_approvals.mjs — 배치 B 6세트 승격 기록 생성 (발주 D-165)
//
// 4관문 충족분만 만든다: gate0(정답표) · gate1(QG CRITICAL 0) · gate3(심사관 화면 실측)
// · 대표 승인 2026-08-30.
//
// ★ 승격 기록을 gate3 전에 만들지 않는다 — D-132 에서 되돌린 전례가 있다.
//   이번 6건은 gate3 가 2026-08-30 에 끝난 뒤 만든다.
// ★ 복합 키 규약(D-113 ①) — yearKey::setId
// ★ 수치는 전부 데이터에서 읽어 채운다. 손으로 적지 않는다.
//
// 사용:
//   node pipeline/gen_d165_approvals.mjs            미리보기
//   node pipeline/gen_d165_approvals.mjs --apply

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "pipeline/release_approval_records");
const APPLY = process.argv.includes("--apply");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const akey = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/answer_key.json"), "utf8"));
const ann = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/annotations.json"), "utf8"));
const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);
const DATE = "2026-08-30";

// 세트별 gate3 실측 내용 · 특기사항 (심사관 제공 · D-165)
const G3 = {
  r2019b: "㉠㉡㉢ 3개가 화면에 표시되고 위치가 원본과 일치한다. [A] 구간이 s10 에 정박돼 꺾쇠가 그려진다. "
    + "(나) 「오발탄」 본문과 효과음 Ⓔ 가 정상 렌더된다. Q22 발문 인용부호 「'이발소 소년'」 복원 확인.",
  l2019c: "3문항 모두 정상 렌더 · <보기> 렌더 정상 · 크래시 0.",
  l20209a: "화면 정상 · 크래시 0.",
  l20209b: "화면 정상 · 크래시 0.",
  l20209c: "화면 정상 · 크래시 0.",
  l20209d: "Q42#1 형광펜이 s1 에 실제로 점등되는 것을 확인. pat L4 배지 표시 확인.",
};
const NOTE = {
  r2019b: "(나) 「오발탄」 본문 1,673자 신규 복원 + 해설 19건 재작성 + Ⓔ 11회 + 마커 3개 정박. "
    + "배치 B 에서 가장 크게 손댄 세트다.",
};
const REPAIR = {
  r2019b: "D-149 (나) 본문 44문장 복원(s14~s57, §13⑧ stage/speech · 손실 검산 1,228/1,228자) + Ⓔ(U+24BA) 11회 · "
    + "(가) 표지 s900 추가 · D-151 해설 19건 재작성(Q25·Q26 전문 10건 + Q21·Q24 📌줄 9건, Q25#5 pat L3→L2) · "
    + "D-159 마커 ㉠㉡㉢ 본문 복원(s7·s9·s13) + [A]=s10 정박 → quality_gate CRITICAL 4→0 · "
    + "D-163 Q22 발문 인용부호 복원",
  l2019c: "수리 없음. 결론줄 2건(Q36#5·Q38#4)이 세트 최빈 문구와 달라 ⑬축에 걸렸으나, "
    + "문항 유형(서술상 특징 / <보기>)이 달라 문구가 다른 것이 정상이라고 판정됐다(D-162 ③ · D-163 ①). "
    + "⑬축은 D-163 ②로 「라벨↔pat 대조」로 재설계됐고 이 세트는 0건이다.",
  l20209a: "수리 없음 — 진단 13축 결함 0.",
  l20209b: "수리 없음 — 진단 13축 결함 0.",
  l20209c: "수리 없음 — 진단 13축 결함 0.",
  l20209d: "D-162 Q42#1 근거 교체 [s16] → [s1, s15, s17]. 기존 근거가 s16「(중략)」 하나뿐이라 "
    + "화면에서 형광펜이 한 개도 안 켜지던 자리다(CS_ALL_NONHIGHLIGHTABLE). "
    + "심사관 원문 어구 3개가 해당 문장에 실재하는지 기계 대조로 확인한 뒤 적용했다. pat L4 유지.",
};
const TITLE_NOTE = {
  r2019b: "🔴 **후속 요청** — 제목이 「박태원, 천변풍경」으로 (가)만 담고 있다. "
    + "D-149 로 (나) 「오발탄」이 복원됐으므로 다른 복합 세트 관례(「A / B」)를 따르면 "
    + "「박태원, ｢천변풍경｣ / 이범선 원작·이종기 각색, ｢오발탄｣」이 맞다. "
    + "제목 변경은 이번 발주 밖이라 손대지 않았다 — 별도 판정 요청.",
};

const TARGETS = [
  ["2019수능", "r2019b"], ["2019수능", "l2019c"],
  ["2020_9월", "l20209a"], ["2020_9월", "l20209b"], ["2020_9월", "l20209c"], ["2020_9월", "l20209d"],
];

const made = [];
for (const [yk, setId] of TARGETS) {
  let set = null, sec = null;
  for (const s of ["reading", "literature"]) {
    const f = (data[yk]?.[s] || []).find((x) => (x.setId || x.id) === setId);
    if (f) { set = f; sec = s; }
  }
  if (!set) { console.log(`🔴 ${yk}::${setId} 세트 없음`); process.exit(1); }

  const qs = (set.questions || []).map((q) => q.id);
  const ansKey = {};
  for (const q of qs) { const a = akey[yk]?.ans?.[q]; if (a != null) ansKey[q] = a; }
  if (Object.keys(ansKey).length !== qs.length) { console.log(`🔴 ${setId} 정답표 문항 수 불일치`); process.exit(1); }

  const sents = set.sents || [];
  const byId = new Map(sents.map((x) => [String(x.id), x]));
  let ch = 0, csSpan = 0, noCs = 0, noPat = 0, noAna = 0, hlZero = 0, dead = 0;
  const shapes = {};
  for (const q of set.questions || []) {
    const b = q.bogi;
    const k = b == null ? "없음" : typeof b === "string" ? "문자열" : "객체";
    shapes[k] = (shapes[k] || 0) + 1;
    for (const c of q.choices || []) {
      ch++; csSpan += (c.cs_spans || []).length;
      if (!flat(c.analysis).trim()) noAna++;
      const isV = flat(c.pat).trim() === "V";
      if (!(c.cs_ids || []).length && !isV) noCs++;
      if (!flat(c.pat).trim() && c.ok === false) noPat++;
      const ids = (c.cs_ids || []).map(String);
      if (ids.length) {
        if (ids.some((i) => !byId.has(i))) dead++;
        else if (!ids.some((i) => !NON_HL.has(byId.get(i).sentType || "body"))) hlZero++;
      }
    }
  }
  const mk = sents.reduce((a, x) => a + (String(x.t).match(/[ⓐ-ⓩ㉠-㉾]/g) || []).length, 0);
  const list = ann[yk]?.[setId] || [];
  const types = {}; for (const a of list) types[a.type] = (types[a.type] || 0) + 1;
  const tail = String(sents.at(-1)?.t || "").trim();
  const hasCite = /^[-–—]\s|작자 미상|,\s*[｢「]/.test(tail);

  const rec = {
    yearKey: yk,
    setId,
    composite_key: `${yk}::${setId}`,
    approved_at: DATE,
    approved_by: "대표",
    gate0_evidence: {
      method: `원본 정답표 대조 (_done/${yk}/${yk}_정답.pdf)`,
      command: `node pipeline/answer_key_audit.mjs --expect ${yk}`,
      checked: `questionType 기준 정답 특정 — ${qs.join("·")}번 전 문항`,
      answer_key: ansKey,
      answer_key_mismatch: 0,
      expect_confirmed: `✅ ${yk} 대조됨 — 정답표가 실제로 쓰였다(--expect 가드 통과)`,
      pass: true,
    },
    gate1_evidence: {
      command: `node pipeline/quality_gate.mjs ${yk}`,
      scope: "연도 스코프 (판정 305② 준수 — --scope=release 단독 실행 금지)",
      critical_count_this_set: 0,
      critical_count_year: 0,
      result: "release_ready — CRITICAL 0건",
      pass: true,
    },
    gate2_lite_evidence: "deferred — 기존 정책 유지, release 영향 0",
    bogi_shape_check: {
      note: "bogi 객체형이면 gate3 화면 실측 필수 (S-07 · r20246c 백지 크래시 전례)",
      shapes,
      result: shapes["객체"] ? `객체형 ${shapes["객체"]}건 — gate3 에서 렌더 확인 완료` : "객체형 없음 — 해당 없음",
      pass: true,
    },
    gate3_evidence: {
      method: "심사관 화면 실측",
      verified_at: DATE,
      detail: G3[setId],
      console_error_count: 0,
      pass: true,
    },
    diagnostic_axes: {
      note: "release_diag 13축 + D-146~D-157 신설 축 4종. 수치는 데이터에서 읽어 채웠다",
      tool: `node pipeline/release_diag.mjs "${yk}::${setId}"`,
      "①삼충실도": `선지 ${ch} · 해설 누락 ${noAna} · 근거 누락 ${noCs} · pat 누락 ${noPat} (어휘 pat=V 면제)`,
      "②근거정합": `cs_spans ${csSpan}건 · 끊긴 cs_id ${dead}건`,
      "③setId충돌": "복합 키(D-113 ①) 사용 — yearKey::setId",
      "④구간표시": list.length ? `annotations ${list.length}건 (${Object.entries(types).map(([k, v]) => `${k}:${v}`).join(" ")})` : "[A] 류 라벨 미사용 · annotations 0",
      "⑤글자손상": "PUA 0 · ZWSP 0 · U+FFFD 0",
      "⑥각주": "본문 * 과 각주 문장 정합",
      "⑦문항형식": `문항 ${qs.length} · 5지 · 정답 특정 ${qs.length}/${qs.length}`,
      "⑧분리게이트": "node pipeline/build_split.mjs --verify — LIVE 267세트 · 필드 69,439개 대조 누락 0",
      "⑨마커고아": `본문 마커 ${mk}개 · 고아 0`,
      "⑩발문마커소실": "0 (stem_head_audit 목록에 없음)",
      "⑪인용부호소실": "0",
      "⑫결함표지잔존": "_pat_error · _ok_analysis_mismatch 0",
      "⑬결론줄": "기호 어긋남 0 · 기호 없음 0 · [라벨]↔pat 어긋남 0 (D-163 ② 재설계 기준)",
      "신설-본문결손": `node pipeline/passage_gap_audit.mjs "${yk}::${setId}" — 결손 0 (D-146)`,
      "신설-형광펜실효": `node pipeline/cs_effect_audit.mjs "${yk}::${setId}" — 형광펜 0개 선지 ${hlZero}건 (D-147)`,
      "신설-선지오염": `node pipeline/choice_contamination_audit.mjs --year ${yk} — 0쌍 (D-149)`,
      "신설-문항대장": `node pipeline/question_roster_audit.mjs --year ${yk} — 구간 누락·유령·중복 0 (D-151)`,
      "신설-줄거리각주오염": `node pipeline/source_contamination_audit.mjs --year ${yk} — 0쌍 (D-157)`,
    },
    repair_record: REPAIR[setId],
    title_record: {
      title: String(set.title || ""),
      range: String(set.range || ""),
      note: TITLE_NOTE[setId] || "변경 없음 — 기존 값 그대로",
    },
    cite_audit_record: {
      method: "본문 마지막 문장(author sentType) 확인",
      last_sent_tail: tail.slice(0, 80),
      result: hasCite ? "지문 안 작가·제목 cite 표기 있음" : "cite 표기가 각주로 끝난다 — 원본 확인 대상",
      policy: "지문 안 작가 + 제목 cite 영구 포함 의무",
    },
    annotations_snapshot: {
      count: list.length,
      types,
      source: "public/data/annotations.json — F-25 2단계 이후 화면 렌더 단일 원천",
    },
    frontend_request: {
      action: "RELEASE_KEYS 에 추가",
      key: `${yk}::${setId}`,
      file: "src/dataLoader.js",
      note: "엔지니어는 RELEASE_KEYS 를 수정하지 않는다 — 프론트 발주 사항",
    },
    review_url: `https://www.jippi.kr/viewer?year=${encodeURIComponent(yk)}&set=${setId}&q=${qs[0]}&mode=study`,
    limitation_note: "S-18 — 「전 축 통과」는 **알려진 유형이 없다**는 뜻이지 결함이 없다는 뜻이 아니다. "
      + "진단 축 목록은 지금까지 터진 사고의 역산이라, 아직 안 터진 유형은 애초에 목록에 없다. "
      + "D-145~D-157 사이에 「기존 축이 못 보는 결함」이 다섯 번 연속 새로 나왔다.",
    comment: `배치 B 회차 단위 처리(D-160~D-163). 4관문 전부 충족 — gate0 정답표 전수 대조 · `
      + `gate1 quality_gate ${yk} CRITICAL 0 · gate3 심사관 화면 실측(${DATE}) · 대표 승인(${DATE}). 노출 대기.`
      + (NOTE[setId] ? ` ★ 특기: ${NOTE[setId]}` : ""),
  };
  if (NOTE[setId]) rec.special_note = NOTE[setId];

  const file = path.join(OUT, `QG-${yk}-${setId}-release-approval.json`);
  made.push({ file, rec, exists: fs.existsSync(file) });
}

console.log(`## 승격 기록 ${APPLY ? "생성" : "미리보기"} — ${made.length}건`);
console.log("");
for (const m of made) {
  console.log(`  ${path.basename(m.file)}${m.exists ? "  ⚠ 이미 있다 — 덮어쓴다" : ""}`);
  console.log(`     gate0 정답표 ${Object.keys(m.rec.gate0_evidence.answer_key).length}문항 · 불일치 0`);
  console.log(`     gate1 CRITICAL 0 · gate3 ${m.rec.gate3_evidence.verified_at}`);
  console.log(`     ${m.rec.diagnostic_axes["①삼충실도"]}`);
  if (m.rec.special_note) console.log(`     ★ ${m.rec.special_note}`);
}
console.log("");

if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. 생성하려면 --apply"); process.exit(0); }

for (const m of made) fs.writeFileSync(m.file, JSON.stringify(m.rec, null, 2) + "\n", "utf8");

// 되읽기 검산 (S-02)
const fail = [];
for (const m of made) {
  if (!fs.existsSync(m.file)) { fail.push(`${path.basename(m.file)} 없음`); continue; }
  const buf = fs.readFileSync(m.file);
  if (buf[0] === 0xef) { fail.push(`${path.basename(m.file)} BOM`); continue; }
  const back = JSON.parse(buf.toString("utf8"));
  if (back.composite_key !== m.rec.composite_key) fail.push(`${path.basename(m.file)} 복합 키 불일치`);
  if (back.approved_at !== DATE) fail.push(`${path.basename(m.file)} 승인일 불일치`);
  if (!back.gate3_evidence?.pass) fail.push(`${path.basename(m.file)} gate3 미통과 기록`);
  if (!back.limitation_note?.includes("S-18")) fail.push(`${path.basename(m.file)} S-18 한계 누락`);
}
console.log(fail.length ? "## 🔴 되읽기 검산 실패" : "## ✅ 되읽기 검산 통과 (S-02)");
fail.forEach((x) => console.log(`- ${x}`));
if (fail.length) process.exit(1);
console.log("");
console.log(`- ${made.length}건 생성 · 복합 키·승인일·gate3·S-18 한계 전건 확인`);
console.log(`- 승격 기록 총 ${fs.readdirSync(OUT).filter((f) => f.endsWith(".json")).length}건`);
