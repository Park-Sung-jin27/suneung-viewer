// PatternCoach.jsx — 패턴별 AI 맞춤 코칭 하단 시트
// Props:
//   patKey      {string}  — 'R2', 'L3' 등
//   wrongAnswers {Array}  — user_answers에서 필터된 오답 목록
//                           각 항목: { question_key, choice_num, pat, year_key }
//   onClose     {fn}

import { useState, useEffect, useRef } from 'react';
import { P } from './constants';

// ── allData에서 question 탐색 ────────────────────────────────
// user_answers 스키마: set_id (e.g. 'r2026a') + question_id (숫자)
function findQuestion(allData, setId, questionId) {
  if (!setId || questionId == null || !allData) return null;
  for (const yearData of Object.values(allData)) {
    for (const section of ['reading', 'literature']) {
      const set = (yearData[section] ?? []).find(s => s.id === setId);
      if (!set) continue;
      const question = set.questions?.find(q => String(q.id) === String(questionId));
      if (question) return { question, set };
    }
  }
  return null;
}

// ── 초기 코칭 AI 호출 ────────────────────────────────────────
async function fetchInitialCoaching({ patKey, patName, wrongItems }) {
  const count = wrongItems.length;

  const itemsText = count > 0
    ? wrongItems.map((item, i) => [
        `[오답 ${i + 1}]`,
        `발문: ${item.questionText}`,
        `틀린 선지 ${item.choiceNum}번: "${item.choiceText}"`,
        item.groundingSents?.length
          ? `지문 근거: "${item.groundingSents.slice(0, 2).join(' ')}"`
          : null,
        item.analysis ? `오답 해설: ${item.analysis}` : null,
      ].filter(Boolean).join('\n')).join('\n\n')
    : '(상세 오답 데이터를 불러오지 못했습니다 — 패턴 일반 코칭으로 대체합니다)';

  const prompt = `당신은 수능 국어 전문 튜터입니다. 아래는 학생이 오늘 ${patKey}(${patName}) 패턴에서 틀린 문제들입니다.

${itemsText}

위 오답들을 분석해 다음 순서로 답하세요:
1. 이 학생이 공통적으로 속은 함정의 핵심을 1~2문장으로 (추상적인 패턴 설명 말고, 위 오답에서 구체적으로)
2. 이 패턴 선지를 만날 때 실전 대처법 2가지 (번호 붙여서)
3. "더 궁금한 점 있으면 질문하세요 😊"로 마무리

300자 이내, 존댓말로.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return data.content?.map(b => b.text ?? '').join('') ?? '코칭 내용을 가져오지 못했습니다.';
}

// ── 후속 질문 AI 호출 ────────────────────────────────────────
async function fetchReply({ patKey, patName, wrongItems, history }) {
  const context = wrongItems.map((item, i) =>
    `오답${i + 1}: ${item.choiceText} / ${item.analysis || '해설 없음'}`
  ).join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `수능 국어 전문 튜터. 현재 학생의 ${patKey}(${patName}) 오답 패턴 코칭 세션 중.\n분석된 오답:\n${context}\n\n200자 이내, 존댓말로 답하세요.`,
      messages: history,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return data.content?.map(b => b.text ?? '').join('') ?? '답변을 가져오지 못했습니다.';
}

// ── 말풍선 ───────────────────────────────────────────────────
function Bubble({ role, content }) {
  const isAI = role === 'assistant';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isAI ? 'flex-start' : 'flex-end',
      gap: '8px', alignItems: 'flex-start',
    }}>
      {isAI && (
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%',
          background: '#EEF2FF', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0,
        }}>🤖</div>
      )}
      <div style={{
        maxWidth: '84%',
        background: isAI ? '#F9FAFB' : '#6366F1',
        color: isAI ? '#1a1a14' : '#fff',
        border: isAI ? '1px solid #E5E7EB' : 'none',
        borderRadius: isAI ? '0 12px 12px 12px' : '12px 0 12px 12px',
        padding: '11px 15px',
        fontSize: '0.84rem', lineHeight: '1.75',
        whiteSpace: 'pre-wrap',
      }}>
        {content}
      </div>
      {!isAI && (
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%',
          background: '#6366F1', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '0.7rem',
          color: '#fff', fontWeight: '700', flexShrink: 0,
        }}>나</div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <div style={{
        width: '30px', height: '30px', borderRadius: '50%',
        background: '#EEF2FF', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0,
      }}>🤖</div>
      <div style={{
        background: '#F9FAFB', border: '1px solid #E5E7EB',
        borderRadius: '0 12px 12px 12px',
        padding: '11px 18px', display: 'flex', gap: '5px', alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: '#A5B4FC',
            animation: `bounce 1.1s ease-in-out ${i * 0.18}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function PatternCoach({ patKey, wrongAnswers, onClose }) {
  const [allData, setAllData]         = useState(null);  // null = 로딩 중
  const [wrongItems, setWrongItems]   = useState([]);
  const [history, setHistory]         = useState([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingReply, setLoadingReply] = useState(false);
  const [input, setInput]             = useState('');
  const [error, setError]             = useState(null);
  const bottomRef = useRef(null);

  const patInfo = P[patKey] ?? { name: patKey, color: '#6366F1', bg: '#EEF2FF', desc: '' };

  // allData 동적 로드 (App.jsx가 이미 로드했더라도 별도 번들에서 가져옴)
  useEffect(() => {
    import('./data/all_data_204.json')
      .then(m => setAllData(m.default))
      .catch(() => setAllData({}));  // 실패 시 빈 객체 — 패턴 이름만으로 코칭
  }, []);

  // allData 준비되면 wrongItems 구성 + 초기 코칭 요청
  useEffect(() => {
    if (allData === null) return;

    // wrongAnswers: [{ set_id, question_id, choice_num, pat, year_key }]
    const items = [];
    for (const wa of wrongAnswers) {
      if (!wa.set_id || wa.question_id == null) continue;
      const found = findQuestion(allData, wa.set_id, wa.question_id);
      if (!found) continue;
      const { question, set } = found;
      const choice = question.choices?.find(c => c.num === wa.choice_num);
      if (!choice) continue;
      const groundingSents = (choice.cs_ids ?? [])
        .map(sid => set.sents?.find(s => s.id === sid)?.t)
        .filter(Boolean);
      items.push({
        questionText: question.t,
        choiceNum: choice.num,
        choiceText: choice.t,
        analysis: choice.analysis ?? '',
        groundingSents,
      });
    }
    setWrongItems(items);

    setLoadingInit(true);
    fetchInitialCoaching({ patKey, patName: patInfo.name, wrongItems: items })
      .then(text => {
        setHistory([{ role: 'assistant', content: text }]);
      })
      .catch(() => {
        setHistory([{ role: 'assistant', content: '코칭 내용을 불러오지 못했습니다. 아래에서 직접 질문해보세요.' }]);
      })
      .finally(() => setLoadingInit(false));
  }, [allData]);  // eslint-disable-line

  // 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loadingReply, loadingInit]);

  async function handleSend() {
    const q = input.trim();
    if (!q || loadingReply || loadingInit) return;
    setInput('');
    setError(null);

    const newHistory = [...history, { role: 'user', content: q }];
    setHistory(newHistory);
    setLoadingReply(true);

    try {
      const reply = await fetchReply({
        patKey, patName: patInfo.name,
        wrongItems, history: newHistory,
      });
      setHistory(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setError('오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setLoadingReply(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>

      {/* 딤 오버레이 */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000 }}
      />

      {/* 하단 시트 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 1001,
        background: '#fff',
        borderRadius: '20px 20px 0 0',
        maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -6px 40px rgba(0,0,0,0.18)',
        fontFamily: "'Noto Sans KR', sans-serif",
      }}>

        {/* 핸들 */}
        <div style={{ padding: '12px 20px 0', textAlign: 'center' }}>
          <div style={{ width: '36px', height: '4px', background: '#E5E7EB', borderRadius: '2px', margin: '0 auto' }} />
        </div>

        {/* 헤더 */}
        <div style={{
          padding: '14px 20px 14px',
          borderBottom: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{
            fontSize: '0.75rem', fontWeight: '800',
            color: patInfo.color, background: patInfo.bg,
            border: `1px solid ${patInfo.color}55`,
            borderRadius: '6px', padding: '3px 10px', flexShrink: 0,
          }}>
            {patKey}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.98rem', fontWeight: '700', color: '#1a1a14' }}>
              {patInfo.name} 집중 코칭
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: '1px' }}>
              내 오답 {wrongAnswers.length}건 기반 맞춤 분석
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: '1.1rem',
              cursor: 'pointer', color: '#9CA3AF', padding: '4px',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* 대화 영역 */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: '14px',
        }}>
          {loadingInit
            ? <TypingIndicator />
            : history.map((msg, i) => <Bubble key={i} role={msg.role} content={msg.content} />)
          }
          {loadingReply && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* 분석 요약 칩 */}
        {wrongItems.length > 0 && !loadingInit && (
          <div style={{
            margin: '0 20px 8px',
            background: '#FFFBEB', border: '1px solid #FDE68A',
            borderRadius: '8px', padding: '8px 14px',
            fontSize: '0.73rem', color: '#92400E',
          }}>
            📌 분석된 오답 {wrongItems.length}건 · {wrongItems.map(w => `${w.choiceNum}번`).join(', ')}
          </div>
        )}

        {/* 입력창 */}
        <div style={{
          padding: '10px 20px 24px',
          borderTop: '1px solid #F3F4F6',
          display: 'flex', gap: '8px', alignItems: 'flex-end',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`${patKey} 패턴에 대해 더 궁금한 점을 질문하세요`}
            rows={2}
            disabled={loadingInit || loadingReply}
            style={{
              flex: 1, resize: 'none',
              border: '1px solid #E5E7EB', borderRadius: '10px',
              padding: '10px 14px', fontSize: '0.85rem',
              lineHeight: '1.5', fontFamily: 'inherit',
              color: '#1a1a14', outline: 'none',
              opacity: (loadingInit || loadingReply) ? 0.6 : 1,
            }}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSend(); }}
          />
          <button
            onClick={handleSend}
            disabled={loadingInit || loadingReply || !input.trim()}
            style={{
              padding: '10px 18px', borderRadius: '10px',
              background: (loadingInit || loadingReply || !input.trim()) ? '#A5B4FC' : '#6366F1',
              color: '#fff', border: 'none',
              fontWeight: '700', fontSize: '0.85rem',
              cursor: (loadingInit || loadingReply || !input.trim()) ? 'not-allowed' : 'pointer',
              flexShrink: 0, transition: 'background 0.15s',
            }}
          >
            전송
          </button>
        </div>
        {error && (
          <div style={{ padding: '0 20px 12px', fontSize: '0.73rem', color: '#DC2626' }}>{error}</div>
        )}
      </div>
    </>
  );
}
