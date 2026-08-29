// r2019b_analysis_rewrite.mjs — r2019b 해설 재작성 19건 적용 (발주 D-151 ②)
//
// 왜 고치나
//   D-149 로 (나) 「오발탄」 본문이 들어왔는데 해설 19건이 아직
//   「(나) 본문 미제시」·「(나) 제시되지 않음」이라 적혀 있다. 지금은 **거짓 진술**이다.
//   특히 Q26#5(정답)는 오답 근거를 「본문이 없어서」로 삼고 있어, 학생이 틀린 이유를 배운다.
//
// 무엇을 하나
//   ⓐ Q25·Q26 10건 — 해설 전문 교체 + cs_ids 재부여 (D-150 ② 상신안 그대로)
//   ⓑ Q21·Q24  9건 — 📌 줄의 「(나) 제시되지 않음」만 실제 (나) 근거로 교체 (§13⑭ 반쪽 수리 금지)
//   ⓒ Q25#5 pat L3 → L2 (심사관 승인)
//
// 안전장치 (S-05 3중 · 하나라도 어긋나면 아무것도 쓰지 않는다)
//   · cs_ids 로 준 문장이 그 세트에 실재해야 한다
//   · 비-하이라이트 sentType(각주·작가·표지·중략)을 cs_ids 에 넣지 않는다
//   · 기존 값을 로그로 남기고, 쓴 뒤 되읽어 검산한다(S-02)
//
// 사용:
//   node pipeline/r2019b_analysis_rewrite.mjs           미리보기
//   node pipeline/r2019b_analysis_rewrite.mjs --apply

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const NL = String.fromCharCode(10);
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2019수능", SID = "r2019b";
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);

// ── ⓐ Q25·Q26 전문 교체 (D-150 ② 상신안) ─────────────────
const A = (ev, why, verdict) => `📌 지문 근거: ${ev}${NL}🔍 ${why}${NL}${verdict}`;
const B = (bogi, ev, why, verdict) => `📌 보기 근거: ${bogi}${NL}📌 지문 근거: ${ev}${NL}🔍 ${why}${NL}${verdict}`;

