import { useEffect, useRef } from "react";
import { CC } from "./constants";

// ── 기호 밑줄 (/g 플래그 금지) ───────────────────────────
const SYM_SPLIT = /([㉠-㉮ⓐ-ⓩ①-⑤])/;
const SYM_TEST = /[㉠-㉮ⓐ-ⓩ①-⑤]/;

function Underlined({ text }) {
  if (!SYM_TEST.test(text)) return <>{text}</>;
  const parts = text.split(SYM_SPLIT);
  return (
    <>
      {parts.map((p, i) =>
        SYM_TEST.test(p) ? (
          <span
            key={i}
            style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

// [[sym:KEY]] 제거 (지문 패널에서는 기호 이미지 불필요, 텍스트 제거)
// [도식/사진/그림/이미지: ...] placeholder 제거 (원본 설명문 노출 방지)
function stripSymTags(text) {
  if (!text) return "";
  return text
    .replace(/\[\[sym:\w+\]\]/g, "")
    .replace(/\[(?:도식|사진|그림|이미지)\s*:[^\]]+\]/g, "🖼");
}

function Lines({ text }) {
  const cleaned = stripSymTags(text || "");
  if (!cleaned.includes("\n")) return <Underlined text={cleaned} />;
  const rows = cleaned.split("\n");
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
  const cNum = parseInt(sel.split("_c")[1], 10);
  if (!cs.includes(sel)) return null;
  const pal = CC[cNum];
  if (!pal) return null;
  const spans = sent.csSpans?.[sel] || null;
  return { pal, spans };
}

// 부분 하이라이트 렌더링
//   spans: ["어구1", "어구2"] — text 내부 문자열
//   반환: JSX — spans 매칭되면 해당 부분만 hlStyle, 나머지는 Lines
//   매칭 실패 시 null 반환 → 호출측에서 전체 하이라이트 fallback 처리
function renderSpanParts(text, spans, hlStyle) {
  if (!text || !spans || spans.length === 0) return null;
  const hits = spans
    .map((s) => ({ text: s, idx: text.indexOf(s) }))
    .filter((h) => h.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  if (hits.length === 0) return null; // 매칭 실패 → fallback

  const parts = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.idx < cursor) continue; // 겹침 skip
    if (h.idx > cursor) parts.push({ t: text.slice(cursor, h.idx), hl: false });
    parts.push({ t: h.text, hl: true });
    cursor = h.idx + h.text.length;
  }
  if (cursor < text.length) parts.push({ t: text.slice(cursor), hl: false });

  return (
    <>
      {parts.map((p, i) =>
        p.hl ? (
          <span key={i} style={hlStyle} data-hl="true">
            <Lines text={p.t} />
          </span>
        ) : (
          <Lines key={i} text={p.t} />
        ),
      )}
    </>
  );
}

// ── inline annotation 스타일 ──
const BOX_STYLE = {
  border: "1px solid #555",
  borderRadius: "2px",
  padding: "0 3px",
};
const UL_STYLE = { textDecoration: "underline", textUnderlineOffset: "3px" };

function applyInlineAnns(text, anns) {
  if (!anns.length) return <Lines text={text} />;
  // 텍스트 내 등장 위치 순으로 정렬
  const sorted = anns
    .map((a) => ({ text: a.text, type: a.type, idx: text.indexOf(a.text) }))
    .filter((a) => a.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  if (!sorted.length) return <Lines text={text} />;

  const parts = [];
  let cursor = 0;
  for (const a of sorted) {
    if (a.idx < cursor) continue;
    if (a.idx > cursor)
      parts.push({ t: text.slice(cursor, a.idx), type: null });
    parts.push({ t: a.text, type: a.type });
    cursor = a.idx + a.text.length;
  }
  if (cursor < text.length) parts.push({ t: text.slice(cursor), type: null });

  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "box")
          return (
            <span key={i} style={BOX_STYLE}>
              <Lines text={p.t} />
            </span>
          );
        if (p.type === "underline")
          return (
            <span key={i} style={UL_STYLE}>
              <Lines text={p.t} />
            </span>
          );
        return <Lines key={i} text={p.t} />;
      })}
    </>
  );
}

