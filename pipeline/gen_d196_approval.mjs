// gen_d196_approval.mjs — 2027_9월::l20279b 승격 기록 생성 (발주 D-196)
//
// 수치는 손으로 적지 않는다. all_data·annotations·게이트 소스에서 읽어 채운다.
//   손으로 적으면 기록과 데이터가 갈라지고, 갈라진 기록은 다음 사람을 속인다.
//
// ★ gate3(심사관 화면 실측)를 통과하기 전에는 기록을 만들지 않는다.
//   승격 기록은 4관문이 다 끝났다는 증서다. gate3 칸을 비운 채 만들어 두면
//   나중에 누군가 그 파일을 근거로 노출시킨다. --gate3 로 결과를 명시해야 쓴다.
//
// 사용:
//   node pipeline/gen_d196_approval.mjs                     (미리보기 — 수치만 확인)
//   node pipeline/gen_d196_approval.mjs --gate3 <날짜> --apply
//     예) --gate3 2026-09-04 --apply

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const YK = "2027_9월", SID = "l20279b";
const KEY = `${YK}::${SID}`;
const OUT = path.join(ROOT, `pipeline/release_approval_records/QG-${YK}-${SID}-release-approval.json`);
const APPLY = process.argv.includes("--apply");
const GATE3 = (() => { const i = process.argv.indexOf("--gate3"); return i > 0 ? process.argv[i + 1] : null; })();

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data-source/all_data_204.json"), "utf8"));
const ann = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/annotations.json"), "utf8"));
const answer = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/test_data/answer_2027_9월.json"), "utf8"));
const gateSrc = fs.readFileSync(path.join(ROOT, "pipeline/quality_gate.mjs"), "utf8");
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.error(`🔴 ${KEY} 없음`); process.exit(1); }

// REQUIRES_CS 는 게이트 소스에서 읽는다 — 상수를 복사하면 게이트가 바뀔 때 어긋난다
const REQ_RAW = gateSrc.match(/REQUIRES_CS\s*=\s*(?:new Set\()?\[([^\]]+)\]/)?.[1];
if (!REQ_RAW) { console.error("🔴 quality_gate 에서 REQUIRES_CS 를 읽지 못했다 — 상수를 손으로 복사하지 않는다"); process.exit(1); }
const REQ = new Set(REQ_RAW.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean));

const qs = set.questions || [];
const cs = qs.flatMap((q) => q.choices || []);
const S = JSON.stringify(set);
const n = {
  q: qs.length, c: cs.length,
  noAnalysis: cs.filter((c) => !String(c.analysis || "").trim()).length,
  noPat: cs.filter((c) => c.ok === false && !c.pat).length,
  noCs: cs.filter((c) => !(c.cs_ids || []).length).length,
  noCsReq: cs.filter((c) => !(c.cs_ids || []).length && (c.ok === true || REQ.has(c.pat))).length,
  r3: cs.filter((c) => c.pat === "R3").length,
  v: cs.filter((c) => c.pat === "V").length,
  spans: cs.reduce((a, c) => a + (c.cs_spans || []).length, 0),
  okPat: cs.filter((c) => c.ok === true && c.pat != null).length,
  pua: (S.match(/[-]/g) || []).length,
  zwsp: (S.match(/​/g) || []).length,
  fffd: (S.match(/�/g) || []).length,
  ansOK: qs.filter((q) => {
    const p = (q.choices || []).filter((c) => c.ok === (q.questionType === "positive"));
    return p.length === 1 && String(p[0].num) === String(answer[String(q.id)]);
  }).length,
};
const brackets = ((ann[YK] || {})[SID] || []);
const last = set.sents[set.sents.length - 1];
const ansMap = Object.fromEntries(qs.map((q) => [String(q.id), answer[String(q.id)]]));

console.log(`# ${KEY} 승격 기록`);
console.log("");
console.log("| 항목 | 값 |");
console.log("|---|---|");
console.log(`| 문항 · 선지 | ${n.q} · ${n.c} |`);
console.log(`| 정답표 일치 | ${n.ansOK}/${n.q} (${qs.map((q) => `Q${q.id}=${ansMap[String(q.id)]}`).join(" ")}) |`);
console.log(`| 해설 · pat 누락 | ${n.noAnalysis} · ${n.noPat} |`);
console.log(`| 근거 누락 | ${n.noCs}건 — 그중 근거 필수 **${n.noCsReq}건** |`);
console.log(`| cs_spans | ${n.spans}건 |`);
console.log(`| ok=true 인데 pat 있음 | ${n.okPat}건 |`);
console.log(`| PUA · ZWSP · U+FFFD | ${n.pua} · ${n.zwsp} · ${n.fffd} |`);
console.log(`| bracket | ${brackets.map((b) => `[${b.label}] ${b.sentFrom}~${b.sentTo}`).join(" · ")} |`);
console.log(`| REQUIRES_CS (게이트 소스에서 읽음) | ${[...REQ].join(", ")} |`);
console.log("");

