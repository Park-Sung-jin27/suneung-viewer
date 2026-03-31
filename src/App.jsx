// ============================================================
// App.jsx — 수능 국어 논리맵핑 뷰어 최상위 컴포넌트
// Vite + React 환경
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import PassagePanel from './PassagePanel';
import QuizPanel from './QuizPanel';
import { YEAR_INFO } from './constants';
import { loadYear, getYearKeys } from './dataLoader';
import { supabase } from './supabase';

// ─────────────────────────────────────────────
// 전역 스타일 (CSS-in-JS 인라인 방식)
// Google Fonts: Noto Serif KR (지문용) + Pretendard (UI용)
// ─────────────────────────────────────────────
const FONT_LINK = document.createElement('link');
FONT_LINK.rel = 'stylesheet';
FONT_LINK.href =
  'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap';
document.head.appendChild(FONT_LINK);

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const SECTION_LABELS = { reading: '독서', literature: '문학' };

// ─────────────────────────────────────────────
// 화면 상태 타입
// 'main'   → 연도 선택 메인 화면
// 'viewer' → 지문+문제 뷰어
// 'auth'   → 로그인/회원가입
// ─────────────────────────────────────────────


// ══════════════════════════════════════════════
// [1] Header
// ══════════════════════════════════════════════
function Header({ view, yearMeta, section, onBack, user, onAuth, onLogout }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #e5e7eb',
      padding: '0 20px',
      height: '52px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* 왼쪽: 뒤로가기 or 로고 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {view === 'viewer' ? (
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6b7280', fontSize: '0.85rem', fontWeight: '600',
              padding: '6px 8px', borderRadius: '6px',
            }}
          >
            ← 목록
          </button>
        ) : null}

        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          {/* 연도 컬러 도트 */}
          {yearMeta && (
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: yearMeta.color, display: 'inline-block',
            }} />
          )}
          <span style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            fontWeight: '900', fontSize: '0.95rem', color: '#111827',
            letterSpacing: '-0.02em',
          }}>
            {view === 'viewer' && yearMeta
              ? `${yearMeta.label} · ${SECTION_LABELS[section] ?? ''}`
              : '수능 국어 논리맵핑'}
          </span>
        </div>
      </div>

      {/* 오른쪽: 로그인 상태 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {user ? (
          <>
            <span style={{ fontSize: '0.73rem', color: '#6b7280', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </span>
            <button onClick={onLogout} style={{ fontSize: '0.73rem', fontWeight: '600', color: '#9ca3af', background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
              로그아웃
            </button>
          </>
        ) : (
          <button onClick={onAuth} style={{ fontSize: '0.73rem', fontWeight: '600', color: '#1f2937', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
            로그인
          </button>
        )}
      </div>
    </header>
  );
}


// ══════════════════════════════════════════════
// [2] TabBar (독서 / 문학)
// ══════════════════════════════════════════════
function TabBar({ section, onChange, yearData }) {
  const tabs = ['reading', 'literature'].filter(sec => {
    const sets = yearData?.[sec];
    return sets && sets.length > 0;
  });

  if (tabs.length < 2) return null;

  return (
    <div style={{
      display: 'flex',
      background: '#f3f4f6',
      borderRadius: '10px',
      padding: '3px',
      gap: '2px',
      margin: '0 16px 12px',
    }}>
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            flex: 1, padding: '7px 0',
            borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontFamily: "'Noto Sans KR', sans-serif",
            fontWeight: section === tab ? '700' : '500',
            fontSize: '0.85rem',
            color: section === tab ? '#111827' : '#9ca3af',
            background: section === tab ? '#fff' : 'transparent',
            boxShadow: section === tab ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {SECTION_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}


// ══════════════════════════════════════════════
// [3] PassageSetNav (지문세트 선택 바)
// ══════════════════════════════════════════════
function PassageSetNav({ sets, currentIdx, onChange }) {
  if (!sets || sets.length === 0) return null;

  return (
    <div style={{
      display: 'flex', gap: '6px',
      padding: '0 16px 12px',
      overflowX: 'auto',
      scrollbarWidth: 'none',
    }}>
      {sets.map((s, i) => (
        <button
          key={s.id}
          onClick={() => onChange(i)}
          style={{
            flexShrink: 0,
            padding: '5px 12px',
            borderRadius: '20px',
            border: currentIdx === i ? '1.5px solid #1f2937' : '1px solid #e5e7eb',
            background: currentIdx === i ? '#1f2937' : '#fff',
            color: currentIdx === i ? '#fff' : '#6b7280',
            fontSize: '0.78rem',
            fontWeight: currentIdx === i ? '700' : '500',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          {s.range}
        </button>
      ))}
    </div>
  );
}


// ══════════════════════════════════════════════
// [4] 메인 화면 — 연도 카드 그리드
// ══════════════════════════════════════════════
function MainPage({ onSelectYear }) {
  const yearKeys = getYearKeys();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      {/* 히어로 영역 */}
      <div style={{
        padding: '48px 24px 36px',
        textAlign: 'center',
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
      }}>
        <div style={{
          display: 'inline-block',
          fontSize: '0.72rem', fontWeight: '700',
          color: '#6b7280', letterSpacing: '0.15em',
          textTransform: 'uppercase', marginBottom: '12px',
          background: '#f3f4f6', padding: '4px 12px', borderRadius: '20px',
        }}>
          Logic Mapping Viewer
        </div>
        <h1 style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 'clamp(1.6rem, 5vw, 2.2rem)',
          fontWeight: '700',
          color: '#111827',
          lineHeight: '1.3',
          letterSpacing: '-0.03em',
          margin: '0 0 12px',
        }}>
          수능 국어 기출<br />논리맵핑 분석
        </h1>
        <p style={{
          fontSize: '0.88rem', color: '#9ca3af',
          maxWidth: '360px', margin: '0 auto', lineHeight: '1.7',
        }}>
          선지를 클릭하면 지문 속 근거 문장이 형광펜으로 표시됩니다.<br />
          오답의 패턴을 눈으로 확인하세요.
        </p>
      </div>

      {/* 연도 카드 그리드 */}
      <div style={{
        maxWidth: '720px', margin: '0 auto',
        padding: '28px 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '14px',
      }}>
        {yearKeys.map(yearKey => {
          const meta = YEAR_INFO.find(y => y.key === yearKey);
          const yearData = { label: meta?.label ?? yearKey, color: meta?.color ?? '#374151',
                             badge: meta?.badge ?? '', tag: meta?.tag ?? '' };
          return (
            <YearCard
              key={yearKey}
              yearKey={yearKey}
              meta={yearData}
              onClick={() => onSelectYear(yearKey)}
            />
          );
        })}
      </div>
    </div>
  );
}