const FULL = [
  { q: 25, n: 1, cs: ["r2019bs15", "r2019bs16", "r2019bs17", "r2019bs19"],
    a: A(`"#68. 산비탈 길 / 뚜벅뚜벅 걷고 있는 철호." · "#69. 피난민 수용소 안(회상)" · "철호Ⓔ * : 저걸 저토록 고생시킬 줄이야."`,
      `#68에서 걷고 있던 철호가 #69의 '회상' 장면으로 이어지고, 그 장면에 '철호Ⓔ'(효과음)로 철호의 목소리가 얹힌다. 화면에는 아내가 나오는데 목소리는 철호의 것이므로, 이 회상을 하고 있는 사람이 철호임이 드러난다`,
      `✅ 지문과 일치하는 적절한 진술`) },
  { q: 25, n: 2, cs: ["r2019bs18", "r2019bs19"],
    a: A(`"담요바지 철호의 아내가 주워 모은 널빤지 조각을 이고 들어와 부엌에 내려놓고 흩어진 머리칼을 치키며 숨을 돌리고 있다." · "철호Ⓔ * : 저걸 저토록 고생시킬 줄이야."`,
      `고생하는 아내의 모습 위에 '저걸 저토록 고생시킬 줄이야'라는 철호의 목소리가 겹친다. 자책과 안타까움이 담긴 말이므로 아내에 대한 연민이 드러난다`,
      `✅ 지문과 일치하는 적절한 진술`) },
  { q: 25, n: 3, cs: ["r2019bs19"],
    a: A(`"여학교 교복을 입고 강당에 서서 노래를 부르고 있는 그 시절의 아내. 또 O･L되며 신부 차림의 아내가 노래를 부르고 있다. 그 옆에 상기되어 앉아 있는 결혼 피로연 석상의 철호. 노래는 '돌아오라 소렌토'."`,
      `학창 시절 아내가 노래를 부르는 화면에서 신부 차림으로 노래를 부르는 화면으로 O･L(겹침)되며 넘어간다. 두 화면을 잇는 고리가 같은 '노래'다`,
      `✅ 지문과 일치하는 적절한 진술`) },
  { q: 25, n: 4, cs: ["r2019bs20", "r2019bs21"],
    a: A(`"#70. 산비탈" · "철호가 멍하니 시가지를 내려다보고 섰다. 황홀에 묻힌 거리."`,
      `철호는 말없이 '멍하니' 서 있는데 그가 내려다보는 거리는 '황홀에 묻힌' 상태다. 가라앉은 인물과 화려한 배경이 맞붙어, 그 거리에 섞이지 못하는 철호의 심정이 암시된다`,
      `✅ 지문과 일치하는 적절한 진술`) },
  { q: 25, n: 5, cs: ["r2019bs21", "r2019bs25"], pat: "L2",
    a: A(`"철호가 멍하니 시가지를 내려다보고 섰다. 황홀에 묻힌 거리." · "영호 : 그럼 내립시다. 시시한 동네까지 몰구 오느라고 수고했소. 천 환짜리 한 장을 꺼내 준다."`,
      `#70의 침묵은 영호가 아니라 철호의 것이다. #71에서 영호가 하는 말과 행동은 운전수에게 큰돈을 선뜻 건네고 자기 동네를 '시시한 동네'라 부르는 것으로, 소심함이 아니라 오히려 호기와 허세에 가깝다. 대비되는 두 장면 어디에서도 영호의 소심함은 드러나지 않는다`,
      `❌ 지문과 어긋나는 부적절한 진술 [정서·태도 오독]`) },

  { q: 26, n: 1, cs: ["r2019bs7", "r2019bs22", "r2019bs25", "r2019bs27", "r2019bs29"],
    a: B(`"결합이란 이렇게 선택된 시간과 공간을 다양한 방식으로 연결하여 새롭게 사건을 구성하는 것"`,
      `㉠은 이별 장면의 여러 상황 중 일부만 서술 / "#71. 자동차 안" · "영호 : 그럼 내립시다." · "#72. 철호의 방 안" · "영호 : (들어오며) 혜옥아!"`,
      `#71의 자동차 안에서 내린 영호가 #72의 철호의 방 안으로 들어온다. 서로 다른 두 공간이 '영호'라는 같은 인물의 등장으로 이어지며 공간 이동이 드러난다`,
      `✅ 보기 조건과 지문이 일치하는 적절한 진술`) },
  { q: 26, n: 2, cs: ["r2019bs9", "r2019bs31", "r2019bs36", "r2019bs37", "r2019bs38"],
    a: B(`"선택된 시간과 공간을 다양한 방식으로 연결하여 새롭게 사건을 구성"`,
      `㉡ "한편 개천 하나를 건너 신전 집에서는, 바로 이날에" / "#73. 철호의 집 부엌 안" · "철호Ⓔ : 어디 취직을 해야지." · "#74. 철호의 집 방 안" · "영호 : 취직이요."`,
      `#73 부엌에서 철호가 '취직을 해야지'라고 하자 #74 방 안에서 영호가 '취직이요'로 곧장 받는다. 장면은 바뀌었는데 대화는 끊기지 않아, 두 공간이 같은 대화로 묶인다`,
      `✅ 보기 조건과 지문이 일치하는 적절한 진술`) },
  { q: 26, n: 3, cs: ["r2019bs9", "r2019bs11", "r2019bs31", "r2019bs37", "r2019bs51", "r2019bs52"],
    a: B(`"결합이란 … 연결하여 새롭게 사건을 구성하는 것"`,
      `㉡의 선택적 서술 / "#73. 철호의 집 부엌 안" · "#74. 철호의 집 방 안" · "#75. 철호의 집 골목" · "스카프를 두르고 핸드백을 걸친 명숙이가 엿듣고 있다."`,
      `#73(부엌)·#74(방)·#75(골목)는 서로 다른 공간인데 하나의 대화가 관통한다. #75의 명숙은 골목에서 '엿듣고' 있어, 방 안(#74)에서 오가는 말을 함께 겪게 된다`,
      `✅ 보기 조건과 지문이 일치하는 적절한 진술`) },
  { q: 26, n: 4, cs: ["r2019bs9", "r2019bs53", "r2019bs54"],
    a: B(`"선택된 시간과 공간을 다양한 방식으로 연결"`,
      `㉠과 ㉡의 연결(서술자의 서술) / "철호Ⓔ : 그게 바루 억설이란 말이다." · "영호Ⓔ : 비틀렸죠. 분명히 비틀렸어요."`,
      `㉠과 ㉡은 서술자가 '한편', '또 한편'이라 말하며 잇는다. 반면 #74와 #75는 화면 밖에서 들리는 인물의 목소리(Ⓔ)로 이어진다. 같은 '결합'이지만 잇는 수단이 다르다`,
      `✅ 보기 조건과 지문이 일치하는 적절한 진술`) },
  { q: 26, n: 5, cs: ["r2019bs13", "r2019bs51", "r2019bs52", "r2019bs53", "r2019bs54"],
    a: B(`"결합이란 이렇게 선택된 시간과 공간을 다양한 방식으로 연결하여 새롭게 사건을 구성하는 것"`,
      `㉢ "얼마 있다, 원래의 신전은 술집으로 변하고, 또 그들의 살던 집에는 좀 더 있다, 하숙옥 간판이 걸렸다" / "#75. 철호의 집 골목" · "스카프를 두르고 핸드백을 걸친 명숙이가 엿듣고 있다." · "철호Ⓔ : 그게 바루 억설이란 말이다." · "영호Ⓔ : 비틀렸죠."`,
      `㉢이 시간을 나눠 변화를 골라 보여 준다는 앞부분은 맞다. 그러나 뒷부분이 틀렸다. #75는 골목(명숙이 있는 곳)을 비추면서 방 안 철호·영호의 목소리를 Ⓔ로 겹쳐 들려준다. 즉 #75에는 골목과 방이라는 서로 다른 두 공간이 목소리로 결합돼 있다. '결합이 나타나지 않는다'는 단정이 지문과 어긋난다`,
      `❌ 지문과 어긋나는 부적절한 진술 [보기 대입 오류]`) },
];

