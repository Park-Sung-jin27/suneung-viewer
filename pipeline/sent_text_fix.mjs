// sent_text_fix.mjs — 본문 문장(sent.t)을 고치고 참조 3계층을 동시에 맞춘다 (발주 D-118 ①)
//
// D-102 계열 절차. 문장을 고치면 그 문장을 가리키는 것들이 함께 어긋나므로 한 번에 맞춘다:
//   ① sents[].t                       — 본문
//   ② cs_spans[].text                 — 형광펜 (text 매칭이라 옛 형태가 남으면 하이라이트가 죽는다)
//   ③ analysis 안 인용                 — 해설이 옛 형태로 인용하고 있으면 알린다(자동 치환은 하지 않는다)
//
// **원본 PDF 대조가 끝난 건만 SPEC 에 넣는다.** 게이트 메시지만 보고 넣지 않는다 —
// C_anchor 클래스는 원문·해설 어느 쪽이 결함인지 스스로 판별하지 못한다(D-116 실증).
//
// 안전장치 (하나라도 어긋나면 아무것도 쓰지 않는다):
//   · 찾을 문자열이 그 문장에 **정확히 한 번**만 나와야 한다
//   · 바꾼 뒤 길이 변화가 예상과 같아야 한다
//   · cs_spans 는 옛 형태를 품은 것만 골라 같은 치환을 적용한다
//
// 사용: node pipeline/sent_text_fix.mjs [--only <setId>] [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

