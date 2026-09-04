// l20206a_apply.mjs — s2 분리 + [A] 정박 + Q24 해설 5건 **동시** 적용 (발주 D-156 ①)
//
// ★ 반드시 한 번에 한다
//   Q24 해설의 근거가 분리된 뒷조각(s901)을 가리킨다. 분리만 하고 해설을 안 고치면
//   근거가 앞조각을 가리킨 채로 남고, 해설만 고치면 s901 이 없어 cs_id 가 끊긴다.
//   둘 중 하나만 적용된 상태가 **존재해서는 안 된다.**
//
// 무엇을 하나
//   ① s2 문단 경계 복원 — s2(59자, 꺾쇠 밖) + s901(106자, 꺾쇠 안)
//      임의 분리가 아니라 원본 들여쓰기 복원이다(심사관 실측, D-155 ①)
//   ② [A] = s901 ~ s3 정박 (annotations.json)
//   ③ Q24 해설 5건 교체 + cs_ids 재부여 (D-154 ③ 상신안)
//      Q23#2 의 cs_ids 는 s2 를 **유지**한다 — 근거가 앞조각(연주 도달·사관)이다
//
// 안전 절차: 백업 → MD5 → node fs.writeFileSync(§13⑪) → 되읽기 검산(S-02)
//   annotations.json 은 2칸 들여쓰기를 지킨다(minify 하면 diff 가 파일 전체가 된다)
//
// 사용:
//   node pipeline/l20206a_apply.mjs           미리보기
//   node pipeline/l20206a_apply.mjs --apply

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const APPLY = process.argv.includes("--apply");
const NL = String.fromCharCode(10);
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2020_6월", SID = "l20206a", NEW = `${SID}s901`;
const CUT = "쉬고 있었는데,";
const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);

const A = (ev, why, verdict) => `📌 지문 근거: ${ev}${NL}🔍 ${why}${NL}${verdict}`;
const SPEC = [
  { n: 1, ok: false, pat: "L2", cs: [NEW, `${SID}s4`],
    a: A(`"그 가운데 광활하여 완연한 별세계라." · "궁궐 위를 바라보니 한 노인이 앉았으되 얼굴은 관옥 같고 머리에 황금관을 쓰고 몸에 용포를 입고 윗자리에 높이 앉았는데"`,
      `[A]가 광활한 공간을 그리는 것은 맞다. 그러나 원수는 나비를 따라 이끌려 들어가 구경하는 자리에 있을 뿐, 스스로 나아가거나 뜻을 펴려 하지 않는다. 광활함은 인물의 기상이 아니라 그곳이 인간 세상이 아님을 보여 주는 장치다`,
      `❌ 지문과 어긋나는 부적절한 진술 [정서·태도 오독]`) },
  { n: 2, ok: false, pat: "L2", cs: [`${SID}s14`],
    a: A(`"해는 서쪽 산 위로 떨어지고 달은 동쪽 고개 위로 떠올랐는데, 무심한 잔나비는 달빛 아래에서 슬피 울고, 그윽한 두견성은 불여귀를 일삼았다."`,
      `[B]에 시간의 흐름(해가 지고 달이 뜸)이 나타나는 것은 맞다. 그러나 그 시간을 채우는 것은 '슬피 울고'·'불여귀'처럼 어둡고 불길한 소리다. 낙관이 아니라 앞일에 대한 불안을 돋운다`,
      `❌ 지문과 어긋나는 부적절한 진술 [정서·태도 오독]`) },
  { n: 3, ok: false, pat: "L1", cs: [`${SID}s14`, `${SID}s15`],
    a: A(`"이날 함곡에 도달하니 해는 서쪽 산 위로 떨어지고" · "갈 길은 험악한데 동쪽은 험한 산이고 서쪽은 깊은 골짜기여서 층층이 험한 산봉우리는 가슴을 찌르는 듯하고"`,
      `[A]의 환상성은 맞다. 그러나 [B]가 보여 주는 것은 자연 배경(산·골짜기·달·새 울음)이지 시대적 상황이 아니다. [B] 어디에도 시대를 알려 주는 구체적 정보가 없다`,
      `❌ 지문과 어긋나는 부적절한 진술 [표현·형식 오독]`) },
  { n: 4, ok: false, pat: "L1", cs: [NEW, `${SID}s15`],
    a: A(`"한 나비가 침상에 날아들거늘 원수도 자연스럽게 날개를 얻어 그 나비를 따라 공중에 날아 한 곳에 이르니" · "갈 길은 험악한데 동쪽은 험한 산이고 서쪽은 깊은 골짜기여서"`,
      `[B]에서 쓸쓸함이 느껴지는 것은 맞다. 그러나 그것은 계절이 아니라 밤이라는 시간과 험한 산길이라는 공간에서 온다. [A]의 공간 이동도 긴장이 아니라 신비로 이어진다. 두 구간의 원인을 서로 바꿔 놓았다`,
      `❌ 지문과 어긋나는 부적절한 진술 [표현·형식 오독]`) },
  { n: 5, ok: true, pat: null, cs: [NEW, `${SID}s3`, `${SID}s14`, `${SID}s15`],
    a: A(`"그 가운데 광활하여 완연한 별세계라." · "문에 현판을 붙였으되, '만고충렬문'이라 뚜렷이 쓰여 있었다." · "무심한 잔나비는 달빛 아래에서 슬피 울고, 그윽한 두견성은 불여귀를 일삼았다." · "층층이 험한 산봉우리는 가슴을 찌르는 듯하고 야광은 희미하기만 했다."`,
      `[A]는 나비를 따라 날아간 '별세계'와 '만고충렬문'이라는 비현실 공간이라 신비롭다. [B]는 원수가 실제로 행군해 도달한 함곡이라는 현실 공간인데, 슬피 우는 잔나비와 가슴을 찌르는 듯한 산봉우리가 곧 닥칠 위기를 예감하게 한다`,
      `✅ 지문과 일치하는 적절한 진술`) },
];
const BRACKET_A = { type: "bracket", label: "A", sentFrom: NEW, sentTo: `${SID}s3` };

