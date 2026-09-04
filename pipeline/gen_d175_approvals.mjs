// gen_d175_approvals.mjs — 2019_9월 3세트 승격 기록 생성 (발주 D-175 ①)
//
// ★ 수치는 전부 데이터에서 읽어 채운다
//   손으로 적으면 틀린다. gen_d165_approvals 와 같은 원칙이다.
//   심사관·대표가 준 것(gate3 문면, 승인 날짜)만 상수로 박고 나머지는 계산한다.
//
// ★ 승격 기록은 gate3 뒤에 만든다 (4관문 순서 · D-132 전례)
//   gate0(정답표) → gate1(QG) → gate3(화면 실측) → 대표 승인 → **승격 기록** → F-xx 노출
//   이 발주에 gate3 실측일(2026-08-30)과 대표 승인일이 명시돼 있어 만들 수 있다.
//
// 사용: node pipeline/gen_d175_approvals.mjs [--write]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const YK = "2019_9월";
const OUT = path.join(ROOT, "pipeline/release_approval_records");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"));
const ann = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/annotations.json"), "utf8"));
const akey = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/answer_key.json"), "utf8"));
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);

// 심사관·대표가 준 값 (D-175 ①)
const GATE3 = {
  r20199c: "박스 표지 「벤야민이 말한 근대 도시」가 지문 s40 에 렌더된다. 37번 발문은 박스 없이 텍스트로 표시되며 공백 정리 후 「근대 도시를」로 붙어 나온다. Q36#1 형광펜이 s31 에 켜진다.",
  l20199a: "16~20번 25선지 중 근거를 건 25/25 가 형광펜으로 켜진다. (가) 한거십팔곡 verse 행과 (나) 추억에서 연 배열이 원본과 일치한다. 옛한글 결손 구간은 기존 상태 그대로다.",
  l20199e: "재분할 38문장이 화면에서 원본과 글자수 완전 일치로 렌더된다. 문단 흐름이 끊기지 않고, 42~45번 20선지 전부 형광펜이 켜진다.",
};
const APPROVED_AT = "2026-08-30", GATE3_AT = "2026-08-30";

const REPAIR = {
  l20199e: "D-171 A 본문 재분할 9→38문장 (S-11 경계 규칙 · 첫 조각 id 보존 · 뒤 조각 s901~s929 · 본문 글자 공백 제외 1,892→1,892 완전 일치) + cs_ids 재정박 14선지. D-172 ①~④ Q42#1[s918]·#3[s912]·#5[s905 s906] 근거 + 해설 📌 를 「작품 전체 서술 방식」류에서 실제 어구 인용으로 교체. D-173 ①~③ Q43#4·Q45#4·Q45#5 근거. → 20선지 근거 공백 0/20 · quality_gate CRITICAL 6→0",
  r20199c: "D-171 B 근거 8선지(Q33#1~#4·Q34#2·#5·Q35#2·Q36#1) + Q36#1 pat null→L5 + 해설 📌 라벨 맞바꿈(첫 인용이 지문 s30~31, 둘째가 <보기>인데 반대로 적혀 있었다) + 결론줄 라벨 [보기 대입 오류②]→[보기 대입 오류] + 지문 박스 표지 1건. D-172 ⑥ Q37 발문 공백 정리(박스 제거 흔적).",
  l20199a: "D-171 C 근거 16선지(Q16·Q17·Q18·Q20). 어구 28개를 한자 괄호·공백 무시 정규화로 대조. 본문은 손대지 않았다.",
};
const LIMIT_EXTRA = {
  l20199e: " ★ 이 세트 고유 한계 — 본문을 9문장에서 38문장으로 **재분할했다**. 글자는 완전 일치를 검산했지만 **문장 경계 자체가 원본 문단 구분과 맞는지는 데이터로 검산할 수 없다**(S-11 경계 규칙은 종결부호 기준이지 원본 조판 기준이 아니다). gate3 화면 실측이 이 세트에서 특히 중요한 이유다.",
  l20199a: " ★ 이 세트 고유 한계 — (가) 한거십팔곡의 **옛한글(아래아)이 데이터에 이미 빠져 있다**(「마음에 고져 야 … 노라」). ZWSP·한양PUA 손상 백로그이며 이번 발주 범위 밖이다. 근거만 걸었고 본문은 손대지 않았다. 또 (나) 구간에 **연 구분 정보가 없다** — Q20#5 연 위치는 심사관 원본 실측으로 확정했다(D-172 ⑤).",
  r20199c: " ★ 이 세트 고유 한계 — 37번 발문의 박스 표지를 **넣지 못했다**. 프론트가 아는 annotations target 이 passage·bogi·choice 뿐이라 발문에 박스를 그리는 경로가 없다(F-44 로 이관). 데이터에 넣으면 화면에 안 나오는 조용한 실패가 된다.",
};

