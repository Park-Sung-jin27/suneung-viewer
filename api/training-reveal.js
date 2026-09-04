// api/training-reveal.js — 훈련 채점·해설 (발주 F-62 · 조건 1·2·3)
//
//   POST /api/training-reveal
//   Authorization: Bearer <supabase access_token>
//   body: { yearKey, setId, questionId, choiceNum, token }
//
//   제출 후에만 부른다. 정오와 해설·근거 문장을 여기서 처음 준다.
//
//   ★ 본인 검증(발주 조건 2) — 훈련 문항은 학생이 푼 적 없는 문항이라
//     user_answers 로는 검증이 안 된다(오히려 푼 문항은 출제에서 제외된다).
//     대신 /api/training-item 이 그 학생에게 그 좌표를 실제로 발급했다는
//     서명(token)을 확인한다. 서명이 없으면 좌표를 순회하는 것만으로
//     해설 7,770건이 통째로 나간다.
//   ★ 1건만 반환한다(발주 조건 3).

import {
  loadSource,
  authenticate,
  readBody,
  isSafeSegment,
  findChoice,
  groundingSentences,
  verifyIssue,
} from "./_sourceData.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
    const { user } = auth;

    const b = await readBody(req);
    const coord = {
      yearKey: b?.yearKey,
      setId: b?.setId,
      questionId: Number(b?.questionId),
      choiceNum: Number(b?.choiceNum),
    };
    if (
      !isSafeSegment(coord.yearKey) ||
      !isSafeSegment(coord.setId) ||
      !Number.isInteger(coord.questionId) ||
      !Number.isInteger(coord.choiceNum)
    ) {
      return res.status(400).json({ ok: false, error: "INVALID_TARGET" });
    }

    // 발급 서명 확인 — 이게 본인 검증이다.
    if (!verifyIssue(user.id, coord, b?.token)) {
      return res.status(403).json({ ok: false, error: "NOT_ISSUED" });
    }

    const source = loadSource();
    if (!source) return res.status(500).json({ ok: false, error: "SOURCE_MISSING" });
    const found = findChoice(source, coord);
    if (!found) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const { set, choice } = found;

    return res.status(200).json({
      ok: true,
      isCorrect: choice.ok === true,
      explanation:
        choice.analysis ??
        "해설이 없는 선지입니다. 지문 근거와 선지를 직접 대조하세요.",
      evidenceSentence: groundingSentences(set, choice)[0] ?? "",
    });
  } catch (e) {
    console.error("[/api/training-reveal]", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
