// ============================================================
// Payment.jsx — 3티어 구독 결제 (스타터/스탠다드/프리미엄)
// 토스페이먼츠 가맹점 심사 완료 전: 스탠다드·프리미엄 "준비 중" 처리
// ============================================================

import { useState, useEffect } from "react";

const C = {
  green: "#2d6e2d",
  soft: "#3d8b3d",
  bg: "#f0f7f0",
  line: "#7aad7a",
  ink: "#0d1a0e",
  muted: "#5a6b5b",
  subtle: "#8a9b8b",
  paper: "#faf8f4",
  border: "#e0dbd0",
};

// 토스 SDK 로드
function loadTossSDK() {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) {
      resolve(window.TossPayments);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.tosspayments.com/v2/base";
    s.onload = () => {
      if (typeof TossPayments !== "undefined") resolve(TossPayments);
      else if (window.TossPayments) resolve(window.TossPayments);
      else reject(new Error("SDK 로드 실패"));
    };
    s.onerror = () => reject(new Error("SDK 로드 실패"));
    document.head.appendChild(s);
  });
}

const PLANS = [
  {
    id: "starter",
    name: "스타터",
    price: 0,
    period: "14일 무료",
    badge: null,
    features: [
      { text: "진단 20문항", ok: true },
      { text: "오류 패턴 리포트 1회", ok: true },
      { text: "형광펜 근거 표시", ok: true },
      { text: "누적 리포트", ok: false },
      { text: "1:1 전문가 리뷰", ok: false },
    ],
    cta: "무료로 시작",
    available: true, // 결제 불필요
  },
  {
    id: "standard",
    name: "스탠다드",
    price: 39900,
    period: "/ 월 · 구독",
    badge: "가장 많이 선택",
    features: [
      { text: "전 기출 204문항 전체 접근", ok: true },
      { text: "오류 패턴 8종 진단 무제한", ok: true },
      { text: "누적 개인 리포트 + 처방", ok: true },
      { text: "주간 진도 트래킹", ok: true },
      { text: "1:1 전문가 리뷰", ok: false },
    ],
    cta: "지금 시작하기",
    available: false, // 토스 심사 후 true로
  },
  {
    id: "premium",
    name: "프리미엄",
    price: 89000,
    period: "/ 월 · 학생 1인",
    badge: null,
    features: [
      { text: "스탠다드 전체 포함", ok: true },
      { text: "월 2회 전문가 1:1 리뷰", ok: true },
      { text: "맞춤 교정 플랜 수립", ok: true },
      { text: "학부모 리포트 공유", ok: true },
      { text: "수능 전 긴급 점검 1회", ok: true },
    ],
    cta: "상담 후 시작",
    available: false, // 토스 심사 후 true로
  },
];