// [yearKey, setId, sentId, 찾을 문자열, 바꿀 문자열, 근거]
const SPEC = [
  ["2024_9월", "r20249a", "r20249as12", "끄적 거리는", "끄적거리는",
    "원본 1면 PDF 에서 「끄적 거리는」 매치 rect 의 y 가 673.3 / 691.6 으로 **서로 다른 줄**이다 — "
    + "조판 줄바꿈이 추출 과정에서 공백으로 굳었다. 「끄적거리다」는 한 어절이다. "
    + "해설 Q2#1·Q2#4 는 이미 「끄적거리는」으로 인용하고 있어, 문장을 고치면 정합된다"],
  ["2024_9월", "l20249c", "l20249cs1", "누구 보다도", "누구보다도",
    "원본 10면 PDF 에서 매치 rect y 가 253.1 / 271.6 으로 **서로 다른 줄**이다 — 줄바꿈이 공백으로 굳었다. "
    + "「누구보다도」는 대명사 + 조사 '보다' + '도' 로 붙여 쓴다. 해설 Q28#3 은 이미 붙여 인용한다"],
  ["2024_9월", "r20249d", "r20249ds11", "직역을 얻고자", "직역*을 얻고자",
    "원본 4면 PDF 는 「직역*을 얻고자 하는 현상이 나타났다.」(y 560.7)이다 — 각주 마커 * 가 빠져 있었다. "
    + "각주부 r20249ds20 「*직역 : 신분에 따라 정해진 의무로서의 역할.」과 짝을 이룬다. "
    + "s12 의 「직역 명칭」에는 원본에도 * 가 없다(첫 출현에만 붙는다) — 그쪽은 건드리지 않는다"],

  // ── D-121 ① l20266b 마커 위치 오류 — 🔴 LIVE (심사관 승인) ──────────
  //   원본 8면과 데이터의 마커 자리가 서로 다르다.
  //     원본 y 719.6 「ⓐ만물초 가는 길이 칠십 리 왕복이요」   ← (가) 가사
  //     원본 y 176.7 「거리도 반은 솔밭 속에 묻히었다.」        ← 마커 없음
  //     원본 y 302.3 「거리에서 ⓑ바다로 나가는 길이 좋다.」
  //   데이터는 ⓐ 를 (나) 산문의 s48 에 붙이고, s29 에는 원본에 없는 ㉠ 을 넣었다.
  //   23번이 「ⓐ, ⓑ에 대한 이해」 문항이라 학생이 다른 갈래의 문장을 ⓐ 로 보고 푼다.
  ["2026_6월", "l20266b", "l20266bs29", "㉠ 만물초", "ⓐ만물초",
    "원본 8면 y 719.6 은 「ⓐ만물초 가는 길이 칠십 리 왕복이요」다. ㉠ 은 원본 어디에도 없다. "
    + "23번 정답 선지 #3 의 해설이 이미 「ⓐ '만물초 가는 길'은 화자가 '가려던' 길」이라 읽고 있어, "
    + "문장을 고치면 정답 해설과 정합된다"],
  ["2026_6월", "l20266b", "l20266bs48", "ⓐ 반은", "반은",
    "원본 8면 y 176.7 은 「거리도 반은 솔밭 속에 묻히었다.」로 마커가 없다. "
    + "여기 붙은 ⓐ 가 원본 ⓐ(만물초 가는 길)를 밀어낸 것이다. cs_span 4건이 이 옛 형태를 품고 있어 함께 맞춘다"],
  ["2026_6월", "l20266b", "l20266bs55", "ⓑ 바다로", "ⓑ바다로",
    "원본 8면 y 302.3 은 「거리에서 ⓑ바다로 나가는 길이 좋다.」로 마커와 본문이 붙어 있다. "
    + "위치는 맞고 공백만 다르다 — 원본 표기를 따른다"],

  // ── D-125 ② l20256a 각주 마커 누락 — 심사관 승인 ──────────────────
  //   원본 6면 y 1053.1 은 「진진지연*을 깊이 맺었더니」다. 각주 s6 「*진진지연(秦晉之緣): 혼인의 인연.」
  //   과 짝을 이뤄야 하는데 본문 쪽 * 가 빠져 있었다. r20249d s11 「직역*」과 같은 유형이다.
  ["2025_6월", "l20256a", "l20256as2", "진진지연을", "진진지연*을",
    "원본 6면 PDF y 1053.1 에서 「진진지연*을 깊이 맺었더니,」를 확인했다. 각주부 l20256as6 과 짝이다. "
    + "s2 안에 「진진지연」은 이 한 곳뿐이고, 각주 문장 s6 의 「*진진지연(秦晉之緣)」은 각주 표기라 건드리지 않는다"],

  // ── D-157 ① l20206a 앞부분 줄거리 오염 — 심사관 원본 PDF 대조 확정 ──────
  //   s1 이 같은 회차 l20206d(박경리 「토지」)의 줄거리였다. 제목·선지에 이어 세 번째 오염이다.
  //   문장 전문을 통째로 바꾼다. cs_ids 로 s1 을 가리키는 선지는 없어 재정박이 필요 없다.
  ["2020_6월", "l20206a", "l20206as1",
    "[앞부분 줄거리] 조준구와 아내 홍 씨는 서희가 물려받아야 할 최 참판가의 재산을 가로채고, 하인 삼수를 내세워 마을 사람들을 착취한다. 한편, 윤보는 의병 자금을 확보하기 위해 최 참판가 습격을 준비하는데 삼수가 찾아온다.",
    "[앞부분 줄거리] 조웅은 송나라 회복을 위해 태자를 구해 함께 위국으로 가던 중 서번국 병사가 매복한 함곡을 향한다.",
    "심사관 원본 PDF 대조 확정본. 현행 문면은 l20206d s1~s3 을 이어 붙인 것과 같다(줄거리 오염 축이 앞머리 25자로 적발). "
    + "본문은 조웅전이고 s22 가 「- 작자 미상, 「조웅전」 -」이라 줄거리만 남의 것이었다. "
    + "cs_ids 가 s1 을 참조하는 선지 0건이라 근거 재정박은 필요 없다"],

  // ── D-159 ① r2019b 마커 3개 본문 복원 — 심사관 원본 실측 확정 ──────────
  //   (가) 천변풍경 본문에 ㉠㉡㉢ 이 아예 없어 Q26 이 가리킬 자리가 없었다.
  //   quality_gate 가 MARKER_INTEGRITY_FAIL 로 잡던 3건이다.
  //   ★ 공백: 원본대로 **마커 좌우에 공백**. 전 데이터 실측상 마커 뒤 공백 663 / 붙임 639 로
  //     관례가 하나로 굳어 있지 않고, 앞 공백은 894 로 압도적이다(S-14).
  ["2019수능", "r2019b", "r2019bs7", "그러나 자동차의 문은", "그러나 ㉠ 자동차의 문은",
    "원본 432행 「그러나 ㉠ 자동차의 문은 유난히 소리 내어 닫히고」. s7 안에 이 어구는 한 곳뿐이다. "
    + "s7 의 cs_spans 2건은 전부 삽입 지점보다 뒤(「그는 실신한 사람같이…」·「깨닫지 못하고…」)라 영향이 없다"],
  ["2019수능", "r2019b", "r2019bs9", "또 한편 개천 하나를 건너", "또 ㉡ 한편 개천 하나를 건너",
    "원본 445행 「…또 ㉡ 한편 개천 하나를 건너 신전 집에서는」. s9 에 cs_spans 없음"],
  ["2019수능", "r2019b", "r2019bs13", "몇 명이 못 된다. 얼마 있다,", "몇 명이 못 된다. ㉢ 얼마 있다,",
    "원본 498행 「몇 명이 못 된다. ㉢ 얼마 있다, 원래의 신전은 술집으로 변하」. "
    + "Q26#5 의 cs_span 「얼마 있다, 원래의 신전은…」은 삽입 지점 바로 뒤에서 시작하므로 치환 후에도 그대로 부분 문자열로 남는다"],

  // ── D-168 ⑨ l2024d (나) 화암구곡 수 표시 복원 — 심사관 승인 ─────────────
  //   원본 2024수능 PDF 823~836행에 <제1수>·<제6수>·<제9수> 3개가 실재한다(추출 확인).
  //   제1수 → 제6수 → 제9수로 **건너뛴다** — 표시가 없으면 학생이 연속된 세 수로 오해한다.
  //   ★ 저장 방식: verse 문장 **끝**에 붙인다. 전 데이터 실측 verse/문장끝 36회 · workTag/단독 31회로
  //     관례가 둘로 갈리는데, 가장 가까운 선례인 l20199a(한거십팔곡 연시조)가 verse 끝 방식이다(S-14).
  //     원본도 각 수의 끝(오른쪽 정렬)이라 자리가 맞는다.
  ["2024수능", "l2024d", "l2024ds7", "너뿐인가 하노라", "너뿐인가 하노라 <제1수>",
    "원본 823~836행. s7 은 화암구곡 첫 수이고 문장 끝이 「…아마도 화암 풍경이 너뿐인가 하노라」다. "
    + "이 어구는 s7 안에 한 곳뿐이다. cs_spans 는 건드리지 않는다 — 근거 어구에 수 표시가 붙으면 형광펜이 그것까지 칠한다", { noSpanSync: true }],
  ["2024수능", "l2024d", "l2024ds8", "웃고 가리키나니", "웃고 가리키나니 <제6수>",
    "원본 823~836행. s8 은 제6수이고 끝이 「…초동과 목수(牧叟)는 웃고 가리키나니」다. "
    + "제1수 다음이 제6수라 **번호가 건너뛴다** — 표시가 없으면 연속으로 읽힌다", { noSpanSync: true }],
  ["2024수능", "l2024d", "l2024ds9", "자랑할 때 있으리라", "자랑할 때 있으리라 <제9수>",
    "원본 823~836행. s9 는 제9수이고 끝이 「두어라 야인 생애도 자랑할 때 있으리라」다. "
    + "cs_spans 는 건드리지 않는다(위와 같은 이유)", { noSpanSync: true }],

];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const norm = (s) => String(s).replace(/_/g, "");
let n = 0, bad = false;
console.log(`## 본문 문장 수리 ${APPLY ? "적용" : "DRY-RUN"} — ${SPEC.length}건\n`);

