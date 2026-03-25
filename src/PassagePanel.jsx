// ============================================================
// PassagePanel.jsx — 완전판
// sentType: body | author | footnote | workTag | omission | image
// ============================================================

import { CC } from './constants';

function AnalysisBlock({ text }) {
  if (!text) return null;
  const parts = text.split('➔').map(s => s.trim()).filter(Boolean);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'6px', padding:'12px 14px', background:'#fff', borderRadius:'8px', border:'1px solid #e5e7eb' }}>
      {parts.map((part, i) => {
        const isFact     = part.startsWith('[지문 팩트]');
        const isAnalysis = part.startsWith('[선지 분析]') || part.startsWith('[선지 분석]');
        const isVerdict  = part.startsWith('[소거 판별');
        const isPattern  = /^\[패턴|①|②|③|④/.test(part);
        let style = {}, label = null;
        if (isFact) {
          style = { background:'#e8f0fe', border:'1px solid #b0c4f8', borderLeft:'3px solid #3b82f6', color:'#1d3557' };
          label = '📌 지문 팩트';
        } else if (isAnalysis) {
          style = { background:'#f5f5f7', border:'1px solid #d1d5db', borderLeft:'3px solid #9ca3af', color:'#374151' };
          label = '🔍 선지 분析';
        } else if (isVerdict) {
          const t = /True/.test(part), f = /False/.test(part);
          style = { background:t?'#ecfdf5':f?'#fef2f2':'#f9fafb', border:`1px solid ${t?'#6ee7b7':f?'#fca5a5':'#e5e7eb'}`, borderLeft:`3px solid ${t?'#10b981':f?'#ef4444':'#9ca3af'}`, color:t?'#065f46':f?'#7f1d1d':'#374151', fontWeight:'600' };
          label = t ? '✅ 소거 판별: True' : f ? '❌ 소거 판별: False' : '⚖️ 소거 판별';
        } else if (isPattern) {
          style = { background:'#fef9e7', border:'1px solid #f9e07a', borderLeft:'3px solid #d4ac0d', color:'#7d6608', fontSize:'0.82rem' };
          label = '🔖 오답 패턴';
        }
        const cleanText = part.replace(/^\[지문 팩트\]/,'').replace(/^\[선지 분析\]/,'').replace(/^\[선지 분석\]/,'').replace(/^\[소거 판별[^\]]*\]/,'').trim();
        return (
          <div key={i} style={{ ...style, borderRadius:'5px', padding:'8px 12px', fontSize:'0.855rem', lineHeight:'1.65' }}>
            {label && <div style={{ fontSize:'0.75rem', fontWeight:'700', marginBottom:'3px', opacity:0.85 }}>{label}</div>}
            <div style={{ whiteSpace:'pre-wrap' }}>{cleanText}</div>
          </div>
        );
      })}
    </div>
  );
}

function renderLines(t) {
  if (!t.includes('\n')) return t;
  return t.split('\n').map((line, i, arr) => (
    <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
  ));
}

function SentenceSpan({ sent, sel }) {
  if (sent.type === 'image') {
    return (
      <div style={{ margin:'16px 0', textAlign:'center' }}>
        <img src={sent.url} alt={sent.alt} style={{ maxWidth:'100%', borderRadius:'6px', border:'1px solid #e5e7eb', boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }} />
        {sent.alt && <p style={{ fontSize:'0.72rem', color:'#9ca3af', marginTop:'4px', fontStyle:'italic' }}>{sent.alt}</p>}
      </div>
    );
  }

  const t = sent.t || '';
  const stype = sent.sentType || 'body';

  if (stype === 'workTag') {
    return <div style={{ display:'block', fontWeight:'700', fontSize:'0.88rem', color:'#374151', marginTop:'18px', marginBottom:'4px' }}>{t}</div>;
  }
  if (stype === 'omission') {
    return <div style={{ display:'block', textAlign:'center', color:'#9ca3af', fontSize:'0.85rem', margin:'10px 0', letterSpacing:'0.1em' }}>{t}</div>;
  }
  if (stype === 'author') {
    return <div style={{ display:'block', textAlign:'right', fontStyle:'italic', fontSize:'0.82rem', color:'#6b7280', marginTop:'8px', marginBottom:'2px', paddingRight:'4px' }}>{t}</div>;
  }
  if (stype === 'footnote') {
    return <div style={{ display:'block', fontSize:'0.78rem', color:'#6b7280', marginTop:'4px', paddingLeft:'2px', borderTop:'1px dashed #e5e7eb', paddingTop:'4px', lineHeight:'1.6' }}>{t}</div>;
  }

  // body — 형광펜
  const highlighted = sel && sent.cs && sent.cs.includes(sel);
  if (!highlighted) return <span>{renderLines(t)}{' '}</span>;
  const cNum = parseInt(sel.split('_c')[1], 10);
  const p = CC[cNum] || CC[1];
  return (
    <span style={{ background:p.bg, borderRadius:'3px', padding:'1px 3px', boxShadow:`0 0 0 1.5px ${p.border}`, transition:'background 0.15s' }}>
      {renderLines(t)}{' '}
    </span>
  );
}

export default function PassagePanel({ passageSet, sel, selectedChoice }) {
  if (!passageSet) return null;

  const paragraphs = passageSet.sents.reduce((acc, sent) => {
    const pid = sent.pid ?? 1;
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(sent);
    return acc;
  }, {});

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      <div style={{ fontSize:'0.78rem', color:'#6b7280', fontWeight:'600', letterSpacing:'0.05em', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', paddingBottom:'8px' }}>
        {passageSet.range} · {passageSet.title}
      </div>
      <div style={{ fontSize:'0.93rem', lineHeight:'1.9', color:'#1f2937', fontFamily:"'Noto Serif KR', serif" }}>
        {Object.entries(paragraphs).map(([pid, sents]) => {
          const hasBlock = sents.some(s => ['workTag','author','footnote','omission'].includes(s.sentType) || s.type === 'image');
          if (hasBlock) {
            return <div key={pid} style={{ marginBottom:'4px' }}>{sents.map(s => <SentenceSpan key={s.id} sent={s} sel={sel} />)}</div>;
          }
          return <p key={pid} style={{ margin:'0 0 4px 0' }}>{sents.map(s => <SentenceSpan key={s.id} sent={s} sel={sel} />)}</p>;
        })}
      </div>
      {selectedChoice?.analysis && (
        <div style={{ marginTop:'8px' }}>
          <div style={{ fontSize:'0.75rem', fontWeight:'700', color:'#6b7280', marginBottom:'6px', letterSpacing:'0.05em' }}>💡 논리맵핑 해설</div>
          <AnalysisBlock text={selectedChoice.analysis} />
        </div>
      )}
    </div>
  );
}