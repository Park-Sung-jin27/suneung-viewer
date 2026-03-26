import { useState } from 'react';
import { P, CC } from './constants';
import { BogiTable } from './BogiTable';

// ── 오답 패턴 뱃지 ────────────────────────────────────────
function PatternBadge({ pat }) {
  if (!pat || !P[pat]) return null;
  const p = P[pat];
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: '700',
      color: p.color, background: p.bg,
      border: `1px solid ${p.color}55`,
      borderRadius: '4px', padding: '1px 6px',
      marginLeft: '7px', verticalAlign: 'middle',
      whiteSpace: 'nowrap',
    }}>
      P{pat} {p.name}
    </span>
  );
}

// ── 선지 아이템 ───────────────────────────────────────────
// ok === false → 정답 (지문과 일치하지 않음)
// ok === true  → 오답
function ChoiceItem({ choice, qid, clicked, onSelect }) {
  const uid = `q${qid}_c${choice.num}`;
  const isMe = clicked === uid;
  const isCorrect = choice.ok === false;

  // 색상 결정
  let bg = '#ffffff', border = '1px solid #e5e7eb', tc = '#1f2937';
  let numBg = '#f3f4f6', numColor = CC[choice.num]?.text ?? '#374151';

  if (isMe) {
    if (isCorrect) {
      bg = '#ecfdf5'; border = '2px solid #10b981';
      tc = '#065f46'; numBg = '#10b981'; numColor = '#fff';
    } else {
      bg = '#fef2f2'; border = '2px solid #ef4444';
      tc = '#7f1d1d'; numBg = '#ef4444'; numColor = '#fff';
    }
  }

  return (
    <div
      onClick={() => onSelect(uid, choice)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '10px 12px', borderRadius: '8px',
        background: bg, border, cursor: 'pointer',
        transition: 'background 0.12s, border 0.12s',
        userSelect: 'none',
      }}
    >
      {/* 번호 원형 */}
      <span style={{
        minWidth: '22px', height: '22px', borderRadius: '50%',
        flexShrink: 0, marginTop: '1px',
        background: numBg, color: numColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.77rem', fontWeight: '700',
      }}>
        {choice.num}
      </span>

      {/* 선지 텍스트 */}
      <div style={{
        flex: 1, fontSize: '0.88rem', lineHeight: '1.65',
        color: tc, textAlign: 'left',
      }}>
        <span>{choice.t}</span>
        {isMe && !isCorrect && choice.pat && <PatternBadge pat={choice.pat} />}
      </div>

      {/* 정오 아이콘 */}
      {isMe && (
        <span style={{ fontSize: '1rem', flexShrink: 0, paddingTop: '1px' }}>
          {isCorrect ? '✅' : '❌'}
        </span>
      )}
    </div>
  );
}