// 7번째 요소 opts — { noSpanSync: true } 면 cs_spans 를 건드리지 않는다.
//   문장 **끝에 메타 표시를 덧붙이는** 수리(예 연시조 <제N수>)에서는 동기화가 해롭다.
//   근거 어구는 그대로여야 하는데 동기화하면 형광펜이 수 표시까지 칠한다(D-168 ⑨ 에서 발견).
for (const [yk, sid, sentId, from, to, why, opts = {}] of SPEC) {
  if (ONLY && sid !== ONLY) continue;
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (f) { set = f; break; }
  }
  if (!set) { console.log(`  🔴 ${yk} ${sid} — 세트 없음`); bad = true; continue; }
  const sent = (set.sents || []).find((x) => String(x.id) === sentId);
  if (!sent) { console.log(`  🔴 ${sentId} — 문장 없음`); bad = true; continue; }
  const t = flat(sent.t);
  // 🔴 멱등 가드 — 이미 적용된 건은 건너뛴다.
  //   덧붙이기 수리(to 가 from 을 품음)는 두 번 돌면 「<제1수> <제1수>」처럼 두 번 붙는다.
  //   D-168 ⑨ 에서 실제로 그렇게 됐다 — 첫 실행이 쓰기까지 하고 되읽기에서만 실패했는데,
  //   그걸 「안 써졌다」로 읽고 다시 돌린 것이 원인이다.
  if (String(to).includes(String(from)) && t.includes(to)) {
    console.log(`  ⏭ ${yk} ${sid} ${sentId} — 이미 적용됨(${JSON.stringify(String(to).slice(-12))}), 건너뛴다`);
    continue;
  }
  const cnt = t.split(from).length - 1;
  if (cnt !== 1) { console.log(`  🔴 ${sentId} — ${JSON.stringify(from)} 가 ${cnt}번 나온다(1번이어야 함)`); bad = true; continue; }
  const nextT = t.replace(from, to);
  if (nextT.length - t.length !== to.length - from.length) {
    console.log(`  🔴 ${sentId} — 길이 변화가 예상과 다르다`); bad = true; continue;
  }

  // ② 그 문장을 가리키면서 옛 형태를 품은 cs_spans
  const spanFix = [];
  for (const q of set.questions || [])
    for (const c of q.choices || [])
      for (const sp of c.cs_spans || []) {
        if (norm(sp.sent_id) !== norm(sentId)) continue;
        const st = flat(sp.text);
        if (!st.includes(from)) continue;
        if (opts.noSpanSync) continue;   // 메타 표시 덧붙이기 — 근거 어구는 그대로 둔다
        spanFix.push([sp, st.replace(from, to), q.id, c.num]);
      }

  // ③ 해설이 옛 형태로 인용하고 있는지 — 알리기만 한다
  const anaOld = [];
  for (const q of set.questions || [])
    for (const c of q.choices || [])
      if (flat(c.analysis).includes(from)) anaOld.push(`Q${q.id}#${c.num}`);

  const i = t.indexOf(from);
  console.log(`  ${yk} ${sid} ${sentId}`);
  console.log(`     전: ${JSON.stringify(t.slice(Math.max(0, i - 24), i + from.length + 20))}`);
  console.log(`     후: ${JSON.stringify(nextT.slice(Math.max(0, i - 24), i + to.length + 20))}`);
  for (const [sp, fixed, qid, num] of spanFix)
    console.log(`     cs_span 동반 수정 Q${qid}#${num}: ${JSON.stringify(flat(sp.text).slice(0, 40))} → ${JSON.stringify(fixed.slice(0, 40))}`);
  if (!spanFix.length) console.log(`     cs_span: 옛 형태를 품은 span 없음`);
  if (anaOld.length) console.log(`     ⚠ 해설이 아직 옛 형태로 인용한다: ${anaOld.join(", ")} — 자동 치환하지 않는다, 판정 필요`);
  else console.log(`     해설: 이미 새 형태로 인용하고 있다 — 문장을 고치면 정합된다`);
  console.log(`     근거: ${why}`);

  if (APPLY) {
    sent.t = nextT;
    for (const [sp, fixed] of spanFix) sp.text = fixed;
  }
  n++;
}

