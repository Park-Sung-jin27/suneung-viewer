// bracket_anchor_write.mjs — 화면 원천에 bracket 정박을 기록한다 (발주 D-108 ①②)
//
// ★ 정본 규칙 (D-108 ①)
//   · bracket 정박·수리는 **annotations.json** 에 쓴다.
//   · 같은 라벨이 **visual_marks.json** 에 bracket 으로 있으면 동일 값으로 동기화한다.
//     (없으면 만들지 않는다 — vm 은 감사 산출물이지 정박 원천이 아니다)
//   · all_data_204.json 의 set.annotations 는 **건드리지 않는다**(삭제도 금지, F-25 소관).
//
//   근거: src/dataLoader.js:548 _attachAnnotations 가 annotations.json 에 그 세트 항목이
//   있으면 set.annotations 를 통째로 덮어쓴다. src/PassagePanel.jsx:745 는 vm bracket 을
//   합쳐 label|from|to 로 dedup 하고, getBracketInfo(:655)가 첫 매치에서 return 한다.
//   따라서 두 파일의 값이 어긋나면 vm 이 먼저 매치돼 annotations.json 수정이 묻힌다.
//
// 문장 순서·길이는 all_data_204.json 에서 읽는다(읽기 전용).
//
// 사용: node pipeline/bracket_anchor_write.mjs [--only <setId>] [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (f) => path.join(ROOT, "public/data", f);
const APPLY = process.argv.includes("--apply");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1] : null; })();

