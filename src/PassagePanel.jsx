// ============================================================
// PassagePanel.jsx
// 업데이트 내용: 
// 1. [18~21] 지시문 초강력 삭제 (조건 완화로 무조건 삭제)
// 2. 문학 작품 제목 줄 자동 감지 및 우측 정렬 (예: (가) 정지용, 「비」)
// 3. 시(Poetry) 행 바꿈(\n) 자동 인식 및 <br/> 처리
// ============================================================

import { CC } from './constants';

function AnalysisBlock({ text, isCorrect }) {
  if (!text) return null;
  const parts = text.split('➔').map(s => s.trim()).filter(Boolean);
  const blocks = parts.map((part, i) => {
    const isFact    = part.startsWith('[지문 팩트]');
    const isAnalysis = part.startsWith('[선지 분析]') || part.startsWith('[선지 분석]');
    const isPattern  = /^(\[패턴|①|②|③|④)/.test(part);

    let style = {};
    let label = null;

    if (isFact) {
      style = { background: '#e8f0fe', border: '1px solid #b0c4f8', borderLeft: '4px solid #3b82f6', padding: '10px 14px', color: '#1d4ed8' };
      label = part.replace('[지문 팩트]', '').trim();
    } else if (isAnalysis) {
      style = { background: '#f3f4f6', border: '1px solid #d1d5db', borderLeft: '4px solid #6b7280', padding: '10px 14px', color: '#374151' };
      label = part.replace(/\[선지 분[析석]\]/, '').trim();
    } else if (isPattern) {
      style = { marginTop: '6px', padding: '4px 0', color: isCorrect ? '#059669' : '#dc2626', fontWeight: '700' };
      label = part;
    } else {
       style = { padding: '4px 0', color: '#4b5563' };
       label = part;
    }
    return <div key={i} style={{ ...style, fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '6px', borderRadius: '4px', textAlign: 'left' }}>{label}</div>;
  });
  return <div style={{ display: 'flex', flexDirection: 'column', marginTop: '12px' }}>{blocks}</div>;
}

// PassagePanel.jsx — SentenceSpan 함수 안에 추가
function SentenceSpan({ sent, sel }) {

  // 이미지 타입 처리
  if (sent.type === 'image') {
    return (
      <div style={{
        margin: '16px 0',
        textAlign: 'center',
      }}>
        <img
          src={sent.url}
          alt={sent.alt}
          style={{
            maxWidth: '100%',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        />
        {sent.alt && (
          <p style={{
            fontSize: '0.72rem',
            color: '#9ca3af',
            marginTop: '6px',
            fontStyle: 'italic',
          }}>
            {sent.alt}
          </p>
        )}
      </div>
    );
  }

  // 기존 텍스트 렌더링 (기존 코드 유지)
  // ...
}

function SentenceSpan({ sent, sel }) {
  if (sent.type === 'image') {
    return (
      <div style={{ margin: '16px 0', textAlign: 'center' }}>
        <img src={sent.url} alt={sent.alt || "지문 이미지"} style={{ maxWidth: '100%', height: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
      </div>
    );
  }

  const isMatched = sel && sent.cs && sent.cs.includes(sel.uid);
  let style = { position: 'relative', display: 'inline', transition: 'all 0.2s', padding: '0 2px' };

  // 🎯 [스마트 감지 1] 문학 제목 줄인지 자동 감지
  // 조건: "(가)", "(나)" 등으로 시작하고, 길이가 40자 이하이며, 평서문("다.")으로 끝나지 않음
  const textTrim = sent.t.trim();
  const isTitleLine = /^\([가-힣]\)/.test(textTrim) && textTrim.length < 40 && !textTrim.endsWith('다.');

  if (isTitleLine) {
    style.display = 'block';
    style.textAlign = 'right'; // 우측 정렬
    style.fontWeight = '700';
    style.marginTop = '24px';
    style.marginBottom = '12px';
    style.color = '#111827';
  }

  // 🎯 [스마트 감지 2] 텍스트 내의 줄바꿈(\n)을 리액트 <br/> 태그로 변환하여 시(Poetry) 행 구분
  const renderText = sent.t.split('\n').map((line, i, arr) => (
    <span key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </span>
  ));

  if (isMatched) {
    const colorInfo = CC[sel.num] || CC[1];
    style.background = colorInfo.bg; style.color = colorInfo.text;
    style.fontWeight = '700'; style.borderBottom = `2px solid ${colorInfo.border}`;
  }
  
  return <span style={style}>{renderText} </span>;
}

export default function PassagePanel({ passageSet, sel, selectedChoice }) {
  if (!passageSet) return null;

  // 🎯 초강력 지시문 삭제 필터: 문장 맨 앞에 [18~21] 형태가 오면 무조건 지움
  const isInstruction = (text) => {
    if (!text) return false;
    return /^\s*\[\s*\d+\s*[~-∼]\s*\d+\s*\]/.test(text);
  };

  const paragraphs = passageSet.sents.reduce((acc, sent) => {
    if (sent.type !== 'image' && isInstruction(sent.t)) return acc; 
    const pid = sent.pid || 1; 
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(sent);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: '600', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', textAlign: 'left' }}>
        {passageSet.range} · {passageSet.title}
      </div>
      <div style={{ fontSize: '0.93rem', lineHeight: '1.85', color: '#1f2937', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', wordBreak: 'keep-all' }}>
        {Object.entries(paragraphs).map(([pid, sents]) => (
          <p key={pid} style={{ margin: 0, textIndent: '10px' }}>
            {sents.map((sent, idx) => <SentenceSpan key={sent.id || idx} sent={sent} sel={sel} />)}
          </p>
        ))}
      </div>
      {selectedChoice && selectedChoice.analysis && (
        <div style={{ marginTop: '16px', borderTop: '2px dashed #e5e7eb', paddingTop: '16px', textAlign: 'left' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>💡 논리맵핑 해설</div>
          <AnalysisBlock text={selectedChoice.analysis} isCorrect={selectedChoice.ok} />
        </div>
      )}
    </div>
  );
}