function RenderSent({ sent, sel, anns }) {
  if (sent.type === "image") {
    return (
      <div style={{ margin: "16px 0", textAlign: "center" }}>
        <img
          src={sent.url}
          alt={sent.alt || ""}
          style={{
            maxWidth: "100%",
            borderRadius: "6px",
            border: "1px solid #e5e7eb",
          }}
        />
        {sent.alt && (
          <p
            style={{
              fontSize: "0.72rem",
              color: "#9ca3af",
              marginTop: "4px",
              fontStyle: "italic",
            }}
          >
            {sent.alt}
          </p>
        )}
      </div>
    );
  }

  const t = sent.t || "";
  const st = sent.sentType || "body";
  const hl = getHL(sent, sel); // { pal, spans } | null
  const pal = hl?.pal || null;
  const spans = hl?.spans || null;
  const hlStyle = pal
    ? {
        background: pal.bg,
        borderRadius: "3px",
        padding: "1px 3px",
        outline: `1.5px solid ${pal.border}`,
        outlineOffset: "1px",
      }
    : {};

  if (st === "workTag")
    return (
      <div
        style={{
          fontWeight: "700",
          fontSize: "0.9rem",
          color: "#111827",
          marginTop: "24px",
          marginBottom: "6px",
          paddingTop: "16px",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        {t}
      </div>
    );
  if (st === "verse") {
    const lines = t.split("\n");
    return (
      <div
        style={{
          margin: "2px 0",
          paddingLeft: "8px",
          lineHeight: "2.0",
        }}
        data-hl={pal && !spans ? "true" : undefined}
      >
        {lines.map((line, i) => {
          // spans 있으면 라인별 부분 하이라이트 시도
          if (pal && spans) {
            const spanJsx = renderSpanParts(line, spans, hlStyle);
            if (spanJsx) {
              // span 매칭 성공 → 라인 전체 outline 없이 span만 강조
              return <div key={i}>{spanJsx}</div>;
            }
            // span 매칭 실패 → 해당 라인 fallback (전체 하이라이트)
            return (
              <div key={i} style={hlStyle} data-hl="true">
                <Lines text={line} />
              </div>
            );
          }
          // pal 없음 또는 spans 없음 → 기존 동작
          return (
            <div key={i} style={pal ? hlStyle : {}}>
              <Lines text={line} />
            </div>
          );
        })}
      </div>
    );
  }
  if (st === "omission")
    return (
      <div
        style={{
          textAlign: "center",
          color: "#9ca3af",
          fontSize: "0.83rem",
          margin: "10px 0",
          letterSpacing: "0.1em",
        }}
      >
        {t}
      </div>
    );
  if (st === "author")
    return (
      <div
        style={{
          textAlign: "right",
          fontStyle: "italic",
          fontSize: "0.82rem",
          color: "#4b5563",
          marginTop: "10px",
          marginBottom: "6px",
        }}
      >
        <Underlined text={t} />
      </div>
    );
  if (st === "footnote")
    return (
      <div
        style={{
          fontSize: "0.78rem",
          color: "#6b7280",
          marginTop: "6px",
          borderTop: "1px dashed #e5e7eb",
          paddingTop: "5px",
          lineHeight: "1.6",
        }}
      >
        <Underlined text={t} />
      </div>
    );

  // body — spans 우선, 실패 시 기존 전체 하이라이트 fallback
  if (pal && spans) {
    // box/underline annotation보다 span 하이라이트 우선
    // (annotation은 span 매칭 실패 시 fallback 경로에서 처리)
    const spanJsx = renderSpanParts(t, spans, hlStyle);
    if (spanJsx) {
      return <span>{spanJsx} </span>;
    }
    // span 매칭 실패 → 전체 하이라이트 fallback
  }
  const content =
    anns.length > 0 ? applyInlineAnns(t, anns) : <Lines text={t} />;
  return (
    <span style={hlStyle} data-hl={pal ? "true" : undefined}>
      {content}{" "}
    </span>
  );
}

// ── bracket 유틸: sentIds 배열에서 범위 판정 ──
function getBracketInfo(sentId, brackets, sentIds) {
  for (const br of brackets) {
    const from = sentIds.indexOf(br.sentFrom);
    const to = sentIds.indexOf(br.sentTo);
    const cur = sentIds.indexOf(sentId);
    if (from < 0 || to < 0 || cur < 0) continue;
    if (cur >= from && cur <= to) {
      return { label: br.label, isFirst: cur === from };
    }
  }
  return null;
}

function renderAll(sents, sel, annotations) {
  const brackets = annotations.filter((a) => a.type === "bracket");
  const inlineTypes = new Set(["box", "underline"]);
  const sentIds = sents.map((s) => s.id);

  // sentId → inline annotations 매핑
  const annMap = {};
  for (const a of annotations) {
    if (inlineTypes.has(a.type) && a.sentId) {
      (annMap[a.sentId] ||= []).push(a);
    }
  }

  const result = [];
  let buf = [];

  function flush() {
    if (!buf.length) return;
    const brInfo = getBracketInfo(buf[0].id, brackets, sentIds);
    const hasBracket = !!brInfo;

    const inner = (
      <p key={"p_" + buf[0].id} style={{ margin: "0 0 5px 0" }}>
        {buf.map((s) => (
          <RenderSent key={s.id} sent={s} sel={sel} anns={annMap[s.id] || []} />
        ))}
      </p>
    );

    if (hasBracket) {
      result.push(
        <div
          key={"br_" + buf[0].id}
          style={{ borderLeft: "3px solid #888", paddingLeft: "8px" }}
        >
          {brInfo.isFirst && (
            <span
              style={{
                fontSize: "11px",
                color: "#888",
                display: "block",
                marginBottom: "2px",
              }}
            >
              [{brInfo.label}]
            </span>
          )}
          {inner}
        </div>,
      );
    } else {
      result.push(inner);
    }
    buf = [];
  }

  for (const s of sents) {
    const st = s.sentType || (s.type === "image" ? "image" : "body");
    if (
      ["workTag", "omission", "author", "footnote", "image", "verse"].includes(
        st,
      )
    ) {
      flush();
      result.push(
        <RenderSent key={s.id} sent={s} sel={sel} anns={annMap[s.id] || []} />,
      );
    } else {
      buf.push(s);
    }
  }
  flush();
  return result;
}

export default function PassagePanel({ passageSet, sel, mode }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!sel || !panelRef.current) return;
    const first = panelRef.current.querySelector("[data-hl]");
    if (first) {
      first.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [sel]);

  if (!passageSet) return null;
  const annotations = passageSet.annotations ?? [];
  // 풀이 모드에서 sel이 있어도 '전체 제출' 전(submitted 알 수 없으므로)
  // QuizPanel이 submitted 전엔 onSelChange를 호출하지 않으므로 sel은 null 유지됨
  // → 별도 처리 없이 sel 그대로 사용
  return (
    <div
      ref={panelRef}
      style={{ display: "flex", flexDirection: "column", gap: "14px" }}
    >
      <div
        style={{
          fontSize: "0.73rem",
          color: "#9ca3af",
          fontWeight: "600",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          borderBottom: "1px solid #f3f4f6",
          paddingBottom: "8px",
        }}
      >
        {passageSet.range} · {passageSet.title}
      </div>
      <div
        style={{
          fontSize: "0.92rem",
          lineHeight: "2.0",
          color: "#1f2937",
          fontFamily: "'Noto Serif KR', serif",
        }}
      >
        {renderAll(passageSet.sents || [], sel, annotations)}
      </div>
    </div>
  );
}
