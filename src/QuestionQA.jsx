// QuestionQA.jsx — 문제별 AI Q&A 컴포넌트
// 복습 모드에서 각 문제 아래 표시됨
// Supabase: question_comments 테이블 필요 (하단 SQL 참고)

import { useState, useEffect } from 'react';
import { supabase } from './supabase';

// ── AI 답변 요청 ──────────────────────────────────────────
async function fetchAIAnswer({ questionText, choices, passageSents, userQuestion }) {
  const passageText = (passageSents ?? [])
    .filter(s => s.sentType === 'body')
    .map(s => s.t)
    .join(' ');

  const choiceText = choices
    .map(c => `${c.num}번: ${c.t}`)
    .join('\n');

  const prompt = `수능 국어 문제에 대한 학생의 질문에 답해주세요. 간결하고 명확하게, 핵심만 200자 이내로 답하세요.

[문제]
${questionText}

[선지]
${choiceText}

[지문 일부]
${passageText.slice(0, 600)}

[학생 질문]
${userQuestion}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`API 오류: ${res.status}`);
  const data = await res.json();
  return data.content?.map(b => b.text ?? '').join('') ?? '답변을 가져오지 못했습니다.';
}

// ── 단일 Q&A 아이템 ──────────────────────────────────────
function QAItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      {/* 질문 */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '10px 14px',
          cursor: 'pointer',
          display: 'flex', alignItems: 'flex-start', gap: '8px',
        }}
      >
        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#6366f1', flexShrink: 0, marginTop: '2px' }}>Q</span>
        <span style={{ flex: 1, fontSize: '0.82rem', color: '#1e293b', lineHeight: '1.55' }}>{item.user_question}</span>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0, marginTop: '3px' }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* AI 답변 */}
      {open && (
        <div style={{
          borderTop: '1px solid #e2e8f0',
          padding: '10px 14px',
          display: 'flex', alignItems: 'flex-start', gap: '8px',
          background: '#fff',
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#10b981', flexShrink: 0, marginTop: '2px' }}>A</span>
          <span style={{ flex: 1, fontSize: '0.82rem', color: '#374151', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
            {item.ai_answer}
          </span>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function QuestionQA({ questionKey, questionText, choices, passageSents, user }) {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [fetching, setFetching]   = useState(true);
  const [input, setInput]         = useState('');
  const [open, setOpen]           = useState(false);
  const [error, setError]         = useState(null);

  // 기존 Q&A 로드
  useEffect(() => {
    if (!questionKey) return;
    setFetching(true);
    supabase
      .from('question_comments')
      .select('id, user_question, ai_answer, created_at')
      .eq('question_key', questionKey)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setItems(data ?? []);
        setFetching(false);
      });
  }, [questionKey]);

  async function handleAsk() {
    const q = input.trim();
    if (!q || loading) return;
    if (!user) { setError('로그인 후 질문할 수 있어요'); return; }

    setLoading(true);
    setError(null);

    try {
      const aiAnswer = await fetchAIAnswer({ questionText, choices, passageSents, userQuestion: q });

      const { data, error: dbErr } = await supabase
        .from('question_comments')
        .insert({ question_key: questionKey, user_question: q, ai_answer: aiAnswer })
        .select('id, user_question, ai_answer, created_at')
        .single();

      if (dbErr) throw dbErr;
      setItems(prev => [...prev, data]);
      setInput('');
    } catch (e) {
      setError('오류가 발생했어요. 잠시 후 다시 시도해주세요.');
      console.error('[QuestionQA]', e);
    } finally {
      setLoading(false);
    }
  }

  const count = items.length;

  return (
    <div style={{ marginTop: '8px' }}>

      {/* 토글 버튼 */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 12px', borderRadius: '6px',
          background: open ? '#eef2ff' : '#f8fafc',
          border: '1px solid ' + (open ? '#a5b4fc' : '#e2e8f0'),
          color: open ? '#4338ca' : '#64748b',
          fontSize: '0.78rem', fontWeight: '600',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <span>🤖 AI에게 질문</span>
        {count > 0 && (
          <span style={{
            background: '#6366f1', color: '#fff',
            borderRadius: '10px', padding: '1px 7px',
            fontSize: '0.68rem', fontWeight: '700',
          }}>
            {count}개 답변
          </span>
        )}
      </button>

      {open && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* 기존 Q&A 목록 */}
          {fetching ? (
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '8px 4px' }}>불러오는 중…</div>
          ) : count === 0 ? (
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '4px' }}>
              아직 질문이 없어요. 첫 번째로 질문해보세요!
            </div>
          ) : (
            items.map(item => <QAItem key={item.id} item={item} />)
          )}

          {/* 질문 입력 */}
          <div style={{
            background: '#fff',
            border: '1px solid #c7d2fe',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="이해가 안 되는 부분을 질문하세요&#10;예) 왜 2번이 틀렸나요? / ㉠의 의미가 뭔가요?"
              rows={3}
              style={{
                width: '100%', resize: 'none',
                border: '1px solid #e2e8f0', borderRadius: '6px',
                padding: '8px 10px', fontSize: '0.82rem', lineHeight: '1.6',
                fontFamily: 'inherit', color: '#1e293b',
                background: '#fff',
                outline: 'none',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && e.metaKey) handleAsk();
              }}
            />
            {error && (
              <div style={{ fontSize: '0.76rem', color: '#dc2626' }}>{error}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {user ? '⌘+Enter로 전송' : '로그인 필요'}
              </span>
              <button
                onClick={handleAsk}
                disabled={loading || !input.trim()}
                style={{
                  padding: '7px 16px', borderRadius: '6px',
                  background: loading ? '#a5b4fc' : '#6366f1',
                  color: '#fff', border: 'none',
                  fontWeight: '700', fontSize: '0.82rem',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  opacity: !input.trim() ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {loading ? 'AI 답변 중…' : '질문하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