// [yearKey, setId, 라벨, sentFrom, sentTo, 근거]
const SPEC = [
  ["2027_6월", "l20276a", "A", "l20276as40", "l20276as51",
    "6~7면 걸침. 7면 닫힘 가로획 y=181.6 은 s51 행(y0 177.1) 글자 높이 안이다. 900dpi 확대에서 꺾쇠는 하나. 심사관 PDF 실측 확정 — 기존 s48 은 코덱스 C-4 판독값이었다"],
  ["2027_6월", "l20276c", "A", "l20276cs31", "l20276cs50",
    "10면 좌→우단 걸침. 우단 닫힘 가로획 y=182.9 는 s50 행(y0 177.1) 안이다. 기존 s48 은 좌단 끝에서 끊은 값"],
  ["2024_9월", "r20249b", "A", "r20249bs16", "r20249bs20",
    "2면 가로획 695.6/862.3. annotations.json 에 bracket 이 없어 정박이 통째로 빠져 있었다(비노출)"],
  ["2024_9월", "r20249b", "B", "r20249bs21", "r20249bs23",
    "2면 가로획 879.4/1009.2. 위와 같음"],

  // ── D-109 ① 인라인 24건 수리에 딸린 정박 ──────────────────────────
  // 전부 pipeline/bracket_probe.py 로 지면 벡터를 짚어 확정했다.
  // 도구 검증: l20276d 3구간(3·3·3행)과 l20226b 2구간 분리를 정확히 재현한다.
  ["2022_6월", "r20226b", "A", "r20226bs17", "r20226bs28",
    "2면 좌단 가로획 585.3/881.2 — 「가령 바나나가 a 지점에서…」 ~ 「…표지를 전달할 수 없다.」 17줄. 기존 s14~s23 은 오정박"],
  ["2022_6월", "l20226b", "A", "l20226bs40", "l20226bs40",
    "8면 우단 가로획 420.4/532.6 (7줄). 기존 s23~s25 는 전혀 다른 자리였다"],
  ["2022_6월", "l20226b", "B", "l20226bs41", "l20226bs41",
    "8면 우단 가로획 549.0/679.9 (8줄). 라벨 [A] y=471.8 · [B] y=609.8 이 각 구간 중앙에 있다"],
  ["2022_6월", "l20226c", "A", "l20226cs16", "l20226cs16",
    "10면 좌단 가로획 907.2 — 「이때는 추구월(秋九月) 보름 때라…」 ~ 「…눈물이 무심히 떨어진다.」 9줄. bracket 이 없던 세트"],
  ["2022_6월", "l20226a", "A", "l20226as24", "l20226as24",
    "7면 좌단 가로획 254.9/440.8 (11줄). bracket 이 없던 세트"],
  ["2026_6월", "l20266a", "A", "l20266as20", "l20266as22",
    "6면 우단 가로획 383.6/569.5 — 「청년은 점점 더 당황하였다…」 ~ 「…통장을 확인할 경황도 없이.」 11줄"],
  ["2026_6월", "l20266b", "A", "l20266bs4", "l20266bs15",
    "8면 가로획 254.1/456.5 — 「사자봉 높은 돌이 용소를 굽어보되」 ~ 「이 돌 갖다 끼울 만큼 크기가 비슷하다」 12줄"],
  // 🔴 인라인 [A] 는 s18 에 있는데 실제 구간은 한참 뒤다(D-105 에서 「구간이 마커보다 뒤」로 남긴 모순).
  //    8면 라벨 글리프 [A] y=939.9 가 브래킷(842.8~1046.3) 정중앙이다 — 규칙과 일치.
  ["2021수능", "l2021a", "A", "l2021as32", "l2021as45",
    "8면 우단 가로획 842.8/1046.3 — 「한병장이 다시 얼굴을 힐끔 돌리며…」 ~ 「…견디기 어려운 문제였지.」 12줄. 기존 s18~s45 는 시작이 14문장 앞섰다"],
  ["2024_9월", "l20249a", "A", "l20249as3", "l20249as3",
    "6면 우단 가로획 254.5/310.6 (4줄). bracket 이 없던 세트"],
  ["2024_9월", "l20249a", "B", "l20249as9", "l20249as9",
    "6면 우단 가로획 622.1/788.8 (10줄). 위와 같음"],

  // ── D-110-2 ② 수리 8라벨 + 신규 정박 2건 ─────────────────────────────
  // 판독: pipeline/bracket_map_v2.py (역방향 매핑, 합격선 7건 통과) + 경계 문장 y 직접 대조.
  // 포함 규칙: 문장 시작 y ∈ [상단꺾쇠 - 9, 하단꺾쇠 + 1]
  ["2019수능", "r2019d", "A", "r2019ds13", "r2019ds18",
    "10면 좌단 꺾쇠 823.3/1048.4. s13 y=820.4(안) · 앞 문장 s12 y=783.7(밖) · s18 y=1004.3(안). 기존 s16~s18 은 시작이 3문장 늦었다"],
  ["2020_9월", "r20209a", "A", "r20209as37", "r20209as41",
    "8면 우단 꺾쇠 419.5/587.0. s37 y=416.1 (꺾쇠 −3.4, 규칙 +1~6 부합) · s36 y=379.3(밖). 기존 s38~s41 은 시작이 1문장 늦었다"],
  ["2020_9월", "r20209b", "A", "r20209bs4", "r20209bs10",
    "10면 좌단 꺾쇠 270.3/437.8. s4 y=266.9(−3.4) · s3 y=248.6(밖) · s10 y=413.9(안) · s11 y=450.7(밖)"],
  ["2020수능", "l2020a", "A", "l2020as2", "l2020as12",
    "8면 꺾쇠 214.1/401.5. s2 y=211.3(−2.8) · s12 y=395.0(안). s1 은 (가) 표지, s13 은 (중략). 기존 s5~s12 는 시작이 3문장 늦었다"],
  ["2021_9월", "l20219a", "B", "l20219as6", "l20219as10",
    "6면 우단 꺾쇠 273.0/624.1. s6 y=269.0(−4.0) · s5 y=213.9(밖) · s12 y=681.0(밖). s10 은 위치 미확인 본문, s11 은 (중략)"],
  ["2024_9월", "l20249d", "A", "l20249ds11", "l20249ds28",
    "11면 우단 꺾쇠 383.2/696.6. s11 y=378.9(−4.3) · s10 y=360.5(밖) · s28 y=691.3(−5.3) · s29 y=709.7(밖). 기존 s19~s31 은 전혀 다른 범위였다"],
  // 🔴 vm 에 같은 라벨 bracket 이 따로 있어 화면은 vm(s2~s4)을 그리고 있었다.
  //    ann 만 고치면 화면이 안 바뀐다 — 도구가 vm 도 같은 값으로 동기화한다.
  ["2025_9월", "l20259a", "A", "l20259as2", "l20259as12",
    "6면 우단 꺾쇠 199.3/389.9. 시작행 y=195.1 「제1회 봄놀이」(−4.2)=s2 · 끝행 y=383.0 「수밖에 없었다.」(−6.9)=s12. ann 은 s6~s12, vm 은 s2~s4 로 서로 달랐고 화면은 vm 을 그렸다"],
  ["2025_9월", "l20259c", "A", "l20259cs41", "l20259cs51",
    "10면 좌단 꺾쇠 880.7/1057.2. s41 y=876.5(−4.2) · s40 y=859.0(밖) · s51 y=1051.1(−6.1). 기존 s20~s27 은 전혀 다른 범위였다"],
  // 신규 정박 — 문항이 [A] 를 가리키는데 화면에 구간이 없던 세트
  ["2022_9월", "r20229d", "A", "r20229ds11", "r20229ds17",
    "5면 우단 꺾쇠 420.4/733.8. bracket 이 ann·vm 어디에도 없었다"],
  ["2022_9월", "l20229b", "A", "l20229bs26", "l20229bs28",
    "8면 좌단 꺾쇠 765.8/839.5. bracket 이 ann·vm 어디에도 없었다"],

  // ── D-111 ① r2023b — F-25 머지 차단 건 ────────────────────────────
  // ann(s1~s8) 과 vm(s2~s9) 이 공존해 화면이 어긋났다. 지면 판독 결과 **ann 이 정답**이다.
  //   상단 꺾쇠 217.7 → 행 213.5 「중국에서 비롯된 유서(類書)는…」 (+4.2). 그 위 195.1 은 (가) 표지다.
  //     데이터 s1 은 "(가) 중국에서…" 로 표지를 품고 있어 검색이 195.1 을 집지만, 구간은 s1 부터다.
  //   하단 꺾쇠 550.5 → 행 544.3 「하고자 하였기 때문이었다.」 (+6.2) = s8 의 끝. 다음 행 562.7 은 s9.
  // ann 은 이미 맞으므로 **vm 만 동기화**된다.
  ["2023수능", "r2023b", "A", "r2023bs1", "r2023bs8",
    "2면 좌단 꺾쇠 217.7/550.5. s1 본문 첫 행 213.5(+4.2) · s8 끝 행 544.3(+6.2) · s9 는 562.7 로 밖. vm 의 s2~s9 가 틀렸다"],

  // ── D-112 ① C갈래 정박 — 도구가 놓쳤으나 지면에 실재하는 구간 ───────────
  //   전부 선 좌표를 손으로 뽑아 확정했다(도구 임계는 바꾸지 않았다).
  ["2016_9월B", "r20169g", "A", "r20169gs7", "r20169gs7",
    "15면 우단 x=454.6 꺾쇠 162.0/332.2, 라벨 [A] y=242.4 가 구간 중앙(247.1). 시작 행 158.8 · 끝 행 324.0 이 모두 s7 한 문장이다"],
  ["2016_9월B", "r20169g", "B", "r20169gs16", "r20169gs16",
    "15면 우단 꺾쇠 621.0/754.4, 라벨 [B] y=684.4 가 중앙(687.7). 세로선 621.0~682.0 + 696.2~754.4 로 라벨 자리에서 끊긴다. 시작 617.8 · 끝 746.3 이 모두 s16"],
  // 🔴 D-111 자체 플래그 해소: 10면 우단 [A](x0 708.7)는 l20229b 가 아니라 **l20229c** 것이었다.
  //    l20229b [B] 는 8면 좌단에 따로 있다 — 기존 [A] s26~s28(8면 765.8/839.5)과 모순 없다.
  ["2022_9월", "l20229b", "B", "l20229bs30", "l20229bs36",
    "8면 좌단 x=103.6 꺾쇠 912.8(상단). 세로선 912.8~1014.9 + 1029.1~1065.9 로 라벨 [B] y=1017.4 자리에서 끊긴다. 시작 행 908.5 「그러나 고등어 배는 돌아오지 않았다…」(+4.3)=s30 · 끝 행 1055.6 「나갔다. 살아야 했다…」=s36. 지문이 이 면에서 끝나 하단 꺾쇠가 없다(다음 면은 (나) 시나리오)"],
  // l20229c — l20229b [B] 귀속을 확인하다 찾았다. D-110-2 재집계에서 「가리키는데 화면에 없음」이던 세트다.
  ["2022_9월", "l20229c", "A", "l20229cs19", "l20229cs21",
    "10면 우단 x=717.0 꺾쇠 744.4/764.8, 라벨 [A] y=750.0. 시작 행 741.1 「막상 목청을 떼어 내고…」(+3.3)=s19 · 끝 행 759.5 「베개에 떨어뜨린 머리카락…」(+5.3)=s21"],
  ["2022_9월", "l20229c", "B", "l20229cs26", "l20229cs28",
    "10면 우단 꺾쇠 854.7/875.1, 라벨 [B] y=860.3. 시작 행 851.4 「노래하고 싶은 시인은 말 속에」(+3.3)=s26 · 끝 행 869.8 「은밀히 심장의 박동을…」(+5.3)=s28"],
];

