import { supabase } from "./supabase";

// 선지별 형광펜 근거 납득률 KPI (베타 측정용)
//   Supabase public.evidence_feedback INSERT.
//   RLS: anon/authenticated 모두 insert 허용 (사용자 별도 정정).
//   실패 시 console.warn — 사용자 노출 0 (KPI 누락은 silent fail).
export async function saveEvidenceFeedback({
  user,
  yearKey,
  setId,
  questionId,
  choiceNum,
  vote,
}) {
  try {
    await supabase.from("evidence_feedback").insert({
      user_id: user?.id ?? null,
      year_key: yearKey,
      set_id: setId,
      question_id: questionId,
      choice_num: choiceNum,
      vote,
    });
  } catch (err) {
    console.warn("[saveEvidenceFeedback] 실패:", err.message);
  }
}
