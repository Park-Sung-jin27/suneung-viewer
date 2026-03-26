// ============================================================
// PassagePanel.jsx v5 — 완전 재작성
// ============================================================
import { CC } from './constants';

// 기호 밑줄 (㉠~㉮, ⓐ~ⓩ, ①~⑤)
const SYM_RE = /([㉠-㉮ⓐ-ⓩ①-⑤])/g;
function Underlined({ text }) {
  const parts = text.split(SYM_RE);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        SYM_RE.test(p)
          ? <span key={i} style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>{p}</span>
          : p
      )}
    </>
  );
}

// 행 구분 렌더링
function Lines({ text }) {
  if (!text.includes('\n')) return <Underlined text={text} />;
  return (
    <>
      {text.split('\n').map((line, i, arr) => (
        <span key={i}>
          <Underlined text={line} />
          {i < arr.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

// 해설 블록
function AnalysisBlock({ text }) {
  if (!text || text.length < 10) return null;
  const parts = text.split('➔').map(s => s.trim()).filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {parts.map((part, i) => {
        const isFact    = part.includes('[지문 팩트]');
        const isAnal    = part.includes('[선지 분析]') || part.includes('[선지 분석]');
        const isVerdict = part.includes('[소거 판별');
        const isPat     = /\[패턴/.test(part);
        let bg = '#f9fafb', bl = '#9ca3af', tc = '#374151', fw = '400', label = '';
        if (isFact)    { bg='#dbeafe'; bl='#3b82f6'; tc='#1e40af'; label='📌 지문 팩트'; }
        else if (isAnal)  { bg='#f3f4f6'; bl='#9ca3af'; tc='#374151'; label='🔍 선지 분析'; }
        else if (isVerdict) {
          const tv=/True/.test(part), fv=/False/.test(part);
          bg=tv?'#dcfce7':fv?'#fee2e2':'#f9fafb';
          bl=tv?'#16a34a':fv?'#dc2626':'#9ca3af';
          tc=tv?'#14532d':fv?'#7f1d1d':'#374151';
          fw='600'; label=tv?'✅ True':fv?'❌ False':'⚖️';
        }
        else if (isPat) { bg='#fef9c3'; bl='#ca8a04'; tc='#713f12'; label='🔖 패턴'; }
        const clean = part
          .replace(/\[지문 팩트\]/g,'').replace(/\[선지 분析\]/g,'')
          .replace(/\[선지 분석\]/g,'').replace(/\[소거 판별[^\]]*\]/g,'').trim();
        return (
          <div key={i} style={{
            background: bg, borderLeft: `3px solid ${bl}`, borderRadius: '4px',
            padding: '6px 10px', fontSize: '0.82rem', lineHeight: '1.6',
            color: tc, fontWeight: fw,
          }}>
            {label && <div style={{ fontSize: '0.7rem', fontWeight: '700', marginBottom: '2px', opacity: 0.8 }}>{label}</div>}
            <div style={{ whiteSpace: 'pre-wrap' }}>{clean}</div>
          </div>
        );
      })}
    </div>
  );
}

// 단일 sent 렌더링
function RenderSent({ sent, sel }) {
  if (sent.type === 'image') {
    return (
      <div style={{ margin: '16px 0', textAlign: 'center' }}>
        <img src={sent.url} alt={sent.alt || ''}
          style={{ maxWidth: '100%', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
        {sent.alt && <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', fontStyle: 'italic' }}>{sent.alt}</p>}
      </div>
    );
  }

  const t = sent.t || '';
  const st = sent.sentType || 'body';

  if (st === 'workTag') return (
    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#111827', marginTop: '18px', marginBottom: '4px' }}>
      {t}
    </div>
  );

  if (st === 'omission') return (
    <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', margin: '10px 0', letterSpacing: '0.1em' }}>
      {t}
    </div>
  );

  if (st === 'author') return (
    <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '0.82rem', color: '#6b7280', marginTop: '8px' }}>
      <Underlined text={t} />
    </div>
  );

  if (st === 'footnote') return (
    <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '5px', borderTop: '1px dashed #e5e7eb', paddingTop: '4px', lineHeight: '1.6' }}>
      <Underlined text={t} />
    </div>
  );

  // body — 형광펜
  const cs = sent.cs || [];
  const hit = sel != null && cs.length > 0 && cs.includes(sel);
  const cNum = hit ? parseInt(sel.split('_c')[1], 10) : null;
  const pal = (hit && CC[cNum]) ? CC[cNum] : null;
  const hlStyle = pal ? {
    background: pal.bg, borderRadius: '3px', padding: '1px 2px',
    boxShadow: `0 0 0 1.5px ${pal.border}`, transition: 'background 0.15s',
  } : {};

  return <span style={hlStyle}><Lines text={t} />{' '}</span>;
}

// sents 순서대로 렌더링 (pid 그룹핑 없음)
function renderAll(sents, sel) {
  const result = [];
  let buf = [];

  function flush() {
    if (!buf.length) return;
    result.push(
      <p key={buf[0].id} style={{ margin: '0 0 4px 0' }}>
        {buf.map(s => <RenderSent key={s.id} sent={s} sel={sel} />)}
      </p>
    );
    buf = [];
  }

  for (const s of sents) {
    const st = s.sentType || (s.type === 'image' ? 'image' : 'body');
    if (['workTag', 'omission', 'author', 'footnote', 'image'].includes(st)) {
      flush();
      result.push(<RenderSent key={s.id} sent={s} sel={sel} />);
    } else {
      buf.push(s);
    }
  }
  flush();
  return result;
}

export default function PassagePanel({ passageSet, sel, selectedChoice }) {
  if (!passageSet) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontSize: '0.74rem', color: '#9ca3af', fontWeight: '600',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
        {passageSet.range} · {passageSet.title}
      </div>
      <div style={{ fontSize: '0.92rem', lineHeight: '1.95', color: '#1f2937',
                    fontFamily: "'Noto Serif KR', serif" }}>
        {renderAll(passageSet.sents, sel)}
      </div>
      {selectedChoice?.analysis && selectedChoice.analysis.length > 10 && (
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#9ca3af',
                        marginBottom: '6px', letterSpacing: '0.06em' }}>
            💡 논리맵핑 해설
          </div>
          <AnalysisBlock text={selectedChoice.analysis} />
        </div>
      )}
    </div>
  );
}