function PlanCard({
  plan,
  selected,
  onSelect,
  tossPayments,
  loading,
  onPay,
  onFreeStart,
}) {
  const isFree = plan.price === 0;
  const isFeatured = plan.id === "standard";
  const [hov, setHov] = useState(false);

  function handleCta() {
    if (isFree) {
      onFreeStart?.();
      return;
    }
    if (!plan.available) return; // 준비 중
    onSelect(plan.id);
    onPay(plan);
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: isFeatured ? C.green : "#fff",
        border: isFeatured
          ? `2px solid #1e5c1e`
          : `1px solid ${selected === plan.id ? C.green : C.border}`,
        borderRadius: "18px",
        padding: "26px 22px",
        position: "relative",
        overflow: "hidden",
        transition: "box-shadow 0.2s",
        boxShadow: hov
          ? isFeatured
            ? `0 16px 48px rgba(45,110,45,0.35)`
            : `0 8px 32px rgba(0,0,0,0.08)`
          : "none",
        cursor: plan.available || isFree ? "pointer" : "default",
      }}
      onClick={isFree ? onFreeStart : undefined}
    >
      {/* 추천 배지 */}
      {plan.badge && (
        <div
          style={{
            position: "absolute",
            top: 13,
            right: 13,
            background: "rgba(255,255,255,0.18)",
            borderRadius: "100px",
            padding: "3px 10px",
            fontSize: "0.6rem",
            fontWeight: "800",
            color: "#fff",
            letterSpacing: "0.08em",
          }}
        >
          {plan.badge}
        </div>
      )}

      {/* 준비 중 배지 */}
      {!plan.available && !isFree && (
        <div
          style={{
            position: "absolute",
            top: 13,
            left: 13,
            background: "rgba(0,0,0,0.08)",
            borderRadius: "100px",
            padding: "3px 10px",
            fontSize: "0.6rem",
            fontWeight: "700",
            color: isFeatured ? "rgba(255,255,255,0.6)" : C.subtle,
            letterSpacing: "0.06em",
          }}
        >
          출시 준비 중
        </div>
      )}

      {/* 플랜명 */}
      <div
        style={{
          fontSize: "0.65rem",
          fontWeight: "700",
          color: isFeatured ? "rgba(255,255,255,0.55)" : C.subtle,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: "12px",
          marginTop: !plan.available && !isFree ? "18px" : 0,
        }}
      >
        {plan.name}
      </div>

      {/* 가격 */}
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: isFree ? "1.9rem" : "2rem",
          fontWeight: "700",
          color: isFeatured ? "#fff" : C.ink,
          marginBottom: "3px",
          letterSpacing: "-0.02em",
        }}
      >
        {isFree ? "0" : plan.price.toLocaleString()}
        <span style={{ fontSize: "0.95rem", fontWeight: "500" }}>원</span>
      </div>
      <div
        style={{
          fontSize: "0.72rem",
          color: isFeatured ? "rgba(255,255,255,0.5)" : C.subtle,
          marginBottom: "20px",
        }}
      >
        {plan.period}
      </div>

      {/* 기능 목록 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "22px",
        }}
      >
        {plan.features.map((f, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "flex-start", gap: 9 }}
          >
            <span
              style={{
                color: f.ok
                  ? isFeatured
                    ? "rgba(255,255,255,0.7)"
                    : C.line
                  : isFeatured
                    ? "rgba(255,255,255,0.2)"
                    : "#d1d5db",
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
                color: f.ok
                  ? isFeatured
                    ? "rgba(255,255,255,0.9)"
                    : C.ink
                  : isFeatured
                    ? "rgba(255,255,255,0.3)"
                    : C.subtle,
              }}
            >
              {f.text}
            </span>
          </div>
        ))}
      </div>

      {/* CTA 버튼 */}
      {isFree ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFreeStart?.();
          }}
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: "10px",
            background: "transparent",
            color: C.green,
            border: `1.5px solid ${C.line}`,
            fontWeight: "700",
            fontSize: "0.88rem",
            cursor: "pointer",
            fontFamily: "'Noto Sans KR', sans-serif",
            transition: "background 0.15s",
          }}
        >
          {plan.cta}
        </button>
      ) : plan.available ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCta();
          }}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            background: isFeatured ? "#fff" : C.green,
            color: isFeatured ? C.green : "#fff",
            border: "none",
            fontWeight: "700",
            fontSize: "0.9rem",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "'Noto Sans KR', sans-serif",
            opacity: loading ? 0.7 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {loading ? "처리 중..." : plan.cta}
        </button>
      ) : (
        <div
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: "10px",
            background: isFeatured ? "rgba(255,255,255,0.1)" : "#f3f4f6",
            color: isFeatured ? "rgba(255,255,255,0.4)" : C.subtle,
            border: isFeatured
              ? "1px solid rgba(255,255,255,0.15)"
              : `1px solid ${C.border}`,
            fontWeight: "700",
            fontSize: "0.88rem",
            textAlign: "center",
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          🔜 출시 예정
        </div>
      )}
    </div>
  );
}