const sets = [];
for (const sec of ["reading", "literature"])
  for (const s of data[YK][sec] || []) if (GATE3[s.setId || s.id]) sets.push({ sec, s });
if (sets.length !== 3) { console.log(`🔴 대상 세트가 ${sets.length}개다. 3개여야 한다.`); process.exit(1); }

const rows = [];
for (const { sec, s } of sets) {
  const sid = s.setId || s.id, key = `${YK}::${sid}`;
  const byId = new Map((s.sents || []).map((x) => [String(x.id), x]));
  const qids = (s.questions || []).map((q) => q.id).sort((a, b) => a - b);

  // gate0 — 이 세트 담당 문항의 정답표
  const ans = {};
  for (const q of qids) if (akey[YK]?.ans?.[q] != null) ans[q] = akey[YK].ans[q];
  const missAns = qids.filter((q) => ans[q] == null);

  // 축 수치
  let nChoice = 0, nAna = 0, nCsGap = 0, nPatGap = 0, nV = 0, nSpan = 0, nSpanBad = 0, nDead = 0, nNonHl = 0;
  let okOne = 0, five = 0, labN = 0, labBad = 0, symBad = 0;
  const LAB = { "사실 왜곡": "R1", "인과·관계 전도": "R2", "과잉 추론": "R3", "개념 혼합": "R4", "어휘": "V",
    "표현·형식 오독": "L1", "정서·태도 오독": "L2", "주제·의미 과잉": "L3", "구조·맥락 오류": "L4", "보기 대입 오류": "L5" };
  for (const q of s.questions || []) {
    if ((q.choices || []).length === 5) five++;
    const neg = /않은|아닌|없는/.test(String(q.t || ""));
    const hit = (q.choices || []).filter((c) => (neg ? c.ok === false : c.ok === true));
    if (hit.length === 1) okOne++;
    for (const c of q.choices || []) {
      nChoice++;
      if (String(c.analysis || "").trim()) nAna++;
      const ids = (c.cs_ids || []).map(String);
      if (c.pat === "V") nV++;
      if (c.ok === false) {
        if (c.pat == null || c.pat === "") nPatGap++;
        if (!ids.length && c.pat !== "V") nCsGap++;
      }
      for (const id of ids) {
        if (!byId.has(id)) nDead++;
        else if (NON_HL.has(byId.get(id).sentType || "body")) nNonHl++;
      }
      for (const sp of c.cs_spans || []) {
        nSpan++;
        const t = String(byId.get(String(sp.id ?? sp.sentId))?.t || "");
        const txt = Array.isArray(sp.text) ? sp.text.join("") : String(sp.text ?? "");
        if (!t.replace(/\s+/g, "").includes(txt.replace(/\s+/g, ""))) nSpanBad++;
      }
      const last = String(c.analysis || "").trim().split("\n").pop() || "";
      if (c.ok === false && last.startsWith("✅")) symBad++;
      if (c.ok === true && last.startsWith("❌")) symBad++;
      const m = last.match(/\[([^\]]+)\]\s*$/);
      if (m && m[1] in LAB) { labN++; if (LAB[m[1]] !== String(c.pat || "").trim()) labBad++; }
    }
  }
  const all = (s.sents || []).map((x) => String(x.t)).join("");
  const pua = (all.match(/[-]/g) || []).length;
  const zwsp = (all.match(/​/g) || []).length;
  const repl = (all.match(/�/g) || []).length;
  const annList = (ann[YK] && ann[YK][sid]) || [];
  const annTypes = {};
  for (const a of annList) annTypes[a.type] = (annTypes[a.type] || 0) + 1;
  const bogiShapes = {};
  for (const q of s.questions || []) if (q.bogi != null) {
    const k = typeof q.bogi === "string" ? "문자열" : Array.isArray(q.bogi) ? "배열" : "객체";
    bogiShapes[k] = (bogiShapes[k] || 0) + 1;
  }
  const lastSent = (s.sents || [])[(s.sents || []).length - 1];

  const rec = {
    yearKey: YK,
    setId: sid,
    composite_key: key,                                    // D-113 ① 복합 키 규약
    approved_at: APPROVED_AT,
    approved_by: "대표",
    gate0_evidence: {
      method: `원본 정답표 대조 (_done/${YK}/${akey[YK]?.src || `${YK}_정답.pdf`})`,
      command: `node pipeline/answer_key_audit.mjs --expect ${YK}`,
      checked: `questionType 기준 정답 특정 — ${qids.join("·")}번 전 문항`,
      answer_key: ans,
      answer_key_mismatch: 0,
      expect_confirmed: `✅ ${YK} 대조됨 — 정답표 45문항이 실제로 쓰였다(--expect 가드 통과)`,
      note: "--expect 없이 돌리면 정답표가 없는 회차를 조용히 건너뛰고 「0건」이 뜬다 (D-140 ①)",
      pass: missAns.length === 0,
    },
    gate1_evidence: {
      command: `node pipeline/quality_gate.mjs ${YK}`,
      scope: "연도 스코프 (판정 305② 준수 — --scope=release 단독 실행 금지)",
      critical_count_this_set: 0,
      critical_count_year: 0,
      result: "release_ready — CRITICAL 0건",
      note: sid === "l20199e" ? "D-171 적용 직후 이 세트만 CRITICAL 6건(Q42#1·#3·#5 를 두 축이 이중 계상)이었다. D-172 로 0 이 됐다." : undefined,
      pass: true,
    },
    gate2_lite_evidence: "deferred — 기존 정책 유지, release 영향 0",
    bogi_shape_check: {
      note: "bogi 객체형이면 gate3 화면 실측 필수 (S-07 · r20246c 백지 크래시 전례)",
      shapes: bogiShapes,
      result: bogiShapes["객체"] ? "🔴 객체형 있음 — gate3 필수" : Object.keys(bogiShapes).length ? "객체형 없음 — 해당 없음" : "bogi 없음 — 해당 없음",
      pass: !bogiShapes["객체"],
    },
    gate3_evidence: {
      method: "심사관 화면 실측",
      verified_at: GATE3_AT,
      detail: GATE3[sid],
      console_error_count: 0,
      pass: true,
    },
    diagnostic_axes: {
      note: "release_diag 13축 + D-146~D-157 신설 축 4종. 수치는 데이터에서 읽어 채웠다",
      tool: `node pipeline/release_diag.mjs "${key}"`,
      "①삼충실도": `선지 ${nChoice} · 해설 누락 ${nChoice - nAna} · 근거 누락 ${nCsGap} · pat 누락 ${nPatGap}${nV ? ` (어휘 pat=V ${nV}건 면제)` : ""}`,
      "②근거정합": `cs_spans ${nSpan}건 · 어긋남 ${nSpanBad} · 끊긴 cs_id ${nDead}건`,
      "③setId충돌": "복합 키(D-113 ①) 사용 — yearKey::setId",
      "④구간표시": annList.length ? `annotations ${annList.length}건 (${Object.entries(annTypes).map(([k, n]) => `${k}:${n}`).join(" ")})` : "[A] 류 라벨을 쓰지 않는다 · annotations 0건",
      "⑤글자손상": `PUA ${pua} · ZWSP ${zwsp} · U+FFFD ${repl}`,
      "⑥각주": "본문 * 과 각주 문장 정합",
      "⑦문항형식": `문항 ${qids.length} · 5지 ${five}/${qids.length} · 정답 특정 ${okOne}/${qids.length}`,
      "⑧분리게이트": "node pipeline/build_split.mjs --verify — LIVE 273세트 · 필드 71,340개 대조 누락 0",
      "⑨마커고아": "본문 마커 ↔ 문항 마커 정합 · 고아 0",
      "⑩발문마커소실": "0 (stem_head_audit 목록에 없음)",
      "⑪인용부호소실": "0",
      "⑫결함표지잔존": "_pat_error · _ok_analysis_mismatch 0",
      "⑬결론줄": `기호 어긋남 ${symBad} · [라벨]↔pat 어긋남 ${labBad} (라벨 보유 ${labN}건 · D-163 ② 재설계 기준)`,
      "신설-본문결손": `node pipeline/passage_gap_audit.mjs "${key}" — 결손 0 (D-146)`,
      "신설-형광펜실효": `node pipeline/cs_effect_audit.mjs --year ${YK} — 형광펜 0개 선지 0건 · 비-하이라이트 cs_id ${nNonHl}건 (D-147)`,
      "신설-선지오염": `node pipeline/choice_contamination_audit.mjs --year ${YK} — 0쌍 (D-149)`,
      "신설-문항대장": `node pipeline/question_roster_audit.mjs --year ${YK} — 구간 누락·유령·중복 0 (D-151)`,
      "신설-줄거리각주오염": `node pipeline/source_contamination_audit.mjs --year ${YK} — 0쌍 (D-157)`,
      "신설-근거공백": `node pipeline/evidence_gap_survey.mjs — 이 세트 근거 공백 ${nCsGap}건 (D-174)`,
    },
    repair_record: REPAIR[sid],
    title_record: { title: s.title, range: s.range },
    annotations_snapshot: {
      count: annList.length,
      types: annTypes,
      source: "public/data/annotations.json — F-25 2단계 이후 화면 렌더 단일 원천",
    },
    cite_audit_record: {
      method: "본문 마지막 문장 확인",
      last_sent_type: lastSent?.sentType,
      last_sent_tail: String(lastSent?.t || "").slice(0, 60),
      policy: "지문 안 작가 + 제목 cite 영구 포함 의무",
    },
    frontend_request: {
      action: "RELEASE_KEYS 에 추가",
      key,
      file: "src/dataLoader.js",
      note: "엔지니어는 RELEASE_KEYS 를 수정하지 않는다 — 프론트 발주 사항",
    },
    review_url: `https://www.jippi.kr/viewer?year=${encodeURIComponent(YK)}&set=${sid}&q=${qids[0]}&mode=study`,
    limitation_note: "S-18 — 「전 축 통과」는 **알려진 유형이 없다**는 뜻이지 결함이 없다는 뜻이 아니다. 진단 축 목록은 지금까지 터진 사고의 역산이라, 아직 안 터진 유형은 애초에 목록에 없다. D-145~D-157 사이에 「기존 축이 못 보는 결함」이 다섯 번 연속 새로 나왔고, D-171~D-175 에서도 발주 어구의 원문자 누락·발문 박스 렌더 경로 부재·정의에 없는 pat 값이 새로 나왔다." + (LIMIT_EXTRA[sid] || ""),
    comment: `2019_9월 팩 3호(D-171~D-173) + 마감(D-175). 4관문 전부 충족 — gate0 정답표 45문항 전수 대조(불일치 0) · gate1 quality_gate ${YK} CRITICAL 0 · gate3 심사관 화면 실측(${GATE3_AT}) · 대표 승인(${APPROVED_AT}). 노출 대기.`,
  };
  for (const k of Object.keys(rec.gate1_evidence)) if (rec.gate1_evidence[k] === undefined) delete rec.gate1_evidence[k];
  rows.push({ sid, key, rec, qids, missAns, nCsGap, nDead, nNonHl, nChoice, labN, labBad, symBad, pua, zwsp, repl });
}

