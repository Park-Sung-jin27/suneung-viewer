import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import { P, YEAR_INFO } from "./constants";
import { updateReviewResult } from "./hooks/useAnswerTracker";

const COLORS = {
  beige: "#f9f5ed",
  beigeDark: "#e8e0d0",
  green: "#2d6e2d",
  greenLight: "#f2f7f2",
  greenBorder: "#7aad7a",
  text: "#1a1a14",
  textLight: "#6b7280",
  wrong: "#c0392b",
  wrongBg: "#fdf5f5",
};

function findSetTitle(allData, setId) {
  if (!allData) return setId;
  for (const yearData of Object.values(allData)) {
    for (const sec of ["reading", "literature"]) {
      const found = (yearData[sec] || []).find((s) => s.id === setId);
      if (found) return found.title || found.id;
    }
  }
  return setId;
}

// 큐 모드 안 question + set 단독 lookup path. allData 부재 시 null path 정합.
function findQuestion(allData, yearKey, setId, questionId) {
  if (!allData || !yearKey) return null;
  const yd = allData[yearKey];
  if (!yd) return null;
  for (const sec of ["reading", "literature"]) {
    const set = (yd[sec] || []).find((s) => (s.setId || s.id) === setId);
    if (!set) continue;
    const q = (set.questions || []).find(
      (x) => String(x.id) === String(questionId),
    );
    if (q) return { set, q };
  }
  return null;
}

function isReviewDue(nextReview) {
  if (!nextReview) return false;
  return new Date(nextReview) <= new Date();
}