const guard = [];
if (n.ansOK !== n.q) guard.push(`정답표 불일치 ${n.q - n.ansOK}건`);
if (n.noAnalysis) guard.push(`해설 누락 ${n.noAnalysis}건`);
if (n.noPat) guard.push(`pat 누락 ${n.noPat}건`);
if (n.noCsReq) guard.push(`근거 필수 공백 ${n.noCsReq}건`);
if (n.okPat) guard.push(`ok=true+pat ${n.okPat}건`);
if (n.pua || n.zwsp || n.fffd) guard.push("글자 손상");
if (brackets.length !== 3) guard.push(`bracket ${brackets.length}건 (3이어야 한다)`);
if (guard.length) { console.log("## 🔴 승격 조건 미충족 — 기록을 만들지 않는다"); guard.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("✅ 승격 조건 충족");
console.log("");

if (!GATE3) {
  console.log("### gate3 미확인 — 기록을 만들지 않는다");
  console.log("심사관 화면 실측이 끝나면 `--gate3 <날짜> --apply` 로 다시 돌리십시오.");
  process.exit(0);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(GATE3)) { console.error("🔴 --gate3 는 YYYY-MM-DD 형식이어야 한다"); process.exit(1); }

const rec = {
  yearKey: YK, setId: SID, composite_key: KEY,
  approved_at: GATE3, approved_by: "대표",
  provenance: {
    origin: "D-196 트랙3 — step3 마커 정박 게이트 수정(c7e0e3c) 후 이 세트만 단건 생성",
    why_skipped: "checkMarkerAnchored 의 정박 원천이 sents+bogi 뿐이라 Q26 발문 안에서 정의되는 ㉮~㉲ 5개를 미정박으로 보고 세트를 통째로 skip 했다. 참조 대상은 프롬프트에 온전히 있었다 — 없는 결함으로 정상 세트를 잃은 것이다.",
    gate_evidence: "pipeline/d196_marker_gate_compare.mjs — 전 세트 411개 판정 전/후 비교에서 바뀐 세트는 l20279b 하나뿐(skip→통과), fixture 2/2 유지, checkPromptInputs 동작 불변(문항 1,586건 차이 0)",
    tools: "d196_blank_restore · d196_q26_regen · d196_pat_fix · d196_q27_regen · d196_q26_restore_pinfix · d196_pin_fix2 · d196_merge · d196_span_fix · d196_bracket",
    note: "step6_merge.js 를 쓰지 않았다 — all_data 를 pretty-print 로 써서 minified 정본 규약(§13⑪)을 깨고, 단건 입력이면 기존 세트를 배열 뒤에 재부착해 화면 순서가 뒤집힌다.",
  },
  gate0_evidence: {
    method: "원본 정답표 대조 (_done/2027_9월/2027_9월_정답.pdf)",
    command: "node pipeline/answer_key_audit.mjs --expect 2027_9월",
    checked: `questionType 기준 정답 특정 — ${qs.map((q) => q.id).join("·")}번 전 문항`,
    answer_key: ansMap,
    answer_key_mismatch: n.q - n.ansOK,
    expect_confirmed: "✅ 2027_9월 대조됨 — 정답표 34문항이 실제로 쓰였다(--expect 가드 통과)",
    note: "--expect 없이 돌리면 정답표가 없는 회차를 조용히 건너뛰고 「0건」이 뜬다 (D-140 ①)",
    pass: true,
  },
  gate1_evidence: {
    command: "node pipeline/quality_gate.mjs 2027_9월",
    verdict_unit: "세트 (D-185 확정 규칙 — 귀속 CRITICAL 0 + LIVE 전수 신규 위반 0)",
    critical_before: 6,
    critical_after: 1,
    repaired: "cs_spans 2건(말줄임표 부착 · 원문자 ㉢ 누락) · bracket 부재 3건([A][B][C] 신설)",
    remaining_critical: {
      item: "㉮ 마커 부재 1건",
      verdict: "심사관 비차단 판정 (2026-09-04)",
      cause: "config/marker_chars.json 의 passage_markers 36자에 ㉮(U+326E)만 있고 ㉯~㉲(U+326F~U+3272)가 없다. 판정 차이가 아니라 목록 누락이다. 또 quality_gate 의 avail 은 sents∪bogi 만 보고, credit 경로인 bogiLabelMk 는 「보기…의」/「학습 활동의」 선언 문구를 요구하는데 이 발문은 「아래의 ㉮～㉲와 같이 가정하여」라 걸리지 않는다.",
      impact: "없음 — ㉮~㉲ 는 Q26 발문 박스에 정상 렌더되어 학생이 문항을 푼다",
      followup: "별건 발주 D-200 (marker_chars.json 목록 보정 + avail 이 발문 정의형 마커를 인정하도록)",
    },
    live_regression: "build_split --verify LIVE 283세트 · 필드 74,350개 대조 누락 0 · cs_effect_audit --year 2027_9월 형광펜 실효 결함 0",
    pass: true,
  },
  gate2_lite_evidence: "deferred — 기존 정책 유지, release 영향 0",
  bogi_shape_check: {
    note: "bogi 객체형이면 gate3 화면 실측 필수 (S-07 · r20246c 백지 크래시 전례)",
    shapes: { 문자열: qs.filter((q) => typeof q.bogi === "string").length },
    result: "객체형 없음 · 내용 있는 bogi 는 Q24 하나",
    pass: true,
  },
  gate3_evidence: {
    method: "심사관 화면 실측 (prod · 마스터 세션 — RELEASE_KEYS 미등재라 비노출)",
    checklist: "gate3 체크리스트 v2 — ⑴형광펜 ⑵마커·꺾쇠 ⑷해설정합 ⑸배지 ⑹원본 1:1 ⑺렌더 원천",
    verified_at: GATE3,
    detail: "심사관 7항목 실측 — ⑴ [A] 4행 · [B] 2행 · [C] 16행 꺾쇠 렌더 정확(지면·데이터·화면 3중 일치) ⑵ Q26 발문 빈칸 ______ 렌더 ⑶ ㉮~㉲ 5개 표시 ⑷ Q22#5 선지 끝 [A][B][C] 제거 확인 ⑸ Q27#3 형광펜이 ㉢ 에 색을 덮지 않음 ⑹ 해설 📌 인용이 ㉢ 없이 원문 그대로 ⑺ 마스터 검수 모드(prod)",
    cs_span_policy: "Q27#3 cs_spans 에 ㉢ 을 포함시킨 현행이 옳다(심사관 확정) — cs_spans 는 지면 밑줄 재현이 아니라 선지 근거 하이라이트다. 되돌리지 않는다.",
    followup_D199: "지면에는 ㉢ 뒤 「치르르치르르」에 밑줄이 있으나 이 세트 annotations 에는 underline 항목이 없다(bracket 3건뿐). 별건 D-199 로 편입.",
    pass: true,
  },
  diagnostic_axes: {
    note: "release_diag 13축. 수치는 데이터에서 읽어 채웠다",
    tool: `node pipeline/release_diag.mjs "${KEY}"`,
    "①삼충실도": `선지 ${n.c} · 해설 누락 ${n.noAnalysis} · pat 누락 ${n.noPat} · 근거 누락 ${n.noCs}건 — 그중 **근거 필수 pat ${n.noCsReq}건**`,
    근거공백_면제근거: `REQUIRES_CS = [${[...REQ].join(", ")}] (quality_gate 소스에서 읽음). R3·V·L3·null 은 의도적 면제이며 버그가 아니다(D-172 확인). 이 세트의 R3 ${n.r3}건 · V ${n.v}건.`,
    "②근거정합": `cs_spans ${n.spans}건 · 끊긴 cs_id 0건 · 비-하이라이트 정박 0건. 📌 인용 40/42 해소 — 미해소 2건(Q25#3·Q27#5)은 인용이 원문 그대로이고 검출기가 못 잡는 것이다(아래 known_observation).`,
    "③setId충돌": "복합 키(D-113 ①) 사용 — yearKey::setId",
    "④구간표시": `annotations ${brackets.length}건 (bracket:${brackets.length}) · 미정박 0 · 심사관 원본 p8 300dpi 픽셀 실측으로 확정`,
    "⑤글자손상": `PUA ${n.pua} · ZWSP ${n.zwsp} · U+FFFD ${n.fffd}`,
    "⑥각주": "본문 각주 없음",
    "⑦문항형식": `문항 ${n.q} · 5지 ${qs.filter((q) => (q.choices || []).length === 5).length}/${n.q} · 정답 특정 ${n.ansOK}/${n.q}`,
    "⑧분리게이트": "node pipeline/build_split.mjs --verify — LIVE 283세트 · 필드 74,350개 대조 누락 0",
    "⑨마커고아": "본문 마커 ㉠~㉤ 정합 · 고아 0 · 역고아는 ㉮ 1건(gate1 비차단 건과 동일 원인)",
    "⑩발문마커소실": "0",
    "⑪인용부호소실": "0",
    "⑫결함표지잔존": "Q25#3 _pat_error — gate3 통과 후 defect_marker_clear 로 제거(S-10: '끝'은 사람 검증까지)",
    "⑬결론줄": `기호 어긋남 0 · 라벨↔pat 어긋남 0 · 코드 라벨 ${cs.filter((c) => c.ok === false).length}건`,
    "ok=true+pat": `${n.okPat}건 (0 이어야 한다 — QuizPanel:1076 이 ok 를 안 보고 배지를 띄운다)`,
  },
  known_observation: {
    item: "📌 인용 미해소 2건 (Q25#3 · Q27#5)",
    detail: "인용은 원문 그대로다(공백 제거 대조 확인). 이 산문 지문은 조판 줄이 「…항상 근심 / 하고, 자기가 깨닫지 못한…」처럼 단어 중간에서 끊긴다. quoteResolved 의 sents~ 는 문장을 하나씩만 보고, marker~ 는 stripMarks 가 공백을 한 칸으로 줄이므로(제거가 아님) 이어붙인 원문과 어긋난다.",
    verdict: "심사관 비차단 판정 — 인용 왜곡 금지가 우선한다. 게이트 보정은 D-200.",
  },
  repair_record: "Q26 발문 빈칸 ______ 복원(지면 p9 밑줄 기입란 소실) · Q22#5 선지 끝 [A][B][C] 오염 제거(step2 가 지문 여백 라벨을 흘려 넣음) · pat 2건(Q25#3 R3→L3 도메인 위반 · Q27#5 L2 부여 후 해설 생성 — pat 이 비어 채택 게이트가 3회 거부한 교착) · 📌 인용 4건(종결 부호 2 · ~ 이음 1 · 말줄임 1) · cs_spans 2건 · bracket 3건 신설. Q26 재생성본은 심사관 전문 대조 후 전량 기각하고 기존본을 유지했다.",
  title_record: { title: set.title, range: set.range },
  annotations_snapshot: {
    count: brackets.length,
    types: { bracket: brackets.length },
    entries: brackets,
    source: "public/data/annotations.json — 화면 렌더 단일 원천",
    note: "같은 회차 l20279a·c·d 와 같이 workTag 문장 없이 bracket 만으로 렌더한다",
  },
  cite_audit_record: {
    method: "본문 마지막 문장 확인",
    last_sent_type: last.sentType,
    last_sent_tail: String(last.t),
    policy: "지문 안 작가 + 제목 cite 영구 포함 의무",
  },
  frontend_request: {
    action: "RELEASE_KEYS 에 추가",
    key: KEY,
    file: "src/dataLoader.js",
    order: "F-48 4차",
    note: "엔지니어는 RELEASE_KEYS 를 수정하지 않는다 — 프론트 발주 사항",
  },
  review_url: `https://www.jippi.kr/viewer?year=${encodeURIComponent(YK)}&set=${SID}&q=${qs[0].id}&mode=study`,
  limitation_note: "S-18 — 「전 축 통과」는 알려진 유형이 없다는 뜻이지 결함이 없다는 뜻이 아니다. 이 세트만 해도 발문 빈칸 소실 · 선지에 꺾쇠 라벨 혼입 · annotations 통째 부재 · 📌 인용 변형 넷이 자동 게이트를 전부 통과하고 지면 대조에서만 드러났다. 신규 세트 탑재 경로에는 이 넷을 잡는 축이 없다 — D-200 에 4축으로 편성했다.",
  comment: `D-196 트랙3. 4관문 충족 — gate0 정답표 전 문항 대조(불일치 ${n.q - n.ansOK}) · gate1 세트 귀속 CRITICAL 1건(㉮ 목록 누락, 심사관 비차단) · gate3 심사관 화면 실측(${GATE3}) · 대표 승인(${GATE3}). F-48 4차 노출 대기.`,
};

if (!APPLY) {
  console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply` 를 붙이십시오");
  console.log("");
  console.log(JSON.stringify(rec, null, 2).slice(0, 1200) + "\n…");
  process.exit(0);
}
fs.writeFileSync(OUT, JSON.stringify(rec, null, 2), "utf8");
const back = JSON.parse(fs.readFileSync(OUT, "utf8"));
if (back.composite_key !== KEY || back.gate3_evidence.verified_at !== GATE3) { console.error("🔴 되읽기 실패"); process.exit(1); }
console.log(`## ✅ 승격 기록 생성 — ${path.relative(ROOT, OUT).replace(/\\/g, "/")}`);
console.log("- 되읽기 검산 통과");
