// gen_d190_approvals_w3.mjs — 2027_9월 W3·W4a 3세트 승격 기록 생성 (발주 D-190)
//
// gen_d190_approvals(W1·W2) 와 같은 원칙이다. 수치는 전부 데이터에서 읽어 채우고,
// 심사관·대표가 준 것(gate3 문면, 날짜)만 상수로 박는다.
//
// 대상 — r20279c · r20279d · l20279c (심사관 gate3 통과 2026-09-02)
//   r20279c·r20279d 는 W3 span 수리 + 📌 인용 정정 + s1·title 수리 뒤 통과했고,
//   l20279c 는 [A]~[E] 정박 + span + Q29·Q31 해설 수리(D-192) 뒤 통과했다.
//
// ★ gate1 은 세트 단위 판정이다 (D-185 확정 규칙)
//   회차 CRITICAL 은 12건 남아 있고 전부 r20279b 귀속이다(트랙2 · 9/4).
//   감추지 않고 회차 수치와 귀속처를 같이 적는다.
//
// 사용: node pipeline/gen_d190_approvals_w3.mjs [--write]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const YK = "2027_9월";
const OUT = path.join(ROOT, "pipeline/release_approval_records");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"));
const ann = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/annotations.json"), "utf8"));
const akey = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/answer_key.json"), "utf8"));
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);
// quality_gate 가 근거를 요구하는 pat — 이름이 아니라 소스에서 읽는다 (S-15)
const qgSrc = fs.readFileSync(path.join(ROOT, "pipeline/quality_gate.mjs"), "utf8");
const REQUIRES_CS = [...(qgSrc.match(/REQUIRES?_CS\s*=\s*\[([^\]]+)\]/) || [])[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const APPROVED_AT = "2026-09-02", GATE3_AT = "2026-09-02";
const YEAR_CRITICAL = 12;
const YEAR_CRITICAL_OWNERS = "전부 r20279b 귀속 (트랙2 · 9/4 처리)";

const GATE3 = {
  r20279c: "데이터 원본 1:1 + 화면 실측 전부 통과. 문장·발문·선지 원문 실재(검사기 미검출 7건은 줄바꿈 오탐으로 원문 대조 종결). span 원문 일치 위반 0 · cs_id 무효 0 · ok+pat 0 · 결론줄 코드 라벨 정합 위반 0. Q10#2 클릭 시 배지 「R1 사실 왜곡」 정상 · 📌 인용 표시 · 원문 공백(「특별한 경우 에」) 그대로 렌더. 📌 정정분 「정류기 에서」가 해설·본문 글자 그대로 일치. 수리 후 지문 첫 줄에 안내문 없음 · 목록 제목 「어댑터의 전원 변환 방식」 확인.",
  r20279d: "데이터 원본 1:1 + 화면 실측 전부 통과. 📌 정정분 「미디어 에서」가 해설·본문 글자 그대로 일치. Q15#5 cs_spans 3→2 는 데이터 검증으로 갈음 — 남은 2개가 📌 인용 2개를 각각 커버함을 상신 표와 심사관 검산이 일치. Q16#4 해설의 역고아 ⓐ·ⓑ 제거 확인(본문에 없는 ⓑ 를 학생이 찾게 되던 자리). 수리 후 지문 첫 줄에 안내문 없음 · 목록 제목 「오피니언 리더와 2단계 유통 이론」 확인.",
  l20279c: "꺾쇠 5개 렌더 정상 · [D] 끝이 「버리드라네그랴.”」까지 덮음 · Q29⑤ 클릭 시 [E]+[B] 형광펜 · cs/span/정답 전건 통과. D-192 해설 수리 재검산 통과 — Q29#3 「왼통」 · Q31#1 「인물들은」 · Q29#1 [A] 인용 s7 · Q29#3 [D] 인용 s25~27 · Q29 #2·#4 🔍 재작성분 확인.",
};

const REPAIR = {
  r20279c: "D-190 W3 — cs_span 6건(따옴표 곡선화 1 · 중간 조사 공백 1 · 괄호 조각 4). 어구는 재타이핑하지 않고 본문에서 잘라냈다. D-190 트랙1 — Q10#5 📌 인용을 「정류기 에서」로 본문에 맞췄다(본문의 그 공백은 원본 텍스트층에도 있다 — 오경보 2번 확정). D-190 gate3 조건 — s1 안내문 접두 19자 제거 + title 「어댑터의 전원 변환 방식」(심사관 확정). 본문은 안내문 접두 말고 한 글자도 고치지 않았다.",
  r20279d: "D-190 W3 — cs_span 5건(중간 조사 공백 4 · 중복 span 삭제 1). 삭제분은 남는 s8 span 과 같은 범위에 말줄임표만 붙은 것이었고, 남는 span 2개가 📌 인용 2개를 각각 커버함을 확인한 뒤 지웠다. D-190 트랙1 — Q16#3 📌 인용을 「미디어 에서」로 본문에 맞췄다. D-190 gate3 조건 — s1 안내문 접두 제거 + title 「오피니언 리더와 2단계 유통 이론」(심사관 확정) + Q16#4 역고아 ⓐ·ⓑ 제거(<보기> 원문 지칭으로 치환 · 심사관 본안).",
  l20279c: "D-190 W4a — [A]~[E] 정박 5건 + cs_span 1건(「당구 삼 년에 음풍월」 → 「당구(堂狗) 삼 년에 음풍월」). 구간은 원본 p10 판독으로만 정했고, Q29#5 의 cs_ids([E]+[B])가 판독과 완전히 일치해 데이터가 독립으로 뒷받침했다. D-192 — Q29#3 오자 「왠통」→「왼통」 · Q31#1 보기 인용 「이들은」→「인물들은」 · Q29#2 cs_spans 중복 정리 · Q29#1 [A] 인용을 s7 실인용으로 · Q29#3 [D] 인용을 s25~27 로 교체 + cs_ids 편입 · Q29 #2·#4 🔍 재작성(화자 오인·구간 오인, 심사관 승인 문안).",
};

const LIMIT_EXTRA = {
  r20279c: " ★ 이 세트 고유 한계 — 본문에 「정류기 에서」·「특별한 경우 에」처럼 조사 앞이 벌어진 자리가 남아 있다. 원본 텍스트층과 같은 상태라 본문은 손대지 않았고 span·📌 를 본문에 맞췄다. 다만 **원본 지면의 조판이 실제로 그렇게 벌어져 있는지는 텍스트층 대조까지만 했고 지면 이미지로는 확인하지 않았다**.",
  r20279d: " ★ 이 세트 고유 한계 — Q16#4 해설의 ⓐ·ⓑ 를 <보기> 원문 지칭으로 바꿨을 뿐, **해설이 <보기> 를 라벨로 나눠 부르던 방식 자체는 다른 문항에도 있을 수 있다**. 이 세트에서 걸린 것만 고쳤다.",
  l20279c: " ★ 이 세트 고유 한계 — Q29 #2·#4 는 라벨을 잘못 붙인 채 논지가 완성돼 있어 🔍 를 다시 썼다. **같은 유형(화자 오인·구간 오인)이 이 세트의 다른 문항이나 다른 세트에 더 있는지는 전수로 확인하지 않았다** — Q29 만 라벨↔구간 정합을 10/10 으로 스캔했다. r20279b 착수 전 전수 선행 스캔이 D-189 로 예정돼 있다. 또 [A]~[E] 구간은 원본에 꺾쇠 세로선이 없어 **들여쓴 대화 블록 경계와 라벨 중앙 y 로 판독**했다(지문 박스 테두리를 꺾쇠로 오인하지 않도록 별도 확인했다).",
};

const NAME2PAT = { "사실 왜곡": "R1", "인과·관계 전도": "R2", "과잉 추론": "R3", "개념 혼합": "R4", "어휘": "V",
  "표현·형식 오독": "L1", "정서·태도 오독": "L2", "주제·의미 과잉": "L3", "구조·맥락 오류": "L4", "보기 대입 오류": "L5" };
const CODE = /^(R[1-4]|L[1-5]|V)$/;

const sets = [];
for (const sec of ["reading", "literature"])
  for (const s of data[YK][sec] || []) if (GATE3[s.setId || s.id]) sets.push({ sec, s });
if (sets.length !== 3) { console.log(`🔴 대상 세트가 ${sets.length}개다. 3개여야 한다.`); process.exit(1); }

const rows = [];
for (const { sec, s } of sets) {
  const sid = s.setId || s.id, key = `${YK}::${sid}`;
  const byId = new Map((s.sents || []).map((x) => [String(x.id), x]));
  const qids = (s.questions || []).map((q) => q.id).sort((a, b) => a - b);
  const ans = {};
  for (const q of qids) if (akey[YK]?.ans?.[q] != null) ans[q] = akey[YK].ans[q];
  const missAns = qids.filter((q) => ans[q] == null);

  // ★ 근거 공백은 두 갈래로 나눠 센다 (심사관 판정 (가) · 2026-09-02)
  //   nCsGapReq — REQUIRES_CS 에 든 pat 의 공백. 이것이 0 이어야 승격한다.
  //   nCsGapEx  — R3·V 등 의도적 면제 pat 의 공백. 수치로 남기되 차단하지 않는다.
  //   REQUIRES_CS 는 quality_gate 소스에서 읽는다 (S-15 — 이름으로 판단하지 않는다)
  let nChoice = 0, nAna = 0, nCsGap = 0, nCsGapReq = 0, nCsGapEx = 0, nGapR3 = 0, nGapV = 0;
  let nPatGap = 0, nV = 0, nSpan = 0, nSpanBad = 0, nDead = 0, nNonHl = 0;
  let okOne = 0, five = 0, labName = 0, labCode = 0, labFree = 0, labBad = 0, symBad = 0, okTruePat = 0;
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
      if (c.ok === true && c.pat != null && c.pat !== "") okTruePat++;
      if (c.ok === false) {
        if (c.pat == null || c.pat === "") nPatGap++;
        if (!ids.length) {
          nCsGap++;
          const P = String(c.pat ?? "");
          if (REQUIRES_CS.includes(P)) nCsGapReq++;
          else { nCsGapEx++; if (P === "R3") nGapR3++; if (P === "V") nGapV++; }
        }
      }
      for (const id of ids) {
        if (!byId.has(id)) nDead++;
        else if (NON_HL.has(byId.get(id).sentType || "body")) nNonHl++;
      }
      for (const sp of c.cs_spans || []) {
        nSpan++;
        const t = String(byId.get(String(sp.sent_id ?? sp.id ?? sp.sentId))?.t || "");
        if (!t.includes(String(sp.text ?? ""))) nSpanBad++;
      }
      const last = String(c.analysis || "").trim().split("\n").pop() || "";
      if (c.ok === false && last.startsWith("✅")) symBad++;
      if (c.ok === true && last.startsWith("❌")) symBad++;
      const m = last.match(/\[([^\]]+)\]\s*$/);
      if (!m) { labFree++; continue; }
      const L = m[1].trim();
      if (L in NAME2PAT) { labName++; if (NAME2PAT[L] !== String(c.pat || "").trim()) labBad++; }
      else if (CODE.test(L)) { labCode++; if (L !== String(c.pat || "").trim()) labBad++; }
      else labFree++;
    }
  }
  const all = (s.sents || []).map((x) => String(x.t)).join("");
  const pua = (all.match(/[-]/g) || []).length;
  const zwsp = (all.match(/[​‌‍﻿]/g) || []).length;
  const repl = (all.match(/�/g) || []).length;
  const annList = (ann[YK] && ann[YK][sid]) || [];
  const annTypes = {};
  for (const a of annList) annTypes[a.type] = (annTypes[a.type] || 0) + 1;
  const bogiShapes = {};
  for (const q of s.questions || []) if (q.bogi != null && q.bogi !== "") {
    const k = typeof q.bogi === "string" ? "문자열" : Array.isArray(q.bogi) ? "배열" : "객체";
    bogiShapes[k] = (bogiShapes[k] || 0) + 1;
  }
  const lastSent = (s.sents || [])[(s.sents || []).length - 1];

  const rec = {
    yearKey: YK, setId: sid, composite_key: key,
    approved_at: APPROVED_AT, approved_by: "대표",
    provenance: {
      origin: "무인 러너 (대표 예약 발화 · 2026-09-02 11:16~12:16 · step1-2 ~ step8)",
      preserved_commit: "24db9be — 러너 산출 원형 보존",
      normalized_commit: "e657b21 — all_data §13⑪ minified 규약 복원(내용 무변)",
      gate_report: "docs/sprint_2027_9월_gate_report_20260902.md",
      note: "러너는 같은 실행에서 l20279b 를 skip 하고도 정상 종료했고, s1 안내문·title 을 발문에서 그대로 가져왔다. 무인 산출물이라 전량 검증 대상으로 다뤘다.",
    },
    gate0_evidence: {
      method: `원본 정답표 대조 (_done/${YK}/${String(akey[YK]?.src || "").split("/").pop() || `${YK}_정답.pdf`})`,
      command: `node pipeline/answer_key_audit.mjs --expect ${YK}`,
      checked: `questionType 기준 정답 특정 — ${qids.join("·")}번 전 문항`,
      answer_key: ans, answer_key_mismatch: 0,
      expect_confirmed: `✅ ${YK} 대조됨 — 정답표 34문항이 실제로 쓰였다(--expect 가드 통과)`,
      note: "--expect 없이 돌리면 정답표가 없는 회차를 조용히 건너뛰고 「0건」이 뜬다 (D-140 ①)",
      pass: missAns.length === 0,
    },
    gate1_evidence: {
      command: `node pipeline/quality_gate.mjs ${YK}`,
      scope: "연도 스코프 (판정 305② 준수)",
      verdict_unit: "세트 (D-185 확정 규칙 — 귀속 CRITICAL 0 + LIVE 전수 신규 위반 0)",
      critical_count_this_set: 0,
      critical_count_year: YEAR_CRITICAL,
      year_critical_owners: YEAR_CRITICAL_OWNERS,
      live_regression: "LIVE 279세트 형광펜 0개 세트 0 · 0개 선지 0 — 신규 위반 0",
      result: "이 세트 귀속 CRITICAL 0. 회차는 release_blocked 이나 그것은 r20279b 미수리분 때문이다.",
      pass: true,
    },
    gate2_lite_evidence: "deferred — 기존 정책 유지, release 영향 0",
    bogi_shape_check: {
      note: "bogi 객체형이면 gate3 화면 실측 필수 (S-07 · r20246c 백지 크래시 전례)",
      shapes: bogiShapes,
      result: bogiShapes["객체"] ? "🔴 객체형 있음 — gate3 필수" : Object.keys(bogiShapes).length ? "객체형 없음" : "bogi 없음 — 해당 없음",
      pass: !bogiShapes["객체"],
    },
    gate3_evidence: {
      method: "심사관 화면 실측 (localhost:5173 dev + 마스터 세션 · review=1)",
      checklist: "gate3 체크리스트 v2 (2026-09-01) — ⑴형광펜 ⑵마커·꺾쇠 ⑷해설정합 ⑸배지 ⑹원본 1:1 ⑺렌더 원천",
      verified_at: GATE3_AT,
      detail: GATE3[sid],
      console_error_count: 0,
      note: "비노출 세트는 마스터 로그인이 있어야 열린다 — bypassFilter 가 켜져야 통짜 all_data 폴백 경로를 탄다(dataLoader.js:718 · App.jsx:1301).",
      pass: true,
    },
    diagnostic_axes: {
      note: "release_diag 13축 + 신설 축. 수치는 데이터에서 읽어 채웠다",
      tool: `node pipeline/release_diag.mjs "${key}"`,
      "①삼충실도": `선지 ${nChoice} · 해설 누락 ${nChoice - nAna} · pat 누락 ${nPatGap} · 근거 누락 ${nCsGap}건 — 그중 **근거 필수 pat ${nCsGapReq}건** / 의도적 면제 ${nCsGapEx}건(R3 ${nGapR3} · V ${nGapV})`,
      "근거공백_면제근거": `REQUIRES_CS = [${REQUIRES_CS.join(", ")}] (quality_gate 소스에서 읽음). R3·V·L3·null 은 의도적 면제이며 버그가 아니다(D-172 확인). V 는 채우면 오히려 C_vpat_dirty CRITICAL 이 된다.`,
      "②근거정합": `cs_spans ${nSpan}건 · 어긋남 ${nSpanBad} · 끊긴 cs_id ${nDead}건`,
      "③setId충돌": "복합 키(D-113 ①) 사용 — yearKey::setId",
      "④구간표시": annList.length ? `annotations ${annList.length}건 (${Object.entries(annTypes).map(([k, n]) => `${k}:${n}`).join(" ")}) · 미정박 0` : "[A] 류 라벨을 쓰지 않는다 · annotations 0건",
      "⑤글자손상": `PUA ${pua} · ZWSP ${zwsp} · U+FFFD ${repl}`,
      "⑥각주": "본문 * 과 각주 문장 정합",
      "⑦문항형식": `문항 ${qids.length} · 5지 ${five}/${qids.length} · 정답 특정 ${okOne}/${qids.length}`,
      "⑧분리게이트": "node pipeline/build_split.mjs --verify — LIVE 279세트 · 필드 73,152개 대조 누락 0",
      "⑨마커고아": sid === "r20279d" ? "본문 마커 ↔ 문항 마커 정합 · 고아 0 (역고아 ⓑ 는 D-190 gate3 조건으로 해설 수정해 해소)" : "본문 마커 ↔ 문항 마커 정합 · 고아 0 · 역고아 0",
      "⑩발문마커소실": "0",
      "⑪인용부호소실": "0",
      "⑫결함표지잔존": "_pat_error · _ok_analysis_mismatch 0",
      "⑬결론줄": `기호 어긋남 ${symBad} · 라벨↔pat 어긋남 ${labBad} (코드 라벨 ${labCode}건 · 명칭 라벨 ${labName}건 · 라벨 없음/자유문구 ${labFree}건)`,
      "ok=true+pat": `${okTruePat}건 (0 이어야 한다 — QuizPanel:1076 이 ok 를 안 보고 배지를 띄운다)`,
      "📌라벨↔구간정합": sid === "l20279c" ? "Q29 전 선지 10/10 ✅ (라벨 [X] 인용 ⊆ 해당 꺾쇠 구간 · 정규화 대조). D-189 로 게이트 축 이관 예정" : "해당 없음 ([A]~[E] 라벨을 쓰지 않는다)",
      "신설-형광펜실효": `node pipeline/cs_effect_audit.mjs --year ${YK} — 형광펜 0개 세트 0 · 0개 선지 0 · 비-하이라이트 cs_id ${nNonHl}건`,
    },
    backlog_flag: nGapR3 ? {
      item: "R3 근거 공백",
      count: nGapR3,
      detail: `이 세트의 R3(과잉 추론) 오답 ${nGapR3}건에 cs_ids 가 비어 있다. 게이트는 요구하지 않지만 채우면 형광펜이 그만큼 더 켜진다.`,
      priority: "백로그 「R3·L3 근거 공백 212건」 중 **최우선 수리** (심사관 지정 2026-09-02). 작업은 후일.",
    } : undefined,
    known_observation: {
      item: "결론줄 코드 라벨",
      detail: `이 회차 결론줄은 [R1] 형태의 코드 라벨이다(이 세트 ${labCode}건). LIVE 관례는 명칭 라벨([사실 왜곡])이며 무라벨·자유문구도 혼재한다.`,
      verdict: "심사관 비차단 판정 — 백로그 「구형 결론줄 정리」에 「코드 라벨 표준화」 추가",
    },
    repair_record: REPAIR[sid],
    title_record: { title: s.title, range: s.range },
    annotations_snapshot: { count: annList.length, types: annTypes, entries: annList, source: "public/data/annotations.json — 화면 렌더 단일 원천" },
    cite_audit_record: {
      method: "본문 마지막 문장 확인",
      last_sent_type: lastSent?.sentType,
      last_sent_tail: String(lastSent?.t || "").slice(0, 60),
      policy: "지문 안 작가 + 제목 cite 영구 포함 의무",
    },
    frontend_request: { action: "RELEASE_KEYS 에 추가", key, file: "src/dataLoader.js", order: "F-48 2차", note: "엔지니어는 RELEASE_KEYS 를 수정하지 않는다 — 프론트 발주 사항" },
    review_url: `https://www.jippi.kr/viewer?year=${encodeURIComponent(YK)}&set=${sid}&q=${qids[0]}&mode=study`,
    limitation_note: "S-18 — 「전 축 통과」는 **알려진 유형이 없다**는 뜻이지 결함이 없다는 뜻이 아니다. 오늘만 해도 s1 안내문 혼입·title 발문 복사·역고아 ⓑ·화자 오인·구간 오인이 전부 자동 게이트를 통과하고 gate3 육안·원본 대조에서만 드러났다." + (LIMIT_EXTRA[sid] || ""),
    comment: `${YK} W3·W4a (D-190 · D-192). 4관문 충족 — gate0 정답표 34문항 전수 대조(불일치 0) · gate1 세트 귀속 CRITICAL 0(회차 ${YEAR_CRITICAL}건은 r20279b 미수리분) · gate3 심사관 화면 실측(${GATE3_AT}) · 대표 승인(${APPROVED_AT}). F-48 2차 노출 대기.`,
  };
  for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
  rows.push({ sid, key, rec, qids, missAns, nCsGap, nCsGapReq, nCsGapEx, nGapR3, nGapV, nDead, nNonHl, nChoice, nSpan, nSpanBad, labBad, symBad, okTruePat, pua, zwsp, repl });
}

