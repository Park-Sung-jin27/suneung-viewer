// choice_text_restore.mjs — 발문·선지 본문을 원본 지면 표기로 되돌린다 (발주 D-119 ②)
//
// **원본을 눈으로 옮겨 적은 것만 넣는다.** 추정 금지(§13⑬).
// SPEC 의 각 문자열은 시험지 PDF 에서 행 단위로 읽어 이어 붙인 것이고, y 좌표를 함께 남긴다.
//
// 안전장치 (하나라도 어긋나면 아무것도 쓰지 않는다):
//   · 대상 문항·선지가 실재해야 한다
//   · 새 문자열이 기존과 달라야 한다(같으면 건너뛴다)
//   · 새 문자열에 범위 밖 글자가 없는지, 마커 개수가 기대와 같은지 센다
//   · 바꾼 뒤 그 선지를 가리키는 cs_spans 가 여전히 유효한지 확인한다
//
// 사용: node pipeline/choice_text_restore.mjs [--only <setId>] [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

// r20249b Q5 — 원본 2면. 마커 ㉮㉯㉰㉱ 가 「가·나·다·라·카」로 오치환되고 일부는 소실됐다.
//   「카」는 ㉮~㉱ 범위 밖 글자다. 본문 s19·s22·s23 의 ㉮㉯㉰㉱ 는 멀쩡하다.
const SPEC = [
  {
    yk: "2024_9월", setId: "r20249b", qId: 5,
    stem: "[A], [B]의 입장에서 ㉮～㉱에 대해 이해한 내용으로 적절하지 않은 것은?",
    stemY: "y 580.6 + 601.4",
    choices: {
      1: ["[A]의 입장에서, ㉮는 데이터 이동권 도입을 통해 ㉯의 데이터를 재사용할 수 있게 되었으므로 데이터 생성 비용을 줄일 수 있다고 보겠군.",
        "y 625.9 + 644.2 + 662.6"],
      2: ["[A]의 입장에서, 정보 주체가 데이터 이동을 요청하여 데이터를 전송받는 제3자가 ㉰라면, ㉰는 분쟁 없이 정보 주체의 데이터를 받게 되어 거래 비용을 줄일 수 있다고 보겠군.",
        "y 681.0 + 699.3 + 717.7"],
      3: ["[B]의 입장에서, ㉰가 ㉱와의 거래에 실패해 데이터를 수집하지 못하여 ㉰에 데이터 생성 비용이 발생하면, 데이터 관련 산업의 시장에 진입하기 어려워질 수 있다고 보겠군.",
        "y 736.1 + 754.5 + 772.8"],
      4: ["[A]와 달리 [B]의 입장에서, 정보 주체의 데이터가 ㉯에서 ㉱로 이동하여 집적·처리될수록 기업 간 공유나 유통이 위축될 수 있다고 보겠군.",
        "y 791.2 + 809.6 + 828.0 — 원본은 「집적․처리」(U+2024)이나 이 데이터의 관례 표기 「집적·처리」를 따른다"],
      5: ["[B]와 달리 [A]의 입장에서, ㉯는 ㉮로 데이터를 이동하여 경제적 이득을 취할 수 있으므로 데이터의 공유나 유통의 활성화에 기여할 수 있다고 보겠군.",
        "y 846.4 + 864.7 + 883.1"],
    },
    // 원본 5번에는 <보기>가 없다(발문 601.4 다음 바로 선지 625.9). 데이터의 bogi 는 별건 —
    // 지금은 건드리지 않고 보고만 한다.
    expectMarkers: { 1: "㉮㉯", 2: "㉰㉰", 3: "㉰㉱㉰", 4: "㉯㉱", 5: "㉯㉮" },
  },

  // ── D-120 ① r20266b Q7 — 🔴 LIVE 결함 ──────────────────────────────
  //   원본 3면 「7. (나)를 바탕으로 할 때, ㉮의 이유로 가장 적절한 것은?」(y 856.1)인데
  //   데이터는 ㉮ 가 ㉠ 으로 바뀌어 있었다. ㉠(s16, 절차주의 등장)과 ㉮(s35, 계약 우선)은
  //   내용이 전혀 다르다 — 학생이 엉뚱한 문장을 보고 풀게 된다.
  //   본문 마커는 정확하다(2면 ㉠ y=709.7 / ㉮ y=544.7). 5번 발문도 원본과 같다.
  {
    yk: "2026_6월", setId: "r20266b", qId: 7,
    stem: "(나)를 바탕으로 할 때, ㉮의 이유로 가장 적절한 것은?",
    stemY: "y 856.1 (3면)",
    choices: {},
    expectMarkers: {},
  },

  // ── D-120 ③ r20249d Q17 발문 — 원본 정본 원칙 ─────────────────────
  //   원본 6면 「17. ⓐ와 문맥상 의미가 가장 가까운 것은?」(y 891.2)인데
  //   데이터는 마커를 풀어 「굳어졌다와 문맥상…」으로 적었다. 의미 손실은 없었지만
  //   본문 s12 의 ⓐ 가 고아로 남는다 — 원본 표기로 되돌린다.
  {
    yk: "2024_9월", setId: "r20249d", qId: 17,
    stem: "ⓐ와 문맥상 의미가 가장 가까운 것은?",
    stemY: "y 891.2 (6면)",
    choices: {},
    expectMarkers: {},
  },

  // ── D-121 ② 발문 마커 소실 2건 — 🔴 LIVE (심사관 승인) ─────────────
  //   둘 다 발문 첫 글자가 통째로 빠졌다. 본문 마커는 정확하다.
  //   r20249d Q17 과 같은 유형이고 그 건은 D-120 에서 복원했다.
  {
    yk: "2022_6월", setId: "r20226b", qId: 9,
    stem: "ⓐ와 문맥상 의미가 가장 가까운 것은?",
    stemY: "y 890.7 (3면) — 본문 ⓐ찾고자 는 2면 y 599.9",
    choices: {},
    expectMarkers: {},
  },
  {
    yk: "2022_6월", setId: "r20226c", qId: 11,
    stem: "㉠에 대한 설명으로 적절하지 않은 것은?",
    stemY: "y 369.4 (4면) — 본문 ㉠울타리 는 4면 y 636.2",
    choices: {},
    expectMarkers: {},
  },

  // ── D-122 ③ r20249b Q5 bogi 삭제 (심사관 승인) ────────────────────
  //   원본 5번에는 <보기>가 없다(발문 y 601.4 다음 바로 선지 y 625.9).
  //   데이터의 bogi 는 「가·나·다·라」를 풀어 쓴 것인데 정의부터 본문과 어긋난다 —
  //   「다: … 데이터를 전송받는 제3자」라 해 놓고 본문 ㉰ 는 「데이터 보유량이 적은 신규 기업」이다.
  //   해설 5건을 같은 커밋에서 고치므로 지금 지워야 미아가 생기지 않는다.
  {
    yk: "2024_9월", setId: "r20249b", qId: 5,
    dropBogi: true,
    choices: {},
    expectMarkers: {},
  },

  // ── D-122 ④ 네모 상자 표시 소실 2건 — 🔴 LIVE ──────────────────────
  //   원본 지면은 발문의 지시 대상을 **네모 상자**로 감싼다. 텍스트 추출로는 보이지 않아
  //   벡터(get_drawings)로 확인했다. 데이터는 상자 자리에 공백을 남기거나 본문 구절을 덧붙였다.
  //   이 데이터의 관례 표기는 작은따옴표다(발문 73건 대 낫표 3건, 낫표는 책 제목용).
  //   예: 2026수능 l2026c Q29 「'독가촌'에 대한 설명으로 가장 적절한 것은?」
  {
    yk: "2025_9월", setId: "l20259b", qId: 23,
    stem: "'태반'과 '생가'에 대한 설명으로 가장 적절한 것은?",
    stemY: "y 161.0 (9면) — 상자 x 112.5~138.4 「태반」 · x 155.0~180.9 「생가」, 글자 단위로 확인",
    choices: {},
    expectMarkers: {},
  },
  {
    yk: "2024_6월", setId: "l20246d", qId: 32,
    stem: "'아픈 가락'에 대한 이해로 가장 적절한 것은?",
    stemY: "y 450.8 (12면) — 상자 x 112.5~166.7 안이 「아픈 가락」 5글자, 「에」는 x 167.9 로 상자 밖. "
      + "데이터의 앞말 「흐느끼는 이 피리의」는 원본 발문에 없다(본문 11면 y 575.6 구절을 끌어온 것)",
    choices: {},
    expectMarkers: {},
  },

  // ── D-163 ① r2019b Q22 발문 인용부호 복원 — 심사관 판정 ──────────────
  //   추출 단계에서 작은따옴표 두 짝이 떨어져 나가고 그 자리에 공백만 남았다(「소년 에」).
  //   곧은 따옴표를 쓴다 — 발문 실측 곧은 188 : 둥근 32 로 관례가 곧은 쪽이다(S-03·S-14).
  //   발문만 고친다. 선지·해설·cs_ids 는 이 어구를 인용하지 않아 영향이 없다.
  {
    yk: "2019수능", setId: "r2019b", qId: 22,
    stem: "(가)의 '이발소 소년'에 대한 이해로 가장 적절한 것은?",
    stemY: "원본 2019수능 시험지 「22. (가)의 ‘이발소 소년’에 대한 이해로 가장 적절한 것은?」 (D-145 pdf-parse 추출 확인)",
    choices: {},
    expectMarkers: {},
  },

];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const flat = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
// 오치환의 흔적 — 단독으로 쓰인 「카」(원본 ㉮~㉱ 어디에도 대응하지 않는 글자)
const OUT_OF_RANGE = /(?<![가-힣])카(?![가-힣])/;
let n = 0, bad = false;
console.log(`## 발문·선지 원본 복원 ${APPLY ? "적용" : "DRY-RUN"} — ${SPEC.length}건\n`);