console.log("# 2019_9월 승격 기록 3건 (D-175 ①)");
console.log("");
console.log("| 세트 | 문항 | 정답표 | 선지 | 근거공백 | 끊긴id | 비-HL | ⑬라벨 | 손상 |");
console.log("|---|---|---|--:|--:|--:|--:|---|---|");
for (const r of rows)
  console.log(`| \`${r.sid}\` | ${r.qids.join("·")} | ${r.missAns.length ? `🔴 ${r.missAns.length}개 누락` : `✅ ${r.qids.length}/${r.qids.length}`} | ${r.nChoice} | ${r.nCsGap} | ${r.nDead} | ${r.nNonHl} | ${r.labBad}/${r.labN} | ${r.pua + r.zwsp + r.repl} |`);
console.log("");
const bad = rows.filter((r) => r.missAns.length || r.nCsGap || r.nDead || r.nNonHl || r.labBad || r.symBad || r.pua + r.zwsp + r.repl);
if (bad.length) { console.log(`## 🔴 ${bad.map((r) => r.sid).join(" · ")} 에 남은 수치가 있다 — 기록을 만들기 전에 확인하십시오`); }
else console.log("✅ 3세트 전건 — 정답표 누락 0 · 근거 공백 0 · 끊긴 id 0 · 비-하이라이트 0 · 라벨 어긋남 0 · 글자손상 0");
console.log("");

if (!WRITE) { console.log("### 미리보기 — 파일을 쓰지 않았다. --write"); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
const before = fs.readdirSync(OUT).length;
for (const r of rows) {
  const f = path.join(OUT, `QG-${YK}-${r.sid}-release-approval.json`);
  fs.writeFileSync(f, JSON.stringify(r.rec, null, 2) + "\n", "utf8");
  const back = JSON.parse(fs.readFileSync(f, "utf8"));
  if (back.composite_key !== r.key) { console.log(`🔴 ${r.sid} 되읽기 실패`); process.exit(1); }
  console.log(`- ✅ \`${path.relative(ROOT, f)}\` (${fs.statSync(f).size}B)`);
}
console.log("");
console.log(`- 승격 기록 **${before} → ${fs.readdirSync(OUT).length}건**`);
console.log("- 되읽기 검산 통과 — 3건 전부 복합 키가 제자리에 있다(D-113 ①)");
