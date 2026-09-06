import { useEffect, useRef } from "react";
import { CC, FIGURE_IMAGE_MAP, MARKER_LABEL_STYLE } from "./constants";
import { isFreeProYear } from "./freeAccess";

// ── 기호 밑줄 + 영역 라벨 hide (/g 플래그 금지) ──
// SYM_SPLIT: ㉠-㉿ⓐ-ⓩ①-⑤ + [A-F] 라벨 단독 path 안 단일 정규식 분리.
//   2026-06-27 발주 5-B 안 범위 확장 [㉠-㉮] → [㉠-㉿] path 정합
//   (㉯~㉹ 안 15+ 마커 path 안 legacy 시험 지원 정합).
//   hideLabels 플래그 안 라벨 [A-F] = visibility:hidden 적용 (글자 안 보임 +
//   자리 유지) path → body / verse sentType 단독 적용 (RenderSent path 안 결정).
const SYM_SPLIT = /([㉠-㉿ⓐ-ⓩ①-⑤]|\[[A-F]\])/;
const SYM_TEST = /[㉠-㉿ⓐ-ⓩ①-⑤]|\[[A-F]\]/;
const SYM_UNDERLINE_RE = /^[㉠-㉿ⓐ-ⓩ①-⑤]$/;
const LABEL_RE = /^\[[A-F]\]$/;

