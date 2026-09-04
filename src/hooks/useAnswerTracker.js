import { supabase } from "../supabase";

export async function saveAnswer({
  user,
  yearKey,
  setId,
  questionId,
  choiceNum,
  choiceText,
  correctChoiceNum,
  correctChoiceText,
  questionType,
  isCorrect,
  timeSpent,
}) {
  // 비로그인은 저장 대상이 아니다 — 실패가 아니므로 ok 로 돌려준다.
  if (!user) return { ok: true, skipped: true };

  try {
    const now = new Date().toISOString();
    const existing = await findExistingAnswer({
      userId: user.id,
      yearKey,
      setId,
      questionId,
    });
    const nextAttempt = (existing?.attempt_count ?? 0) + 1;
    const reviewCount = existing?.review_count ?? 0;
    const nextReview = isCorrect ? null : getNextReview(reviewCount);
    const payload = {
      user_id: user.id,
      year_key: yearKey,
      set_id: setId,
      question_id: questionId,
      choice_num: choiceNum,
      choice_text: choiceText ?? null,
      correct_choice_num: correctChoiceNum ?? null,
      correct_choice_text: correctChoiceText ?? null,
      question_type: questionType ?? null,
      is_correct: isCorrect,
      // 발주 F-61: pat 은 브라우저가 알 수 없다 — pro 필드이고, 내려보내면
      //   한 문항에서 pat 유무가 곧 정답을 가리킨다. 서버가 채운다.
      //   여기서는 항상 null 로 되돌린다 — 답을 바꿨을 때 직전 시도의 패턴이
      //   남으면 틀린 기록이 된다. 채우기는 fillAnswerPatterns 가 직후에 한다.
      pat: null,
      time_spent: Number.isFinite(timeSpent) ? timeSpent : null,
      next_review: nextReview,
      review_count: reviewCount,
      attempt_count: nextAttempt,
      answered_at: now,
    };

    // [발주 fi-2 B-1] supabase-js 의 insert()/update() 는 실패해도 예외를 던지지 않는다.
    //   반환된 error 를 확인하지 않으면 try/catch 로도 못 잡는다(§13㉒ 절차 ④).
    //   INSERT 가 실패했는데 upsert_user_stats(SECURITY DEFINER)만 성공하면
    //   user_answers 는 비고 카운터만 오른다 — 2026-06-17~08-14 답안 50건 유실의 기전이다.
    if (existing?.id) {
      const { error } = await supabase
        .from("user_answers")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        console.warn("[saveAnswer] UPDATE 실패:", error.message, payload);
        return { ok: false, error: error.message };
      }
    } else {
      const { error } = await supabase.from("user_answers").insert(payload);
      if (error) {
        // ★ RPC 를 호출하지 않고 즉시 반환한다. 카운터만 오르는 상태를 만들지 않는다.
        console.warn(
          "[saveAnswer] INSERT 실패 — user_stats 를 올리지 않습니다:",
          error.message,
          payload,
        );
        return { ok: false, error: error.message };
      }
      const { error: rpcError } = await supabase.rpc("upsert_user_stats", {
        p_user_id: user.id,
        p_correct: isCorrect,
      });
      if (rpcError) {
        // 답안 자체는 저장됐다. 카운터만 어긋나므로 실패로 보고하지 않고 경고만 남긴다.
        console.warn("[saveAnswer] upsert_user_stats 실패:", rpcError.message);
      }
    }
    return { ok: true };
  } catch (err) {
    console.warn("[saveAnswer] 저장 실패:", err.message);
    return { ok: false, error: err.message };
  }
}

// 발주 F-61 (A′): 오답 패턴을 서버가 채우게 한다.
//   보내는 것은 "무엇을 골랐는가" 뿐이다 — pat 은 요청에도 응답에도 없다.
//   답안 저장이 끝난 뒤 세트 단위로 한 번 호출한다.
//   실패해도 답안은 이미 저장돼 있다. pat 만 null 로 남는다(F-61 이전과 같은 최악).
export async function fillAnswerPatterns({ user, yearKey, setId, items }) {
  if (!user || !yearKey || !setId || !items?.length) {
    return { ok: true, skipped: true };
  }
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return { ok: false, error: "no_session" };
    const res = await fetch("/api/answer-pat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ yearKey, setId, items }),
    });
    if (!res.ok) {
      console.warn("[fillAnswerPatterns] 실패:", res.status);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[fillAnswerPatterns] 실패:", err.message);
    return { ok: false, error: err.message };
  }
}

export async function updateReviewResult({ user, answer, isCorrect }) {
  if (!user || !answer) return { error: new Error("missing user or answer") };

  const currentCount = answer.review_count ?? 0;
  const nextCount = isCorrect ? currentCount + 1 : 0;
  const payload = {
    reviewed_at: new Date().toISOString(),
    review_count: nextCount,
    next_review: getNextReview(nextCount),
    is_correct: isCorrect,
  };

  return await supabase
    .from("user_answers")
    .update(payload)
    .eq("user_id", user.id)
    .eq("year_key", answer.year_key)
    .eq("set_id", answer.set_id)
    .eq("question_id", answer.question_id)
    .select("*")
    .single();
}

async function findExistingAnswer({ userId, yearKey, setId, questionId }) {
  const { data, error } = await supabase
    .from("user_answers")
    .select("id, review_count, attempt_count")
    .eq("user_id", userId)
    .eq("year_key", yearKey)
    .eq("set_id", setId)
    .eq("question_id", questionId)
    .order("answered_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

export function getNextReview(reviewCount) {
  const days = [3, 7, 14, 30];
  const d = days[Math.min(reviewCount, days.length - 1)];
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString();
}

// daily MVP: 세트 완료 진도 (user_progress) — 세트 마지막 문항 채점 시 upsert.
//   PK (user_id, year_key, set_id) — setId 연도·A/B형 충돌 회피 (composite).
export async function saveSetProgress({ user, yearKey, setId }) {
  if (!user || !yearKey || !setId) return;
  try {
    await supabase.from("user_progress").upsert(
      {
        user_id: user.id,
        year_key: yearKey,
        set_id: setId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,year_key,set_id" },
    );
  } catch (err) {
    console.warn("[saveSetProgress] 저장 실패:", err.message);
  }
}

// daily MVP: 로그인 유저 완료 세트 전체 조회.
//   테이블 미생성/오류 시 [] graceful (앱 무중단).
export async function fetchProgress(user) {
  if (!user) return [];
  try {
    const { data, error } = await supabase
      .from("user_progress")
      .select("year_key, set_id, completed_at")
      .eq("user_id", user.id);
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.warn("[fetchProgress] 조회 실패:", err.message);
    return [];
  }
}
