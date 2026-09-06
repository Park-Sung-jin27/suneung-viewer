// src/patternClassify.js — 오답 3분류 + 패턴 표시 임계 (발주 F-65 ③)
//
//   같은 규칙을 세 곳이 쓴다 — 리포트 화면 · 백필 스크립트 · (추후) 오답노트.
//   규칙이 갈리면 화면과 DB 가 다른 말을 하므로 여기가 단일 정본이다.
//
//   ★ 이 모듈은 순수하게 유지한다. supabase·React 를 들이지 않는다
//     (scripts/ 와 api/ 에서도 import 하기 때문이다 — src/supabase.js 는
//      import.meta.env 를 써서 Node 에서 못 읽는다).

// 패턴 표시 임계 — 상수로 분리해 둔다(발주 F-65 ③: 추후 조정 가능하게).
//   1회는 우연과 구분되지 않는다. 1회를 「핵심 취약 패턴」으로 단정하면
//   학생 셋 중 둘에게 근거 없는 처방을 내리게 된다.
export const PATTERN_THRESHOLDS = { confirmed: 3, watching: 2 };

// 발생 횟수 → 표시 단계
//   확정: 전면 표시 + 훈련 처방 연결
//   관찰: 배지만. 훈련 처방은 붙이지 않는다
//   집계: 숫자에만 포함
export function patternTier(count) {
  const n = Number(count) || 0;
  if (n >= PATTERN_THRESHOLDS.confirmed) return "확정";
  if (n >= PATTERN_THRESHOLDS.watching) return "관찰";
  return "집계";
}

// 좌표 → 선지. api/_sourceData.js · 백필 스크립트와 같은 규율이다.
//   ★ setId 는 회차 간 충돌한다(l20146a 가 2014_6월A·B 양쪽에 있다).
//     yearKey 를 반드시 함께 본다.
//   source 는 { [yearKey]: yearData } 모양이면 된다 — 통짜든 loadYears 결과든 같다.
export function findChoice(source, yearKey, setId, questionId, choiceNum) {
  const yd = source?.[yearKey];
  if (!yd) return null;
  for (const section of ["reading", "literature"]) {
    const set = (yd[section] ?? []).find((s) => s.id === setId);
    if (!set) continue;
    const q = (set.questions ?? []).find(
      (x) => String(x.id) === String(questionId),
    );
    if (!q) return null;
    const c = (q.choices ?? []).find((x) => Number(x.num) === Number(choiceNum));
    return c ? { set, question: q, choice: c } : null;
  }
  return null;
}

// 오답 한 건의 분류. 이 순서로 판정한다(발주 F-65 ③).
//   ⑴ 패턴   pat 있음
//   ⑵ 실수   pat null · questionType="negative" · 고른 선지가 원본 ok===true
//            「적절하지 않은 것은?」에서 결함 없는 선지를 고른 것이다.
//   ⑶ 미분류 나머지 — 원본에 좌표가 없는 초기 베타 기록(2026수능 s1~s3) 등
//
//   ★ source 가 없으면(아직 로드 전) pat 있는 것만 「패턴」이고 나머지는 미분류다.
//     추측해서 「실수」로 올리지 않는다 — 근거가 없는 단정이 된다.
export function classifyWrong(answer, source) {
  if (!answer) return "미분류";
  if (answer.pat != null && String(answer.pat) !== "") return "패턴";
  const hit = findChoice(
    source,
    answer.year_key,
    answer.set_id,
    answer.question_id,
    answer.choice_num,
  );
  if (!hit) return "미분류";
  if (answer.question_type === "negative" && hit.choice.ok === true) {
    return "실수";
  }
  return "미분류";
}

// 오답 목록 → 분류별 건수. 합계 검산용으로 total 도 함께 낸다.
//   ★ 정답 행은 세지 않는다. 입력이 전체 답안이어도 여기서 거른다.
export function countByClass(answers, source) {
  const out = { 패턴: 0, 실수: 0, 미분류: 0, total: 0 };
  for (const a of answers ?? []) {
    if (a?.is_correct) continue;
    out.total += 1;
    out[classifyWrong(a, source)] += 1;
  }
  return out;
}
