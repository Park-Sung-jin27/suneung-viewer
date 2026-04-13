// ============================================================
// Landing.jsx — 수능 국어 AI 논리진단 플랫폼 랜딩 (통합 최종)
// ============================================================

import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ── 토큰 ────────────────────────────────────────────────────
const C = {
  green: "#1e5c1e",
  mid: "#2d6e2d",
  soft: "#3d8b3d",
  bg: "#f0f7f0",
  line: "#7aad7a",
  ink: "#0d1a0e",
  inkMid: "#253226",
  muted: "#536354",
  subtle: "#8a9b8b",
  paper: "#faf8f4",
  paperAlt: "#f3f0ea",
  white: "#ffffff",
  border: "#e0dbd0",
  red: "#dc2626",
  redBg: "#fef2f2",
};

// ── 유틸 ────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setV(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, v];
}

function FadeIn({ children, delay = 0, style = {} }) {
  const [ref, v] = useInView();
  return (
    <div
      ref={ref}
      style={{
        opacity: v ? 1 : 0,
        transform: v ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.75s ease ${delay}s, transform 0.75s ease ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SlideIn({ children, delay = 0, from = "bottom" }) {
  const [ref, v] = useInView();
  const transforms = {
    bottom: { from: "translateY(40px)", to: "translateY(0)" },
    left: { from: "translateX(-40px)", to: "translateX(0)" },
    right: { from: "translateX(40px)", to: "translateX(0)" },
  };
  const t = transforms[from];
  return (
    <div
      ref={ref}
      style={{
        opacity: v ? 1 : 0,
        transform: v ? t.to : t.from,
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ── Pill ────────────────────────────────────────────────────
function Pill({ children, color = C.green, bg }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "0.63rem",
        fontWeight: "700",
        color,
        background: bg ?? `${color}18`,
        border: `1px solid ${color}35`,
        borderRadius: "100px",
        padding: "4px 13px",
        letterSpacing: "0.09em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

// ── CTA 버튼 ────────────────────────────────────────────────
function Btn({
  label,
  onClick,
  variant = "primary",
  size = "md",
  full = false,
}) {
  const [h, setH] = useState(false);
  const sz = { sm: "10px 22px", md: "13px 32px", lg: "16px 40px" };
  const fs = { sm: "0.83rem", md: "0.92rem", lg: "1rem" };
  const base = {
    padding: sz[size],
    fontSize: fs[size],
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: "700",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.18s",
    transform: h ? "translateY(-1px)" : "none",
    width: full ? "100%" : undefined,
  };
  if (variant === "primary")
    return (
      <button
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        onClick={onClick}
        style={{
          ...base,
          background: h ? C.soft : C.mid,
          color: "#fff",
          border: "none",
          boxShadow: h ? "0 8px 24px rgba(45,110,45,0.3)" : "none",
        }}
      >
        {label}
      </button>
    );
  if (variant === "white")
    return (
      <button
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        onClick={onClick}
        style={{
          ...base,
          background: h ? C.bg : "#fff",
          color: C.mid,
          border: "none",
        }}
      >
        {label}
      </button>
    );
  return (
    <button
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        ...base,
        background: h ? C.bg : "transparent",
        color: C.mid,
        border: `1.5px solid ${C.line}`,
      }}
    >
      {label}
    </button>
  );
}

// ── 형광펜 인터랙티브 데모 ───────────────────────────────────
function HighlightDemo() {
  const [active, setActive] = useState(null);
  const choices = [
    {
      num: 1,
      text: "㉠은 외부 자극이 없어도 자발적으로 발생한다.",
      ok: false,
      hl: [0, 1],
    },
    {
      num: 2,
      text: "㉡은 세포막의 이온 투과성 변화로 나타난다.",
      ok: true,
      hl: [2],
    },
    {
      num: 3,
      text: "㉠과 ㉡은 모두 Na⁺ 이동에 의해 발생한다.",
      ok: false,
      hl: [0, 2],
    },
  ];
  const sents = [
    {
      id: 0,
      t: "활동 전위는 외부 자극에 의해 세포막 전위가 역치 이상으로 상승할 때 발생한다.",
      hl: [1, 3],
    },
    {
      id: 1,
      t: "Na⁺ 채널이 열리며 Na⁺가 세포 내로 급격히 유입된다.",
      hl: [1, 3],
    },
    {
      id: 2,
      t: "세포막의 이온 투과성 변화는 활동 전위의 핵심 기전이다.",
      hl: [2],
    },
    { id: 3, t: "이후 K⁺가 세포 외로 유출되어 재분극이 일어난다.", hl: [] },
  ];
  const hlC = {
    1: { bg: "rgba(59,130,246,0.22)", bdr: "#3b82f6" },
    2: { bg: "rgba(34,197,94,0.22)", bdr: "#22c55e" },
    3: { bg: "rgba(234,179,8,0.28)", bdr: "#eab308" },
  };

  return (
    <div
      style={{
        background: C.white,
        borderRadius: "16px",
        border: `1px solid ${C.border}`,
        overflow: "hidden",
        boxShadow:
          "0 24px 64px rgba(30,92,30,0.13), 0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      {/* 브라우저 크롬 */}
      <div
        style={{
          background: "#f0efed",
          borderBottom: `1px solid ${C.border}`,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 7 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div
              key={c}
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: c,
              }}
            />
          ))}
        </div>
        <div
          style={{
            background: C.white,
            borderRadius: "6px",
            padding: "3px 18px",
            fontSize: "0.64rem",
            color: C.subtle,
            border: `1px solid ${C.border}`,
            flex: 1,
            maxWidth: 220,
            textAlign: "center",
            margin: "0 12px",
          }}
        >
          suneung-viewer.vercel.app
        </div>
        <div style={{ width: 56 }} />
      </div>
      {/* 2분할 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          minHeight: 290,
        }}
      >
        <div
          style={{
            borderRight: `1px solid ${C.border}`,
            padding: "16px 15px",
            background: "#fdfcfa",
          }}
        >
          <div
            style={{
              fontSize: "0.58rem",
              fontWeight: "700",
              color: C.subtle,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            지문
          </div>
          {sents.map((s) => {
            const hl = active !== null && s.hl.includes(active);
            return (
              <p
                key={s.id}
                style={{
                  fontSize: "0.7rem",
                  lineHeight: "1.9",
                  color: C.inkMid,
                  marginBottom: "6px",
                  padding: "1px 3px",
                  borderRadius: "3px",
                  transition: "all 0.22s",
                  background: hl ? hlC[active]?.bg : "transparent",
                  borderBottom: hl
                    ? `2px solid ${hlC[active]?.bdr}`
                    : "2px solid transparent",
                }}
              >
                {s.t}
              </p>
            );
          })}
        </div>
        <div style={{ padding: "16px 15px" }}>
          <div
            style={{
              fontSize: "0.58rem",
              fontWeight: "700",
              color: C.subtle,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            문제
          </div>
          <div
            style={{
              fontSize: "0.68rem",
              color: C.inkMid,
              marginBottom: "11px",
              lineHeight: 1.6,
            }}
          >
            <strong>3.</strong> ㉠, ㉡에 대한 설명으로 적절하지 <u>않은</u>{" "}
            것은?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {choices.map((c) => {
              const on = active === c.num;
              return (
                <div
                  key={c.num}
                  onClick={() => setActive(on ? null : c.num)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 7,
                    padding: "7px 9px",
                    borderRadius: "7px",
                    cursor: "pointer",
                    background: on
                      ? c.ok
                        ? "rgba(34,197,94,0.1)"
                        : "rgba(239,68,68,0.1)"
                      : "#fff",
                    border: on
                      ? `2px solid ${c.ok ? "#22c55e" : "#ef4444"}`
                      : `1px solid ${C.border}`,
                    transition: "all 0.18s",
                  }}
                >
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: on
                        ? c.ok
                          ? "#22c55e"
                          : "#ef4444"
                        : "#f0efed",
                      color: on ? "#fff" : C.subtle,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.6rem",
                      fontWeight: "700",
                    }}
                  >
                    {c.num}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      lineHeight: 1.6,
                      color: C.ink,
                      flex: 1,
                    }}
                  >
                    {c.text}
                  </span>
                  {on && (
                    <span style={{ fontSize: "0.8rem", flexShrink: 0 }}>
                      {c.ok ? "✅" : "❌"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: "10px",
              padding: "7px 9px",
              background: C.bg,
              borderRadius: "7px",
              fontSize: "0.61rem",
              color: C.mid,
              lineHeight: 1.6,
            }}
          >
            {active
              ? `💡 ${active}번 → 지문 근거가 형광펜으로 표시됩니다`
              : "👆 선지를 클릭해보세요"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 14일 여정 시각화 ─────────────────────────────────────────
function JourneyViz() {
  const steps = [
    {
      day: "Day 1",
      icon: "🔍",
      title: "첫 진단",
      desc: "20문항 · 오류 패턴 리포트 즉시 발급",
    },
    {
      day: "Day 2–7",
      icon: "🎯",
      title: "1순위 패턴 교정",
      desc: "고빈도 오류 집중 훈련 10문항",
    },
    {
      day: "Day 8–13",
      icon: "📈",
      title: "2순위 패턴 교정",
      desc: "중간 오류 감소율 리포트",
    },
    {
      day: "Day 14",
      icon: "🏆",
      title: "재진단 비교",
      desc: "Day 1 vs Day 14 — 변화를 데이터로 확인",
    },
  ];
  return (
    <div style={{ position: "relative", padding: "0 8px" }}>
      {/* 연결선 */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: "12.5%",
          right: "12.5%",
          height: "1px",
          background: `linear-gradient(to right, ${C.line}, ${C.mid})`,
          opacity: 0.4,
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          position: "relative",
        }}
      >
        {steps.map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: i === 3 ? C.mid : C.bg,
                border: `2px solid ${i === 3 ? C.mid : C.line}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 10px",
                fontSize: "1.3rem",
                boxShadow: i === 3 ? `0 4px 16px ${C.mid}40` : "none",
              }}
            >
              {s.icon}
            </div>
            <div
              style={{
                fontSize: "0.62rem",
                fontWeight: "700",
                color: i === 3 ? C.mid : C.subtle,
                letterSpacing: "0.06em",
                marginBottom: "4px",
              }}
            >
              {s.day}
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: "700",
                color: C.ink,
                marginBottom: "4px",
                lineHeight: 1.3,
              }}
            >
              {s.title}
            </div>
            <div
              style={{ fontSize: "0.72rem", color: C.muted, lineHeight: 1.6 }}
            >
              {s.desc}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: "20px",
          padding: "12px 16px",
          background: C.bg,
          borderRadius: "10px",
          border: `1px solid ${C.line}`,
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: "0.78rem", color: C.mid, fontWeight: "600" }}>
          💡 Day 14 비교 리포트 — 외부 후기보다 본인 데이터의 전환력이 3~5배
          높습니다
        </span>
      </div>
    </div>
  );
}

// ── 패턴 카드 ────────────────────────────────────────────────
function PatternCard({ code, name, desc, color, bg }) {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: C.white,
        border: `1px solid ${h ? color : C.border}`,
        borderRadius: "12px",
        padding: "16px 14px",
        transition: "all 0.2s",
        boxShadow: h ? `0 8px 24px ${color}18` : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: "800",
            color,
            background: bg,
            padding: "3px 8px",
            borderRadius: "6px",
          }}
        >
          {code}
        </span>
        <span style={{ fontSize: "0.82rem", fontWeight: "700", color: C.ink }}>
          {name}
        </span>
      </div>
      <p style={{ fontSize: "0.75rem", color: C.muted, lineHeight: 1.7 }}>
        {desc}
      </p>
    </div>
  );
}

// ── 통계 카드 ────────────────────────────────────────────────
function StatCard({ stat, label, sub, color = C.mid }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "24px 16px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "12px",
      }}
    >
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
          fontWeight: "700",
          color,
          lineHeight: 1,
          marginBottom: "10px",
          letterSpacing: "-0.02em",
        }}
      >
        {stat}
      </div>
      <div
        style={{
          fontSize: "0.78rem",
          fontWeight: "600",
          color: "#c8d8c8",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: "0.69rem", color: "#6a7a6b", lineHeight: 1.5 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── 가격 플랜 ────────────────────────────────────────────────
function WaitlistForm() {
  const [form, setForm] = useState({
    academy_name: "",
    phone: "",
    student_count: "",
  });
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.academy_name || !form.phone || !form.student_count) return;
    setStatus("submitting");
    const { error } = await supabase.from("waitlist").insert([form]);
    setStatus(error ? "error" : "done");
  }

  if (status === "done") {
    return (
      <div
        style={{
          maxWidth: 440,
          margin: "0 auto",
          textAlign: "center",
          padding: "40px 20px",
          background: "#f0fdf4",
          border: "1px solid #86efac",
          borderRadius: "16px",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>✅</div>
        <p
          style={{
            fontSize: "1rem",
            fontWeight: "700",
            color: "#15803d",
            marginBottom: "8px",
          }}
        >
          신청이 완료되었습니다
        </p>
        <p style={{ fontSize: "0.85rem", color: "#166534" }}>
          담당자가 24시간 내에 연락드리겠습니다
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 440,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <input
        type="text"
        placeholder="학원명"
        required
        value={form.academy_name}
        onChange={(e) =>
          setForm((f) => ({ ...f, academy_name: e.target.value }))
        }
        style={{
          padding: "13px 16px",
          borderRadius: "10px",
          border: "1px solid #d1d5db",
          fontSize: "0.9rem",
          fontFamily: "'Noto Sans KR', sans-serif",
          outline: "none",
        }}
      />
      <input
        type="tel"
        placeholder="원장님 연락처"
        required
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        style={{
          padding: "13px 16px",
          borderRadius: "10px",
          border: "1px solid #d1d5db",
          fontSize: "0.9rem",
          fontFamily: "'Noto Sans KR', sans-serif",
          outline: "none",
        }}
      />
      <select
        required
        value={form.student_count}
        onChange={(e) =>
          setForm((f) => ({ ...f, student_count: e.target.value }))
        }
        style={{
          padding: "13px 16px",
          borderRadius: "10px",
          border: "1px solid #d1d5db",
          fontSize: "0.9rem",
          fontFamily: "'Noto Sans KR', sans-serif",
          outline: "none",
          color: form.student_count ? "#1f2937" : "#9ca3af",
          background: "#fff",
        }}
      >
        <option value="" disabled>
          학생 수
        </option>
        <option value="10명 미만">10명 미만</option>
        <option value="10~30명">10~30명</option>
        <option value="30명 이상">30명 이상</option>
      </select>
      <button
        type="submit"
        disabled={status === "submitting"}
        style={{
          padding: "14px",
          borderRadius: "10px",
          background: "#2d6e2d",
          color: "#fff",
          border: "none",
          fontSize: "0.95rem",
          fontWeight: "700",
          cursor: "pointer",
          fontFamily: "'Noto Sans KR', sans-serif",
          opacity: status === "submitting" ? 0.6 : 1,
        }}
      >
        {status === "submitting" ? "신청 중..." : "신청하기"}
      </button>
      {status === "error" && (
        <p
          style={{ fontSize: "0.8rem", color: "#dc2626", textAlign: "center" }}
        >
          오류가 발생했습니다. 다시 시도해주세요.
        </p>
      )}
    </form>
  );
}

function PriceCard({ plan, price, period, features, cta, featured, onStart }) {
  const [h, setH] = useState(false);
  return (
    <div
      style={{
        background: featured ? C.mid : C.white,
        border: featured ? `2px solid ${C.green}` : `1px solid ${C.border}`,
        borderRadius: "20px",
        padding: "28px 24px",
        position: "relative",
        overflow: "hidden",
        transition: "box-shadow 0.2s",
        boxShadow:
          h && !featured
            ? `0 12px 40px rgba(0,0,0,0.08)`
            : featured
              ? `0 16px 48px ${C.mid}35`
              : "none",
      }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {featured && (
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "rgba(255,255,255,0.18)",
            borderRadius: "100px",
            padding: "3px 10px",
            fontSize: "0.6rem",
            fontWeight: "800",
            color: "#fff",
            letterSpacing: "0.08em",
          }}
        >
          가장 많이 선택
        </div>
      )}
      <div
        style={{
          fontSize: "0.65rem",
          fontWeight: "700",
          color: featured ? "rgba(255,255,255,0.55)" : C.subtle,
          letterSpacing: "0.1em",
          marginBottom: "12px",
          textTransform: "uppercase",
        }}
      >
        {plan}
      </div>
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: "2rem",
          fontWeight: "700",
          color: featured ? "#fff" : C.ink,
          marginBottom: "3px",
        }}
      >
        {price}
        <span style={{ fontSize: "0.95rem" }}>원</span>
      </div>
      <div
        style={{
          fontSize: "0.72rem",
          color: featured ? "rgba(255,255,255,0.5)" : C.subtle,
          marginBottom: "22px",
        }}
      >
        {period}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "22px",
        }}
      >
        {features.map((f, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "flex-start", gap: 9 }}
          >
            <span
              style={{
                color: featured ? "rgba(255,255,255,0.7)" : C.line,
                fontWeight: "700",
                fontSize: "0.85rem",
                flexShrink: 0,
                marginTop: "1px",
              }}
            >
              {f.ok ? "✓" : "—"}
            </span>
            <span
              style={{
                fontSize: "0.81rem",
                color: featured
                  ? f.ok
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.35)"
                  : f.ok
                    ? C.inkMid
                    : C.subtle,
              }}
            >
              {f.text}
            </span>
          </div>
        ))}
      </div>
      {featured ? (
        <button
          onClick={onStart}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            background: "#fff",
            color: C.mid,
            border: "none",
            fontWeight: "700",
            fontSize: "0.9rem",
            cursor: "pointer",
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          {cta}
        </button>
      ) : (
        <button
          onClick={onStart}
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: "10px",
            background: "transparent",
            color: C.mid,
            border: `1.5px solid ${C.line}`,
            fontWeight: "700",
            fontSize: "0.88rem",
            cursor: "pointer",
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          {cta}
        </button>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function Landing({ onStart }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        fontFamily: "'Noto Sans KR', sans-serif",
        color: C.ink,
        overflowX: "hidden",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        ::selection { background: rgba(45,110,45,0.2); }
      `}</style>

      {/* ══ 네비 ══ */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: scrolled ? "rgba(250,248,244,0.94)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? `1px solid ${C.border}` : "none",
          transition: "all 0.3s",
          padding: "0 clamp(20px, 5vw, 60px)",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontWeight: "700",
            fontSize: "1rem",
            color: C.ink,
            letterSpacing: "-0.02em",
          }}
        >
          논리맵핑
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "0.75rem", color: C.muted }}>14일 무료</span>
          <Btn label="무료 진단 시작" onClick={onStart} size="sm" />
        </div>
      </nav>

      {/* ══ 히어로 ══ */}
      <section
        style={{
          minHeight: "100vh",
          padding:
            "clamp(100px,14vw,160px) clamp(20px,6vw,80px) clamp(60px,8vw,100px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(180deg, ${C.paper} 0%, ${C.paperAlt} 100%)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "8%",
            right: "-8%",
            width: "clamp(200px,40vw,520px)",
            height: "clamp(200px,40vw,520px)",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${C.bg} 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            textAlign: "center",
            maxWidth: 780,
            width: "100%",
          }}
        >
          <div style={{ animation: "fadeUp 0.8s ease 0.1s both" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: 20,
              }}
            >
              <Pill color={C.green}>11년 현장 검증 방법론</Pill>
              <Pill color="#b45309" bg="#fef9ec">
                204문항 오류 데이터베이스
              </Pill>
              <Pill color="#1d4ed8" bg="#eff6ff">
                AI 실시간 패턴 진단
              </Pill>
            </div>
          </div>

          <h1
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: "clamp(1.9rem, 5.5vw, 3.3rem)",
              fontWeight: "700",
              color: C.ink,
              lineHeight: "1.25",
              letterSpacing: "-0.04em",
              margin: "0 0 22px",
              animation: "fadeUp 0.8s ease 0.2s both",
            }}
          >
            열심히 공부해도
            <br />
            국어 점수가 안 오르는 이유,
            <br />
            <span style={{ color: C.mid }}>드디어 찾았습니다.</span>
          </h1>

          <p
            style={{
              fontSize: "clamp(0.9rem, 1.8vw, 1.05rem)",
              color: C.muted,
              lineHeight: "1.9",
              maxWidth: 520,
              margin: "0 auto 36px",
              animation: "fadeUp 0.8s ease 0.3s both",
            }}
          >
            당신의 오답은 실력이 아니라{" "}
            <strong style={{ color: C.ink }}>논리 오류 패턴</strong> 때문입니다.
            <br />
            어떤 패턴으로 틀리는지 진단하고, 그 패턴만 집중 교정합니다.
          </p>

          <div
            style={{
              animation: "fadeUp 0.8s ease 0.4s both",
              marginBottom: "10px",
            }}
          >
            <Btn
              label="14일 무료 진단 시작하기 →"
              onClick={onStart}
              size="lg"
            />
          </div>
          <p
            style={{
              fontSize: "0.73rem",
              color: C.subtle,
              animation: "fadeUp 0.8s ease 0.45s both",
              marginBottom: "52px",
            }}
          >
            신용카드 없이 시작 · 언제든 해지 가능
          </p>

          <div style={{ animation: "fadeUp 0.9s ease 0.55s both" }}>
            <HighlightDemo />
          </div>
        </div>
      </section>

      {/* ══ 통계 (다크) ══ */}
      <section
        style={{
          background: C.ink,
          padding: "clamp(56px,7vw,88px) clamp(20px,6vw,80px)",
        }}
      >
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div
              style={{
                display: "inline-block",
                fontSize: "0.63rem",
                fontWeight: "700",
                color: C.line,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              The Problem
            </div>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "clamp(1.4rem, 3.2vw, 2.2rem)",
                fontWeight: "700",
                color: "#fff",
                lineHeight: 1.35,
                letterSpacing: "-0.03em",
                maxWidth: 580,
                margin: "0 auto",
              }}
            >
              해설을 봐도 왜 틀렸는지
              <br />
              여전히 모르시나요?
            </h2>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "2px",
              maxWidth: 780,
              margin: "0 auto",
            }}
          >
            <StatCard
              stat="8종"
              label="반복되는 오류 패턴"
              sub={"사실왜곡 · 인과전도\n과잉추론 · 개념혼합 외"}
              color={C.line}
            />
            <StatCard
              stat="1~2문항"
              label="등급을 가르는 차이"
              sub="1·2등급 경계는 단 한두 문제"
              color={C.line}
            />
            <StatCard
              stat="+10.7%"
              label="국어 사교육비 YoY 성장"
              sub="4개 과목 중 성장률 1위 (2024)"
              color={C.line}
            />
          </div>
        </FadeIn>
      </section>

      {/* ══ 페인포인트 ══ */}
      <section
        style={{
          background: C.paper,
          padding: "clamp(64px,8vw,100px) clamp(20px,6vw,80px)",
        }}
      >
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <div style={{ marginBottom: 14 }}>
              <Pill color={C.red} bg={C.redBg}>
                학생이 실제로 겪는 문제
              </Pill>
            </div>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "clamp(1.4rem, 3vw, 2rem)",
                fontWeight: "700",
                color: C.ink,
                letterSpacing: "-0.03em",
                maxWidth: 520,
                margin: "0 auto",
              }}
            >
              열심히 하는데 왜<br />
              점수가 안 오를까요?
            </h2>
          </div>
        </FadeIn>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            maxWidth: 860,
            margin: "0 auto",
          }}
        >
          {[
            {
              icon: "❌",
              title: '오답 해설을 봐도 "내가 왜 틀렸는지" 모름',
              desc: "기존 해설은 정답 이유를 설명합니다. 내가 어떤 사고 경로로 오답을 선택했는지는 설명하지 않습니다.",
            },
            {
              icon: "🔄",
              title: "같은 유형에서 반복 실수",
              desc: "틀린 이유를 안다고 생각하지만 오류 구조를 모르는 것. 패턴 교정 없는 반복 풀이는 오히려 나쁜 습관을 굳힙니다.",
            },
            {
              icon: "💸",
              title: "학원·인강 비용만 쌓이고 방향이 없음",
              desc: "강의를 듣는 것은 소비입니다. 내 오류 패턴을 모르면 어떤 강의를 들어도 같은 곳에서 틀립니다.",
            },
          ].map((p, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: "14px",
                  padding: "22px 20px",
                  borderLeft: `3px solid ${C.red}`,
                }}
              >
                <div style={{ fontSize: "1.4rem", marginBottom: "12px" }}>
                  {p.icon}
                </div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: "700",
                    color: C.ink,
                    marginBottom: "8px",
                    lineHeight: 1.4,
                  }}
                >
                  {p.title}
                </div>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: C.muted,
                    lineHeight: 1.8,
                  }}
                >
                  {p.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ══ 페르소나 ══ */}
      <section
        style={{
          background: C.paperAlt,
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          padding: "clamp(48px,6vw,72px) clamp(20px,6vw,80px)",
          textAlign: "center",
        }}
      >
        <FadeIn>
          <div style={{ marginBottom: 14 }}>
            <Pill>이런 학생에게 정확히 맞습니다</Pill>
          </div>
          <h2
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: "clamp(1.3rem, 2.8vw, 1.8rem)",
              fontWeight: "700",
              color: C.ink,
              letterSpacing: "-0.03em",
              marginBottom: "28px",
            }}
          >
            혹시 이 중에 해당되시나요?
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "8px",
              maxWidth: 680,
              margin: "0 auto 24px",
            }}
          >
            {[
              {
                text: "수능 국어 2~4등급, 점수 정체 중",
                color: C.mid,
                bg: C.bg,
              },
              {
                text: "문제 풀어도 왜 틀렸는지 모름",
                color: "#15803d",
                bg: "#f0fdf4",
              },
              {
                text: "강의는 들었는데 실전에서 적용 안 됨",
                color: "#b45309",
                bg: "#fef9ec",
              },
              {
                text: "고2~고3 · 수능 D-6개월 이내",
                color: "#dc2626",
                bg: "#fef2f2",
              },
              {
                text: "지방 거주 · 수도권 명강사 접근 어려움",
                color: "#1d4ed8",
                bg: "#eff6ff",
              },
              {
                text: "비용 대비 효과에 의문을 가진 학부모",
                color: C.muted,
                bg: C.paperAlt,
              },
            ].map((chip, i) => (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: chip.bg,
                  border: `1px solid ${chip.color}30`,
                  borderRadius: "100px",
                  padding: "7px 14px",
                  fontSize: "0.8rem",
                  color: chip.color,
                  fontWeight: "500",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: chip.color,
                    flexShrink: 0,
                  }}
                />
                {chip.text}
              </span>
            ))}
          </div>
          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.line}`,
              borderRadius: "10px",
              padding: "12px 20px",
              maxWidth: 560,
              margin: "0 auto",
              fontSize: "0.8rem",
              color: C.mid,
              lineHeight: 1.7,
            }}
          >
            <strong>핵심 인사이트:</strong> 국어 2~4등급 학생의 공통점 — "틀린
            이유를 안다고 생각하지만 같은 유형에서 반복 실수." 이유를 모르는 게
            아니라 <strong>오류 구조</strong>를 모르는 것.
          </div>
        </FadeIn>
      </section>

      {/* ══ 핵심 기능 ══ */}
      <section
        style={{
          background: C.paper,
          padding: "clamp(64px,8vw,100px) clamp(20px,6vw,80px)",
        }}
      >
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: "52px" }}>
            <div style={{ marginBottom: 14 }}>
              <Pill>논리진단이 다른 이유</Pill>
            </div>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "clamp(1.4rem, 3vw, 2rem)",
                fontWeight: "700",
                color: C.ink,
                letterSpacing: "-0.03em",
                marginBottom: "14px",
              }}
            >
              선지 하나를 클릭할 때마다
              <br />
              지문이 응답합니다
            </h2>
            <p
              style={{
                fontSize: "0.9rem",
                color: C.muted,
                lineHeight: 1.8,
                maxWidth: 460,
                margin: "0 auto",
              }}
            >
              강의를 듣는 것은 소비입니다.
              <br />
              진단이 처방을 만듭니다.
            </p>
          </div>
        </FadeIn>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "18px",
            maxWidth: 860,
            margin: "0 auto",
          }}
        >
          {[
            {
              icon: "🔦",
              title: "지문 근거 형광펜",
              accent: "#3b82f6",
              desc: "선지를 클릭하면 해당 판단의 근거가 된 지문 문장이 색상으로 표시됩니다. 논리를 눈으로 추적하세요.",
            },
            {
              icon: "🔖",
              title: "오류 패턴 자동 분류",
              accent: C.mid,
              desc: "독서 4종(사실왜곡·인과전도·과잉추론·개념혼합), 문학 4종으로 자동 분류. 내가 어떤 함정에 자주 빠지는지 알 수 있습니다.",
            },
            {
              icon: "📊",
              title: "누적 개인 리포트",
              accent: "#8b5cf6",
              desc: "풀수록 쌓이는 데이터. 고빈도 패턴을 시각화하고, 그 패턴만 집중 훈련하는 처방 세트를 자동 생성합니다.",
            },
          ].map((f, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div
                style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: "16px",
                  padding: "26px 22px",
                  height: "100%",
                  transition: "box-shadow 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.boxShadow = `0 12px 40px ${f.accent}18`)
                }
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 11,
                    background: `${f.accent}14`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.3rem",
                    marginBottom: "16px",
                  }}
                >
                  {f.icon}
                </div>
                <h3
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: "1rem",
                    fontWeight: "700",
                    color: C.ink,
                    marginBottom: "9px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: "0.81rem",
                    color: C.muted,
                    lineHeight: "1.8",
                  }}
                >
                  {f.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ══ 오류 패턴 카드 ══ */}
      <section
        style={{
          background: C.paperAlt,
          borderTop: `1px solid ${C.border}`,
          padding: "clamp(56px,7vw,88px) clamp(20px,6vw,80px)",
        }}
      >
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div style={{ marginBottom: 14 }}>
              <Pill>8종 오류 패턴 분류 체계</Pill>
            </div>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "clamp(1.3rem, 2.8vw, 1.8rem)",
                fontWeight: "700",
                color: C.ink,
                letterSpacing: "-0.03em",
                marginBottom: "12px",
              }}
            >
              모든 오답에는 이름이 있습니다
            </h2>
            <p style={{ fontSize: "0.85rem", color: C.muted, lineHeight: 1.8 }}>
              11년 현장 경험으로 구조화한 오류 분류 체계. 이름을 알면 교정할 수
              있습니다.
            </p>
          </div>
        </FadeIn>

        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: "700",
              color: C.muted,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            독서형
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: "10px",
              marginBottom: "24px",
            }}
          >
            {[
              {
                code: "R1",
                name: "사실 왜곡",
                desc: "수치·상태·방향을 정반대나 다른 값으로 서술",
                color: "#c0392b",
                bg: "rgba(192,57,43,0.08)",
              },
              {
                code: "R2",
                name: "인과·관계 전도",
                desc: "주체-객체, 원인-결과, 포함관계를 뒤바꿈",
                color: "#7d3c98",
                bg: "rgba(125,60,152,0.08)",
              },
              {
                code: "R3",
                name: "과잉 추론",
                desc: "지문에 없는 내용, 1단계 이상 비약",
                color: "#1565c0",
                bg: "rgba(21,101,192,0.08)",
              },
              {
                code: "R4",
                name: "개념 혼합",
                desc: "서로 다른 문단의 개념어를 섞어 거짓 문장 구성",
                color: "#b7950b",
                bg: "rgba(183,149,11,0.08)",
              },
            ].map((p, i) => (
              <FadeIn key={i} delay={i * 0.06}>
                <PatternCard {...p} />
              </FadeIn>
            ))}
          </div>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: "700",
              color: C.muted,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            문학형
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: "10px",
            }}
          >
            {[
              {
                code: "L1",
                name: "표현·형식 오독",
                desc: "시어·수사법·서술 방식을 잘못 파악",
                color: "#e74c3c",
                bg: "rgba(231,76,60,0.08)",
              },
              {
                code: "L2",
                name: "정서·태도 오독",
                desc: "화자·인물의 감정·태도를 반대로 파악",
                color: "#2980b9",
                bg: "rgba(41,128,185,0.08)",
              },
              {
                code: "L3",
                name: "주제·의미 과잉",
                desc: "작품에 없는 의미 도출, 근거 없는 확대 해석",
                color: "#27ae60",
                bg: "rgba(39,174,96,0.08)",
              },
              {
                code: "L4",
                name: "보기 대입 오류",
                desc: "보기 조건을 잘못 적용하거나 보기 자체를 오독",
                color: "#d35400",
                bg: "rgba(211,84,0,0.08)",
              },
            ].map((p, i) => (
              <FadeIn key={i} delay={i * 0.06}>
                <PatternCard {...p} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 14일 여정 ══ */}
      <section
        style={{
          background: C.paper,
          padding: "clamp(64px,8vw,100px) clamp(20px,6vw,80px)",
        }}
      >
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <div style={{ marginBottom: 14 }}>
              <Pill>14일 무료 체험 구조</Pill>
            </div>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "clamp(1.4rem, 3vw, 2rem)",
                fontWeight: "700",
                color: C.ink,
                letterSpacing: "-0.03em",
                marginBottom: "12px",
              }}
            >
              14일 안에 변화를
              <br />
              데이터로 확인합니다
            </h2>
            <p style={{ fontSize: "0.87rem", color: C.muted, lineHeight: 1.8 }}>
              신용카드 없이 시작. Day 14 비교 리포트가 가장 강력한 전환
              트리거입니다.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <JourneyViz />
          </div>
        </FadeIn>
      </section>

      {/* ══ 방식 비교 ══ */}
      <section
        style={{
          background: C.paperAlt,
          borderTop: `1px solid ${C.border}`,
          padding: "clamp(64px,8vw,100px) clamp(20px,6vw,80px)",
        }}
      >
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: "44px" }}>
            <div style={{ marginBottom: 14 }}>
              <Pill>방식의 차이</Pill>
            </div>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "clamp(1.4rem, 3vw, 2rem)",
                fontWeight: "700",
                color: C.ink,
                letterSpacing: "-0.03em",
                marginBottom: "12px",
              }}
            >
              강의 소비형 vs 논리진단형
            </h2>
            <p style={{ fontSize: "0.87rem", color: C.muted }}>
              카테고리 자체가 다릅니다.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            {[
              { item: "오류 패턴 진단", us: "8종 구조 분류", them: "없음" },
              { item: "지문 근거 시각화", us: "선지별 형광펜", them: "없음" },
              {
                item: "개인화 리포트",
                us: "누적 패턴 추적 + 처방",
                them: "오답노트 수준",
              },
              {
                item: "학습 방향성",
                us: "진단 → 처방 → 교정",
                them: "강의 소비형",
              },
              {
                item: "월 비용",
                us: "3.9~8.9만원",
                them: "학원 평균 16.4만원",
              },
            ].map((row, i) => (
              <FadeIn key={i} delay={i * 0.06}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "130px 1fr 1fr",
                    gap: "8px",
                    marginBottom: "8px",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.77rem",
                      color: C.muted,
                      fontWeight: "500",
                    }}
                  >
                    {row.item}
                  </div>
                  <div
                    style={{
                      background: C.bg,
                      border: `1px solid ${C.line}`,
                      borderRadius: "8px",
                      padding: "9px 14px",
                      fontSize: "0.78rem",
                      fontWeight: "700",
                      color: C.mid,
                    }}
                  >
                    {row.us}
                  </div>
                  <div
                    style={{
                      background: C.paperAlt,
                      border: `1px solid ${C.border}`,
                      borderRadius: "8px",
                      padding: "9px 14px",
                      fontSize: "0.78rem",
                      color: C.subtle,
                    }}
                  >
                    {row.them}
                  </div>
                </div>
              </FadeIn>
            ))}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "130px 1fr 1fr",
                gap: "8px",
                marginTop: "4px",
              }}
            >
              <div />
              <div
                style={{
                  textAlign: "center",
                  fontSize: "0.65rem",
                  fontWeight: "700",
                  color: C.mid,
                  letterSpacing: "0.06em",
                }}
              >
                논리진단 방식
              </div>
              <div
                style={{
                  textAlign: "center",
                  fontSize: "0.65rem",
                  color: C.subtle,
                  letterSpacing: "0.06em",
                }}
              >
                강의 소비 방식
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ══ 수록 시험 ══ */}
      <section
        style={{
          background: C.paper,
          padding: "clamp(48px,6vw,72px) clamp(20px,6vw,80px)",
          textAlign: "center",
        }}
      >
        <FadeIn>
          <Pill>수록 콘텐츠</Pill>
          <h2
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: "clamp(1.3rem, 2.8vw, 1.8rem)",
              fontWeight: "700",
              color: C.ink,
              margin: "18px 0 10px",
              letterSpacing: "-0.03em",
            }}
          >
            수능 국어 기출 7개년
          </h2>
          <p
            style={{
              fontSize: "0.83rem",
              color: C.muted,
              marginBottom: "32px",
              lineHeight: 1.75,
            }}
          >
            2022~2026학년도 수능·9월·6월 모의평가 · 독서 + 문학 전 문항 · 선지
            해설 완비
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "8px",
              maxWidth: 620,
              margin: "0 auto",
            }}
          >
            {[
              { label: "2026수능", free: true },
              { label: "2025수능", free: true },
              { label: "2025_9월 모의", free: false },
              { label: "2024수능", free: false },
              { label: "2023수능", free: false },
              { label: "2022수능", free: false },
              { label: "2022_6월 모의", free: false },
            ].map((item) => (
              <span
                key={item.label}
                style={{
                  padding: "5px 15px",
                  borderRadius: "100px",
                  fontSize: "0.76rem",
                  fontWeight: item.free ? "700" : "500",
                  background: item.free ? C.bg : C.white,
                  border: `1px solid ${item.free ? C.line : C.border}`,
                  color: item.free ? C.mid : C.muted,
                }}
              >
                {item.free && "🆓 "}
                {item.label}
              </span>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ══ 가격 ══ */}
      <section
        style={{
          background: C.paperAlt,
          borderTop: `1px solid ${C.border}`,
          padding: "clamp(64px,8vw,100px) clamp(20px,6vw,80px)",
        }}
      >
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <div style={{ marginBottom: 14 }}>
              <Pill>요금제</Pill>
            </div>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "clamp(1.4rem, 3vw, 2rem)",
                fontWeight: "700",
                color: C.ink,
                letterSpacing: "-0.03em",
                marginBottom: "12px",
              }}
            >
              무료로 시작, 필요하면 확장
            </h2>
            <p style={{ fontSize: "0.87rem", color: C.muted }}>
              학원 월 수강료 평균 16.4만원의 1/4 가격 · 언제든 해지 · 30일 환불
              보장
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              maxWidth: 780,
              margin: "0 auto",
            }}
          >
            <PriceCard
              plan="스타터"
              price="0"
              period="14일 무료 · 신용카드 불필요"
              features={[
                { text: "진단 20문항", ok: true },
                { text: "오류 패턴 리포트 1회", ok: true },
                { text: "형광펜 근거 표시", ok: true },
                { text: "누적 리포트", ok: false },
                { text: "1:1 전문가 리뷰", ok: false },
              ]}
              cta="무료로 시작"
              onStart={onStart}
            />
            <PriceCard
              plan="스탠다드"
              price="39,900"
              period="/ 월 · 구독"
              features={[
                { text: "전 기출 204문항 전체 접근", ok: true },
                { text: "오류 패턴 8종 진단 무제한", ok: true },
                { text: "누적 개인 리포트 + 처방", ok: true },
                { text: "주간 진도 트래킹", ok: true },
                { text: "1:1 전문가 리뷰", ok: false },
              ]}
              cta="지금 시작하기"
              featured
              onStart={onStart}
            />
            <PriceCard
              plan="프리미엄"
              price="89,000"
              period="/ 월 · 학생 1인"
              features={[
                { text: "스탠다드 전체 포함", ok: true },
                { text: "월 2회 전문가 1:1 리뷰", ok: true },
                { text: "맞춤 교정 플랜 수립", ok: true },
                { text: "학부모 리포트 공유", ok: true },
                { text: "수능 전 긴급 점검 1회", ok: true },
              ]}
              cta="상담 후 시작"
              onStart={onStart}
            />
          </div>
        </FadeIn>
      </section>

      {/* ══ 보장 ══ */}
      <section
        style={{
          background: C.paper,
          padding: "clamp(56px,7vw,80px) clamp(20px,6vw,80px)",
        }}
      >
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div style={{ marginBottom: 14 }}>
              <Pill>리스크 제거</Pill>
            </div>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "clamp(1.3rem, 2.8vw, 1.8rem)",
                fontWeight: "700",
                color: C.ink,
                letterSpacing: "-0.03em",
              }}
            >
              돈 낭비 걱정 없게 만듭니다
            </h2>
          </div>
        </FadeIn>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
            maxWidth: 780,
            margin: "0 auto",
          }}
        >
          {[
            {
              icon: "🛡️",
              title: "30일 전액 환불 보장",
              desc: "가입 후 30일 이내 이유 불문 전액 환불. 문의 한 통이면 완료. 질문 없음.",
              color: "#15803d",
              bg: "#f0fdf4",
              border: "#86efac",
            },
            {
              icon: "🎁",
              title: "진단 불만족 시 무료 연장",
              desc: "첫 진단 리포트가 기대에 못 미치면 1개월 무료 연장 제공. 자동 적용.",
              color: "#15803d",
              bg: "#f0fdf4",
              border: "#86efac",
            },
            {
              icon: "🔓",
              title: "신용카드 없이 시작",
              desc: "14일 무료 체험 동안 결제 정보 불필요. 모든 핵심 기능 체험 가능.",
              color: C.mid,
              bg: C.bg,
              border: C.line,
            },
            {
              icon: "📄",
              title: "데이터는 내 것",
              desc: "구독 해지 후에도 본인의 오류 패턴 리포트 PDF 다운로드 유지. 데이터 잠금 없음.",
              color: C.mid,
              bg: C.bg,
              border: C.line,
            },
          ].map((g, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div
                style={{
                  background: g.bg,
                  border: `1px solid ${g.border}`,
                  borderRadius: "14px",
                  padding: "20px 18px",
                }}
              >
                <div style={{ fontSize: "1.4rem", marginBottom: "10px" }}>
                  {g.icon}
                </div>
                <div
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: "700",
                    color: g.color,
                    marginBottom: "7px",
                  }}
                >
                  {g.title}
                </div>
                <p
                  style={{
                    fontSize: "0.78rem",
                    color: g.color,
                    lineHeight: 1.75,
                    opacity: 0.8,
                  }}
                >
                  {g.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ══ B2B 학원 도입 ══ */}
      <section
        id="b2b-waitlist"
        style={{
          background: C.paper,
          borderTop: `1px solid ${C.border}`,
          padding: "clamp(64px,8vw,100px) clamp(20px,6vw,80px)",
        }}
      >
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div style={{ marginBottom: 14 }}>
              <Pill>학원 도입</Pill>
            </div>
            <h2
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: "clamp(1.4rem, 3vw, 2rem)",
                fontWeight: "700",
                color: C.ink,
                letterSpacing: "-0.03em",
                marginBottom: "12px",
              }}
            >
              우리 학원에도 도입하고 싶으신가요?
            </h2>
            <p style={{ fontSize: "0.87rem", color: C.muted, lineHeight: 1.8 }}>
              수학·영어 전문 학원에서 국어 성적까지. 강사 없이 운영 가능합니다.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <WaitlistForm />
        </FadeIn>
      </section>

      {/* ══ 최종 CTA ══ */}
      <section
        style={{
          background: C.ink,
          padding: "clamp(64px,8vw,100px) clamp(20px,6vw,80px)",
          textAlign: "center",
        }}
      >
        <FadeIn>
          <h2
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)",
              fontWeight: "700",
              color: "#fff",
              lineHeight: 1.35,
              letterSpacing: "-0.03em",
              margin: "0 auto 14px",
              maxWidth: 520,
            }}
          >
            지금 무료로
            <br />내 오류 패턴을 확인하세요
          </h2>
          <p
            style={{
              fontSize: "0.88rem",
              color: "#5a6b5b",
              marginBottom: "12px",
              lineHeight: 1.7,
            }}
          >
            진단 20문항 · 10분 소요 · 즉시 리포트 발급
          </p>
          <p
            style={{
              fontSize: "0.83rem",
              color: "#3a4b3b",
              marginBottom: "36px",
            }}
          >
            국어 오답의 원인, 오늘 안에 알 수 있습니다.
          </p>
          <Btn
            label="무료 진단 시작하기 →"
            onClick={onStart}
            variant="white"
            size="lg"
          />
          <p
            style={{
              fontSize: "0.75rem",
              color: "#3a4b3b",
              marginTop: "16px",
              fontWeight: "600",
              letterSpacing: "0.02em",
            }}
          >
            수능까지 남은 시간이 가장 비쌉니다.
          </p>
        </FadeIn>
      </section>

      {/* ══ 푸터 ══ */}
      <footer
        style={{
          background: "#08100a",
          padding: "24px clamp(20px,5vw,60px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <span
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: "0.88rem",
            fontWeight: "700",
            color: "rgba(255,255,255,0.35)",
          }}
        >
          논리맵핑
        </span>
        <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.2)" }}>
          © 2025 수능 국어 논리맵핑
        </span>
      </footer>
    </div>
  );
}
