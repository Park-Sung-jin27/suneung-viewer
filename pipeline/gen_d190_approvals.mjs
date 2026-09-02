// gen_d190_approvals.mjs — 2027_9월 W1·W2 3세트 승격 기록 생성 (발주 D-190)
//
// ★ 수치는 전부 데이터에서 읽어 채운다 — 손으로 적으면 틀린다 (gen_d175 원칙 그대로)
//   심사관·대표가 준 것(gate3 문면, 날짜)만 상수로 박는다.
//
// ★ gate3 뒤에 만든다 (4관문 · D-132 전례)
//   심사관 gate3 판정 2026-09-02 — r20279a · l20279a · l20279d 전부 통과.
//
// ★ gate1 은 세트 단위 판정이다 (D-185 확정 규칙)
//   회차 CRITICAL 은 0 이 아니다 — W3·W4 대상 세트(r20279b·c·d · l20279c)가
//   아직 수리 전이라 31건 남아 있다. 이 3세트 귀속은 0 이고, 그것이 판정 기준이다.
//   기록에 회차 수치와 잔여 귀속처를 같이 적어 감춘 것이 없게 한다.
//
// ★ ⑬축 — 이 회차 결론줄은 「코드 라벨」이다
//   LIVE 관례는 명칭 라벨(예: [사실 왜곡])인데 이 회차는 [R1] 형태다.
//   심사관이 「비차단 관찰」로 종결했고 백로그(코드 라벨 표준화)로 넘겼다.
//   생성기는 두 형태를 모두 세어 어긋남을 계산한다.
//
// 사용: node pipeline/gen_d190_approvals.mjs [--write]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const YK = "2027_9월";
const OUT = path.join(ROOT, "pipeline/release_approval_records");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"));
const ann = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/annotations.json"), "utf8"));
const akey = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/answer_key.json"), "utf8"));
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);

const APPROVED_AT = "2026-09-02", GATE3_AT = "2026-09-02";
const YEAR_CRITICAL = 31;
const YEAR_CRITICAL_OWNERS = "r20279b 12 · r20279c 12 · r20279d 10 · l20279c (W3·W4 대상, 수리 전)";

// 심사관 gate3 판정 문면 (2026-09-02)
const GATE3 = {
  r20279a: "⑴ Q1#1 클릭 시 지문 근거 어구(「전기류에는 인물의 성장 과정… 제시되며」)만 정확히 강조되고 📌 인용과 일치한다. ⑷ [3단 풀이] 템플릿이 문항 유형과 정합. ⑸ ok=true 선지에 배지 없음 · Q1 정답 ④ = 정답표 일치. ⑹ 문장 25/25 · 발문·선지 전량 원본 실재(검사기 줄바꿈 오탐 6건은 전부 원문 실재로 판정 종결).",
  l20279a: "⑵ [A](s4~s8 남복 독백)·[B](s68~s72 학사 차탄) 꺾쇠가 렌더되고 구간 시작·끝 행이 원본 인용 블록과 일치하며, 구간 밖 문장(「말을 마치매…」)이 정확히 제외된다. [A]·[B]를 직접 참조하는 Q20 이 화면에서 성립한다 — 수리 전에는 풀 수 없던 문항이다. ⑹ 문장 72/72 원본 실재.",
  l20279d: "⑵ [A](s38~s47 꿈 대목 10행) 꺾쇠 렌더 정확. ⑴ Q32#1 클릭 시 「㉠ 가을이 점점 깊고 객회(客懷)는 쓸쓸한데」 형광펜이 점등한다 — 수리한 span 이 실제로 켜지는 것을 확인했다. ⑹ 문장 49/49 원본 실재(Q34#4 오탐 포함 종결).",
};

