// ============================================================
// PatternReport.jsx — 오답 패턴 리포트 + AI 코칭 + 기출 패턴 훈련
// ============================================================

import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import { P, P0, YEAR_INFO } from "./constants";
import PatternCoach from "./PatternCoach";
import { loadYears, sectionOfSet, isReleaseSet } from "./dataLoader";

const C = {
  green: "#2d6e2d",
  soft: "#3d8b3d",
  bg: "#f0f7f0",
  line: "#7aad7a",
  ink: "#0d1a0e",
  inkMid: "#253226",
  muted: "#5a6b5b",
  subtle: "#8a9b8b",
  paper: "#faf8f4",
  white: "#ffffff",
  border: "#e0dbd0",
};

const READING_PATS = ["R1", "R2", "R3", "R4"];
const LIT_PATS = ["L1", "L2", "L3", "L4", "L5"];

// ISO week key (Mon-start) — "YYYY-Wxx" path. 답안 안 answered_at 단독 기준.
//   주별 정답률 추세 path 안 결정적 bucket key 정합.
function isoWeekKey(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// 사용자 표기 path: "YYYY-Wxx" → "M/D 주" 단독 (가장 최근 6주 단독 표기).
function isoWeekLabel(wk) {
  const m = (wk || "").match(/^(\d{4})-W(\d{2})$/);
  if (!m) return wk || "";
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  // ISO week → Monday date
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayOfWeek = simple.getUTCDay() || 7;
  const mon = new Date(simple);
  mon.setUTCDate(simple.getUTCDate() - dayOfWeek + 1);
  return `${mon.getUTCMonth() + 1}/${mon.getUTCDate()}`;
}

// ── 요약 카드 ────────────────────────────────────────────────
function SummaryCard({ label, value, sub }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: "12px",
        padding: "16px 12px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "1.45rem",
          fontWeight: "800",
          color: C.green,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.7rem",
          color: C.muted,
          marginTop: "5px",
          fontWeight: "500",
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: "0.65rem", color: C.line, marginTop: "2px" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── 패턴 바 ──────────────────────────────────────────────────
function PatternBar({ patKey, count, maxCount, isTop, onCoach, onTrain }) {
  const info = P[patKey] ?? P0;
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: "700",
            color: info.color,
            background: info.bg,
            border: `1px solid ${info.color}44`,
            borderRadius: "4px",
            padding: "1px 7px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {patKey}
        </span>
        <span
          style={{
            fontSize: "0.82rem",
            fontWeight: "600",
            color: C.ink,
            flex: 1,
          }}
        >
          {info.name}
        </span>
        {isTop && (
          <span
            style={{
              fontSize: "0.63rem",
              fontWeight: "700",
              color: "#fff",
              background: "#c0392b",
              borderRadius: "4px",
              padding: "1px 6px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            주요 약점
          </span>
        )}
        <span style={{ fontSize: "0.75rem", color: C.muted, flexShrink: 0 }}>
          {count}회
        </span>
      </div>
      <div
        style={{
          background: C.border,
          borderRadius: "4px",
          height: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: info.color,
            borderRadius: "4px",
            transition: "width 0.5s ease",
            minWidth: count > 0 ? "4px" : "0",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
        }}
      >
        <div style={{ fontSize: "0.67rem", color: C.muted, flex: 1 }}>
          {info.desc}
        </div>
        <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
          {/* 훈련하기 버튼 — 항상 표시 */}
          <button
            onClick={() => onTrain(patKey)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 10px",
              background: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #93c5fd",
              borderRadius: "5px",
              fontSize: "0.68rem",
              fontWeight: "700",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            🎯 훈련
          </button>
          <button
            onClick={() => onCoach(patKey)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 10px",
              background: isTop ? info.color : "#F9FAFB",
              color: isTop ? "#fff" : info.color,
              border: `1px solid ${info.color}66`,
              borderRadius: "5px",
              fontSize: "0.68rem",
              fontWeight: "700",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            🤖 코칭
          </button>
        </div>
      </div>
    </div>
  );
}

// ── YearBar ──────────────────────────────────────────────────
function YearBar({ yearKey, correct, total }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const meta = YEAR_INFO.find((y) => y.key === yearKey);
  const color = meta?.color ?? C.green;
  function fmt(k) {
    if (k.includes("_")) {
      const [y, m] = k.split("_");
      return y + "학년도 " + m;
    }
    return k.replace("수능", "학년도 수능");
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "0.78rem", fontWeight: "600", color: C.ink }}>
          {fmt(yearKey)}
        </span>
        <span style={{ fontSize: "0.72rem", color: C.muted }}>
          {pct}% ({correct}/{total})
        </span>
      </div>
      <div
        style={{
          background: C.border,
          borderRadius: "4px",
          height: "10px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: "4px",
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </div>
  );
}

// ── 한 줄 총평 ───────────────────────────────────────────────
const COMMENTS = {
  R1: "수치·상태·방향을 뒤바꾼 함정에 자주 당합니다. 선지와 지문의 구체적 수치를 직접 대조하세요.",
  R2: "주체-객체, 원인-결과 관계를 전도한 함정에 취약합니다. 방향성을 체크하세요.",
  R3: "지문에 없는 내용을 추론한 함정에 취약합니다. 근거 없는 선지는 바로 제거하세요.",
  R4: "서로 다른 문단의 개념을 섞은 함정에 취약합니다. 각 선지 요소를 지문과 하나씩 대조하세요.",
  L1: "시어·이미지·수사법을 잘못 파악하는 경향이 있습니다. 문맥 속 표현 효과를 꼼꼼히 파악하세요.",
  L2: "화자·인물의 정서와 태도를 반대로 파악합니다. 전체 흐름 속에서 심리를 읽으세요.",
  L3: "작품에 없는 의미를 도출하는 함정에 취약합니다. 근거 없는 확대 해석을 경계하세요.",
  L4: "시점·구성·대비 구조를 잘못 설명하는 함정에 취약합니다. 구조를 먼저 파악하세요.",
  L5: "보기 조건을 작품에 잘못 대입하는 함정에 취약합니다. 보기 조건을 꼼꼼히 확인하세요.",
};

// ══════════════════════════════════════════════
// [기출 패턴 훈련 모달]
// ══════════════════════════════════════════════
function sourceKeyOf(item) {
  return [
    item.sourceYearKey ?? item.source_year_key,
    item.sourceSetId ?? item.source_set_id,
    item.sourceQuestionId ?? item.source_question_id,
    item.sourceChoiceNum ?? item.source_choice_num,
  ].join("|");
}

function isUsableTrainingSentence(text) {
  const value = String(text ?? "").trim();
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 8) return false;
  if (/^[㉠-㉿ⓐ-ⓩ①-⑳]+$/.test(compact)) return false;
  return /[가-힣A-Za-z0-9]/.test(value);
}

function rowToTrainingQuestion(row) {
  return {
    id: row.id,
    source: "bank",
    passage: row.passage,
    sentence: row.sentence,
    isCorrect: row.is_correct === true,
    evidenceSentence: row.evidence_sentence ?? "",
    explanation: row.explanation ?? "",
    sourceLabel: row.source_label ?? "저장된 훈련 문제",
    sourceYearKey: row.source_year_key,
    sourceSetId: row.source_set_id,
    sourceQuestionId: row.source_question_id,
    sourceChoiceNum: row.source_choice_num,
  };
}

async function fetchBankTrainingQuestion({ patKey, user, excludedKeys }) {
  if (!user) return null;

  const { data: items, error } = await supabase
    .from("training_items")
    .select(
      "id, passage, sentence, is_correct, evidence_sentence, explanation, source_label, source_year_key, source_set_id, source_question_id, source_choice_num",
    )
    .eq("pat", patKey)
    .eq("status", "approved")
    .order("quality_score", { ascending: false })
    .limit(80);

  if (error || !items?.length) return null;

  const { data: attempts } = await supabase
    .from("training_attempts")
    .select("training_item_id")
    .eq("user_id", user.id)
    .eq("pat", patKey)
    .not("training_item_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const attemptedIds = new Set(
    (attempts ?? []).map((attempt) => attempt.training_item_id),
  );
  // 발주 F-17: 문제은행 항목도 출처가 비공개(미출시) 세트면 제외한다.
  //   source_year_key/source_set_id 가 없는 과거 항목은 판정 불가 → 보수적으로 제외.
  const released = items.filter((item) =>
    isReleaseSet(item.source_year_key, item.source_set_id),
  );
  const unseen = released.filter(
    (item) =>
      !attemptedIds.has(item.id) &&
      !excludedKeys.has(sourceKeyOf(item)) &&
      isUsableTrainingSentence(item.sentence),
  );
  const usableItems = released.filter((item) =>
    isUsableTrainingSentence(item.sentence),
  );
  const pool = unseen.length > 0 ? unseen : usableItems;
  if (pool.length === 0) return null;
  return rowToTrainingQuestion(pool[Math.floor(Math.random() * pool.length)]);
}

async function fetchTrainingQuestion(patKey, { user, excludedKeys }) {
  const bankQuestion = await fetchBankTrainingQuestion({
    patKey,
    user,
    excludedKeys,
  });
  if (bankQuestion) return bankQuestion;

  // [발주 F-62] 후보 선별은 pro 필드(choice.pat)라 브라우저가 할 수 없다.
  //   서버가 고르고, 지문·선지 텍스트만 준다.
  //   ★ 정오·해설·근거 문장은 여기 없다. 제출 후 revealTrainingQuestion 이 받는다 —
  //     미리 오면 「이 선지에 결함이 있는가」의 답이 새어 훈련이 무의미해진다.
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");
  const res = await fetch(
    `/api/training-item?pat=${encodeURIComponent(patKey)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) {
    throw new Error(`${patKey} 훈련 선지를 찾지 못했습니다.`);
  }
  if (!res.ok) throw new Error("기출 데이터를 불러오지 못했습니다.");
  const item = await res.json();
  return {
    source: "live_data",
    passage: item.passage,
    sentence: item.sentence,
    sourceYearKey: item.sourceYearKey,
    sourceSetId: item.sourceSetId,
    sourceQuestionId: item.sourceQuestionId,
    sourceChoiceNum: item.sourceChoiceNum,
    sourceLabel: item.sourceLabel,
    revealToken: item.token,
  };
}

// [발주 F-62] 제출 후에만 정오·해설·근거 문장을 받는다.
//   서버는 이 학생에게 그 좌표를 실제로 발급했다는 서명(revealToken)을 확인한다.
async function revealTrainingQuestion(question) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return null;
  const res = await fetch("/api/training-reveal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      yearKey: question.sourceYearKey,
      setId: question.sourceSetId,
      questionId: question.sourceQuestionId,
      choiceNum: question.sourceChoiceNum,
      token: question.revealToken,
    }),
  });
  if (!res.ok) return null;
  return await res.json();
}

async function recordTrainingAttempt({ user, patKey, question, ans, isRight }) {
  if (!user || !question) return;

  await supabase.from("training_attempts").insert({
    user_id: user.id,
    training_item_id: question.source === "bank" ? question.id : null,
    pat: patKey,
    selected_answer: ans,
    is_correct: isRight,
    source_year_key: question.sourceYearKey ?? null,
    source_set_id: question.sourceSetId ?? null,
    source_question_id: question.sourceQuestionId ?? null,
    source_choice_num: question.sourceChoiceNum ?? null,
  });
}

function PatternTrainer({ patKey, user, wrongAnswers = [], onClose }) {
  const info = P[patKey] ?? P0;

  const [phase, setPhase] = useState("loading"); // loading | question | result | error
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null); // 'O' | 'X'
  const [count, setCount] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const gradingRef = useRef(false); // 채점 응답 대기 중 중복 클릭 차단

  async function loadQuestion() {
    setPhase("loading");
    setSelected(null);
    try {
      const excludedKeys = new Set(
        wrongAnswers.map(
          (answer) =>
            `${answer.year_key}|${answer.set_id}|${answer.question_id}|${answer.choice_num}`,
        ),
      );
      const q = await fetchTrainingQuestion(patKey, { user, excludedKeys });
      setQuestion(q);
      setPhase("question");
    } catch (e) {
      setErrorMsg(e.message);
      setPhase("error");
    }
  }

  useEffect(() => {
    loadQuestion();
  }, []); // eslint-disable-line

  // [발주 F-62] 출제 응답에는 정오가 없다. 제출한 뒤에 서버에서 받는다.
  //   받는 동안 두 번 눌리지 않게 ref 로 막는다(phase 는 아직 "question" 이다).
  async function handleSelect(ans) {
    if (phase !== "question") return;
    if (gradingRef.current) return;
    gradingRef.current = true;
    try {
      setSelected(ans);
      let q = question;
      if (typeof q.isCorrect !== "boolean") {
        const revealed = await revealTrainingQuestion(q);
        if (!revealed?.ok) {
          setSelected(null);
          setErrorMsg("채점 결과를 불러오지 못했습니다. 다시 시도해 주세요.");
          setPhase("error");
          return;
        }
        q = {
          ...q,
          isCorrect: revealed.isCorrect === true,
          explanation: revealed.explanation ?? "",
          evidenceSentence: revealed.evidenceSentence ?? "",
        };
        setQuestion(q);
      }
      setPhase("result");
      setCount((c) => c + 1);
      const isRight = (ans === "O") === q.isCorrect;
      if (isRight) setCorrect((c) => c + 1);
      recordTrainingAttempt({ user, patKey, question: q, ans, isRight }).catch(
        () => {},
      );
    } finally {
      gradingRef.current = false;
    }
  }

  const isRight =
    selected !== null && (selected === "O") === question?.isCorrect;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 400,
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.white,
          borderRadius: "18px",
          padding: "28px 24px",
          maxWidth: "520px",
          width: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: "800",
                color: info.color,
                background: info.bg,
                border: `1px solid ${info.color}44`,
                borderRadius: "6px",
                padding: "3px 9px",
              }}
            >
              {patKey}
            </span>
            <span
              style={{ fontSize: "0.95rem", fontWeight: "700", color: C.ink }}
            >
              {info.name} 훈련
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {count > 0 && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: C.muted,
                  fontWeight: "600",
                }}
              >
                {correct}/{count} 정답
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "1.2rem",
                color: C.subtle,
                padding: "2px",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div
          style={{
            fontSize: "0.73rem",
            color: C.muted,
            marginBottom: "18px",
            padding: "8px 12px",
            background: C.bg,
            borderRadius: "8px",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: C.green }}>훈련 방법:</strong> 실제 기출
          지문과 선지를 읽고, 선지가 지문 내용과 일치하면 <strong>O</strong>,
          다르면 <strong>X</strong>를 선택하세요.
        </div>

        {/* 로딩 */}
        {phase === "loading" && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                margin: "0 auto 14px",
                border: `3px solid ${C.border}`,
                borderTop: `3px solid ${C.green}`,
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
            <div style={{ fontSize: "0.85rem", color: C.muted }}>
              기출 선지 불러오는 중...
            </div>
            <div
              style={{ fontSize: "0.75rem", color: C.subtle, marginTop: "6px" }}
            >
              {patKey} 패턴 찾는 중
            </div>
          </div>
        )}

        {/* 에러 */}
        {phase === "error" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div
              style={{
                fontSize: "0.85rem",
                color: "#dc2626",
                marginBottom: "16px",
              }}
            >
              ⚠️ {errorMsg}
            </div>
            <button
              onClick={loadQuestion}
              style={{
                padding: "9px 22px",
                background: C.green,
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 문제 */}
        {(phase === "question" || phase === "result") && question && (
          <>
            {/* 지문 */}
            <div
              style={{
                background: "#fdfcfa",
                border: `1px solid ${C.border}`,
                borderRadius: "10px",
                padding: "16px 14px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  fontSize: "0.62rem",
                  fontWeight: "700",
                  color: C.subtle,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "10px",
                }}
              >
                지문
              </div>
              {question.sourceLabel && (
                <div
                  style={{
                    fontSize: "0.68rem",
                    color: C.subtle,
                    marginBottom: "8px",
                    lineHeight: 1.5,
                  }}
                >
                  {question.sourceLabel}
                </div>
              )}
              <p
                style={{
                  fontSize: "0.85rem",
                  lineHeight: "1.9",
                  color: C.inkMid,
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {phase === "result" && question.evidenceSentence
                  ? question.passage
                      .split(question.evidenceSentence)
                      .map((part, i, arr) => (
                        <span key={i}>
                          {part}
                          {i < arr.length - 1 && (
                            <mark
                              style={{
                                background: "rgba(34,197,94,0.25)",
                                borderBottom: "2px solid #22c55e",
                                borderRadius: "2px",
                                padding: "0 1px",
                              }}
                            >
                              {question.evidenceSentence}
                            </mark>
                          )}
                        </span>
                      ))
                  : question.passage}
              </p>
            </div>

            {/* 선지 */}
            <div
              style={{
                background: C.bg,
                border: `1px solid ${C.line}`,
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "18px",
              }}
            >
              <div
                style={{
                  fontSize: "0.62rem",
                  fontWeight: "700",
                  color: C.subtle,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                선지
              </div>
              <p
                style={{
                  fontSize: "0.88rem",
                  lineHeight: "1.75",
                  color: C.ink,
                  margin: 0,
                  fontWeight: "500",
                }}
              >
                {question.sentence}
              </p>
            </div>

            {/* O/X 선택 */}
            {phase === "question" && (
              <div
                style={{ display: "flex", gap: "12px", marginBottom: "8px" }}
              >
                {["O", "X"].map((ans) => (
                  <button
                    key={ans}
                    onClick={() => handleSelect(ans)}
                    style={{
                      flex: 1,
                      padding: "14px",
                      borderRadius: "12px",
                      border: "none",
                      background:
                        ans === "O"
                          ? "rgba(34,197,94,0.1)"
                          : "rgba(239,68,68,0.1)",
                      color: ans === "O" ? "#15803d" : "#dc2626",
                      fontSize: "1.3rem",
                      fontWeight: "800",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.transform = "scale(1.03)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
                  >
                    {ans}
                    <div style={{ fontSize: "0.7rem", marginTop: "4px" }}>
                      {ans === "O" ? "일치" : "불일치"}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* 결과 */}
            {phase === "result" && (
              <>
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    marginBottom: "14px",
                    background: isRight
                      ? "rgba(34,197,94,0.08)"
                      : "rgba(239,68,68,0.08)",
                    border: `1.5px solid ${isRight ? "#22c55e" : "#ef4444"}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: "800",
                      color: isRight ? "#15803d" : "#dc2626",
                      marginBottom: "8px",
                    }}
                  >
                    {isRight ? "✅ 정답!" : "❌ 오답"}
                    <span
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: "600",
                        marginLeft: "8px",
                        color: C.muted,
                      }}
                    >
                      정답: {question.isCorrect ? "O (일치)" : "X (불일치)"}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "0.82rem",
                      color: C.inkMid,
                      lineHeight: "1.75",
                      margin: 0,
                    }}
                  >
                    {question.explanation}
                  </p>
                </div>

                {/* 패턴 힌트 */}
                <div
                  style={{
                    padding: "10px 14px",
                    background: info.bg,
                    borderRadius: "8px",
                    marginBottom: "16px",
                    fontSize: "0.75rem",
                    color: info.color,
                    lineHeight: 1.6,
                  }}
                >
                  <strong>
                    {patKey} {info.name}:
                  </strong>{" "}
                  {info.desc}
                </div>

                {/* 다음 문제 */}
                <button
                  onClick={loadQuestion}
                  style={{
                    width: "100%",
                    padding: "13px",
                    background: C.green,
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "700",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  다음 문제 →
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────
export default function PatternReport({ user, onGoToQuestion }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCoachPat, setActiveCoachPat] = useState(null);
  const [activeTrainPat, setActiveTrainPat] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  // [발주 fg-1B] 영역(독서/문학) 판별용 — setId 접두가 아니라 reading[]/literature[] 소속으로 가른다.
  const [secData, setSecData] = useState(null);

  // [발주 F-60 ⓐ] 통짜(10.4MB) 대신 답안에 실제로 등장한 회차의 free 조각만 받는다.
  //   sectionOfSet 은 reading[]/literature[] 소속만 보므로 free 조각으로 충분하다.
  //   답안이 로드된 뒤에 회차를 알 수 있으므로 answers 에 의존한다.
  useEffect(() => {
    if (answers.length === 0) return undefined;
    let alive = true;
    loadYears(answers.map((a) => a.year_key))
      .then((d) => {
        if (alive) setSecData(d);
      })
      .catch((e) => {
        console.warn("[/report] 영역 판별용 데이터 로드 실패 — 유형별 정답률이 미분류로 집계됩니다:", e);
      });
    return () => {
      alive = false;
    };
  }, [answers]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      // user_stats path — 안전 path 정합 (single row 단독).
      const { data: statsData } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (statsData) setStats(statsData);

      // user_answers path — answered_at 안 schema 부재 path 안 graceful
      // fallback 정합 (attempt_count 폐기 path — trend 계산 단독 미사용).
      const primaryCols =
        "year_key, is_correct, pat, set_id, question_id, choice_num, answered_at";
      const fallbackCols =
        "year_key, is_correct, pat, set_id, question_id, choice_num";
      let answersData = null;
      const { data: ansPrimary, error: errPrimary } = await supabase
        .from("user_answers")
        .select(primaryCols)
        .eq("user_id", user.id)
        .order("answered_at", { ascending: false });
      // [발주 fi-2 B-3] .limit(200) 제거 — 상단 수치의 단일 출처가 되므로
      //   200문항을 넘긴 학생부터 수치가 다시 어긋난다. 전체 테이블이 소규모라 성능 우려 없음.
      if (errPrimary) {
        console.warn(
          "[/report] user_answers answered_at SELECT 실패, fallback:",
          errPrimary.message,
        );
        const { data: ansFallback, error: errFallback } = await supabase
          .from("user_answers")
          .select(fallbackCols)
          .eq("user_id", user.id);   // [발주 fi-2 B-3] .limit(200) 제거
        if (errFallback) {
          console.warn(
            "[/report] user_answers fallback SELECT 실패:",
            errFallback.message,
          );
        } else {
          answersData = ansFallback;
        }
      } else {
        answersData = ansPrimary;
      }
      if (answersData) setAnswers(answersData);
      setLoading(false);
    })();
  }, [user]);

  if (!user)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.paper,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ fontSize: "0.9rem", color: C.muted }}>
          로그인 후 패턴 리포트를 확인할 수 있습니다.
        </p>
      </div>
    );

  // 집계
  // [발주 fi-2 B-3] 상단 수치는 user_answers 원시 행에서 직접 센다.
  //   user_stats 는 upsert_user_stats RPC 의 누적 카운터이고 재계산 경로가 없어,
  //   한 번 어긋나면 스스로 복구되지 않는다(실측 83 vs 71 — 12문항 과다).
  //   answers 가 단일 출처가 되어야 두 수치가 갈라지지 않는다.
  //   ★ streak_days 는 answers 로 계산할 수 없어 user_stats 를 그대로 쓴다.
  const totalAnswered = answers.length;
  const totalCorrect = answers.filter((a) => a.is_correct).length;
  const streakDays = stats?.streak_days ?? 0;
  const accuracy =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const patCounts = {};
  for (const a of answers) {
    if (!a.is_correct && a.pat) {
      patCounts[String(a.pat)] = (patCounts[String(a.pat)] ?? 0) + 1;
    }
  }
  const allPatKeys = [...READING_PATS, ...LIT_PATS];
  const maxCount = Math.max(0, ...allPatKeys.map((k) => patCounts[k] ?? 0));
  const totalWrong = Object.values(patCounts).reduce((sum, n) => sum + n, 0);
  const topPat =
    allPatKeys.length > 0
      ? allPatKeys.reduce(
          (best, k) =>
            (patCounts[k] ?? 0) > (patCounts[best] ?? 0) ? k : best,
          allPatKeys[0],
        )
      : null;
  const hasTopPat = topPat !== null && (patCounts[topPat] ?? 0) > 0;
  const hasReliableTopPat = hasTopPat && totalWrong >= 3;
  const p0Count = patCounts["0"] ?? 0;

  const yearMap = {};
  for (const a of answers) {
    if (!yearMap[a.year_key]) yearMap[a.year_key] = { correct: 0, total: 0 };
    yearMap[a.year_key].total++;
    if (a.is_correct) yearMap[a.year_key].correct++;
  }
  const yearEntries = Object.entries(yearMap).sort((a, b) => {
    const ai = YEAR_INFO.findIndex((y) => y.key === a[0]);
    const bi = YEAR_INFO.findIndex((y) => y.key === b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const hasData = totalAnswered > 0 || answers.length > 0;

  // 진척 추세 (주별 정답률 + delta + 체감 카피) — 표시 단독 path.
  //   user_answers.answered_at 단독 source (upsert 사양 안 attempt_count 동반
  //   사실은 표기 단독 path, 추세 계산 단독 path).
  const trend = useMemo(() => {
    if (!answers || answers.length === 0) return null;
    const byWeek = new Map();
    for (const a of answers) {
      if (!a.answered_at) continue;
      const d = new Date(a.answered_at);
      const wk = isoWeekKey(d);
      if (!wk) continue;
      let bucket = byWeek.get(wk);
      if (!bucket) {
        bucket = { wk, total: 0, correct: 0, wrongByPat: {} };
        byWeek.set(wk, bucket);
      }
      bucket.total++;
      if (a.is_correct) bucket.correct++;
      else if (a.pat)
        bucket.wrongByPat[String(a.pat)] =
          (bucket.wrongByPat[String(a.pat)] ?? 0) + 1;
    }
    const weeks = [...byWeek.values()].sort((x, y) =>
      x.wk < y.wk ? -1 : x.wk > y.wk ? 1 : 0,
    );
    if (weeks.length === 0) return null;
    const recent = weeks.slice(-6); // 최근 6주 단독 표기
    const last = weeks[weeks.length - 1];
    const prev = weeks.length >= 2 ? weeks[weeks.length - 2] : null;
    const lastAcc = last.total
      ? Math.round((last.correct / last.total) * 100)
      : 0;
    const prevAcc =
      prev && prev.total ? Math.round((prev.correct / prev.total) * 100) : null;
    const deltaAcc = prevAcc != null ? lastAcc - prevAcc : null;
    // 이번 주 안 톱 약점 pat (오답 빈도 단독)
    const sortedLastPat = Object.entries(last.wrongByPat).sort(
      (a, b) => b[1] - a[1],
    );
    const topPatLast = sortedLastPat[0]?.[0] ?? null;
    let topPatDelta = null;
    if (topPatLast && prev) {
      const prevCnt = prev.wrongByPat[topPatLast] ?? 0;
      const lastCnt = last.wrongByPat[topPatLast] ?? 0;
      topPatDelta = {
        pat: topPatLast,
        prev: prevCnt,
        last: lastCnt,
        change: lastCnt - prevCnt,
      };
    }
    // 체감 카피 안 데이터 단독 생성 path
    let message = "";
    if (deltaAcc != null) {
      if (deltaAcc > 0) message = `지난주보다 정답률 +${deltaAcc}%p`;
      else if (deltaAcc < 0) message = `지난주보다 정답률 ${deltaAcc}%p`;
      else message = "정답률은 지난주와 같아요";
      if (topPatDelta && topPatDelta.change < 0)
        message += `, ${topPatDelta.pat} 오답이 줄고 있어요`;
      else if (topPatDelta && topPatDelta.change > 0)
        message += `, ${topPatDelta.pat} 오답이 늘었어요`;
    } else if (weeks.length === 1) {
      message = `이번 주 정답률 ${lastAcc}% — 다음 주 비교 데이터 누적 중`;
    }
    return {
      recent,
      last,
      prev,
      lastAcc,
      prevAcc,
      deltaAcc,
      topPatDelta,
      message,
    };
  }, [answers]);

  function getComment(tp) {
    if (!tp)
      return "아직 분석할 데이터가 부족합니다. 더 많은 문제를 풀어보세요.";
    if (totalWrong < 3)
      return "오답 수가 아직 적어 약점을 단정할 수 없습니다. 지금 보이는 패턴은 초기 신호로만 참고하세요.";
    if (tp === "0")
      return "P0(미분류)에 오답이 많습니다. 틀린 이유를 스스로 분석하고 패턴을 파악하세요.";
    const info = P[tp] ?? P0;
    return `${tp}(${info.name})에 가장 자주 당합니다. ${COMMENTS[tp] ?? ""}`;
  }

  const coachWrongAnswers = activeCoachPat
    ? answers.filter((a) => !a.is_correct && String(a.pat) === activeCoachPat)
    : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        fontFamily: "'Noto Sans KR', sans-serif",
        color: C.ink,
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pattern-split { display: flex; gap: 20px; }
        .pattern-split > * { flex: 1; min-width: 0; }
        @media (max-width: 768px) { .pattern-split { flex-direction: column; } }
      `}</style>

      {/* 헤더 */}
      <div
        style={{
          padding: "32px 24px 20px",
          background: C.white,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            fontSize: "0.62rem",
            fontWeight: "700",
            color: C.green,
            background: C.bg,
            border: `1px solid ${C.line}35`,
            borderRadius: "100px",
            padding: "3px 12px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}
        >
          내 분석
        </div>
        <h2
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: "1.4rem",
            fontWeight: "700",
            color: C.ink,
            margin: "0 0 6px",
            letterSpacing: "-0.02em",
          }}
        >
          오답 패턴 리포트
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <p style={{ fontSize: "0.82rem", color: C.muted, margin: 0 }}>
            취약 패턴을 진단하고, 🎯 훈련으로 바로 교정하세요
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href).then(() => {
                setToastMsg("링크가 복사됐습니다");
                setTimeout(() => setToastMsg(null), 2500);
              });
            }}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 14px",
              background: C.bg,
              color: C.green,
              border: `1px solid ${C.line}`,
              borderRadius: "8px",
              fontSize: "0.75rem",
              fontWeight: "700",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            🔗 공유하기
          </button>
        </div>
      </div>

      <div style={{ padding: "20px", maxWidth: "680px", margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                margin: "0 auto 12px",
                border: `3px solid ${C.border}`,
                borderTop: `3px solid ${C.green}`,
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
            <span style={{ fontSize: "0.85rem", color: C.muted }}>
              분석 중...
            </span>
          </div>
        ) : !hasData ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: C.white,
              borderRadius: "14px",
              border: `1px solid ${C.border}`,
              marginTop: "8px",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>📊</div>
            <p
              style={{ fontSize: "0.9rem", color: C.muted, margin: "0 0 8px" }}
            >
              아직 풀이 기록이 없습니다
            </p>
            <p
              style={{
                fontSize: "0.8rem",
                color: C.subtle,
                margin: "0 0 20px",
              }}
            >
              문제를 풀면 패턴 분석이 시작됩니다
            </p>
            <div
              style={{
                padding: "12px 16px",
                background: "#eff6ff",
                border: "1px solid #93c5fd",
                borderRadius: "10px",
                fontSize: "0.78rem",
                color: "#1d4ed8",
                lineHeight: 1.7,
              }}
            >
              💡 기출을 풀지 않아도 <strong>🎯 훈련</strong> 버튼으로 기출 패턴
              훈련을 바로 시작할 수 있어요
            </div>
          </div>
        ) : (
          <>
            {/* 요약 카드 */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <SummaryCard
                label="총 풀이 문항"
                value={totalAnswered.toLocaleString()}
                sub="문항"
              />
              <SummaryCard
                label="정답률"
                value={`${accuracy}%`}
                sub={`${totalCorrect}/${totalAnswered}`}
              />
              <SummaryCard
                label="연속 학습일"
                value={streakDays}
                sub="일 연속"
              />
            </div>

            {/* 📈 진척 추세 — 주별 정답률 + 지난주 대비 delta + 체감 카피.
                trend=null + hasData path (answered_at 부재 / 행 fetch
                실패 / 모두 NULL 등 path 통합) 안 빈 화면 회피 path 안
                안내문 단독 노출 정합. */}
            {!trend && hasData && (
              <div
                style={{
                  background: C.white,
                  border: `1px dashed ${C.border}`,
                  borderRadius: "14px",
                  padding: "16px 18px",
                  marginBottom: "16px",
                  fontSize: "0.78rem",
                  color: C.muted,
                  lineHeight: 1.6,
                }}
              >
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: "700",
                    color: C.subtle,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  📈 진척 추세
                </div>
                진척 데이터 누적 중 — 다음 풀이 시점부터 주별 정답률 추세가
                표시됩니다.
              </div>
            )}
            {trend && (
              <div
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: "14px",
                  padding: "18px 18px 16px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: "700",
                    color: C.subtle,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: "12px",
                  }}
                >
                  📈 진척 추세 (최근 {trend.recent.length}주)
                </div>
                {/* 주별 정답률 미니 막대 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: "6px",
                    height: "72px",
                    marginBottom: "10px",
                  }}
                >
                  {trend.recent.map((w) => {
                    const acc = w.total
                      ? Math.round((w.correct / w.total) * 100)
                      : 0;
                    const h = Math.max(4, Math.round((acc / 100) * 60));
                    const isLast = w.wk === trend.last.wk;
                    return (
                      <div
                        key={w.wk}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.62rem",
                            fontWeight: "700",
                            color: isLast ? C.green : C.subtle,
                          }}
                        >
                          {acc}%
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: `${h}px`,
                            background: isLast ? C.green : C.line,
                            borderRadius: "3px 3px 0 0",
                          }}
                        />
                        <div
                          style={{
                            fontSize: "0.6rem",
                            color: C.subtle,
                            marginTop: "2px",
                          }}
                        >
                          {isoWeekLabel(w.wk)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* 지난주 대비 delta + 톱 약점 pat 변화 */}
                {trend.deltaAcc != null && (
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: C.muted,
                      marginBottom: "6px",
                      borderTop: `1px dashed ${C.border}`,
                      paddingTop: "10px",
                    }}
                  >
                    이번 주{" "}
                    <strong style={{ color: C.ink }}>{trend.lastAcc}%</strong> ·
                    지난 주{" "}
                    <strong style={{ color: C.ink }}>{trend.prevAcc}%</strong> ·{" "}
                    <span
                      style={{
                        color:
                          trend.deltaAcc > 0
                            ? C.green
                            : trend.deltaAcc < 0
                              ? "#b91c1c"
                              : C.subtle,
                        fontWeight: "700",
                      }}
                    >
                      {trend.deltaAcc > 0 ? "+" : ""}
                      {trend.deltaAcc}%p
                    </span>
                    {trend.topPatDelta && (
                      <>
                        {" · "}
                        <span style={{ color: C.muted }}>
                          {trend.topPatDelta.pat} 오답 {trend.topPatDelta.prev}→
                          {trend.topPatDelta.last}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {/* 체감 카피 1줄 */}
                {trend.message && (
                  <div
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: "700",
                      color: C.green,
                      lineHeight: 1.5,
                    }}
                  >
                    {trend.message}
                  </div>
                )}
              </div>
            )}

            {/* AI 진단 메시지 */}
            {hasTopPat &&
              (() => {
                const topInfo = P[topPat] ?? P0;
                const sorted = allPatKeys
                  .filter((k) => (patCounts[k] ?? 0) > 0)
                  .sort((a, b) => (patCounts[b] ?? 0) - (patCounts[a] ?? 0));
                const top2 = sorted.slice(0, 2);
                return (
                  <div
                    style={{
                      background: C.white,
                      border: `1.5px solid ${topInfo.color}30`,
                      borderRadius: "14px",
                      padding: "20px 18px",
                      marginBottom: "16px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: "700",
                        color: C.subtle,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: "10px",
                      }}
                    >
                      AI 진단
                    </div>
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: "700",
                        color: C.ink,
                        lineHeight: 1.5,
                        marginBottom: "12px",
                      }}
                    >
                      {hasReliableTopPat
                        ? "핵심 취약 패턴은 "
                        : "초기 의심 패턴은 "}
                      <span style={{ color: topInfo.color }}>
                        {topPat} {topInfo.name}
                      </span>
                      입니다
                    </div>
                    {top2.map((k) => {
                      const info = P[k] ?? P0;
                      return (
                        <div
                          key={k}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "8px",
                            marginBottom: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: "800",
                              color: info.color,
                              minWidth: "28px",
                            }}
                          >
                            {k}
                          </span>
                          <span
                            style={{
                              fontSize: "0.78rem",
                              color: C.muted,
                              lineHeight: 1.6,
                            }}
                          >
                            {COMMENTS[k]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

            {/* 지문 유형별 정답률 */}
            {answers.length > 0 &&
              (() => {
                // [발주 fg-1B · B-2/B-3] 영역은 reading[]/literature[] 소속으로 가른다.
                //   setId 접두(r/l) 판별 금지 — 접두와 배열이 어긋난 세트가 6건 있다(발주 fg-1 실측).
                //   조회 실패 시 접두사로 폴백하지 않고 미분류(unknown)로 집계하고 경고를 남긴다.
                const sec = {
                  reading: { c: 0, t: 0 },
                  literature: { c: 0, t: 0 },
                  unknown: { c: 0, t: 0 },
                };
                const unresolved = new Set();
                for (const a of answers) {
                  const s =
                    sectionOfSet(a.year_key, a.set_id, secData) ?? "unknown";
                  if (s === "unknown") unresolved.add(`${a.year_key}::${a.set_id}`);
                  sec[s].t++;
                  if (a.is_correct) sec[s].c++;
                }
                if (unresolved.size) {
                  console.warn(
                    `[/report] 유형별 정답률 — 영역 미분류 ${sec.unknown.t}건 / 세트 ${unresolved.size}개:`,
                    [...unresolved],
                  );
                }
                const rPct =
                  sec.reading.t > 0
                    ? Math.round((sec.reading.c / sec.reading.t) * 100)
                    : 0;
                const lPct =
                  sec.literature.t > 0
                    ? Math.round((sec.literature.c / sec.literature.t) * 100)
                    : 0;
                return (
                  <div
                    style={{
                      background: C.white,
                      border: `1px solid ${C.border}`,
                      borderRadius: "14px",
                      padding: "18px 16px",
                      marginBottom: "16px",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: "700",
                        color: C.ink,
                        margin: "0 0 14px",
                      }}
                    >
                      유형별 정답률
                    </h3>
                    {[
                      { label: "독서", pct: rPct, cnt: sec.reading },
                      { label: "문학", pct: lPct, cnt: sec.literature },
                      // 미분류는 0건이면 표시하지 않는다. 0건이 정상 상태다.
                      ...(sec.unknown.t > 0
                        ? [
                            {
                              label: "미분류",
                              pct:
                                Math.round(
                                  (sec.unknown.c / sec.unknown.t) * 100,
                                ) || 0,
                              cnt: sec.unknown,
                            },
                          ]
                        : []),
                    ].map(({ label, pct, cnt }) => (
                      <div key={label} style={{ marginBottom: "10px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.75rem",
                            marginBottom: "4px",
                          }}
                        >
                          <span style={{ fontWeight: "600", color: C.ink }}>
                            {label}
                          </span>
                          {/* [발주 fj ④] 분모 0 을 「0%」로 쓰면 다 틀린 것으로 읽힌다. */}
                          <span style={{ color: C.muted }}>
                            {cnt.t === 0
                              ? "아직 풀지 않음"
                              : `${pct}% (${cnt.c}/${cnt.t})`}
                          </span>
                        </div>
                        <div
                          style={{
                            height: "8px",
                            background: "#f3f4f6",
                            borderRadius: "4px",
                            overflow: "hidden",
                          }}
                        >
                          {/* 분모 0 이면 채움 막대를 그리지 않는다 — 회색 트랙만 남는다. */}
                          {cnt.t > 0 && (
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background:
                                  pct >= 80
                                    ? C.green
                                    : pct >= 60
                                      ? "#b7950b"
                                      : "#c0392b",
                                borderRadius: "4px",
                                transition: "width 0.4s ease",
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

            {/* 훈련 안내 배너 */}
            <div
              style={{
                padding: "12px 16px",
                background: "#eff6ff",
                border: "1px solid #93c5fd",
                borderRadius: "10px",
                marginBottom: "16px",
                fontSize: "0.78rem",
                color: "#1d4ed8",
                lineHeight: 1.7,
              }}
            >
              🎯 <strong>기출 패턴 훈련</strong> — 각 패턴 옆 훈련 버튼을 누르면
              실제 기출 선지로 해당 패턴을 집중 연습할 수 있습니다
            </div>
          </>
        )}

        {/* 패턴 바 — 데이터 유무 관계없이 항상 표시 (훈련 가능) */}
        {!loading && (
          <>
            <div className="pattern-split" style={{ marginBottom: "12px" }}>
              {/* 독서 */}
              <div
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: "14px",
                  padding: "18px 16px",
                }}
              >
                <h3
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: "700",
                    color: C.green,
                    margin: "0 0 16px",
                  }}
                >
                  독서 오답 패턴
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                  }}
                >
                  {READING_PATS.map((pk) => (
                    <PatternBar
                      key={pk}
                      patKey={pk}
                      count={patCounts[pk] ?? 0}
                      maxCount={maxCount}
                      isTop={hasReliableTopPat && topPat === pk}
                      onCoach={setActiveCoachPat}
                      onTrain={setActiveTrainPat}
                    />
                  ))}
                </div>
              </div>
              {/* 문학 */}
              <div
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: "14px",
                  padding: "18px 16px",
                }}
              >
                <h3
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: "700",
                    color: C.green,
                    margin: "0 0 16px",
                  }}
                >
                  문학 오답 패턴
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px",
                  }}
                >
                  {LIT_PATS.map((pk) => (
                    <PatternBar
                      key={pk}
                      patKey={pk}
                      count={patCounts[pk] ?? 0}
                      maxCount={maxCount}
                      isTop={hasReliableTopPat && topPat === pk}
                      onCoach={setActiveCoachPat}
                      onTrain={setActiveTrainPat}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* P0 미분류 */}
            {p0Count > 0 && (
              <div
                style={{
                  background: C.white,
                  border: `1px dashed ${C.border}`,
                  borderRadius: "14px",
                  padding: "14px 16px",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: "700",
                      color: P0.color,
                      background: P0.bg,
                      border: `1px solid ${P0.color}44`,
                      borderRadius: "4px",
                      padding: "1px 7px",
                    }}
                  >
                    P0
                  </span>
                  <span
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: "600",
                      color: C.ink,
                      flex: 1,
                    }}
                  >
                    {P0.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.63rem",
                      fontWeight: "700",
                      color: "#fff",
                      background: "#888",
                      borderRadius: "4px",
                      padding: "1px 6px",
                    }}
                  >
                    검토 필요
                  </span>
                  <span style={{ fontSize: "0.75rem", color: C.muted }}>
                    {p0Count}회
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.67rem",
                    color: C.muted,
                    marginTop: "6px",
                  }}
                >
                  {P0.desc}
                </div>
              </div>
            )}

            {/* 시험별 정답률 */}
            {yearEntries.length > 0 && (
              <div
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: "14px",
                  padding: "18px 16px",
                  marginBottom: "12px",
                }}
              >
                <h3
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: "700",
                    color: C.green,
                    margin: "0 0 16px",
                  }}
                >
                  시험별 정답률
                </h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {yearEntries.map(([yk, d]) => (
                    <YearBar
                      key={yk}
                      yearKey={yk}
                      correct={d.correct}
                      total={d.total}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 한 줄 총평 */}
            {hasData && (
              <div
                style={{
                  background: C.bg,
                  border: `1px solid ${C.line}`,
                  borderRadius: "14px",
                  padding: "16px 18px",
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                }}
              >
                <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>💡</span>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: C.ink,
                    lineHeight: "1.75",
                    margin: 0,
                  }}
                >
                  {getComment(hasTopPat ? topPat : null)}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 선생님에게 보내기 CTA */}
      {!loading && (
        <div
          style={{
            padding: "0 20px 28px",
            maxWidth: "680px",
            margin: "0 auto",
          }}
        >
          <button
            onClick={() => {
              navigate("/");
              setTimeout(
                () =>
                  document
                    .getElementById("b2b-waitlist")
                    ?.scrollIntoView({ behavior: "smooth" }),
                300,
              );
            }}
            style={{
              width: "100%",
              padding: "15px",
              background: C.green,
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              fontSize: "0.9rem",
              fontWeight: "700",
              cursor: "pointer",
              fontFamily: "'Noto Sans KR', sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            🏫 우리 학원 선생님에게 보내기
          </button>
          <p
            style={{
              fontSize: "0.7rem",
              color: C.subtle,
              textAlign: "center",
              margin: "8px 0 0",
            }}
          >
            학원에서 단체 도입하면 학생별 패턴 리포트를 제공합니다
          </p>
        </div>
      )}

      {/* 토스트 */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: "32px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1f2937",
            color: "#fff",
            padding: "10px 24px",
            borderRadius: "10px",
            fontSize: "0.85rem",
            fontWeight: "600",
            zIndex: 500,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* PatternCoach 모달 */}
      {activeCoachPat && (
        <PatternCoach
          patKey={activeCoachPat}
          wrongAnswers={coachWrongAnswers}
          onClose={() => setActiveCoachPat(null)}
          onGoToQuestion={onGoToQuestion}
        />
      )}

      {/* PatternTrainer 모달 */}
      {activeTrainPat && (
        <PatternTrainer
          patKey={activeTrainPat}
          user={user}
          wrongAnswers={answers.filter(
            (answer) =>
              !answer.is_correct && String(answer.pat) === activeTrainPat,
          )}
          onClose={() => setActiveTrainPat(null)}
        />
      )}
    </div>
  );
}
