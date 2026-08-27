// stem_head_audit.mjs — 발문 선두 마커 소실 패턴 전수 스캔 (발주 D-121 ④)
//
// r20226b Q9 「와 문맥상 의미가 가장 가까운 것은?」  ← 원본 「ⓐ와 …」
// r20226c Q11 「에 대한 설명으로 적절하지 않은 것은?」 ← 원본 「㉠에 …」
// r20249d Q17 「굳어졌다와 문맥상 …」                 ← 원본 「ⓐ와 …」
//
// 셋 다 발문 첫머리의 마커가 통째로 빠졌다. 본문 마커까지 같이 사라진 경우에는
// 고아 감사(marker_ref_audit)에 아예 잡히지 않으므로 별도로 훑는다.
//
// 한국어 발문은 명사·지시어·「윗글」·「다음」·<보기> 로 시작한다.
// **조사로 시작하면 그 앞에 무언가가 있었다는 뜻이다.**
//
// 판정은 원본 지면 대조로만 한다 — 여기서는 후보까지다.
//
// 사용: node pipeline/stem_head_audit.mjs [--md]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// --data=<경로> : 수리 전 스냅샷으로 그물이 실제로 걸리는지 회귀 확인할 때 쓴다
const DATA_ARG = (process.argv.find((x) => x.startsWith("--data=")) || "").split("=")[1];
const DATA = DATA_ARG ? path.resolve(process.cwd(), DATA_ARG) : path.join(ROOT, "public/data/all_data_204.json");
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const src = fs.readFileSync(path.join(ROOT, "src/dataLoader.js"), "utf8");
const at = src.indexOf("const RELEASE_KEYS = new Set([");
const REL = new Set([...src.slice(at, src.indexOf("]);", at)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1]).filter((k) => k.includes("::")));

const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const MARK = /[ⓐ-ⓩ㉠-㉾㈀-㈜]/;

// 발문 선두에 오면 안 되는 조사. 뒤에 공백이 오면 정상 어휘일 수 있으니 붙어 있는 것만 본다.
//   「이 글의 …」 「은유가 …」 처럼 정상인 경우를 거르기 위해 2글자 조합을 함께 본다.
const JOSA = ["와", "과", "은", "는", "이", "가", "을", "를", "의", "에", "로", "도", "만"];
// 조사 + 이 말뭉치들이 이어지면 마커가 빠진 자리로 본다
// 조사가 앞뒤로 공백에 둘러싸여 홀로 선 자리 — 마커가 빠지고 공백만 남은 형태
const LONE = /\s(와|과|은|는|이|가|을|를|의|에|로)\s/;
// 조사 + 이 말뭉치들이 이어지면 마커가 빠진 자리로 본다
// 어휘 문항의 어미. 반드시 밑줄·마커 대상을 요구하므로, 발문에 마커가 하나도 없으면
// 가리킬 대상이 사라진 것이다 — r20249d Q17 「굳어졌다와 문맥상 …」(원본 「ⓐ와 …」).
const VOCAB = ["와 문맥상", "과 문맥상", "와 바꿔", "과 바꿔", "와 바꾸어", "과 바꾸어",
  "와 문맥적", "과 문맥적", "의 문맥적 의미"];
const TAIL = [
  "와 문맥상", "과 문맥상", "와 바꿔", "과 바꿔", "와 바꾸어", "과 바꾸어",
  "에 대한 설명", "에 대한 이해", "에 대한 반응", "에 대해 이해", "에 대해 설명",
  "의 이유로", "의 의미로", "의 문맥적", "을 이해한", "를 이해한", "을 설명한", "를 설명한",
  "은 무엇", "는 무엇", "이 가리키는", "가 가리키는", "에서 알 수 있는", "로 가장 적절",
];

const rows = [];
let stems = 0;
for (const [yk, v] of Object.entries(data))
  for (const sec of ["reading", "literature"])
    for (const s of v[sec] || []) {
      const setId = s.setId || s.id;
      const live = REL.has(`${yk}::${setId}`);
      const bodyMarks = new Set();
      for (const x of s.sents || [])
        for (const m of flat(x.t).match(/[ⓐ-ⓩ㉠-㉾㈀-㈜]/g) || []) bodyMarks.add(m);

      for (const q of s.questions || []) {
        const t = flat(q.t).trim();
        if (!t) continue;
        stems++;
        if (MARK.test(t[0])) continue;                 // 이미 마커로 시작하면 정상

        // 조사는 앞말에 붙여 쓴다. 조사가 홀로 서 있으면 앞에 있던 것이 사라진 자리다.
        //   「와 문맥상 …」   ← 선두형. 「의리와 …」 「이미지의 …」 같은 명사는 걸리지 않는다
        //   「도도 에 대한 …」 ← 중간형. 마커가 빠지고 공백만 남았다
        const bare = JOSA.includes(t[0]) && t[1] === " ";
        const mid = !bare && LONE.test(t);
        // 마커가 하나도 없는 발문에 어휘·지시 문항의 어미만 있으면, 가리킬 대상이 사라진 것이다.
        //   r20249d Q17 「굳어졌다와 문맥상 …」 ← 원본 「ⓐ와 …」. 앞말이 남아 선두 조사로는 안 걸린다.
        const hit = MARK.test(t) ? null : (TAIL.find((x) => t.startsWith(x)) || VOCAB.find((x) => t.includes(x)));
        if (!bare && !mid && !hit) continue;
        rows.push({
          yk, setId, live, qid: q.id, bare, mid,
          head: t.slice(0, 26),
          bodyMarks: [...bodyMarks].join("") || "없음",
        });
      }
    }

rows.sort((a, b) => (b.live - a.live) || (b.bare - a.bare) || (b.mid - a.mid) || a.yk.localeCompare(b.yk));
const L = rows.filter((r) => r.live).length;
const B = rows.filter((r) => r.bare || r.mid).length;

const out = [];
out.push(`# 발문 선두 마커 소실 스캔 (D-121 ④)`);
out.push(``);
out.push(`> 생성: \`node pipeline/stem_head_audit.mjs --md\``);
out.push(`> 발문이 조사로 시작하면 그 앞에 마커가 있었다는 뜻이다. **판정은 원본 지면 대조로만 한다.**`);
out.push(`> 본문 마커까지 함께 소실된 건은 고아 감사에 잡히지 않는다 — 이 표가 유일한 그물이다.`);
out.push(``);
out.push(`| 항목 | 수 |`);
out.push(`|---|--:|`);
out.push(`| 검사한 발문 | ${stems} |`);
out.push(`| 후보 | ${rows.length} (LIVE ${L}) |`);
out.push(`| 그중 조사가 홀로 선 자리 — 마커 완전 소실 | ${B} |`);
out.push(``);
if (rows.length) {
  out.push(`| 회차 | 세트 | 노출 | 문항 | 발문 선두 | 선두형 | 본문 마커 |`);
  out.push(`|---|---|---|---|---|---|---|`);
  for (const r of rows)
    out.push(`| ${r.yk} | \`${r.setId}\` | ${r.live ? "🔴" : "—"} | Q${r.qid} | \`${r.head}\` | ${r.bare ? "**선두 조사**" : r.mid ? "**중간 조사**" : "말뭉치"} | ${r.bodyMarks} |`);
  out.push(``);
}

if (process.argv.includes("--md")) console.log(out.join("\n"));
else console.log(out.slice(0, out.indexOf("") + 12).join("\n") + `\n(전체 표는 --md 로)`);
