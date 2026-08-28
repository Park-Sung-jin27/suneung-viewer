// evidence_assign.mjs — 선지에 근거(cs_ids · cs_spans)를 부여한다 (발주 D-115-3 ①)
//
// **일괄 금지.** 심사관이 판정한 건만 SPEC 에 넣는다.
// 근거 부여는 판단이 들어가는 작업이라, 어떤 문장을 왜 골랐는지 근거를 함께 적는다.
//
// 안전장치 (하나라도 어긋나면 아무것도 쓰지 않는다):
//   · cs_ids 로 준 문장이 그 세트에 실재해야 한다
//   · cs_spans 의 text 가 그 문장 안에 **글자 그대로** 있어야 한다
//   · 이미 근거가 있는 선지는 덮어쓰지 않는다(건너뛴다)
//
// 사용: node pipeline/evidence_assign.mjs [--only <setId>] [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

const SPEC = [
  {
    yk: "2026_6월", setId: "r20266b", qId: 4, num: 3,
    // C안 — 심사관 승인 (D-115-3 ①)
    csIds: ["r20266bs3", "r20266bs5", "r20266bs16", "r20266bs8"],
    csSpans: [
      { sent_id: "r20266bs8", text: "가령 '대기환경보전법은 오염 물질의 배출을 규제하는 대기 환경 관리 체계의 기능을 강화함으로써", occurrence: 1 },
    ],
    why: "선지는 「(가)는 여러 학자의 이론을 다양한 사례를 들어 설명」이라 하는데 둘 다 사실이 아니다. "
       + "s3·s5·s16 은 세 법 모델이 학자 개인의 이론이 아니라 **역사적 전개**(자유주의적 → 사회복지국가적 → 절차주의적)로 "
       + "제시됨을 보이는 세 문장이고 — 같은 문항 #5 가 쓰는 조합과 같다. "
       + "s8 은 지문에 실제로 등장하는 유일한 사례(대기환경보전법)로, 「다양한 사례」 반박의 실물 근거다.",
  },

  // ── D-131 ② 배치 A 근거 5건 — 심사관 승인 (D-130 ② 상신안 그대로) ──
  //   전부 pat R3 또는 무값이라 어휘 면제(D-125 ⓪) 대상이 아니다.
  //   다섯 건 모두 해설이 이미 근거를 글로 밝혀 두었고 대응 문장이 본문에 있다.
  {
    yk: "2021_6월", setId: "r20216a", qId: 16, num: 2,
    csIds: ["r20216as6", "r20216as22"], csSpans: [],
    why: "해설이 「📌 지문 근거: (가)와 (나) 전체 내용」이라 문장 지정이 없었다. 해설 본문은 「(가)는 과거제의 특징과 영향을, (나)는 부작용과 개혁론을 다룬다」고 한다 — 그 둘을 한 문장씩 잡으면 「두 가지 이론의 구분」이 아님이 드러난다. s6 (가) 제도의 영향 · s22 (나) 부작용. 형제 #1 이 (가) 대표로 s6 을, #4 가 (나) 대표로 s22 를 쓴다",
  },

  {
    yk: "2021_6월", setId: "r20216a", qId: 16, num: 5,
    csIds: ["r20216as15", "r20216as16", "r20216as22"], csSpans: [],
    why: "선지가 「(가)는 통시적, (나)는 학자들의 상반된 입장을 공시적으로」라 하는데 (나) 쪽이 틀렸다. s15·s16 은 (가)의 통시적 전개(형제 #1·#3 이 함께 쓰는 문장)이고, s22 는 (나)가 상반된 입장이 아니라 일관된 비판임을 보이는 자리다",
  },

  {
    yk: "2021_6월", setId: "r20216d", qId: 31, num: 1,
    csIds: ["r20216ds11", "r20216ds12"], csSpans: [],
    why: "선지가 「수입이 법인세율 높은 국가일수록 많다」고 하는데 <보기> 가설은 이윤의 **비율**에 관한 것이다. s11 은 법인세율이 높은 B국 자회사에서 특허 사용 수입이 발생하는 구조, s12 는 「Z사는 ⓐB국의 자회사에 법인세가 부과될 이윤을 최소화한다」다. 정답 #4 와 같은 조합이며, 가설이 다루는 것이 수입 총량이 아님을 보인다",
  },

  {
    yk: "2021_6월", setId: "r20216d", qId: 31, num: 3,
    csIds: ["r20216ds11", "r20216ds12"], csSpans: [],
    why: "선지가 「제반 비용의 비율이 법인세율이 낮은 국가일수록 높다」고 해 방향을 뒤집었다. 지문이 말하는 것은 법인세율이 **높은** 국가에서 이윤을 최소화하는 구조(s11·s12)다. 같은 두 문장이 그 방향을 직접 보여 준다",
  },

  {
    yk: "2021_9월", setId: "l20219d", qId: 32, num: 5,
    pat: "L4",
    csIds: ["l20219ds31", "l20219ds32"], csSpans: [],
    why: "선지가 「'심봉사'의 발언이 끝나기 전에 자신이 딸임을 밝힘」이라 하는데 본문이 정면으로 반박한다. s31 「황후 들으시고 … 그 말씀을 자세히 들으심에 정녕 부친인 줄은 아시되」, s32 「그 말씀을 마치자 황후 버선발로 뛰어 내려와서」 — 「그 말씀을 마치자」는 발언이 끝난 뒤다. pat 도 비어 있어 함께 붙인다. 사건의 선후를 뒤집은 것이므로 L4(구조·맥락 오류)이고, 형제 #1 도 L4 다",
  },

  // ── D-127 ② l20236b Q22#4 근거 부여 — A안 승인 ────────────────────
  //   웨이브 2 에서 유일하게 남은 근거 누락 1건. pat 이 L3 이라 어휘 면제(D-125 ⓪) 대상이 아니다.
  //   기존 근거가 아예 없으므로 replace 가 아니라 일반 부여다.
  {
    yk: "2023_6월", setId: "l20236b", qId: 22, num: 4,
    csIds: ["l20236bs2", "l20236bs13", "l20236bs20"], csSpans: [],
    why: "해설이 이미 근거를 밝혀 놓았다 — (가) 강호·산전·뫼·들, (나) 천문구중·동방, (다) 그 집·아파트. 그중 각 작품에서 처음 드는 낱말이 놓인 문장을 하나씩 잡았다: s2 (가) 「강호에 봄이 드니」 · s13 (나) 「㉠천문구중(天門九重)에 갈 길이 아득하니」 · s20 (다) 「그 집은 그 집 아이들에게 작은 우주였다」. 형제 오답 #2 [s2, s15, s20] · #3 [s2, s13, s20] 과 같은 (가)1·(나)1·(다)1 구조다 — A안 승인(D-127 ②)",
  },

  // ── D-123 ② l20266b Q23 cs_ids 재부여 — 심사관 승인 ────────────────
  //   본문 수리로 ⓐ 가 s29 로 돌아갔는데 근거는 s48(옛 ⓐ 자리)을 가리키고 있었다.
  //   해설 재작성과 같은 커밋에서 맞춘다. 기존 값은 실행 로그에 남긴다.
  {
    yk: "2026_6월", setId: "l20266b", qId: 23, num: 1, replace: true,
    csIds: ["l20266bs29", "l20266bs30", "l20266bs31"], csSpans: [],
    why: "ⓐ 본문(s29)과 그 뒤 날씨 조건 두 행(s30·s31). 선지의 「날씨의 영향을 받지 않고」를 정면으로 반박하는 자리다. 기존 [s48] 은 옛 ⓐ 자리였다",
  },

  {
    yk: "2026_6월", setId: "l20266b", qId: 23, num: 4, replace: true,
    csIds: ["l20266bs28", "l20266bs29", "l20266bs34", "l20266bs55"],
    // 기존 span 중 ⓑ 본문(s55)은 새 해설도 그대로 인용한다 — 살린다.
    // s48 span 은 옛 ⓐ 자리라 버린다.
    csSpans: [
      { sent_id: "l20266bs55", text: "거리에서 ⓑ바다로 나가는 길이 좋다.", occurrence: 1 },
    ],
    why: "만류의 주체(s28)와 ⓐ 본문(s29), 일행이 이미 함께 있음을 보이는 s34, 그리고 ⓑ 본문(s55). 기존 [s48, s55] 중 s48 이 옛 ⓐ 자리였다",
  },

  {
    yk: "2026_6월", setId: "l20266b", qId: 23, num: 5, replace: true,
    csIds: ["l20266bs29", "l20266bs32", "l20266bs55", "l20266bs57"],
    // 기존 span 중 「정하고 고운」(s57)은 새 해설의 핵심 논거라 살린다. s48 span 은 버린다.
    csSpans: [
      { sent_id: "l20266bs57", text: "정하고 고운 길", occurrence: 1 },
    ],
    why: "ⓐ 의 「칠십 리 왕복」(s29)과 「미끄러운 돌사다리 천신만고」(s32) — 걷기에 편하지 않음의 근거. ⓑ 본문(s55)과 「정하고 고운」이 나오는 s57. 기존 [s48, s57, s58] 중 s48 이 옛 ⓐ 자리였다",
  },

  // ── D-118-2 ① 배치 2 r20249d — 심사관 승인 ────────────────────────
  //   각 해설의 📌 지문 근거 인용을 문장에 되맞춰 고른 것이다.
  {
    yk: "2024_9월", setId: "r20249d", qId: 12, num: 4, csIds: ["r20249ds18", "r20249ds19"], csSpans: [],
    why: "해설 인용 「양반들이 비양반층의 진입을 막는 힘은…유학의 증가는 이러한 현상의 단면을 보여 준다」가 "
       + "s18 + s19 원문과 글자 그대로 대응한다. **정답 선지**다.",
  },
  {
    yk: "2024_9월", setId: "r20249d", qId: 16, num: 5, csIds: ["r20249ds36"], csSpans: [],
    why: "해설 인용 「두 사람은 지배층과 피지배층 간의 차등을 엄격하게 유지하고자 했다」가 s36 원문과 대응한다. **정답 선지**다.",
  },
  {
    yk: "2024_9월", setId: "r20249d", qId: 15, num: 2, csIds: ["r20249ds24", "r20249ds25", "r20249ds26"], csSpans: [],
    why: "유형원 판단 근거 — 노비제 폐지 주장(s24) · 사농공상 사민 편성(s25) · 도덕적 능력자 추천 선발(s26). "
       + "같은 문항 #1 이 쓰는 [s25, s26, s34] 조합과 결이 같다.",
  },
  {
    yk: "2024_9월", setId: "r20249d", qId: 15, num: 3, csIds: ["r20249ds24", "r20249ds26"], csSpans: [],
    why: "해설이 「현명한 인재라도 노비로 태어나면…천하의 도리에 어긋난다」(s24)와 추천 선발(s26) 둘을 든다.",
  },
  {
    yk: "2024_9월", setId: "r20249d", qId: 15, num: 4, csIds: ["r20249ds31", "r20249ds32"], csSpans: [],
    why: "정약용 판단 근거 — 농민·상공인에도 선사 배정(s31)과 노비제는 사를 뒷받침하기 위해 유지되어야 한다는 주장(s32).",
  },
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
let n = 0, bad = false;
console.log(`## 근거 부여 ${APPLY ? "적용" : "DRY-RUN"} — ${SPEC.length}건\n`);

for (const S of SPEC) {
  if (ONLY && S.setId !== ONLY) continue;
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[S.yk]?.[sec] || []).find((x) => (x.setId || x.id) === S.setId);
    if (f) { set = f; break; }
  }
  if (!set) { console.log(`  🔴 ${S.yk} ${S.setId} — 세트 없음`); bad = true; continue; }
  const q = (set.questions || []).find((x) => String(x.id) === String(S.qId));
  const c = q && (q.choices || []).find((x) => String(x.num) === String(S.num));
  if (!c) { console.log(`  🔴 ${S.setId} Q${S.qId}#${S.num} — 선지 없음`); bad = true; continue; }
  const had = (c.cs_ids || []).length || (c.cs_spans || []).length;
  if (had && !S.replace) {
    console.log(`  ⚠ ${S.setId} Q${S.qId}#${S.num} — 이미 근거가 있다, 건너뜀`); continue;
  }
  if (S.replace) {
    // 재부여 모드 (D-123 ② 승인). 안전장치 셋:
    //   ① 선지별 SPEC — 세트 단위 일괄이 아니라 한 선지씩 적는다
    //   ② 기존 값을 지우기 전에 전부 찍는다 — 무엇을 버렸는지 기록에 남는다
    //   ③ 쓴 뒤 되읽어 검산한다
    if (!had) { console.log(`  🔴 ${S.setId} Q${S.qId}#${S.num} — replace 인데 기존 근거가 없다. 대상이 아니다`); bad = true; continue; }
    const sameIds = JSON.stringify(c.cs_ids || []) === JSON.stringify(S.csIds);
    if (sameIds && !(c.cs_spans || []).length && !S.csSpans.length) {
      console.log(`  ⚠ ${S.setId} Q${S.qId}#${S.num} — 이미 새 근거다, 건너뜀`); continue;
    }
    console.log(`  ${S.setId} Q${S.qId}#${S.num} 기존 근거를 버린다:`);
    console.log(`     cs_ids  기존 [${(c.cs_ids || []).join(", ")}]`);
    for (const sp of c.cs_spans || [])
      console.log(`     cs_span 기존 ${sp.sent_id} occ${sp.occurrence} ${JSON.stringify(String(sp.text).slice(0, 46))}`);
  }

  const byId = new Map((set.sents || []).map((x) => [String(x.id), String(x.t ?? "")]));
  for (const id of S.csIds)
    if (!byId.has(id)) { console.log(`  🔴 ${id} — 그 세트에 없는 문장`); bad = true; }
  for (const sp of S.csSpans) {
    const t = byId.get(String(sp.sent_id));
    if (t == null) { console.log(`  🔴 span sent_id ${sp.sent_id} — 없는 문장`); bad = true; continue; }
    if (!t.includes(sp.text)) { console.log(`  🔴 span text 가 ${sp.sent_id} 안에 없다: ${JSON.stringify(sp.text.slice(0, 40))}`); bad = true; }
  }
  if (bad) continue;

  // pat 부여 (D-131 ④ 승인). replace 와 같은 3중 안전장치를 건다:
  //   ① 선지별 SPEC — 세트 단위 일괄이 아니라 한 선지씩 적는다
  //   ② 기존 값을 로그에 남긴다 ③ 쓴 뒤 되읽어 검산한다
  //   pat 은 ok:false 선지에만 붙는다. 이미 값이 있으면 덮어쓰지 않는다.
  if (S.pat) {
    const cur = String(c.pat ?? "").trim();
    if (c.ok !== false) {
      console.log(`  🔴 ${S.setId} Q${S.qId}#${S.num} — ok 가 false 가 아니다(${c.ok}). pat 을 붙이면 안 된다`);
      bad = true; continue;
    }
    if (cur && cur !== S.pat) {
      console.log(`  🔴 ${S.setId} Q${S.qId}#${S.num} — pat 이 이미 ${JSON.stringify(cur)} 다. 덮어쓰지 않는다`);
      bad = true; continue;
    }
    console.log(`     pat 기존 ${JSON.stringify(cur) || "(빈 값)"} → ${JSON.stringify(S.pat)}`);
  }

  console.log(`  ${S.yk} ${S.setId} Q${S.qId}#${S.num}`);
  console.log(`     선지: ${String(c.t).slice(0, 60)}`);
  console.log(`     cs_ids  → [${S.csIds.join(", ")}]`);
  for (const id of S.csIds) console.log(`        ${id}: ${byId.get(id).slice(0, 52)}`);
  for (const sp of S.csSpans) console.log(`     cs_span → ${sp.sent_id} occ${sp.occurrence} ${JSON.stringify(sp.text.slice(0, 46))}`);
  console.log(`     근거: ${S.why}`);
  if (APPLY) {
    c.cs_ids = [...S.csIds];
    c.cs_spans = S.csSpans.map((x) => ({ ...x }));
    if (S.pat) c.pat = S.pat;
  }
  n++;
}

