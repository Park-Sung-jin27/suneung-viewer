// d177_pat_fix.mjs — r20199c Q36#1 pat L5 → R1 + 결론줄 라벨 (발주 D-177 ①)
//
// 심사관 재판정. D-171 B-2 에서 내가 L5 로 넣었던 것을 R1(사실 왜곡)으로 고친다.
// 도메인 관례 준수 — 독서 세트라 R 계열이 맞는다.
//
// ★ 마커의 「제안값」과 다르다 — 그래도 맞는다
//   이 선지의 `_pat_error` 는 `expected_domain: "R"` · `suggested_pat: "R2"` 를 달고 있다.
//   심사관 판정은 R1 이다. **도메인(R)은 마커와 일치**하고, suggested_pat 은 도구가
//   기계적으로 찍은 제안일 뿐 판정이 아니다. 내가 넣었던 L5 는 도메인부터 어긋나 있었다.
//
// ★ 라벨은 두 곳에 있다
//   ③ 판정 줄 끝과 결론줄 끝, 같은 `[보기 대입 오류]` 가 두 번 나온다.
//   발주는 결론줄만 말하지만, ③ 줄에 옛 라벨을 남기면 **화면에서 pat 과 어긋나는 말이
//   그대로 보인다.** 같은 라벨의 같은 정정이라 두 곳을 함께 바꾸고 보고에 명시한다.
//   (D-171 B-2 에서 `②` 를 뗄 때도 두 곳을 함께 다뤘고 심사관이 받았다)
//
// ★ 마커는 지우지 않는다 (발주 ②)
//   `_pat_error` · `_discriminative_validation` 을 그대로 둔다.
//   해소 여부는 검증 도구를 재실행해 확인한다 — 이 도구는 판정하지 않는다.
//
// 사용: node pipeline/d177_pat_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const md5 = (b) => crypto.createHash("md5").update(b).digest("hex");
const YK = "2019_9월", SID = "r20199c", QID = 36, NUM = 1;
const OLD_PAT = "L5", NEW_PAT = "R1";
const OLD_LAB = "[보기 대입 오류]", NEW_LAB = "[사실 왜곡]";

const before = fs.readFileSync(DATA);
const data = JSON.parse(before.toString("utf8"));
const set = (data[YK]?.reading || []).find((x) => (x.setId || x.id) === SID);
if (!set) { console.log("🔴 세트 없음"); process.exit(1); }
const c = set.questions.find((q) => q.id === QID)?.choices?.find((x) => x.num === NUM);
if (!c) { console.log("🔴 선지 없음"); process.exit(1); }

console.log("# r20199c Q36#1 pat L5 → R1 (D-177 ①)");
console.log("");
console.log(`- 적용 전 all_data MD5 \`${md5(before)}\``);
console.log("");

const A0 = String(c.analysis || "");
const nLab = (A0.match(/\[보기 대입 오류\]/g) || []).length;
const tail0 = A0.trim().split("\n").pop();
const bad = [];
if (c.pat !== OLD_PAT) bad.push(`pat 이 ${JSON.stringify(c.pat)} 다 — ${OLD_PAT} 여야 한다(중복 적용 의심)`);
if (!nLab) bad.push(`\`${OLD_LAB}\` 를 못 찾았다`);
if (!tail0.endsWith(OLD_LAB)) bad.push("결론줄이 옛 라벨로 끝나지 않는다");