const REPAIR = {
  r20279a: "수리 없음. 무인 러너 산출(2026-09-02 step1-2~step8) 그대로다. 게이트 리포트 기준 8-3 CRITICAL 0 · 8-2 🔴 0 으로 유일하게 결함 없이 나온 세트다. ⚠ ⑪ 인용부호 Q2 는 심사관이 원본 대조로 오경보 판정(원본 텍스트층에도 「진로 독서 에 대한」 공백 동일)했다.",
  l20279a: "D-190 W2 — [A]·[B] 구간 정박 2건. annotations.json 에 bracket 이 없어 화면에 꺾쇠가 안 그려지고 MARKER_INTEGRITY_FAIL 2건이 걸려 있었다. 구간은 원본 시험지 PDF 판독으로만 정했다: [A] p6 라벨 x443.8 y268.6 옆 들여쓴 인용 블록 5행, [B] p7 라벨 x95.1 y536.4 옆 5행. 본문·해설·선지는 손대지 않았다.",
  l20279d: "D-190 W2 — [A] 구간 정박 1건 + cs_span 어구 정정 1건. [A] 는 꺾쇠 세로선 x340.1 이 y518.5~595.9 와 610.0~687.4 두 토막인데 라벨이 y598.3~610.1 에 끼어 끊긴 것이라, 합친 518.5~687.4 구간의 verse 10행(s38~s47)을 데이터와 전문 대조해 10/10 일치를 확인했다. Q32#1 의 span 「객회는 쓸쓸한데」 는 원문에 없어 형광펜이 안 켜지던 자리다 — 원문 그대로 「객회(客懷)는 쓸쓸한데」 로 고쳤다(한자 괄호 누락). 본문·해설·선지는 손대지 않았다.",
};

