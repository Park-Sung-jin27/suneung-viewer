import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { P, YEAR_INFO } from './constants';

const COLORS = {
  beige: '#f9f5ed',
  beigeDark: '#e8e0d0',
  green: '#2d6e2d',
  greenLight: '#f2f7f2',
  greenBorder: '#7aad7a',
  text: '#1a1a14',
  textLight: '#6b7280',
  wrong: '#c0392b',
  wrongBg: '#fdf5f5',
};

function findSetTitle(allData, setId) {
  if (!allData) return setId;
  for (const yearData of Object.values(allData)) {
    for (const sec of ['reading', 'literature']) {
      const found = (yearData[sec] || []).find(s => s.id === setId);
      if (found) return found.title || found.id;
    }
  }
  return setId;
}

function isReviewDue(nextReview) {
  if (!nextReview) return false;
  return new Date(nextReview) <= new Date();
}

function PatternBadge({ pat }) {
  if (pat == null || !P[pat]) return null;
  const p = P[pat];
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: '700',
      color: p.color, background: p.bg,
      border: `1px solid ${p.color}55`,
      borderRadius: '4px', padding: '1px 6px',
      whiteSpace: 'nowrap',
    }}>
      {pat} {p.name}
    </span>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: '20px',
      border: active ? `1.5px solid ${COLORS.green}` : `1px solid ${COLORS.greenBorder}`,
      background: active ? COLORS.green : COLORS.greenLight,
      color: active ? '#fff' : COLORS.green,
      fontSize: '0.78rem', fontWeight: active ? '700' : '500',
      cursor: 'pointer', whiteSpace: 'nowrap',
      transition: 'all 0.15s',
    }}>
      {label}
    </button>
  );
}

export default function WrongNote({ user, allData, onGoToQuestion }) {
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState('all');
  const [patFilter, setPatFilter] = useState('all');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_answers')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_correct', false)
        .order('answered_at', { ascending: false });
      if (error) {
        console.warn('[WrongNote] 조회 실패:', error.message);
        setAnswers([]);
      } else {
        setAnswers(data || []);
      }
      setLoading(false);
    })();
  }, [user]);

  const filtered = answers.filter(a => {
    if (yearFilter !== 'all' && a.year_key !== yearFilter) return false;
    if (patFilter !== 'all' && String(a.pat) !== patFilter) return false;
    return true;
  });

  const yearKeys = [...new Set(answers.map(a => a.year_key))];
  const patKeys = [...new Set(answers.map(a => a.pat).filter(p => p != null))].sort();

  if (!user) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: COLORS.textLight }}>
        <p style={{ fontSize: '0.9rem' }}>로그인 후 오답 노트를 확인할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: COLORS.beige,
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 헤더 */}
      <div style={{
        padding: '32px 24px 20px', background: '#fff',
        borderBottom: `2px solid ${COLORS.greenBorder}`,
      }}>
        <h2 style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: '1.3rem', fontWeight: '700',
          color: COLORS.green, margin: '0 0 6px',
        }}>
          오답 노트
        </h2>
        <p style={{ fontSize: '0.82rem', color: COLORS.textLight, margin: 0 }}>
          틀린 문제를 다시 풀어보세요
        </p>
      </div>

      {/* 필터 */}
      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <FilterChip label="전체" active={yearFilter === 'all'} onClick={() => setYearFilter('all')} />
          {yearKeys.map(yk => {
            const meta = YEAR_INFO.find(y => y.key === yk);
            return (
              <FilterChip key={yk} label={meta?.label ?? yk} active={yearFilter === yk} onClick={() => setYearFilter(yk)} />
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <FilterChip label="전체 패턴" active={patFilter === 'all'} onClick={() => setPatFilter('all')} />
          {patKeys.map(pk => (
            <FilterChip key={pk} label={`${pk} ${P[pk]?.name ?? ''}`} active={patFilter === String(pk)} onClick={() => setPatFilter(String(pk))} />
          ))}
        </div>
      </div>

      {/* 컨텐츠 */}
      <div style={{ padding: '0 20px 40px', maxWidth: '640px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              width: '32px', height: '32px', margin: '0 auto 12px',
              border: `3px solid ${COLORS.beigeDark}`,
              borderTop: `3px solid ${COLORS.green}`,
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
            <span style={{ fontSize: '0.85rem', color: COLORS.textLight }}>불러오는 중...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            background: '#fff', borderRadius: '14px',
            border: `1px solid ${COLORS.beigeDark}`, marginTop: '14px',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎉</div>
            <p style={{ fontSize: '0.9rem', color: COLORS.textLight, margin: 0 }}>
              {answers.length === 0 ? '아직 틀린 문제가 없습니다' : '필터 조건에 맞는 오답이 없습니다'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
            <div style={{ fontSize: '0.75rem', color: COLORS.textLight, padding: '0 2px' }}>
              {filtered.length}개 오답
            </div>

            {filtered.map(a => {
              const meta = YEAR_INFO.find(y => y.key === a.year_key);
              const setTitle = findSetTitle(allData, a.set_id);
              const reviewDue = isReviewDue(a.next_review);

              return (
                <button
                  key={a.id}
                  onClick={() => onGoToQuestion?.(a.year_key, a.set_id, a.question_id)}
                  style={{
                    background: reviewDue ? COLORS.wrongBg : '#fff',
                    border: `1px solid ${reviewDue ? COLORS.wrong + '44' : COLORS.beigeDark}`,
                    borderLeft: `4px solid ${COLORS.wrong}`,
                    borderRadius: '12px', padding: '14px 16px',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                  }}
                >
                  {/* 상단: 연도 + 날짜 + 복습 뱃지 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {meta && (
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: meta.color, flexShrink: 0,
                      }} />
                    )}
                    <span style={{ fontSize: '0.78rem', fontWeight: '600', color: COLORS.text }}>
                      {meta?.label ?? a.year_key}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: COLORS.textLight, marginLeft: 'auto' }}>
                      {new Date(a.answered_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                    {reviewDue && (
                      <span style={{
                        fontSize: '0.68rem', fontWeight: '700',
                        color: '#fff', background: '#e67e22',
                        borderRadius: '4px', padding: '1px 6px',
                        whiteSpace: 'nowrap',
                      }}>
                        복습 필요
                      </span>
                    )}
                  </div>

                  {/* 중단: 세트 제목 */}
                  <div style={{ fontSize: '0.88rem', fontWeight: '600', color: COLORS.text }}>
                    {setTitle}
                  </div>

                  {/* 하단: 문항번호 + 선택 선지 + 패턴 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: COLORS.wrong }}>
                      {a.question_id}번 문항
                    </span>
                    <span style={{ fontSize: '0.78rem', color: COLORS.textLight }}>
                      선택: {a.choice_num}번
                    </span>
                    {a.pat != null && <PatternBadge pat={a.pat} />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
