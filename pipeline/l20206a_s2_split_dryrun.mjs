// l20206a_s2_split_dryrun.mjs — s2 문단 경계 복원 + [A] 정박 dry-run (발주 D-155 ①)
//
// ★ 임의 분리가 아니다 — 원본 문단 경계 복원이다
//   심사관 원본 실측: 「이적에 원수가…사관에서 쉬고 있었는데,」는 꺾쇠 밖,
//   「한 나비가 침상에…별세계라.」부터 들여쓰기가 시작돼 꺾쇠 안이다.
//   추출 단계에서 두 문단이 한 문장으로 붙어 버렸다.
//
//   S-11 「기존 세트 재분할 금지」의 예외다. 규약이 막는 것은 **분할 규칙을 소급 적용**하는
//   것이지, 원본에 있던 경계를 되살리는 것이 아니다. 경계는 프로그램이 아니라 원본이 정했다.
//
// 무엇을 하나 (dry-run — 아무것도 쓰지 않는다)
//   ① s2 를 둘로 나눈다 — 뒤 문장은 새 id 로 s2 바로 뒤에 넣는다
//   ② [A] = 뒤 문장 ~ s3 정박안
//   ③ s2 를 가리키던 cs_ids 3곳을 어느 조각으로 보낼지 정한다
//   ④ 되읽기 검산을 **메모리에서** 돌려 결과를 보고한다
//
// 사용: node pipeline/l20206a_s2_split_dryrun.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const ANN = path.join(ROOT, "public/data/annotations.json");
const YK = "2020_6월", SID = "l20206a", NEWID = `${SID}s901`;
const CUT = "쉬고 있었는데,";

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const ann = JSON.parse(fs.readFileSync(ANN, "utf8"));
const set = (data[YK]?.literature || []).find((x) => (x.setId || x.id) === SID);
const sents = set.sents || [];
const i2 = sents.findIndex((x) => x.id === `${SID}s2`);
if (i2 < 0) { console.log("🔴 s2 를 못 찾았다."); process.exit(1); }
const orig = String(sents[i2].t);
const at = orig.indexOf(CUT);
if (at < 0) { console.log(`🔴 분리 지점 「${CUT}」 을 못 찾았다.`); process.exit(1); }
const head = orig.slice(0, at + CUT.length);
const tail = orig.slice(at + CUT.length).trim();

console.log("# l20206a s2 문단 경계 복원 + [A] 정박 — DRY-RUN");
console.log("");
console.log("> **아무것도 쓰지 않았다.** 심사관 판정 후에 적용한다.");
console.log("");
console.log("## ① s2 분리");
console.log("");
console.log(`원본 1문장 ${orig.length}자 → 2문장`);
console.log("");
console.log(`- \`${SID}s2\` (${head.length}자) — **꺾쇠 밖**`);
console.log(`  ${JSON.stringify(head)}`);
console.log(`- \`${NEWID}\` (${tail.length}자) — **꺾쇠 안, [A] 시작**`);
console.log(`  ${JSON.stringify(tail)}`);
console.log("");
const rejoin = `${head} ${tail}`;
console.log(`**글자 검산**: 두 조각을 공백 하나로 이으면 원문과 ${rejoin === orig ? "**완전히 같다** ✅" : "🔴 **다르다**"}`);
if (rejoin !== orig) process.exit(1);
console.log(`- 공백 제외 ${orig.replace(/\s/g, "").length}자 → ${(head + tail).replace(/\s/g, "").length}자 ${orig.replace(/\s/g, "").length === (head + tail).replace(/\s/g, "").length ? "✅" : "🔴"}`);
console.log(`- 새 id \`${NEWID}\` 는 기존과 겹치지 않는다: ${sents.some((x) => x.id === NEWID) ? "🔴 겹침" : "✅"}`);
console.log("");

console.log("## ② [A] 정박안");
console.log("");
const s3 = sents.find((x) => x.id === `${SID}s3`);
console.log(`\`{"type":"bracket","label":"A","sentFrom":"${NEWID}","sentTo":"${SID}s3"}\``);
console.log("");
console.log(`- 시작 \`${NEWID}\` ${JSON.stringify(tail.slice(0, 40))}…`);
console.log(`- 끝   \`${SID}s3\` ${JSON.stringify(String(s3.t).slice(0, 40))}…`);
console.log(`- 발주 확정 종료 문구 「…쓰여 있었다.」 가 s3 끝인가: ${/쓰여 있었다\.\s*$/.test(String(s3.t)) ? "✅" : "🔴 확인 필요"}`);
console.log(`- 현재 annotations: ${(ann[YK]?.[SID] || []).map((a) => `[${a.label}]`).join(" ") || "없음"}`);
console.log("");

