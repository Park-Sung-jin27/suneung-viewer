// QuestionQA.jsx — 문제별 AI Q&A 컴포넌트
// 복습 모드에서 각 문제 아래 표시됨

import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const MAX_PASSAGE_CHARS = 4500;
const MAX_BOGI_CHARS = 2000;
const MAX_USER_QUESTION_CHARS = 500;

function compact(text, limit) {
  const value = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (value.length <= limit) return value;
  return value.slice(0, limit) + "\n[이하 생략]";
}

function stringifyBogi(bogi) {
  if (!bogi) return "";
  if (typeof bogi === "string") return bogi;
  if (Array.isArray(bogi)) return bogi.join("\n");
  if (typeof bogi === "object") {
    return [
      bogi.text,
      bogi.description,
      Array.isArray(bogi.items)
        ? bogi.items.map((item) => item.text ?? item.label ?? "").join("\n")
        : "",
      Array.isArray(bogi.flow) ? bogi.flow.join(" ") : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return String(bogi);
}

function isCorrectChoice(question, choice) {
  const questionType = question?.questionType ?? "negative";
  return questionType === "positive" ? choice.ok === true : choice.ok === false;
}

function evidenceForChoice(choice, passageSents) {
  const sents = passageSents ?? [];
  return (choice.cs_ids ?? [])
    .map((sid) => {
      const sent = sents.find((s) => s.id === sid);
      return sent ? `${sid}: ${sent.t}` : `${sid}: [근거 문장 없음]`;
    })
    .join("\n");
}

function buildPrompt({
  question,
  questionText,
  choices,
  passageSents,
  selectedChoiceNum,
  userQuestion,
}) {
  const q = question ?? { t: questionText, choices };
  const qChoices = q.choices ?? choices ?? [];
  const passageText = (passageSents ?? [])
    .filter((s) => s.sentType !== "footnote" && s.sentType !== "author")
    .map((s) => `${s.id}: ${s.t}`)
    .join("\n");
  const bodyText = compact(passageText, MAX_PASSAGE_CHARS);
  const bogiText = compact(stringifyBogi(q.bogi), MAX_BOGI_CHARS);
  const selectedChoice = qChoices.find(
    (choice) => Number(choice.num) === Number(selectedChoiceNum),
  );
  const correctChoices = qChoices.filter((choice) =>
    isCorrectChoice(q, choice),
  );

  const choiceText = qChoices
    .map((choice) => {
      const tags = [
        Number(choice.num) === Number(selectedChoiceNum) ? "학생 선택" : "",
        isCorrectChoice(q, choice) ? "정답 선지" : "오답 선지",
        choice.pat ? `오답 패턴 ${choice.pat}` : "",
      ].filter(Boolean);
      const evidence = evidenceForChoice(choice, passageSents);
      return [
        `${choice.num}번 (${tags.join(", ") || "태그 없음"})`,
        `선지: ${choice.t}`,
        choice.analysis ? `해설: ${choice.analysis}` : null,
        evidence ? `근거 문장:\n${evidence}` : "근거 문장: 없음",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `학생이 수능 국어 문항에 대해 질문했습니다.
아래 제공된 지문, 보기, 선지, 해설, 근거 문장만 사용해 답하세요.
근거가 부족하면 추측하지 말고 부족하다고 말하세요.
답변은 300자 이내로, 3~4등급 학생도 이해하게 쉽게 설명하세요.

[발문]
${q.t ?? questionText ?? ""}

[문항 유형]
${q.questionType ?? "negative"}

[보기]
${bogiText || "없음"}

[지문]
${bodyText}

[선지와 근거]
${choiceText}

[학생이 고른 선지]
${selectedChoice ? `${selectedChoice.num}번: ${selectedChoice.t}` : "확인 불가"}

[정답 선지]
${correctChoices.map((choice) => `${choice.num}번: ${choice.t}`).join("\n")}

[학생 질문]
${compact(userQuestion, MAX_USER_QUESTION_CHARS)}`;
}

async function fetchAIAnswer({
  question,
  questionText,
  choices,
  passageSents,
  selectedChoiceNum,
  userQuestion,
}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");

  const prompt = buildPrompt({
    question,
    questionText,
    choices,
    passageSents,
    selectedChoiceNum,
    userQuestion,
  });

  const res = await fetch("/api/claude", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      task: "question_qa",
      prompt,
    }),
  });

  if (!res.ok) throw new Error(await readAIError(res));
  const dataJson = await res.json();
  return (
    dataJson.content?.map((b) => b.text ?? "").join("") ??
    "답변을 가져오지 못했습니다."
  );
}

async function readAIError(res) {
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (res.status === 429 && payload?.quota) {
    const limit = payload.quota.limit ?? 0;
    const used = payload.quota.used ?? limit;
    return `이번 달 AI 질문권 ${used}/${limit}개를 모두 사용했어요.`;
  }
  if (res.status === 401) return "로그인 후 질문할 수 있어요.";
  return payload?.error ?? `AI 답변을 가져오지 못했어요. (${res.status})`;
}

function QAItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "10px 14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: "800",
            color: "#6366f1",
            flexShrink: 0,
            marginTop: "2px",
          }}
        >
          Q
        </span>
        <span
          style={{
            flex: 1,
            fontSize: "0.82rem",
            color: "#1e293b",
            lineHeight: "1.55",
          }}
        >
          {item.user_question}
        </span>
        <span
          style={{
            fontSize: "0.72rem",
            color: "#94a3b8",
            flexShrink: 0,
            marginTop: "3px",
          }}
        >
          {open ? "▲" : "▼"}
        </span>
      </div>

      {open && (
        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            padding: "10px 14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            background: "#fff",
          }}
        >
          <span
            style={{
              fontSize: "0.72rem",
              fontWeight: "800",
              color: "#10b981",
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            A
          </span>
          <span
            style={{
              flex: 1,
              fontSize: "0.82rem",
              color: "#374151",
              lineHeight: "1.7",
              whiteSpace: "pre-wrap",
            }}
          >
            {item.ai_answer}
          </span>
        </div>
      )}
    </div>
  );
}

