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
  if ((c.cs_ids || []).length || (c.cs_spans || []).length) {
    console.log(`  ⚠ ${S.setId} Q${S.qId}#${S.num} — 이미 근거가 있다, 건너뜀`); continue;
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

  console.log(`  ${S.yk} ${S.setId} Q${S.qId}#${S.num}`);
  console.log(`     선지: ${String(c.t).slice(0, 60)}`);
  console.log(`     cs_ids  → [${S.csIds.join(", ")}]`);
  for (const id of S.csIds) console.log(`        ${id}: ${byId.get(id).slice(0, 52)}`);
  for (const sp of S.csSpans) console.log(`     cs_span → ${sp.sent_id} occ${sp.occurrence} ${JSON.stringify(sp.text.slice(0, 46))}`);
  console.log(`     근거: ${S.why}`);
  if (APPLY) { c.cs_ids = [...S.csIds]; c.cs_spans = S.csSpans.map((x) => ({ ...x })); }
  n++;
}

if (bad) { console.log(`\n🔴 검증 실패가 있다 — 아무것도 쓰지 않았다`); process.exit(1); }
if (APPLY && n) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · ${n}건`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
