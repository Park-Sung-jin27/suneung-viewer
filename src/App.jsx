// ============================================================
// App.jsx — 수능 국어 논리맵핑 뷰어 최상위 컴포넌트
// Vite + React 환경
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import PassagePanel from './PassagePanel';
import QuizPanel from './QuizPanel';
import WrongNote from './WrongNote';
import PatternReport from './PatternReport';
import Payment from './Payment';
import Banner from './Banner';
import Landing from './Landing';
import ResultPage from './ResultPage';
import { YEAR_INFO, MODE } from './constants';
import { loadYear, getYearKeys } from './dataLoader';
import { supabase } from './supabase';
import { saveAnswer } from './hooks/useAnswerTracker';
import allData from './data/all_data_204.json';

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
// 'main'       → 연도 선택 메인 화면
// 'viewer'     → 지문+문제 뷰어
// 'auth'       → 로그인/회원가입
// 'wrongnote'  → 오답 노트
// 'report'     → 오답 패턴 리포트
// ─────────────────────────────────────────────


// ══════════════════════════════════════════════
// [1] Header
// ══════════════════════════════════════════════
function Header({ view, yearMeta, section, onBack, user, onAuth, onLogout, onWrongNote, onReport }) {
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
            <button onClick={onReport} style={{ fontSize: '0.73rem', fontWeight: '600', color: '#2d6e2d', background: '#f2f7f2', border: '1px solid #7aad7a', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
              내 분석
            </button>
            <button onClick={onWrongNote} style={{ fontSize: '0.73rem', fontWeight: '600', color: '#2d6e2d', background: '#f2f7f2', border: '1px solid #7aad7a', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
              오답 노트
            </button>
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
// [4-0] ModeSelectModal — 모드 선택
// ══════════════════════════════════════════════
function ModeSelectModal({ yearKey, meta, user, onClose, onSelect }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '16px',
          padding: '28px 24px', maxWidth: '360px', width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        {/* 시험명 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ width: '28px', height: '3px', borderRadius: '2px', background: meta.color, marginBottom: '10px' }} />
          <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '1.05rem', fontWeight: '700', color: '#111827' }}>
            {meta.label}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '3px' }}>{meta.tag}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 풀이 모드 */}
          <button
            onClick={() => {
              if (!user) { onClose(); onSelect(yearKey, MODE.STUDY, true); return; }
              onSelect(yearKey, MODE.STUDY, false);
            }}
            style={{
              padding: '14px 16px', borderRadius: '10px', border: '1.5px solid #1f2937',
              background: '#1f2937', color: '#fff', textAlign: 'left', cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: '4px' }}>📝 풀이 모드</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>내 답을 기록하고 패턴을 분석받으세요</div>
          </button>

          {/* 보기 모드 */}
          <button
            onClick={() => onSelect(yearKey, MODE.VIEW, false)}
            style={{
              padding: '14px 16px', borderRadius: '10px', border: '1.5px solid #e5e7eb',
              background: '#fff', color: '#1f2937', textAlign: 'left', cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: '700', fontSize: '0.92rem', marginBottom: '4px' }}>👁 보기 모드</div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>해설과 근거를 자유롭게 확인하세요</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// [4] ProModal — 구독 유도 모달
// ══════════════════════════════════════════════
function ProModal({ onClose, onSubscribe }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '16px',
          padding: '32px 28px', maxWidth: '340px', width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔒</div>
        <h3 style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: '1.1rem', fontWeight: '700',
          color: '#111827', marginBottom: '10px',
        }}>
          Pro 전용 콘텐츠
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: '1.7', marginBottom: '24px' }}>
          전체 시험은 Pro 구독 후 이용 가능합니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => { onClose(); onSubscribe(); }}
            style={{
              padding: '11px', borderRadius: '8px',
              background: '#1f2937', color: '#fff',
              border: 'none', fontWeight: '700',
              fontSize: '0.88rem', cursor: 'pointer',
            }}
          >
            구독하기
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px', borderRadius: '8px',
              background: 'none', color: '#9ca3af',
              border: '1px solid #e5e7eb',
              fontSize: '0.85rem', cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════
// [5] 메인 화면 — 연도 카드 그리드
// ══════════════════════════════════════════════
const FREE_YEARS = ['2026수능', '2025수능'];

function MainPage({ onSelectYear, isPro, onSubscribe, user, onNeedAuth }) {
  const yearKeys = getYearKeys();
  const [showProModal, setShowProModal]   = useState(false);
  const [modeTarget, setModeTarget]       = useState(null); // { yearKey, meta }

  function handleCardClick(yearKey, meta, locked) {
    if (locked) { setShowProModal(true); return; }
    setModeTarget({ yearKey, meta });
  }

  function handleModeSelect(yearKey, selectedMode, needAuth) {
    setModeTarget(null);
    if (needAuth) { onNeedAuth(); return; }
    onSelectYear(yearKey, selectedMode);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      {showProModal && <ProModal onClose={() => setShowProModal(false)} onSubscribe={onSubscribe} />}
      {modeTarget && (
        <ModeSelectModal
          yearKey={modeTarget.yearKey}
          meta={modeTarget.meta}
          user={user}
          onClose={() => setModeTarget(null)}
          onSelect={handleModeSelect}
        />
      )}

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
          const locked = !isPro && !FREE_YEARS.includes(yearKey);
          return (
            <YearCard
              key={yearKey}
              yearKey={yearKey}
              meta={yearData}
              locked={locked}
              onClick={() => handleCardClick(yearKey, yearData, locked)}
            />
          );
        })}
      </div>
    </div>
  );
}