if (bad) { console.log(`\n🔴 검증 실패가 있다 — 아무것도 쓰지 않았다`); process.exit(1); }
if (APPLY && n) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · ${n}건`);
  // 되읽어 확인한다 — 채택 규칙 ②
  const back = JSON.parse(fs.readFileSync(DATA, "utf8"));
  let miss = 0;
  for (const S of SPEC) {
    if (ONLY && S.setId !== ONLY) continue;
    let set = null;
    for (const sec of ["reading", "literature"]) {
      const f = (back[S.yk]?.[sec] || []).find((x) => (x.setId || x.id) === S.setId);
      if (f) { set = f; break; }
    }
    const q = (set?.questions || []).find((x) => String(x.id) === String(S.qId));
    const ch = q && (q.choices || []).find((x) => String(x.num) === String(S.num));
    if (!ch) continue;
    if (S.pat && String(ch.pat ?? "").trim() !== S.pat) {
      console.log(`  🔴 되읽기 실패: ${S.setId} Q${S.qId}#${S.num} pat`); miss++;
    }
    if (JSON.stringify(ch.cs_ids || []) !== JSON.stringify(S.csIds)) {
      console.log(`  🔴 되읽기 실패: ${S.setId} Q${S.qId}#${S.num} cs_ids`); miss++;
    }
    const byId = new Map((set.sents || []).map((x) => [String(x.id), String(x.t ?? "")]));
    for (const sp of ch.cs_spans || [])
      if (!(byId.get(String(sp.sent_id)) || "").includes(String(sp.text))) {
        console.log(`  🔴 되읽기 실패: ${S.setId} Q${S.qId}#${S.num} cs_span 이 문장에서 안 잡힌다`); miss++;
      }
  }
  if (miss) { console.log(`
🔴 되읽기에서 ${miss}건이 어긋났다`); process.exit(1); }
  console.log(`  되읽기 검산 통과`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
