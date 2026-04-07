// ============================================================
// Landing.jsx — 수능 국어 논리맵핑 랜딩 페이지 (리디자인)
// ============================================================

import { useState, useEffect, useRef } from 'react';

const C = {
  green:    '#1e5c1e',
  greenMid: '#2d6e2d',
  greenSoft:'#3d8b3d',
  greenBg:  '#f0f7f0',
  greenLine:'#7aad7a',
  ink:      '#0f1710',
  inkMid:   '#2a3a2b',
  muted:    '#5a6b5b',
  subtle:   '#8a9b8b',
  bg:       '#faf8f4',
  bgAlt:    '#f3f0ea',
  white:    '#ffffff',
  border:   '#e0dbd0',
};

const flex = (align = 'center', justify = 'flex-start', gap = 0) => ({
  display: 'flex', alignItems: align, justifyContent: justify,
  ...(gap ? { gap } : {}),
});

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function FadeIn({ children, delay = 0, style = {} }) {
  const [ref, visible] = useInView();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      ...style,
    }}>
      {children}
    </div>
  );
}

function Pill({ children, color = C.green }) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.65rem', fontWeight: '700',
      color, background: `${color}18`,
      border: `1px solid ${color}40`,
      borderRadius: '100px', padding: '4px 14px',
      letterSpacing: '0.1em', textTransform: 'uppercase',
    }}>
      {children}
    </span>
  );
}

