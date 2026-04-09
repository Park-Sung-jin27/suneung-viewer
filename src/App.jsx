// ============================================================
// App.jsx — react-router-dom 기반 라우팅 + MainPage 리디자인
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Routes, Route, Navigate,
  useNavigate, useLocation, useSearchParams,
} from 'react-router-dom';

import PassagePanel  from './PassagePanel';
import QuizPanel     from './QuizPanel';
import WrongNote     from './WrongNote';
import PatternReport from './PatternReport';
import Payment       from './Payment';
import Banner        from './Banner';
import Landing       from './Landing';
import ResultPage    from './ResultPage';
import { YEAR_INFO, MODE } from './constants';
import { loadYear, getYearKeys } from './dataLoader';
import { supabase }   from './supabase';
import { saveAnswer } from './hooks/useAnswerTracker';

const _fl = document.createElement('link');
_fl.rel  = 'stylesheet';
_fl.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap';
document.head.appendChild(_fl);

const SECTION_LABELS = { reading: '독서', literature: '문학' };
const FREE_YEARS     = ['2026수능', '2025수능'];

const MC = {
  green:  '#2d6e2d',
  soft:   '#3d8b3d',
  bg:     '#f0f7f0',
  line:   '#7aad7a',
  ink:    '#0d1a0e',
  inkMid: '#253226',
  muted:  '#5a6b5b',
  subtle: '#8a9b8b',
  paper:  '#faf8f4',
  paperAlt:'#f3f0ea',
  white:  '#ffffff',
  border: '#e0dbd0',
};

