// ============================================================
// PatternReport.jsx — 오답 패턴 리포트 + AI 코칭 + AI 패턴 훈련
// ============================================================

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { P, P0, YEAR_INFO } from './constants';
import PatternCoach from './PatternCoach';

const C = {
  green:  '#2d6e2d',
  soft:   '#3d8b3d',
  bg:     '#f0f7f0',
  line:   '#7aad7a',
  ink:    '#0d1a0e',
  inkMid: '#253226',
  muted:  '#5a6b5b',
  subtle: '#8a9b8b',
  paper:  '#faf8f4',
  white:  '#ffffff',
  border: '#e0dbd0',
};

const READING_PATS = ['R1', 'R2', 'R3', 'R4'];
const LIT_PATS     = ['L1', 'L2', 'L3', 'L4', 'L5'];

// ── 요약 카드 ────────────────────────────────────────────────
function SummaryCard({ label, value, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: C.white, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.45rem', fontWeight: '800', color: C.green, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: '5px', fontWeight: '500' }}>{label}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: C.line, marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

// ── 패턴 바 ──────────────────────────────────────────────────
function PatternBar({ patKey, count, maxCount, isTop, onCoach, onTrain }) {
  const info = P[patKey] ?? P0;
  const pct  = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: info.color, background: info.bg, border: `1px solid ${info.color}44`, borderRadius: '4px', padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>{patKey}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: C.ink, flex: 1 }}>{info.name}</span>
        {isTop && <span style={{ fontSize: '0.63rem', fontWeight: '700', color: '#fff', background: '#c0392b', borderRadius: '4px', padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>주요 약점</span>}
        <span style={{ fontSize: '0.75rem', color: C.muted, flexShrink: 0 }}>{count}회</span>
      </div>
      <div style={{ background: C.border, borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: info.color, borderRadius: '4px', transition: 'width 0.5s ease', minWidth: count > 0 ? '4px' : '0' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <div style={{ fontSize: '0.67rem', color: C.muted, flex: 1 }}>{info.desc}</div>
        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
          {/* 훈련하기 버튼 — 항상 표시 */}
          <button
            onClick={() => onTrain(patKey)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 10px',
              background: '#eff6ff', color: '#1d4ed8',
              border: '1px solid #93c5fd',
              borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700',
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            🎯 훈련
          </button>
          {/* AI 코칭 — 오답 1건 이상에만 */}
          {count > 0 && (
            <button
              onClick={() => onCoach(patKey)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 10px',
                background: isTop ? info.color : '#F9FAFB',
                color: isTop ? '#fff' : info.color,
                border: `1px solid ${info.color}66`,
                borderRadius: '5px', fontSize: '0.68rem', fontWeight: '700',
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              🤖 코칭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── YearBar ──────────────────────────────────────────────────
function YearBar({ yearKey, correct, total }) {
  const pct   = total > 0 ? Math.round((correct / total) * 100) : 0;
  const meta  = YEAR_INFO.find(y => y.key === yearKey);
  const color = meta?.color ?? C.green;
  function fmt(k) {
    if (k.includes('_')) { const [y, m] = k.split('_'); return y + '학년도 ' + m; }
    return k.replace('수능', '학년도 수능');
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: '600', color: C.ink }}>{fmt(yearKey)}</span>
        <span style={{ fontSize: '0.72rem', color: C.muted }}>{pct}% ({correct}/{total})</span>
      </div>
      <div style={{ background: C.border, borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ── 한 줄 총평 ───────────────────────────────────────────────
const COMMENTS = {
  R1: '수치·상태·방향을 뒤바꾼 함정에 자주 당합니다. 선지와 지문의 구체적 수치를 직접 대조하세요.',
  R2: '주체-객체, 원인-결과 관계를 전도한 함정에 취약합니다. 방향성을 체크하세요.',
  R3: '지문에 없는 내용을 추론한 함정에 취약합니다. 근거 없는 선지는 바로 제거하세요.',
  R4: '서로 다른 문단의 개념을 섞은 함정에 취약합니다. 각 선지 요소를 지문과 하나씩 대조하세요.',
  L1: '시어·이미지·수사법을 잘못 파악하는 경향이 있습니다. 문맥 속 표현 효과를 꼼꼼히 파악하세요.',
  L2: '화자·인물의 정서와 태도를 반대로 파악합니다. 전체 흐름 속에서 심리를 읽으세요.',
  L3: '작품에 없는 의미를 도출하는 함정에 취약합니다. 근거 없는 확대 해석을 경계하세요.',
  L4: '시점·구성·대비 구조를 잘못 설명하는 함정에 취약합니다. 구조를 먼저 파악하세요.',
  L5: '보기 조건을 작품에 잘못 대입하는 함정에 취약합니다. 보기 조건을 꼼꼼히 확인하세요.',
};

// ══════════════════════════════════════════════
// [AI 패턴 훈련 모달]
// ══════════════════════════════════════════════
async function fetchTrainingQuestion(patKey) {
  const info = P[patKey] ?? P0;
  const isLit = patKey.startsWith('L');

  const prompt = `너는 수능 국어 출제 전문가야. 아래 오답 패턴을 연습할 수 있는 문제를 만들어줘.

패턴: ${patKey} — ${info.name}
설명: ${info.desc}
영역: ${isLit ? '문학' : '독서'}

다음 JSON 형식으로만 응답해. 설명·마크다운·코드블록 없이 순수 JSON만:
{
  "passage": "${isLit ? '현대시 또는 고전시가 3~5행 (실제 평가원 출제 스타일, 시적 화자·이미지·정서 포함)' : '자연과학·사회·인문·예술 중 하나의 소재로 평가원 수준 3~4문장 독서 지문'}",
  "sentence": "지문을 바탕으로 한 판단 선지 (1문장, 수능 선지 스타일)",
  "isCorrect": true 또는 false,
  "evidenceSentence": "지문에서 근거가 되는 핵심 문장 (passage에서 그대로)",
  "explanation": "${patKey} 패턴 관점에서 왜 맞는지/틀린지 2~3문장 설명"
}

isCorrect가 false이면 반드시 ${patKey}(${info.name}) 오류를 담은 선지를 만들어.
isCorrect는 이번에 ${Math.random() > 0.5 ? 'true' : 'false'}로 설정해.`;

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`API 오류: ${res.status}`);
  const data = await res.json();
  const text = data.content?.map(b => b.text ?? '').join('') ?? '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function PatternTrainer({ patKey, onClose }) {
  const info = P[patKey] ?? P0;

  const [phase, setPhase]     = useState('loading'); // loading | question | result | error
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);   // 'O' | 'X'
  const [count, setCount]     = useState(0);
  const [correct, setCorrect] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadQuestion() {
    setPhase('loading');
    setSelected(null);
    try {
      const q = await fetchTrainingQuestion(patKey);
      setQuestion(q);
      setPhase('question');
    } catch (e) {
      setErrorMsg(e.message);
      setPhase('error');
    }
  }

  useEffect(() => { loadQuestion(); }, []); // eslint-disable-line

  function handleSelect(ans) {
    if (phase !== 'question') return;
    setSelected(ans);
    setPhase('result');
    setCount(c => c + 1);
    const isRight = (ans === 'O') === question.isCorrect;
    if (isRight) setCorrect(c => c + 1);
  }

  const isRight = selected !== null && (selected === 'O') === question?.isCorrect;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.white, borderRadius: '18px', padding: '28px 24px', maxWidth: '520px', width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: '800', color: info.color, background: info.bg, border: `1px solid ${info.color}44`, borderRadius: '6px', padding: '3px 9px' }}>{patKey}</span>
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: C.ink }}>{info.name} 훈련</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {count > 0 && (
              <span style={{ fontSize: '0.75rem', color: C.muted, fontWeight: '600' }}>
                {correct}/{count} 정답
              </span>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: C.subtle, padding: '2px' }}>✕</button>
          </div>
        </div>

        <div style={{ fontSize: '0.73rem', color: C.muted, marginBottom: '18px', padding: '8px 12px', background: C.bg, borderRadius: '8px', lineHeight: 1.6 }}>
          <strong style={{ color: C.green }}>훈련 방법:</strong> AI가 생성한 지문과 선지를 읽고, 선지가 지문 내용과 일치하면 <strong>O</strong>, 다르면 <strong>X</strong>를 선택하세요.
        </div>

        {/* 로딩 */}
        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ width: '36px', height: '36px', margin: '0 auto 14px', border: `3px solid ${C.border}`, borderTop: `3px solid ${C.green}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <div style={{ fontSize: '0.85rem', color: C.muted }}>평가원 스타일 문제 생성 중...</div>
            <div style={{ fontSize: '0.75rem', color: C.subtle, marginTop: '6px' }}>{patKey} 패턴 적용 중</div>
          </div>
        )}

        {/* 에러 */}
        {phase === 'error' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: '0.85rem', color: '#dc2626', marginBottom: '16px' }}>⚠️ {errorMsg}</div>
            <button onClick={loadQuestion} style={{ padding: '9px 22px', background: C.green, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>다시 시도</button>
          </div>
        )}

        {/* 문제 */}
        {(phase === 'question' || phase === 'result') && question && (
          <>
            {/* 지문 */}
            <div style={{ background: '#fdfcfa', border: `1px solid ${C.border}`, borderRadius: '10px', padding: '16px 14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: '700', color: C.subtle, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>지문</div>
              <p style={{
                fontSize: '0.85rem', lineHeight: '1.9', color: C.inkMid, margin: 0,
                whiteSpace: 'pre-wrap',
              }}>
                {phase === 'result' && question.evidenceSentence
                  ? question.passage.split(question.evidenceSentence).map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <mark style={{ background: 'rgba(34,197,94,0.25)', borderBottom: '2px solid #22c55e', borderRadius: '2px', padding: '0 1px' }}>
                          {question.evidenceSentence}
                        </mark>
                      )}
                    </span>
                  ))
                  : question.passage
                }
              </p>
            </div>

            {/* 선지 */}
            <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: '700', color: C.subtle, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>선지</div>
              <p style={{ fontSize: '0.88rem', lineHeight: '1.75', color: C.ink, margin: 0, fontWeight: '500' }}>
                {question.sentence}
              </p>
            </div>

            {/* O/X 선택 */}
            {phase === 'question' && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                {['O', 'X'].map(ans => (
                  <button
                    key={ans}
                    onClick={() => handleSelect(ans)}
                    style={{
                      flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
                      background: ans === 'O' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: ans === 'O' ? '#15803d' : '#dc2626',
                      fontSize: '1.3rem', fontWeight: '800', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {ans}
                    <div style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                      {ans === 'O' ? '일치' : '불일치'}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* 결과 */}
            {phase === 'result' && (
              <>
                <div style={{
                  padding: '16px', borderRadius: '12px', marginBottom: '14px',
                  background: isRight ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1.5px solid ${isRight ? '#22c55e' : '#ef4444'}`,
                }}>
                  <div style={{ fontSize: '1rem', fontWeight: '800', color: isRight ? '#15803d' : '#dc2626', marginBottom: '8px' }}>
                    {isRight ? '✅ 정답!' : '❌ 오답'}
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', marginLeft: '8px', color: C.muted }}>
                      정답: {question.isCorrect ? 'O (일치)' : 'X (불일치)'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: C.inkMid, lineHeight: '1.75', margin: 0 }}>
                    {question.explanation}
                  </p>
                </div>

                {/* 패턴 힌트 */}
                <div style={{ padding: '10px 14px', background: info.bg, borderRadius: '8px', marginBottom: '16px', fontSize: '0.75rem', color: info.color, lineHeight: 1.6 }}>
                  <strong>{patKey} {info.name}:</strong> {info.desc}
                </div>

                {/* 다음 문제 */}
                <button
                  onClick={loadQuestion}
                  style={{ width: '100%', padding: '13px', background: C.green, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', fontFamily: "'Noto Sans KR', sans-serif" }}
                >
                  다음 문제 →
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────
export default function PatternReport({ user, onGoToQuestion }) {
  const [stats, setStats]   = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCoachPat, setActiveCoachPat] = useState(null);
  const [activeTrainPat, setActiveTrainPat] = useState(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const [{ data: statsData }, { data: answersData }] = await Promise.all([
        supabase.from('user_stats').select('*').eq('user_id', user.id).single(),
        supabase.from('user_answers')
          .select('year_key, is_correct, pat, set_id, question_id, choice_num')
          .eq('user_id', user.id)
          .order('answered_at', { ascending: false })
          .limit(200),
      ]);
      if (statsData) setStats(statsData);
      if (answersData) setAnswers(answersData);
      setLoading(false);
    })();
  }, [user]);

  if (!user) return (
    <div style={{ minHeight: '100vh', background: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: '0.9rem', color: C.muted }}>로그인 후 패턴 리포트를 확인할 수 있습니다.</p>
    </div>
  );

  // 집계
  const totalAnswered = stats?.total_answered ?? 0;
  const totalCorrect  = stats?.total_correct  ?? 0;
  const streakDays    = stats?.streak_days    ?? 0;
  const accuracy      = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const patCounts = {};
  for (const a of answers) {
    if (!a.is_correct && a.pat) {
      patCounts[String(a.pat)] = (patCounts[String(a.pat)] ?? 0) + 1;
    }
  }
  const allPatKeys = [...READING_PATS, ...LIT_PATS];
  const maxCount   = Math.max(0, ...allPatKeys.map(k => patCounts[k] ?? 0));
  const topPat     = allPatKeys.length > 0
    ? allPatKeys.reduce((best, k) => (patCounts[k] ?? 0) > (patCounts[best] ?? 0) ? k : best, allPatKeys[0])
    : null;
  const hasTopPat  = topPat !== null && (patCounts[topPat] ?? 0) > 0;
  const p0Count    = patCounts['0'] ?? 0;

  const yearMap = {};
  for (const a of answers) {
    if (!yearMap[a.year_key]) yearMap[a.year_key] = { correct: 0, total: 0 };
    yearMap[a.year_key].total++;
    if (a.is_correct) yearMap[a.year_key].correct++;
  }
  const yearEntries = Object.entries(yearMap).sort((a, b) => {
    const ai = YEAR_INFO.findIndex(y => y.key === a[0]);
    const bi = YEAR_INFO.findIndex(y => y.key === b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const hasData = totalAnswered > 0 || answers.length > 0;

  function getComment(tp) {
    if (!tp) return '아직 분석할 데이터가 부족합니다. 더 많은 문제를 풀어보세요.';
    if (tp === '0') return 'P0(미분류)에 오답이 많습니다. 틀린 이유를 스스로 분석하고 패턴을 파악하세요.';
    const info = P[tp] ?? P0;
    return `${tp}(${info.name})에 가장 자주 당합니다. ${COMMENTS[tp] ?? ''}`;
  }

  const coachWrongAnswers = activeCoachPat
    ? answers.filter(a => !a.is_correct && String(a.pat) === activeCoachPat)
    : [];

  return (
    <div style={{ minHeight: '100vh', background: C.paper, fontFamily: "'Noto Sans KR', sans-serif", color: C.ink }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pattern-split { display: flex; gap: 20px; }
        .pattern-split > * { flex: 1; min-width: 0; }
        @media (max-width: 768px) { .pattern-split { flex-direction: column; } }
      `}</style>

      {/* 헤더 */}
      <div style={{ padding: '32px 24px 20px', background: C.white, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'inline-block', fontSize: '0.62rem', fontWeight: '700', color: C.green, background: C.bg, border: `1px solid ${C.line}35`, borderRadius: '100px', padding: '3px 12px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
          내 분석
        </div>
        <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: '1.4rem', fontWeight: '700', color: C.ink, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          오답 패턴 리포트
        </h2>
        <p style={{ fontSize: '0.82rem', color: C.muted, margin: 0 }}>
          취약 패턴을 진단하고, 🎯 훈련으로 바로 교정하세요
        </p>
      </div>

      <div style={{ padding: '20px', maxWidth: '680px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '32px', height: '32px', margin: '0 auto 12px', border: `3px solid ${C.border}`, borderTop: `3px solid ${C.green}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: '0.85rem', color: C.muted }}>분석 중...</span>
          </div>
        ) : !hasData ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: C.white, borderRadius: '14px', border: `1px solid ${C.border}`, marginTop: '8px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📊</div>
            <p style={{ fontSize: '0.9rem', color: C.muted, margin: '0 0 8px' }}>아직 풀이 기록이 없습니다</p>
            <p style={{ fontSize: '0.8rem', color: C.subtle, margin: '0 0 20px' }}>문제를 풀면 패턴 분석이 시작됩니다</p>
            <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '10px', fontSize: '0.78rem', color: '#1d4ed8', lineHeight: 1.7 }}>
              💡 기출을 풀지 않아도 <strong>🎯 훈련</strong> 버튼으로 AI 패턴 훈련을 바로 시작할 수 있어요
            </div>
          </div>
        ) : (
          <>
            {/* 요약 카드 */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <SummaryCard label="총 풀이 문항" value={totalAnswered.toLocaleString()} sub="문항" />
              <SummaryCard label="정답률" value={`${accuracy}%`} sub={`${totalCorrect}/${totalAnswered}`} />
              <SummaryCard label="연속 학습일" value={streakDays} sub="일 연속" />
            </div>

            {/* 훈련 안내 배너 */}
            <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '10px', marginBottom: '16px', fontSize: '0.78rem', color: '#1d4ed8', lineHeight: 1.7 }}>
              🎯 <strong>AI 패턴 훈련</strong> — 각 패턴 옆 훈련 버튼을 누르면 평가원 스타일 지문으로 해당 패턴을 집중 연습할 수 있습니다
            </div>
          </>
        )}

        {/* 패턴 바 — 데이터 유무 관계없이 항상 표시 (훈련 가능) */}
        {!loading && (
          <>
            <div className="pattern-split" style={{ marginBottom: '12px' }}>
              {/* 독서 */}
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '18px 16px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: C.green, margin: '0 0 16px' }}>독서 오답 패턴</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {READING_PATS.map(pk => (
                    <PatternBar key={pk} patKey={pk} count={patCounts[pk] ?? 0} maxCount={maxCount}
                      isTop={hasTopPat && topPat === pk}
                      onCoach={setActiveCoachPat} onTrain={setActiveTrainPat} />
                  ))}
                </div>
              </div>
              {/* 문학 */}
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '18px 16px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: C.green, margin: '0 0 16px' }}>문학 오답 패턴</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {LIT_PATS.map(pk => (
                    <PatternBar key={pk} patKey={pk} count={patCounts[pk] ?? 0} maxCount={maxCount}
                      isTop={hasTopPat && topPat === pk}
                      onCoach={setActiveCoachPat} onTrain={setActiveTrainPat} />
                  ))}
                </div>
              </div>
            </div>

            {/* P0 미분류 */}
            {p0Count > 0 && (
              <div style={{ background: C.white, border: `1px dashed ${C.border}`, borderRadius: '14px', padding: '14px 16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: P0.color, background: P0.bg, border: `1px solid ${P0.color}44`, borderRadius: '4px', padding: '1px 7px' }}>P0</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '600', color: C.ink, flex: 1 }}>{P0.name}</span>
                  <span style={{ fontSize: '0.63rem', fontWeight: '700', color: '#fff', background: '#888', borderRadius: '4px', padding: '1px 6px' }}>검토 필요</span>
                  <span style={{ fontSize: '0.75rem', color: C.muted }}>{p0Count}회</span>
                </div>
                <div style={{ fontSize: '0.67rem', color: C.muted, marginTop: '6px' }}>{P0.desc}</div>
              </div>
            )}

            {/* 시험별 정답률 */}
            {yearEntries.length > 0 && (
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '18px 16px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: C.green, margin: '0 0 16px' }}>시험별 정답률</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {yearEntries.map(([yk, d]) => <YearBar key={yk} yearKey={yk} correct={d.correct} total={d.total} />)}
                </div>
              </div>
            )}

            {/* 한 줄 총평 */}
            {hasData && (
              <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: '14px', padding: '16px 18px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>💡</span>
                <p style={{ fontSize: '0.85rem', color: C.ink, lineHeight: '1.75', margin: 0 }}>
                  {getComment(hasTopPat ? topPat : null)}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* PatternCoach 모달 */}
      {activeCoachPat && (
        <PatternCoach
          patKey={activeCoachPat}
          wrongAnswers={coachWrongAnswers}
          onClose={() => setActiveCoachPat(null)}
          onGoToQuestion={onGoToQuestion}
        />
      )}

      {/* PatternTrainer 모달 */}
      {activeTrainPat && (
        <PatternTrainer
          patKey={activeTrainPat}
          onClose={() => setActiveTrainPat(null)}
        />
      )}
    </div>
  );
}
