// ============================================================
// QuizPanel.jsx — v3
// revealed: 문제 단위 독립 (다른 문제 정답 노출 버그 수정)
// ============================================================
import { useState } from 'react';
import { P, CC } from './constants';
import { BogiTable } from './BogiTable';

function PaywallGuard({ children }) { return children; }

function PatternBadge({ pat }) {
  if (!pat || !P[pat]) return null;
  const p = P[pat];
  return (
    <span style={{ display:'inline-block', fontSize:'0.7rem', fontWeight:'700',
                   color:p.color, background:p.bg, border:`1px solid ${p.color}40`,
                   borderRadius:'4px', padding:'1px 7px', marginLeft:'6px', verticalAlign:'middle' }}>
      P{pat} {p.name}
    </span>
  );
}

// ── 단일 선지 ────────────────────────────────────────────
function ChoiceItem({ choice, qid, sel, onSelect, revealed }) {
  const uid = `q${qid}_c${choice.num}`;
  const isSelected = sel === uid;
  // revealed는 이 문제 안에서만 true가 됨 → 다른 문제 정답 노출 없음
  const showCorrect = revealed && choice.ok && !isSelected;

  let bg = '#fff', border = '1px solid #e5e7eb', textColor = '#1f2937';
  if (isSelected) {
    bg = choice.ok ? '#ecfdf5' : '#fef2f2';
    border = `1.5px solid ${choice.ok ? '#10b981' : '#ef4444'}`;
    textColor = choice.ok ? '#065f46' : '#7f1d1d';
  } else if (showCorrect) {
    bg = '#f0fdf4'; border = '1px dashed #86efac'; textColor = '#166534';
  }

  return (
    <div onClick={() => onSelect(uid, choice)}
      style={{ display:'flex', alignItems:'flex-start', gap:'10px',
               padding:'10px 12px', borderRadius:'8px', background:bg, border,
               cursor:'pointer', transition:'all 0.15s', userSelect:'none' }}>
      <span style={{ minWidth:'22px', height:'22px', borderRadius:'50%', marginTop:'1px',
                     background:isSelected?(choice.ok?'#10b981':'#ef4444'):'#f3f4f6',
                     color:isSelected?'#fff':(CC[choice.num]?.text??'#374151'),
                     display:'flex', alignItems:'center', justifyContent:'center',
                     fontSize:'0.78rem', fontWeight:'700', flexShrink:0 }}>
        {choice.num}
      </span>
      <div style={{ flex:1, color:textColor, fontSize:'0.88rem', lineHeight:'1.6' }}>
        {choice.t}
        {isSelected && !choice.ok && <PatternBadge pat={choice.pat} />}
      </div>
      {isSelected && <span style={{ fontSize:'1rem', flexShrink:0 }}>{choice.ok ? '✅' : '❌'}</span>}
    </div>
  );
}

