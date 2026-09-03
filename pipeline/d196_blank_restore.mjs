// d196_blank_restore.mjs — l20279b Q26 발문의 소실된 빈칸 기입란 복원 (발주 D-196 선결)
//
// 원본 p9 픽셀 실측(심사관): baseline y=921.1 에 x 494.9~687.8 연속 가로선이 있다.
//   「학 생 :」(x456~490) 과 「에 해당해요.」(x688~744) 사이 구간과 정확히 일치한다.
//   즉 지면에는 밑줄 기입란이 실재하고, 추출 데이터에서 그 밑줄이 소실됐다.
//   (y=901 의 x456~745 선은 활동 박스 구분선으로 별건이다)
//
// Q26 은 빈칸 채우기 문항이고 선지가 그 빈칸에 들어갈 말이다. 빈칸 표시가 없으면
// 발문이 「학 생 : 에 해당해요.」로 읽혀 무엇을 고르는 문항인지 화면에서 알 수 없다.
//
// 정본 표기 = ASCII 언더바 6개 (심사관 지정)
//   근거: all_data 403세트에 빈칸 표기 전례가 0건이라 따를 관례가 없다.
//   전각·특수문자는 폰트·게이트 사고 이력이 있고, QuizPanel:1484 가 {question.t} 를
//   순수 텍스트 노드로 렌더하므로 마크다운 부작용도 없다.
//
// 붙임 위치: 밑줄이 「에 해당해요」에 바로 잇닿아 있다(x 687.8 ↔ 688). 사이를 띄우지 않는다.
//
// 세 파일을 함께 고친다 — 하나라도 빠지면 다음 재생성 때 결손이 되돌아온다:
//   ① 회차 원천 step2_2027_9월.json   ② 단건 입력 step2.json   ③ 생성 산출 step3_result.json
//
// 사용: node pipeline/d196_blank_restore.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

const SID = "l20279b", QID = "26";
const FIND = "학 생 : 에 해당해요.";
const REPL = "학 생 : ______에 해당해요.";
const BLANK = "______";

const FILES = [
  { label: "회차 원천", rel: "pipeline/test_data/step2_2027_9월.json", indent: null },
  { label: "단건 입력", rel: "pipeline/test_data/d196_l20279b/step2.json", indent: 2 },
  { label: "생성 산출", rel: "pipeline/test_data/d196_l20279b/step3_result.json", indent: 2 },
];

console.log("# l20279b Q26 발문 빈칸 복원 (D-196 선결)");
console.log("");

const fail = [], plans = [];
for (const f of FILES) {
  const abs = path.join(ROOT, f.rel);
  if (!fs.existsSync(abs)) { fail.push(`${f.rel} 없음`); continue; }
  const raw = fs.readFileSync(abs, "utf8");
  const j = JSON.parse(raw);
  const set = (j.literature || []).find((x) => (x.setId || x.id) === SID);
  if (!set) { fail.push(`${f.rel} 에 ${SID} 없음`); continue; }
  const q = (set.questions || []).find((x) => String(x.id) === QID);
  if (!q) { fail.push(`${f.rel} 에 Q${QID} 없음`); continue; }
  const t = String(q.t || "");
  if (t.includes(BLANK)) { fail.push(`${f.rel} — 이미 빈칸이 있다 (중복 삽입 위험)`); continue; }
  const n = t.split(FIND).length - 1;
  if (n !== 1) { fail.push(`${f.rel} — 대상 문구가 ${n}곳 (1곳이어야 한다): ${JSON.stringify(FIND)}`); continue; }
  // 언더바가 발문 어디에도 없어야 한다 — 있으면 다른 용도와 섞인다
  if (t.includes("_")) { fail.push(`${f.rel} — 발문에 이미 언더바가 있다`); continue; }
  plans.push({ ...f, abs, j, q, before: t, after: t.replace(FIND, REPL), raw });
}

