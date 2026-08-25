// gasa_fix.mjs — 고전시가 행갈이 복원 + 점선 뭉갬 정리 + N+N 3건 (발주 D-102 ②③)
//
// 2015_9월B l20159d Q45 <보기 2>(정철 「속미인곡」)가 두 가지로 망가져 있다.
//   ① 행갈이가 사라져 시행이 한 줄로 이어붙었다 ("돌아오니반벽청등…")
//   ② 행 옆 구간 표시 [가]~[마]와 그 지시선(점선)이 **앞으로 몰렸다**
//      "<보기 2>·······[가]·······[나]···[마]모첨(茅簷) 찬 자리에…"
//
// 원본 지면(360dpi 렌더)에서 확인한 구조 — 점선은 조판 지시선이고,
// [가]~[마]는 **해당 행의 오른쪽 끝**에 붙는 구간 표시다.
//
//   모첨(茅簷) 찬 자리에 밤중만 돌아오니 ┐········ [가]
//   반벽청등(半壁靑燈)은 눌 위하여 밝았는고
//
// ■ 글자를 만들지 않는다 (§13⑬)
//   행 전문을 손으로 옮겨 적지 않는다. **원본 문자열을 자르기만** 한다.
//   행 시작 어구(4~6자)로 경계를 찾고, 못 찾으면 그 자리에서 중단한다.
//   초안에서 전문을 이스케이프로 옮겨 적었다가 8자를 잘못 썼다
//   (簷→簝 · 靑→青 · 덧→덩 · 늙→닭 · 쁜→쁩 · 좇→젅 · 싀→싄).
//   다중집합 검증이 그걸 잡았고, 그래서 「옮겨 적기」 자체를 폐기했다.
//
// 사용: node pipeline/gasa_fix.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");

