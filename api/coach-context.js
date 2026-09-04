// api/coach-context.js — AI 코칭용 해설·근거 문장 (발주 F-62 · 조건 2·3)
//
//   POST /api/coach-context
//   Authorization: Bearer <supabase access_token>
//   body: { yearKey, setId, questionId, choiceNum }
//
//   ★ 본인 검증(발주 조건 2) — user_answers 에 요청자 본인이 그 문항에 그 선지로
//     답한 기록이 있을 때만 반환한다. 로그인만으로는 부족하다. 검증이 없으면
//     문항 id 를 순회하는 것만으로 해설 7,770건이 통째로 나간다.
//     ★ 오늘 막고 있는 것과 같은 구멍을 새 API 로 다시 내지 않는다.
//   ★ 1건만 반환한다(발주 조건 3). 목록·배치·전량 반환 금지.

import {
  loadSource,
  authenticate,
  readBody,
  isSafeSegment,
  findChoice,
  groundingSentences,
} from "./_sourceData.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const auth = await authenticate(req);
    if (!auth) return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
    const { user, client } = auth;

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

    // 본인이 실제로 그 선지를 골랐는가. RLS 로 본인 행만 읽히지만
    //   user_id 조건을 명시해 둔다(정책이 바뀌어도 조건이 남게).
    const { data: rows, error } = await client
      .from("user_answers")
      .select("choice_num")
      .eq("user_id", user.id)
      .eq("year_key", coord.yearKey)
      .eq("set_id", coord.setId)
      .eq("question_id", coord.questionId)
      .eq("choice_num", coord.choiceNum)
      .limit(1);
    if (error) {
      console.warn("[/api/coach-context] 조회 실패", error.message);
      return res.status(500).json({ ok: false, error: "LOOKUP_FAILED" });
    }
    if (!rows?.[0]) return res.status(403).json({ ok: false, error: "NOT_ANSWERED" });

    const source = loadSource();
    if (!source) return res.status(500).json({ ok: false, error: "SOURCE_MISSING" });
    const found = findChoice(source, coord);
    if (!found) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const { set, choice } = found;

    return res.status(200).json({
      ok: true,
      analysis: choice.analysis ?? "",
      groundingSents: groundingSentences(set, choice),
    });
  } catch (e) {
    console.error("[/api/coach-context]", e);
    return res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}
