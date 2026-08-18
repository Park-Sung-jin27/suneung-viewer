// audit_legacy.mjs — 회차 단위 원문 대조 감사 (발주 D-12 · 2026-08-18)
//
// 오늘(fz~D-11) 확정된 탐지 6종을 한 번에 돌린다.
//   ① 발문·보기·선지·지문 문자열 존재 대조 (앞부분만 보지 않는다)
//   ② <보기> 뒷부분 절단 (앞은 맞고 뒤가 다른 경우)
//   ③ 선지 ↔ 해설 인용 대조
//   ④ PDF 줄바꿈 대조 = 어절 분리 (마커 뒤 공백·운문 행은 분리 집계)
//   ⑤ 플레이스홀더 잔존
//   ⑥ 미대조 5유형 목록화 (객체 bogi · sym 토큰 · 도식 · 표 평면화 · PUA)
//
// ★ 읽기 전용. 데이터를 쓰지 않는다. 게이트 축 추가 없음(§13⑱).
// 사용: node pipeline/audit_legacy.mjs <yearKey> <pdf텍스트경로>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [YK, TXT] = process.argv.slice(2);
if (!YK || !TXT) {
  console.error("사용: node pipeline/audit_legacy.mjs <yearKey> <pdf텍스트경로>");
  process.exit(1);
}
const data = JSON.parse(
  fs.readFileSync(path.join(ROOT, "public/data/all_data_204.json"), "utf8"),
);
const rawPdf = fs.readFileSync(TXT, "utf8");