function SectionHead({ pill, headline, sub, center = true }) {
  return (
    <div style={{ textAlign: center ? 'center' : 'left', marginBottom: '52px' }}>
      {pill && <div style={{ marginBottom: '16px' }}><Pill>{pill}</Pill></div>}
      <h2 style={{
        fontFamily: "'Noto Serif KR', serif",
        fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
        fontWeight: '700', color: C.ink,
        lineHeight: '1.35', letterSpacing: '-0.03em',
        margin: '0 0 18px',
      }}>
        {headline}
      </h2>
      {sub && (
        <p style={{
          fontSize: 'clamp(0.85rem, 1.8vw, 1rem)',
          color: C.muted, lineHeight: '1.85',
          maxWidth: center ? '520px' : 'none',
          margin: center ? '0 auto' : 0,
        }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// 형광펜 데모 — 인터랙티브 미니 뷰어
function HighlightDemo() {
  const [active, setActive] = useState(null);

  const choices = [
    { num: 1, text: '㉠은 외부 자극이 없어도 자발적으로 발생한다.', ok: false, hl: [0, 1] },
    { num: 2, text: '㉡은 세포막의 이온 투과성 변화로 나타난다.', ok: true, hl: [2] },
    { num: 3, text: '㉠과 ㉡은 모두 Na⁺ 이동에 의해 발생한다.', ok: false, hl: [0, 2] },
  ];

  const sents = [
    { id: 0, t: '활동 전위는 외부 자극에 의해 세포막 전위가 역치 이상으로 상승할 때 발생한다.', hl: [1, 3] },
    { id: 1, t: '이때 Na⁺ 채널이 열리며 Na⁺가 세포 내로 급격히 유입된다.', hl: [1, 3] },
    { id: 2, t: '세포막의 이온 투과성 변화는 활동 전위의 핵심 기전이다.', hl: [2] },
    { id: 3, t: '이후 K⁺가 세포 외로 유출되어 재분극이 일어난다.', hl: [] },
  ];

  const hlColors = {
    1: { bg: 'rgba(59,130,246,0.22)', border: '#3b82f6' },
    2: { bg: 'rgba(34,197,94,0.22)',  border: '#22c55e' },
    3: { bg: 'rgba(234,179,8,0.28)',  border: '#eab308' },
  };

  return (
    <div style={{
      background: C.white,
      borderRadius: '16px',
      border: `1px solid ${C.border}`,
      overflow: 'hidden',
      boxShadow: '0 24px 64px rgba(30,92,30,0.12), 0 4px 16px rgba(0,0,0,0.06)',
    }}>
      {/* 브라우저 탭바 */}
      <div style={{
        background: '#f0efed', borderBottom: `1px solid ${C.border}`,
        padding: '10px 16px', ...flex('center', 'space-between'),
      }}>
        <div style={{ ...flex('center', 'flex-start', 7) }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{
          background: C.white, borderRadius: '6px',
          padding: '3px 20px', fontSize: '0.65rem', color: C.subtle,
          border: `1px solid ${C.border}`, flex: 1, maxWidth: 240,
          textAlign: 'center', margin: '0 12px',
        }}>
          suneung-viewer.vercel.app
        </div>
        <div style={{ width: 56 }} />
      </div>

      {/* 2분할 뷰어 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 300 }}>
        {/* 지문 패널 */}
        <div style={{
          borderRight: `1px solid ${C.border}`,
          padding: '18px 16px', background: '#fdfcfa',
        }}>
          <div style={{
            fontSize: '0.6rem', fontWeight: '700', color: C.subtle,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px',
          }}>
            지문
          </div>
          {sents.map(s => {
            const isHl = active !== null && s.hl.includes(active);
            return (
              <p key={s.id} style={{
                fontSize: '0.72rem', lineHeight: '1.9', color: C.inkMid,
                marginBottom: '7px', padding: '1px 3px',
                borderRadius: '3px',
                transition: 'background 0.25s, border-bottom 0.25s',
                background: isHl ? hlColors[active]?.bg : 'transparent',
                borderBottom: isHl ? `2px solid ${hlColors[active]?.border}` : '2px solid transparent',
              }}>
                {s.t}
              </p>
            );
          })}
        </div>

        {/* 문제 패널 */}
        <div style={{ padding: '18px 16px' }}>
          <div style={{
            fontSize: '0.6rem', fontWeight: '700', color: C.subtle,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px',
          }}>
            문제
          </div>
          <div style={{ fontSize: '0.7rem', color: C.inkMid, marginBottom: '12px', lineHeight: 1.6 }}>
            <strong>3.</strong> ㉠, ㉡에 대한 설명으로 적절하지 <u>않은</u> 것은?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {choices.map(c => {
              const isActive = active === c.num;
              return (
                <div
                  key={c.num}
                  onClick={() => setActive(active === c.num ? null : c.num)}
                  style={{
                    ...flex('flex-start', 'flex-start', 7),
                    padding: '7px 9px', borderRadius: '7px', cursor: 'pointer',
                    background: isActive ? (c.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') : '#fff',
                    border: isActive
                      ? `2px solid ${c.ok ? '#22c55e' : '#ef4444'}`
                      : `1px solid ${C.border}`,
                    transition: 'all 0.18s',
                  }}
                >
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: isActive ? (c.ok ? '#22c55e' : '#ef4444') : '#f0efed',
                    color: isActive ? '#fff' : C.subtle,
                    ...flex('center', 'center'),
                    fontSize: '0.6rem', fontWeight: '700',
                  }}>
                    {c.num}
                  </span>
                  <span style={{ fontSize: '0.65rem', lineHeight: 1.6, color: C.ink, flex: 1 }}>
                    {c.text}
                  </span>
                  {isActive && <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>{c.ok ? '✅' : '❌'}</span>}
                </div>
              );
            })}
          </div>
          <div style={{
            marginTop: '10px', padding: '7px 9px',
            background: C.greenBg, borderRadius: '7px',
            fontSize: '0.62rem', color: C.greenMid, lineHeight: 1.6,
          }}>
            {active
              ? `💡 ${active}번 선택 → 지문에서 근거 문장이 형광펜으로 표시됩니다`
              : '👆 선지를 클릭해보세요'}
          </div>
        </div>
      </div>
    </div>
  );
}

function CtaBtn({ label, onClick, variant = 'primary', size = 'md' }) {
  const [hov, setHov] = useState(false);
  const sizes = {
    sm: { padding: '10px 24px', fontSize: '0.85rem' },
    md: { padding: '13px 32px', fontSize: '0.9rem' },
    lg: { padding: '16px 42px', fontSize: '1rem' },
  };
  const base = {
    borderRadius: '10px',
    fontFamily: "'Noto Sans KR', sans-serif",
    fontWeight: '700', cursor: 'pointer',
    letterSpacing: '-0.01em',
    transition: 'all 0.18s',
    transform: hov ? 'translateY(-1px)' : 'none',
    ...sizes[size],
  };
  if (variant === 'primary') return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...base, background: hov ? C.greenSoft : C.greenMid, color: '#fff', border: 'none',
        boxShadow: hov ? '0 8px 24px rgba(45,110,45,0.3)' : 'none' }}>
      {label}
    </button>
  );
  if (variant === 'outline') return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...base, background: hov ? C.greenBg : 'transparent',
        color: C.greenMid, border: `1.5px solid ${C.greenLine}` }}>
      {label}
    </button>
  );
  // white
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ ...base, background: hov ? C.greenBg : '#fff', color: C.greenMid, border: 'none' }}>
      {label}
    </button>
  );
}

