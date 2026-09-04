// api/training-item.js — 패턴 훈련 출제 (발주 F-62 · 조건 1·3)
//
//   GET /api/training-item?pat=<patKey>
//   Authorization: Bearer <supabase access_token>
//
//   후보 선별은 pro 필드(choice.pat)로 서버가 한다. 응답에는 그 필드를 담지 않는다.
//
//   🔴 응답에 넣지 않는 것 — pat · analysis · cs_ids · 근거 문장 · 정오(ok)
//      이 훈련의 문제가 「이 선지에 결함이 있는가」다. analysis 본문이 곧 결함
//      설명이고, cs_ids 유무도 신호이며, ok 는 답 그 자체다. 하나라도 미리 주면
//      훈련이 무의미해진다. 채점과 해설은 제출 후 /api/training-reveal 이 한다.
//
//   ★ 로그인만 요구한다(이용권 불요) — 무료도 훈련이 나와야 한다는 것이 발주의 목적이다.
//   ★ 1건만 반환한다(발주 조건 3). 목록·배치·전량 반환 금지.
//   ★ 낸 선지의 좌표는 서명해 token 으로 함께 준다. reveal 은 그 서명을 본다.

import {
  loadSource,
  authenticate,
  findChoice,
  groundingSentences,
  signIssue,
} from "./_sourceData.js";
// RELEASE_KEYS 정본은 src/dataLoader.js 하나다. 여기에 복제하지 않는다.
//   (비노출 세트의 지문이 훈련 문제로 새어 나가지 않게 한다 — 발주 F-17)
import { isReleaseSet } from "../src/dataLoader.js";

// 클라이언트(PatternReport.jsx)의 같은 이름 함수와 판정이 같아야 한다.
function isUsableTrainingSentence(text) {
  const value = String(text ?? "").trim();
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 8) return false;
  if (/^[㉠-㉿ⓐ-ⓩ①-⑳]+$/.test(compact)) return false;
  return /[가-힣A-Za-z0-9]/.test(value);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
    const { user, client } = auth;

    // 형식만 본다. R1~R4·L1~L5 로 좁히지 않는다 — user_answers 의 pat 에는
    //   "0"(수동검토)·"V" 같은 값도 있고, 그런 요청은 후보 0건 → 404 로 끝나야
    //   한다. 400 으로 막으면 화면 문구가 「데이터를 못 불러왔다」로 바뀐다.
    const patKey = String(req.query?.pat ?? "");
    if (!/^[A-Za-z0-9]{1,8}$/.test(patKey)) {
      return res.status(400).json({ ok: false, error: "INVALID_PAT" });
    }

    const source = loadSource();
    if (!source) return res.status(500).json({ ok: false, error: "SOURCE_MISSING" });

    // 학생이 이미 푼 선지는 훈련에서 뺀다(클라이언트가 하던 excludedKeys 와 같다).
    //   ★ RLS 로 본인 행만 읽힌다.
    const { data: answered } = await client
      .from("user_answers")
      .select("year_key, set_id, question_id, choice_num")
      .eq("user_id", user.id);
    const excluded = new Set(
      (answered ?? []).map(
        (a) => `${a.year_key}|${a.set_id}|${a.question_id}|${a.choice_num}`,
      ),
    );

    const targetSection = patKey.startsWith("L") ? "literature" : "reading";
    const patternItems = [];
    const trueControls = [];

    for (const [yearKey, yearData] of Object.entries(source)) {
      for (const set of yearData[targetSection] ?? []) {
        if (!isReleaseSet(yearKey, set.setId ?? set.id)) continue;
        for (const question of set.questions ?? []) {
          for (const choice of question.choices ?? []) {
            const key = `${yearKey}|${set.id}|${question.id}|${choice.num}`;
            if (excluded.has(key)) continue;
            if (!isUsableTrainingSentence(choice.t)) continue;
            const coord = {
              yearKey,
              setId: set.id,
              questionId: question.id,
              choiceNum: choice.num,
            };
            if (choice.pat === patKey && choice.ok === false) {
              patternItems.push(coord);
            } else if (
              choice.ok === true &&
              groundingSentences(set, choice).length > 0
            ) {
              trueControls.push(coord);
            }
          }
        }
      }
    }

    const usePatternItem =
      patternItems.length > 0 &&
      (Math.random() < 0.75 || trueControls.length === 0);
    const pool = usePatternItem ? patternItems : trueControls;
    if (pool.length === 0) {
      return res.status(404).json({ ok: false, error: "NO_CANDIDATE" });
    }

    const coord = pool[Math.floor(Math.random() * pool.length)];
    const found = findChoice(source, coord);
    if (!found) return res.status(404).json({ ok: false, error: "NO_CANDIDATE" });
    const { set, question, choice } = found;

    const passage = (set.sents ?? [])
      .filter(
        (sent) =>
          sent.sentType !== "author" &&
          sent.sentType !== "footnote" &&
          sent.sentType !== "omission",
      )
      .map((sent) => sent.t)
      .join("\n");

    return res.status(200).json({
      ok: true,
      passage,
      sentence: choice.t,
      sourceYearKey: coord.yearKey,
      sourceSetId: coord.setId,
      sourceQuestionId: coord.questionId,
      sourceChoiceNum: coord.choiceNum,
      sourceLabel: `${coord.yearKey} · ${set.title ?? set.id} · ${question.id}번 ${choice.num}번 선지`,
      token: signIssue(user.id, coord),
    });
  } catch (e) {
    console.error("[/api/training-item]", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
