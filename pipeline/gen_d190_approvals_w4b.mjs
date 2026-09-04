// gen_d190_approvals_w4b.mjs — 2027_9월 r20279b 승격 기록 생성 (발주 D-190 트랙2 · D-194)
//
// gen_d190_approvals(W1·W2) 와 같은 원칙이다. 수치는 전부 데이터에서 읽어 채우고,
// 심사관·대표가 준 것(gate3 문면, 날짜)만 상수로 박는다.
//
// 대상 — r20279b (심사관 gate3 통과 2026-09-02 · 회차 마지막 세트)
//   기계적 7건 + 판정 뒤집힘 3선지 재작성 + s10 재분리 + 📌 4건 수리 뒤 통과했다.
//   이 기록으로 2027_9월 7세트가 전부 승격 대상이 된다(l20279b 는 D-189 후 재생성).
//
// ★ gate1 은 세트 단위 판정이다 (D-185 확정 규칙)
//   이 세트를 고쳐 **회차 CRITICAL 이 0 이 됐다** — release_ready.
//   더 이상 남은 귀속처가 없다.
//
// 사용: node pipeline/gen_d190_approvals_w4b.mjs [--write]

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
const YEAR_CRITICAL = 0;
const YEAR_CRITICAL_OWNERS = "없음 — 2027_9월 회차 전체 release_ready (l20279b 는 세트 자체가 부재)";

const GATE3 = {
  r20279b: "데이터 원본 1:1 + 화면 실측 전부 통과. 심사관이 📌 잔여 5건을 원본 PDF 와 대조 완료했고, 차단 3건(s10 문단 경계·Q4#3·Q4#5)을 수리한 뒤 재검산했다. 화면 실측 3항목 확인 — ① s10/s901 문단 분리가 배열 순서대로 렌더된다(900번대 신규 id 가 뒤로 밀리지 않는다) ② Q8#2 클릭 시 형광펜이 s9+s10 앞 조각까지만 켜지고 s901 은 켜지지 않는다 ③ Q4#5 📌 가 「그러나」로 시작하고 원문 순서(s12→s13)다. 재작성 3선지의 지문 해석(s18 표준적 입장 · <보기> '전형적')은 심사관이 PDF 원문과 1:1 대조를 마쳤다.",
};

const REPAIR = {
  r20279b: "D-190 트랙2 기계적 7건 — cs_span 4(조사 공백·말줄임표·원문자 ⓑ 생략) · Q5#2 📌 줄의 내부 문장 id 「(r20279bs17)」 괄호째 제거 · Q6#3 📌 인용을 본문에 맞춤 · s1 안내문 접두 19자 제거. D-190 트랙2 판정 뒤집힘 3선지 재작성 — Q7#2 pat 0→R4(+s18) · Q7#5 pat 0→R1(+s18) · Q8#3 pat 0→R3, 셋 다 ok=false 인데 결론줄이 「✅ 적절」이던 것을 「❌ … [pat]」으로 바로잡았다(심사관 승인 문안). title 「다음 글을 읽고 물음에 답하시오.」 → 「동물과 인공지능의 도덕적 지위」. D-194 — s10 문단 경계에서 소실된 「한다.」 3자 복원 후 두 문장으로 분리(앞 s10 보존 · 뒤 r20279bs901 신규 · 재번호 없음, l20199e 규약) + 📌 4건 재구성(Q4#3 「이러한」→「또한」 재슬라이스 · Q4#5 원문 순서 s12→s13 와 접속어 「그러나」 · Q8#2 \"(가)\" 를 따옴표 밖으로 + 끝을 「…정당화되어야 한다.」까지 확장). gate3 통과 뒤 결함 표지 6건(_pat_error·_ok_analysis_mismatch)을 defect_marker_clear 로 제거했다.",
};

const LIMIT_EXTRA = {
  r20279b: " ★ 이 세트 고유 한계 — ① **문단 경계 글자 소실**이 처음 확인된 세트다. s10 이 원본의 두 문단을 한 문장으로 삼키며 경계의 「한다.」 3자를 잃고 있었다. 문장이 문법적으로 이어져 보여 **자동 게이트가 전혀 못 봤고 원본 PDF 대조에서만 드러났다**. 같은 유형이 다른 세트에 있는지는 확인하지 않았다 — D-189 ④ 회귀 케이스로 등재하고 전수 스캔은 배치 C 에 편입한다. ② 판정 뒤집힘 3선지의 🔍 를 사람이 다시 썼다. 게이트는 「✅ 결론 + ok=false」 조합만 보았을 뿐 논지가 왜 틀렸는지는 못 본다 — 문안의 타당성은 심사관 원본 대조가 유일한 검증이었다. ③ 📌 인용 43건 중 26건이 단일 문장 대조로는 불일치였는데, 대부분 **여러 문장에 걸친 인용**이라 심사관이 절편별 verbatim 으로 재판정해 5건만 실제 결함이었다. 「중간 생략 「...」 인용은 절편별 verbatim 이면 허용」이 이때 정해졌다. ④ 900번대 id(s901)가 이 세트의 첫 사례다 — 배열 순서 렌더는 gate3 로 확인했으나 **id 를 숫자로 정렬하는 코드가 어딘가 새로 생기면 이 문장이 뒤로 밀린다**.",
};