export default function Landing({ onStart }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      fontFamily: "'Noto Sans KR', sans-serif",
      color: C.ink, overflowX: 'hidden',
    }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── 네비바 ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? 'rgba(250,248,244,0.94)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? `1px solid ${C.border}` : 'none',
        transition: 'all 0.3s',
        padding: '0 clamp(20px, 5vw, 60px)',
        height: '60px', ...flex('center', 'space-between'),
      }}>
        <span style={{
          fontFamily: "'Noto Serif KR', serif",
          fontWeight: '700', fontSize: '1rem', color: C.ink, letterSpacing: '-0.02em',
        }}>
          논리맵핑
        </span>
        <CtaBtn label="무료로 시작" onClick={onStart} size="sm" />
      </nav>

      {/* ── 히어로 ── */}
      <section style={{
        minHeight: '100vh',
        padding: 'clamp(100px, 14vw, 160px) clamp(20px, 6vw, 80px) clamp(60px, 8vw, 100px)',
        ...flex('center', 'center'),
        flexDirection: 'column',
        background: `linear-gradient(180deg, ${C.bg} 0%, ${C.bgAlt} 100%)`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 배경 장식 */}
        <div style={{
          position: 'absolute', top: '8%', right: '-8%',
          width: 'clamp(200px, 40vw, 520px)', height: 'clamp(200px, 40vw, 520px)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${C.greenBg} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 780, width: '100%' }}>
          <div style={{ animation: 'fadeUp 0.8s ease 0.1s both' }}>
            <Pill color={C.green}>수능 국어 기출 분석 도구</Pill>
          </div>

          <h1 style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 'clamp(2rem, 5.5vw, 3.4rem)',
            fontWeight: '700', color: C.ink,
            lineHeight: '1.25', letterSpacing: '-0.04em',
            margin: '24px 0 22px',
            animation: 'fadeUp 0.8s ease 0.2s both',
          }}>
            국어 1등급의 차이는<br />
            <span style={{ color: C.greenMid }}>근거를 찾는 습관</span>입니다
          </h1>

          <p style={{
            fontSize: 'clamp(0.9rem, 1.8vw, 1.05rem)',
            color: C.muted, lineHeight: '1.9',
            maxWidth: 500, margin: '0 auto 40px',
            animation: 'fadeUp 0.8s ease 0.3s both',
          }}>
            선지를 클릭하면 지문 속 근거 문장이 형광펜으로 표시됩니다.<br />
            왜 맞고 왜 틀렸는지, 논리가 눈에 보입니다.
          </p>

          <div style={{
            ...flex('center', 'center', 16), flexWrap: 'wrap',
            marginBottom: '12px',
            animation: 'fadeUp 0.8s ease 0.4s both',
          }}>
            <CtaBtn label="무료로 시작하기 →" onClick={onStart} size="lg" />
          </div>
          <div style={{
            fontSize: '0.75rem', color: C.subtle,
            animation: 'fadeUp 0.8s ease 0.45s both',
            marginBottom: '52px',
          }}>
            신용카드 불필요 · 2026·2025학년도 수능 무료
          </div>

          <div style={{ animation: 'fadeUp 0.9s ease 0.55s both' }}>
            <HighlightDemo />
          </div>
        </div>
      </section>

      {/* ── 문제 제기 (다크) ── */}
      <section style={{
        background: C.ink,
        padding: 'clamp(64px, 8vw, 100px) clamp(20px, 6vw, 80px)',
        textAlign: 'center',
      }}>
        <FadeIn>
          <div style={{ marginBottom: 16 }}>
            <Pill color={C.greenLine}>The Problem</Pill>
          </div>
          <h2 style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 'clamp(1.5rem, 3.5vw, 2.4rem)',
            fontWeight: '700', color: '#fff',
            lineHeight: 1.35, letterSpacing: '-0.03em',
            maxWidth: 580, margin: '0 auto 24px',
          }}>
            해설을 봐도 왜 틀렸는지<br />여전히 모르시나요?
          </h2>
          <p style={{
            fontSize: 'clamp(0.85rem, 1.6vw, 0.98rem)',
            color: '#7a8a7b', lineHeight: 1.9,
            maxWidth: 460, margin: '0 auto',
          }}>
            기존 해설지는 정답을 알려줄 뿐,{' '}
            <strong style={{ color: '#b8c8b8' }}>지문의 어느 문장이 근거인지</strong>는 보여주지 않습니다.
            그래서 같은 유형을 반복해서 틀립니다.
          </p>
        </FadeIn>

        <FadeIn delay={0.15} style={{ marginTop: '52px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '2px', maxWidth: 760, margin: '0 auto',
          }}>
            {[
              { stat: '4가지', label: '반복되는 오답 패턴\n사실왜곡 · 인과전도 · 과잉추론 · 개념혼합' },
              { stat: '1~2문항', label: '등급을 가르는 차이\n1·2등급 경계는 단 한두 문제' },
              { stat: '7개년', label: '수록 기출 시험\n2022~2026 수능·모평 전 문항' },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: i === 0 ? '12px 0 0 12px' : i === 2 ? '0 12px 12px 0' : 0,
                padding: '28px 20px', textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 'clamp(1.7rem, 3.5vw, 2.4rem)',
                  fontWeight: '700', color: C.greenLine,
                  marginBottom: '10px', letterSpacing: '-0.02em',
                }}>
                  {item.stat}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#5a6b5b', lineHeight: 1.75, whiteSpace: 'pre-line' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── 핵심 기능 ── */}
      <section style={{
        background: C.bg,
        padding: 'clamp(64px, 8vw, 100px) clamp(20px, 6vw, 80px)',
      }}>
        <FadeIn>
          <SectionHead
            pill="핵심 기능"
            headline={<>논리맵핑이<br />다른 이유</>}
            sub="선지 하나를 클릭할 때마다, 지문이 응답합니다."
          />
        </FadeIn>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '18px', maxWidth: 860, margin: '0 auto',
        }}>
          {[
            { icon: '🔦', title: '지문 근거 형광펜', accent: '#3b82f6',
              desc: '선지를 클릭하면 해당 판단의 근거가 된 지문 문장이 색상으로 표시됩니다. 논리를 눈으로 확인하세요.' },
            { icon: '🔖', title: '오답 패턴 자동 분류', accent: C.greenMid,
              desc: '독서 4가지, 문학 5가지 오답 유형으로 자동 분류됩니다. 내가 어떤 함정에 자주 빠지는지 알 수 있습니다.' },
            { icon: '📊', title: '개인 오답 리포트', accent: '#8b5cf6',
              desc: '풀수록 쌓이는 데이터. 오답률이 높은 패턴을 시각화하고, AI가 집중 보완 전략을 제안합니다.' },
          ].map((f, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div style={{
                background: C.white, border: `1px solid ${C.border}`,
                borderRadius: '16px', padding: '26px 22px', height: '100%',
                transition: 'box-shadow 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = `0 12px 40px ${f.accent}18`}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 11,
                  background: `${f.accent}14`,
                  ...flex('center', 'center'),
                  fontSize: '1.3rem', marginBottom: '16px',
                }}>
                  {f.icon}
                </div>
                <h3 style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: '1.02rem', fontWeight: '700',
                  color: C.ink, marginBottom: '9px', letterSpacing: '-0.02em',
                }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: '0.82rem', color: C.muted, lineHeight: '1.8' }}>
                  {f.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── 사용법 ── */}
      <section style={{
        background: C.bgAlt,
        padding: 'clamp(64px, 8vw, 100px) clamp(20px, 6vw, 80px)',
        borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
      }}>
        <FadeIn>
          <SectionHead
            pill="How to Use"
            headline="4단계로 완성하는 국어 분석"
            sub="시험지를 먼저 풀고, 뷰어에서 복기하세요."
          />
        </FadeIn>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px', maxWidth: 800, margin: '0 auto',
        }}>
          {[
            { n: '01', title: '시험지 먼저 풀기', desc: 'PDF나 종이 시험지로 실전처럼. 필기도 하고, 시간도 재고.' },
            { n: '02', title: '내 답 입력하기', desc: '뷰어에서 내가 고른 선지 번호를 클릭. 오답이 즉시 표시됩니다.' },
            { n: '03', title: '근거 확인하기', desc: '선지를 누르면 지문 속 근거 문장에 형광펜이 켜집니다.' },
            { n: '04', title: '패턴 파악하기', desc: '오답 리포트에서 내 약점 패턴을 확인하고 집중 보완하세요.' },
          ].map((step, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div style={{
                background: C.white, border: `1px solid ${C.border}`,
                borderRadius: '14px', padding: '22px 18px',
              }}>
                <div style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: '1.9rem', fontWeight: '700',
                  color: `${C.greenMid}28`, lineHeight: 1,
                  marginBottom: '12px', letterSpacing: '-0.04em',
                }}>
                  {step.n}
                </div>
                <div style={{
                  fontSize: '0.88rem', fontWeight: '700',
                  color: C.ink, marginBottom: '7px', lineHeight: '1.4',
                }}>
                  {step.title}
                </div>
                <div style={{ fontSize: '0.77rem', color: C.muted, lineHeight: '1.75' }}>
                  {step.desc}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── 비교 ── */}
      <section style={{
        background: C.bg,
        padding: 'clamp(64px, 8vw, 100px) clamp(20px, 6vw, 80px)',
      }}>
        <FadeIn>
          <SectionHead
            pill="비교"
            headline="기존 해설지와 무엇이 다른가요?"
            sub="해설지는 '정답'을 알려줍니다. 논리맵핑은 '이유'를 보여줍니다."
          />
        </FadeIn>

        <FadeIn delay={0.1}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '14px', maxWidth: 660, margin: '0 auto',
          }}>
            {[
              { label: '기존 해설지', color: C.subtle, bg: C.bgAlt, border: C.border,
                items: [
                  { text: '정답 번호 안내', ok: false },
                  { text: '텍스트 중심 설명', ok: false },
                  { text: '지문 근거 위치 불명확', ok: false },
                  { text: '개인 오답 패턴 분석 없음', ok: false },
                ]},
              { label: '논리맵핑', color: C.greenMid, bg: C.greenBg, border: C.greenLine,
                items: [
                  { text: '지문 근거 형광펜 표시', ok: true },
                  { text: '오답 패턴 자동 분류', ok: true },
                  { text: '개인 오답 리포트', ok: true },
                  { text: 'AI 코칭 및 Q&A', ok: true },
                ]},
            ].map(col => (
              <div key={col.label} style={{
                background: col.bg, border: `1.5px solid ${col.border}`,
                borderRadius: '16px', padding: '26px 22px',
              }}>
                <div style={{
                  fontSize: '0.65rem', fontWeight: '700',
                  color: col.color, letterSpacing: '0.1em',
                  textTransform: 'uppercase', marginBottom: '18px',
                }}>
                  {col.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {col.items.map((item, i) => (
                    <div key={i} style={{ ...flex('center', 'flex-start', 10) }}>
                      <span style={{ color: item.ok ? col.color : C.subtle, fontWeight: '700', fontSize: '0.85rem', flexShrink: 0 }}>
                        {item.ok ? '✓' : '✕'}
                      </span>
                      <span style={{ fontSize: '0.83rem', color: item.ok ? C.ink : C.subtle, fontWeight: item.ok ? '500' : '400' }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── 수록 시험 ── */}
      <section style={{
        background: C.bgAlt, borderTop: `1px solid ${C.border}`,
        padding: 'clamp(48px, 6vw, 76px) clamp(20px, 6vw, 80px)',
        textAlign: 'center',
      }}>
        <FadeIn>
          <Pill>수록 콘텐츠</Pill>
          <h2 style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
            fontWeight: '700', color: C.ink,
            margin: '18px 0 10px', letterSpacing: '-0.03em',
          }}>
            수능 국어 기출 7개년
          </h2>
          <p style={{ fontSize: '0.83rem', color: C.muted, marginBottom: '32px', lineHeight: 1.75 }}>
            2022~2026학년도 수능·9월·6월 모의평가 · 독서 + 문학 전 문항 · 선지 해설 완비
          </p>
          <div style={{
            display: 'flex', flexWrap: 'wrap',
            justifyContent: 'center', gap: '8px',
            maxWidth: 620, margin: '0 auto',
          }}>
            {[
              { label: '2026수능', free: true },
              { label: '2025수능', free: true },
              { label: '2025_9월 모의', free: false },
              { label: '2024수능', free: false },
              { label: '2023수능', free: false },
              { label: '2022수능', free: false },
              { label: '2022_6월 모의', free: false },
            ].map(item => (
              <span key={item.label} style={{
                padding: '5px 15px', borderRadius: '100px',
                fontSize: '0.76rem', fontWeight: item.free ? '700' : '500',
                background: item.free ? C.greenBg : C.white,
                border: `1px solid ${item.free ? C.greenLine : C.border}`,
                color: item.free ? C.greenMid : C.muted,
              }}>
                {item.free && '🆓 '}{item.label}
              </span>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── 요금제 ── */}
      <section style={{
        background: C.bg,
        padding: 'clamp(64px, 8vw, 100px) clamp(20px, 6vw, 80px)',
      }}>
        <FadeIn>
          <SectionHead
            pill="요금제"
            headline="무료로 시작, 필요하면 확장"
            sub="2026·2025학년도 수능 전체가 무료입니다. 먼저 경험해보세요."
          />
        </FadeIn>

        <FadeIn delay={0.1}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '14px', maxWidth: 560, margin: '0 auto',
          }}>
            {/* 무료 */}
            <div style={{
              background: C.white, border: `1px solid ${C.border}`,
              borderRadius: '20px', padding: '30px 26px',
            }}>
              <div style={{ fontSize: '0.65rem', fontWeight: '700', color: C.subtle, letterSpacing: '0.1em', marginBottom: '12px' }}>FREE</div>
              <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '2.1rem', fontWeight: '700', color: C.ink, marginBottom: '4px' }}>
                0<span style={{ fontSize: '1rem' }}>원</span>
              </div>
              <div style={{ fontSize: '0.73rem', color: C.subtle, marginBottom: '24px' }}>영구 무료</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '24px' }}>
                {['2026학년도 수능', '2025학년도 수능', '형광펜 근거 표시', '선지 해설'].map(item => (
                  <div key={item} style={{ ...flex('center', 'flex-start', 9) }}>
                    <span style={{ color: C.greenLine, fontWeight: '700', fontSize: '0.82rem' }}>✓</span>
                    <span style={{ fontSize: '0.82rem', color: C.inkMid }}>{item}</span>
                  </div>
                ))}
              </div>
              <CtaBtn label="무료로 시작" onClick={onStart} variant="outline" />
            </div>

            {/* Pro */}
            <div style={{
              background: C.greenMid, border: `1.5px solid ${C.green}`,
              borderRadius: '20px', padding: '30px 26px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 14, right: 14,
                background: 'rgba(255,255,255,0.18)', borderRadius: '100px',
                padding: '3px 10px', fontSize: '0.6rem', fontWeight: '800',
                color: '#fff', letterSpacing: '0.08em',
              }}>
                추천
              </div>
              <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', marginBottom: '12px' }}>PRO</div>
              <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '2.1rem', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
                5,900<span style={{ fontSize: '1rem' }}>원</span>
              </div>
              <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.55)', marginBottom: '24px' }}>/ 월 · 언제든 해지 가능</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '24px' }}>
                {['무료 플랜 모든 기능', '전체 7개년 시험 접근', '오답 패턴 자동 분류', '개인 오답 리포트', 'AI 코칭 & Q&A'].map(item => (
                  <div key={item} style={{ ...flex('center', 'flex-start', 9) }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: '0.82rem' }}>✓</span>
                    <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.88)' }}>{item}</span>
                  </div>
                ))}
              </div>
              <button onClick={onStart} style={{
                width: '100%', padding: '11px', borderRadius: '10px',
                background: '#fff', color: C.greenMid, border: 'none',
                fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer',
                fontFamily: "'Noto Sans KR', sans-serif",
              }}>
                Pro 시작하기
              </button>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── 최종 CTA ── */}
      <section style={{
        background: C.ink,
        padding: 'clamp(64px, 8vw, 100px) clamp(20px, 6vw, 80px)',
        textAlign: 'center',
      }}>
        <FadeIn>
          <h2 style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
            fontWeight: '700', color: '#fff',
            lineHeight: 1.35, letterSpacing: '-0.03em',
            margin: '0 auto 14px', maxWidth: 520,
          }}>
            지금 무료로 시작하고<br />논리를 눈으로 확인하세요
          </h2>
          <p style={{ fontSize: '0.83rem', color: '#4a5a4b', marginBottom: '32px' }}>
            신용카드 없이 바로 시작할 수 있습니다.
          </p>
          <CtaBtn label="무료로 시작하기 →" onClick={onStart} variant="white" size="lg" />
        </FadeIn>
      </section>

      {/* ── 푸터 ── */}
      <footer style={{
        background: '#08100a',
        padding: '24px clamp(20px, 5vw, 60px)',
        ...flex('center', 'space-between'), flexWrap: 'wrap', gap: 10,
      }}>
        <span style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: '0.88rem', fontWeight: '700',
          color: 'rgba(255,255,255,0.35)',
        }}>
          논리맵핑
        </span>
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)' }}>
          © 2025 수능 국어 논리맵핑
        </span>
      </footer>
    </div>
  );
}