function YearCard({ yearKey, meta, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1.5px solid ${hovered ? meta.color : '#e5e7eb'}`,
        borderRadius: '14px',
        padding: '20px 18px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.18s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 8px 24px ${meta.color}22` : '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* 컬러 바 */}
      <div style={{
        width: '32px', height: '3px',
        borderRadius: '2px', background: meta.color,
        marginBottom: '14px',
      }} />

      {/* 배지 */}
      {meta.badge && (
        <span style={{
          fontSize: '0.68rem', fontWeight: '700',
          color: meta.color,
          background: `${meta.color}15`,
          padding: '2px 8px', borderRadius: '10px',
          display: 'inline-block', marginBottom: '8px',
        }}>
          {meta.badge}
        </span>
      )}

      {/* 연도 레이블 */}
      <div style={{
        fontFamily: "'Noto Serif KR', serif",
        fontSize: '1.05rem', fontWeight: '700',
        color: '#111827', lineHeight: '1.35',
        letterSpacing: '-0.02em',
      }}>
        {meta.label}
      </div>

      {/* 날짜 태그 */}
      <div style={{
        fontSize: '0.72rem', color: '#9ca3af',
        marginTop: '6px', fontWeight: '500',
      }}>
        {meta.tag}
      </div>

      {/* 화살표 */}
      <div style={{
        marginTop: '14px', color: meta.color,
        fontSize: '0.85rem', fontWeight: '700',
        opacity: hovered ? 1 : 0.4,
        transition: 'opacity 0.15s',
      }}>
        시작하기 →
      </div>
    </button>
  );
}


