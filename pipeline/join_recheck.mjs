// join_recheck.mjs — 문항 영역 「붙임」 처리 전수 재검 (발주 D-101 ③)
//
// ■ 원인 규명
//   1차 판별(newline_fix)은 「PDF 줄 끝에 공백이 없으면 어절 중간 절단」으로 단정했다.
//   그런데 PyMuPDF 가 이 PDF 를 **줄마다 별도 블록**으로 쪼갠다(2016_6월B 기준 96%).
//   블록 마지막 줄은 렌더 텍스트가 공백으로 끝나지 않으므로, 어절 경계에서도
//   `sp=false` 가 나온다. 발문이 여기 걸렸다 — "적절하지 않은" + "것은?" → "않은것은".
//
//   기하(남은 여백 vs 다음 글자 폭)도 근거가 못 된다. 양쪽 정렬이라 모든 줄이
//   우측 경계에 닿아 gap 이 3~4pt 로 같다(공백이어야 할 자리도, 붙임이어야 할 자리도).
//
//   → PDF 에서 얻을 수 있는 신뢰 가능한 근거는 하나뿐이다:
//        **줄 끝에 공백이 있으면 어절 경계**(반대는 성립하지 않는다).
//     그 외는 한국어 어법으로 판정한다.
//
// ■ 어법 규칙 (앞 조각 A ⏎ 뒤 조각 B)
//   ① B 가 조사/어미로 시작 → 붙임 (조사·어미는 앞말에 붙여 쓴다)
//   ② A 가 조사/어미로 끝남 → 공백 (어절이 완결됐다)
//   ③ 그 외 → 판별 불가. 손대지 않고 목록으로 남긴다.
//
// 사용: node pipeline/join_recheck.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const STEP3 = path.join(ROOT, "pipeline/reextract/step3");
const BAK = path.join(ROOT, "pipeline/reextract/_backup_20260824");
const APPLY = process.argv.includes("--apply");
const W = (s) => String(s).replace(/\s/g, "");

// ── 규칙은 **오탐이 없는 것만** 남긴다 ──
//   폐기한 규칙: 「앞 조각이 조사·어미로 끝남 → 공백」.
//   1글자 어미(다·고·는·은·이…)가 명사 끝 음절과 겹쳐 오탐이 쏟아졌다
//   (실측 개악: 아름다|움을 → "아름다 움을", 과|제는 → "과 제는",
//    지|연되어 → "지 연되어", 서서|히 → "서서 히").

// ① 뒤 조각이 조사·어미로 시작하면 앞말에 붙는다 — 가장 안전한 규칙
const HEAD_ATTACH = [
  "을", "를", "이", "가", "은", "는", "에", "의", "와", "과", "로", "으로", "도", "만",
  "께", "에게", "한테", "부터", "까지", "마다", "조차", "라도", "이나", "든지",
  "이라", "라고", "이라고", "이며", "처럼", "보다", "밖에",
  "다", "고", "서", "니", "며", "면", "지", "게", "기", "음", "듯", "자", "라",
  "았", "었", "겠", "니까", "는데", "지만", "면서", "거늘", "더니", "구나", "군", "네",
  "라면야", "리오", "소", "요", "습니다",
];
// ② 뒤 조각이 **의존명사**로 시작하면 앞말과 띄어 쓴다 (한글 맞춤법 제42항)
const BOUND_NOUN = [
  // 1글자 의존명사(수·바·리·데·터)는 **뒤에 조사가 붙은 형태**로만 인정한다.
  // 그냥 「수」로 보면 "완|수한다" 를 "완 수한다" 로 개악한다.
  "것은", "것이", "것을", "것도", "것으로", "것과", "것만", "것",
  "때문", "수 있", "수가", "수는", "수도", "바가", "바는", "뿐이", "뿐만",
  "만큼", "대로", "나위", "따름",
];
// ③ 앞 조각이 **오탐 없는 조사**로 끝나면 어절이 완결됐다.
//    어간 끝 음절로 거의 쓰이지 않는 것만 골랐다(이·가·은·는·에·도 등은 제외).
//    「과·와·께」는 뺐다 — "많다. 과|제는" 을 "과 제는" 으로 개악했다.
const TAIL_SAFE = ["를", "의", "에서", "에게", "부터", "까지", "처럼", "밖에", "으로",
  "것은", "것이", "것을", "것도"];   // 의존명사+조사는 어절이 완결된 형태