// ── ⓑ Q21·Q24 — 📌 줄의 「(나) 제시되지 않음」만 실제 근거로 교체 ──
//   해설 본문(🔍)은 (가) 기준으로 이미 맞게 쓰여 있어 건드리지 않는다.
const NA_REF = {
  21: `(나)는 #68~#75 시나리오 전체 — 산비탈·회상·자동차 안·철호의 집`,
  24: `(나) "영호 : 그럼 내립시다. 시시한 동네까지 몰구 오느라고 수고했소." · "철호의 아내가 만삭의 배를 안고 누더기를 꿰매고 있다." · "스카프를 두르고 핸드백을 걸친 명숙이가 엿듣고 있다."`,
};

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트를 못 찾았다."); process.exit(1); }
const byId = new Map((set.sents || []).map((x) => [String(x.id), x]));

console.log("# r2019b 해설 재작성 19건");
console.log("");
console.log(`- 적용 전 all_data: ${(before.length / 1048576).toFixed(2)}MB · MD5 \`${md5(before)}\``);

// ── 안전장치 1·2 — cs_ids 실재 · 하이라이트 가능 ───────────
const bad = [];
for (const f of FULL) {
  for (const id of f.cs) {
    const s = byId.get(id);
    if (!s) bad.push(`Q${f.q}#${f.n}: ${id} 부재`);
    else if (NON_HL.has(s.sentType || "body")) bad.push(`Q${f.q}#${f.n}: ${id} 는 ${s.sentType} — 형광펜 안 켜짐`);
  }
}
if (bad.length) { console.log(NL + "🔴 안전장치 위반 — 아무것도 쓰지 않는다"); bad.forEach((x) => console.log("- " + x)); process.exit(1); }
console.log(`- 안전장치 ✅ cs_ids ${FULL.reduce((a, f) => a + f.cs.length, 0)}개 실재 · 비-하이라이트 0개`);

// ── 대상 수집 + 기존 값 로그 (안전장치 3) ──────────────────
const plan = [];
for (const q of set.questions || [])
  for (const c of q.choices || []) {
    const full = FULL.find((f) => f.q === q.id && f.n === c.num);
    const cur = typeof c.analysis === "string" ? c.analysis : "";
    if (full) { plan.push({ q, c, kind: "전문", was: cur, wasCs: [...(c.cs_ids || [])], wasPat: c.pat, full }); continue; }
    if (!NA_REF[q.id]) continue;
    if (!/\(나\)\s*제시되지 않음/.test(cur)) continue;
    plan.push({ q, c, kind: "📌줄", was: cur, wasCs: [...(c.cs_ids || [])], wasPat: c.pat });
  }

