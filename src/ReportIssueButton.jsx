import { useState } from "react";
import {
  saveIssueReport,
  checkCooldown,
  REPORT_TYPES,
  MAX_BODY,
} from "./saveIssueReport";

// 문항 단위 오류 신고 (발주 F-21)
//   문항 헤더 우측 🚩 → 같은 자리에서 인라인 시트가 열린다(새 탭 없음).
//   회차·세트·문항·모드는 자동 첨부 — 학생은 유형과 한 줄만 고른다.
//   비로그인도 신고 가능.
export default function ReportIssueButton({
  user,
  yearKey,
  setId,
  questionId,
  isPro = false,
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(REPORT_TYPES[0].value);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  function toggle(e) {
    e.stopPropagation();
    if (done) return;
    const next = !open;
    setOpen(next);
    if (next) setError(checkCooldown(yearKey, setId, questionId));
  }

  async function handleSend(e) {
    e.stopPropagation();
    if (sending) return;
    setSending(true);
    setError(null);
    const r = await saveIssueReport({
      user,
      yearKey,
      setId,
      questionId,
      isPro,
      reportType: type,
      body,
    });
    setSending(false);
    if (r.ok) {
      setDone(true);
      setOpen(false);
    } else {
      setError(r.message);
    }
  }

  if (done) {
    return (
      <span
        style={{
          fontSize: "0.7rem",
          color: "#15803d",
          whiteSpace: "nowrap",
          flexShrink: 0,
          marginTop: "2px",
        }}
      >
        ✓ 신고 접수
      </span>
    );
  }

  return (
    <span style={{ position: "relative", flexShrink: 0, marginTop: "2px" }}>
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label="이 문항 오류 신고"
        title="이 문항 오류 신고"
        style={{
          border: "1px solid #e5e7eb",
          background: open ? "#f3f4f6" : "transparent",
          color: "#9ca3af",
          borderRadius: "5px",
          padding: "2px 6px",
          fontSize: "0.7rem",
          lineHeight: 1.4,
          cursor: "pointer",
          fontFamily: "'Noto Sans KR', sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        🚩 오류 신고
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 50,
            width: "min(280px, calc(100vw - 48px))",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            textAlign: "left",
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {REPORT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                style={{
                  border:
                    type === t.value ? "1px solid #374151" : "1px solid #e5e7eb",
                  background: type === t.value ? "#374151" : "#fff",
                  color: type === t.value ? "#fff" : "#4b5563",
                  borderRadius: "12px",
                  padding: "3px 9px",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
            placeholder="무엇이 잘못됐는지 한 줄로 적어 주세요"
            maxLength={MAX_BODY}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              padding: "6px 8px",
              fontSize: "0.75rem",
              fontFamily: "inherit",
              width: "100%",
              boxSizing: "border-box",
            }}
          />

          {error && (
            <div style={{ fontSize: "0.7rem", color: "#dc2626" }}>{error}</div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "0.65rem", color: "#9ca3af" }}>
              {yearKey} · {setId} · {questionId}번
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                style={{
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  color: "#6b7280",
                  borderRadius: "6px",
                  padding: "4px 10px",
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                취소
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !body.trim()}
                style={{
                  border: "none",
                  background: sending || !body.trim() ? "#d1d5db" : "#374151",
                  color: "#fff",
                  borderRadius: "6px",
                  padding: "4px 12px",
                  fontSize: "0.72rem",
                  cursor: sending || !body.trim() ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {sending ? "전송 중…" : "보내기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