for (const S of SPEC) {
  if (ONLY && S.setId !== ONLY) continue;
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[S.yk]?.[sec] || []).find((x) => (x.setId || x.id) === S.setId);
    if (f) { set = f; break; }
  }
  if (!set) { console.log(`  🔴 ${S.yk} ${S.setId} — 세트 없음`); bad = true; continue; }
  const q = (set.questions || []).find((x) => String(x.id) === String(S.qId));
  if (!q) { console.log(`  🔴 Q${S.qId} — 문항 없음`); bad = true; continue; }

  console.log(`  ${S.yk} ${S.setId} Q${S.qId}`);
  if (S.stem) {
    console.log(`     발문 전: ${JSON.stringify(flat(q.t))}`);
    console.log(`     발문 후: ${JSON.stringify(S.stem)}   (원본 ${S.stemY})`);
    if (flat(q.t) !== S.stem) { if (APPLY) q.t = S.stem; n++; }
    else console.log(`     (이미 같다 — 건너뜀)`);
  }
  if (S.dropBogi) {
    if (!q.bogi) console.log(`     ⚠ bogi 가 이미 없다, 건너뜀`);
    else {
      console.log(`     bogi 삭제 (원본에 <보기>가 없다):`);
      console.log(`       ${JSON.stringify(flat(q.bogi))}`);
      if (APPLY) delete q.bogi;
      n++;
    }
  }

  for (const [num, [txt, why]] of Object.entries(S.choices)) {
    const c = (q.choices || []).find((x) => String(x.num) === String(num));
    if (!c) { console.log(`  🔴 #${num} — 선지 없음`); bad = true; continue; }
    const got = [...txt.matchAll(/[㉮-㉱]/g)].map((m) => m[0]).join("");
    const want = S.expectMarkers[num];
    if (got !== want) { console.log(`  🔴 #${num} — 마커가 ${got || "없음"} 인데 ${want} 이어야 한다`); bad = true; continue; }
    if (OUT_OF_RANGE.test(txt)) { console.log(`  🔴 #${num} — 범위 밖 글자가 남아 있다`); bad = true; continue; }
    console.log(`     #${num} 전: ${JSON.stringify(flat(c.t))}`);
    console.log(`     #${num} 후: ${JSON.stringify(txt)}`);
    console.log(`          원본 ${why}`);
    // 이 선지의 cs_spans 는 지문 문장을 가리킨다 — 선지 본문 변경과 무관하지만 확인해 둔다
    for (const sp of c.cs_spans || []) {
      const st = (set.sents || []).find((x) => String(x.id) === String(sp.sent_id));
      const okSpan = st && flat(st.t).includes(flat(sp.text));
      if (!okSpan) { console.log(`  🔴 #${num} cs_span 이 문장에서 안 잡힌다: ${sp.sent_id}`); bad = true; }
    }
    if (APPLY) c.t = txt;
    n++;
  }

  if (q.bogi && !S.dropBogi) {
    console.log(`     ⚠ bogi 가 있다 — 원본 5번에는 <보기>가 없다(발문 601.4 다음 바로 선지 625.9).`);
    console.log(`       ${JSON.stringify(flat(q.bogi).slice(0, 90))}`);
    console.log(`       **건드리지 않았다.** 삭제 여부는 판정 사항이다.`);
  }
}

