import { CC } from './constants';

// ── 기호 밑줄 (/g 플래그 금지) ───────────────────────────
const SYM_SPLIT = /([㉠-㉮ⓐ-ⓩ①-⑤])/;
const SYM_TEST  = /[㉠-㉮ⓐ-ⓩ①-⑤]/;

function Underlined({ text }) {
  if (!SYM_TEST.test(text)) return <>{text}</>;
  const parts = text.split(SYM_SPLIT);
  return (
    <>
      {parts.map((p, i) =>
        SYM_TEST.test(p)
          ? <span key={i} style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}>{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function Lines({ text }) {
  if (!text || !text.includes('\n')) return <Underlined text={text || ''} />;
  const rows = text.split('\n');
  return (
    <>
      {rows.map((row, i) => (
        <span key={i}>
          <Underlined text={row} />
          {i < rows.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

function getHL(sent, sel) {
  if (!sel) return null;
  const cs = sent.cs;
  if (!cs || cs.length === 0) return null;
  if (!cs.includes(sel)) return null;
  const cNum = parseInt(sel.split('_c')[1], 10);
  return CC[cNum] || null;
}

function RenderSent({ sent, sel }) {
  if (sent.type === 'image') {
    return (
      <div style={{ margin: '16px 0', textAlign: 'center' }}>
        <img src={sent.url} alt={sent.alt || ''}
          style={{ maxWidth: '100%', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
        {sent.alt && (
          <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px', fontStyle: 'italic' }}>
            {sent.alt}
          </p>
        )}
      </div>
    );
  }

  const t = sent.t || '';
  const st = sent.sentType || 'body';

  if (st === 'workTag') return (
    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#111827', marginTop: '20px', marginBottom: '4px' }}>{t}</div>
  );
  if (st === 'omission') return (
    <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.83rem', margin: '10px 0', letterSpacing: '0.1em' }}>{t}</div>
  );
  if (st === 'author') return (
    <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '0.82rem', color: '#4b5563', marginTop: '10px', marginBottom: '6px' }}>
      <Underlined text={t} />
    </div>
  );
  if (st === 'footnote') return (
    <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '6px', borderTop: '1px dashed #e5e7eb', paddingTop: '5px', lineHeight: '1.6' }}>
      <Underlined text={t} />
    </div>
  );

  const pal = getHL(sent, sel);
  const hlStyle = pal ? {
    background: pal.bg, borderRadius: '3px', padding: '1px 3px',
    outline: `1.5px solid ${pal.border}`, outlineOffset: '1px',
  } : {};
  return <span style={hlStyle}><Lines text={t} />{' '}</span>;
}

function renderAll(sents, sel) {
  const result = [];
  let buf = [];
  function flush() {
    if (!buf.length) return;
    result.push(
      <p key={'p_' + buf[0].id} style={{ margin: '0 0 5px 0' }}>
        {buf.map(s => <RenderSent key={s.id} sent={s} sel={sel} />)}
      </p>
    );
    buf = [];
  }
  for (const s of sents) {
    const st = s.sentType || (s.type === 'image' ? 'image' : 'body');
    if (['workTag','omission','author','footnote','image'].includes(st)) { flush(); result.push(<RenderSent key={s.id} sent={s} sel={sel} />); }
    else { buf.push(s); }
  }
  flush();
  return result;
}

export default function PassagePanel({ passageSet, sel }) {
  if (!passageSet) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontSize: '0.73rem', color: '#9ca3af', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
        {passageSet.range} · {passageSet.title}
      </div>
      <div style={{ fontSize: '0.92rem', lineHeight: '2.0', color: '#1f2937', fontFamily: "'Noto Serif KR', serif" }}>
        {renderAll(passageSet.sents || [], sel)}
      </div>
    </div>
  );
}