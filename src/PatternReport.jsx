// ============================================================
// PatternReport.jsx — 오답 패턴 리포트 + AI 코칭 연동
// constants.js P 정의 기준 (R1~R4 독서, L1~L5 문학, P0 미분류)
// ============================================================

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { P, P0, YEAR_INFO } from './constants';
import PatternCoach from './PatternCoach';

const C = {
  bg:    '#f9f5ed',
  green: '#2d6e2d',
  gl:    '#f2f7f2',
  gb:    '#7aad7a',
  beige: '#e8e0d0',
  ink:   '#1a1a14',
  muted: '#6b7280',
};

const READING_PATS = ['R1', 'R2', 'R3', 'R4'];
const LIT_PATS     = ['L1', 'L2', 'L3', 'L4', 'L5'];

// ── 요약 카드 ────────────────────────────────────────────────
function SummaryCard({ label, value, sub }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: '#fff',
      border: `1px solid ${C.beige}`,
      borderRadius: '12px',
      padding: '16px 12px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '1.45rem', fontWeight: '800',
        color: C.green, letterSpacing: '-0.03em',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.7rem', color: C.muted, marginTop: '5px', fontWeight: '500' }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: '0.65rem', color: C.gb, marginTop: '2px' }}>{sub}</div>
      )}
    </div>
  );
}