function YearCard({ yearKey, meta, locked, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1.5px solid ${hovered && !locked ? meta.color : '#e5e7eb'}`,
        borderRadius: '14px',
        padding: '20px 18px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.18s',
        transform: hovered && !locked ? 'translateY(-2px)' : 'none',
        boxShadow: hovered && !locked ? `0 8px 24px ${meta.color}22` : '0 1px 4px rgba(0,0,0,0.06)',
        opacity: locked ? 0.4 : 1,
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

      {/* 화살표 or 잠금 */}
      <div style={{
        marginTop: '14px',
        fontSize: '0.85rem', fontWeight: '700',
        color: locked ? '#9ca3af' : meta.color,
        opacity: locked ? 0.7 : hovered ? 1 : 0.4,
        transition: 'opacity 0.15s',
      }}>
        {locked ? '🔒 Pro 전용' : '시작하기 →'}
      </div>
    </button>
  );
}


// ══════════════════════════════════════════════
// [5] 뷰어 화면 — 지문 + 문제 레이아웃
// ══════════════════════════════════════════════
function ViewerPage({ yearKey, yearData, user, initialSetId, initialQId, mode, onBack }) {
  // initialSetId로 section/setIdx 복원
  const initSection = (() => {
    if (!initialSetId || !yearData) return 'reading';
    if (yearData.literature?.some(s => s.id === initialSetId)) return 'literature';
    return 'reading';
  })();
  const initSetIdx = (() => {
    if (!initialSetId || !yearData) return 0;
    const sec = yearData.literature?.some(s => s.id === initialSetId) ? 'literature' : 'reading';
    const idx = (yearData[sec] ?? []).findIndex(s => s.id === initialSetId);
    return idx >= 0 ? idx : 0;
  })();

  const [section, setSection] = useState(initSection);
  const [setIdx, setSetIdx]   = useState(initSetIdx);
  const [sel, setSel]         = useState(null);       // 고유 식별자 "q1_c3"
  const [selChoice, setSelChoice] = useState(null);   // 선택된 선지 전체 객체
  const [studyAnswers, setStudyAnswers] = useState({}); // { [setId]: { [qid]: choiceNum } }
  const [submitted, setSubmitted]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [isReview, setIsReview]         = useState(false);
  const [warningMsg, setWarningMsg]     = useState(null);

  const sets = yearData?.[section] ?? [];
  const currentSet = sets[setIdx] ?? null;

  const isStudy     = mode === MODE.STUDY;
  const totalQCount = [...(yearData?.reading ?? []), ...(yearData?.literature ?? [])]
    .reduce((sum, s) => sum + (s.questions?.length ?? 0), 0);
  const totalAnswered = Object.values(studyAnswers)
    .reduce((sum, sq) => sum + Object.keys(sq).length, 0);

  // reading → literature 순서의 전체 세트 flat 배열
  const allSets = [
    ...(yearData?.reading    ?? []).map(s => ({ ...s, _sec: 'reading' })),
    ...(yearData?.literature ?? []).map(s => ({ ...s, _sec: 'literature' })),
  ];
  const allSetIdx  = currentSet ? allSets.findIndex(s => s.id === currentSet.id) : -1;
  const hasPrev    = allSetIdx > 0;
  const hasNext    = allSetIdx >= 0 && allSetIdx < allSets.length - 1;

  // 윈도우 + 지문 패널 내부 스크롤 동시 리셋
  function resetScroll() {
    window.scrollTo({ top: 0 });
    document.getElementById('passage-panel')?.scrollTo({ top: 0 });
  }

  function handleNavSet(delta) {
    const target = allSets[allSetIdx + delta];
    if (!target) return;
    if (target._sec !== section) setSection(target._sec);
    const secSets = yearData?.[target._sec] ?? [];
    const idx = secSets.findIndex(s => s.id === target.id);
    if (idx >= 0) setSetIdx(idx);
    setSel(null);
    setSelChoice(null);
    setWarningMsg(null);
    resetScroll();
  }

  // URL 동기화 (세트 변경 시 replaceState)
  useEffect(() => {
    if (!yearKey || !currentSet) return;
    const qId = sel ? sel.split('_')[0].replace('q', '') : (initialQId ?? '');
    const params = new URLSearchParams({ year: yearKey, set: currentSet.id });
    if (qId) params.set('q', qId);
    if (mode) params.set('mode', mode);
    window.history.replaceState({}, '', `/viewer?${params.toString()}`);
  }, [yearKey, currentSet, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  // 섹션/세트 변경 시 선택 초기화
  function handleSectionChange(sec) {
    setSection(sec);
    setSetIdx(0);
    setSel(null);
    setSelChoice(null);
    setWarningMsg(null);
    resetScroll();
  }

  function handleSetChange(idx) {
    setSetIdx(idx);
    setSel(null);
    setSelChoice(null);
    setWarningMsg(null);
    resetScroll();
  }

  // QuizPanel → PassagePanel 연동
  const handleSelChange = useCallback((uid, choice) => {
    setSel(uid);
    setSelChoice(choice);
  }, []);

  function handleStudyAnswer(qid, choiceNum) {
    const sid = currentSet?.id;
    if (!sid) return;
    setStudyAnswers(prev => ({
      ...prev,
      [sid]: { ...prev[sid], [qid]: choiceNum },
    }));
    setWarningMsg(null);
  }

  async function handleSubmitAll() {
    // 첫 번째 미선택 문항 찾기
    let firstMissing = null;
    for (const s of allSets) {
      for (const q of (s.questions ?? [])) {
        if (studyAnswers[s.id]?.[q.id] == null) {
          firstMissing = { setId: s.id, sec: s._sec, qId: q.id };
          break;
        }
      }
      if (firstMissing) break;
    }
    if (firstMissing) {
      const { setId: missId, sec: missSec, qId } = firstMissing;
      if (missSec !== section) setSection(missSec);
      const secSets = yearData?.[missSec] ?? [];
      const missIdx = secSets.findIndex(s => s.id === missId);
      if (missIdx >= 0) setSetIdx(missIdx);
      setWarningMsg(`⚠️ ${qId}번 문항에 답이 체크되지 않았습니다.`);
      return;
    }
    // 전체 선택 완료 → saveAnswer 일괄 호출
    // saveAnswer 실패해도 ResultPage는 반드시 표시 (개별 try-catch)
    setSubmitting(true);
    for (const s of allSets) {
      for (const q of (s.questions ?? [])) {
        const choiceNum = studyAnswers[s.id]?.[q.id];
        if (choiceNum == null) continue;
        const choice = q.choices.find(c => c.num === choiceNum);
        if (!choice) continue;
        const qt = q.questionType ?? 'negative';
        const isCorrect = qt === 'positive' ? choice.ok === true : choice.ok === false;
        try {
          await saveAnswer({ user, yearKey, setId: s.id, questionId: q.id, choiceNum, isCorrect, pat: choice.pat ?? null });
        } catch (e) {
          console.warn('[saveAnswer 실패 무시]', s.id, q.id, e?.message);
        }
      }
    }
    setSubmitting(false);
    setSubmitted(true);
    window.scrollTo({ top: 0 });
  }

  // 모바일: 선지 선택 시 지문 상단으로 자동 스크롤
  useEffect(() => {
    if (sel && window.innerWidth < 768) {
      const passageEl = document.getElementById('passage-panel');
      if (passageEl) {
        passageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [sel]);

  // 경고 배너 표시 시 배너 위치로 자동 스크롤
  useEffect(() => {
    if (!warningMsg) return;
    const el = document.getElementById('warning-banner');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [warningMsg]);

  // 제출 완료 → ResultPage 전환 (복습 모드 진입 시엔 뷰어 유지)
  if (submitted && !isReview) {
    const yearMeta = YEAR_INFO.find(y => y.key === yearKey);
    return (
      <ResultPage
        user={user}
        yearKey={yearKey}
        yearLabel={yearMeta?.label ?? yearKey}
        studyAnswers={studyAnswers}
        allSets={allSets}
        onReview={(setId, qid) => {
          const target = allSets.find(s => s.id === setId);
          if (!target) return;
          if (target._sec !== section) setSection(target._sec);
          const secSets = yearData?.[target._sec] ?? [];
          const idx = secSets.findIndex(s => s.id === setId);
          if (idx >= 0) setSetIdx(idx);
          setSel(null);
          setSelChoice(null);
          setIsReview(true);
          window.scrollTo({ top: 0 });
        }}
        onBack={onBack}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>

      {/* 풀이 모드: 헤더 우측 전체 제출 바 */}
      {/* 복습 모드 배너 */}
      {isStudy && isReview && (
        <div style={{
          position: 'sticky', top: '52px', zIndex: 90,
          background: '#064e3b',
          padding: '7px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <span style={{ fontSize: '0.78rem', color: '#6ee7b7' }}>
            📖 복습 모드 — 내 답 <span style={{color:'#fca5a5'}}>빨간</span> · 정답 <span style={{color:'#6ee7b7'}}>초록</span> · 해설 자동 표시
          </span>
          <button
            onClick={() => setIsReview(false)}
            style={{ flexShrink:0, padding: '5px 14px', borderRadius: '6px', background: '#10b981', color: '#fff', border: 'none', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}
          >
            결과로 돌아가기
          </button>
        </div>
      )}

      {isStudy && !submitted && (
        <div style={{
          position: 'sticky', top: '52px', zIndex: 90,
          background: '#1f2937',
          padding: '7px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px',
        }}>
          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
            {totalAnswered}/{totalQCount} 선택
          </span>
          <button
            onClick={handleSubmitAll}
            disabled={submitting}
            style={{
              padding: '6px 16px', borderRadius: '6px',
              background: submitting ? '#6b7280' : '#f9fafb',
              color: submitting ? '#fff' : '#1f2937',
              border: 'none', fontWeight: '700',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              opacity: submitting ? 0.8 : 1,
              transition: 'all 0.15s',
            }}
          >
            {submitting ? '저장 중…' : `제출 (${totalAnswered}/${totalQCount})`}
          </button>
        </div>
      )}

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

      {/* 인라인 경고 (미선택 문항) */}
      {warningMsg && (
        <div id="warning-banner" style={{
          maxWidth: '1200px', margin: '8px auto 0', padding: '0 16px',
        }}>
          <div style={{
            background: '#fef3c7', border: '1px solid #fbbf24',
            borderRadius: '8px', padding: '10px 16px',
            color: '#92400e', fontSize: '0.85rem', fontWeight: '600',
          }}>
            {warningMsg}
          </div>
        </div>
      )}

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
            mode={mode}
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
            user={user}
            yearKey={yearKey}
            mode={mode}
            isReview={isReview}
            studyAnswers={studyAnswers[currentSet?.id] ?? {}}
            onStudyAnswer={handleStudyAnswer}
            submitted={submitted}
            onPrev={() => handleNavSet(-1)}
            onNext={() => handleNavSet(1)}
            hasPrev={hasPrev}
            hasNext={hasNext}
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
  const [view, setView]           = useState('main');    // 'main' | 'viewer' | 'auth' | 'wrongnote' | 'report'
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearData, setYearData]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [user, setUser]           = useState(null);
  const [isPro, setIsPro]         = useState(false);
  const [initialSetId, setInitialSetId] = useState(null);
  const [initialQId, setInitialQId]     = useState(null);
  const [mode, setMode]                 = useState(MODE.VIEW); // 'study' | 'view'

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

  // 구독 상태 확인
  useEffect(() => {
    if (!user) { setIsPro(false); return; }
    supabase.rpc('is_pro', { uid: user.id }).then(({ data }) => {
      setIsPro(data === true);
    });
  }, [user]);

  // 결제 콜백 URL 처리 (/payment/success, /payment/fail)
  useEffect(() => {
    const params     = new URLSearchParams(window.location.search);
    const paymentKey = params.get('paymentKey');
    const orderId    = params.get('orderId');
    const amount     = params.get('amount');
    const code       = params.get('code');

    if (code) {
      // 결제 실패 / 취소
      alert('결제가 취소됐습니다');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (paymentKey && orderId && amount) {
      // 결제 성공 — 세션에서 user 확보 후 DB 저장
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        const uid = session?.user?.id;
        if (!uid) return;
        await supabase.from('subscriptions').upsert(
          { user_id: uid, plan: 'pro', status: 'active',
            toss_payment_key: paymentKey, toss_order_id: orderId },
          { onConflict: 'user_id' }
        );
        setIsPro(true);
        window.history.replaceState({}, '', window.location.pathname);
        setView('main');
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 뷰어 URL 복원 (/viewer?year=...&set=...&q=...)
  useEffect(() => {
    if (window.location.pathname !== '/viewer') return;
    const params   = new URLSearchParams(window.location.search);
    const yearKey  = params.get('year');
    const setId    = params.get('set');
    const qId      = params.get('q');
    const modeParam = params.get('mode');
    if (!yearKey) return;
    setInitialSetId(setId ?? null);
    setInitialQId(qId ?? null);
    setMode(modeParam === MODE.STUDY ? MODE.STUDY : MODE.VIEW);
    loadYear(yearKey)
      .then(data => {
        setYearData(data);
        setSelectedYear(yearKey);
        setView('viewer');
        window.scrollTo({ top: 0 });
      })
      .catch(e => setError(`데이터 로드 실패: ${e.message}`));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 연도 메타정보 (헤더 표시용)
  const yearMeta = YEAR_INFO.find(y => y.key === selectedYear) ?? null;

  // 연도 선택 → 데이터 로드 → 뷰어 진입
  async function handleSelectYear(yearKey, selectedMode = MODE.VIEW) {
    setLoading(true);
    setError(null);
    try {
      const data = await loadYear(yearKey);
      setYearData(data);
      setSelectedYear(yearKey);
      setInitialSetId(null);
      setInitialQId(null);
      setMode(selectedMode);
      setView('viewer');
      window.history.pushState({}, '', `/viewer?year=${encodeURIComponent(yearKey)}&mode=${selectedMode}`);
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
    window.history.pushState({}, '', '/');
    window.scrollTo({ top: 0 });
  }

  // 로그아웃
  async function handleLogout() {
    await supabase.auth.signOut();
    sessionStorage.clear();
    setUser(null);
    setView('main');
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
        onWrongNote={() => setView('wrongnote')}
        onReport={() => setView('report')}
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
          <>
            <Banner
              bannerId="how-to-use-v1"
              message="💡 시험지를 먼저 풀고 오세요 — 답을 입력하면 지문 근거와 해설이 표시됩니다"
              type="info"
            />
            <ViewerPage
              yearKey={selectedYear}
              yearData={yearData}
              user={user}
              initialSetId={initialSetId}
              initialQId={initialQId}
              mode={mode}
              onBack={handleBack}
            />
          </>
        ) : view === 'report' ? (
          <PatternReport user={user} />
        ) : view === 'wrongnote' ? (
          <WrongNote
            user={user}
            allData={allData}
            onGoToQuestion={(yearKey, setId, questionId) => {
              setSelectedYear(yearKey);
              setView('viewer');
              // setId, questionId로 해당 문제로 이동하는 로직은 추후 구현
            }}
          />
        ) : view === 'payment' ? (
          <Payment
            user={user}
            onSuccess={() => {
              setIsPro(true);
              setView('main');
            }}
          />
        ) : !user && view === 'main' ? (
          <Landing onStart={() => setView('auth')} />
        ) : (
          <MainPage onSelectYear={handleSelectYear} isPro={isPro} onSubscribe={() => setView('payment')} user={user} onNeedAuth={() => setView('auth')} />
        )
      )}
    </>
  );
}