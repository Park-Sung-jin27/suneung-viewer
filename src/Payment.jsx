// ============================================================
// Payment.jsx — 토스페이먼츠 Pro 구독 결제
// ============================================================

import { useState, useEffect } from 'react';

const C = {
  bg:    '#f9f5ed',
  green: '#2d6e2d',
  gl:    '#f2f7f2',
  gb:    '#7aad7a',
  beige: '#e8e0d0',
  ink:   '#1a1a14',
  muted: '#6b7280',
};

// 토스페이먼츠 SDK CDN 로드 (v2)
function loadTossSDK() {
  return new Promise((resolve, reject) => {
    if (window.TossPayments) { resolve(window.TossPayments); return; }
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v2/base';
    script.onload = () => {
      if (typeof TossPayments !== 'undefined') {
        resolve(TossPayments);
      } else if (window.TossPayments) {
        resolve(window.TossPayments);
      } else {
        reject(new Error('토스페이먼츠 SDK 로드 실패: TossPayments를 찾을 수 없습니다'));
      }
    };
    script.onerror = () => reject(new Error('토스페이먼츠 SDK 로드 실패'));
    document.head.appendChild(script);
  });
}

const FEATURES = [
  '전체 시험 접근 (11개)',
  '오답 패턴 분석',
  'AI 해설 상세',
];

export default function Payment({ user, onSuccess }) {
  const [tossPayments, setTossPayments] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [sdkError, setSdkError]         = useState(null);

  // SDK 초기화 (v2)
  useEffect(() => {
    if (!user) return;
    loadTossSDK()
      .then(TossPayments => {
        const toss    = TossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY);
        const payment = toss.payment({ customerKey: user.id });
        setTossPayments(payment);
      })
      .catch(err => setSdkError(err.message));
  }, [user]);

  async function handlePay() {
    if (!tossPayments || !user) return;
    setLoading(true);
    try {
      await tossPayments.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: 5900 },
        orderId: `order_${user.id}_${Date.now()}`,
        orderName: '논리맵핑 Pro 구독 (1개월)',
        customerEmail: user.email,
        customerName: user.email,
        successUrl: window.location.origin + '/payment/success',
        failUrl:    window.location.origin + '/payment/fail',
      });
      onSuccess?.();
    } catch (err) {
      // 사용자가 결제창을 닫은 경우 조용히 처리
      if (err.code !== 'PAY_PROCESS_CANCELED') {
        console.error('[결제 오류]', err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      fontFamily: "'Noto Sans KR', sans-serif", color: C.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        background: '#fff',
        border: `1px solid ${C.beige}`,
        borderRadius: '20px',
        padding: '40px 32px',
        maxWidth: '380px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
      }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-block',
            fontSize: '0.7rem', fontWeight: '700',
            color: C.green, background: C.gl,
            border: `1px solid ${C.gb}`,
            borderRadius: '20px', padding: '3px 12px',
            marginBottom: '14px', letterSpacing: '0.05em',
          }}>
            PRO
          </div>
          <h2 style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: '1.5rem', fontWeight: '700',
            color: C.ink, margin: '0 0 6px',
          }}>
            논리맵핑 Pro
          </h2>
          <p style={{ fontSize: '0.83rem', color: C.muted, margin: 0 }}>
            전체 기출 + 오답 분석을 무제한으로
          </p>
        </div>

        {/* 가격 */}
        <div style={{
          textAlign: 'center',
          padding: '20px 0',
          borderTop: `1px solid ${C.beige}`,
          borderBottom: `1px solid ${C.beige}`,
          marginBottom: '24px',
        }}>
          <span style={{
            fontSize: '2.2rem', fontWeight: '900',
            color: C.green, letterSpacing: '-0.04em',
          }}>
            5,900
          </span>
          <span style={{ fontSize: '1rem', color: C.muted, marginLeft: '4px' }}>
            원 / 월
          </span>
        </div>

        {/* 포함 내용 */}
        <ul style={{
          listStyle: 'none', margin: '0 0 28px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {FEATURES.map(f => (
            <li key={f} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              fontSize: '0.88rem', color: C.ink,
            }}>
              <span style={{
                width: '18px', height: '18px', borderRadius: '50%',
                background: C.gl, border: `1.5px solid ${C.gb}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: '0.65rem', color: C.green, fontWeight: '700',
              }}>
                ✓
              </span>
              {f}
            </li>
          ))}
        </ul>

        {/* SDK 오류 */}
        {sdkError && (
          <div style={{
            marginBottom: '16px', padding: '10px 12px',
            background: '#fef2f2', border: '1px solid #fca5a5',
            borderRadius: '8px', fontSize: '0.78rem', color: '#7f1d1d',
          }}>
            ⚠️ {sdkError}
          </div>
        )}

        {/* 결제 버튼 */}
        <button
          onClick={handlePay}
          disabled={loading || !tossPayments || !user}
          style={{
            width: '100%', padding: '14px',
            borderRadius: '10px', border: 'none',
            background: loading || !tossPayments ? C.beige : C.green,
            color: loading || !tossPayments ? C.muted : '#fff',
            fontSize: '0.95rem', fontWeight: '700',
            cursor: loading || !tossPayments ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: '16px', height: '16px',
                border: `2px solid ${C.beige}`,
                borderTop: `2px solid ${C.green}`,
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              처리 중...
            </>
          ) : !tossPayments ? (
            '결제 모듈 로딩 중...'
          ) : (
            '결제하기 · 5,900원'
          )}
        </button>

        {/* 안내 */}
        <p style={{
          fontSize: '0.72rem', color: C.muted,
          textAlign: 'center', marginTop: '14px', lineHeight: '1.6',
        }}>
          구독은 매월 자동 갱신됩니다.<br />
          언제든지 해지할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