const before = fs.readFileSync(DATA), annBefore = fs.readFileSync(ANN);
const data = JSON.parse(before.toString("utf8"));
const ann = JSON.parse(annBefore.toString("utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트를 못 찾았다."); process.exit(1); }
const sents = set.sents;
const i2 = sents.findIndex((x) => x.id === `${SID}s2`);
const orig = String(sents[i2].t);
const at = orig.indexOf(CUT);
if (at < 0) { console.log("🔴 분리 지점을 못 찾았다."); process.exit(1); }
const head = orig.slice(0, at + CUT.length), tail = orig.slice(at + CUT.length).trim();
if (`${head} ${tail}` !== orig) { console.log("🔴 글자 검산 실패 — 두 조각이 원문을 복원하지 못한다."); process.exit(1); }
if (sents.some((x) => x.id === NEW)) { console.log(`⚠ ${NEW} 가 이미 있다. 적용된 것으로 보인다.`); process.exit(0); }

console.log("# l20206a 통합 적용 — s2 분리 + [A] 정박 + Q24 해설 5건");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\` · annotations MD5 \`${md5(annBefore)}\``);
console.log(`- s2 ${orig.length}자 → s2 ${head.length}자 + ${NEW} ${tail.length}자 · **글자 검산 ✅**`);
console.log(`- [A] = \`${NEW}\` ~ \`${SID}s3\``);
console.log(`- Q24 해설 5건 · Q23#2 cs_ids 는 \`${SID}s2\` 유지`);
console.log("");
console.log("| # | ok | pat | cs_ids |");
console.log("|---|---|---|---|");
for (const p of SPEC) console.log(`| ${p.n} | ${p.ok} | ${p.pat ?? "—"} | ${p.cs.join(" ")} |`);
console.log("");

if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. 적용하려면 --apply"); process.exit(0); }

const bakDir = path.join(ROOT, "pipeline/backups");
fs.mkdirSync(bakDir, { recursive: true });
fs.writeFileSync(path.join(bakDir, "all_data_204.before_l20206a_apply.json"), before);
fs.writeFileSync(path.join(bakDir, "annotations.before_l20206a_apply.json"), annBefore);
console.log(`- 백업 2건: \`pipeline/backups/*.before_l20206a_apply.json\``);