// ── 문제 블록 ─────────────────────────────────────────────
// key에 passageSet.id를 포함시켜야 세트 변경 시 상태 리셋됨
// (같은 문제번호 1,2,3이 세트마다 반복되므로 key 충돌 방지)
function QuestionBlock({ question, passageId, sel, onSelect }) {
  // 각 문제마다 독립된 clicked 상태 — 다른 문제에 영향 없음
  const [clicked, setClicked] = useState(null);

  function handleClick(uid, choice) {
    setClicked(uid);
    onSelect(uid, choice);
  }

  const hasBogiTable = question.bogiType === 'table' && question.bogiTable;
  const hasBogi      = !hasBogiTable && question.bogi;

  return (
    <div style={{
      background: '#f9fafb', border: '1px solid #e5e7eb',
      borderRadius: '10px', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      {/* 문제 텍스트 */}
      <div style={{
        fontSize: '0.88rem', fontWeight: '600',
        color: '#111827', lineHeight: '1.6', textAlign: 'left',
      }}>
        <span style={{ color: '#9ca3af', marginRight: '5px' }}>{question.id}.</span>
        {question.t}
      </div>

      {/* 보기 테이블 */}
      {hasBogiTable && (
        <BogiTable
          bogiTable={question.bogiTable}
          sel={sel}
          onSelect={(num) => {
            const c = question.choices.find(c => c.num === num);
            if (c) handleClick(`q${question.id}_c${num}`, c);
          }}
        />
      )}

      {/* 보기 텍스트 */}
      {hasBogi && (
        <div style={{
          background: '#fff', border: '1px solid #d1d5db',
          borderRadius: '6px', padding: '12px 14px',
          fontSize: '0.82rem', color: '#374151',
          lineHeight: '1.75', textAlign: 'left',
        }}>
          <div style={{ fontWeight: '700', marginBottom: '6px' }}>〈보기〉</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{question.bogi}</div>
          {question.bogiImage && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <img
                src={question.bogiImage.url}
                alt={question.bogiImage.alt || ''}
                style={{ maxWidth: '100%', borderRadius: '4px', border: '1px solid #e5e7eb' }}
              />
            </div>
          )}
        </div>
      )}

      {/* 선지 목록 */}
      {!hasBogiTable && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {question.choices.map(c => (
            <ChoiceItem
              key={c.num}
              choice={c}
              qid={question.id}
              clicked={clicked}
              onSelect={handleClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 오답 리포트 모달 ──────────────────────────────────────
function ReportModal({ log, onClose }) {
  const cnt = log.reduce((acc, { pat }) => {
    if (pat) acc[pat] = (acc[pat] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '14px',
        padding: '24px', maxWidth: '360px', width: '100%',
      }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '16px' }}>
          📊 오답 패턴 리포트
        </h3>
        {top.length === 0 && (
          <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>오답 패턴 없음</p>
        )}
        {top.map(([pat, n]) => {
          const p = P[pat]; if (!p) return null;
          return (
            <div key={pat} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px', borderRadius: '7px',
              background: p.bg, marginBottom: '6px',
            }}>
              <span style={{ fontWeight: '800', color: p.color, minWidth: '28px', fontSize: '0.78rem' }}>
                P{pat}
              </span>
              <span style={{ flex: 1, fontWeight: '600', fontSize: '0.84rem' }}>{p.name}</span>
              <span style={{
                background: p.color, color: '#fff',
                borderRadius: '12px', padding: '2px 10px',
                fontSize: '0.76rem', fontWeight: '700',
              }}>{n}회</span>
            </div>
          );
        })}
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: '14px', padding: '10px',
            borderRadius: '8px', background: '#1f2937',
            color: '#fff', border: 'none',
            fontWeight: '700', cursor: 'pointer', fontSize: '0.88rem',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function QuizPanel({ passageSet, sel, onSelChange }) {
  const [log, setLog] = useState([]);
  const [showReport, setShowReport] = useState(false);

  if (!passageSet) return null;

  function handleSelect(uid, choice) {
    onSelChange(uid, choice);
    // 오답(ok===true)만 로그에 기록
    if (choice.ok === true) {
      setLog(prev =>
        prev.find(w => w.uid === uid)
          ? prev
          : [...prev, { uid, pat: choice.pat }]
      );
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {passageSet.questions.map(q => (
        <QuestionBlock
          key={`${passageSet.id}-${q.id}`}
          question={q}
          passageId={passageSet.id}
          sel={sel}
          onSelect={handleSelect}
        />
      ))}

      {log.length > 0 && (
        <button
          onClick={() => setShowReport(true)}
          style={{
            padding: '10px 16px', borderRadius: '8px',
            background: '#1f2937', color: '#fff',
            border: 'none', fontWeight: '700',
            cursor: 'pointer', alignSelf: 'flex-end',
            fontSize: '0.85rem',
          }}
        >
          📊 오답 패턴 보기 ({log.length}개)
        </button>
      )}

      {showReport && (
        <ReportModal log={log} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
