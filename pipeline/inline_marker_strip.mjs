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
];

const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const norm = (s) => String(s).replace(/_/g, "");
let n = 0;
console.log(`## 인라인 마커 제거 ${APPLY ? "적용" : "DRY-RUN"} — ${SPEC.length}건\n`);

for (const [yk, sid, sentId, kill, why] of SPEC) {
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

  // 이 문장을 가리키는 span 의 text 에 마커가 섞였는지 확인
  let blocked = false;
  for (const q of set.questions || [])
    for (const c of q.choices || [])
      for (const sp of c.cs_spans || []) {
        if (norm(sp.sent_id) !== norm(sentId)) continue;
        if (String(sp.text ?? "").includes(kill.trim())) {
          console.log(`  🔴 ${sentId} — span text 에 마커가 들어 있다: ${JSON.stringify(sp.text)}`);
          blocked = true;
        }
      }
  if (blocked) { console.log(`  🔴 ${sentId} — 건너뛴다`); continue; }

  console.log(`  ${yk} ${sid} ${sentId}`);
  console.log(`     전: ${JSON.stringify(t.slice(Math.max(0, at - 26), at + kill.length + 26))}`);
  console.log(`     후: ${JSON.stringify((t.slice(0, at) + t.slice(at + kill.length)).slice(Math.max(0, at - 26), at + 26))}`);
  console.log(`     근거: ${why}`);
  if (APPLY) sent.t = t.slice(0, at) + t.slice(at + kill.length);
  n++;
}

if (APPLY && n) {
  fs.writeFileSync(DATA, JSON.stringify(data), "utf8");
  console.log(`\n  all_data 갱신 ${(fs.statSync(DATA).size / 1048576).toFixed(2)}MB · ${n}건`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