export default function QuestionQA({
  questionKey,
  questionText,
  choices,
  question,
  passageSents,
  selectedChoiceNum,
  user,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!questionKey || !user) {
      setItems([]);
      setFetching(false);
      return;
    }
    setFetching(true);
    supabase
      .from("question_comments")
      .select("id, user_question, ai_answer, created_at")
      .eq("question_key", questionKey)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data, error: fetchError }) => {
        if (!fetchError) setItems(data ?? []);
        setFetching(false);
      });
  }, [questionKey, user]);

  async function handleAsk() {
    const q = input.trim().slice(0, MAX_USER_QUESTION_CHARS);
    if (!q || loading) return;
    if (!user) {
      setError("로그인 후 질문할 수 있어요");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const aiAnswer = await fetchAIAnswer({
        question,
        questionText,
        choices,
        passageSents,
        selectedChoiceNum,
        userQuestion: q,
      });

      const { data, error: dbErr } = await supabase
        .from("question_comments")
        .insert({
          user_id: user.id,
          question_key: questionKey,
          user_question: q,
          ai_answer: aiAnswer,
        })
        .select("id, user_question, ai_answer, created_at")
        .single();

      if (dbErr) throw dbErr;
      setItems((prev) => [...prev, data]);
      setInput("");
    } catch (e) {
      setError(e.message || "오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      console.error("[QuestionQA]", e);
    } finally {
      setLoading(false);
    }
  }

  const count = items.length;

  return (
    <div style={{ marginTop: "8px" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "6px",
          background: open ? "#eef2ff" : "#f8fafc",
          border: "1px solid " + (open ? "#a5b4fc" : "#e2e8f0"),
          color: open ? "#4338ca" : "#64748b",
          fontSize: "0.78rem",
          fontWeight: "600",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        <span>🤖 AI에게 질문</span>
        {count > 0 && (
          <span
            style={{
              background: "#6366f1",
              color: "#fff",
              borderRadius: "10px",
              padding: "1px 7px",
              fontSize: "0.68rem",
              fontWeight: "700",
            }}
          >
            {count}개 답변
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            marginTop: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {fetching ? (
            <div
              style={{
                fontSize: "0.78rem",
                color: "#94a3b8",
                padding: "8px 4px",
              }}
            >
              불러오는 중…
            </div>
          ) : count === 0 ? (
            <div
              style={{ fontSize: "0.78rem", color: "#94a3b8", padding: "4px" }}
            >
              아직 질문이 없어요. 첫 번째로 질문해보세요!
            </div>
          ) : (
            items.map((item) => <QAItem key={item.id} item={item} />)
          )}

          <div
            style={{
              background: "#fff",
              border: "1px solid #c7d2fe",
              borderRadius: "8px",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <textarea
              value={input}
              onChange={(e) =>
                setInput(e.target.value.slice(0, MAX_USER_QUESTION_CHARS))
              }
              placeholder="이해가 안 되는 부분을 질문하세요&#10;예) 왜 2번이 틀렸나요? / ㉠의 의미가 뭔가요?"
              rows={3}
              style={{
                width: "100%",
                resize: "none",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "8px 10px",
                fontSize: "0.82rem",
                lineHeight: "1.6",
                fontFamily: "inherit",
                color: "#1e293b",
                background: "#fff",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) handleAsk();
              }}
            />
            {error && (
              <div style={{ fontSize: "0.76rem", color: "#dc2626" }}>
                {error}
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                {user
                  ? `⌘+Enter로 전송 · ${input.length}/${MAX_USER_QUESTION_CHARS}`
                  : "로그인 필요"}
              </span>
              <button
                onClick={handleAsk}
                disabled={loading || !input.trim()}
                style={{
                  padding: "7px 16px",
                  borderRadius: "6px",
                  background: loading ? "#a5b4fc" : "#6366f1",
                  color: "#fff",
                  border: "none",
                  fontWeight: "700",
                  fontSize: "0.82rem",
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  opacity: !input.trim() ? 0.6 : 1,
                  transition: "all 0.15s",
                }}
              >
                {loading ? "AI 답변 중…" : "질문하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
