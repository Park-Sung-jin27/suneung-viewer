// inline_marker_strip.mjs — 문장 중간에 섞여 든 [A]~[F] 인라인 마커를 건별로 지운다 (발주 D-105 ②)
//
// **일괄 금지.** 원본 지면에 그 마커가 없다는 것을 확인한 건만 SPEC 에 넣는다.
// 심사관 전수 스캔 25건/14세트 중, 판정이 끝난 건만 여기 들어온다.
//
// 지우기 전에 그 문장을 가리키는 cs_spans 의 text 를 함께 검사한다.
// span 은 문자 오프셋이 아니라 text+occurrence 로 잡히므로, text 안에 마커가
// 들어 있지 않으면 하이라이트가 밀리지 않는다. 들어 있으면 멈춘다(조용한 실패 금지).
//
// 사용: node pipeline/inline_marker_strip.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/data/all_data_204.json");
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

// [yearKey, setId, sentId, 지울 문자열, 판정 근거]
//
// 문장 선두의 "[X] " 접두도 여기서 다룬다 — bracket 이 이미 정박돼 있고
// 접두만 남은 경우다(bracket_patch.mjs 의 STRIP 은 접두 문장 id 가 그 구간의
// sentFrom 과 같을 때만 쓴다. 아래 l2023d 2건은 그 조건에 맞지 않는다).
const SPEC = [
  ["2023수능", "l2023b", "l2023bs56", " [C]",
    "원본 8면 「겸재의 빛」 에는 이 자리에 구간 표시가 없다 — 심사관 확인. [C] 는 s54~s57 을 감싸는 구간이고, 그 범위는 563878f 에서 이미 annotations.bracket 으로 정박했다"],

  // ── D-106 ① 잔존 접두 2건 (C-3 판정·심사관 승인분) ──────────────────
  // 21면 벡터 재확인 결과 기정박 6구간이 전부 맞다:
  //   [A] 178.5/203.3 → s20~s21   [B] 252.0/276.9 → s24~s25
  //   [C] 289.6/313.4 → s26~s27   [D] 345.1/386.9 → s29~s31
  //   [E] 417.8/441.7 → s33~s34   [F] 454.8/478.6 → s35~s36
  // 라벨 글리프는 모두 제 구간의 **중간 높이**에 있다([A] y=186.3 ∈ 178.5~203.3,
  // [C] y=297.0 ∈ 289.6~313.4). 그런데 데이터에서는 [A] 가 s23(y0 232.3),
  // [C] 가 s28(y0 324.2) 선두에 붙어 있다 — 2~3행 떨어진 엉뚱한 행이다.
  // 추출 때 라벨이 가장 가까운 행에 잘못 붙은 잔재이므로 제거만 한다(정박 변경 없음).
  ["2023수능", "l2023d", "l2023ds23", "[A] ",
    "라벨 [A] 는 21면에서 y=186.3 (구간 178.5~203.3 중간)에 있다. s23 은 y0 232.3 으로 그 구간 밖이다 — 붙을 자리가 아니다"],
  ["2023수능", "l2023d", "l2023ds28", "[C] ",
    "라벨 [C] 는 21면에서 y=297.0 (구간 289.6~313.4 중간)에 있다. s28 은 y0 324.2 로 그 구간 밖이다 — 붙을 자리가 아니다"],

  // ── D-109 ① 인라인 24건 (C-5 작업 B 판정 + 벡터 재확인) ───────────────
  // 지우는 문자열의 앞뒤 공백까지 건별로 정한다. PDF 조판에서 라벨이 어절 사이에
  // 끼어 있던 자리는 공백까지 함께 지워야 어절이 도로 붙는다(예: 「그림자 [A] 가」→「그림자가」).
  ["2024수능", "l2024c", "l2024_28_31s6", "[A] ", "10면 우단 가로획 163.0/201.5. bracket [A] 가 이 문장을 감싸고 있다 — 인라인은 중복 표기"],
  ["2024수능", "l2024c", "l2024_28_31s7", "[B] ", "10면 우단 가로획 273.3/330.5. bracket [B] 가 이 문장을 감싼다"],
  ["2024수능", "l2024c", "l2024_28_31s7", "[C] ", "10면 우단 가로획 365.2/403.7. bracket [C] 가 이 문장을 감싼다"],
  ["2023수능", "l2023c", "l2023cs2", "[A] ", "10면. bracket [A] s2~s2 와 겹친다"],
  ["2023수능", "l2023c", "l2023cs28", "[E] ", "10면 우단 가로획 218.2/256.7 — 「사흘 됐나?…」 ~ 「어머니의 고개는 무거워 보였다.」 bracket [E] s28~s29 와 일치"],
  // ★ 이 문장은 cs_spans 의 text 안에도 "[A] " 가 들어 있다(3건). 문장에서만 지우면
  //   text 매칭이 깨져 형광펜이 통째로 사라진다 — 그래서 span text 도 함께 고친다(SPAN).
  ["2022수능", "l2022b", "l2022bs2", "[A] ", "8면 우단 가로획 199.3/493.7, 라벨 [A] y=341.9 가 정중앙. bracket [A] s1~s5 와 일치. 원문도 「달채 씨」다(「김」 누락 아님)", "SPAN"],
  ["2022_6월", "r20226b", "r20226bs24", " [A] ", "「바나나의 그림자 [A] 가」 → 「바나나의 그림자가」. 조판 줄바꿈으로 갈린 어절 사이에 라벨이 끼어 있었다"],
  ["2022_6월", "r20226d", "r20226ds23", "[A] ", "5면 가로획 163.0/312.1 — 「실시간 PCR에서 발색도는…」 ~ 「…농도를 계산할 수 있다.」 bracket [A] s22~s24 와 일치"],
  ["2022_6월", "l20226c", "l20226cs16", "[A] ", "정박과 같은 커밋에서 처리"],
  ["2022_6월", "l20226a", "l20226as24", "[A] ", "정박과 같은 커밋에서 처리"],
  ["2022_6월", "l20226b", "l20226bs40", "[A] ", "정박과 같은 커밋에서 처리"],
  ["2022_6월", "l20226b", "l20226bs41", "[B] ", "정박과 같은 커밋에서 처리"],
  ["2026_6월", "l20266a", "l20266as20", " [A] ", "「불안 [A] 스러운」 → 「불안스러운」. 어절 사이에 끼어 있었다"],
  ["2026_6월", "l20266b", "l20266bs15", " [A]", "「크기가 비슷하다 [A]」 → 「크기가 비슷하다」. 행 끝 라벨"],
  ["2026_6월", "l20266d", "l20266ds4", " [A]", "11면 가로획 216.6/273.2 (4줄) — bracket [A] s2~s5 와 일치. C-5 의 3행 판독은 벡터와 어긋나 채택하지 않는다"],
  ["2026_6월", "l20266d", "l20266ds11", " [B]", "11면 가로획 326.9/383.5 (4줄) — bracket [B] s8~s11 과 일치"],
  ["2026_6월", "l20266d", "l20266ds18", " [C]", "11면 가로획 510.7/567.4 (4줄) — bracket [C] s17~s20 과 일치. 코덱스 모순 3건 중 1건, 벡터가 최종"],
  ["2026_6월", "l20266d", "l20266ds21", " [D]", "11면 가로획 584.2/622.1 (3줄) — bracket [D] s21~s23 과 일치. 모순 3건 중 1건"],
  ["2026_6월", "l20266d", "l20266ds24", " [E]", "11면 가로획 639.4/660.3 (2줄) — bracket [E] s24~s25 와 일치. C-5 의 1행 판독은 벡터와 어긋난다"],
  ["2021수능", "r2021a", "r2021as7", "[A] ", "6면 우단 가로획 362.3/620.2 — 「북학이라는 목적의식이…」 ~ 「…실용적인 입장을 보였다.」 bracket [A] s5~s9 와 일치"],
  ["2021수능", "l2021a", "l2021as18", "[A]", "「같이 [A]그 얘기를」 → 「같이 그 얘기를」. 실제 구간은 s32~s45 라 이 자리에 라벨이 있을 이유가 없다"],
  ["2021수능", "l2021a", "l2021as60", "[B] ", "9면 좌단 가로획 409.7/631.9 (13줄) — bracket [B] s55~s67 과 일치"],
  ["2024_9월", "l20249a", "l20249as3", "[A] ", "「장원[A] 급제하여」 → 「장원급제하여」. 조판 줄바꿈 자리다"],
  ["2024_9월", "l20249a", "l20249as9", "[B]", "「수심[B]으로」 → 「수심으로」. 조판 줄바꿈 자리다"],
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const norm = (s) => String(s).replace(/_/g, "");
let n = 0;
console.log(`## 인라인 마커 제거 ${APPLY ? "적용" : "DRY-RUN"} — ${SPEC.length}건\n`);

for (const [yk, sid, sentId, kill, why, mode] of SPEC) {
  if (ONLY && sid !== ONLY) continue;
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[yk]?.[sec] || []).find((x) => x.id === sid);
    if (f) { set = f; break; }
  }
  if (!set) { console.log(`  🔴 ${yk} ${sid} — 세트 없음`); continue; }
  const sent = (set.sents || []).find((x) => x.id === sentId);
  if (!sent) { console.log(`  🔴 ${sentId} — 문장 없음`); continue; }
  const t = String(sent.t ?? "");
  const at = t.indexOf(kill);
  if (at < 0) { console.log(`  ⚠ ${sentId} — ${JSON.stringify(kill)} 가 없다, 건너뜀`); continue; }
  if (t.indexOf(kill, at + 1) >= 0) { console.log(`  🔴 ${sentId} — ${JSON.stringify(kill)} 가 두 번 이상이다, 건너뜀`); continue; }

  // 이 문장을 가리키는 span 의 text 에 마커가 섞였는지 확인한다.
  //   cs_spans 는 문자 오프셋이 아니라 text 매칭이라, 문장에서만 지우면 그 span 이 죽는다.
  //   SPAN 모드에서는 span text 도 같이 고치고, 아니면 멈춘다(조용한 실패 금지).
  let blocked = false;
  const spanFix = [];
  for (const q of set.questions || [])
    for (const c of q.choices || [])
      for (const sp of c.cs_spans || []) {
        if (norm(sp.sent_id) !== norm(sentId)) continue;
        const st = String(sp.text ?? "");
        if (!st.includes(kill.trim())) continue;
        if (mode === "SPAN") {
          const a2 = st.indexOf(kill) >= 0 ? kill : kill.trim();
          spanFix.push([sp, st.split(a2).join(""), q.id, c.num]);
        } else {
          console.log(`  🔴 ${sentId} — span text 에 마커가 들어 있다: ${JSON.stringify(st.slice(0, 60))}`);
          blocked = true;
        }
      }
  if (blocked) { console.log(`  🔴 ${sentId} — 건너뛴다 (SPAN 모드로 지정해야 함께 고친다)`); continue; }

  console.log(`  ${yk} ${sid} ${sentId}`);
  console.log(`     전: ${JSON.stringify(t.slice(Math.max(0, at - 26), at + kill.length + 26))}`);
  console.log(`     후: ${JSON.stringify((t.slice(0, at) + t.slice(at + kill.length)).slice(Math.max(0, at - 26), at + 26))}`);
  console.log(`     근거: ${why}`);
  for (const [sp, fixed, qid, num] of spanFix) {
    console.log(`     span 동반 수정 Q${qid}#${num}: ${JSON.stringify(String(sp.text).slice(0, 44))} → ${JSON.stringify(fixed.slice(0, 44))}`);
    if (APPLY) sp.text = fixed;
  }
  if (APPLY) sent.t = t.slice(0, at) + t.slice(at + kill.length);
  n++;
}

if (APPLY && n) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · ${n}건`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
