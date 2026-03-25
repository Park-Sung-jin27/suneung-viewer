// ============================================================
// App.jsx — 수능 국어 논리맵핑 뷰어 최상위 컴포넌트
// Vite + React 환경
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import PassagePanel from './PassagePanel';
import QuizPanel from './QuizPanel';
import { YEAR_INFO } from './constants';
import { loadYear, getYearKeys } from './dataLoader';

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
// ─────────────────────────────────────────────


// ══════════════════════════════════════════════
// [1] Header
// ══════════════════════════════════════════════
function Header({ view, yearMeta, section, onBack }) {
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

      {/* 오른쪽: 태그 */}
      {view === 'main' && (
        <span style={{
          fontSize: '0.72rem', color: '#9ca3af', fontWeight: '500',
          letterSpacing: '0.05em',
        }}>
          기출 분석 뷰어
        </span>
      )}
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
            selectedChoice={selChoice}
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
// [6] App — 루트 컴포넌트 + 라우팅 상태 관리
// ══════════════════════════════════════════════
export default function App() {
  const [view, setView]           = useState('main');    // 'main' | 'viewer'
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearData, setYearData]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

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
        view === 'main' ? (
          <MainPage onSelectYear={handleSelectYear} />
        ) : (
          <ViewerPage
            yearKey={selectedYear}
            yearData={yearData}
          />
        )
      )}
    </>
  );
}