import { useState, useEffect, useRef } from 'react';
import { P, CC } from './constants';
import { BogiTable } from './BogiTable';

// ── analysis 텍스트에서 sent ID 참조 제거 ─────────────────
// 예: "as9: '...'", "kor25_as12:", "as1·as2:" → 제거
function cleanAnalysis(text) {
  if (!text) return '';
  return text.replace(/[a-zA-Z_]*[a-zA-Z]\d+(?:[·,][a-zA-Z_]*\d+)*:\s*[''"]?/g, '').trim();
}

// ── 해설 블록 (선지 아래 인라인 표시) ────────────────────
function AnalysisBlock({ text }) {
  const cleaned = cleanAnalysis(text);
  if (!cleaned || cleaned.length < 5) return null;

  const chunks = cleaned.includes('➔')
    ? cleaned.split('➔').map(s => s.trim()).filter(Boolean)
    : [cleaned];

  return (
    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {chunks.map((chunk, i) => {
        let bg = '#f9fafb', bl = '#d1d5db', tc = '#374151', label = '';
        if (chunk.includes('[지문 팩트]')) {
          bg='#dbeafe'; bl='#3b82f6'; tc='#1e40af'; label='📌 지문 팩트';
        } else if (chunk.includes('[선지 분析]') || chunk.includes('[선지 분석]')) {
          bg='#f3f4f6'; bl='#9ca3af'; tc='#374151'; label='🔍 선지 분석';
        } else if (chunk.includes('[소거 판별')) {
          const isTrue=/True/.test(chunk), isFalse=/False/.test(chunk);
          bg=isTrue?'#dcfce7':isFalse?'#fee2e2':'#f9fafb';
          bl=isTrue?'#16a34a':isFalse?'#dc2626':'#9ca3af';
          tc=isTrue?'#14532d':isFalse?'#7f1d1d':'#374151';
          label=isTrue?'✅ True':isFalse?'❌ False':'⚖️';
        } else if (/\[패턴/.test(chunk)) {
          bg='#fef9c3'; bl='#ca8a04'; tc='#713f12'; label='🔖 패턴';
        }
        const clean = chunk
          .replace(/\[지문 팩트\]/g,'').replace(/\[선지 분析\]/g,'')
          .replace(/\[선지 분석\]/g,'').replace(/\[소거 판별[^\]]*\]/g,'')
          .replace(/\[패턴[^\]]*\]/g,'').trim();
        return (
          <div key={i} style={{ background:bg, borderLeft:`3px solid ${bl}`, borderRadius:'0 4px 4px 0', padding:'6px 10px', fontSize:'0.79rem', lineHeight:'1.6', color:tc }}>
            {label && <div style={{ fontSize:'0.67rem', fontWeight:'700', marginBottom:'2px', opacity:0.75 }}>{label}</div>}
            <div style={{ whiteSpace:'pre-wrap' }}>{clean}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── 오답 패턴 뱃지 ────────────────────────────────────────
function PatternBadge({ pat }) {
  if (!pat || !P[pat]) return null;
  const p = P[pat];
  return (
    <span style={{ fontSize:'0.68rem', fontWeight:'700', color:p.color, background:p.bg, border:`1px solid ${p.color}55`, borderRadius:'4px', padding:'1px 6px', marginLeft:'7px', verticalAlign:'middle', whiteSpace:'nowrap' }}>
      P{pat} {p.name}
    </span>
  );
}

// ── 선지 아이템 ───────────────────────────────────────────
function ChoiceItem({ choice, qid, questionType, clicked, onSelect }) {
  const uid = `q${qid}_c${choice.num}`;
  const isMe = clicked === uid;
  const isCorrect = questionType === 'positive'
    ? choice.ok === true
    : choice.ok === false;
  let bg='#ffffff', border='1px solid #e5e7eb', tc='#1f2937';
  let numBg='#f3f4f6', numColor=CC[choice.num]?.text ?? '#374151';

  if (isMe) {
    if (isCorrect) {
      bg='#ecfdf5'; border='2px solid #10b981'; tc='#065f46';
      numBg='#10b981'; numColor='#fff';
    } else {
      bg='#fef2f2'; border='2px solid #ef4444'; tc='#7f1d1d';
      numBg='#ef4444'; numColor='#fff';
    }
  }

  return (
    <div>
      <div onClick={() => onSelect(uid, choice)} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'10px 12px', borderRadius: isMe ? '8px 8px 0 0' : '8px', background:bg, border, cursor:'pointer', transition:'background 0.12s, border 0.12s', userSelect:'none' }}>
        <span style={{ minWidth:'22px', height:'22px', borderRadius:'50%', flexShrink:0, marginTop:'1px', background:numBg, color:numColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.77rem', fontWeight:'700' }}>
          {choice.num}
        </span>
        <div style={{ flex:1, fontSize:'0.88rem', lineHeight:'1.65', color:tc, textAlign:'left' }}>
          <span>{choice.t}</span>
          {isMe && !isCorrect && choice.pat && <PatternBadge pat={choice.pat} />}
        </div>
        {isMe && <span style={{ fontSize:'1rem', flexShrink:0, paddingTop:'1px' }}>{isCorrect?'✅':'❌'}</span>}
      </div>
      {/* 선지 아래 해설 인라인 표시 */}
      {isMe && choice.analysis && (
        <div style={{ background: isCorrect?'#f0fdf4':'#fff5f5', borderLeft:`2px solid ${isCorrect?'#10b981':'#ef4444'}`, borderBottom:`1px solid ${isCorrect?'#a7f3d0':'#fca5a5'}`, borderRight:`1px solid ${isCorrect?'#a7f3d0':'#fca5a5'}`, borderRadius:'0 0 8px 8px', padding:'10px 14px' }}>
          <AnalysisBlock text={choice.analysis} />
        </div>
      )}
    </div>
  );
}

// ── 문제 블록 ─────────────────────────────────────────────
function QuestionBlock({ question, passageId, sel, onSelect }) {
  const [clicked, setClicked] = useState(null);

  function handleClick(uid, choice) {
    // 같은 선지 재클릭 → 취소
    if (clicked === uid) {
      setClicked(null);
      onSelect(null, null);
      return;
    }
    setClicked(uid);
    onSelect(uid, choice);
  }

  const hasBogiTable = question.bogiType === 'table' && question.bogiTable;
  const hasBogi = !hasBogiTable && question.bogi;

  return (
    <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'14px 16px', display:'flex', flexDirection:'column', gap:'8px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
        <div style={{ fontSize:'0.88rem', fontWeight:'600', color:'#111827', lineHeight:'1.6', textAlign:'left', flex:1 }}>
          <span style={{ color:'#9ca3af', marginRight:'5px' }}>{question.id}.</span>
          {question.t}
        </div>
        {question.correctRate != null && (
          <span style={{
            fontSize:'0.7rem', fontWeight:'700', whiteSpace:'nowrap', flexShrink:0, marginTop:'2px',
            padding:'2px 7px', borderRadius:'4px',
            color: question.correctRate >= 70 ? '#15803d' : question.correctRate >= 40 ? '#854d0e' : '#dc2626',
            background: question.correctRate >= 70 ? '#dcfce7' : question.correctRate >= 40 ? '#fef9c3' : '#fee2e2',
          }}>
            정답률 {question.correctRate}%
          </span>
        )}
      </div>

      {hasBogiTable && (
        <BogiTable bogiTable={question.bogiTable} sel={sel}
          onSelect={(num) => {
            const c = question.choices.find(c => c.num === num);
            if (c) handleClick(`q${question.id}_c${num}`, c);
          }} />
      )}

      {hasBogi && (
        <div style={{ background:'#fff', border:'1px solid #d1d5db', borderRadius:'6px', padding:'12px 14px', fontSize:'0.82rem', color:'#374151', lineHeight:'1.75', textAlign:'left' }}>
          <div style={{ fontWeight:'700', marginBottom:'6px' }}>〈보기〉</div>
          <div style={{ whiteSpace:'pre-wrap' }}>{typeof question.bogi === 'string' ? question.bogi : ''}</div>
          {question.bogiImages?.length > 0 && (
            <div style={{ marginTop:'12px', display:'flex', flexDirection:'column', gap:'8px', alignItems:'center' }}>
              {question.bogiImages.map((img,i) => (
                <img key={i} src={img.url} alt={img.alt||''}
                  style={{ maxWidth:'100%', borderRadius:'4px', border:'1px solid #e5e7eb' }} />
              ))}
            </div>
          )}
          {question.bogiImage && (
            <div style={{ marginTop:'12px', textAlign:'center' }}>
              <img src={question.bogiImage.url} alt={question.bogiImage.alt||''} style={{ maxWidth:'100%', borderRadius:'4px', border:'1px solid #e5e7eb' }} />
            </div>
          )}
        </div>
      )}

      {!hasBogiTable && (
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          {question.choices.map(c => (
            // 수정
<ChoiceItem key={c.num} choice={c} qid={question.id} questionType={question.questionType ?? 'negative'} clicked={clicked} onSelect={handleClick} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 오답 리포트 모달 (개선) ───────────────────────────────
function ReportModal({ totalQ, correctCount, wrongCount, log, onClose }) {
  const rate = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;

  // 패턴별 집계 (P1~P9 전부)
  const patCounts = {};
  for (const { pat } of log) { if (pat) patCounts[pat] = (patCounts[pat] || 0) + 1; }
  const totalWrong = log.length;

  // 가장 많이 틀린 패턴
  const topPat = Object.entries(patCounts).sort(([,a],[,b]) => b - a)[0];

  const adviceMap = {
    1: '지문의 주체/객체, 인과 방향을 꼼꼼히 확인하세요.',
    2: '모든/항상/만 같은 한정사에 주의하세요.',
    3: '지문에 없는 내용을 추가하지 않도록 주의하세요.',
    4: '팩트는 맞지만 해석이 다른 함정에 주의하세요.',
    5: '시어/이미지의 상징 의미를 정확히 파악하세요.',
    6: '화자/인물의 정서와 태도를 구분하세요.',
    7: '서술 방식과 구성 구조를 정확히 파악하세요.',
    8: '보기 조건을 작품에 정확히 대입하세요.',
    9: '어휘의 문맥적 의미를 정확히 파악하세요.',
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'16px' }}
         onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'14px', padding:'24px', maxWidth:'380px', width:'100%', maxHeight:'85vh', overflowY:'auto' }}
           onClick={e => e.stopPropagation()}>

        {/* 상단: 정답률 */}
        <div style={{ textAlign:'center', marginBottom:'18px' }}>
          <div style={{ fontSize:'2.2rem', fontWeight:'800', color: rate >= 80 ? '#16a34a' : rate >= 50 ? '#ca8a04' : '#dc2626' }}>
            {rate}%
          </div>
          <div style={{ fontSize:'0.82rem', color:'#6b7280', marginTop:'4px' }}>
            {totalQ}문제 중 <span style={{ color:'#16a34a', fontWeight:'700' }}>{correctCount}개 정답</span> · <span style={{ color:'#dc2626', fontWeight:'700' }}>{wrongCount}개 오답</span>
          </div>
        </div>

        <div style={{ height:'1px', background:'#e5e7eb', margin:'0 0 14px' }} />

        {/* 패턴별 섹션 */}
        <h4 style={{ fontSize:'0.88rem', fontWeight:'700', marginBottom:'10px', color:'#111827' }}>오답 패턴 분석</h4>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {Object.keys(P).map(k => {
            const p = P[k];
            const n = patCounts[k] || 0;
            const pct = totalWrong > 0 ? Math.round((n / totalWrong) * 100) : 0;
            const isEmpty = n === 0;
            return (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', borderRadius:'6px', background: isEmpty ? '#f9fafb' : p.bg, opacity: isEmpty ? 0.5 : 1 }}>
                <span style={{ fontWeight:'800', color: isEmpty ? '#9ca3af' : p.color, minWidth:'28px', fontSize:'0.75rem' }}>P{k}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.78rem', fontWeight:'600', color: isEmpty ? '#9ca3af' : '#374151' }}>{p.name}</div>
                  {!isEmpty && (
                    <div style={{ marginTop:'3px', height:'6px', background:'#e5e7eb', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:p.color, borderRadius:'3px', transition:'width 0.3s' }} />
                    </div>
                  )}
                </div>
                <span style={{ fontSize:'0.73rem', fontWeight:'700', color: isEmpty ? '#d1d5db' : p.color, minWidth:'32px', textAlign:'right' }}>
                  {n}건{!isEmpty && ` ${pct}%`}
                </span>
              </div>
            );
          })}
        </div>

        {/* 하단 조언 */}
        {topPat && (
          <div style={{ marginTop:'14px', padding:'10px 12px', background:'#fffbeb', border:'1px solid #fbbf24', borderRadius:'8px', fontSize:'0.8rem', lineHeight:'1.5', color:'#92400e' }}>
            <strong>P{topPat[0]}({P[topPat[0]]?.name})</strong>이 가장 많습니다. {adviceMap[topPat[0]] || '해당 패턴을 집중적으로 복습하세요.'}
          </div>
        )}
        {!topPat && wrongCount === 0 && (
          <div style={{ marginTop:'14px', padding:'10px 12px', background:'#ecfdf5', border:'1px solid #6ee7b7', borderRadius:'8px', fontSize:'0.8rem', color:'#065f46', textAlign:'center' }}>
            전문 만점! 훌륭합니다.
          </div>
        )}

        <button onClick={onClose} style={{ width:'100%', marginTop:'16px', padding:'10px', borderRadius:'8px', background:'#1f2937', color:'#fff', border:'none', fontWeight:'700', cursor:'pointer', fontSize:'0.88rem' }}>닫기</button>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function QuizPanel({ passageSet, sel, onSelChange }) {
  const [log, setLog] = useState([]);
  const [answered, setAnswered] = useState(new Set()); // qid Set
  const [showReport, setShowReport] = useState(false);
  const autoShownRef = useRef(false);

  // 세트 변경 시 리셋
  const setId = passageSet?.id;
  useEffect(() => {
    setLog([]);
    setAnswered(new Set());
    setShowReport(false);
    autoShownRef.current = false;
  }, [setId]);

  if (!passageSet) return null;

  const totalQ = passageSet.questions.length;
  const correctCount = answered.size - log.length;
  const wrongCount = log.length;

  function handleSelect(uid, choice) {
    onSelChange(uid, choice);
    if (choice) {
      const qid = parseInt(uid.split('_c')[0].replace('q', ''), 10);
      const q = passageSet.questions.find(q => q.id === qid);
      const qt = q?.questionType ?? 'negative';
      const isCorrect = qt === 'positive' ? choice.ok === true : choice.ok === false;

      setAnswered(prev => {
        const next = new Set(prev);
        next.add(qid);
        // 전부 풀었으면 자동 모달
        if (next.size === totalQ && !autoShownRef.current) {
          autoShownRef.current = true;
          setTimeout(() => setShowReport(true), 400);
        }
        return next;
      });

      if (!isCorrect) {
        setLog(prev => prev.find(w => w.uid === uid) ? prev : [...prev, { uid, pat: choice.pat }]);
      }
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
      {passageSet.questions.map(q => (
        <QuestionBlock key={`${passageSet.id}-${q.id}`} question={q} passageId={passageSet.id} sel={sel} onSelect={handleSelect} />
      ))}
      {answered.size > 0 && (
        <button onClick={()=>setShowReport(true)} style={{ padding:'10px 16px', borderRadius:'8px', background:'#1f2937', color:'#fff', border:'none', fontWeight:'700', cursor:'pointer', alignSelf:'flex-end', fontSize:'0.85rem' }}>
          📊 리포트 보기 ({answered.size}/{totalQ})
        </button>
      )}
      {showReport && (
        <ReportModal
          totalQ={totalQ}
          correctCount={correctCount}
          wrongCount={wrongCount}
          log={log}
          onClose={()=>setShowReport(false)}
        />
      )}
    </div>
  );
}
