// TodayPanel — daily MVP "오늘의 학습" 카드 (리텐션 검증용, 얇게)
//   1) 다음 미완료 세트 1~2개 (RELEASE_KEYS 선언 순 — 추천 알고리즘 X)
//   2) streak (user_progress.completed_at 날짜들 → 연속 학습일)
//   비로그인: 렌더 생략 (로그인 사용자 우선 — 발주).
//   데이터/all_data 무접촉. Supabase user_progress 단독 의존.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProgress } from "./hooks/useAnswerTracker";
import { getReleasedSetList } from "./dataLoader";

// completed_at(로컬 날짜)들로 현재 연속 학습일 계산.
//   오늘 or 어제부터 하루씩 뒤로 연속된 날 수 (오늘 미완료여도 어제까지면 유지).
function computeStreak(dates) {
  const key = (dt) => `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
  const days = new Set(dates.map((d) => key(new Date(d))));
  if (days.size === 0) return 0;
  const cursor = new Date();
  if (!days.has(key(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(key(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function TodayPanel({ user }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null); // null=로딩, []=없음

  useEffect(() => {
    let alive = true;
    if (!user) {
      setProgress([]);
      return;
    }
    fetchProgress(user).then((rows) => {
      if (alive) setProgress(rows);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const completedKeys = useMemo(
    () => new Set((progress ?? []).map((r) => `${r.year_key}::${r.set_id}`)),
    [progress],
  );

  const nextSets = useMemo(
    () =>
      getReleasedSetList()
        .filter((s) => !completedKeys.has(`${s.yearKey}::${s.setId}`))
        .slice(0, 2),
    [completedKeys],
  );

  const streak = useMemo(
    () => computeStreak((progress ?? []).map((r) => r.completed_at)),
    [progress],
  );

  // 비로그인: 진도/streak 미표시. 로딩 중에도 렌더 생략 (레이아웃 흔들림 방지).
  if (!user || progress === null) return null;

  return (
    <div
      style={{
        maxWidth: "760px",
        margin: "18px auto 0",
        padding: "0 18px",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <div
        style={{
          background: "#fffaf3",
          border: "1px solid #e7ddc8",
          borderRadius: "16px",
          padding: "18px 20px",
          boxShadow: "0 6px 22px rgba(45,30,18,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
            gap: "10px",
          }}
        >
          <span
            style={{ fontSize: "1rem", fontWeight: "800", color: "#211310" }}
          >
            오늘의 학습
          </span>
          {streak > 0 && (
            <span
              style={{
                fontSize: "0.82rem",
                fontWeight: "800",
                color: "#c2410c",
                background: "#fff2e8",
                border: "1px solid #fed7aa",
                borderRadius: "999px",
                padding: "3px 12px",
                whiteSpace: "nowrap",
              }}
            >
              🔥 {streak}일째
            </span>
          )}
        </div>

        {nextSets.length === 0 ? (
          <div style={{ fontSize: "0.86rem", color: "#6b7280" }}>
            출시된 세트를 모두 완료했어요. 오늘도 꾸준히 이어가고 있어요 👏
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {nextSets.map((s, i) => (
              <button
                key={`${s.yearKey}::${s.setId}`}
                onClick={() =>
                  navigate(
                    `/viewer?year=${encodeURIComponent(s.yearKey)}&set=${
                      s.setId
                    }&q=1&mode=study`,
                  )
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: i === 0 ? "#2d5b46" : "#fff",
                  color: i === 0 ? "#fff" : "#2d5b46",
                  border: i === 0 ? "none" : "1.5px solid #cfe3d8",
                  fontWeight: "700",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  fontFamily: "'Noto Sans KR', sans-serif",
                  textAlign: "left",
                }}
              >
                <span>
                  {i === 0 ? "이어서 풀기 · " : "다음 · "}
                  {s.yearKey}
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