// ══════════════════════════════════════════════
// Header
// ══════════════════════════════════════════════
function Header({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isViewer = location.pathname === '/viewer';
  const showBack = ['/viewer', '/report', '/wrongnote', '/payment'].includes(location.pathname);
  const yearKey  = new URLSearchParams(location.search).get('year');
  const yearMeta = YEAR_INFO.find(y => y.key === yearKey) ?? null;

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #e5e7eb',
      padding: '0 20px', height: '52px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {showBack && (
          <button onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.85rem', fontWeight: '600', padding: '6px 8px', borderRadius: '6px' }}>
            ← 뒤로
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {yearMeta && <span style={{ width: 8, height: 8, borderRadius: '50%', background: yearMeta.color, display: 'inline-block' }} />}
          <span onClick={() => navigate('/')} style={{ fontFamily: "'Noto Sans KR', sans-serif", fontWeight: '900', fontSize: '0.95rem', color: '#111827', letterSpacing: '-0.02em', cursor: 'pointer' }}>
            {isViewer && yearMeta ? yearMeta.label : '논리맵핑'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {user ? (
          <>
            <button onClick={() => navigate('/report')} style={{ fontSize: '0.73rem', fontWeight: '600', color: '#2d6e2d', background: '#f2f7f2', border: '1px solid #7aad7a', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>내 분석</button>
            <button onClick={() => navigate('/wrongnote')} style={{ fontSize: '0.73rem', fontWeight: '600', color: '#2d6e2d', background: '#f2f7f2', border: '1px solid #7aad7a', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>오답 노트</button>
            <span style={{ fontSize: '0.73rem', color: '#6b7280', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
            <button onClick={onLogout} style={{ fontSize: '0.73rem', fontWeight: '600', color: '#9ca3af', background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>로그아웃</button>
          </>
        ) : (
          <button onClick={() => navigate('/auth')} style={{ fontSize: '0.73rem', fontWeight: '600', color: '#1f2937', background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>로그인</button>
        )}
      </div>
    </header>
  );
}

// ══════════════════════════════════════════════
// Layout
// ══════════════════════════════════════════════
function Layout({ user, onLogout, children }) {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Noto Sans KR', sans-serif; -webkit-font-smoothing: antialiased; background: #f9fafb; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
        @media (max-width: 767px) {
          .viewer-grid { grid-template-columns: 1fr !important; }
          #passage-panel { position: static !important; max-height: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
      <Header user={user} onLogout={onLogout} />
      {children}
    </>
  );
}

// ══════════════════════════════════════════════
// TabBar
// ══════════════════════════════════════════════
function TabBar({ section, onChange, yearData }) {
  const tabs = ['reading', 'literature'].filter(s => yearData?.[s]?.length > 0);
  if (tabs.length < 2) return null;
  return (
    <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '3px', gap: '2px', margin: '0 16px 12px' }}>
      {tabs.map(tab => (
        <button key={tab} onClick={() => onChange(tab)} style={{
          flex: 1, padding: '7px 0', borderRadius: '8px', border: 'none', cursor: 'pointer',
          fontFamily: "'Noto Sans KR', sans-serif",
          fontWeight: section === tab ? '700' : '500', fontSize: '0.85rem',
          color: section === tab ? '#111827' : '#9ca3af',
          background: section === tab ? '#fff' : 'transparent',
          boxShadow: section === tab ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
          transition: 'all 0.15s',
        }}>
          {SECTION_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// PassageSetNav
// ══════════════════════════════════════════════
function PassageSetNav({ sets, currentIdx, onChange }) {
  if (!sets?.length) return null;
  return (
    <div style={{ display: 'flex', gap: '6px', padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
      {sets.map((s, i) => (
        <button key={s.id} onClick={() => onChange(i)} style={{
          flexShrink: 0, padding: '5px 12px', borderRadius: '20px',
          border: currentIdx === i ? '1.5px solid #1f2937' : '1px solid #e5e7eb',
          background: currentIdx === i ? '#1f2937' : '#fff',
          color: currentIdx === i ? '#fff' : '#6b7280',
          fontSize: '0.78rem', fontWeight: currentIdx === i ? '700' : '500',
          cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
        }}>
          {s.range}
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════
// ModeSelectModal
// ══════════════════════════════════════════════
function ModeSelectModal({ yearKey, meta, user, onClose, onSelect }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '28px 24px', maxWidth: '360px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ width: '28px', height: '3px', borderRadius: '2px', background: meta.color, marginBottom: '10px' }} />
          <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '1.05rem', fontWeight: '700', color: '#111827' }}>{meta.label}</div>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{meta.tag}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => { if (!user) { onClose(); onSelect(yearKey, MODE.STUDY, true); return; } onSelect(yearKey, MODE.STUDY, false); }}
            style={{ padding: '14px 16px', borderRadius: '10px', border: '1.5px solid #1f2937', background: '#1f2937', color: '#fff', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: '4px' }}>📝 풀이 모드</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>내 답을 기록하고 패턴을 분석받으세요</div>
          </button>
          <button onClick={() => onSelect(yearKey, MODE.VIEW, false)}
            style={{ padding: '14px 16px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#fff', color: '#1f2937', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: '4px' }}>👁 보기 모드</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>해설과 근거를 자유롭게 확인하세요</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// ProModal
// ══════════════════════════════════════════════
function ProModal({ onClose, onSubscribe }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '32px 28px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔒</div>
        <h3 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '1.1rem', fontWeight: '700', color: '#111827', marginBottom: '10px' }}>Pro 전용 콘텐츠</h3>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: '1.7', marginBottom: '24px' }}>전체 시험은 Pro 구독 후 이용 가능합니다.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => { onClose(); onSubscribe(); }} style={{ padding: '11px', borderRadius: '8px', background: '#1f2937', color: '#fff', border: 'none', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}>구독하기</button>
          <button onClick={onClose} style={{ padding: '10px', borderRadius: '8px', background: 'none', color: '#9ca3af', border: '1px solid #e5e7eb', fontSize: '0.85rem', cursor: 'pointer' }}>닫기</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// YearCard — 리디자인
// ══════════════════════════════════════════════
function YearCard({ meta, locked, isFree, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: MC.white,
        border: `1.5px solid ${hov && !locked ? meta.color : MC.border}`,
        borderRadius: '14px', padding: '18px 16px',
        cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s',
        transform: hov && !locked ? 'translateY(-2px)' : 'none',
        boxShadow: hov && !locked ? `0 8px 24px ${meta.color}22` : '0 1px 4px rgba(0,0,0,0.04)',
        opacity: locked ? 0.45 : 1,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {isFree && (
        <span style={{
          position: 'absolute', top: 10, right: 10,
          fontSize: '0.58rem', fontWeight: '800',
          color: MC.green, background: MC.bg,
          border: `1px solid ${MC.line}`,
          borderRadius: '100px', padding: '2px 7px',
          letterSpacing: '0.05em',
        }}>
          무료
        </span>
      )}
      <div style={{ width: '28px', height: '3px', borderRadius: '2px', background: meta.color, marginBottom: '12px' }} />
      {meta.badge && (
        <span style={{ fontSize: '0.65rem', fontWeight: '700', color: meta.color, background: `${meta.color}15`, padding: '2px 7px', borderRadius: '8px', display: 'inline-block', marginBottom: '7px' }}>
          {meta.badge}
        </span>
      )}
      <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '1rem', fontWeight: '700', color: MC.ink, lineHeight: '1.35', letterSpacing: '-0.02em' }}>
        {meta.label}
      </div>
      <div style={{ fontSize: '0.7rem', color: MC.subtle, marginTop: '5px', fontWeight: '500' }}>{meta.tag}</div>
      <div style={{ marginTop: '12px', fontSize: '0.82rem', fontWeight: '700', color: locked ? MC.subtle : meta.color, opacity: locked ? 0.7 : hov ? 1 : 0.45, transition: 'opacity 0.15s' }}>
        {locked ? '🔒 Pro 전용' : '시작하기 →'}
      </div>
    </button>
  );
}

// ══════════════════════════════════════════════
// MainPage — 리디자인
// ══════════════════════════════════════════════
function MainPage({ isPro, user }) {
  const navigate = useNavigate();
  const [yearKeys, setYearKeys] = useState([]);
  useEffect(() => { getYearKeys().then(setYearKeys); }, []);
  const [showProModal, setShowProModal] = useState(false);
  const [modeTarget, setModeTarget]     = useState(null);

  function handleCardClick(yearKey, meta, locked) {
    if (locked) { setShowProModal(true); return; }
    setModeTarget({ yearKey, meta });
  }

  function handleModeSelect(yearKey, selectedMode, needAuth) {
    setModeTarget(null);
    if (needAuth) { navigate('/auth'); return; }
    navigate(`/viewer?year=${encodeURIComponent(yearKey)}&mode=${selectedMode}`);
  }

  return (
    <div style={{ minHeight: '100vh', background: MC.paper, fontFamily: "'Noto Sans KR', sans-serif" }}>
      {showProModal && <ProModal onClose={() => setShowProModal(false)} onSubscribe={() => navigate('/payment')} />}
      {modeTarget && (
        <ModeSelectModal yearKey={modeTarget.yearKey} meta={modeTarget.meta} user={user}
          onClose={() => setModeTarget(null)} onSelect={handleModeSelect} />
      )}

      {/* 히어로 */}
      <div style={{
        padding: 'clamp(36px, 6vw, 60px) clamp(20px, 5vw, 48px) clamp(28px, 4vw, 44px)',
        background: MC.white, borderBottom: `1px solid ${MC.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        <span style={{
          display: 'inline-block', fontSize: '0.62rem', fontWeight: '700',
          color: MC.green, background: MC.bg, border: `1px solid ${MC.line}35`,
          borderRadius: '100px', padding: '4px 14px',
          letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '18px',
          animation: 'fadeUp 0.6s ease both',
        }}>
          수능 국어 AI 논리진단
        </span>

        <h1 style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 'clamp(1.5rem, 4.5vw, 2.2rem)',
          fontWeight: '700', color: MC.ink,
          lineHeight: '1.3', letterSpacing: '-0.03em',
          margin: '0 0 14px',
          animation: 'fadeUp 0.6s ease 0.1s both',
        }}>
          내 국어 약점을<br />
          <span style={{ color: MC.green }}>지금 진단하세요</span>
        </h1>

        <p style={{
          fontSize: 'clamp(0.83rem, 1.6vw, 0.95rem)',
          color: MC.muted, lineHeight: '1.8',
          maxWidth: '420px', margin: '0 0 28px',
          animation: 'fadeUp 0.6s ease 0.2s both',
        }}>
          선지를 클릭하면 지문 근거 문장이 형광펜으로 표시됩니다.<br />
          오답 패턴을 진단하고 AI 훈련으로 바로 교정하세요.
        </p>

        {/* 빠른 진입 버튼 */}
        <div style={{
          display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center',
          animation: 'fadeUp 0.6s ease 0.3s both',
        }}>
          <button
            onClick={() => navigate('/report')}
            style={{ padding: '10px 22px', borderRadius: '10px', background: MC.green, color: '#fff', border: 'none', fontWeight: '700', fontSize: '0.87rem', cursor: 'pointer', fontFamily: "'Noto Sans KR', sans-serif" }}
          >
            📊 내 패턴 분석 보기
          </button>
          <button
            onClick={() => navigate('/payment')}
            style={{ padding: '10px 22px', borderRadius: '10px', background: 'transparent', color: MC.green, border: `1.5px solid ${MC.line}`, fontWeight: '700', fontSize: '0.87rem', cursor: 'pointer', fontFamily: "'Noto Sans KR', sans-serif" }}
          >
            💳 요금제 보기
          </button>
        </div>

        {/* 구독 상태 배너 */}
        {!isPro && (
          <div style={{
            marginTop: '20px', padding: '10px 18px',
            background: MC.bg, border: `1px solid ${MC.line}`,
            borderRadius: '10px', fontSize: '0.78rem', color: MC.mid,
            display: 'flex', alignItems: 'center', gap: '8px',
            animation: 'fadeUp 0.6s ease 0.35s both',
          }}>
            <span>🆓</span>
            <span><strong>2026·2025학년도 수능</strong> 무료 — 전체 시험은 Pro에서</span>
            <button
              onClick={() => navigate('/payment')}
              style={{ background: MC.green, color: '#fff', border: 'none', borderRadius: '6px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              업그레이드
            </button>
          </div>
        )}
        {isPro && (
          <div style={{
            marginTop: '20px', padding: '9px 18px',
            background: MC.bg, border: `1px solid ${MC.line}`,
            borderRadius: '10px', fontSize: '0.78rem', color: MC.green, fontWeight: '600',
            animation: 'fadeUp 0.6s ease 0.35s both',
          }}>
            ✅ Pro 구독 중 — 전체 7개년 시험 이용 가능
          </div>
        )}
      </div>

      {/* 시험 선택 */}
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: 'clamp(20px, 4vw, 36px) clamp(16px, 4vw, 24px)' }}>

        {/* 섹션 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: '700', color: MC.subtle, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
              수록 시험
            </div>
            <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '1.1rem', fontWeight: '700', color: MC.ink, letterSpacing: '-0.02em' }}>
              풀 시험을 선택하세요
            </h2>
          </div>
          <span style={{ fontSize: '0.72rem', color: MC.subtle }}>
            {isPro ? '전체 개방' : `무료 2개 · Pro ${yearKeys.length - 2}개`}
          </span>
        </div>

        {/* 연도 카드 그리드 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
          gap: '12px',
          marginBottom: '32px',
        }}>
          {yearKeys.map(yearKey => {
            const meta   = YEAR_INFO.find(y => y.key === yearKey);
            const yd     = { label: meta?.label ?? yearKey, color: meta?.color ?? '#374151', badge: meta?.badge ?? '', tag: meta?.tag ?? '' };
            const locked = !isPro && !FREE_YEARS.includes(yearKey);
            const isFree = FREE_YEARS.includes(yearKey);
            return (
              <YearCard key={yearKey} meta={yd} locked={locked} isFree={isFree}
                onClick={() => handleCardClick(yearKey, yd, locked)} />
            );
          })}
        </div>

        {/* 기능 요약 카드 3개 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {[
            { icon: '🔦', title: '지문 근거 형광펜', desc: '선지 클릭 → 지문 근거 문장 즉시 표시', color: '#3b82f6', bg: '#eff6ff' },
            { icon: '🎯', title: 'AI 패턴 훈련', desc: '오답 패턴에 맞는 AI 훈련 문제 무한 생성', color: MC.green, bg: MC.bg },
            { icon: '📊', title: '개인 오답 리포트', desc: '누적 데이터 기반 취약 패턴 자동 분류', color: '#8b5cf6', bg: '#f5f3ff' },
          ].map((f, i) => (
            <div key={i} style={{
              background: f.bg, border: `1px solid ${f.color}25`,
              borderRadius: '12px', padding: '16px 14px',
              display: 'flex', gap: '12px', alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: '0.83rem', fontWeight: '700', color: MC.ink, marginBottom: '4px' }}>{f.title}</div>
                <div style={{ fontSize: '0.74rem', color: MC.muted, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// ViewerPage
// ══════════════════════════════════════════════
function ViewerPage({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const yearKey   = searchParams.get('year') ?? '';
  const initSetId = searchParams.get('set')  ?? null;
  const initQId   = searchParams.get('q')    ?? null;
  const modeParam = searchParams.get('mode') ?? MODE.VIEW;
  const mode      = modeParam === MODE.STUDY ? MODE.STUDY : MODE.VIEW;

  const [yearData, setYearData]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [section, setSection]       = useState('reading');
  const [setIdx, setSetIdx]         = useState(0);
  const [sel, setSel]               = useState(null);
  const [studyAnswers, setStudyAnswers] = useState({});
  const [submitted, setSubmitted]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isReview, setIsReview]     = useState(false);
  const [warningMsg, setWarningMsg] = useState(null);

  useEffect(() => {
    if (!yearKey) { navigate('/'); return; }
    setLoading(true);
    loadYear(yearKey)
      .then(data => {
        setYearData(data);
        if (initSetId) {
          if (data.literature?.some(s => s.id === initSetId)) {
            setSection('literature');
            const idx = data.literature.findIndex(s => s.id === initSetId);
            if (idx >= 0) setSetIdx(idx);
          } else {
            setSection('reading');
            const idx = (data.reading ?? []).findIndex(s => s.id === initSetId);
            if (idx >= 0) setSetIdx(idx);
          }
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [yearKey]); // eslint-disable-line

  const sets       = yearData?.[section] ?? [];
  const currentSet = sets[setIdx] ?? null;
  const isStudy    = mode === MODE.STUDY;

  const allSets = [
    ...(yearData?.reading    ?? []).map(s => ({ ...s, _sec: 'reading' })),
    ...(yearData?.literature ?? []).map(s => ({ ...s, _sec: 'literature' })),
  ];
  const allSetIdx     = currentSet ? allSets.findIndex(s => s.id === currentSet.id) : -1;
  const hasPrev       = allSetIdx > 0;
  const hasNext       = allSetIdx >= 0 && allSetIdx < allSets.length - 1;
  const totalQCount   = allSets.reduce((sum, s) => sum + (s.questions?.length ?? 0), 0);
  const totalAnswered = Object.values(studyAnswers).reduce((sum, sq) => sum + Object.keys(sq).length, 0);

  function resetScroll() {
    window.scrollTo({ top: 0 });
    document.getElementById('passage-panel')?.scrollTo({ top: 0 });
  }

  function handleNavSet(delta) {
    const target = allSets[allSetIdx + delta];
    if (!target) return;
    if (target._sec !== section) setSection(target._sec);
    const idx = (yearData?.[target._sec] ?? []).findIndex(s => s.id === target.id);
    if (idx >= 0) setSetIdx(idx);
    setSel(null); setWarningMsg(null); resetScroll();
  }

  useEffect(() => {
    if (!yearKey || !currentSet) return;
    const next = { year: yearKey, set: currentSet.id, mode };
    if (sel) next.q = sel.split('_')[0].replace('q', '');
    else if (initQId) next.q = initQId;
    setSearchParams(next, { replace: true });
  }, [yearKey, currentSet, sel]); // eslint-disable-line

  const handleSelChange = useCallback((uid) => setSel(uid), []);

  function handleStudyAnswer(qid, choiceNum) {
    const sid = currentSet?.id;
    if (!sid) return;
    setStudyAnswers(prev => ({ ...prev, [sid]: { ...prev[sid], [qid]: choiceNum } }));
    setWarningMsg(null);
  }

  async function handleSubmitAll() {
    let firstMissing = null;
    for (const s of allSets) {
      for (const q of (s.questions ?? [])) {
        if (studyAnswers[s.id]?.[q.id] == null) { firstMissing = { setId: s.id, sec: s._sec, qId: q.id }; break; }
      }
      if (firstMissing) break;
    }
    if (firstMissing) {
      const { setId: missId, sec: missSec, qId } = firstMissing;
      if (missSec !== section) setSection(missSec);
      const idx = (yearData?.[missSec] ?? []).findIndex(s => s.id === missId);
      if (idx >= 0) setSetIdx(idx);
      setWarningMsg(`⚠️ ${qId}번 문항에 답이 체크되지 않았습니다.`);
      return;
    }
    setSubmitting(true);
    for (const s of allSets) {
      for (const q of (s.questions ?? [])) {
        const choiceNum = studyAnswers[s.id]?.[q.id];
        if (choiceNum == null) continue;
        const choice = q.choices.find(c => c.num === choiceNum);
        if (!choice) continue;
        const qt = q.questionType ?? 'negative';
        const isCorrect = qt === 'positive' ? choice.ok === true : choice.ok === false;
        try { await saveAnswer({ user, yearKey, setId: s.id, questionId: q.id, choiceNum, isCorrect, pat: choice.pat ?? null }); }
        catch (e) { console.warn('[saveAnswer 무시]', e?.message); }
      }
    }
    setSubmitting(false);
    setSubmitted(true);
    window.scrollTo({ top: 0 });
  }

  useEffect(() => {
    if (sel && window.innerWidth < 768)
      document.getElementById('passage-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [sel]);

  useEffect(() => {
    if (warningMsg) document.getElementById('warning-banner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [warningMsg]);

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', zIndex: 200 }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid #e5e7eb', borderTop: '3px solid #1f2937', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>데이터 로드 중…</span>
    </div>
  );

  if (error) return (
    <div style={{ margin: '24px auto', maxWidth: '400px', padding: '16px 20px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', color: '#7f1d1d', fontSize: '0.88rem' }}>
      ⚠️ {error}
      <button onClick={() => navigate('/')} style={{ marginLeft: '12px', background: 'none', border: 'none', color: '#7f1d1d', cursor: 'pointer', fontWeight: '700' }}>목록으로</button>
    </div>
  );

  if (submitted && !isReview) {
    const yearMeta = YEAR_INFO.find(y => y.key === yearKey);
    return (
      <ResultPage
        user={user} yearKey={yearKey} yearLabel={yearMeta?.label ?? yearKey}
        studyAnswers={studyAnswers} allSets={allSets}
        onReview={(setId) => {
          const target = allSets.find(s => s.id === setId);
          if (!target) return;
          if (target._sec !== section) setSection(target._sec);
          const idx = (yearData?.[target._sec] ?? []).findIndex(s => s.id === setId);
          if (idx >= 0) setSetIdx(idx);
          setSel(null); setIsReview(true); window.scrollTo({ top: 0 });
        }}
        onBack={() => navigate('/')}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <Banner bannerId="how-to-use-v1" message="💡 시험지를 먼저 풀고 오세요 — 답을 입력하면 지문 근거와 해설이 표시됩니다" type="info" />

      {isStudy && isReview && (
        <div style={{ position: 'sticky', top: '52px', zIndex: 90, background: '#064e3b', padding: '7px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: '#6ee7b7' }}>📖 복습 모드 — 내 답 <span style={{ color: '#fca5a5' }}>빨간</span> · 정답 <span style={{ color: '#6ee7b7' }}>초록</span></span>
          <button onClick={() => setIsReview(false)} style={{ flexShrink: 0, padding: '5px 14px', borderRadius: '6px', background: '#10b981', color: '#fff', border: 'none', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}>결과로 돌아가기</button>
        </div>
      )}

      {isStudy && !submitted && (
        <div style={{ position: 'sticky', top: '52px', zIndex: 90, background: '#1f2937', padding: '7px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{totalAnswered}/{totalQCount} 선택</span>
          <button onClick={handleSubmitAll} disabled={submitting} style={{ padding: '6px 16px', borderRadius: '6px', background: submitting ? '#6b7280' : '#f9fafb', color: submitting ? '#fff' : '#1f2937', border: 'none', fontWeight: '700', cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: submitting ? 0.8 : 1, transition: 'all 0.15s' }}>
            {submitting ? '저장 중…' : `제출 (${totalAnswered}/${totalQCount})`}
          </button>
        </div>
      )}

      <div style={{ paddingTop: '12px' }}>
        <TabBar section={section} onChange={sec => { setSection(sec); setSetIdx(0); setSel(null); setWarningMsg(null); resetScroll(); }} yearData={yearData} />
      </div>
      <PassageSetNav sets={sets} currentIdx={setIdx} onChange={idx => { setSetIdx(idx); setSel(null); setWarningMsg(null); resetScroll(); }} />

      {warningMsg && (
        <div id="warning-banner" style={{ maxWidth: '1200px', margin: '8px auto 0', padding: '0 16px' }}>
          <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '8px', padding: '10px 16px', color: '#92400e', fontSize: '0.85rem', fontWeight: '600' }}>{warningMsg}</div>
        </div>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px 40px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }} className="viewer-grid">
        <div id="passage-panel" style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '24px 20px', position: 'sticky', top: '64px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
          <PassagePanel passageSet={currentSet} sel={sel} mode={isReview ? MODE.VIEW : mode} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <QuizPanel
            passageSet={currentSet} sel={sel} onSelChange={handleSelChange}
            user={user} yearKey={yearKey} mode={mode} isReview={isReview}
            studyAnswers={studyAnswers[currentSet?.id] ?? {}}
            onStudyAnswer={handleStudyAnswer} submitted={submitted}
            onPrev={() => handleNavSet(-1)} onNext={() => handleNavSet(1)}
            hasPrev={hasPrev} hasNext={hasNext}
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// AuthPage
// ══════════════════════════════════════════════
function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab]           = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState(null);

  async function handleSubmit(e) {
    e.preventDefault(); setError(null); setMessage(null); setLoading(true);
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/');
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('확인 이메일을 발송했습니다. 이메일을 확인해 주세요.');
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setError(error.message);
  }

  const inp = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.88rem', fontFamily: "'Noto Sans KR', sans-serif", outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '32px 28px', maxWidth: '380px', width: '100%' }}>
        <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '1.3rem', fontWeight: '700', color: '#111827', marginBottom: '24px', textAlign: 'center' }}>논리맵핑</h2>
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', padding: '3px', marginBottom: '20px' }}>
          {[['login', '로그인'], ['signup', '회원가입']].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setError(null); setMessage(null); }}
              style={{ flex: 1, padding: '7px 0', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: tab === key ? '700' : '500', fontSize: '0.85rem', color: tab === key ? '#111827' : '#9ca3af', background: tab === key ? '#fff' : 'transparent', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
          <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={inp} />
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '11px', borderRadius: '8px', background: '#1f2937', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '0.88rem', opacity: loading ? 0.6 : 1 }}>
            {loading ? '처리 중...' : tab === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
          <span style={{ fontSize: '0.73rem', color: '#9ca3af' }}>또는</span>
          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
        </div>
        <button onClick={handleGoogle} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#fff', border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Google로 계속하기
        </button>
        {error   && <div style={{ marginTop: '14px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '0.8rem', color: '#7f1d1d' }}>{error}</div>}
        {message && <div style={{ marginTop: '14px', padding: '10px 12px', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px', fontSize: '0.8rem', color: '#065f46' }}>{message}</div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// App — 루트
// ══════════════════════════════════════════════
export default function App() {
  const navigate = useNavigate();
  const [user, setUser]         = useState(null);
  const [isPro, setIsPro]       = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setIsPro(false); return; }
    supabase.rpc('is_pro', { uid: user.id }).then(({ data }) => setIsPro(data === true));
  }, [user]);

  useEffect(() => {
    const params     = new URLSearchParams(window.location.search);
    const paymentKey = params.get('paymentKey');
    const orderId    = params.get('orderId');
    const amount     = params.get('amount');
    const code       = params.get('code');
    if (code) { alert('결제가 취소됐습니다'); navigate('/', { replace: true }); return; }
    if (paymentKey && orderId && amount) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        const uid = session?.user?.id;
        if (!uid) return;
        await supabase.from('subscriptions').upsert(
          { user_id: uid, plan: 'pro', status: 'active', toss_payment_key: paymentKey, toss_order_id: orderId },
          { onConflict: 'user_id' }
        );
        setIsPro(true);
        navigate('/', { replace: true });
      });
    }
  }, []); // eslint-disable-line

  async function handleLogout() {
    await supabase.auth.signOut();
    sessionStorage.clear();
    setUser(null);
    navigate('/');
  }

  if (!authReady) return null;

  const goToQuestion = (yearKey, setId, questionId) =>
    navigate(`/viewer?year=${encodeURIComponent(yearKey)}&set=${setId}&q=${questionId}&mode=${MODE.VIEW}`);

  return (
    <Routes>
      <Route path="/" element={
        !user
          ? <Landing onStart={() => navigate('/auth')} />
          : <Layout user={user} onLogout={handleLogout}><MainPage isPro={isPro} user={user} /></Layout>
      } />
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/viewer" element={
        <Layout user={user} onLogout={handleLogout}><ViewerPage user={user} /></Layout>
      } />
      <Route path="/report" element={
        user
          ? <Layout user={user} onLogout={handleLogout}><PatternReport user={user} onGoToQuestion={goToQuestion} /></Layout>
          : <Navigate to="/auth" replace />
      } />
      <Route path="/wrongnote" element={
        user
          ? <Layout user={user} onLogout={handleLogout}><WrongNote user={user} allData={allData} onGoToQuestion={goToQuestion} /></Layout>
          : <Navigate to="/auth" replace />
      } />
      <Route path="/payment" element={
        user
          ? <Layout user={user} onLogout={handleLogout}><Payment user={user} onSuccess={() => { setIsPro(true); navigate('/'); }} /></Layout>
          : <Navigate to="/auth" replace />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