function PatternBadge({ pat }) {
  if (pat == null || !P[pat]) return null;
  const p = P[pat];
  return (
    <span
      style={{
        fontSize: "0.68rem",
        fontWeight: "700",
        color: p.color,
        background: p.bg,
        border: `1px solid ${p.color}55`,
        borderRadius: "4px",
        padding: "1px 6px",
        whiteSpace: "nowrap",
      }}
    >
      {pat} {p.name}
    </span>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: "20px",
        border: active
          ? `1.5px solid ${COLORS.green}`
          : `1px solid ${COLORS.greenBorder}`,
        background: active ? COLORS.green : COLORS.greenLight,
        color: active ? "#fff" : COLORS.green,
        fontSize: "0.78rem",
        fontWeight: active ? "700" : "500",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

export default function WrongNote({ user, allData, onGoToQuestion }) {
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState("all");
  const [patFilter, setPatFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  // 복습 큐 (SRS 인터벌 기반 — 기존 next_review / review_count 컬럼 단독 source).
  //   mode='list' (기본 path) / 'queue' (연속 풀이 모드 path).
  //   queueSnapshot = '복습 시작' 시점 안 due items 스냅샷 path
  //   (큐 진행 중 갱신 path 안 인덱스 결정 정합 — race 회피 path).
  const [mode, setMode] = useState("list");
  const [queueSnapshot, setQueueSnapshot] = useState([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [queueDone, setQueueDone] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_answers")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_correct", false)
        .order("answered_at", { ascending: false });
      if (error) {
        console.warn("[WrongNote] 조회 실패:", error.message);
        setAnswers([]);
      } else {
        setAnswers(data || []);
      }
      setLoading(false);
    })();
  }, [user]);

  const filtered = answers.filter((a) => {
    if (yearFilter !== "all" && a.year_key !== yearFilter) return false;
    if (patFilter !== "all" && String(a.pat) !== patFilter) return false;
    return true;
  });

  const yearKeys = [...new Set(answers.map((a) => a.year_key))];
  const patKeys = [
    ...new Set(answers.map((a) => a.pat).filter((p) => p != null)),
  ].sort();

  // due 항목 단독 (isReviewDue=true) 안 큐 시작 path 정합. answered_at
  // 오름차순 path 안 가장 오래된 due 항목 단독 우선 정합 (SRS path 정합).
  const dueItems = useMemo(
    () =>
      answers
        .filter((a) => isReviewDue(a.next_review))
        .sort((a, b) =>
          (a.answered_at || "") < (b.answered_at || "") ? -1 : 1,
        ),
    [answers],
  );

  function startQueue() {
    if (dueItems.length === 0) return;
    setQueueSnapshot(dueItems);
    setQueueIdx(0);
    setQueueDone({ correct: 0, total: dueItems.length });
    setMode("queue");
  }

  function exitQueue() {
    setMode("list");
    setQueueSnapshot([]);
    setQueueIdx(0);
  }

  async function handleQueueResult(isCorrect) {
    const cur = queueSnapshot[queueIdx];
    if (!cur || updatingId) return;
    setUpdatingId(cur.id);
    const { data, error } = await updateReviewResult({
      user,
      answer: cur,
      isCorrect,
    });
    if (error) {
      console.warn("[WrongNote queue] 복습 갱신 실패:", error.message);
    } else {
      if (isCorrect) {
        setAnswers((prev) => prev.filter((item) => item.id !== cur.id));
      } else if (data) {
        setAnswers((prev) =>
          prev.map((item) => (item.id === cur.id ? data : item)),
        );
      }
      setQueueDone((prev) => ({
        ...prev,
        correct: prev.correct + (isCorrect ? 1 : 0),
      }));
    }
    setUpdatingId(null);
    // 다음 path — 끝 path 안 결과 카드 단독 노출 path 정합.
    if (queueIdx + 1 >= queueSnapshot.length) {
      setQueueIdx(queueSnapshot.length); // 결과 카드 sentinel path
    } else {
      setQueueIdx(queueIdx + 1);
    }
  }

  function skipQueueItem() {
    if (queueIdx + 1 >= queueSnapshot.length) {
      setQueueIdx(queueSnapshot.length);
    } else {
      setQueueIdx(queueIdx + 1);
    }
  }

  async function handleReviewResult(e, answer, isCorrect) {
    e.stopPropagation();
    if (!answer || updatingId) return;

    setUpdatingId(answer.id);
    const { data, error } = await updateReviewResult({
      user,
      answer,
      isCorrect,
    });
    if (error) {
      console.warn("[WrongNote] 복습 갱신 실패:", error.message);
    } else if (isCorrect) {
      setAnswers((prev) => prev.filter((item) => item.id !== answer.id));
    } else if (data) {
      setAnswers((prev) =>
        prev.map((item) => (item.id === answer.id ? data : item)),
      );
    }
    setUpdatingId(null);
  }

  if (!user) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          color: COLORS.textLight,
        }}
      >
        <p style={{ fontSize: "0.9rem" }}>
          로그인 후 오답 노트를 확인할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.beige,
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 헤더 */}
      <div
        style={{
          padding: "32px 24px 20px",
          background: "#fff",
          borderBottom: `2px solid ${COLORS.greenBorder}`,
        }}
      >
        <h2
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: "1.3rem",
            fontWeight: "700",
            color: COLORS.green,
            margin: "0 0 6px",
          }}
        >
          오답 노트
        </h2>
        <p style={{ fontSize: "0.82rem", color: COLORS.textLight, margin: 0 }}>
          틀린 문제를 다시 풀어보세요
        </p>
      </div>

      {/* 복습 큐 시작 배너 — list 모드 안 due 항목 1건+ path 단독 노출 */}
      {mode === "list" && dueItems.length > 0 && (
        <div
          style={{
            margin: "14px 20px 0",
            padding: "14px 16px",
            background: "#fff5eb",
            border: `1px solid #fbbf24`,
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
            maxWidth: "640px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div
              style={{
                fontSize: "0.86rem",
                fontWeight: "700",
                color: "#92400e",
              }}
            >
              🎯 복습 큐 {dueItems.length}건
            </div>
            <div style={{ fontSize: "0.72rem", color: "#b45309" }}>
              지금 복습하면 가장 효과적인 문제들이에요. 한 문제씩 차근차근
              복습해 보세요.
            </div>
          </div>
          <button
            onClick={startQueue}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              background: "#f59e0b",
              color: "#fff",
              border: "none",
              fontSize: "0.82rem",
              fontWeight: "700",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            복습 시작
          </button>
        </div>
      )}

      {/* 큐 모드 — 연속 풀이 단독 view path */}
      {mode === "queue" &&
        (() => {
          const isDone = queueIdx >= queueSnapshot.length;
          const cur = isDone ? null : queueSnapshot[queueIdx];
          const ctx = cur
            ? findQuestion(allData, cur.year_key, cur.set_id, cur.question_id)
            : null;
          const q = ctx?.q;
          const set = ctx?.set;
          const yearMeta = cur
            ? YEAR_INFO.find((y) => y.key === cur.year_key)
            : null;
          const userChoice = q?.choices?.find(
            (c) => Number(c.num) === Number(cur?.choice_num),
          );
          const correctChoice = q?.choices?.find(
            (c) => Number(c.num) === Number(cur?.correct_choice_num),
          );
          return (
            <div
              style={{
                maxWidth: "640px",
                margin: "0 auto",
                padding: "16px 20px 40px",
              }}
            >
              {/* 진척 + 종료 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: "700",
                    color: COLORS.green,
                  }}
                >
                  복습 큐 {isDone ? queueSnapshot.length : queueIdx + 1}/
                  {queueSnapshot.length}
                </span>
                <button
                  onClick={exitQueue}
                  style={{
                    fontSize: "0.72rem",
                    background: "none",
                    border: `1px solid ${COLORS.beigeDark}`,
                    borderRadius: "6px",
                    padding: "4px 10px",
                    color: COLORS.textLight,
                    cursor: "pointer",
                  }}
                >
                  목록으로
                </button>
              </div>
              {isDone ? (
                <div
                  style={{
                    background: "#fff",
                    border: `1px solid ${COLORS.greenBorder}`,
                    borderRadius: "14px",
                    padding: "32px 24px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2rem", marginBottom: "12px" }}>
                    🎉
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: "700",
                      color: COLORS.green,
                      marginBottom: "6px",
                    }}
                  >
                    복습 완료!
                  </div>
                  <div
                    style={{
                      fontSize: "0.82rem",
                      color: COLORS.textLight,
                      marginBottom: "16px",
                    }}
                  >
                    맞춤 {queueDone.correct} / 총 {queueDone.total} 건
                  </div>
                  <button
                    onClick={exitQueue}
                    style={{
                      padding: "8px 20px",
                      borderRadius: "8px",
                      background: COLORS.green,
                      color: "#fff",
                      border: "none",
                      fontSize: "0.82rem",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    목록으로 돌아가기
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    background: "#fff",
                    border: `1px solid ${COLORS.beigeDark}`,
                    borderLeft: `4px solid ${COLORS.wrong}`,
                    borderRadius: "12px",
                    padding: "16px 18px",
                  }}
                >
                  {/* 메타: 연도 + 세트 + 문항 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    {yearMeta && (
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: yearMeta.color,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: "600",
                        color: COLORS.text,
                      }}
                    >
                      {yearMeta?.label ?? cur.year_key}
                    </span>
                    <span
                      style={{ fontSize: "0.74rem", color: COLORS.textLight }}
                    >
                      {set?.title ?? cur.set_id}
                    </span>
                    {cur.pat != null && <PatternBadge pat={cur.pat} />}
                  </div>
                  {/* 문항 번호 + 발문 */}
                  <div
                    style={{
                      fontSize: "0.92rem",
                      fontWeight: "700",
                      color: COLORS.text,
                      marginBottom: "10px",
                      lineHeight: 1.5,
                    }}
                  >
                    Q{cur.question_id}.{" "}
                    {q?.t ||
                      "(문항을 불러올 수 없어요 — '지문 다시 보기'를 눌러 확인하세요)"}
                  </div>
                  {/* 사용자 오답 / 정답 비교 */}
                  {userChoice && (
                    <div
                      style={{
                        fontSize: "0.82rem",
                        color: COLORS.wrong,
                        marginBottom: "6px",
                        padding: "6px 8px",
                        background: COLORS.wrongBg,
                        borderRadius: "6px",
                        lineHeight: 1.5,
                      }}
                    >
                      ✗ 내 선택 {cur.choice_num}번:{" "}
                      <span style={{ color: COLORS.text }}>{userChoice.t}</span>
                    </div>
                  )}
                  {correctChoice && (
                    <div
                      style={{
                        fontSize: "0.82rem",
                        color: COLORS.green,
                        marginBottom: "12px",
                        padding: "6px 8px",
                        background: COLORS.greenLight,
                        borderRadius: "6px",
                        lineHeight: 1.5,
                      }}
                    >
                      ✓ 정답 {cur.correct_choice_num}번:{" "}
                      <span style={{ color: COLORS.text }}>
                        {correctChoice.t}
                      </span>
                    </div>
                  )}
                  {/* 액션 — 지문 보기 + O/X/skip */}
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() =>
                        onGoToQuestion?.(
                          cur.year_key,
                          cur.set_id,
                          cur.question_id,
                        )
                      }
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: `1px solid ${COLORS.beigeDark}`,
                        background: "#fff",
                        color: COLORS.textLight,
                        fontSize: "0.76rem",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      📖 지문 다시 보기
                    </button>
                    <span style={{ flex: 1 }} />
                    <button
                      onClick={() => handleQueueResult(false)}
                      disabled={updatingId === cur.id}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "6px",
                        border: "1px solid #f2b8b5",
                        background: "#fff5f5",
                        color: COLORS.wrong,
                        fontSize: "0.78rem",
                        fontWeight: "700",
                        cursor:
                          updatingId === cur.id ? "not-allowed" : "pointer",
                      }}
                    >
                      ✗ 또 틀렸어요
                    </button>
                    <button
                      onClick={() => handleQueueResult(true)}
                      disabled={updatingId === cur.id}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "6px",
                        border: `1px solid ${COLORS.greenBorder}`,
                        background: COLORS.green,
                        color: "#fff",
                        fontSize: "0.78rem",
                        fontWeight: "700",
                        cursor:
                          updatingId === cur.id ? "not-allowed" : "pointer",
                      }}
                    >
                      ✓ 맞췄어요
                    </button>
                    <button
                      onClick={skipQueueItem}
                      disabled={updatingId === cur.id}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: `1px solid ${COLORS.beigeDark}`,
                        background: "#fff",
                        color: COLORS.textLight,
                        fontSize: "0.74rem",
                        fontWeight: "600",
                        cursor:
                          updatingId === cur.id ? "not-allowed" : "pointer",
                      }}
                    >
                      건너뛰기
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {/* 필터 + 컨텐츠 — list 모드 단독 path */}
      {mode === "list" && (
        <>
          <div
            style={{
              padding: "14px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              <FilterChip
                label="전체"
                active={yearFilter === "all"}
                onClick={() => setYearFilter("all")}
              />
              {yearKeys.map((yk) => {
                const meta = YEAR_INFO.find((y) => y.key === yk);
                return (
                  <FilterChip
                    key={yk}
                    label={meta?.label ?? yk}
                    active={yearFilter === yk}
                    onClick={() => setYearFilter(yk)}
                  />
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                gap: "6px",
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              <FilterChip
                label="전체 패턴"
                active={patFilter === "all"}
                onClick={() => setPatFilter("all")}
              />
              {patKeys.map((pk) => (
                <FilterChip
                  key={pk}
                  label={`${pk} ${P[pk]?.name ?? ""}`}
                  active={patFilter === String(pk)}
                  onClick={() => setPatFilter(String(pk))}
                />
              ))}
            </div>
          </div>

          {/* 컨텐츠 */}
          <div
            style={{
              padding: "0 20px 40px",
              maxWidth: "640px",
              margin: "0 auto",
            }}
          >
            {loading ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    margin: "0 auto 12px",
                    border: `3px solid ${COLORS.beigeDark}`,
                    borderTop: `3px solid ${COLORS.green}`,
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                <span style={{ fontSize: "0.85rem", color: COLORS.textLight }}>
                  불러오는 중...
                </span>
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 24px",
                  background: "#fff",
                  borderRadius: "14px",
                  border: `1px solid ${COLORS.beigeDark}`,
                  marginTop: "14px",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🎉</div>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: COLORS.textLight,
                    margin: 0,
                  }}
                >
                  {answers.length === 0
                    ? "아직 틀린 문제가 없습니다"
                    : "필터 조건에 맞는 오답이 없습니다"}
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginTop: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: COLORS.textLight,
                    padding: "0 2px",
                  }}
                >
                  {filtered.length}개 오답
                </div>

                {filtered.map((a) => {
                  const meta = YEAR_INFO.find((y) => y.key === a.year_key);
                  const setTitle = findSetTitle(allData, a.set_id);
                  const reviewDue = isReviewDue(a.next_review);

                  return (
                    <div
                      key={a.id}
                      onClick={() =>
                        onGoToQuestion?.(a.year_key, a.set_id, a.question_id)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          onGoToQuestion?.(a.year_key, a.set_id, a.question_id);
                      }}
                      role="button"
                      tabIndex={0}
                      style={{
                        background: reviewDue ? COLORS.wrongBg : "#fff",
                        border: `1px solid ${reviewDue ? COLORS.wrong + "44" : COLORS.beigeDark}`,
                        borderLeft: `4px solid ${COLORS.wrong}`,
                        borderRadius: "12px",
                        padding: "14px 16px",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        outline: "none",
                      }}
                    >
                      {/* 상단: 연도 + 날짜 + 복습 뱃지 */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {meta && (
                          <span
                            style={{
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              background: meta.color,
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: "600",
                            color: COLORS.text,
                          }}
                        >
                          {meta?.label ?? a.year_key}
                        </span>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: COLORS.textLight,
                            marginLeft: "auto",
                          }}
                        >
                          {new Date(a.answered_at).toLocaleDateString("ko-KR", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        {reviewDue && (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: "700",
                              color: "#fff",
                              background: "#e67e22",
                              borderRadius: "4px",
                              padding: "1px 6px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            복습 필요
                          </span>
                        )}
                      </div>

                      {/* 중단: 세트 제목 */}
                      <div
                        style={{
                          fontSize: "0.88rem",
                          fontWeight: "600",
                          color: COLORS.text,
                        }}
                      >
                        {setTitle}
                      </div>

                      {/* 하단: 문항번호 + 선택 선지 + 패턴 */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: "700",
                            color: COLORS.wrong,
                          }}
                        >
                          {a.question_id}번 문항
                        </span>
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: COLORS.textLight,
                          }}
                        >
                          선택: {a.choice_num}번
                        </span>
                        {a.pat != null && <PatternBadge pat={a.pat} />}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginTop: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={(e) => handleReviewResult(e, a, true)}
                          disabled={updatingId === a.id}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: `1px solid ${COLORS.greenBorder}`,
                            background: COLORS.greenLight,
                            color: COLORS.green,
                            fontSize: "0.74rem",
                            fontWeight: "700",
                            cursor:
                              updatingId === a.id ? "not-allowed" : "pointer",
                          }}
                        >
                          복습 완료
                        </button>
                        <button
                          onClick={(e) => handleReviewResult(e, a, false)}
                          disabled={updatingId === a.id}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #f2b8b5",
                            background: "#fff5f5",
                            color: COLORS.wrong,
                            fontSize: "0.74rem",
                            fontWeight: "700",
                            cursor:
                              updatingId === a.id ? "not-allowed" : "pointer",
                          }}
                        >
                          다시 틀림
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
