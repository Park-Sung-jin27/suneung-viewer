import { P, P0 } from './constants';

const SECTION_LABELS = { reading: '독서', literature: '문학' };
const READING_PATS  = ['R1', 'R2', 'R3', 'R4'];
const LIT_PATS      = ['L1', 'L2', 'L3', 'L4', 'L5'];

function isCorrect(q, choiceNum) {
  const choice = q.choices.find(c => c.num === choiceNum);
  if (!choice) return false;
  return q.questionType === 'positive' ? choice.ok === true : choice.ok === false;
}

export default function ResultPage({ user, yearKey, yearLabel, studyAnswers, allSets, onReview, onBack }) {
  // ── 집계 ──────────────────────────────────────────────────
  let totalQ = 0, correctQ = 0;
  const wrongItems = []; // { setId, qid, choiceNum, pat }

  for (const s of allSets) {
    for (const q of (s.questions ?? [])) {
      totalQ++;
      const choiceNum = studyAnswers[s.id]?.[q.id];
      if (choiceNum == null) continue;
      if (isCorrect(q, choiceNum)) {
        correctQ++;
      } else {
        const choice = q.choices.find(c => c.num === choiceNum);
        wrongItems.push({ setId: s.id, qid: q.id, choiceNum, pat: choice?.pat ?? null });
      }
    }
  }
  const rate = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;

  // 패턴 집계
  const patCounts = {};
  let unclassified = 0;
  for (const { pat } of wrongItems) {
    if (pat) patCounts[pat] = (patCounts[pat] || 0) + 1;
    else unclassified++;
  }
  const topPat = Object.entries(patCounts).sort(([, a], [, b]) => b - a)[0];

  // 첫 번째 오답
  const firstWrong = wrongItems[0] ?? null;

  // 섹션 분리
  const readingSets  = allSets.filter(s => s._sec === 'reading');
  const litSets      = allSets.filter(s => s._sec === 'literature');

  // ── 렌더 헬퍼 ─────────────────────────────────────────────
  function SetBlock({ set }) {
    return (
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
          {set.range && <span style={{ color: '#9ca3af', marginRight: '6px' }}>{set.range}</span>}
          {set.title}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
          {(set.questions ?? []).map(q => {
            const choiceNum = studyAnswers[set.id]?.[q.id];
            const correct   = choiceNum != null && isCorrect(q, choiceNum);
            const unanswered = choiceNum == null;
            return (
              <button
                key={q.id}
                onClick={() => onReview(set.id, q.id)}
                title={unanswered ? '미답변' : correct ? '정답' : `오답 (내가 고른 선지: ${choiceNum}번)`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '5px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700',
                  cursor: 'pointer', border: 'none',
                  background: unanswered ? '#f3f4f6' : correct ? '#dcfce7' : '#fee2e2',
                  color:      unanswered ? '#9ca3af' : correct ? '#15803d' : '#dc2626',
                }}
              >
                <span style={{
                  width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                  background: unanswered ? '#d1d5db' : correct ? '#16a34a' : '#ef4444',
                  display: 'inline-block',
                }} />
                {q.id}번
                {!correct && !unanswered && (
                  <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>({choiceNum})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function PatBar({ keys, title, showUnclassified }) {
    const total = keys.reduce((s, k) => s + (patCounts[k] || 0), 0);
    const displayTotal = total + (showUnclassified ? unclassified : 0);
    if (displayTotal === 0) return (
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#9ca3af', marginBottom: '6px' }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: '#d1d5db' }}>오답 없음</div>
      </div>
    );
    return (
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {keys.map(k => {
            const n   = patCounts[k] || 0;
            const pct = displayTotal > 0 ? Math.round((n / displayTotal) * 100) : 0;
            const p   = P[k];
            const isTop = topPat && topPat[0] === k;
            return (
              <div key={k} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px', borderRadius: '6px',
                background: n > 0 ? p.bg : '#f9fafb',
                outline: isTop ? `2px solid ${p.color}` : 'none',
                opacity: n === 0 ? 0.45 : 1,
              }}>
                <span style={{ fontWeight: '800', color: n > 0 ? p.color : '#9ca3af', minWidth: '28px', fontSize: '0.73rem' }}>{k}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: n > 0 ? '#374151' : '#9ca3af' }}>{p.name}</div>
                  {n > 0 && (
                    <div style={{ marginTop: '2px', height: '5px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: p.color, borderRadius: '3px' }} />
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: n > 0 ? p.color : '#d1d5db', minWidth: '28px', textAlign: 'right' }}>
                  {n > 0 ? `${n}건` : '0'}
                </span>
              </div>
            );
          })}
        </div>
        {/* 미분류 행 — pat:null 오답 */}
        {showUnclassified && unclassified > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 10px', borderRadius: '6px',
            background: '#f3f4f6', marginTop: '4px',
          }}>
            <span style={{ fontWeight: '800', color: '#9ca3af', minWidth: '28px', fontSize: '0.73rem' }}>미분류</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>패턴 미지정 오답</div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#9ca3af', minWidth: '28px', textAlign: 'right' }}>
              {unclassified}건
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── JSX ───────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '28px 16px 60px' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* 제목 */}
        <div>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontWeight: '600', marginBottom: '4px' }}>
            {yearLabel} 채점 결과
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#111827' }}>풀이 완료</div>
        </div>

        {/* 1. 요약 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { label: '총 문항', value: `${totalQ}개` },
            { label: '정답',    value: `${correctQ}개`, color: '#16a34a' },
            { label: '정답률',  value: `${rate}%`,
              color: rate >= 80 ? '#16a34a' : rate >= 50 ? '#ca8a04' : '#dc2626' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
              padding: '16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600', marginBottom: '6px' }}>{label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: color ?? '#111827' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* 2. 섹션별 결과 */}
        {[{ label: SECTION_LABELS.reading, sets: readingSets }, { label: SECTION_LABELS.literature, sets: litSets }]
          .filter(({ sets }) => sets.length > 0)
          .map(({ label, sets }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#111827', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f3f4f6' }}>
                {label}
              </div>
              {sets.map(s => <SetBlock key={s.id} set={s} />)}
            </div>
          ))}

        {/* 3. 오답 패턴 요약 */}
        {wrongItems.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#111827', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f3f4f6' }}>
              오답 패턴 분석
            </div>
            {topPat && P[topPat[0]] && (
              <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: '8px', fontSize: '0.8rem', color: '#92400e', lineHeight: '1.5' }}>
                <strong>{topPat[0]} {P[topPat[0]].name}</strong>이 {topPat[1]}건으로 가장 많습니다. {P[topPat[0]].desc}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <PatBar keys={READING_PATS} title="독서 오답 패턴" showUnclassified />
              <PatBar keys={LIT_PATS}     title="문학 오답 패턴" showUnclassified />
            </div>
          </div>
        )}

        {/* 4. 하단 버튼 */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onBack}
            style={{ padding: '11px 20px', borderRadius: '8px', background: '#fff', border: '1px solid #d1d5db', fontWeight: '700', fontSize: '0.88rem', color: '#374151', cursor: 'pointer' }}
          >
            메인으로
          </button>
          {firstWrong && (
            <button
              onClick={() => onReview(firstWrong.setId, firstWrong.qid)}
              style={{ padding: '11px 20px', borderRadius: '8px', background: '#1f2937', border: 'none', fontWeight: '700', fontSize: '0.88rem', color: '#fff', cursor: 'pointer' }}
            >
              오답 다시 보기
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
