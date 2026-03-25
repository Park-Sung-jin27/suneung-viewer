import { CC } from './constants';

function AnalysisBlock({ text, isCorrect }) {
  if (!text) return null;
  const parts = text.split('➔').map(s => s.trim()).filter(Boolean);
  const blocks = parts.map((part, i) => {
    const isFact    = part.startsWith('[지문 팩트]');
    const isAnalysis = part.startsWith('[선지 분析]') || part.startsWith('[선지 분석]');
    const isPattern  = /^(\[패턴|①|②|③|④)/.test(part);

    let style = { textAlign: 'left', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '6px', borderRadius: '4px' };
    let label = part;

    if (isFact) {
      style = { ...style, background: '#e8f0fe', border: '1px solid #b0c4f8', borderLeft: '4px solid #3b82f6', padding: '10px 14px', color: '#1d4ed8' };
      label = part.replace('[지문 팩트]', '').trim();
    } else if (isAnalysis) {
      style = { ...style, background: '#f3f4f6', border: '1px solid #d1d5db', borderLeft: '4px solid #6b7280', padding: '10px 14px', color: '#374151' };
      label = part.replace(/\[선지 분[析석]\]/, '').trim();
    } else if (isPattern) {
      style = { ...style, marginTop: '6px', padding: '4px 0', color: isCorrect ? '#059669' : '#dc2626', fontWeight: '700' };
    } else {
      style = { ...style, padding: '4px 0', color: '#4b5563' };
    }
    return <div key={i} style={style}>{label}</div>;
  });
  return <div style={{ display: 'flex', flexDirection: 'column', marginTop: '12px' }}>{blocks}</div>;
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

  const renderText = sent.t.split('\n').map((line, i, arr) => (
    <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
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

  const filterSents = (sents) => {
    return sents.filter(sent => {
      if (sent.type === 'image') return true;
      const t = sent.t.trim();
      
      if (/^\[\s*\d+/.test(t) && /\]/.test(t)) return false;
      if (/^\([가-힣]\)/.test(t) && t.length < 50 && !t.endsWith('다.')) return false;

      return true;
    });
  };

  const filteredSents = filterSents(passageSet.sents);

  const paragraphs = filteredSents.reduce((acc, sent) => {
    const pid = sent.pid || 1; 
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(sent);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
      <div style={{ 
        fontSize: '0.82rem', color: '#1f2937', fontWeight: '800', 
        borderBottom: '2px solid #1f2937', paddingBottom: '10px',
        letterSpacing: '-0.02em'
      }}>
        {passageSet.range} <span style={{ color: '#e5e7eb', margin: '0 8px' }}>|</span> {passageSet.title} 
        {passageSet.author && <span style={{ color: '#6b7280', marginLeft: '6px', fontWeight: '500' }}>({passageSet.author})</span>}
      </div>
      
      <div style={{ fontSize: '0.93rem', lineHeight: '1.9', color: '#1f2937', display: 'flex', flexDirection: 'column', gap: '14px', wordBreak: 'keep-all' }}>
        {Object.entries(paragraphs).map(([pid, sents]) => (
          <p key={pid} style={{ margin: 0, textIndent: '10px' }}>
            {sents.map((sent, idx) => <SentenceSpan key={sent.id || idx} sent={sent} sel={sel} />)}
          </p>
        ))}
      </div>
      
      {selectedChoice && selectedChoice.analysis && (
        <div style={{ marginTop: '16px', borderTop: '2px dashed #e5e7eb', paddingTop: '16px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>💡 논리맵핑 해설</div>
          <AnalysisBlock text={selectedChoice.analysis} isCorrect={selectedChoice.ok} />
        </div>
      )}
    </div>
  );
}