console.log("## ③ `cs_ids` 재정박 — s2 를 가리키던 3곳");
console.log("");
console.log("| 위치 | 선지 | 어느 조각인가 | 이동 |");
console.log("|---|---|---|---|");
const moves = [];
for (const q of set.questions || [])
  for (const c of q.choices || []) {
    if (!(c.cs_ids || []).includes(`${SID}s2`)) continue;
    const t = String(c.t || "");
    // 앞 조각(연주 도달·사관에서 쉼)을 가리키는지, 뒤 조각(나비·별세계)을 가리키는지
    const toHead = /사관|연주|군마|쉬려/.test(t);
    const dest = toHead ? `${SID}s2` : NEWID;
    moves.push({ q: q.id, n: c.num, dest, why: toHead ? "앞 조각(연주 도달·사관)" : "뒤 조각(나비·별세계)" });
    console.log(`| Q${q.id}#${c.num} | ${t.slice(0, 34)}… | ${moves.at(-1).why} | \`${SID}s2\` → \`${dest}\`${dest === `${SID}s2` ? " (유지)" : ""} |`);
  }
console.log("");

// ── ④ 되읽기 검산 — 메모리에서 (S-02) ──────────────────────
const sim = JSON.parse(JSON.stringify(data));
const set2 = (sim[YK].literature).find((x) => (x.setId || x.id) === SID);
const proto = { ...set2.sents[i2] };
set2.sents[i2] = { ...proto, t: head };
set2.sents.splice(i2 + 1, 0, { ...proto, id: NEWID, t: tail });
for (const m of moves)
  for (const c of (set2.questions.find((q) => q.id === m.q).choices))
    if (c.num === m.n) c.cs_ids = (c.cs_ids || []).map((x) => (x === `${SID}s2` ? m.dest : x));

const NON_HL = new Set(["footnote", "author", "omission", "workTag", "image", "figure"]);
const ids = new Set(set2.sents.map((x) => String(x.id)));
const fail = [];
if (set2.sents.length !== sents.length + 1) fail.push("문장 수가 +1 이 아니다");
if (set2.sents[i2 + 1].id !== NEWID) fail.push("새 문장이 s2 바로 뒤가 아니다");
if (set2.sents.map((x) => x.t).join("") !== sents.map((x, k) => (k === i2 ? head + tail : x.t)).join("")) fail.push("본문 글자가 달라졌다");
let dangling = 0, nonhl = 0, still2 = 0;
for (const q of set2.questions || [])
  for (const c of q.choices || [])
    for (const id of c.cs_ids || []) {
      if (!ids.has(id)) dangling++;
      else if (NON_HL.has(set2.sents.find((x) => x.id === id).sentType || "body")) nonhl++;
      if (id === `${SID}s2` && !moves.some((m) => m.dest === `${SID}s2` && m.q === q.id && m.n === c.num)) still2++;
    }
if (dangling) fail.push(`끊긴 cs_id ${dangling}건`);
if (nonhl) fail.push(`비-하이라이트 cs_id ${nonhl}건`);

console.log("## ④ 되읽기 검산 (메모리 시뮬레이션 · S-02)");
console.log("");
if (fail.length) { fail.forEach((x) => console.log(`- 🔴 ${x}`)); process.exit(1); }
console.log(`- 문장 ${sents.length} → **${set2.sents.length}** · 본문 글자 **무변경** ✅`);
console.log(`- 끊긴 \`cs_id\` **0** · 비-하이라이트 \`cs_id\` **0** ✅`);
console.log(`- 나머지 문장 id **재부여 없음** — \`s3\` 이후 전부 그대로 ✅`);
console.log("");
console.log("### 적용 시 함께 볼 것");
console.log("");
console.log("- `[A]` 정박은 `bracket_anchor_write.mjs` SPEC 에 넣어 쓴다(vm 동기화 포함)");
console.log("- `passage_gap_audit` → `[A]` 미정박 해소 확인");
console.log("- `quality_gate 2020_6월` → `MARKER_INTEGRITY_FAIL` 해소 확인");
console.log("- Q24 해설 재작성안(D-154 ③)이 `s2` 를 근거로 쓰므로 **함께 적용해야 한다**");