export default function Payment({ user, onSuccess }) {
  const [tossPayments, setTossPayments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sdkError, setSdkError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    const key = import.meta.env.VITE_TOSS_CLIENT_KEY;
    if (!key) return; // 키 없으면 SDK 로드 생략
    loadTossSDK()
      .then((TossPayments) => {
        const toss = TossPayments(key);
        const payment = toss.payment({ customerKey: user.id });
        setTossPayments(payment);
      })
      .catch((err) => setSdkError(err.message));
  }, [user]);

  async function handlePay(plan) {
    if (!tossPayments || !user || !plan.available) return;
    setLoading(true);
    try {
      await tossPayments.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: plan.price },
        orderId: `order_${user.id}_${Date.now()}`,
        orderName: `논리맵핑 ${plan.name} 구독 (1개월)`,
        customerEmail: user.email,
        customerName: user.email,
        successUrl:
          window.location.origin +
          "/?paymentKey={paymentKey}&orderId={orderId}&amount={amount}",
        failUrl: window.location.origin + "/?code={code}&message={message}",
      });
      onSuccess?.();
    } catch (err) {
      if (err.code !== "PAY_PROCESS_CANCELED") {
        console.error("[결제 오류]", err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleFreeStart() {
    onSuccess?.();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        fontFamily: "'Noto Sans KR', sans-serif",
        color: C.ink,
        padding: "clamp(40px, 8vw, 80px) clamp(20px, 5vw, 40px)",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 헤더 */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div
          style={{
            display: "inline-block",
            fontSize: "0.63rem",
            fontWeight: "700",
            color: C.green,
            background: C.bg,
            border: `1px solid ${C.line}35`,
            borderRadius: "100px",
            padding: "4px 14px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "18px",
          }}
        >
          요금제
        </div>
        <h1
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)",
            fontWeight: "700",
            color: C.ink,
            lineHeight: "1.3",
            letterSpacing: "-0.03em",
            margin: "0 0 14px",
          }}
        >
          무료로 시작, 필요하면 확장
        </h1>
        <p style={{ fontSize: "0.9rem", color: C.muted, lineHeight: 1.8 }}>
          학원 월 수강료 평균 16.4만원의 1/4 가격
          <br />
          언제든 해지 · 30일 전액 환불 보장
        </p>
      </div>

      {/* SDK 오류 */}
      {sdkError && (
        <div
          style={{
            maxWidth: "680px",
            margin: "0 auto 20px",
            padding: "10px 14px",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "10px",
            fontSize: "0.8rem",
            color: "#7f1d1d",
          }}
        >
          ⚠️ 결제 모듈 로드 실패: {sdkError}
        </div>
      )}

      {/* 플랜 카드 3개 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          maxWidth: "780px",
          margin: "0 auto 40px",
        }}
      >
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selected={selected}
            onSelect={setSelected}
            tossPayments={tossPayments}
            loading={loading && selected === plan.id}
            onPay={handlePay}
            onFreeStart={handleFreeStart}
          />
        ))}
      </div>

      {/* 보장 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
          maxWidth: "780px",
          margin: "0 auto 32px",
        }}
      >
        {[
          {
            icon: "🛡️",
            title: "30일 전액 환불",
            desc: "이유 불문, 문의 한 통으로 완료",
          },
          {
            icon: "🔓",
            title: "신용카드 없이 시작",
            desc: "14일 무료 체험 — 결제 정보 불필요",
          },
          {
            icon: "📄",
            title: "데이터는 내 것",
            desc: "해지 후에도 리포트 PDF 다운로드 유지",
          },
        ].map((g, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: `1px solid ${C.border}`,
              borderRadius: "12px",
              padding: "16px 18px",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{g.icon}</span>
            <div>
              <div
                style={{
                  fontSize: "0.82rem",
                  fontWeight: "700",
                  color: C.ink,
                  marginBottom: "4px",
                }}
              >
                {g.title}
              </div>
              <div
                style={{ fontSize: "0.75rem", color: C.muted, lineHeight: 1.6 }}
              >
                {g.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 안내 */}
      <p
        style={{
          fontSize: "0.72rem",
          color: C.subtle,
          textAlign: "center",
          lineHeight: "1.7",
        }}
      >
        스탠다드·프리미엄 플랜은 결제 시스템 준비 완료 후 순차 오픈 예정입니다.
        <br />
        현재 무료 스타터 플랜으로 핵심 기능을 먼저 경험해보세요.
      </p>
    </div>
  );
}