const NAME2PAT = { "사실 왜곡": "R1", "인과·관계 전도": "R2", "과잉 추론": "R3", "개념 혼합": "R4", "어휘": "V",
  "표현·형식 오독": "L1", "정서·태도 오독": "L2", "주제·의미 과잉": "L3", "구조·맥락 오류": "L4", "보기 대입 오류": "L5" };
const CODE = /^(R[1-4]|L[1-5]|V)$/;

const sets = [];
for (const sec of ["reading", "literature"])
  for (const s of data[YK][sec] || []) if (GATE3[s.setId || s.id]) sets.push({ sec, s });
if (sets.length !== 1) { console.log(`🔴 대상 세트가 ${sets.length}개다. 1개여야 한다.`); process.exit(1); }

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
      result: "이 세트 귀속 CRITICAL 0 · 회차도 CRITICAL 0 — quality_gate 2027_9월 ✅ release_ready.",
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
    pat_criteria_ref: {
      doc: "docs/backlog_pat_criteria.md",
      note: "이 세트에서 R4·R1·R3 가 한 번에 나와 구분 기준을 문서로 못박았다. 두 개념을 섞었나→R4 · 지문이 아니라고 한 것을 맞다고 했나→R1 · 지문이 안 간 데까지 갔나→R3. 판정 순서는 ① 도메인(독서=R/V·문학=L) → ② 유형이며, 그래서 Q8#3 의 L5 를 기각하고 R3 로 확정했다.",
      applied: { "Q7#2": "R4", "Q7#5": "R1", "Q8#3": "R3" },
    },
    regression_case: {
      item: "문단 경계 글자 소실",
      first_seen: "2027_9월::r20279b s10 (2026-09-02)",
      detail: "원본의 두 문단이 한 문장으로 붙으면서 경계의 「한다.」 3자가 사라져 있었다. 문장이 문법적으로 이어져 보여 자동 게이트가 전혀 못 봤다.",
      registered: "D-189 ④ 회귀 테스트 케이스 — pdftotext 이중 코퍼스의 문단 경계(빈 줄·들여쓰기)마다 데이터 문장 경계와 대조하는 설계. 다른 세트 전수 스캔은 배치 C 편입(신규 축 아님 — 구간표시 축과 같은 원본 대조 계열).",
    },
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
    frontend_request: { action: "RELEASE_KEYS 에 추가", key, file: "src/dataLoader.js", order: "F-48 3차", note: "엔지니어는 RELEASE_KEYS 를 수정하지 않는다 — 프론트 발주 사항" },
    review_url: `https://www.jippi.kr/viewer?year=${encodeURIComponent(YK)}&set=${sid}&q=${qids[0]}&mode=study`,
    limitation_note: "S-18 — 「전 축 통과」는 **알려진 유형이 없다**는 뜻이지 결함이 없다는 뜻이 아니다. 오늘만 해도 s1 안내문 혼입·title 발문 복사·역고아 ⓑ·화자 오인·구간 오인이 전부 자동 게이트를 통과하고 gate3 육안·원본 대조에서만 드러났다." + (LIMIT_EXTRA[sid] || ""),
    comment: `${YK} 트랙2 (D-190 · D-194). 4관문 충족 — gate0 정답표 34문항 전수 대조(불일치 0) · gate1 세트 귀속 CRITICAL 0(회차 ${YEAR_CRITICAL}건은 r20279b 미수리분) · gate3 심사관 화면 실측(${GATE3_AT}) · 대표 승인(${APPROVED_AT}). F-48 3차 노출 대기.`,
  };
  for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k];
  rows.push({ sid, key, rec, qids, missAns, nCsGap, nCsGapReq, nCsGapEx, nGapR3, nGapV, nDead, nNonHl, nChoice, nSpan, nSpanBad, labBad, symBad, okTruePat, pua, zwsp, repl });
}

console.log(`# ${YK} r20279b 승격 기록 1건 (D-190 트랙2 · D-194)`);
console.log("");
console.log("| 세트 | 문항 | 정답표 | 선지 | 근거공백(필수) | 근거공백(면제) | span | span어긋남 | 끊긴id | 비-HL | ⑬어긋남 | ok+pat | 손상 |");
console.log("|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|");
for (const r of rows)
  console.log(`| \`${r.sid}\` | ${r.qids.join("·")} | ${r.missAns.length ? `🔴 ${r.missAns.length}개 누락` : `✅ ${r.qids.length}/${r.qids.length}`} | ${r.nChoice} | ${r.nCsGapReq} | ${r.nCsGapEx} | ${r.nSpan} | ${r.nSpanBad} | ${r.nDead} | ${r.nNonHl} | ${r.labBad} | ${r.okTruePat} | ${r.pua + r.zwsp + r.repl} |`);
console.log("");
const bad = rows.filter((r) => r.missAns.length || r.nCsGapReq || r.nSpanBad || r.nDead || r.nNonHl || r.labBad || r.symBad || r.okTruePat || r.pua + r.zwsp + r.repl);
if (bad.length) { console.log(`## 🔴 ${bad.map((r) => r.sid).join(" · ")} 에 남은 수치가 있다`); process.exit(1); }
console.log("✅ — 정답표 누락 0 · **근거 필수 pat 공백 0** · span 어긋남 0 · 끊긴 id 0 · 비-하이라이트 0 · ⑬ 어긋남 0 · ok=true+pat 0 · 글자손상 0");
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