console.log("| 항목 | 전 | 후 |");
console.log("|---|---|---|");
console.log(`| \`pat\` | \`${OLD_PAT}\` 보기 대입 오류 | **\`${NEW_PAT}\` 사실 왜곡** |`);
console.log(`| 라벨 \`${OLD_LAB}\` | ${nLab}곳 | **\`${NEW_LAB}\` ${nLab}곳** |`);
console.log(`| \`cs_ids\` | ${JSON.stringify(c.cs_ids)} | 무변 |`);
console.log(`| \`_pat_error\` · \`_discriminative_validation\` | 보유 | **무변 — 지우지 않는다**(발주 ②) |`);
console.log("");
console.log("**라벨이 두 곳이다** — ③ 판정 줄 끝과 결론줄 끝. 발주는 결론줄만 말하지만,");
console.log("③ 줄에 옛 라벨을 남기면 화면에서 `pat` 과 어긋나는 말이 그대로 보인다. 함께 바꾼다.");
console.log("");
console.log("현재 마커:");
console.log(`- \`_pat_error\` = \`${JSON.stringify(c._pat_error)}\``);
console.log(`- \`_discriminative_validation\` = \`${JSON.stringify(c._discriminative_validation)}\``);
console.log(`- → 마커의 \`expected_domain\` 은 **\`R\`** 이다. 판정 \`R1\` 은 이 도메인에 든다.`);
console.log(`  (\`suggested_pat: "R2"\` 는 도구의 기계적 제안일 뿐 판정이 아니다. 내가 넣었던 \`L5\` 는 도메인부터 어긋나 있었다.)`);
console.log("");
if (bad.length) { console.log("## 🔴 실패 — 아무것도 쓰지 않는다"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }

const A1 = A0.split(OLD_LAB).join(NEW_LAB);
console.log(`- 새 결론줄: \`${A1.trim().split("\n").pop()}\``);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. --apply"); process.exit(0); }

fs.mkdirSync(path.join(ROOT, "pipeline/backups"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/backups/all_data_204.before_d177.json"), before);
const sents0 = JSON.stringify(set.sents), cs0 = JSON.stringify(c.cs_ids);
const pe0 = JSON.stringify(c._pat_error), dv0 = JSON.stringify(c._discriminative_validation);
c.pat = NEW_PAT;
c.analysis = A1;
fs.writeFileSync(DATA, JSON.stringify(data), "utf8");   // §13⑪

const after = fs.readFileSync(DATA);
if (after[0] === 0xef) { console.log("🔴 BOM"); process.exit(1); }
const back = JSON.parse(after.toString("utf8"));
const s2 = back[YK].reading.find((x) => (x.setId || x.id) === SID);
const c2 = s2.questions.find((q) => q.id === QID).choices.find((x) => x.num === NUM);
const fail = [];
if (JSON.stringify(s2.sents) !== sents0) fail.push("**본문이 달라졌다**");
if (c2.pat !== NEW_PAT) fail.push("pat 미반영");
if (JSON.stringify(c2.cs_ids) !== cs0) fail.push("cs_ids 가 달라졌다");
if (JSON.stringify(c2._pat_error) !== pe0) fail.push("**_pat_error 가 달라졌다 — 지우면 안 된다**");
if (JSON.stringify(c2._discriminative_validation) !== dv0) fail.push("**_discriminative_validation 이 달라졌다**");
if (c2.analysis.includes(OLD_LAB)) fail.push("옛 라벨 잔존");
if (!c2.analysis.trim().endsWith(NEW_LAB)) fail.push("결론줄이 새 라벨로 끝나지 않는다");
if ((c2.analysis.match(/\[사실 왜곡\]/g) || []).length !== nLab) fail.push("새 라벨 개수 불일치");
if (c2.analysis.split(NEW_LAB).join(OLD_LAB) !== A0) fail.push("**해설이 라벨 밖에서 달라졌다**");
// ⑬축 — 끝 라벨 ↔ pat
const LAB = { "사실 왜곡": "R1", "인과·관계 전도": "R2", "과잉 추론": "R3", "개념 혼합": "R4", "어휘": "V",
  "표현·형식 오독": "L1", "정서·태도 오독": "L2", "주제·의미 과잉": "L3", "구조·맥락 오류": "L4", "보기 대입 오류": "L5" };
const m = String(c2.analysis).trim().split("\n").pop().match(/\[([^\]]+)\]\s*$/);
const labPat = m && LAB[m[1]];
if (labPat !== c2.pat) fail.push(`⑬축 라벨↔pat 어긋남 (${m?.[1]} → ${labPat} vs pat ${c2.pat})`);

console.log(`- 적용 후 MD5 \`${md5(after)}\` (${after.length - before.length >= 0 ? "+" : ""}${after.length - before.length}B)`);
console.log("");
if (fail.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); fail.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("");
console.log(`- \`pat\` = \`${c2.pat}\` · 끝 라벨 \`${m[1]}\` → \`${labPat}\` · **⑬축 일치**`);
console.log(`- 옛 라벨 잔존 **0** · 새 라벨 ${nLab}곳`);
console.log(`- \`cs_ids\` 무변 ${JSON.stringify(c2.cs_ids)} · **해설은 라벨 밖에서 한 글자도 안 달라졌다**`);
console.log("- **마커 2종 무변** — `_pat_error` · `_discriminative_validation` 그대로 (발주 ②)");