if (bad) { console.log(`\n🔴 검증 실패가 있다 — 아무것도 쓰지 않았다`); process.exit(1); }
if (APPLY && n) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · 변경 ${n}건`);
  // 되읽어 확인한다 — 「적용」이라 찍고 안 써진 사고가 있었다(D-120: n 이 선지만 셌다)
  const back = JSON.parse(fs.readFileSync(DATA, "utf8"));
  let miss = 0;
  for (const S of SPEC) {
    if (ONLY && S.setId !== ONLY) continue;
    let set = null;
    for (const sec of ["reading", "literature"]) {
      const f = (back[S.yk]?.[sec] || []).find((x) => (x.setId || x.id) === S.setId);
      if (f) { set = f; break; }
    }
    const q = (set?.questions || []).find((x) => String(x.id) === String(S.qId));
    if (!q) continue;
    if (S.stem && flat(q.t) !== S.stem) { console.log(`  🔴 되읽기 실패: ${S.setId} Q${S.qId} 발문`); miss++; }
    if (S.dropBogi && q.bogi) { console.log(`  🔴 되읽기 실패: ${S.setId} Q${S.qId} bogi 잔존`); miss++; }
    for (const [num, [txt]] of Object.entries(S.choices)) {
      const c = (q.choices || []).find((x) => String(x.num) === String(num));
      if (c && flat(c.t) !== txt) { console.log(`  🔴 되읽기 실패: ${S.setId} Q${S.qId}#${num}`); miss++; }
    }
  }
  if (miss) { console.log(`
🔴 되읽기에서 ${miss}건이 반영되지 않았다`); process.exit(1); }
  console.log(`  되읽기 검산 통과`);
}
if (APPLY && !n) console.log(`
  변경할 것이 없었다 — 파일을 쓰지 않았다`);
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