// ── 단일 문제 — revealed 독립 관리 ─────────────────────
function QuestionBlock({ question, sel, onSelect }) {
  const [revealed, setRevealed] = useState(false);
  const hasBogiTable = question.bogiType === 'table' && question.bogiTable;

  function handleChoiceSelect(uid, choice) {
    setRevealed(true);   // 이 문제만 revealed
    onSelect(uid, choice);
  }

  return (
    <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb',
                  borderRadius:'10px', padding:'14px 16px',
                  display:'flex', flexDirection:'column', gap:'8px' }}>

      {/* 문제 텍스트 */}
      <div style={{ fontSize:'0.88rem', fontWeight:'600', color:'#111827', lineHeight:'1.55' }}>
        <span style={{ color:'#6b7280', marginRight:'6px' }}>{question.id}.</span>
        {question.t}
      </div>

      {/* 표 형식 보기 */}
      {hasBogiTable && (
        <BogiTable
          bogiTable={question.bogiTable}
          sel={sel}
          onSelect={(num) => {
            const choice = question.choices.find(c => c.num === num);
            if (choice) handleChoiceSelect(`q${question.id}_c${num}`, choice);
          }}
        />
      )}

      {/* 일반 텍스트 보기 */}
      {!hasBogiTable && question.bogi && (
        <div style={{ background:'#fff', border:'1px solid #d1d5db', borderRadius:'6px',
                      padding:'12px 14px', fontSize:'0.82rem', color:'#374151',
                      lineHeight:'1.75', textAlign:'left' }}>
          <div style={{ fontWeight:'700', marginBottom:'6px' }}>〈보기〉</div>
          <div style={{ whiteSpace:'pre-wrap' }}>{question.bogi}</div>
          {question.bogiImage && (
            <div style={{ marginTop:'12px', textAlign:'center' }}>
              <img src={question.bogiImage.url} alt={question.bogiImage.alt}
                style={{ maxWidth:'100%', borderRadius:'4px', border:'1px solid #e5e7eb' }} />
            </div>
          )}
        </div>
      )}

      {/* 선지 목록 */}
      {!hasBogiTable && (
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          {question.choices.map(c => (
            <ChoiceItem key={c.num} choice={c} qid={question.id}
              sel={sel} onSelect={handleChoiceSelect} revealed={revealed} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 리포트 모달 ───────────────────────────────────────────
function ReportModal({ wrongLog, onClose }) {
  if (!wrongLog?.length) return null;
  const patCount = wrongLog.reduce((acc, { pat }) => { if (pat) acc[pat] = (acc[pat]||0)+1; return acc; }, {});
  const sorted = Object.entries(patCount).sort(([,a],[,b]) => b-a).slice(0, 3);
  return (
    <PaywallGuard>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    zIndex:1000, padding:'16px' }}>
        <div style={{ background:'#fff', borderRadius:'14px', padding:'24px',
                      maxWidth:'380px', width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
          <h3 style={{ fontSize:'1.1rem', fontWeight:'800', marginBottom:'16px' }}>📊 개인화 진단 리포트</h3>
          <p style={{ fontSize:'0.85rem', color:'#6b7280', marginBottom:'12px' }}>
            이번 세션 오답 {wrongLog.length}개
          </p>
          {sorted.map(([pat, cnt]) => {
            const p = P[pat]; if (!p) return null;
            return (
              <div key={pat} style={{ display:'flex', alignItems:'center', gap:'10px',
                                      padding:'8px 12px', borderRadius:'7px',
                                      background:p.bg, marginBottom:'6px' }}>
                <span style={{ fontWeight:'800', color:p.color, fontSize:'0.8rem', minWidth:'28px' }}>P{pat}</span>
                <span style={{ flex:1, fontSize:'0.85rem', fontWeight:'600', color:'#1f2937' }}>{p.name}</span>
                <span style={{ background:p.color, color:'#fff', borderRadius:'12px',
                               padding:'2px 10px', fontSize:'0.78rem', fontWeight:'700' }}>{cnt}회</span>
              </div>
            );
          })}
          <button onClick={onClose}
            style={{ width:'100%', marginTop:'14px', padding:'10px', borderRadius:'8px',
                     background:'#1f2937', color:'#fff', border:'none',
                     fontWeight:'700', cursor:'pointer', fontSize:'0.9rem' }}>
            닫기
          </button>
        </div>
      </div>
    </PaywallGuard>
  );
}

// ── QuizPanel 메인 ────────────────────────────────────────
export default function QuizPanel({ passageSet, sel, onSelChange }) {
  const [wrongLog, setWrongLog]     = useState([]);
  const [showReport, setShowReport] = useState(false);
  if (!passageSet) return null;

  function handleSelect(uid, choice) {
    onSelChange(uid, choice);
    if (!choice.ok) {
      setWrongLog(prev => prev.find(w => w.uid === uid)
        ? prev
        : [...prev, { uid, pat: choice.pat, qid: uid.split('_')[0] }]
      );
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
      {passageSet.questions.map(q => (
        <QuestionBlock key={q.id} question={q} sel={sel} onSelect={handleSelect} />
      ))}
      {wrongLog.length > 0 && (
        <button onClick={() => setShowReport(true)}
          style={{ padding:'10px 16px', borderRadius:'8px', background:'#1f2937',
                   color:'#fff', border:'none', fontWeight:'700', cursor:'pointer',
                   fontSize:'0.88rem', alignSelf:'flex-end' }}>
          📊 내 오답 패턴 보기 ({wrongLog.length}개)
        </button>
      )}
      {showReport && <ReportModal wrongLog={wrongLog} onClose={() => setShowReport(false)} />}
    </div>
  );
}