// 행 시작 어구 — 원본에서 이 위치를 찾아 자른다. [tag] 는 그 행 끝에 붙는다.
// (첫 행은 본문 맨 앞에서 시작하므로 시작 어구가 없다)
const CUTS = [
  [null, "[가]"],          // 모첨(茅簷) 찬 자리에 …
  ["반벽청등", null],
  ["오르며", null],
  ["저근덧", null],
  ["정성이", null],
  ["옥(", "[나]"],
  ["마음에", "[다]"],
  ["눈물이", null],
  ["정(", null],
  ["방정맞은", null],
  ["어와", null],
  ["결에", "[라]"],
  ["어여쁜", null],
  ["차라리", "[마]"],
  ["임 계신", null],
  ["- 정철,", null],
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const W = (s) => String(s).replace(/[\s.·…]/g, "");
const bagOf = (s) => { const m = new Map(); for (const c of W(s)) m.set(c, (m.get(c) || 0) + 1); return m; };
const bagEq = (a, b) => {
  const A = bagOf(a), B = bagOf(b);
  if (A.size !== B.size) return false;
  for (const [k, v] of A) if (B.get(k) !== v) return false;
  return true;
};
const dirty = new Set();

console.log(`## 고전시가·점선·N+N 정리 ${APPLY ? "적용" : "DRY-RUN"}\n`);

{
  const s = (data["2015_9월B"]?.literature || []).find((x) => x.id === "l20159d");
  const q = s && (s.questions || []).find((x) => String(x.id) === "45");
  if (!q || typeof q.bogi !== "string") console.log("  🔴 l20159d Q45 bogi 를 못 찾음");
  else {
    const marker = "<보기 2>";
    const at = q.bogi.indexOf(marker);
    if (at < 0) console.log("  🔴 <보기 2> 표지를 못 찾음");
    else {
      const head = q.bogi.slice(0, at + marker.length);
      let body = q.bogi.slice(at + marker.length);

      // 1) 앞에 몰린 점선과 [가]~[마] 를 떼어 낸다 — 시 본문이 시작하는 곳까지
      const tags = [...body.matchAll(/\[[가-마]\]/g)].map((m) => m[0]);
      const firstLine = body.search(/[^\s.·…\[\]가-마]/);
      // 태그·점선 덩어리는 본문 첫 글자 앞에만 있어야 한다
      const prefix = body.slice(0, firstLine);
      if (!/^[\s.·…]*(\[[가-마]\][\s.·…]*)+$/.test(prefix)) {
        console.log("  🔴 앞머리가 점선+구간표시 형태가 아니다 — 중단");
        console.log(`     ${JSON.stringify(prefix.slice(0, 60))}`);
      } else {
        body = body.slice(firstLine);
        // 2) 행 시작 어구로 자른다
        const parts = [];
        let rest = body, ok = true;
        for (let i = 1; i < CUTS.length; i++) {
          const needle = CUTS[i][0];
          const k = rest.indexOf(needle, 1);
          if (k < 0) { console.log(`  🔴 행 시작 「${needle}」 를 못 찾음 — 중단`); ok = false; break; }
          parts.push(rest.slice(0, k));
          rest = rest.slice(k);
        }
        if (ok) {
          parts.push(rest);
          if (parts.length !== CUTS.length) { console.log(`  🔴 행 수 불일치 ${parts.length}/${CUTS.length}`); ok = false; }
          else {
            const rebuilt = parts
              .map((t, i) => { const tag = CUTS[i][1]; return tag ? `${t.trim()} ${tag}` : t.trim(); })
              .join("\n");
            const orig = q.bogi.slice(at + marker.length);
            if (!bagEq(rebuilt, orig)) {
              console.log("  🔴 글자 다중집합이 원본과 다르다 — 중단");
              const A = bagOf(orig), B = bagOf(rebuilt);
              const d = [];
              for (const k of new Set([...A.keys(), ...B.keys()])) {
                const n = (A.get(k) || 0) - (B.get(k) || 0);
                if (n) d.push(`${k}:${n > 0 ? "원본" : "재구성"}에만 ${Math.abs(n)}`);
              }
              console.log(`     ${d.join(" · ")}`);
            } else {
              console.log("  2015_9월B l20159d Q45 bogi — <보기 2> 행갈이 복원 + 점선 제거");
              console.log(`     전: ${orig.slice(0, 74)}…`);
              for (const line of rebuilt.split("\n").slice(0, 3)) console.log(`     후│ ${line}`);
              console.log(`     후│ … (총 ${parts.length}행, 구간표시 ${tags.length}개 제자리 복귀)`);
              console.log(`     ✅ 글자 검증 통과 — 다중집합 일치 (추가·손실 0)`);
              if (APPLY) { q.bogi = head + "\n" + rebuilt; dirty.add("2015_9월B"); }
            }
          }
        }
      }
    }
  }
}

// ── N+N 3건 — 원본 PDF 출현 빈도로 확정 ──
const NN = [
  ["2017_9월", "r20179c", 31, "c5", "칼로릭이론의", "칼로릭 이론의", "PDF 원문 「칼로릭 이론」 5회 · 붙임 0회"],
  ["2020_9월", "l20209c", 37, "c1", "뒷동산청솔잎을", "뒷동산 청솔잎을", "PDF 원문 「뒷동산 청솔잎」 1회 · 붙임 0회"],
  ["2020_9월", "l20209d", 44, "bogi", "않아주인공을", "않아 주인공을", "PDF 에 두 형태 모두 없음 — 용언 「않아」 뒤 체언은 별개 어절"],
];
console.log(`\n### N+N — ${NN.length}건 (원본 PDF 근거)`);
for (const [yk, sid, qid, where, from, to, why] of NN) {
  let target = null;
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => x.id === sid);
    if (!s) continue;
    const q = (s.questions || []).find((x) => String(x.id) === String(qid));
    if (!q) break;
    if (where === "bogi") {
      if (typeof q.bogi === "string") target = { get: () => q.bogi, set: (v) => { q.bogi = v; } };
    } else {
      const c = (q.choices || []).find((x) => String(x.num) === where.slice(1));
      if (c) target = { get: () => String(c.t ?? ""), set: (v) => { c.t = v; } };
    }
    break;
  }
  if (!target) { console.log(`  🔴 ${yk} ${sid} Q${qid} ${where} — 대상 없음`); continue; }
  const cur = target.get();
  if (!cur.includes(from)) { console.log(`  ⚠ ${yk} ${sid} Q${qid} ${where} — 「${from}」 없음(이미 처리?)`); continue; }
  console.log(`  ${yk} ${sid} Q${qid} ${where}: 「${from}」 → 「${to}」 — ${why}`);
  if (APPLY) { target.set(cur.replace(from, to)); dirty.add(yk); }
}

if (APPLY && dirty.size) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
