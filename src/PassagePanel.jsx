// ============================================================
// PassagePanel.jsx — v4
// pid 그룹핑 제거 → sents 순서대로 렌더링
// body 문장은 연속으로 인라인 묶음
// ============================================================
import { CC } from './constants';

// ── 해설 블록 ────────────────────────────────────────────
function AnalysisBlock({ text }) {
  if (!text) return null;
  const parts = text.split('➔').map(s => s.trim()).filter(Boolean);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'6px',
                  padding:'12px 14px', background:'#fff',
                  borderRadius:'8px', border:'1px solid #e5e7eb' }}>
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
          const tv = /True/.test(part), fv = /False/.test(part);
          style = { background:tv?'#ecfdf5':fv?'#fef2f2':'#f9fafb', border:`1px solid ${tv?'#6ee7b7':fv?'#fca5a5':'#e5e7eb'}`, borderLeft:`3px solid ${tv?'#10b981':fv?'#ef4444':'#9ca3af'}`, color:tv?'#065f46':fv?'#7f1d1d':'#374151', fontWeight:'600' };
          label = tv ? '✅ 소거 판별: True' : fv ? '❌ 소거 판별: False' : '⚖️ 소거 판별';
        } else if (isPattern) {
          style = { background:'#fef9e7', border:'1px solid #f9e07a', borderLeft:'3px solid #d4ac0d', color:'#7d6608', fontSize:'0.82rem' };
          label = '🔖 오답 패턴';
        }
        const clean = part.replace(/^\[지문 팩트\]/,'').replace(/^\[선지 분析\]/,'').replace(/^\[선지 분석\]/,'').replace(/^\[소거 판별[^\]]*\]/,'').trim();
        return (
          <div key={i} style={{ ...style, borderRadius:'5px', padding:'8px 12px', fontSize:'0.855rem', lineHeight:'1.65' }}>
            {label && <div style={{ fontSize:'0.75rem', fontWeight:'700', marginBottom:'3px', opacity:0.85 }}>{label}</div>}
            <div style={{ whiteSpace:'pre-wrap' }}>{clean}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── 기호 밑줄 렌더링 ────────────────────────────────────
const SYMBOL_RE = /([㉠-㉮ⓐ-ⓩ①-⑤])/g;
function withSymbolUnderline(text) {
  const parts = text.split(SYMBOL_RE);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    SYMBOL_RE.test(p)
      ? <span key={i} style={{ textDecoration:'underline', textUnderlineOffset:'2px' }}>{p}</span>
      : p
  );
}

// ── 행 구분(\n) 렌더링 ───────────────────────────────────
function renderBody(text) {
  if (!text.includes('\n')) return withSymbolUnderline(text);
  return text.split('\n').map((line, i, arr) => (
    <span key={i}>{withSymbolUnderline(line)}{i < arr.length - 1 && <br />}</span>
  ));
}

// ── 단일 sent 렌더링 ─────────────────────────────────────
function Sent({ sent, sel }) {
  // 이미지
  if (sent.type === 'image') {
    return (
      <div style={{ margin:'16px 0', textAlign:'center' }}>
        <img src={sent.url} alt={sent.alt}
          style={{ maxWidth:'100%', borderRadius:'6px',
                   border:'1px solid #e5e7eb', boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }} />
        {sent.alt && <p style={{ fontSize:'0.72rem', color:'#9ca3af', marginTop:'4px', fontStyle:'italic' }}>{sent.alt}</p>}
      </div>
    );
  }

  const t = sent.t || '';
  const stype = sent.sentType || 'body';

  // 작품 구분 태그 (가)/(나)/(다)
  if (stype === 'workTag') return (
    <div style={{ fontWeight:'700', fontSize:'0.9rem', color:'#111827',
                  marginTop:'20px', marginBottom:'4px' }}>
      {t}
    </div>
  );

  // (중략)
  if (stype === 'omission') return (
    <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'0.85rem',
                  margin:'10px 0', letterSpacing:'0.15em' }}>
      {t}
    </div>
  );

  // 작가/출처줄
  if (stype === 'author') return (
    <div style={{ textAlign:'right', fontStyle:'italic', fontSize:'0.82rem',
                  color:'#6b7280', marginTop:'10px', marginBottom:'4px' }}>
      {withSymbolUnderline(t)}
    </div>
  );

  // 각주
  if (stype === 'footnote') return (
    <div style={{ fontSize:'0.78rem', color:'#6b7280', marginTop:'6px',
                  borderTop:'1px dashed #e5e7eb', paddingTop:'5px', lineHeight:'1.65' }}>
      {withSymbolUnderline(t)}
    </div>
  );

  // body — 형광펜 처리
  const highlighted = sel && sent.cs && sent.cs.includes(sel);
  const cNum = highlighted ? parseInt(sel.split('_c')[1], 10) : null;
  const p = highlighted && CC[cNum] ? CC[cNum] : null;
  const hlStyle = p ? {
    background: p.bg, borderRadius:'3px', padding:'1px 3px',
    boxShadow:`0 0 0 1.5px ${p.border}`, transition:'background 0.15s',
  } : {};

  return <span style={hlStyle}>{renderBody(t)}{' '}</span>;
}

// ── 연속 body sents를 <p>로 묶는 렌더러 ─────────────────
function renderSents(sents, sel) {
  const result = [];
  let bodyBuffer = [];

  function flushBuffer() {
    if (!bodyBuffer.length) return;
    result.push(
      <p key={`p-${bodyBuffer[0].id}`} style={{ margin:'0 0 6px 0' }}>
        {bodyBuffer.map(s => <Sent key={s.id} sent={s} sel={sel} />)}
      </p>
    );
    bodyBuffer = [];
  }

  for (const sent of sents) {
    const stype = sent.sentType || (sent.type === 'image' ? 'image' : 'body');
    const isBlock = ['workTag','author','footnote','omission','image'].includes(stype);

    if (isBlock) {
      flushBuffer();
      result.push(<Sent key={sent.id} sent={sent} sel={sel} />);
    } else {
      bodyBuffer.push(sent);
    }
  }
  flushBuffer();
  return result;
}

// ── PassagePanel 메인 ────────────────────────────────────
export default function PassagePanel({ passageSet, sel, selectedChoice }) {
  if (!passageSet) return null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* 제목 */}
      <div style={{ fontSize:'0.75rem', color:'#9ca3af', fontWeight:'600',
                    letterSpacing:'0.06em', textTransform:'uppercase',
                    borderBottom:'1px solid #f3f4f6', paddingBottom:'8px' }}>
        {passageSet.range} · {passageSet.title}
      </div>

      {/* 지문 — sents 순서대로 */}
      <div style={{ fontSize:'0.92rem', lineHeight:'1.95', color:'#1f2937',
                    fontFamily:"'Noto Serif KR', 'Apple SD Gothic Neo', serif" }}>
        {renderSents(passageSet.sents, sel)}
      </div>

      {/* 해설 */}
      {selectedChoice?.analysis && (
        <div style={{ marginTop:'8px' }}>
          <div style={{ fontSize:'0.74rem', fontWeight:'700', color:'#9ca3af',
                        marginBottom:'6px', letterSpacing:'0.06em' }}>
            💡 논리맵핑 해설
          </div>
          <AnalysisBlock text={selectedChoice.analysis} />
        </div>
      )}
    </div>
  );
}