// ① 분리
const proto = { ...sents[i2] };
sents[i2] = { ...proto, t: head };
sents.splice(i2 + 1, 0, { ...proto, id: NEW, t: tail });
// ② 정박
(ann[YK] ||= {}); (ann[YK][SID] ||= []);
if (!ann[YK][SID].some((a2) => a2?.type === "bracket" && a2.label === "A")) ann[YK][SID].push(BRACKET_A);
// ③ 해설
const q24 = set.questions.find((q) => q.id === 24);
for (const p of SPEC) {
  const c = q24.choices.find((x) => x.num === p.n);
  c.analysis = p.a; c.cs_ids = [...p.cs]; c.ok = p.ok;
  if (p.pat === null) delete c.pat; else c.pat = p.pat;
}

fs.writeFileSync(DATA, JSON.stringify(data), "utf8");                 // §13⑪
fs.writeFileSync(ANN, JSON.stringify(ann, null, 2), "utf8");          // 2칸 들여쓰기 유지

// ── 되읽기 검산 (S-02) ────────────────────────────────────
const after = fs.readFileSync(DATA), annAfter = fs.readFileSync(ANN);
for (const [nm, b] of [["all_data", after], ["annotations", annAfter]])
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) { console.log(`${NL}🔴 ${nm} BOM.`); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const annBack = JSON.parse(annAfter.toString("utf8"));
const s2 = (back[YK].literature).find((x) => (x.setId || x.id) === SID);
const ids = new Set(s2.sents.map((x) => String(x.id)));
const fail = [];
if (s2.sents.length !== sents.length) fail.push("문장 수 불일치");
if (s2.sents[i2].t !== head || s2.sents[i2 + 1].id !== NEW || s2.sents[i2 + 1].t !== tail) fail.push("분리 결과가 다르다");
const b2 = (annBack[YK]?.[SID] || []).find((a2) => a2?.type === "bracket" && a2.label === "A");
if (!b2 || b2.sentFrom !== NEW || b2.sentTo !== `${SID}s3`) fail.push("[A] 정박이 다르다");
for (const p of SPEC) {
  const c = s2.questions.find((q) => q.id === 24).choices.find((x) => x.num === p.n);
  if (c.analysis !== p.a) fail.push(`Q24#${p.n} 해설 불일치`);
  if (JSON.stringify(c.cs_ids) !== JSON.stringify(p.cs)) fail.push(`Q24#${p.n} cs_ids 불일치`);
  if (c.ok !== p.ok) fail.push(`Q24#${p.n} ok 불일치`);
}
const q23 = s2.questions.find((q) => q.id === 23).choices.find((x) => x.num === 2);
if (!(q23.cs_ids || []).includes(`${SID}s2`)) fail.push("Q23#2 의 s2 근거가 사라졌다");
let dangling = 0, nonhl = 0;
for (const q of s2.questions) for (const c of q.choices) for (const id of c.cs_ids || []) {
  if (!ids.has(id)) dangling++;
  else if (NON_HL.has(s2.sents.find((x) => x.id === id).sentType || "body")) nonhl++;
}
if (dangling) fail.push(`끊긴 cs_id ${dangling}건`);
if (nonhl) fail.push(`비-하이라이트 cs_id ${nonhl}건`);
// 결론줄–ok 일치 (S-12)
for (const q of s2.questions) for (const c of q.choices) {
  const lines = String(c.analysis || "").split(NL);
  let concl = null;
  for (let k = lines.length - 1; k >= 0; k--) if (/[✅❌]/.test(lines[k])) { concl = lines[k]; break; }
  if (concl && !concl.includes(c.ok === false ? "❌" : "✅")) fail.push(`Q${q.id}#${c.num} 결론줄이 ok 와 어긋난다`);
}

console.log(`- 적용 후 all_data MD5 \`${md5(after)}\` (${after.length - before.length > 0 ? "+" : ""}${after.length - before.length}B) · annotations MD5 \`${md5(annAfter)}\` (+${annAfter.length - annBefore.length}B)`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- 문장 ${sents.length - 1} → **${s2.sents.length}** · 본문 글자 무변경`);
console.log(`- \`[A]\` = \`${NEW}\` ~ \`${SID}s3\` 정박`);
console.log(`- Q24 해설 5건 · Q23#2 \`s2\` 유지 확인`);
console.log(`- 끊긴 \`cs_id\` **0** · 비-하이라이트 **0** · 결론줄–\`ok\` 전 선지 일치 (S-12)`);
