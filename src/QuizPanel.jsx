// ============================================================
// QuizPanel.jsx v4 — 완전 재작성
// ok=False = 정답, ok=True = 오답
// clicked 상태: 문제별 완전 독립
// ============================================================
import { useState } from 'react';
import { P, CC } from './constants';
import { BogiTable } from './BogiTable';

function PatternBadge({ pat }) {
  if (!pat || !P[pat]) return null;
  const p = P[pat];
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: p.color, background: p.bg,
                   border: `1px solid ${p.color}40`, borderRadius: '4px',
                   padding: '1px 7px', marginLeft: '6px', verticalAlign: 'middle' }}>
      P{pat} {p.name}
    </span>
  );
}

function ChoiceItem({ choice, qid, clicked, onSelect }) {
  const uid = `q${qid}_c${choice.num}`;
  const isMe = clicked === uid;
  // ok=False = 정답
  const isCorrect = (choice.ok === false);

  let bg = '#fff', border = '1px solid #e5e7eb', tc = '#1f2937';
  let numBg = '#f3f4f6', numColor = CC[choice.num]?.text ?? '#374151';

  if (isMe) {
    if (isCorrect) {
      bg = '#ecfdf5'; border = '1.5px solid #10b981';
      tc = '#065f46'; numBg = '#10b981'; numColor = '#fff';
    } else {
      bg = '#fef2f2'; border = '1.5px solid #ef4444';
      tc = '#7f1d1d'; numBg = '#ef4444'; numColor = '#fff';
    }
  }

  return (
    <div onClick={() => onSelect(uid, choice)}
      style={{ display: 'flex', alignItems: 'flex-start', gap: '10px',
               padding: '10px 12px', borderRadius: '8px', background: bg,
               border, cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none' }}>
      <span style={{ minWidth: '22px', height: '22px', borderRadius: '50%', marginTop: '1px',
                     background: numBg, color: numColor, flexShrink: 0,
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     fontSize: '0.78rem', fontWeight: '700' }}>
        {choice.num}
      </span>
      <div style={{ flex: 1, color: tc, fontSize: '0.88rem', lineHeight: '1.65', textAlign: 'left' }}>
        {choice.t}
        {isMe && !isCorrect && <PatternBadge pat={choice.pat} />}
      </div>
      {isMe && <span style={{ fontSize: '1rem', flexShrink: 0 }}>{isCorrect ? '✅' : '❌'}</span>}
    </div>
  );
}

function QuestionBlock({ question, sel, onSelect }) {
  const [clicked, setClicked] = useState(null);

  function handleClick(uid, choice) {
    setClicked(uid);
    onSelect(uid, choice);
  }

  const hasBogiTable = question.bogiType === 'table' && question.bogiTable;

  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb',
                  borderRadius: '10px', padding: '14px 16px',
                  display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '0.88rem', fontWeight: '600', color: '#111827', lineHeight: '1.6' }}>
        <span style={{ color: '#6b7280', marginRight: '6px' }}>{question.id}.</span>
        {question.t}
      </div>

      {hasBogiTable && (
        <BogiTable bogiTable={question.bogiTable} sel={sel}
          onSelect={(num) => {
            const c = question.choices.find(c => c.num === num);
            if (c) handleClick(`q${question.id}_c${num}`, c);
          }} />
      )}

      {!hasBogiTable && question.bogi && (
        <div style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px',
                      padding: '12px 14px', fontSize: '0.82rem', color: '#374151',
                      lineHeight: '1.75', textAlign: 'left' }}>
          <div style={{ fontWeight: '700', marginBottom: '6px' }}>〈보기〉</div>
          <div style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>{question.bogi}</div>
          {question.bogiImage && (
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <img src={question.bogiImage.url} alt={question.bogiImage.alt || ''}
                style={{ maxWidth: '100%', borderRadius: '4px', border: '1px solid #e5e7eb' }} />
            </div>
          )}
        </div>
      )}

      {!hasBogiTable && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {question.choices.map(c => (
            <ChoiceItem key={c.num} choice={c} qid={question.id}
              clicked={clicked} onSelect={handleClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportModal({ log, onClose }) {
  const cnt = log.reduce((a, { pat }) => { if (pat) a[pat] = (a[pat]||0)+1; return a; }, {});
  const top = Object.entries(cnt).sort(([,a],[,b])=>b-a).slice(0,3);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1000, padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '24px',
                    maxWidth: '380px', width: '100%' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '16px' }}>📊 오답 패턴 리포트</h3>
        {top.map(([pat, n]) => {
          const p = P[pat]; if (!p) return null;
          return (
            <div key={pat} style={{ display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '8px 12px', borderRadius: '7px',
                                    background: p.bg, marginBottom: '6px' }}>
              <span style={{ fontWeight: '800', color: p.color, minWidth: '28px', fontSize: '0.8rem' }}>P{pat}</span>
              <span style={{ flex: 1, fontWeight: '600', fontSize: '0.85rem' }}>{p.name}</span>
              <span style={{ background: p.color, color: '#fff', borderRadius: '12px',
                             padding: '2px 10px', fontSize: '0.78rem', fontWeight: '700' }}>{n}회</span>
            </div>
          );
        })}
        <button onClick={onClose} style={{ width: '100%', marginTop: '14px', padding: '10px',
                                           borderRadius: '8px', background: '#1f2937', color: '#fff',
                                           border: 'none', fontWeight: '700', cursor: 'pointer' }}>
          닫기
        </button>
      </div>
    </div>
  );
}

export default function QuizPanel({ passageSet, sel, onSelChange }) {
  const [log, setLog] = useState([]);
  const [showReport, setShowReport] = useState(false);
  if (!passageSet) return null;

  function handleSelect(uid, choice) {
    onSelChange(uid, choice);
    if (choice.ok === true) {
      setLog(prev => prev.find(w => w.uid === uid)
        ? prev : [...prev, { uid, pat: choice.pat }]);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {passageSet.questions.map(q => (
        <QuestionBlock key={q.id} question={q} sel={sel} onSelect={handleSelect} />
      ))}
      {log.length > 0 && (
        <button onClick={() => setShowReport(true)}
          style={{ padding: '10px 16px', borderRadius: '8px', background: '#1f2937',
                   color: '#fff', border: 'none', fontWeight: '700',
                   cursor: 'pointer', alignSelf: 'flex-end' }}>
          📊 오답 패턴 보기 ({log.length}개)
        </button>
      )}
      {showReport && <ReportModal log={log} onClose={() => setShowReport(false)} />}
    </div>
  );
}
