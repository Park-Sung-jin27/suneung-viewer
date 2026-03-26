import { CC } from './constants';

// ── 기호 밑줄 ──────────────────────────────────────────────
// 주의: 전역 /g 플래그 정규식은 lastIndex 버그 유발 → 사용 금지
const SYM_SPLIT = /([㉠-㉮ⓐ-ⓩ①-⑤])/;   // 그룹 포함, g 없음
const SYM_TEST  = /[㉠-㉮ⓐ-ⓩ①-⑤]/;     // 테스트용, g 없음

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

// ── 행 구분 (\n → <br>) ────────────────────────────────────
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

// ── 해설 블록 ──────────────────────────────────────────────
function AnalysisBlock({ text }) {
  if (!text || text.trim().length < 5) return null;

  // ➔ 구분자 있으면 파싱, 없으면 전체를 단일 블록으로
  const chunks = text.includes('➔')
    ? text.split('➔').map(s => s.trim()).filter(Boolean)
    : [text.trim()];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {chunks.map((chunk, i) => {
        let bg = '#f9fafb', bl = '#d1d5db', tc = '#374151', label = '';
        if (chunk.includes('[지문 팩트]')) {
          bg = '#dbeafe'; bl = '#3b82f6'; tc = '#1e40af'; label = '📌 지문 팩트';
        } else if (chunk.includes('[선지 분析]') || chunk.includes('[선지 분석]')) {
          bg = '#f3f4f6'; bl = '#9ca3af'; tc = '#374151'; label = '🔍 선지 분析';
        } else if (chunk.includes('[소거 판별')) {
          const isTrue = /True/.test(chunk);
          const isFalse = /False/.test(chunk);
          bg = isTrue ? '#dcfce7' : isFalse ? '#fee2e2' : '#f9fafb';
          bl = isTrue ? '#16a34a' : isFalse ? '#dc2626' : '#9ca3af';
          tc = isTrue ? '#14532d' : isFalse ? '#7f1d1d' : '#374151';
          label = isTrue ? '✅ True' : isFalse ? '❌ False' : '⚖️';
        } else if (/\[패턴/.test(chunk)) {
          bg = '#fef9c3'; bl = '#ca8a04'; tc = '#713f12'; label = '🔖 패턴';
        }

        const clean = chunk
          .replace(/\[지문 팩트\]/g, '')
          .replace(/\[선지 분析\]/g, '')
          .replace(/\[선지 분석\]/g, '')
          .replace(/\[소거 판별[^\]]*\]/g, '')
          .replace(/\[패턴[^\]]*\]/g, '')
          .trim();

        return (
          <div key={i} style={{
            background: bg,
            borderLeft: `3px solid ${bl}`,
            borderRadius: '0 5px 5px 0',
            padding: '7px 11px',
            fontSize: '0.82rem',
            lineHeight: '1.65',
            color: tc,
          }}>
            {label && (
              <div style={{ fontSize: '0.68rem', fontWeight: '700', marginBottom: '3px', opacity: 0.75 }}>
                {label}
              </div>
            )}
            <div style={{ whiteSpace: 'pre-wrap' }}>{clean}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── 형광펜 색상 결정 ─────────────────────────────────────
function getHL(sent, sel) {
  if (!sel) return null;
  const cs = sent.cs;
  if (!cs || cs.length === 0) return null;
  if (!cs.includes(sel)) return null;
  const cNum = parseInt(sel.split('_c')[1], 10);
  return CC[cNum] || null;
}

// ── 단일 sent 렌더링 ─────────────────────────────────────
function RenderSent({ sent, sel }) {
  // 이미지
  if (sent.type === 'image') {
    return (
      <div style={{ margin: '14px 0', textAlign: 'center' }}>
        <img
          src={sent.url}
          alt={sent.alt || ''}
          style={{ maxWidth: '100%', borderRadius: '6px', border: '1px solid #e5e7eb' }}
        />
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

  // workTag: (가)/(나) 등
  if (st === 'workTag') {
    return (
      <div style={{
        fontWeight: '700', fontSize: '0.9rem', color: '#111827',
        marginTop: '20px', marginBottom: '4px',
      }}>
        {t}
      </div>
    );
  }

  // omission: (중략)
  if (st === 'omission') {
    return (
      <div style={{
        textAlign: 'center', color: '#9ca3af',
        fontSize: '0.83rem', margin: '10px 0', letterSpacing: '0.1em',
      }}>
        {t}
      </div>
    );
  }

  // author: 오른쪽 이탤릭
  if (st === 'author') {
    return (
      <div style={{
        textAlign: 'right', fontStyle: 'italic',
        fontSize: '0.82rem', color: '#6b7280', marginTop: '8px',
      }}>
        <Underlined text={t} />
      </div>
    );
  }

  // footnote: 점선 위 작은 글씨
  if (st === 'footnote') {
    return (
      <div style={{
        fontSize: '0.78rem', color: '#6b7280',
        marginTop: '6px', borderTop: '1px dashed #e5e7eb',
        paddingTop: '5px', lineHeight: '1.6',
      }}>
        <Underlined text={t} />
      </div>
    );
  }

  // body: 형광펜
  const pal = getHL(sent, sel);
  const hlStyle = pal ? {
    background: pal.bg,
    borderRadius: '3px',
    padding: '1px 3px',
    outline: `1.5px solid ${pal.border}`,
    outlineOffset: '1px',
  } : {};

  return (
    <span style={{ ...hlStyle }}>
      <Lines text={t} />
      {' '}
    </span>
  );
}

// ── 전체 sents 렌더링 (pid 그룹핑 없음) ──────────────────
function renderAll(sents, sel) {
  const result = [];
  let buf = [];

  function flushBuf() {
    if (buf.length === 0) return;
    result.push(
      <p key={'p_' + buf[0].id} style={{ margin: '0 0 5px 0' }}>
        {buf.map(s => <RenderSent key={s.id} sent={s} sel={sel} />)}
      </p>
    );
    buf = [];
  }

  for (const s of sents) {
    const st = s.sentType || (s.type === 'image' ? 'image' : 'body');
    if (['workTag', 'omission', 'author', 'footnote', 'image'].includes(st)) {
      flushBuf();
      result.push(<RenderSent key={s.id} sent={s} sel={sel} />);
    } else {
      buf.push(s);
    }
  }
  flushBuf();
  return result;
}

// ── 메인 컴포넌트 ────────────────────────────────────────
export default function PassagePanel({ passageSet, sel, selectedChoice }) {
  if (!passageSet) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 지문 헤더 */}
      <div style={{
        fontSize: '0.73rem', color: '#9ca3af', fontWeight: '600',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        borderBottom: '1px solid #f3f4f6', paddingBottom: '8px',
      }}>
        {passageSet.range} · {passageSet.title}
      </div>

      {/* 지문 본문 */}
      <div style={{
        fontSize: '0.92rem', lineHeight: '2.0', color: '#1f2937',
        fontFamily: "'Noto Serif KR', serif",
      }}>
        {renderAll(passageSet.sents || [], sel)}
      </div>

      {/* 논리맵핑 해설 */}
      {selectedChoice?.analysis && selectedChoice.analysis.trim().length > 5 && (
        <div>
          <div style={{
            fontSize: '0.72rem', fontWeight: '700', color: '#9ca3af',
            marginBottom: '7px', letterSpacing: '0.06em',
          }}>
            💡 논리맵핑 해설
          </div>
          <AnalysisBlock text={selectedChoice.analysis} />
        </div>
      )}
    </div>
  );
}