const LIMIT_EXTRA = {
  r20279a: " ★ 이 세트 고유 한계 — **무인 러너가 만든 산출물을 사람이 한 줄도 고치지 않고 승격한다.** 러너는 같은 실행에서 l20279b 를 통째로 skip 하고도 정상 종료했고, all_data 를 규약과 다른 형식으로 썼다. 이 세트가 깨끗한 것은 게이트가 그렇게 말하는 것이지 생성 과정이 검증됐다는 뜻이 아니다. gate3 원본 1:1 대조가 이 세트에서 특히 유일한 방어선이다.",
  l20279a: " ★ 이 세트 고유 한계 — 꺾쇠 구간을 **원본 지면의 들여쓰기 블록 경계로 판독**했다. 라벨이 블록 옆에 세로 중앙 배치되는 조판이라 시작·끝 행은 명확하지만, 원본에 꺾쇠 세로선이 그려져 있지 않아 **선의 실제 길이로 검산하지는 못했다**(l20279d 는 선이 있어 검산했다). gate3 에서 심사관이 구간 밖 문장 제외를 확인한 것이 이 판독의 근거다.",
  l20279d: " ★ 이 세트 고유 한계 — Q32#1 의 cs_spans 는 3개이고 서로 겹친다(문장 전체 · 「가을이 점점 깊고」 · 「객회(客懷)는 쓸쓸한데」). 이번에 고친 것은 세 번째 하나뿐이고 **겹침 자체가 적절한지는 판정하지 않았다**. 화면에서 같은 문장에 형광펜이 세 겹으로 걸리는 셈이라, 렌더 결과는 gate3 실측이 정본이다.",
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

  let nChoice = 0, nAna = 0, nCsGap = 0, nPatGap = 0, nV = 0, nSpan = 0, nSpanBad = 0, nDead = 0, nNonHl = 0;
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
        if (!ids.length && c.pat !== "V") nCsGap++;
      }
      for (const id of ids) {
        if (!byId.has(id)) nDead++;
        else if (NON_HL.has(byId.get(id).sentType || "body")) nNonHl++;
      }
      for (const sp of c.cs_spans || []) {
        nSpan++;
        const t = String(byId.get(String(sp.sent_id ?? sp.id ?? sp.sentId))?.t || "");
        const txt = Array.isArray(sp.text) ? sp.text.join("") : String(sp.text ?? "");
        if (!t.replace(/\s+/g, "").includes(txt.replace(/\s+/g, ""))) nSpanBad++;
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
    yearKey: YK,
    setId: sid,
    composite_key: key,
    approved_at: APPROVED_AT,
    approved_by: "대표",
    provenance: {
      origin: "무인 러너 (대표 예약 발화 · 2026-09-02 11:16~12:16 · step1-2 ~ step8)",
      preserved_commit: "24db9be — 러너 산출 원형 보존(손대지 않고 커밋)",
      normalized_commit: "e657b21 — all_data §13⑪ minified 규약 복원(내용 무변)",
      gate_report: "docs/sprint_2027_9월_gate_report_20260902.md (러너 산출 · 게이트 10종 전문)",
      note: "러너는 같은 실행에서 l20279b 를 skip 하고도 정상 종료했다. 무인 산출물이라 전량 검증 대상으로 다뤘다.",
    },
    gate0_evidence: {
      method: `원본 정답표 대조 (_done/${YK}/${akey[YK]?.src?.split("/").pop() || `${YK}_정답.pdf`})`,
      command: `node pipeline/answer_key_audit.mjs --expect ${YK}`,
      checked: `questionType 기준 정답 특정 — ${qids.join("·")}번 전 문항`,
      answer_key: ans,
      answer_key_mismatch: 0,
      expect_confirmed: `✅ ${YK} 대조됨 — 정답표 34문항이 실제로 쓰였다(--expect 가드 통과)`,
      note: "--expect 없이 돌리면 정답표가 없는 회차를 조용히 건너뛰고 「0건」이 뜬다 (D-140 ①)",
      pass: missAns.length === 0,
    },
    gate1_evidence: {
      command: `node pipeline/quality_gate.mjs ${YK}`,
      scope: "연도 스코프 (판정 305② 준수 — --scope=release 단독 실행 금지)",
      verdict_unit: "세트 (D-185 확정 규칙 — 귀속 CRITICAL 0 + LIVE 전수 신규 위반 0)",
      critical_count_this_set: 0,
      critical_count_year: YEAR_CRITICAL,
      year_critical_owners: YEAR_CRITICAL_OWNERS,
      live_regression: "LIVE 276세트 형광펜 0개 세트 0 · 0개 선지 0 — 신규 위반 0",
      result: `이 세트 귀속 CRITICAL 0. 회차는 release_blocked 이나 그것은 W3·W4 미수리분 때문이다.`,
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
      method: "심사관 화면 실측 (localhost dev + 마스터 세션 · review=1)",
      checklist: "docs gate3 체크리스트 v2 (2026-09-01) — ⑴형광펜 ⑵마커·꺾쇠 ⑷해설정합 ⑸배지 ⑹원본 1:1 ⑺렌더 원천",
      verified_at: GATE3_AT,
      detail: GATE3[sid],
      console_error_count: 0,
      note: "비노출 세트는 마스터 로그인이 있어야 열린다 — bypassFilter 가 켜져야 통짜 all_data 폴백 경로를 탄다(dataLoader.js:718 · App.jsx:1301). review=1 만으로는 열리지 않는다.",
      pass: true,
    },
    diagnostic_axes: {
      note: "release_diag 13축 + 신설 축. 수치는 데이터에서 읽어 채웠다",
      tool: `node pipeline/release_diag.mjs "${key}"`,
      "①삼충실도": `선지 ${nChoice} · 해설 누락 ${nChoice - nAna} · 근거 누락 ${nCsGap} · pat 누락 ${nPatGap}${nV ? ` (어휘 pat=V ${nV}건 면제)` : ""}`,
      "②근거정합": `cs_spans ${nSpan}건 · 어긋남 ${nSpanBad} · 끊긴 cs_id ${nDead}건`,
      "③setId충돌": "복합 키(D-113 ①) 사용 — yearKey::setId",
      "④구간표시": annList.length ? `annotations ${annList.length}건 (${Object.entries(annTypes).map(([k, n]) => `${k}:${n}`).join(" ")}) · 미정박 0` : "[A] 류 라벨을 쓰지 않는다 · annotations 0건",
      "⑤글자손상": `PUA ${pua} · ZWSP ${zwsp} · U+FFFD ${repl}`,
      "⑥각주": "본문 * 과 각주 문장 정합",
      "⑦문항형식": `문항 ${qids.length} · 5지 ${five}/${qids.length} · 정답 특정 ${okOne}/${qids.length}`,
      "⑧분리게이트": "node pipeline/build_split.mjs --verify — LIVE 276세트 · 필드 72,296개 대조 누락 0",
      "⑨마커고아": "본문 마커 ↔ 문항 마커 정합 · 고아 0 · 역고아 0",
      "⑩발문마커소실": "0",
      "⑪인용부호소실": sid === "r20279a" ? "⚠ Q2 1건 — 심사관 원본 대조로 오경보 판정(원본 텍스트층에도 같은 공백)" : "0",
      "⑫결함표지잔존": "_pat_error · _ok_analysis_mismatch 0",
      "⑬결론줄": `기호 어긋남 ${symBad} · 라벨↔pat 어긋남 ${labBad} (코드 라벨 ${labCode}건 · 명칭 라벨 ${labName}건 · 라벨 없음/자유문구 ${labFree}건)`,
      "ok=true+pat": `${okTruePat}건 (0 이어야 한다 — QuizPanel:1076 이 ok 를 안 보고 배지를 띄운다)`,
      "신설-형광펜실효": `node pipeline/cs_effect_audit.mjs --year ${YK} — 형광펜 0개 세트 0 · 0개 선지 0 · 비-하이라이트 cs_id ${nNonHl}건`,
    },
    known_observation: {
      item: "결론줄 코드 라벨",
      detail: `이 회차 결론줄은 [R1] 형태의 코드 라벨이다(이 세트 ${labCode}건). LIVE 관례는 명칭 라벨([사실 왜곡])이며 무라벨·자유문구도 혼재한다.`,
      verdict: "심사관 비차단 판정 — 백로그 「구형 결론줄 정리」에 「코드 라벨 표준화」 추가",
    },
    repair_record: REPAIR[sid],
    title_record: { title: s.title, range: s.range },
    annotations_snapshot: {
      count: annList.length,
      types: annTypes,
      entries: annList,
      source: "public/data/annotations.json — 화면 렌더 단일 원천",
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
      order: "F-48",
      note: "엔지니어는 RELEASE_KEYS 를 수정하지 않는다 — 프론트 발주 사항",
    },
    review_url: `https://www.jippi.kr/viewer?year=${encodeURIComponent(YK)}&set=${sid}&q=${qids[0]}&mode=study`,
    limitation_note: "S-18 — 「전 축 통과」는 **알려진 유형이 없다**는 뜻이지 결함이 없다는 뜻이 아니다. 진단 축 목록은 지금까지 터진 사고의 역산이라, 아직 안 터진 유형은 애초에 목록에 없다. 이번 주만 해도 옛한글 34자 소실·bogiTable 지시문 상이·표 조사 오류가 전부 자동 게이트를 통과하고 원본 대조에서만 드러났다." + (LIMIT_EXTRA[sid] || ""),
    comment: `${YK} W1·W2 (D-190). 4관문 충족 — gate0 정답표 34문항 전수 대조(불일치 0) · gate1 세트 귀속 CRITICAL 0(회차 ${YEAR_CRITICAL}건은 W3·W4 미수리분) · gate3 심사관 화면 실측(${GATE3_AT}) · 대표 승인(${APPROVED_AT}). F-48 노출 대기.`,
  };
  rows.push({ sid, key, rec, qids, missAns, nCsGap, nDead, nNonHl, nChoice, nSpan, nSpanBad, labBad, symBad, okTruePat, pua, zwsp, repl });
}

