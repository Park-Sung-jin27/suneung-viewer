// ============================================================
// Landing.jsx — 비로그인 랜딩 페이지
// ============================================================

const C = {
  bg:    '#f9f5ed',
  green: '#2d6e2d',
  gl:    '#f2f7f2',
  gb:    '#7aad7a',
  beige: '#e8e0d0',
  ink:   '#1a1a14',
  muted: '#6b7280',
};

const STEPS = [
  {
    n: 1,
    title: '시험지를 먼저 푸세요',
    desc: 'PDF나 종이 시험지로 실제처럼 문제를 풀어보세요. 필기도 하고, 시간도 재고.',
  },
  {
    n: 2,
    title: '뷰어에서 내 답을 선택하세요',
    desc: '내가 고른 선지 번호를 뷰어에서 클릭하세요. 정답과 오답이 표시됩니다.',
  },
  {
    n: 3,
    title: '지문에서 근거를 확인하세요',
    desc: '선지를 클릭하면 지문의 근거 문장이 형광펜으로 표시됩니다.',
  },
  {
    n: 4,
    title: '내 패턴을 파악하세요',
    desc: '풀수록 쌓이는 오답 리포트. 내가 자주 빠지는 함정을 알 수 있습니다.',
  },
];

const COMPARE = [
  {
    label: '기존 해설지',
    items: ['정답이 몇 번입니다', '텍스트 해설'],
    accent: C.muted,
    bg: '#f3f4f6',
    border: '#e5e7eb',
  },
  {
    label: '논리맵핑',
    items: ['지문 근거 형광펜 표시', '오답 패턴 분류', '개인 오답 리포트'],
    accent: C.green,
    bg: C.gl,
    border: C.gb,
  },
];

function CtaButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '14px 36px',
        borderRadius: '10px',
        background: C.green,
        color: '#fff',
        border: 'none',
        fontSize: '1rem',
        fontWeight: '700',
        cursor: 'pointer',
        letterSpacing: '-0.01em',
      }}
    >
      {label}
    </button>
  );
}

