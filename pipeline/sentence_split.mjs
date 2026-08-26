// sentence_split.mjs — 한 문장을 둘로 쪼개고 참조를 3계층 동시 이관한다 (발주 D-112 ②)
//
// 왜 필요한가: bracket 은 {sentFrom, sentTo} 문장 단위라, **한 문장 안의 서로 다른 두 구간**을
// 구분할 수 없다. l2024c 는 [B]·[C] 가 같은 문장(s7) 안의 다른 발화라서 first-match 에 밀린
// [C] 가 영영 렌더되지 않았다. 문장을 쪼개는 것 말고는 방법이 없다.
//
// 이관 대상 3계층:
//   ① all_data  — sents[].t (쪼갠 뒤 새 문장 삽입) · questions[].choices[].cs_spans[].sent_id
//                 · cs_ids · vocab[].sentId
//   ② annotations.json — bracket sentFrom/sentTo · underline sentId
//   ③ visual_marks.json — bracket sentIds · inline_label sentIds
//
// 안전장치 (하나라도 어긋나면 아무것도 쓰지 않는다):
//   · 쪼갠 두 조각을 구분자로 다시 이으면 원문과 **글자 하나까지 같아야** 한다
//   · 옮긴 cs_spans·underline 의 text 가 옮겨 간 문장 안에 실제로 있어야 한다
//   · 새 id 가 이미 쓰이고 있으면 중단한다
//   · JSON 재직렬화가 원본과 바이트 동일해야 한다(서식 보존)
//
// 사용: node pipeline/sentence_split.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const P = (f) => path.join(ROOT, "public/data", f);
const APPLY = process.argv.includes("--apply");

// 쪼갤 건. cutAt 은 **뒷 조각이 시작하는 글자 위치**다(구분자는 앞 조각 끝에서 잘라낸다).
const SPEC = [
  {
    yk: "2024수능", setId: "l2024c", sentId: "l2024_28_31s7", newId: "l2024_28_31s7b",
    cutAt: 196, sep: "\n",
    // 뒷 조각으로 옮길 라벨(앞 조각에 남는 것은 적지 않는다)
    moveBracket: ["C"], moveInlineLabel: ["C"],
    why: "10면 우단 3구간 판독: [B] 꺾쇠 273.3/330.5 는 「그건, 괜한 소리유…」 발화(줄 1), "
       + "[C] 꺾쇠 365.2/403.7 은 「모르긴 왜 몰라요…」 발화(줄 3)다. 둘이 한 문장 안에 있어 "
       + "getBracketInfo 의 first-match 에 밀린 [C] 가 렌더되지 않았다. 발화 경계에서 쪼갠다.",
  },
];

const rawAll = fs.readFileSync(P("all_data_204.json"), "utf8");
const rawAnn = fs.readFileSync(P("annotations.json"), "utf8");
const rawVm = fs.readFileSync(P("visual_marks.json"), "utf8");
const data = JSON.parse(rawAll);
const ann = JSON.parse(rawAnn);
const vm = JSON.parse(rawVm);

for (const [name, raw, obj, ind] of [["annotations.json", rawAnn, ann, 2], ["visual_marks.json", rawVm, vm, 2]]) {
  if (JSON.stringify(obj, null, ind) !== raw) {
    console.error(`🔴 ${name} — 재직렬화가 원본과 다르다. 중단한다`);
    process.exit(1);
  }
}

const norm = (s) => String(s).replace(/_/g, "");
let touched = 0, bad = false;
console.log(`## 문장 분리 ${APPLY ? "적용" : "DRY-RUN"} — ${SPEC.length}건\n`);