console.log(`- 대상 **${plan.length}건** — 전문 교체 ${plan.filter((p) => p.kind === "전문").length} · 📌줄 교체 ${plan.filter((p) => p.kind === "📌줄").length}`);
console.log("");
console.log("| 위치 | 방식 | 기존 cs_ids | 새 cs_ids | pat |");
console.log("|---|---|---|---|---|");
for (const p of plan)
  console.log(`| Q${p.q.id}#${p.c.num} | ${p.kind} | ${p.wasCs.join(" ") || "—"} | ${p.full ? p.full.cs.join(" ") : "(유지)"} | `
    + `${p.full?.pat ? `**${p.wasPat} → ${p.full.pat}**` : (p.wasPat ?? "—")} |`);
console.log("");

if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. 적용하려면 --apply"); process.exit(0); }

// ── 적용 ──────────────────────────────────────────────────
const bakDir = path.join(ROOT, "pipeline/backups");
fs.mkdirSync(bakDir, { recursive: true });
const bak = path.join(bakDir, "all_data_204.before_r2019b_analysis.json");
fs.writeFileSync(bak, before);
console.log(`- 백업: \`pipeline/backups/${path.basename(bak)}\``);

for (const p of plan) {
  if (p.full) {
    p.c.analysis = p.full.a;
    p.c.cs_ids = [...p.full.cs];
    if (p.full.pat) p.c.pat = p.full.pat;
  } else {
    p.c.analysis = p.was.replace(/\(나\)\s*제시되지 않음(\([^)]*\))?/g, NA_REF[p.q.id]);
  }
}
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

// ── 되읽기 검산 (S-02) ────────────────────────────────────
const after = fs.readFileSync(DATA);
if (after[0] === 0xef && after[1] === 0xbb && after[2] === 0xbf) { console.log(NL + "🔴 BOM."); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const s2 = (back[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
const fail = [];
if (!s2) fail.push("세트가 사라졌다");
else {
  if ((s2.sents || []).length !== (set.sents || []).length) fail.push("문장 수가 변했다");
  const all = JSON.stringify(s2);
  const left = (all.match(/미제시|\(나\)\s*제시되지 않음/g) || []).length;
  if (left) fail.push(`「미제시」 표현이 ${left}회 남았다`);
  for (const f of FULL) {
    const c2 = (s2.questions.find((q) => q.id === f.q)?.choices || []).find((c) => c.num === f.n);
    if (!c2) { fail.push(`Q${f.q}#${f.n} 이 없다`); continue; }
    if (c2.analysis !== f.a) fail.push(`Q${f.q}#${f.n} 해설이 SPEC 과 다르다`);
    if (JSON.stringify(c2.cs_ids) !== JSON.stringify(f.cs)) fail.push(`Q${f.q}#${f.n} cs_ids 가 SPEC 과 다르다`);
    if (f.pat && c2.pat !== f.pat) fail.push(`Q${f.q}#${f.n} pat 이 ${f.pat} 이 아니다`);
  }
  // 결론줄–ok 일치 (S-12)
  for (const q of s2.questions || [])
    for (const c of q.choices || []) {
      const lines = String(c.analysis || "").split(NL);
      let concl = null;
      for (let i = lines.length - 1; i >= 0; i--) if (/[✅❌]/.test(lines[i])) { concl = lines[i]; break; }
      if (!concl) continue;
      const want = c.ok === false ? "❌" : "✅";
      if (!concl.includes(want)) fail.push(`Q${q.id}#${c.num} 결론줄이 ok 와 어긋난다`);
    }
}
console.log(`- 적용 후 all_data: ${(after.length / 1048576).toFixed(2)}MB · MD5 \`${md5(after)}\` · ${after.length - before.length > 0 ? "+" : ""}${after.length - before.length} bytes`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- 해설 ${plan.length}건 교체 · 「미제시」 표현 **0회**`);
console.log(`- 결론줄–ok 일치 전 선지 확인 (S-12)`);
console.log(`- 문장 수 무변경`);
console.log("");
console.log("다음: `cs_effect_audit` · `quality_gate 2019수능` · `build_split --verify` 확인 후 push.");