// ── 이형자 정규화 (공백은 건드리지 않는다) ──────────────────────
const uni = (s) =>
  String(s || "")
    .replace(/[‘’＇']/g, "'")
    .replace(/[“”＂"]/g, '"')
    .replace(/[｢「『]/g, "[")
    .replace(/[｣」』]/g, "]")
    .replace(//g, "[")
    .replace(//g, "]")
    .replace(/[～~〜]/g, "~")
    .replace(/[－–—―]/g, "-")
    .replace(/[（(]/g, "(")
    .replace(/[）)]/g, ")")
    .replace(/[·・･․‧∙⋅ㆍ]/g, "·")
    // 위첨자 — PDF 추출이 평문화하므로 양쪽을 평문으로 맞춘다(데이터 2ⁿ 이 더 정확).
    .replace(/⁰/g,"0").replace(/¹/g,"1").replace(/²/g,"2").replace(/³/g,"3")
    .replace(/⁴/g,"4").replace(/⁵/g,"5").replace(/⁶/g,"6").replace(/⁷/g,"7")
    .replace(/⁸/g,"8").replace(/⁹/g,"9").replace(/ⁿ/g,"n")
    .replace(/：/g, ":")
    // 불릿 이형자 — PDF 는 ◦(U+25E6), 데이터는 ○(U+25CB) 를 쓴다(2027_6월 실증)
    .replace(/[○◦◯⚬〇]/g, "○");
// 존재 대조용 — 공백 전부 제거
const flat = (s) => uni(s).replace(/[\s ]+/g, "").replace(/\[[A-E]\]/g, "");
const PDF_FLAT = flat(rawPdf);
// 어절 분리 대조용 — 줄바꿈만 제거(줄 끝에서 갈린 어절이 붙는다)
const PDF_JOIN = uni(rawPdf).replace(/\r?\n/g, "");
// 줄바꿈을 공백으로 바꾼 판 — 진짜 어절 경계였는지 가리는 데 쓴다.
const PDF_SPACE = uni(rawPdf).replace(/\r?\n/g, " ");

const F = { 치명: [], 중대: [], 경미: [], 미대조: [], 어절: [], 마커공백: 0, 운문행: 0 };
const add = (sev, set, q, type, detail) => F[sev].push({ set, q, type, detail });

function locate(s) {
  const n = flat(s);
  if (!n) return "empty";
  if (PDF_FLAT.includes(n)) return "full";
  const head = n.slice(0, Math.max(12, Math.floor(n.length * 0.6)));
  if (PDF_FLAT.includes(head)) return "head";
  return "miss";
}

// ④ 어절 분리 — 공백 하나를 지우면 원문과 맞고, 그대로면 안 맞는 지점
// 앞 글자가 마커·구두점이면 정상 공백. ㉮(U+327A) 계열은 ㉠(U+3220) 계열과 코드가 떨어져 있어 함께 넣는다.
const MARK_BEFORE = /[\u2460-\u2473\u3220-\u322d\u3260-\u327f\u24b6-\u24e9\u2160-\u217f\])"'.,?!:]/;
function wordSplit(txt, where, isVerse) {
  const s = uni(txt);
  for (let i = 1; i < s.length; i++) {
    if (s[i] !== " ") continue;
    const a = Math.max(0, i - 8),
      b = Math.min(s.length, i + 9);
    const w = s.slice(a, b);
    if (w.length < 12) continue;
    const n = w.slice(0, i - a) + w.slice(i - a + 1);
    if (!(PDF_JOIN.includes(n) && !PDF_JOIN.includes(w))) continue;
    // 줄바꿈이 진짜 어절 경계였으면 공백판에 그대로 있다 → 정상
    if (PDF_SPACE.includes(w)) { F.마커공백++; continue; }
    // 뒤 글자가 마커면 「… ㉠현실성」 처럼 마커 앞 공백이 관례다
    if (MARK_BEFORE.test(s[i + 1])) { F.마커공백++; continue; }
    if (MARK_BEFORE.test(s[i - 1])) { F.마커공백++; continue; }
    if (s[i + 1] === ":") { F.마커공백++; continue; } // 「이름 : 내용」 표기 관례
    if (isVerse) { F.운문행++; continue; }
    F.어절.push(`${where} 「…${w.trim()}…」`);
  }
}

const PLACEHOLDER = /\[(?:그래프 선택지|그림|도식|이미지|사진|표)(?!src)[^\]]*\]/g;

for (const sec of ["reading", "literature"]) {
  for (const s of data[YK][sec] || []) {
    const verseSet =
      (s.sents || []).filter((t) => t.sentType === "verse").length /
        ((s.sents || []).length || 1) >= 0.5;

    // 지문 문장
    for (const t of s.sents || []) {
      if (!t.t || flat(t.t).length < 8) continue;
      if (/^\[(도식|사진|그림|이미지)/.test(String(t.t).trim())) {
        F.미대조.push({ set: s.id, q: "-", type: "도식 플레이스홀더", detail: t.id });
        continue;
      }
      if (locate(t.t) === "miss")
        add("중대", s.id, "-", "지문 문장 원문 불일치", `${t.id}: ${String(t.t).slice(0, 40)}…`);
      wordSplit(t.t, `${s.id} 지문 ${t.id}`, verseSet || t.sentType === "verse");
    }

    for (const q of s.questions || []) {
      // 발문
      if (locate(q.t) === "miss")
        add("중대", s.id, q.id, "발문 원문 불일치", String(q.t).slice(0, 50));
      wordSplit(q.t, `${s.id} Q${q.id} 발문`, false);

      // <보기>
      if (q.bogi) {
        if (typeof q.bogi !== "string") {
          F.미대조.push({ set: s.id, q: q.id, type: `객체 bogi(${q.bogi.type || "?"})`, detail: "사람이 봐야 함" });
        } else {
          const c = q.bogi.replace(/\[[^\]]*src:[^\]]*\]/g, "");
          if (flat(c).length >= 10) {
            const r = locate(c);
            if (r === "miss") add("중대", s.id, q.id, "보기 원문 불일치", flat(c).slice(0, 50));
            else if (r === "head")
              add("치명", s.id, q.id, "보기 뒷부분 절단", `앞부분만 일치 (전체 ${flat(c).length}자)`);
          }
          wordSplit(q.bogi, `${s.id} Q${q.id} 보기`, false);
        }
      }

      for (const c of q.choices || []) {
        const t = c.t || "";
        if (/src:/.test(t)) { F.미대조.push({ set: s.id, q: q.id, type: "이미지 선지", detail: `선지${c.num}` }); continue; }
        if (/\[\[sym:/.test(t)) { F.미대조.push({ set: s.id, q: q.id, type: "sym 토큰 선지", detail: `선지${c.num}` }); continue; }
        if (/\|/.test(t)) { F.미대조.push({ set: s.id, q: q.id, type: "표 평면화 선지", detail: `선지${c.num}` }); continue; }
        if (locate(t) === "miss")
          add("중대", s.id, q.id, `선지[${c.num}] 원문 불일치`, t.slice(0, 45));
        wordSplit(t, `${s.id} Q${q.id} 선지${c.num}`, false);

        // ③ 선지 ↔ 해설 인용 대조
        for (const m of String(c.analysis || "").matchAll(/· '([^']{10,})'/g))
          if (!/[~…]/.test(m[1]) && !t.includes(m[1]))
            add("중대", s.id, q.id, `선지[${c.num}] 해설 인용이 선지에 없음`, m[1].slice(0, 45));
      }

      // ⑤ 플레이스홀더
      const blob = String(q.t || "") + " " + (typeof q.bogi === "string" ? q.bogi : "") + " " +
        (q.choices || []).map((c) => c.t).join(" ");
      for (const m of blob.match(PLACEHOLDER) || [])
        add("치명", s.id, q.id, "플레이스홀더 잔존", m);
    }
  }
}

console.log(`### ${YK}`);
console.log(`치명 ${F.치명.length} · 중대 ${F.중대.length} · 어절분리 후보 ${F.어절.length} · 미대조 ${F.미대조.length}`);
console.log(`  (마커 뒤 공백 ${F.마커공백}건 · 운문 행 ${F.운문행}건 — 정상 관례로 제외)`);
for (const sev of ["치명", "중대"]) {
  if (!F[sev].length) continue;
  console.log(`\n--- ${sev} ${F[sev].length}건 ---`);
  for (const f of F[sev]) console.log(`  ${f.set} Q${f.q} | ${f.type} | ${f.detail}`);
}
if (F.어절.length) {
  console.log(`\n--- 어절 분리 후보 ${F.어절.length}건 ---`);
  for (const x of F.어절) console.log(`  ${x}`);
}
if (F.미대조.length) {
  console.log(`\n--- 미대조 ${F.미대조.length}건 (레드팀 이관) ---`);
  const by = {};
  for (const f of F.미대조) (by[f.type] = by[f.type] || []).push(`${f.set} Q${f.q} ${f.detail}`);
  for (const [t, arr] of Object.entries(by)) console.log(`  ${t}: ${arr.length}건 — ${arr.slice(0, 4).join(" / ")}${arr.length > 4 ? " …" : ""}`);
}