const rawAnn = fs.readFileSync(P("annotations.json"), "utf8");
const rawVm = fs.readFileSync(P("visual_marks.json"), "utf8");
const ann = JSON.parse(rawAnn);
const vm = JSON.parse(rawVm);
const data = JSON.parse(fs.readFileSync(P("all_data_204.json"), "utf8"));

// 재직렬화가 원본과 바이트 동일한지 먼저 확인한다 — 아니면 쓰지 않는다.
for (const [name, raw, obj] of [["annotations.json", rawAnn, ann], ["visual_marks.json", rawVm, vm]]) {
  if (JSON.stringify(obj, null, 2) !== raw) {
    console.error(`🔴 ${name} — 재직렬화가 원본과 다르다. 서식이 깨지므로 중단한다`);
    process.exit(1);
  }
}

const sentsOf = (yk, sid) => {
  for (const sec of ["reading", "literature"]) {
    const s = (data[yk]?.[sec] || []).find((x) => (x.setId || x.id) === sid);
    if (s) return s.sents || [];
  }
  return null;
};

let nAnn = 0, nVm = 0, bad = false;
console.log(`## bracket 정박 기록 ${APPLY ? "적용" : "DRY-RUN"} — 원천: annotations.json (+vm 동기화)\n`);

for (const [yk, sid, label, from, to, why] of SPEC) {
  if (ONLY && sid !== ONLY) continue;
  const sents = sentsOf(yk, sid);
  if (!sents) { console.log(`  🔴 ${yk} ${sid} — 세트 없음`); bad = true; continue; }
  const ids = sents.map((x) => String(x.id));
  const fi = ids.indexOf(from), ti = ids.indexOf(to);
  if (fi < 0 || ti < 0) { console.log(`  🔴 ${sid} [${label}] — 문장 id 없음 (${from} / ${to})`); bad = true; continue; }
  if (fi > ti) { console.log(`  🔴 ${sid} [${label}] — from 이 to 보다 뒤다`); bad = true; continue; }

  // ── annotations.json ──────────────────────────────────────────────
  ann[yk] ||= {};
  const list = (ann[yk][sid] ||= []);
  const at = list.findIndex((a) => a?.type === "bracket" && a.label === label);
  const next = { type: "bracket", label, sentFrom: from, sentTo: to };
  const prev = at >= 0 ? list[at] : null;
  if (prev && prev.sentFrom === from && prev.sentTo === to) {
    console.log(`  ⚠ ${yk} ${sid} [${label}] — 이미 같은 값, 건너뜀`);
  } else {
    console.log(`  ${yk} ${sid} [${label}] ${prev ? `${prev.sentFrom}~${prev.sentTo} → ` : "(신규) "}${from} ~ ${to}  (${ti - fi + 1}행)`);
    console.log(`     근거: ${why}`);
    if (APPLY) { if (at >= 0) list[at] = { ...prev, ...next }; else list.push(next); }
    nAnn++;
  }

  // ── visual_marks.json — 같은 라벨의 bracket 이 있을 때만 동기화 ──
  const m = (vm.marks || []).find((x) => x?.type === "bracket" && x.yearKey === yk && x.setId === sid && x.label === label);
  if (!m) { console.log(`     vm: 같은 라벨 bracket 없음 — 만들지 않는다`); continue; }
  const span = ids.slice(fi, ti + 1);
  const same = JSON.stringify(m.sentIds) === JSON.stringify(span);
  if (same) { console.log(`     vm: 이미 같은 범위`); continue; }
  console.log(`     vm 동기화: ${m.sentIds[0]}~${m.sentIds[m.sentIds.length - 1]} (${m.sentIds.length}) → ${span[0]}~${span[span.length - 1]} (${span.length})`);
  if (APPLY) {
    m.sentIds = span;
    // start/end 는 렌더러가 bracket 에 쓰지 않는다(감사 표시용). 규약대로 맞춰 둔다.
    if (m.start) m.start = { ...m.start, sentId: span[0], offset: 0 };
    if (m.end) m.end = { ...m.end, sentId: span[span.length - 1], offset: String(sents[ti].t ?? "").length };
  }
  nVm++;
}

if (bad) { console.log(`\n🔴 검증 실패 항목이 있다 — 아무것도 쓰지 않는다`); process.exit(1); }

if (APPLY && (nAnn || nVm)) {
  fs.writeFileSync(P("annotations.json"), JSON.stringify(ann, null, 2), "utf8");
  if (nVm) fs.writeFileSync(P("visual_marks.json"), JSON.stringify(vm, null, 2), "utf8");
  console.log(`\n  annotations.json ${nAnn}건 · visual_marks.json ${nVm}건 기록`);
  console.log(`  all_data_204.json 은 건드리지 않았다`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