for (const S of SPEC) {
  let set = null;
  for (const sec of ["reading", "literature"]) {
    const f = (data[S.yk]?.[sec] || []).find((x) => (x.setId || x.id) === S.setId);
    if (f) { set = f; break; }
  }
  if (!set) { console.log(`  🔴 ${S.setId} — 세트 없음`); bad = true; continue; }
  const i = (set.sents || []).findIndex((x) => String(x.id) === S.sentId);
  if (i < 0) { console.log(`  🔴 ${S.sentId} — 문장 없음`); bad = true; continue; }
  if ((set.sents || []).some((x) => String(x.id) === S.newId)) {
    console.log(`  🔴 ${S.newId} — 이미 쓰이는 id 다`); bad = true; continue;
  }

  const sent = set.sents[i];
  const t = String(sent.t ?? "");
  let head = t.slice(0, S.cutAt);
  const tail = t.slice(S.cutAt);
  // 구분자는 앞 조각 끝에서 잘라낸다 — 이었을 때 원문과 같아야 하므로 기억해 둔다
  const hadSep = S.sep && head.endsWith(S.sep);
  if (hadSep) head = head.slice(0, -S.sep.length);
  const rejoined = head + (hadSep ? S.sep : "") + tail;
  if (rejoined !== t) {
    console.log(`  🔴 ${S.sentId} — 다시 이었을 때 원문과 다르다. 중단`); bad = true; continue;
  }
  if (!head.trim() || !tail.trim()) {
    console.log(`  🔴 ${S.sentId} — 한쪽 조각이 비었다`); bad = true; continue;
  }

  console.log(`  ${S.yk} ${S.setId} ${S.sentId} → ${S.sentId} + ${S.newId}`);
  console.log(`     앞: ${JSON.stringify(head.slice(0, 40))} … ${JSON.stringify(head.slice(-24))}  (${head.length}자)`);
  console.log(`     뒤: ${JSON.stringify(tail.slice(0, 40))} … ${JSON.stringify(tail.slice(-24))}  (${tail.length}자)`);
  console.log(`     근거: ${S.why}`);

  // ── 참조 이관 계획 ────────────────────────────────────────────────
  const moves = [];
  for (const q of set.questions || [])
    for (const c of q.choices || []) {
      for (const sp of c.cs_spans || []) {
        if (norm(sp.sent_id) !== norm(S.sentId)) continue;
        const txt = String(sp.text ?? "");
        const inHead = head.includes(txt), inTail = tail.includes(txt);
        if (inTail && !inHead) moves.push(["cs_spans", `Q${q.id}#${c.num}`, sp, txt]);
        else if (inHead && !inTail) console.log(`     유지 cs_spans Q${q.id}#${c.num} (앞 조각)`);
        else { console.log(`  🔴 cs_spans Q${q.id}#${c.num} — 어느 조각에도 없거나 양쪽에 있다: ${JSON.stringify(txt.slice(0, 40))}`); bad = true; }
      }
      // cs_ids 는 문장 전체 하이라이트용이다. 쪼갠 뒤에도 같은 범위가 켜지도록 **양쪽 다** 넣는다.
      if ((c.cs_ids || []).some((id) => norm(id) === norm(S.sentId)))
        moves.push(["cs_ids", `Q${q.id}#${c.num}`, c, null]);
    }
  for (const w of set.vocab || [])
    if (norm(w.sentId ?? "") === norm(S.sentId)) {
      const inTail = tail.includes(String(w.word ?? ""));
      moves.push([inTail ? "vocab→뒤" : "vocab(앞 유지)", w.word, w, null]);
    }
  const annList = ann[S.yk]?.[S.setId] || [];
  for (const a of annList) {
    if (a.type === "underline" && norm(a.sentId ?? "") === norm(S.sentId)) {
      const txt = String(a.text ?? "");
      const inTail = tail.includes(txt), inHead = head.includes(txt);
      if (inTail && !inHead) moves.push(["ann.underline", a.marker ?? "", a, txt]);
      else if (inHead && !inTail) console.log(`     유지 ann.underline ${a.marker} (앞 조각)`);
      else { console.log(`  🔴 ann.underline ${a.marker} — 조각 판별 불가`); bad = true; }
    }
    if (a.type === "bracket" && S.moveBracket.includes(a.label)
        && (norm(a.sentFrom) === norm(S.sentId) || norm(a.sentTo) === norm(S.sentId)))
      moves.push(["ann.bracket", `[${a.label}]`, a, null]);
  }
  const vmHits = (vm.marks || []).filter((m) => m.setId === S.setId
    && ((m.type === "bracket" && S.moveBracket.includes(m.label))
      || (m.type === "inline_label" && S.moveInlineLabel.includes(m.label)))
    && (m.sentIds || []).some((x) => norm(x) === norm(S.sentId)));
  for (const m of vmHits) moves.push([`vm.${m.type}`, `[${m.label}]`, m, null]);

  for (const [kind, tag] of moves) console.log(`     이관 ${kind} ${tag} → ${S.newId}`);
  if (bad) { console.log(`  🔴 ${S.setId} — 검증 실패, 쓰지 않는다`); continue; }

  if (APPLY) {
    sent.t = head;
    const next = { ...sent, id: S.newId, t: tail };
    set.sents.splice(i + 1, 0, next);
    for (const [kind, , obj] of moves) {
      if (kind === "cs_spans") obj.sent_id = S.newId;
      else if (kind === "cs_ids") obj.cs_ids = [...obj.cs_ids, S.newId];
      else if (kind === "vocab→뒤") obj.sentId = S.newId;
      else if (kind === "ann.underline") obj.sentId = S.newId;
      else if (kind === "ann.bracket") { obj.sentFrom = S.newId; obj.sentTo = S.newId; }
      else if (kind.startsWith("vm.")) obj.sentIds = [S.newId];
    }
    touched++;
  }
}

if (bad) { console.log(`\n🔴 검증 실패가 있다 — 아무것도 쓰지 않았다`); process.exit(1); }
if (APPLY && touched) {
  fs.writeFileSync(P("all_data_204.json"), JSON.stringify(data), "utf8");
  fs.writeFileSync(P("annotations.json"), JSON.stringify(ann, null, 2), "utf8");
  fs.writeFileSync(P("visual_marks.json"), JSON.stringify(vm, null, 2), "utf8");
  console.log(`\n  3계층 갱신 완료 · ${touched}건`);
}
if (!APPLY) console.log(`\n### DRY-RUN — 아무것도 쓰지 않았다. 적용하려면 --apply`);
