import { useEffect, useRef } from "react";
import { CC, FIGURE_IMAGE_MAP } from "./constants";

// ── 기호 밑줄 + 영역 라벨 hide (/g 플래그 금지) ──
// SYM_SPLIT: ㉠-㉮ⓐ-ⓩ①-⑤ + [A-F] 라벨 단독 path 안 단일 정규식 분리.
//   hideLabels 플래그 안 라벨 [A-F] = visibility:hidden 적용 (글자 안 보임 +
//   자리 유지) path → body / verse sentType 단독 적용 (RenderSent path 안 결정).
const SYM_SPLIT = /([㉠-㉮ⓐ-ⓩ①-⑤]|\[[A-F]\])/;
const SYM_TEST = /[㉠-㉮ⓐ-ⓩ①-⑤]|\[[A-F]\]/;
const SYM_UNDERLINE_RE = /^[㉠-㉮ⓐ-ⓩ①-⑤]$/;
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
// marker label (㉠ ⓐ 등) — 위첨자 위치 안 underline text 사전 노출 path.
//   annotations.json schema: { type:"marker", marker:"ⓐ", sentId, text }
//   visual_marks.json schema: { type:"marker", label:"ⓐ", text, ... }
const MARKER_LABEL_STYLE = {
  verticalAlign: "super",
  fontSize: "0.72em",
  fontWeight: 700,
  color: "#374151",
  marginRight: "1px",
};

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
    return <div style={scStyle}>{inner}</div>;
  }

  // body — spans 우선, 실패 시 기존 전체 하이라이트 fallback
  if (pal && spans) {
    // box/underline annotation보다 span 하이라이트 우선
    // (annotation은 span 매칭 실패 시 fallback 경로에서 처리)
    const spanJsx = renderSpanParts(t, spans, hlStyle, true);
    if (spanJsx) {
      return <span>{spanJsx} </span>;
    }
    // span 매칭 실패 → 전체 하이라이트 fallback
  }
  const content =
    anns.length > 0 ? (
      applyInlineAnns(t, anns, true)
    ) : (
      <Lines text={t} hideLabels={true} />
    );
  return (
    <span style={hlStyle} data-hl={pal ? "true" : undefined}>
      {content}{" "}
    </span>
  );
}

// ── bracket 유틸 (Phase 2.2 — 통합 시각 path) ──
// hideLabel path 폐기 (결함 B+C 정정): body / verse sent.t 안 "[X]" 인라인 텍스트
//   = RenderSent path 안 hideLabels=true 안 visibility:hidden 적용 (자리 유지) →
//   좌측 측면 라벨 단독 노출 (l2022a 형태) 통일 path. hide trigger 결정 X.
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

function renderAll(sents, sel, annotations, visualMarks) {
  // target field 호환 path: target 미존재 시 'passage' default.
  // choice/bogi target annotation 은 PassagePanel 영역 외 — QuizPanel 처리.
  const passageAnns = annotations.filter(
    (a) => !a.target || a.target === "passage",
  );
  // bracket source: visual_marks + annotations.json bracket 둘 다 인정.
  //   v2 보강 (2026-06-01): 39 set 의 bracket 이 annotations.json 에만 있고 visualMarks 미등록 결함 발견.
  //   양쪽 source 모두 인정하여 학습 viewer 에 표시 의무.
  const vmList = Array.isArray(visualMarks) ? visualMarks : [];
  const vmBrackets = vmList
    .filter(
      (m) =>
        m.type === "bracket" &&
        m.target === "sent_range" &&
        m.status !== "broken" &&
        Array.isArray(m.sentIds) &&
        m.sentIds.length > 0,
    )
    .map((m) => ({
      label: m.label,
      sentFrom: m.sentIds[0],
      sentTo: m.sentIds[m.sentIds.length - 1],
    }));
  const annBrackets = passageAnns
    .filter(
      (a) =>
        a.type === "bracket" &&
        a.sentFrom &&
        a.sentTo,
    )
    .map((a) => ({
      label: a.label,
      sentFrom: a.sentFrom,
      sentTo: a.sentTo,
    }));
  // 중복 제거 (label + sentFrom + sentTo 동일 시 한 번만)
  const bracketKey = (b) => `${b.label}|${b.sentFrom}|${b.sentTo}`;
  const seenKeys = new Set();
  const brackets = [...vmBrackets, ...annBrackets].filter((b) => {
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
    "author",
    "footnote",
    "image",
    "verse",
    "figure",
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
      out.push(
        <p
          key={keyPrefix + "_p_" + head.sent.id}
          style={{ margin: "0 0 5px 0" }}
        >
          {bodyBuf.map((b) => (
            <RenderSent
              key={b.sent.id}
              sent={b.sent}
              sel={sel}
              anns={annMap[b.sent.id] || []}
            />
          ))}
        </p>,
      );
      bodyBuf = [];
    };
    for (const g of groupItems) {
      if (g.isBlock) {
        flushBody();
        out.push(
          <RenderSent
            key={g.sent.id}
            sent={g.sent}
            sel={sel}
            anns={annMap[g.sent.id] || []}
          />,
        );
      } else {
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

export default function PassagePanel({ passageSet, sel, mode }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!sel || !panelRef.current) return;
    // 다음 프레임까지 대기 — 자식 RenderSent가 [data-hl] 붙인 후 조회 보장
    const id = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector("[data-hl]");
      if (!first) return;

      // 가장 가까운 스크롤 가능한 조상 찾기 (부모 컨테이너 overflow 기반)
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
        // 컨테이너 수동 스크롤 — Chrome Windows smooth 무시 회피
        const top =
          first.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop -
          scroller.clientHeight / 2 +
          first.clientHeight / 2;
        scroller.scrollTo({ top, behavior: "smooth" });
      } else {
        first.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [sel]);

  if (!passageSet) return null;
  const annotations = passageSet.annotations ?? [];
  const visualMarks = passageSet.visualMarks ?? [];
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
          // 결함 A 정정 (option 2): bracket 안/밖 본문 좌측 정렬 통일 path 안
          // wrapper paddingLeft 44px 확보 → BracketContainer 라벨 left:-44px,
          // 대괄호 left:-18px 음수 위치 path 안 wrapper padding 영역 안 노출.
          paddingLeft: "44px",
        }}
      >
        {renderAll(passageSet.sents || [], sel, annotations, visualMarks)}
      </div>
    </div>
  );
}
