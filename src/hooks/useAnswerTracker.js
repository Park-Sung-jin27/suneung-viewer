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
  pat,
  timeSpent,
}) {
  if (!user) return;

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
      pat: isCorrect ? null : pat,
      time_spent: Number.isFinite(timeSpent) ? timeSpent : null,
      next_review: nextReview,
      review_count: reviewCount,
      attempt_count: nextAttempt,
      answered_at: now,
    };

    if (existing?.id) {
      await supabase.from("user_answers").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("user_answers").insert(payload);
      await supabase.rpc("upsert_user_stats", {
        p_user_id: user.id,
        p_correct: isCorrect,
      });
    }
  } catch (err) {
    console.warn("[saveAnswer] 저장 실패:", err.message);
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
