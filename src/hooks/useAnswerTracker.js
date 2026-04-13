import { supabase } from "../supabase";

export async function saveAnswer({
  user,
  yearKey,
  setId,
  questionId,
  choiceNum,
  isCorrect,
  pat,
}) {
  if (!user) return;

  try {
    // 1. user_answers 저장
    const nextReview = isCorrect ? null : getNextReview(0);
    await supabase.from("user_answers").upsert(
      {
        user_id: user.id,
        year_key: yearKey,
        set_id: setId,
        question_id: questionId,
        choice_num: choiceNum,
        is_correct: isCorrect,
        pat: isCorrect ? null : pat,
        next_review: nextReview,
        review_count: 0,
        answered_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,set_id,question_id",
        ignoreDuplicates: false,
      },
    );

    // 2. user_stats 업데이트
    await supabase.rpc("upsert_user_stats", {
      p_user_id: user.id,
      p_correct: isCorrect,
    });
  } catch (err) {
    console.warn("[saveAnswer] 저장 실패:", err.message);
  }
}

// 스페이스드 리피티션: 0회→3일, 1회→7일, 2회→14일
function getNextReview(reviewCount) {
  const days = [3, 7, 14, 30];
  const d = days[Math.min(reviewCount, days.length - 1)];
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString();
}