export default function Landing({ onStart }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: "'Noto Sans KR', sans-serif",
      color: C.ink,
    }}>

      {/* ① 히어로 */}
      <section style={{
        padding: 'clamp(64px, 10vw, 120px) 24px clamp(56px, 8vw, 96px)',
        textAlign: 'center',
        borderBottom: `1px solid ${C.beige}`,
        background: '#fff',
      }}>
        <div style={{
          display: 'inline-block',
          fontSize: '0.7rem', fontWeight: '700',
          color: C.green, background: C.gl,
          border: `1px solid ${C.gb}`,
          borderRadius: '20px', padding: '3px 14px',
          marginBottom: '20px', letterSpacing: '0.08em',
        }}>
          수능 국어 논리맵핑
        </div>
        <h1 style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 'clamp(1.8rem, 5.5vw, 3rem)',
          fontWeight: '700',
          color: C.ink,
          lineHeight: '1.3',
          letterSpacing: '-0.03em',
          margin: '0 0 20px',
        }}>
          국어, 이제 막막하지<br />않아도 됩니다
        </h1>
        <p style={{
          fontSize: 'clamp(0.88rem, 2vw, 1.05rem)',
          color: C.muted,
          maxWidth: '460px',
          margin: '0 auto 36px',
          lineHeight: '1.8',
        }}>
          책을 많이 읽지 않아도 괜찮습니다.<br />
          왜 틀렸는지 알면, 누구든 올라갑니다.
        </p>
        <CtaButton label="무료로 시작하기" onClick={onStart} />
      </section>

      {/* ② 이렇게 사용하세요 */}
      <section style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: 'clamp(48px, 7vw, 80px) 24px',
      }}>
        <h2 style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 'clamp(1.2rem, 3vw, 1.7rem)',
          fontWeight: '700',
          color: C.ink,
          textAlign: 'center',
          marginBottom: '40px',
          letterSpacing: '-0.02em',
        }}>
          논리맵핑, 이렇게 사용하세요
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '16px',
        }}>
          {STEPS.map(step => (
            <div key={step.n} style={{
              background: '#fff',
              border: `1px solid ${C.beige}`,
              borderRadius: '14px',
              padding: '22px 18px',
            }}>
              <div style={{
                width: '28px', height: '28px',
                borderRadius: '50%',
                background: C.green,
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: '800',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '14px',
              }}>
                {step.n}
              </div>
              <div style={{
                fontSize: '0.92rem', fontWeight: '700',
                color: C.ink, marginBottom: '8px',
                lineHeight: '1.4',
              }}>
                {step.title}
              </div>
              <div style={{
                fontSize: '0.8rem', color: C.muted,
                lineHeight: '1.65',
              }}>
                {step.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ③ 핵심 차별점 */}
      <section style={{
        background: '#fff',
        borderTop: `1px solid ${C.beige}`,
        borderBottom: `1px solid ${C.beige}`,
        padding: 'clamp(48px, 7vw, 80px) 24px',
      }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
            fontWeight: '700',
            color: C.ink,
            textAlign: 'center',
            marginBottom: '36px',
            letterSpacing: '-0.02em',
          }}>
            기존 해설지와 무엇이 다른가요?
          </h2>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {COMPARE.map(col => (
              <div key={col.label} style={{
                flex: 1, minWidth: '200px',
                background: col.bg,
                border: `1px solid ${col.border}`,
                borderRadius: '14px',
                padding: '22px 20px',
              }}>
                <div style={{
                  fontSize: '0.72rem', fontWeight: '700',
                  color: col.accent, marginBottom: '14px',
                  letterSpacing: '0.05em',
                }}>
                  {col.label}
                </div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {col.items.map(item => (
                    <li key={item} style={{
                      fontSize: '0.85rem', color: C.ink,
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                      <span style={{ color: col.accent, fontWeight: '700', flexShrink: 0 }}>
                        {col.accent === C.green ? '✓' : '·'}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ④ 무료/유료 안내 */}
      <section style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: 'clamp(48px, 7vw, 80px) 24px',
      }}>
        <h2 style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
          fontWeight: '700',
          color: C.ink,
          textAlign: 'center',
          marginBottom: '32px',
          letterSpacing: '-0.02em',
        }}>
          무료로 시작, 필요하면 확장
        </h2>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {/* 무료 */}
          <div style={{
            flex: 1, minWidth: '200px',
            background: '#fff',
            border: `1px solid ${C.beige}`,
            borderRadius: '14px',
            padding: '24px 20px',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '700', color: C.muted, marginBottom: '10px', letterSpacing: '0.05em' }}>
              무료
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: '900', color: C.ink, marginBottom: '14px' }}>
              0원
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {['2026학년도 수능', '2025학년도 수능'].map(item => (
                <li key={item} style={{ fontSize: '0.83rem', color: C.ink, display: 'flex', gap: '8px' }}>
                  <span style={{ color: C.gb, fontWeight: '700' }}>✓</span>{item}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div style={{
            flex: 1, minWidth: '200px',
            background: C.gl,
            border: `1.5px solid ${C.gb}`,
            borderRadius: '14px',
            padding: '24px 20px',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '700', color: C.green, marginBottom: '10px', letterSpacing: '0.05em' }}>
              PRO
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: '900', color: C.green, marginBottom: '4px' }}>
              5,900원
            </div>
            <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: '14px' }}>/ 월</div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {['전체 시험 접근 (11개)', '오답 패턴 분석', '개인 오답 리포트'].map(item => (
                <li key={item} style={{ fontSize: '0.83rem', color: C.ink, display: 'flex', gap: '8px' }}>
                  <span style={{ color: C.green, fontWeight: '700' }}>✓</span>{item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ⑤ CTA */}
      <section style={{
        background: C.green,
        padding: 'clamp(48px, 7vw, 80px) 24px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
          fontWeight: '700',
          color: '#fff',
          marginBottom: '28px',
          letterSpacing: '-0.02em',
        }}>
          지금 무료로 시작하기
        </h2>
        <button
          onClick={onStart}
          style={{
            padding: '14px 36px',
            borderRadius: '10px',
            background: '#fff',
            color: C.green,
            border: 'none',
            fontSize: '1rem',
            fontWeight: '700',
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          시작하기
        </button>
      </section>

    </div>
  );
}
