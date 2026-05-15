import { useState } from "react";

// 베타 피드백 Tally form (사용자 = 성진 paste).
//   별도 form 교체 path: 본 const 직접 정정.
const TALLY_FEEDBACK_URL = "https://tally.so/r/jaJZEY";

export default function FeedbackButton() {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() =>
        window.open(TALLY_FEEDBACK_URL, "_blank", "noopener,noreferrer")
      }
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 999,
        background: hover ? "#1f2937" : "#374151",
        color: "#fff",
        border: "none",
        borderRadius: "50px",
        padding: "12px 18px",
        fontFamily: "'Noto Sans KR', sans-serif",
        fontSize: "0.85rem",
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        transition: "background 0.15s",
      }}
      aria-label="피드백 보내기"
    >
      💬 베타 피드백
    </button>
  );
}