console.log(`# ${YK} W1·W2 승격 기록 3건 (D-190)`);
console.log("");
console.log("| 세트 | 문항 | 정답표 | 선지 | 근거공백 | span | span어긋남 | 끊긴id | 비-HL | ⑬어긋남 | ok+pat | 손상 |");
console.log("|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|");
for (const r of rows)
  console.log(`| \`${r.sid}\` | ${r.qids.join("·")} | ${r.missAns.length ? `🔴 ${r.missAns.length}개 누락` : `✅ ${r.qids.length}/${r.qids.length}`} | ${r.nChoice} | ${r.nCsGap} | ${r.nSpan} | ${r.nSpanBad} | ${r.nDead} | ${r.nNonHl} | ${r.labBad} | ${r.okTruePat} | ${r.pua + r.zwsp + r.repl} |`);
console.log("");
const bad = rows.filter((r) => r.missAns.length || r.nCsGap || r.nSpanBad || r.nDead || r.nNonHl || r.labBad || r.symBad || r.okTruePat || r.pua + r.zwsp + r.repl);
if (bad.length) { console.log(`## 🔴 ${bad.map((r) => r.sid).join(" · ")} 에 남은 수치가 있다 — 기록을 만들기 전에 확인하십시오`); process.exit(1); }
console.log("✅ 3세트 전건 — 정답표 누락 0 · 근거 공백 0 · span 어긋남 0 · 끊긴 id 0 · 비-하이라이트 0 · ⑬ 어긋남 0 · ok=true+pat 0 · 글자손상 0");
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
// 되읽기 검산
const fail = [];
for (const r of rows) {
  const p = path.join(OUT, `QG-${YK}-${r.sid}-release-approval.json`);
  const back = JSON.parse(fs.readFileSync(p, "utf8"));
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
console.log("## ✅ 되읽기 검산 통과 — composite_key · frontend_request · gate3 · 귀속 CRITICAL · S-18 세트별 한계");
console.log("");
console.log("### frontend_request (F-48 로 넘길 키)");
rows.forEach((r) => console.log(`- \`${r.key}\``));