const rows = [];
const decide = (a, b) => {
  const A = W(a), B = W(b);
  if (!A || !B) return { sp: null, why: "조각이 비었다" };
  // ① 조사·어미로 시작 → 붙임 (다른 어떤 규칙보다 먼저 본다)
  for (const h of [...HEAD_ATTACH].sort((x, y) => y.length - x.length))
    if (B.startsWith(h)) return { sp: false, why: `뒤 조각이 조사·어미 「${h}」로 시작` };
  // ② 의존명사로 시작 → 공백
  for (const n of [...BOUND_NOUN].sort((x, y) => y.length - x.length))
    if (B.startsWith(n)) return { sp: true, why: `뒤 조각이 의존명사 「${n}」로 시작` };
  // ③ 오탐 없는 조사로 끝남 → 공백
  for (const t of [...TAIL_SAFE].sort((x, y) => y.length - x.length))
    if (A.endsWith(t)) return { sp: true, why: `앞 조각이 조사 「${t}」로 끝남` };
  // ④ 앞 조각의 **마지막 어절**이 용언 관형형(~한/된/는/운/던)이고 뒤가 조사·어미가
  //    아니면 관형어+체언이므로 띄어 쓴다.
  //    · 「인」은 뺐다 — 명사 끝 음절로 흔하다("주인|공의" → "주인 공의" 개악).
  //    · 마지막 **어절**이 3글자 이상일 때만 본다. 조각 전체 길이로 보면
  //      "있다. 한|편," 처럼 1글자 어절을 관형형으로 오인한다.
  {
    const lastWord = String(a).trim().split(/\s+/).pop() || "";
    if (lastWord.length >= 3 && /[한된는운던]$/.test(lastWord))
      return { sp: true, why: `앞 어절 「${lastWord}」이 관형형` };
  }
  return { sp: null, why: "규칙으로 판별 불가" };
};

// ── 백업에서 「문항 영역의 줄바꿈 자리」를 되짚는다 ──
const targets = [];   // {yk, setId, where, aFrag, bFrag}
for (const d of fs.readdirSync(STEP3)) {
  const bp = path.join(BAK, `${d}_step4.json`);
  if (!fs.existsSync(bp)) continue;
  const a = JSON.parse(fs.readFileSync(bp, "utf8"));
  for (const s of [...(a.reading || []), ...(a.literature || [])])
    for (const q of s.questions || []) {
      const items = [[`Q${q.id}.t`, q.t]];
      if (typeof q.bogi === "string") items.push([`Q${q.id}.bogi`, q.bogi]);
      for (const c of q.choices || []) items.push([`Q${q.id}#${c.num}`, c.t]);
      for (const [where, v] of items) {
        const t = String(v ?? "");
        if (!t.includes("\n")) continue;
        const parts = t.split("\n");
        for (let i = 0; i < parts.length - 1; i++)
          targets.push({ yk: d, setId: s.id, where, aFrag: parts[i], bFrag: parts[i + 1] });
      }
    }
}

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const getText = (yk, setId, where) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => x.id === setId);
    if (!s) continue;
    const m = where.match(/^Q(\d+)(?:\.(\w+)|#(\d+))?$/);
    const q = (s.questions || []).find((x) => String(x.id) === m[1]);
    if (!q) return null;
    if (m[3] !== undefined) {
      const c = (q.choices || []).find((x) => String(x.num) === m[3]);
      return c ? { get: () => String(c.t ?? ""), set: (v) => { c.t = v; } } : null;
    }
    if (m[2] === "bogi") {
      if (typeof q.bogi === "string") return { get: () => q.bogi, set: (v) => { q.bogi = v; } };
      return null;
    }
    return { get: () => String(q.t ?? ""), set: (v) => { q.t = v; } };
  }
  return null;
};

let fixed = 0, ok = 0, unknown = 0;
const changes = [];
for (const t of targets) {
  const ref = getText(t.yk, t.setId, t.where);
  if (!ref) continue;
  const cur = ref.get();
  const aT = W(t.aFrag).slice(-6), bH = W(t.bFrag).slice(0, 6);
  if (aT.length < 3 || bH.length < 3) continue;
  const cw = W(cur);
  const at = cw.indexOf(aT + bH);
  if (at < 0) continue;
  const map = [];
  for (let i = 0; i < cur.length; i++) if (!/\s/.test(cur[i])) map.push(i);
  const pos = map[at + aT.length - 1];
  const isSp = /\s/.test(cur.slice(pos + 1, pos + 2));
  if (isSp) { ok++; continue; }               // 이미 공백 — 재검 대상 아님
  const d = decide(t.aFrag, t.bFrag);
  if (d.sp === null) {
    unknown++;
    rows.push({ ...t, verdict: "판별 불가", why: d.why });
    continue;
  }
  if (d.sp === false) { ok++; continue; }     // 붙임이 맞다
  // 공백이어야 하는데 붙어 있다 → 고친다
  const out = cur.slice(0, pos + 1) + " " + cur.slice(pos + 1);
  if (APPLY) ref.set(out);
  fixed++;
  changes.push({ yk: t.yk, setId: t.setId, where: t.where, why: d.why,
    ctx: out.slice(Math.max(0, pos - 22), pos + 24).replace(/\n/g, "⏎") });
}

console.log(`## 문항 영역 붙임 재검 ${APPLY ? "적용" : "DRY-RUN"}`);
console.log(`   대상 줄바꿈 자리 ${targets.length}\n`);
console.log(`### 공백으로 교정 — ${fixed}건`);
for (const c of changes) console.log(`  [${c.yk}] ${c.setId} ${c.where} — ${c.why}\n     …${c.ctx}…`);
console.log(`\n### 붙임 유지(규칙상 정상) ${ok}건 · 판별 불가 ${unknown}건`);
for (const r of rows.slice(0, 40))
  console.log(`  ⚠ [${r.yk}] ${r.setId} ${r.where}\n     …${r.aFrag.slice(-18)}▸${r.bFrag.slice(0, 18)}…`);

if (APPLY && fixed) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