function Underlined({ text, hideLabels }) {
  if (!SYM_TEST.test(text)) return <>{text}</>;
  const parts = text.split(SYM_SPLIT);
  return (
    <>
      {parts.map((p, i) => {
        if (LABEL_RE.test(p)) {
          if (hideLabels) {
            return (
              <span key={i} style={{ visibility: "hidden" }}>
                {p}
              </span>
            );
          }
          return <span key={i}>{p}</span>;
        }
        if (SYM_UNDERLINE_RE.test(p)) {
          return (
            <span
              key={i}
              style={{
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              {p}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
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

function Lines({ text, hideLabels }) {
  const cleaned = stripSymTags(text || "");
  if (!cleaned.includes("\n"))
    return <Underlined text={cleaned} hideLabels={hideLabels} />;
  const rows = cleaned.split("\n");
  return (
    <>
      {rows.map((row, i) => (
        <span key={i}>
          <Underlined text={row} hideLabels={hideLabels} />
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

// ── span 부분 하이라이트 매칭 유틸 ──
//
// 설계:
//   1차  원문 직접 indexOf
//   2차  길이 보존 정규화 (NBSP/스마트따옴표 → 일반 문자) 후 indexOf
//         → 공백 개수를 바꾸지 않으므로 정규화 텍스트의 인덱스를 원문에 그대로 적용 가능
//   3차  공백 유연 regex (연속 공백 차이 흡수)
//   전부 실패 → 하나라도 매칭 못 하면 null 반환 (all-or-nothing fallback)

function normalizeText(text) {
  // 길이 보존: 코드포인트 치환만 수행, 공백 압축(\s+→" ") 금지
  //   — 공백 압축 시 인덱스가 어긋나 원문 슬라이스 위치가 깨짐
  return (text || "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

const RE_SPECIAL = /[.*+?^${}()|[\]\\]/g;
function escapeRegex(s) {
  return s.replace(RE_SPECIAL, "\\$&");
}

// span을 공백 유연 regex로 변환 (연속 공백 허용)
function spanToFlexRegex(spanText) {
  const normalized = normalizeText(spanText);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const pattern = tokens.map(escapeRegex).join("[\\s\\u00A0]+");
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

function findSpanRanges(rawText, spanTexts) {
  if (!rawText || !Array.isArray(spanTexts) || spanTexts.length === 0)
    return null;
  const ranges = [];
  const normRaw = normalizeText(rawText); // 길이 보존 — 인덱스 그대로 사용 가능

  for (const spanText of spanTexts) {
    if (!spanText) continue;
    // 1차: 원문 직접
    let idx = rawText.indexOf(spanText);
    if (idx !== -1) {
      ranges.push({ start: idx, end: idx + spanText.length });
      continue;
    }
    // 2차: 길이 보존 정규화 (인덱스 동일)
    const normSpan = normalizeText(spanText);
    idx = normRaw.indexOf(normSpan);
    if (idx !== -1) {
      ranges.push({ start: idx, end: idx + normSpan.length });
      continue;
    }
    // 3차: 공백 유연 regex
    const re = spanToFlexRegex(spanText);
    if (re) {
      const m = rawText.match(re);
      if (m && typeof m.index === "number" && m.index >= 0) {
        ranges.push({ start: m.index, end: m.index + m[0].length });
        continue;
      }
    }
    // 하나라도 실패 → 전체 fallback
    if (typeof console !== "undefined") {
      console.warn("[span-match-failed]", {
        spanText,
        rawPreview: rawText.slice(0, 60),
      });
    }
    return null;
  }

  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}

function renderWithRanges(text, ranges, hlStyle, hideLabels) {
  if (!ranges || ranges.length === 0) return null;
  const parts = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start < cursor) continue; // 겹침 skip
    if (r.start > cursor)
      parts.push({ t: text.slice(cursor, r.start), hl: false });
    parts.push({ t: text.slice(r.start, r.end), hl: true });
    cursor = r.end;
  }
  if (cursor < text.length) parts.push({ t: text.slice(cursor), hl: false });

  return (
    <>
      {parts.map((p, i) =>
        p.hl ? (
          <span key={i} style={hlStyle} data-hl="true">
            <Lines text={p.t} hideLabels={hideLabels} />
          </span>
        ) : (
          <Lines key={i} text={p.t} hideLabels={hideLabels} />
        ),
      )}
    </>
  );
}

// 부분 하이라이트 렌더링
//   spans: ["어구1", "어구2"] — text 내부 문자열
//   반환: JSX — 모든 span 매칭 성공 시 해당 부분만 hlStyle
//   매칭 실패(하나라도) 시 null → 호출측에서 전체 하이라이트 fallback
function renderSpanParts(text, spans, hlStyle, hideLabels) {
  if (!text || !spans || spans.length === 0) return null;
  const ranges = findSpanRanges(text, spans);
  if (!ranges || ranges.length === 0) return null;
  return renderWithRanges(text, ranges, hlStyle, hideLabels);
}

// ── inline annotation 스타일 ──
const BOX_STYLE = {
  border: "1px solid #555",
  borderRadius: "2px",
  padding: "0 3px",
};
const UL_STYLE = { textDecoration: "underline", textUnderlineOffset: "3px" };
// marker label (㉠ ⓐ 등) 스타일은 src/constants.js 가 정본이다 (발주 F-67).
//   <보기> 쪽(QuizPanel)이 같은 모양을 써야 해서 한 곳에 뒀다.
//   annotations.json schema: { type:"marker", marker:"ⓐ", sentId, text }
//   visual_marks.json schema: { type:"marker", label:"ⓐ", text, ... }

// applyInlineAnns(text, anns)
//   anns: [{ type: 'underline'|'box'|'marker', text, marker? }]
//   marker type 사양: ann.marker 안 라벨 (㉠ ⓐ 등) — text 사전 위첨자 노출 path
//     + text 안 underline 데코 추가 (Korean 수능 PDF 사양 정합).
//   QuizPanel choice/bogi underline 사양 path 안 재사용 의무 export.
export function applyInlineAnns(text, anns, hideLabels) {
  if (!anns.length) return <Lines text={text} hideLabels={hideLabels} />;
  // 텍스트 내 등장 위치 순으로 정렬
  const sorted = anns
    .map((a) => ({
      text: a.text,
      type: a.type,
      marker: a.marker || a.label || null,
      idx: text.indexOf(a.text),
    }))
    .filter((a) => a.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  if (!sorted.length) return <Lines text={text} hideLabels={hideLabels} />;

  const parts = [];
  let cursor = 0;
  for (const a of sorted) {
    if (a.idx < cursor) continue;
    if (a.idx > cursor)
      parts.push({ t: text.slice(cursor, a.idx), type: null });
    // suppressSup: avoid duplicate marker label when sent.t already has it inline (anywhere before a.idx)
    const before = a.idx > 0 ? text.slice(0, a.idx) : "";
    const suppressSup =
      a.type === "marker" && a.marker && before.includes(a.marker);
    parts.push({ t: a.text, type: a.type, marker: a.marker, suppressSup });
    cursor = a.idx + a.text.length;
  }
  if (cursor < text.length) parts.push({ t: text.slice(cursor), type: null });

  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "box")
          return (
            <span key={i} style={BOX_STYLE}>
              <Lines text={p.t} hideLabels={hideLabels} />
            </span>
          );
        if (p.type === "underline")
          return (
            <span key={i} style={UL_STYLE}>
              <Lines text={p.t} hideLabels={hideLabels} />
            </span>
          );
        if (p.type === "marker")
          return (
            <span key={i}>
              {p.marker && !p.suppressSup && (
                <sup style={MARKER_LABEL_STYLE}>{p.marker}</sup>
              )}
              <span style={UL_STYLE}>
                <Lines text={p.t} hideLabels={hideLabels} />
              </span>
            </span>
          );
        return <Lines key={i} text={p.t} hideLabels={hideLabels} />;
      })}
    </>
  );
}

// AI 인용 형광펜 스타일 (노란 강조 path) — sel/cs_ids 형광펜 안 배타 정합
//   path: 배경 옅은 노랑 + 진한 노랑 outline + 클릭 스크롤 대상 marker.
const AI_CITED_STYLE = {
  background: "#fef3c7",
  outline: "1.5px solid #f59e0b",
  outlineOffset: "1px",
  borderRadius: "3px",
  padding: "1px 3px",
  boxDecorationBreak: "clone",
  WebkitBoxDecorationBreak: "clone",
};

function RenderSent({ sent, sel, anns, aiCited }) {
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
        // line wrap 시 background/outline 이 줄 끝(여백)까지 차는 결함 fix:
        // box-decoration-break: clone → wrap 된 각 line 의 background 가 텍스트 폭에서 끊김
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
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
  // figure: 지문 중간 이미지/도식. FIGURE_IMAGE_MAP에 매핑되면 <img> 렌더링,
  //         매핑 없으면 원문 placeholder([도식: ...])를 그대로 <Lines>로 노출
  //         (stripSymTags가 🖼 이모지로 치환)
  if (st === "figure") {
    const fig = FIGURE_IMAGE_MAP[sent.id];
    if (fig) {
      return (
        <div style={{ margin: "16px 0", textAlign: "center" }}>
          <img
            src={fig.url}
            alt={fig.alt || ""}
            style={{
              maxWidth: "100%",
              borderRadius: "6px",
              border: "1px solid #e5e7eb",
            }}
          />
          {fig.alt && (
            <p
              style={{
                fontSize: "0.72rem",
                color: "#9ca3af",
                marginTop: "4px",
                fontStyle: "italic",
              }}
            >
              {fig.alt}
            </p>
          )}
        </div>
      );
    }
    return (
      <div
        style={{
          color: "#9ca3af",
          fontSize: "0.82rem",
          textAlign: "center",
          margin: "10px 0",
        }}
      >
        <Lines text={t} />
      </div>
    );
  }
  if (st === "verse") {
    const lines = t.split("\n");
    return (
      <div
        style={{
          margin: "2px 0",
          paddingLeft: "8px",
          lineHeight: "2.0",
        }}
        data-sent-id={sent.id}
        data-hl={pal && !spans ? "true" : undefined}
      >
        {lines.map((line, i) => {
          // spans 있으면 라인별 부분 하이라이트 시도
          if (pal && spans) {
            const spanJsx = renderSpanParts(line, spans, hlStyle, true);
            if (spanJsx) {
              // span 매칭 성공 → 라인 전체 outline 없이 span만 강조
              return <div key={i}>{spanJsx}</div>;
            }
            // span 매칭 실패 → 해당 라인 fallback (전체 하이라이트)
            // verse 결함 정정: <div> 가 block-level 이라 line 끝 여백까지 background 가 차는 결함.
            //   <span style={hlStyle}> 로 inline wrap → 텍스트 폭만큼만 background 적용.
            return (
              <div key={i}>
                <span style={hlStyle} data-hl="true">
                  {anns.length > 0 ? (
                    applyInlineAnns(line, anns, true)
                  ) : (
                    <Lines text={line} hideLabels={true} />
                  )}
                </span>
              </div>
            );
          }
          // pal 없음 또는 spans 없음 → 기존 동작 + anns 적용 (underline/box)
          // verse 결함 정정: pal 있는 경우 <span> wrap (line 끝 여백까지 background 안 차도록)
          return (
            <div key={i}>
              {pal ? (
                <span style={hlStyle} data-hl="true">
                  {anns.length > 0 ? (
                    applyInlineAnns(line, anns, true)
                  ) : (
                    <Lines text={line} hideLabels={true} />
                  )}
                </span>
              ) : anns.length > 0 ? (
                applyInlineAnns(line, anns, true)
              ) : (
                <Lines text={line} hideLabels={true} />
              )}
            </div>
          );
        })}
      </div>
    );
  }
  // 발주 F-70 ②: 지면 대조 결과 회색·자간 확대는 근거가 없었다.
  //   색을 본문과 같은 검정으로 되돌리고 letterSpacing 을 뺀다.
  //   중앙 정렬은 지면에 부합하므로 유지한다.
  if (st === "omission")
    return (
      <div
        style={{
          textAlign: "center",
          color: "#1f2937",
          fontSize: "0.83rem",
          // 중략·줄거리 표시는 앞뒤 지문과 한 줄씩 띄움 (2026-06-05 사양)
          margin: "1.6em 0",
        }}
      >
        {t}
      </div>
    );
  // 발주 F-70 ①: [앞부분의 줄거리] 등 요약 블록. D-209 지면 실측 근거 —
  //   본문(0.92rem · 행간 2.0 · 명조)과 달리 고딕 계열이고 글자가 작으며
  //   앞뒤 여백이 넓고 내부 행간은 좁다(10.23~10.72/11.21pt, 전후 27/23 대
  //   행간 18.3 → 약 1.4배).
  //   ★ 여백은 rem 으로 쓴다. em 이면 자기 글자 크기(0.84rem) 기준이 되어
  //     본문 행간의 1.4배가 되지 않는다.
  //   ★ 연속 summary 는 인접 형제 마진이 상쇄되어 여백이 겹쳐 쌓이지 않는다
  //     (부모가 flex 가 아니라 일반 흐름이다 — 확인함).
  // 발주 F-71: summary 는 renderAll 이 연속 구간째로 SummaryBlock 에 넘긴다.
  //   여기에 분기를 남겨 두면 정본이 둘이 된다(F-66 의 필터/매처 어긋남과 같은
  //   함정). 단일 문장도 길이 1인 구간으로 같은 경로를 탄다.
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

  // 극문학 (stage 지시문 / speech 대사) — 각 sent 단독 줄 path.
  //   cs_ids 형광펜 + inline annotation (box/underline/marker) 회귀 0 유지.
  //   spans 우선 fallback → anns 우선 fallback → Lines 단독 path.
  if (st === "stage" || st === "speech") {
    const isStage = st === "stage";
    const stStyle = isStage
      ? {
          fontStyle: "italic",
          color: "#6b7280",
          paddingLeft: "1.2em",
          margin: "2px 0",
        }
      : {
          margin: "2px 0",
        };
    let inner;
    if (pal && spans) {
      const spanJsx = renderSpanParts(t, spans, hlStyle, true);
      if (spanJsx) inner = spanJsx;
    }
    if (!inner) {
      const content =
        anns.length > 0 ? (
          applyInlineAnns(t, anns, true)
        ) : (
          <Lines text={t} hideLabels={true} />
        );
      inner = pal ? (
        <span style={hlStyle} data-hl="true">
          {content}
        </span>
      ) : (
        content
      );
    }
    return (
      <div style={stStyle} data-sent-id={sent.id}>
        {inner}
      </div>
    );
  }

  // sentClass — 안내장 등 특수 시각 효과 (block-level 단독 렌더)
  //   announcement-title: 큰 글씨 + 중앙 정렬 (안내장 제목)
  //   announcement: 다른 폰트 + 옅은 색 + 상하 여백 (안내장 본문)
  //   cs_ids 하이라이트와 inline annotation(box/underline/marker)은 그대로 적용.
  const sc = sent.sentClass || "";
  if (sc === "announcement-title" || sc === "announcement") {
    const scStyle =
      sc === "announcement-title"
        ? {
            fontSize: "1.4rem",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: "16px",
          }
        : {
            fontFamily: "'Noto Serif KR', serif",
            color: "#4b5563",
            paddingTop: "8px",
            paddingBottom: "8px",
          };
    let inner;
    if (pal && spans) {
      const spanJsx = renderSpanParts(t, spans, hlStyle, true);
      if (spanJsx) {
        inner = spanJsx;
      }
    }
    if (!inner) {
      const content =
        anns.length > 0 ? (
          applyInlineAnns(t, anns, true)
        ) : (
          <Lines text={t} hideLabels={true} />
        );
      inner = pal ? (
        <span style={hlStyle} data-hl="true">
          {content}
        </span>
      ) : (
        content
      );
    }
    return (
      <div style={scStyle} data-sent-id={sent.id}>
        {inner}
      </div>
    );
  }

  // body — spans 우선, 실패 시 기존 전체 하이라이트 fallback
  if (pal && spans) {
    // box/underline annotation보다 span 하이라이트 우선
    // (annotation은 span 매칭 실패 시 fallback 경로에서 처리)
    const spanJsx = renderSpanParts(t, spans, hlStyle, true);
    if (spanJsx) {
      // AI 인용 path 안 spans 형광펜 우선 정합 유지 + 외부 wrapper 안
      // 노란 outline 부가 정합 path 정합 (겹침 시각 명확 정합).
      return (
        <span
          style={aiCited ? AI_CITED_STYLE : undefined}
          /* 발주 F-15: data-hl 은 문장이 아니라 하이라이트 "조각"에 붙는다.
             조각이 문장 뒤쪽이면 앞부분이 화면 위로 잘리므로,
             스크롤은 문장 단위로 올라가야 한다. 그 앵커. */
          data-sent-id={sent.id}
          data-ai-cited={aiCited ? "true" : undefined}
        >
          {spanJsx}{" "}
        </span>
      );
    }
    // span 매칭 실패 → 전체 하이라이트 fallback
  }
  const content =
    anns.length > 0 ? (
      applyInlineAnns(t, anns, true)
    ) : (
      <Lines text={t} hideLabels={true} />
    );
  // AI 인용 안 sel 형광펜 배타 정합 path — pal 존재 시 sel 우선, 부재 시 AI
  //   형광펜 단독 노출 정합 (겹침 사실 잠재 path 회피).
  const combinedStyle = aiCited && !pal ? AI_CITED_STYLE : hlStyle;
  return (
    <span
      style={combinedStyle}
      data-sent-id={sent.id}
      data-hl={pal ? "true" : undefined}
      data-ai-cited={aiCited ? "true" : undefined}
    >
      {content}{" "}
    </span>
  );
}

// ── bracket 유틸 (Phase 2.2 — 통합 시각 path) ──
// hideLabel path 폐기 (결함 B+C 정정): body / verse sent.t 안 "[X]" 인라인 텍스트
//   = RenderSent path 안 hideLabels=true 안 visibility:hidden 적용 (자리 유지) →
//   좌측 측면 라벨 단독 노출 (l2022a 형태) 통일 path. hide trigger 결정 X.
// 발주 F-51: 안내 박스 안 행동 링크 공용 스타일
const NOTICE_ACTION = {
  border: "1px solid #d97706",
  background: "#fff",
  color: "#92400e",
  borderRadius: "6px",
  padding: "5px 12px",
  fontSize: "0.75rem",
  fontWeight: 700,
  textDecoration: "none",
  fontFamily: "'Noto Sans KR', sans-serif",
};

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

// 통합 bracket 컨테이너 (결함 1 정정): body + verse + workTag 등 모든 sentType
//   단일 시각 형태 (좌측 큰 대괄호 [) path.
// 결함 A 정정 (option 2): 외부 wrapper paddingLeft 44px 통일 path 안 bracket
//   안/밖 본문 동일 좌측 정렬. 라벨/대괄호 = container 좌측 음수 위치 (wrapper
//   padding 영역 안 노출).
function BracketContainer({ label, children }) {
  return (
    <div
      style={{
        position: "relative",
        paddingTop: "0",
        paddingBottom: "0",
        margin: "0",
      }}
    >
      {/* 좌측 큰 대괄호 [ — container 좌측 외부 18px 위치 */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: "-18px",
          top: 0,
          bottom: 0,
          width: "10px",
          borderLeft: "2px solid #555",
          borderTop: "2px solid #555",
          borderBottom: "2px solid #555",
          borderTopLeftRadius: "2px",
          borderBottomLeftRadius: "2px",
        }}
      />
      {/* 라벨 [X] — 대괄호 바깥 좌측 + 세로 중앙 정렬 */}
      <span
        style={{
          position: "absolute",
          left: "-44px",
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "0.82rem",
          fontWeight: 700,
          color: "#555",
          padding: "0 2px",
          lineHeight: 1,
        }}
      >
        [{label}]
      </span>
      {children}
    </div>
  );
}

// 발주 F-70/F-71: 줄거리 블록. D-209 지면 실측 근거 —
//   본문(0.92rem · 행간 2.0 · 명조)과 달리 고딕이고 글자가 작으며 앞뒤 여백이
//   넓고 내부 행간은 좁다(10.23~10.72/11.21pt, 전후 27/23 대 행간 18.3 ≈ 1.4배).
//   ★ 여백은 rem 이다. em 이면 자기 글자 크기(0.84rem) 기준이 되어 본문 행간의
//     1.4배가 되지 않는다.
const SUMMARY_BLOCK_STYLE = {
  textAlign: "left",
  color: "#1f2937",
  fontSize: "0.84rem",
  fontFamily: "'Noto Sans KR', sans-serif",
  margin: "2.58rem 0",
  lineHeight: 1.7,
};
const SUMMARY_LABEL_RE = /^\s*(\[[^\]]*\])\s*([\s\S]*)$/;

// 발주 F-71: 연속 summary 문장을 한 블록으로 묶는다.
//   문장마다 div 를 따로 내면 문장 사이에도 2.58rem 이 들어가 한 덩어리 줄거리가
//   갈라진다(마진 상쇄는 2배가 되는 것만 막지, 사이 여백 자체를 없애지 않는다).
//   여백은 바깥 블록에만 두고 안쪽은 줄바꿈만 한다.
//   ★ 라벨 볼드는 블록 첫 줄(지시문)에만 준다.
function SummaryBlock({ items }) {
  return (
    <div style={SUMMARY_BLOCK_STYLE}>
      {items.map((it, idx) => {
        const t = it.sent.t;
        const m = idx === 0 ? SUMMARY_LABEL_RE.exec(t ?? "") : null;
        return (
          <div key={it.sent.id}>
            {m ? (
              <>
                <span style={{ fontWeight: 700 }}>{m[1]}</span>{" "}
                <Underlined text={m[2]} />
              </>
            ) : (
              <Underlined text={t} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderAll(sents, sel, annotations, visualMarks, aiCitedSentId) {
  // target field 호환 path: target 미존재 시 'passage' default.
  // choice/bogi target annotation 은 PassagePanel 영역 외 — QuizPanel 처리.
  const passageAnns = annotations.filter(
    (a) => !a.target || a.target === "passage",
  );
  // bracket source: visual_marks + annotations.json bracket 둘 다 인정.
  //   v2 보강 (2026-06-01): 39 set 의 bracket 이 annotations.json 에만 있고 visualMarks 미등록 결함 발견.
  //   양쪽 source 모두 인정하여 학습 viewer 에 표시 의무.
  // 발주 F-25 ⓐ: 브래킷 렌더 원천을 annotations.json 하나로 단일화한다.
  //   종전에는 vm 브래킷이 배열 앞에 놓여 first-match-wins 로 ann 을 이겼고,
  //   ann 을 고쳐도 화면이 안 바뀌거나(l20259a) 어느 원천에도 없는 범위가
  //   그려지는(r2023b: ann s1~s8 + vm s2~s9 → s1~s9) 사고가 났다.
  //   ★ 스코프는 bracket 뿐이다. vm 의 box·underline·inline_label 등 다른
  //     타입 렌더는 아래 경로에서 그대로 유지된다.
  //   ★ 되돌리기: vmBrackets 를 brackets 배열 앞에 다시 넣으면 원복된다.
  //   ※ visualMarks 인자는 남겨 둔다(호출부·prop 배선 무변경). 실측 결과 이
  //     뷰어가 visual_marks 를 쓰던 곳은 브래킷 하나뿐이었다 — box·underline·
  //     marker·inline_label 420건은 렌더 경로가 없었고, 인라인 타입은
  //     annotations.json(passageAnns) 에서만 온다. 그래서 이 변경의 영향은
  //     브래킷에만 닿는다.
  const annBrackets = passageAnns
    .filter((a) => a.type === "bracket" && a.sentFrom && a.sentTo)
    .map((a) => ({
      label: a.label,
      sentFrom: a.sentFrom,
      sentTo: a.sentTo,
    }));
  // 중복 제거 (label + sentFrom + sentTo 동일 시 한 번만)
  //   원천이 하나가 됐으므로 같은 값이 두 번 들어올 일은 사실상 없지만,
  //   annotations.json 자체의 중복 엔트리를 막기 위해 남겨 둔다.
  const bracketKey = (b) => `${b.label}|${b.sentFrom}|${b.sentTo}`;
  const seenKeys = new Set();
  const brackets = annBrackets.filter((b) => {
    const k = bracketKey(b);
    if (seenKeys.has(k)) return false;
    seenKeys.add(k);
    return true;
  });
  // underline / box / marker — annotations.json path 유지 (Phase 2.5 마이그레이션 대기).
  //   marker 추가 (Code B 0d3c2dc visual_marks 472→496 +24 entries 정합).
  const inlineTypes = new Set(["box", "underline", "marker"]);
  const sentIds = sents.map((s) => s.id);

  // sentId → inline annotations 매핑
  const annMap = {};
  for (const a of passageAnns) {
    if (inlineTypes.has(a.type) && a.sentId) {
      (annMap[a.sentId] ||= []).push(a);
    }
  }

  const BLOCK_TYPES = new Set([
    "workTag",
    "omission",
    "summary", // 발주 F-70: [앞부분의 줄거리] 등 — 본문과 다른 블록이다
    "author",
    "footnote",
    "image",
    "verse",
    "figure",
    "stage", // 극문학 지시문 — 각 sent 단독 줄 path
    "speech", // 극문학 대사 — 각 sent 단독 줄 path
  ]);

  // workTag 영역 종료 marker 식별: sentType=workTag + t==="[A]"~"[F]" 단독.
  //   visual 본문 노출 NOT path — annotation bracket 라벨이 우측 상단 별도 노출.
  //   sentIds 배열 유지 path (bracket annotation sentFrom/sentTo 정합 의무).
  //   다른 workTag ((가), <제1수> 등) 본문 렌더링 유지 path.
  const RE_AREA_END_MARKER = /^\[[A-F]\]$/;
  function _isAreaEndMarker(s) {
    if ((s.sentType || "") !== "workTag") return false;
    return RE_AREA_END_MARKER.test((s.t || "").trim());
  }

  // sent별 메타 사전 계산: sentType, isBlock, brInfo
  const items = sents.map((s) => {
    const st = s.sentType || (s.type === "image" ? "image" : "body");
    const isBlock = BLOCK_TYPES.has(st);
    const brInfo = getBracketInfo(s.id, brackets, sentIds);
    const skip = _isAreaEndMarker(s);
    return { sent: s, st, isBlock, brInfo, skip };
  });

  // 한 그룹 안 sents 들 안 mixed 렌더 (body 연속 → <p>, block sent → 단독).
  //   bracket 컨테이너 안/밖 동일 path 안 재사용.
  function renderGroupChildren(groupItems, keyPrefix) {
    const out = [];
    let bodyBuf = [];
    const flushBody = () => {
      if (!bodyBuf.length) return;
      const head = bodyBuf[0];
      // para 필드(독서 문단 번호)가 있는 문단 = 시험지와 동일한 첫 줄 들여쓰기 + 문단 간격.
      //   para 없는 set(문학·LEGACY 미부여)은 기존 렌더 그대로 (영향 0).
      const hasPara = head.sent.para != null;
      out.push(
        <p
          key={keyPrefix + "_p_" + head.sent.id}
          style={
            hasPara
              ? { margin: "0 0 10px 0", textIndent: "1em" }
              : { margin: "0 0 5px 0" }
          }
        >
          {bodyBuf.map((b) => (
            <RenderSent
              key={b.sent.id}
              sent={b.sent}
              sel={sel}
              anns={annMap[b.sent.id] || []}
              aiCited={aiCitedSentId === b.sent.id}
            />
          ))}
        </p>,
      );
      bodyBuf = [];
    };
    for (let gi = 0; gi < groupItems.length; gi++) {
      const g = groupItems[gi];
      if (g.isBlock) {
        flushBody();
        // 발주 F-71: 연속 summary 는 한 블록으로 묶는다. 단일 summary 도
        //   길이 1인 구간으로 같은 경로를 탄다(정본 하나).
        if (g.st === "summary") {
          const run = [g];
          while (
            gi + 1 < groupItems.length &&
            groupItems[gi + 1].st === "summary"
          ) {
            gi += 1;
            run.push(groupItems[gi]);
          }
          out.push(
            <SummaryBlock key={keyPrefix + "_sum_" + run[0].sent.id} items={run} />,
          );
          continue;
        }
        out.push(
          <RenderSent
            key={g.sent.id}
            sent={g.sent}
            sel={sel}
            anns={annMap[g.sent.id] || []}
            aiCited={aiCitedSentId === g.sent.id}
          />,
        );
      } else {
        // para 경계: 직전 누적 sent 와 문단 번호가 달라지면 새 <p> 시작
        if (
          bodyBuf.length &&
          g.sent.para != null &&
          bodyBuf[bodyBuf.length - 1].sent.para !== g.sent.para
        ) {
          flushBody();
        }
        bodyBuf.push(g);
      }
    }
    flushBody();
    return out;
  }

  const result = [];
  let i = 0;

  // 결함 1 정정: body/verse 분기 폐기. brInfo.label 동일 연속 sents → 통합
  //   BracketContainer 단독 시각화 path.
  while (i < items.length) {
    if (items[i].skip) {
      i++;
      continue;
    }
    const curLabel = items[i].brInfo ? items[i].brInfo.label : null;
    const group = [];
    while (i < items.length) {
      const it = items[i];
      if (it.skip) {
        i++;
        continue;
      }
      const lbl = it.brInfo ? it.brInfo.label : null;
      if (lbl !== curLabel) break;
      group.push(it);
      i++;
    }

    const keyHead = group[0].sent.id;
    if (curLabel) {
      result.push(
        <BracketContainer key={"br_" + keyHead} label={curLabel}>
          {renderGroupChildren(group, "br_" + keyHead)}
        </BracketContainer>,
      );
    } else {
      const children = renderGroupChildren(group, "ng_" + keyHead);
      for (const c of children) result.push(c);
    }
  }
  return result;
}

export default function PassagePanel({
  passageSet,
  sel,
  mode,
  aiCitedSentId,
  user = null,
  isPro = false,
  yearKey = null,
}) {
  const panelRef = useRef(null);

  // 스크롤 helper — [data-hl] 또는 [data-ai-cited] 안 first 자동 검색 path.
  function scrollToSelector(selector) {
    if (!panelRef.current) return;
    const id = requestAnimationFrame(() => {
      const hit = panelRef.current?.querySelector(selector);
      if (!hit) return;
      // 발주 F-15 (b): data-hl 은 하이라이트 "조각"에 붙는다. 조각이 문장 뒤쪽이면
      //   그 조각을 기준으로 스크롤해 문장 앞부분이 화면 위로 잘린다.
      //   → 문장 래퍼([data-sent-id])로 승격한다. 문장 요소에 data-hl 이 직접
      //     붙은 경우(spans 부재 path) closest 가 자기 자신을 돌려주므로 회귀 없음.
      const first = hit.closest("[data-sent-id]") ?? hit;
      let scroller = first.parentElement;
      while (scroller) {
        const oy = getComputedStyle(scroller).overflowY;
        if (
          (oy === "auto" || oy === "scroll") &&
          scroller.scrollHeight > scroller.clientHeight
        )
          break;
        scroller = scroller.parentElement;
      }
      if (scroller && scroller !== document.documentElement) {
        const top =
          first.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop -
          scroller.clientHeight / 2 +
          first.clientHeight / 2;
        scroller.scrollTo({ top, behavior: "smooth" });
      } else {
        // 발주 F-15 (c): 문서 스크롤 경로(모바일 세로 스택)에서는 block:"start" 가
        //   sticky 헤더 2겹 뒤로 문장을 밀어넣는다. 실제 헤더 높이를 읽어 그만큼
        //   위로 더 스크롤한다. ★ 상수로 박지 않는다 — 배너 유무로 높이가 변한다.
        let offset = 16;
        for (const el of document.querySelectorAll("body *")) {
          const cs = getComputedStyle(el);
          if (cs.position !== "sticky") continue;
          const r = el.getBoundingClientRect();
          if (r.top <= 1 && r.height > 0 && r.height < 200) offset += r.height;
        }
        const top =
          first.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(id);
  }

  useEffect(() => {
    if (!sel) return;
    return scrollToSelector("[data-hl]");
  }, [sel]);

  // AI 인용 안 [N] pill 클릭 path 안 해당 sent 안 스크롤 + 노란 형광 자동 path.
  useEffect(() => {
    if (!aiCitedSentId) return;
    return scrollToSelector("[data-ai-cited]");
  }, [aiCitedSentId]);

  if (!passageSet) return null;
  const annotations = passageSet.annotations ?? [];
  const visualMarks = passageSet.visualMarks ?? [];

  // 발주 F-14: 선지를 눌렀는데 지문에 켜지는 문장이 하나도 없으면 학생은
  //   "이 선지는 근거가 없구나"로 읽는다(App.jsx:868 이 형광펜 표시를 약속한다).
  //   getHL 은 문장 단위라 그 자리에 문구를 넣으면 문장마다 반복 노출된다.
  //   → 패널 단위로 "켜진 문장 0개"인지 한 번만 판정한다.
  //   ※ 문구는 심사관이 확정한다. 지금은 자리만 만든다.
  const hasNoHighlight =
    !!sel && !(passageSet.sents || []).some((s) => getHL(s, sel));

  // 근거가 안 켜지는 사유는 두 가지다. 문구를 섞으면 사실과 다른 안내가 된다.
  //   (a) 데이터 — 그 선지에 cs_ids·cs_spans 가 없거나 sentId 가 어긋난 경우
  //   (b) 정책 — 유료 조각이 아예 안 실린 상태(비로그인·무료 계정의 보기 모드).
  //       이때는 선지가 근거를 정상 보유하고 있어도 클라이언트에 값이 없다.
  //   판정 근거: 세트 안 어느 선지든 cs 를 하나라도 갖고 있으면 조각이 실린 것이다.
  const csAnywhere = (passageSet.questions || []).some((q) =>
    (q.choices || []).some(
      (c) => (c.cs_ids?.length ?? 0) > 0 || (c.cs_spans?.length ?? 0) > 0,
    ),
  );
  // 발주 F-51: 문구를 세 갈래로 나눈다. 460881c 의 (b) 문구
  //   「답을 입력하면 … 표시됩니다」는 비로그인·무이용권에게 사실이 아니었다.
  //   근거·해설은 pro 조각이므로 답을 입력해도 켜지지 않는다.
  //     (a) data     — 조각은 실렸는데 그 선지만 없음 → 현행 문구
  //     (b) login    — 비로그인. 개방 회차면 로그인으로 열린다
  //     (b') pass_login — 비로그인 + 개방 회차 밖 → 이용권 안내
  //     (c) pass     — 로그인했으나 이용권 없음 → 이용권 기능임을 알린다
  const noticeKind = !hasNoHighlight
    ? null
    : csAnywhere
      ? "data"
      : !user
        ? isFreeProYear(yearKey)
          ? "login"
          : "pass_login"
        : isPro
          ? "data"
          : "pass";
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
      {noticeKind && (
        <div
          data-nomap-notice
          data-notice-kind={noticeKind}
          style={{
            fontSize: "0.78rem",
            lineHeight: 1.6,
            color: "#92400e",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: "8px",
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          {noticeKind === "login" && (
            <>
              <span>로그인하면 지문 근거가 바로 표시됩니다</span>
              <a href="/auth" style={NOTICE_ACTION}>
                로그인
              </a>
            </>
          )}
          {(noticeKind === "pass" || noticeKind === "pass_login") && (
            <>
              <span>근거 표시와 해설은 이용권 기능입니다</span>
              <a href="/payment" style={NOTICE_ACTION}>
                요금제 보기
              </a>
            </>
          )}
          {noticeKind === "data" && (
            <span>이 선지는 지문 근거 표시가 준비되지 않았습니다</span>
          )}
        </div>
      )}
      <div
        style={{
          fontSize: "0.92rem",
          lineHeight: "2.0",
          color: "#1f2937",
          fontFamily: "'Noto Serif KR', serif",
          // 결함 A 정정 (option 2): bracket 안/밖 본문 좌측 정렬 통일 path 안
          // wrapper paddingLeft 44px 확보 → BracketContainer 라벨 left:-44px,
          // 대괄호 left:-18px 음수 위치 path 안 wrapper padding 영역 안 노출.
          paddingLeft: "44px",
        }}
      >
        {renderAll(
          passageSet.sents || [],
          sel,
          annotations,
          visualMarks,
          aiCitedSentId,
        )}
      </div>
    </div>
  );
}