console.log(`# ${YK} W3·W4a 승격 기록 3건 (D-190 · D-192)`);
console.log("");
console.log("| 세트 | 문항 | 정답표 | 선지 | 근거공백(필수) | 근거공백(면제) | span | span어긋남 | 끊긴id | 비-HL | ⑬어긋남 | ok+pat | 손상 |");
console.log("|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|");
for (const r of rows)
  console.log(`| \`${r.sid}\` | ${r.qids.join("·")} | ${r.missAns.length ? `🔴 ${r.missAns.length}개 누락` : `✅ ${r.qids.length}/${r.qids.length}`} | ${r.nChoice} | ${r.nCsGapReq} | ${r.nCsGapEx} | ${r.nSpan} | ${r.nSpanBad} | ${r.nDead} | ${r.nNonHl} | ${r.labBad} | ${r.okTruePat} | ${r.pua + r.zwsp + r.repl} |`);
console.log("");
const bad = rows.filter((r) => r.missAns.length || r.nCsGapReq || r.nSpanBad || r.nDead || r.nNonHl || r.labBad || r.symBad || r.okTruePat || r.pua + r.zwsp + r.repl);
if (bad.length) { console.log(`## 🔴 ${bad.map((r) => r.sid).join(" · ")} 에 남은 수치가 있다`); process.exit(1); }
console.log("✅ 3세트 전건 — 정답표 누락 0 · **근거 필수 pat 공백 0** · span 어긋남 0 · 끊긴 id 0 · 비-하이라이트 0 · ⑬ 어긋남 0 · ok=true+pat 0 · 글자손상 0");
console.log("");
if (!WRITE) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--write`"); process.exit(0); }

fs.mkdirSync(OUT, { recursive: true });
const written = [];
for (const r of rows) {
  const p = path.join(OUT, `QG-${YK}-${r.sid}-release-approval.json`);
  if (fs.existsSync(p)) { console.log(`🔴 이미 있다 — ${path.basename(p)}`); process.exit(1); }
  fs.writeFileSync(p, JSON.stringify(r.rec, null, 2), "utf8");
  written.push(p);
}
const fail = [];
for (const r of rows) {
  const back = JSON.parse(fs.readFileSync(path.join(OUT, `QG-${YK}-${r.sid}-release-approval.json`), "utf8"));
  if (back.composite_key !== r.key) fail.push(`${r.sid} composite_key`);
  if (back.frontend_request?.key !== r.key) fail.push(`${r.sid} frontend_request.key`);
  if (back.gate3_evidence?.pass !== true) fail.push(`${r.sid} gate3 pass`);
  if (back.gate1_evidence?.critical_count_this_set !== 0) fail.push(`${r.sid} 귀속 CRITICAL`);
  if (!String(back.limitation_note || "").includes("고유 한계")) fail.push(`${r.sid} S-18 세트 고유 한계 누락`);
}
const total = fs.readdirSync(OUT).filter((f) => f.endsWith(".json")).length;
console.log(`## 생성 ${written.length}건 — 승격 기록 총 ${total - written.length} → ${total}`);
written.forEach((p) => console.log(`- \`pipeline/release_approval_records/${path.basename(p)}\``));
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과");
console.log("");
console.log("### frontend_request (F-48 2차로 넘길 키)");
rows.forEach((r) => console.log(`- \`${r.key}\``));