// ══════════════════════════════════════════════
// [5] 뷰어 화면 — 지문 + 문제 레이아웃
// ══════════════════════════════════════════════
function ViewerPage({ yearKey, yearData }) {
  const [section, setSection] = useState('reading');
  const [setIdx, setSetIdx]   = useState(0);
  const [sel, setSel]         = useState(null);       // 고유 식별자 "q1_c3"
  const [selChoice, setSelChoice] = useState(null);   // 선택된 선지 전체 객체

  const sets = yearData?.[section] ?? [];
  const currentSet = sets[setIdx] ?? null;

  // 섹션/세트 변경 시 선택 초기화
  function handleSectionChange(sec) {
    setSection(sec);
    setSetIdx(0);
    setSel(null);
    setSelChoice(null);
  }

  function handleSetChange(idx) {
    setSetIdx(idx);
    setSel(null);
    setSelChoice(null);
  }

  // QuizPanel → PassagePanel 연동
  const handleSelChange = useCallback((uid, choice) => {
    setSel(uid);
    setSelChoice(choice);
  }, []);

  // 모바일: 선지 선택 시 지문 상단으로 자동 스크롤
  useEffect(() => {
    if (sel && window.innerWidth < 768) {
      const passageEl = document.getElementById('passage-panel');
      if (passageEl) {
        passageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [sel]);

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>

      {/* 섹션 탭 */}
      <div style={{ paddingTop: '12px' }}>
        <TabBar
          section={section}
          onChange={handleSectionChange}
          yearData={yearData}
        />
      </div>

      {/* 지문세트 네비 */}
      <PassageSetNav
        sets={sets}
        currentIdx={setIdx}
        onChange={handleSetChange}
      />

      {/* 메인 컨텐츠 — 데스크탑: 2칼럼 / 모바일: 1칼럼 */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 16px 40px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: '16px',
        // 모바일 반응형은 아래 style tag에서 처리
      }}
      className="viewer-grid"
      >
        {/* 왼쪽: 지문 패널 */}
        <div
          id="passage-panel"
          style={{
            background: '#fff',
            borderRadius: '14px',
            border: '1px solid #e5e7eb',
            padding: '24px 20px',
            // 데스크탑에서 sticky
            position: 'sticky',
            top: '64px',
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
          }}
        >
          <PassagePanel
            passageSet={currentSet}
            sel={sel}
          />
        </div>

        {/* 오른쪽: 문제 패널 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <QuizPanel
            passageSet={currentSet}
            sel={sel}
            onSelChange={handleSelChange}
          />
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════
// [6] AuthPage — 로그인/회원가입
// ══════════════════════════════════════════════
function AuthPage({ onSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('확인 이메일을 발송했습니다. 이메일을 확인해 주세요.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setError(error.message);
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    border: '1px solid #d1d5db', fontSize: '0.88rem',
    fontFamily: "'Noto Sans KR', sans-serif", outline: 'none',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '32px 28px', maxWidth: '380px', width: '100%' }}>
        <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '1.3rem', fontWeight: '700', color: '#111827', marginBottom: '24px', textAlign: 'center' }}>
          수능 국어 논리맵핑
        </h2>

        {/* 탭 */}
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', padding: '3px', marginBottom: '20px' }}>
          {[['login', '로그인'], ['signup', '회원가입']].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setError(null); setMessage(null); }}
              style={{ flex: 1, padding: '7px 0', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: tab === key ? '700' : '500', fontSize: '0.85rem', color: tab === key ? '#111827' : '#9ca3af', background: tab === key ? '#fff' : 'transparent', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={inputStyle} />
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '11px', borderRadius: '8px', background: '#1f2937', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '0.88rem', opacity: loading ? 0.6 : 1 }}>
            {loading ? '처리 중...' : tab === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
          <span style={{ fontSize: '0.73rem', color: '#9ca3af' }}>또는</span>
          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
        </div>

        {/* 구글 로그인 */}
        <button onClick={handleGoogle}
          style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#fff', border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Google로 계속하기
        </button>

        {/* 에러/메시지 */}
        {error && (
          <div style={{ marginTop: '14px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '0.8rem', color: '#7f1d1d' }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ marginTop: '14px', padding: '10px 12px', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px', fontSize: '0.8rem', color: '#065f46' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════
// [7] App — 루트 컴포넌트 + 라우팅 상태 관리
// ══════════════════════════════════════════════
export default function App() {
  const [view, setView]           = useState('main');    // 'main' | 'viewer' | 'auth'
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearData, setYearData]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [user, setUser]           = useState(null);

  // Supabase Auth 상태 구독
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 연도 메타정보 (헤더 표시용)
  const yearMeta = YEAR_INFO.find(y => y.key === selectedYear) ?? null;

  // 연도 선택 → 데이터 로드 → 뷰어 진입
  async function handleSelectYear(yearKey) {
    setLoading(true);
    setError(null);
    try {
      const data = await loadYear(yearKey);
      setYearData(data);
      setSelectedYear(yearKey);
      setView('viewer');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(`데이터 로드 실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  // 뒤로가기
  function handleBack() {
    setView('main');
    setSelectedYear(null);
    setYearData(null);
    window.scrollTo({ top: 0 });
  }

  // 로그아웃
  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <>
      {/* 반응형 CSS */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif;
          -webkit-font-smoothing: antialiased;
          background: #f9fafb;
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }

        @media (max-width: 767px) {
          .viewer-grid {
            grid-template-columns: 1fr !important;
          }
          #passage-panel {
            position: static !important;
            max-height: none !important;
          }
        }
      `}</style>

      {/* 헤더 */}
      <Header
        view={view}
        yearMeta={yearMeta}
        section={null}
        onBack={handleBack}
        user={user}
        onAuth={() => setView('auth')}
        onLogout={handleLogout}
      />

      {/* 로딩 */}
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(255,255,255,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '12px',
        }}>
          <div style={{
            width: '36px', height: '36px',
            border: '3px solid #e5e7eb',
            borderTop: '3px solid #1f2937',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            데이터 로드 중…
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div style={{
          margin: '24px auto', maxWidth: '400px',
          padding: '16px 20px', background: '#fef2f2',
          border: '1px solid #fca5a5', borderRadius: '10px',
          color: '#7f1d1d', fontSize: '0.88rem',
        }}>
          ⚠️ {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: '12px', background: 'none', border: 'none',
              color: '#7f1d1d', cursor: 'pointer', fontWeight: '700',
            }}
          >
            닫기
          </button>
        </div>
      )}

      {/* 화면 전환 */}
      {!loading && (
        view === 'auth' ? (
          <AuthPage onSuccess={() => setView('main')} />
        ) : view === 'viewer' ? (
          <ViewerPage
            yearKey={selectedYear}
            yearData={yearData}
          />
        ) : (
          <MainPage onSelectYear={handleSelectYear} />
        )
      )}
    </>
  );
}