if (bad) { console.log(`\n🔴 검증 실패가 있다 — 아무것도 쓰지 않았다`); process.exit(1); }
if (APPLY && n) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · ${n}건`);
  // 되읽어 확인한다 — 「적용」이라 찍고 안 써진 사고가 있었다(D-120). S-02
  const back = JSON.parse(fs.readFileSync(DATA, "utf8"));
  let miss = 0;
  for (const [yk, sid, sentId, from, to, , opts2 = {}] of SPEC) {
    // 🔴 **덧붙이기 수리**(to 가 from 을 품는 경우, 예 「…있으리라」 → 「…있으리라 <제9수>」)에서는
    //   from 이 문장에 그대로 남는 것이 정상이다. 「from 이 사라졌는가」로 보면 거짓 실패가 난다.
    //   D-168 ⑨ 에서 실제로 4건이 그렇게 걸렸다 — 데이터는 멀쩡한데 도구가 실패라고 찍었다.
    const append = String(to).includes(String(from));
    if (ONLY && sid !== ONLY) continue;
    let set = null;
    for (const sec of ["reading", "literature"]) {
      const f = (back[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
      if (f) { set = f; break; }
    }
    const sent = (set?.sents || []).find((x) => String(x.id) === sentId);
    if (!sent) continue;
    const t = flat(sent.t);
    if ((!append && t.includes(from)) || !t.includes(to)) { console.log(`  🔴 되읽기 실패: ${sentId} 본문`); miss++; }
    for (const q of set.questions || [])
      for (const c of q.choices || [])
        for (const sp of c.cs_spans || []) {
          if (norm(sp.sent_id) !== norm(sentId)) continue;
          if (!append && !opts2.noSpanSync && flat(sp.text).includes(from)) { console.log(`  🔴 되읽기 실패: Q${q.id}#${c.num} cs_span 에 옛 형태 잔존`); miss++; }
          if (!t.includes(flat(sp.text))) { console.log(`  🔴 되읽기 실패: Q${q.id}#${c.num} cs_span 이 문장에서 안 잡힌다`); miss++; }
        }
  }
  if (miss) { console.log(`
🔴 되읽기에서 ${miss}건이 어긋났다`); process.exit(1); }
  console.log(`  되읽기 검산 통과 — 본문·cs_span 정합`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