// ── 패턴 바 ──────────────────────────────────────────────────
function PatternBar({ patKey, count, maxCount, isTop, onCoach }) {
  const info = P[patKey] ?? P0;
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontSize: '0.7rem', fontWeight: '700',
          color: info.color, background: info.bg,
          border: `1px solid ${info.color}44`,
          borderRadius: '4px', padding: '1px 7px',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {patKey}
        </span>
        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: C.ink, flex: 1 }}>
          {info.name}
        </span>
        {isTop && (
          <span style={{
            fontSize: '0.63rem', fontWeight: '700',
            color: '#fff', background: '#c0392b',
            borderRadius: '4px', padding: '1px 6px',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            주요 약점
          </span>
        )}
        <span style={{ fontSize: '0.75rem', color: C.muted, flexShrink: 0 }}>
          {count}회
        </span>
      </div>
      <div style={{ background: C.beige, borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: info.color, borderRadius: '4px',
          transition: 'width 0.5s ease',
          minWidth: count > 0 ? '4px' : '0',
        }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.67rem', color: C.muted }}>
          {info.desc}
        </div>
        {/* AI 코칭 버튼 — 오답이 1건 이상인 패턴에만 표시 */}
        {count > 0 && (
          <button
            onClick={() => onCoach(patKey)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 10px',
              background: isTop ? info.color : '#F9FAFB',
              color: isTop ? '#fff' : info.color,
              border: `1px solid ${info.color}66`,
              borderRadius: '5px',
              fontSize: '0.68rem', fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            🤖 AI 코칭
          </button>
        )}
      </div>
    </div>
  );
}

function formatYearKey(key) {
  if (key.includes('_')) {
    const [year, month] = key.split('_');
    return year + '학년도 ' + month;
  }
  return key.replace('수능', '학년도 수능');
}

// ── 시험별 정답률 바 ──────────────────────────────────────────
function YearBar({ yearKey, correct, total }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const meta = YEAR_INFO.find(y => y.key === yearKey);
  const color = meta?.color ?? C.green;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: '600', color: C.ink }}>
          {formatYearKey(yearKey)}
        </span>
        <span style={{ fontSize: '0.72rem', color: C.muted }}>
          {pct}% ({correct}/{total})
        </span>
      </div>
      <div style={{ background: C.beige, borderRadius: '4px', height: '10px', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color, borderRadius: '4px',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

// ── 한 줄 총평 ───────────────────────────────────────────────
const COMMENTS = {
  R1: '수치·상태·방향을 뒤바꾼 함정에 자주 당합니다. 선지와 지문의 구체적 수치·방향을 직접 대조하세요.',
  R2: '주체-객체, 원인-결과 관계를 전도한 함정에 취약합니다. 선지를 읽을 때 방향성을 체크하세요.',
  R3: '지문에 없는 내용을 추론한 함정에 취약합니다. 근거 없는 선지는 바로 제거하는 연습이 필요합니다.',
  R4: '서로 다른 문단의 개념을 섞은 함정에 취약합니다. 각 선지의 요소를 하나씩 지문과 대조하세요.',
  L1: '시어·이미지·수사법을 잘못 파악하는 경향이 있습니다. 문맥 속 표현 효과를 꼼꼼히 파악하세요.',
  L2: '화자·인물의 정서와 태도를 반대로 파악합니다. 전체 흐름 속에서 심리를 읽는 연습이 필요합니다.',
  L3: '작품에 없는 의미를 도출하는 함정에 취약합니다. 근거 없는 확대 해석을 경계하세요.',
  L4: '시점·구성·대비 구조를 잘못 설명하는 함정에 취약합니다. 글의 구조를 먼저 파악한 후 선지를 검토하세요.',
  L5: '보기 조건을 작품에 잘못 대입하는 함정에 취약합니다. 보기 조건 하나하나를 꼼꼼히 확인하세요.',
};

function getComment(topPat) {
  if (topPat === null) return '아직 분석할 데이터가 부족합니다. 더 많은 문제를 풀어보세요.';
  if (topPat === '0') return 'P0(미분류)에 오답이 많습니다. 틀린 이유를 스스로 분석하고 패턴을 파악하세요.';
  const info = P[topPat] ?? P0;
  return `${topPat}(${info.name})에 가장 자주 당합니다. ${COMMENTS[topPat] ?? ''}`;
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function PatternReport({ user, onGoToQuestion }) {
  const [stats, setStats]           = useState(null);
  const [answers, setAnswers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  // 코치 모달 상태
  const [activeCoachPat, setActiveCoachPat] = useState(null); // 'R2', 'L3' 등

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const [{ data: statsData }, { data: answersData }] = await Promise.all([
        supabase.from('user_stats').select('*').eq('user_id', user.id).single(),
        supabase.from('user_answers')
          // question_key, choice_num 추가 — PatternCoach에서 오답 세부 데이터 조회용
          // ※ user_answers 테이블에 해당 컬럼이 없으면 select에서 제거 (코칭은 계속 동작, 오답 세부 분석만 생략됨)
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

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '0.9rem', color: C.muted }}>로그인 후 패턴 리포트를 확인할 수 있습니다.</p>
      </div>
    );
  }

  // ── 집계 ────────────────────────────────────────────────────
  const totalAnswered = stats?.total_answered ?? 0;
  const totalCorrect  = stats?.total_correct  ?? 0;
  const accuracy      = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const streakDays    = stats?.streak_days ?? 0;

  const patCounts = {};
  for (const a of answers) {
    if (!a.is_correct && a.pat != null) {
      const key = String(a.pat);
      patCounts[key] = (patCounts[key] ?? 0) + 1;
    }
  }

  const allPatKeys = [...READING_PATS, ...LIT_PATS];
  const maxCount = Math.max(...allPatKeys.map(k => patCounts[k] ?? 0), 1);

  const topPat = allPatKeys.length > 0
    ? allPatKeys.reduce((best, k) => (patCounts[k] ?? 0) > (patCounts[best] ?? 0) ? k : best, allPatKeys[0])
    : null;
  const hasTopPat = topPat !== null && (patCounts[topPat] ?? 0) > 0;

  const p0Count = patCounts['0'] ?? 0;

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

  // 코칭 모달용: 해당 패턴의 오답만 필터
  const coachWrongAnswers = activeCoachPat
    ? answers.filter(a => !a.is_correct && String(a.pat) === activeCoachPat)
    : [];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Noto Sans KR', sans-serif", color: C.ink }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .pattern-split { display: flex; gap: 24px; }
        .pattern-split > * { flex: 1; min-width: 0; }
        @media (max-width: 768px) { .pattern-split { flex-direction: column; } }
      `}</style>

      {/* 헤더 */}
      <div style={{
        padding: '32px 24px 20px', background: '#fff',
        borderBottom: `2px solid ${C.gb}`,
      }}>
        <h2 style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: '1.3rem', fontWeight: '700',
          color: C.green, margin: '0 0 6px',
        }}>
          오답 패턴 리포트
        </h2>
        <p style={{ fontSize: '0.82rem', color: C.muted, margin: 0 }}>
          내 취약 패턴을 AI가 직접 분석해 맞춤 코칭을 제공합니다
        </p>
      </div>

      <div style={{ padding: '20px', maxWidth: '640px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{
              width: '32px', height: '32px', margin: '0 auto 12px',
              border: `3px solid ${C.beige}`,
              borderTop: `3px solid ${C.green}`,
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
            <span style={{ fontSize: '0.85rem', color: C.muted }}>분석 중...</span>
          </div>
        ) : !hasData ? (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: '#fff', borderRadius: '14px',
            border: `1px solid ${C.beige}`, marginTop: '8px',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📊</div>
            <p style={{ fontSize: '0.9rem', color: C.muted, margin: 0 }}>
              아직 풀이 기록이 없습니다
            </p>
            <p style={{ fontSize: '0.8rem', color: C.gb, marginTop: '6px' }}>
              문제를 풀면 패턴 분석이 시작됩니다
            </p>
          </div>
        ) : (
          <>
            {/* 1. 요약 카드 */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <SummaryCard label="총 풀이 문항" value={totalAnswered.toLocaleString()} sub="문항" />
              <SummaryCard label="정답률" value={`${accuracy}%`} sub={`${totalCorrect}/${totalAnswered}`} />
              <SummaryCard label="연속 학습일" value={streakDays} sub="일 연속" />
            </div>

            {/* 2. 독서 / 문학 패턴 (좌우 분할) */}
            <div className="pattern-split" style={{ marginBottom: '12px' }}>
              {/* 독서 */}
              <div style={{
                background: '#fff', border: `1px solid ${C.beige}`,
                borderRadius: '14px', padding: '18px 16px',
              }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: C.green, margin: '0 0 16px' }}>
                  독서 오답 패턴
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {READING_PATS.map(pk => (
                    <PatternBar
                      key={pk}
                      patKey={pk}
                      count={patCounts[pk] ?? 0}
                      maxCount={maxCount}
                      isTop={hasTopPat && topPat === pk}
                      onCoach={setActiveCoachPat}
                    />
                  ))}
                </div>
              </div>

              {/* 문학 */}
              <div style={{
                background: '#fff', border: `1px solid ${C.beige}`,
                borderRadius: '14px', padding: '18px 16px',
              }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: C.green, margin: '0 0 16px' }}>
                  문학 오답 패턴
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {LIT_PATS.map(pk => (
                    <PatternBar
                      key={pk}
                      patKey={pk}
                      count={patCounts[pk] ?? 0}
                      maxCount={maxCount}
                      isTop={hasTopPat && topPat === pk}
                      onCoach={setActiveCoachPat}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 3. 미분류 (P0) */}
            {p0Count > 0 && (
              <div style={{
                background: '#fff', border: `1px dashed ${C.beige}`,
                borderRadius: '14px', padding: '14px 16px',
                marginBottom: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: '700',
                    color: P0.color, background: P0.bg,
                    border: `1px solid ${P0.color}44`,
                    borderRadius: '4px', padding: '1px 7px',
                  }}>
                    P0
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '600', color: C.ink, flex: 1 }}>
                    {P0.name}
                  </span>
                  <span style={{
                    fontSize: '0.63rem', fontWeight: '700',
                    color: '#fff', background: '#888',
                    borderRadius: '4px', padding: '1px 6px',
                  }}>
                    검토 필요
                  </span>
                  <span style={{ fontSize: '0.75rem', color: C.muted }}>{p0Count}회</span>
                </div>
                <div style={{ fontSize: '0.67rem', color: C.muted, marginTop: '6px' }}>
                  {P0.desc}
                </div>
              </div>
            )}

            {/* 4. 시험별 정답률 */}
            {yearEntries.length > 0 && (
              <div style={{
                background: '#fff', border: `1px solid ${C.beige}`,
                borderRadius: '14px', padding: '18px 16px',
                marginBottom: '12px',
              }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: C.green, margin: '0 0 16px' }}>
                  시험별 정답률
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {yearEntries.map(([yk, d]) => (
                    <YearBar key={yk} yearKey={yk} correct={d.correct} total={d.total} />
                  ))}
                </div>
              </div>
            )}

            {/* 5. 한 줄 총평 */}
            <div style={{
              background: C.gl, border: `1px solid ${C.gb}`,
              borderRadius: '14px', padding: '16px 18px',
              display: 'flex', gap: '10px', alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>💡</span>
              <p style={{ fontSize: '0.85rem', color: C.ink, lineHeight: '1.75', margin: 0 }}>
                {getComment(hasTopPat ? topPat : null)}
              </p>
            </div>
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
    </div>
  );
}