if (!fail.length) {
  console.log("| 파일 | 변경 |");
  console.log("|---|---|");
  for (const p of plans) console.log(`| \`${p.rel}\` (${p.label}) | ${JSON.stringify(FIND)} → **${JSON.stringify(REPL)}** |`);
  console.log("");
  console.log("발문 끝 변화:");
  console.log("```");
  console.log("전: " + JSON.stringify(plans[0].before.slice(-46)));
  console.log("후: " + JSON.stringify(plans[0].after.slice(-46)));
  console.log("```");
  console.log("");
}
if (fail.length || plans.length !== FILES.length) {
  console.log("## 🔴 사전 검사 실패 — 아무것도 쓰지 않는다");
  console.log("");
  fail.forEach((x) => console.log(`- ${x}`));
  if (!fail.length) console.log(`- 계획 ${plans.length}/${FILES.length}`);
  process.exit(1);
}
console.log(`✅ 사전 검사 통과 — ${plans.length}개 파일`);
console.log("");
if (!APPLY) { console.log("### 미리보기 — 아무것도 쓰지 않았다. `--apply`"); process.exit(0); }

for (const p of plans) {
  fs.writeFileSync(p.abs + ".before_d196blank", p.raw, "utf8");
  p.q.t = p.after;
  fs.writeFileSync(p.abs, JSON.stringify(p.j, null, p.indent ?? 2), "utf8");
}

// ── 되읽기 검산 ─────────────────────────────────────────────────────────
const bad = [];
for (const p of plans) {
  const j = JSON.parse(fs.readFileSync(p.abs, "utf8"));
  const set = (j.literature || []).find((x) => (x.setId || x.id) === SID);
  const q = (set.questions || []).find((x) => String(x.id) === QID);
  const t = String(q.t || "");
  if (!t.includes(REPL)) bad.push(`${p.rel} — 복원된 문구가 없다`);
  if ((t.split(BLANK).length - 1) !== 1) bad.push(`${p.rel} — 빈칸이 ${t.split(BLANK).length - 1}곳`);
  if (t.replace(REPL, FIND) !== p.before) bad.push(`${p.rel} — 발문의 다른 부분이 달라졌다`);
  // 같은 파일의 다른 문항·세트는 무변이어야 한다
  const pre = JSON.parse(p.raw);
  for (const sec of ["reading", "literature"]) for (const s of pre[sec] || []) {
    const sid = s.setId || s.id;
    const cur = (j[sec] || []).find((x) => (x.setId || x.id) === sid);
    for (const oq of s.questions || []) {
      const cq = (cur?.questions || []).find((x) => String(x.id) === String(oq.id));
      if (sid === SID && String(oq.id) === QID) {
        if (JSON.stringify({ ...oq, t: null }) !== JSON.stringify({ ...cq, t: null }))
          bad.push(`${p.rel} — Q26 의 t 외 필드가 달라졌다`);
        continue;
      }
      if (JSON.stringify(oq) !== JSON.stringify(cq)) bad.push(`${p.rel} — ${sid} Q${oq.id} 가 달라졌다`);
    }
  }
  console.log(`- \`${p.rel}\` MD5 ${md5(p.raw).slice(0, 8)} → ${md5(fs.readFileSync(p.abs, "utf8")).slice(0, 8)}`);
}
console.log("- 백업 각 파일 옆 `*.before_d196blank`");
console.log("");
if (bad.length) { console.log("## 🔴 되읽기 검산 실패 — 백업으로 되돌리십시오"); bad.forEach((x) => console.log(`- ${x}`)); process.exit(1); }
console.log("## ✅ 되읽기 검산 통과 (S-02)");
console.log("- 3개 파일 전부 빈칸 1곳 · 발문의 다른 부분 무변");
console.log("- 같은 파일의 다른 문항·세트 전건 무변");
console.log("");
console.log("### 다음 — Q26 해설은 빈칸 없이 생성된 것이므로 이 문항만 재생성해야 한다");
