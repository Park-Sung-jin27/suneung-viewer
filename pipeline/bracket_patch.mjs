// bracket_patch.mjs — [A]~[F] 구간을 annotations.bracket 으로 정박 (발주 D-104 ①)
//
// **자동 생성 금지.** 범위는 원본 지면을 눈으로 판독해 확정한 것만 넣는다.
// 「마커 다음부터 다음 마커 직전까지」로 추론하면 오정박이 난다 —
// l2019b [D] 가 반례다(마커 다음 s25, 다음 마커 직전 s32, 실제는 s25~s27).
//
// 세트가 확정될 때마다 SPEC 에 한 줄씩 추가하고 세트 단위로 패치·push 한다.
//
// 사용: node pipeline/bracket_patch.mjs [--only <setId>] [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data-source/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

// 판독 확정분. [세트, PDF 면수, [라벨, sentFrom, sentTo, 시작 행 요약]...]
const SPEC = [
  ["2019수능", "l2019b", "16면", [
    ["A", "l2019bs18", "l2019bs18", "그중에 전승산이 글 쓰는 양(樣) 바라보고"],
    ["B", "l2019bs19", "l2019bs22", "필담(筆談)으로 써서 뵈되…"],
    ["C", "l2019bs23", "l2019bs24", "내 웃고 써서 뵈되…"],
    ["D", "l2019bs25", "l2019bs27", "승산이 다시 하되…"],
    ["E", "l2019bs33", "l2019bs37", "놀랍고 어이없어 종이에 써서 뵈되…"],
  ]],
  // 🔴 기존 bracket 4개(A·B·D·E)가 **(가) 유치환 「채전」의 시행**(l2023ds9~12)을
  //    가리키고 있었다. 원본 21면 판독 결과 [A]~[F] 는 전부 **(나) 나희덕
  //    「음지의 꽃」** 에 있다. (가) 지면에는 구간 표시가 하나도 없다.
  //    그래서 [C][F] 추가가 아니라 **6개 전부 재정박**한다(REPLACE).
  ["2023수능", "l2023d", "21면", [
    ["A", "l2023ds20", "l2023ds21", "우리는 썩어 가는 참나무 떼,"],
    ["B", "l2023ds24", "l2023ds25", "함께 썩어 갈수록"],
    ["C", "l2023ds26", "l2023ds27", "이윽고 잠자던 홀씨들 일어나"],
    ["D", "l2023ds29", "l2023ds31", "우리는 서서히 썩어 가지만"],
    ["E", "l2023ds33", "l2023ds34", "산비탈에 구르는 낙엽으로도"],
    ["F", "l2023ds35", "l2023ds36", "덮을 길 없는 우리의 몸을"],
  ], "REPLACE"],
  ["2015수능A", "l2015b", "12면", [
    ["A", "l2015bs3", "l2015bs5", "심신이 황홀하여 죽장을 짚고 월령산 조대로…"],
    ["B", "l2015bs21", "l2015bs22", "생이 동자를 따라 들어가니 청산에 불이 명랑하고…"],
  ]],
  ["2015수능A", "l2015d", "14면", [
    ["A", "l2015ds33", "l2015ds35", "그 눈동자는 띠룩띠룩 애원하듯 원망하듯…"],
    ["B", "l2015ds43", "l2015ds43", "물동이를 이고 치마꼬리에 그 빨간 손을 씻으며…"],
  ]],
  ["2018수능", "l2018a", "7면", [
    ["A", "l2018as32", "l2018as35", "시는 인간의 삶을 반영한다."],
  ]],
  ["2018수능", "l2018c", "12면", [
    ["A", "l2018cs60", "l2018cs65", "잎이 빳빳하고도 오히려 영롱(玲瓏)하다 — 시조 2수"],
  ]],
  ["2020수능", "l2020c", "12~13면", [
    ["A", "l2020cs12", "l2020cs12", "'내가 재상가의 귀한 몸으로 유생과 백년가약을…'"],
    ["B", "l2020cs16", "l2020cs16", "\"낭군은 부질없는 말씀 마옵소서…\""],
  ]],
  ["2021수능", "r2021b", "10면", [
    ["A", "r2021bs12", "r2021bs19", "예약은 예약상 권리자가 가지는 권리의 법적 성질에 따라…"],
  ]],
  // 🔴 기존 3개 전부 오정박이었다 (l2023d 와 같은 유형).
  //    A:s1~s3   → (가) 표지부터 제1수 첫 행까지    실제는 제1수~제2수
  //    B:s8~s8   → (가) 제2수 첫 행               실제는 (나) 「지수정가」
  //    C:s21~s24 → (나) 시행                     실제는 (다) 「겸재의 빛」 산문
  //    [B] 는 심사관 확정값, [A]·[C] 는 원본 8면 판독.
  ["2023수능", "l2023b", "8면", [
    ["A", "l2023bs3", "l2023bs10", "이런들 어떠하며 저런들 어떠하료 — 제1수~제2수"],
    ["B", "l2023bs20", "l2023bs22", "옛 길을 새로 내고 작은 연못 파서 —(심사관 확정값)"],
    ["C", "l2023bs54", "l2023bs57", "먼 산을 그릴 때 그는 그 산과 인간 사이의 거리를…"],
  ], "REPLACE"],

  // ── D-105 ③ 접두 6세트 ──────────────────────────────────────────────
  // 이 6세트는 bracket 이 하나도 없고 본문 선두 "[A] " 접두만 남아 있었다.
  // 접두는 시작점만 보여 주고 구간 끝이 없다 → 정박과 접두 제거를 한 커밋에서 함께 한다(STRIP).
  //
  // 범위는 **PDF 벡터선 좌표**로 확정했다. 조판 규칙(l20276d 3구간으로 역산, 화면 판독과 일치):
  //   상단 가로획 y = 첫 포함 행 y0 + 4.2~4.3
  //   하단 가로획 y = 마지막 포함 행 y0 + 5.4~8.0   (그 행 글자 높이 '안'에 든다)
  //   [X] 라벨 자리에서 세로선이 한 번 끊긴다 — 같은 x 조각은 하나로 잇는다.
  // 코덱스 C-4 회신 9마커 중 2건이 1행 짧았다(l20276a [A] · l20276d [A]) — 아래는 재판독 확정값.
  ["2024수능", "r2024a", "1면", [
    ["A", "r2024as4", "r2024as10", "초인지는 글을 읽기 시작한 후… ~ 방법을 사용할 수 있다. (가로획 362.1 / 603.0)"],
  ], "STRIP"],
  ["2024_9월", "r20249b", "2면", [
    ["A", "r20249bs16", "r20249bs20", "데이터 이동권의 법제화로… ~ 관련 산업이 활성화된다. (695.6 / 862.3)"],
    ["B", "r20249bs21", "r20249bs23", "한편, 정보 주체가… ~ 독점화가 강화될 수 있다. (879.4 / 1009.2)"],
  ], "STRIP"],
  ["2025_6월", "r20256d", "5면", [
    ["A", "r20256ds31", "r20256ds40", "'표절은 나쁘다.'라는 문장은… ~ 지닌다. (420.4 / 734.0)"],
  ], "STRIP"],
  // 🔴 C-4 는 「옳지!」(s50)까지라 했으나 하단 가로획 181.6 은 s51 행(y0 177.1) 안이다 → s51 포함.
  //    6면 끝 ~ 7면 머리에 걸친다. 6면 세로선은 본문 끝(1066.2)까지 닫히지 않고 이어진다.
  ["2027_6월", "l20276a", "6~7면", [
    ["A", "l20276as40", "l20276as51", "“안 되지, 안 돼!” ~ 삼바우는 궁둥이를 탁 치고… (904.9 / 181.6)"],
  ], "STRIP"],
  ["2027_6월", "l20276c", "10면", [
    ["A", "l20276cs31", "l20276cs50", "이때 도적이 재물을 훔쳐… ~ 못하리로소이다.” (735.8 / 182.9, 좌→우단)"],
  ], "STRIP"],
  // 🔴 C-4 는 [A] 를 2행으로 봤으나 하단 가로획 256.3 은 s4 행(y0 250.2) 안이다 → 3행.
  ["2027_6월", "l20276d", "11면", [
    ["A", "l20276ds2", "l20276ds4", "얼음 위에 댓잎 자리… ~ 정 둔 오늘 밤 더디 새오시라 (217.7 / 256.3)"],
    ["B", "l20276ds5", "l20276ds7", "경경 고침상에… ~ 소춘풍하도다 (291.2 / 329.8)"],
    ["C", "l20276ds8", "l20276ds10", "넋이라도 임과 한데… ~ 어기신 이가 뉘러시니잇가 (364.7 / 403.3)"],
  ], "STRIP"],
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
let touched = 0;
console.log(`## bracket 정박 패치 ${APPLY ? "적용" : "DRY-RUN"}\n`);

for (const [yk, sid, page, items, mode] of SPEC) {
  if (ONLY && sid !== ONLY) continue;
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[yk]?.[sec] || []).find((x) => x.id === sid);
    if (f) { set = f; break; }
  }
  if (!set) { console.log(`  🔴 ${yk} ${sid} — 세트 없음`); continue; }

  const ids = new Set((set.sents || []).map((x) => x.id));
  const idx = (id) => (set.sents || []).findIndex((x) => x.id === id);
  const existing = (set.annotations || []).filter((a) => a && a.type === "bracket");
  if (mode === "REPLACE" && existing.length) {
    console.log(`  🔁 ${sid} — 기존 bracket ${existing.length}개를 폐기하고 다시 넣는다 (오정박)`);
    for (const a of existing)
      console.log(`       버림: [${a.label}] ${a.sentFrom}~${a.sentTo}`);
  }
  const have = mode === "REPLACE" ? new Set() : new Set(existing.map((a) => a.label));
  const add = [];
  let bad = false;
  for (const [label, from, to, head] of items) {
    if (have.has(label)) { console.log(`  ⚠ ${sid} [${label}] — 이미 bracket 있음, 건너뜀`); continue; }
    if (!ids.has(from) || !ids.has(to)) { console.log(`  🔴 ${sid} [${label}] — 문장 id 없음 (${from} / ${to})`); bad = true; continue; }
    if (idx(from) > idx(to)) { console.log(`  🔴 ${sid} [${label}] — from 이 to 보다 뒤다`); bad = true; continue; }
    add.push({ type: "bracket", label, sentFrom: from, sentTo: to });
    const n = idx(to) - idx(from) + 1;
    console.log(`  ${yk} ${sid} [${label}] ${from} ~ ${to}  (${n}행) — ${head}`);
  }
  if (bad) { console.log(`  🔴 ${sid} — 검증 실패, 이 세트는 건너뛴다`); continue; }
  if (!add.length) continue;
  console.log(`     근거: 원본 ${page} 지면 판독`);

  // STRIP — 본문 선두 "[X] " 접두 제거. 정박과 **같은 커밋**에서 원자 처리한다(발주 D-105 ③).
  // 제거는 「그 라벨의 bracket sentFrom 과 문장 id 가 일치할 때」만 한다. 그 밖의 접두는 손대지 않고 알린다.
  const strip = [];
  if (mode === "STRIP") {
    const startOf = new Map(add.map((a) => [a.label, a.sentFrom]));
    for (const x of set.sents || []) {
      const t = String(x.t ?? "");
      const m = t.match(/^\s*\[([A-F])\]\s*/);
      if (!m) continue;
      if (startOf.get(m[1]) !== x.id) {
        console.log(`  🔴 ${sid} ${x.id} — 접두 [${m[1]}] 인데 그 구간 시작(${startOf.get(m[1]) ?? "없음"})이 아니다. 제거하지 않는다`);
        bad = true;
        continue;
      }
      strip.push([x, t.slice(m[0].length)]);
      console.log(`     접두 제거 ${x.id}: "${m[0]}" 삭제 → ${JSON.stringify(t.slice(m[0].length, m[0].length + 34))}`);
    }
    if (!strip.length) console.log(`  ⚠ ${sid} — STRIP 인데 접두가 없다`);
  }
  if (bad) { console.log(`  🔴 ${sid} — 접두 검증 실패, 이 세트는 건너뛴다`); continue; }

  if (APPLY) {
    const keep = mode === "REPLACE"
      ? (set.annotations || []).filter((a) => !(a && a.type === "bracket"))
      : (set.annotations || []);
    set.annotations = [...keep, ...add];
    for (const [x, t] of strip) x.t = t;
    touched += add.length;
  }
}

if (APPLY && touched) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · bracket ${touched}개 추가`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
