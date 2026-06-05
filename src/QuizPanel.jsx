import { useState, useEffect, useRef } from "react";
import { P, CC, MODE, SYMBOLS } from "./constants";
import { BogiTable } from "./BogiTable";
import QuestionQA from "./QuestionQA";
import { saveEvidenceFeedback } from "./saveEvidenceFeedback";

// ══════════════════════════════════════════════════════════
// [1] 유틸 함수
// ══════════════════════════════════════════════════════════

// [도식:...] / [사진:...] / [그림:...] / [이미지:...] 패턴을
// 실제 이미지가 연결되지 않은 경우 중립적 박스로 노출 (원본 설명문 숨김)
function replaceImagePlaceholders(text) {
  if (!text) return text;
  const re = /\[(?:도식|사진|그림|이미지)\s*:[^\]]+\]/g;
  if (!re.test(text)) return text;
  const parts = text.split(/\[(?:도식|사진|그림|이미지)\s*:[^\]]+\]/g);
  const result = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) result.push(parts[i]);
    if (i < parts.length - 1) {
      result.push(
        <span
          key={"img-ph-" + i}
          style={{
            display: "inline-block",
            padding: "2px 10px",
            margin: "0 2px",
            border: "1px dashed #9ca3af",
            borderRadius: "4px",
            fontSize: "0.72rem",
            color: "#6b7280",
            background: "#f9fafb",
          }}
        >
          🖼 이미지
        </span>,
      );
    }
  }
  return result;
}

// analysis 텍스트 정제
function cleanAnalysis(text) {
  if (!text) return "";
  return (
    text
      // [[sym:KEY]] 기호 태그 제거
      .replace(/\[\[sym:\w+\]\]/g, "")
      // sent ID 참조 제거: r2025a_s1, bs7, (as2), (as6~as7) 등
      .replace(/\b[a-zA-Z_]*[a-zA-Z]\d+(?:[·,][a-zA-Z_]*\d+)*:\s*[''"]?/g, "")
      .replace(/\(as\d+(?:~as\d+)?\)/g, "")
      // 말미 패턴 코드 제거: [L1], [R2], [P0] 등
      .replace(/\s*\[([RLVP][0-9]|P0)\]\s*$/gm, "")
      // [?], [불명확] 같은 불완전 기호 제거
      .replace(/\[\?[^\]]*\]/g, "")
      // bs7, r2024a_s3 같은 단독 sent ID 제거
      .replace(/\b[a-zA-Z]{1,3}\d{4}[a-zA-Z]?_s\d+\b/g, "")
      // "지문이 제공되지 않았으나" 류 AI 오류 문구 제거
      .replace(/\(지문이 제공되지 않[^)]*\)/g, "")
      .replace(/지문이 제공되지 않[^,\.。]*[,\.。]?\s*/g, "")
      .replace(/일반적인 수능 해설 형식으로 작성합니다[\.。]?\s*/g, "")
      .trim()
  );
}

// [[sym:KEY]] → <img> 치환
function renderWithSymbols(text) {
  if (!text) return null;
  const parts = text.split(/(\[\[sym:\w+\]\])/);
  return parts.map((part, i) => {
    const match = part.match(/\[\[sym:(\w+)\]\]/);
    if (match && SYMBOLS?.[match[1]]) {
      return (
        <img
          key={i}
          src={SYMBOLS[match[1]]}
          alt={match[1]}
          style={{ height: "1.2em", verticalAlign: "-0.2em", margin: "0 3px" }}
        />
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// applyInlineAnnsLocal(text, anns)
//   QuizPanel 내부 inline annotation overlay helper.
//   anns: [{ type: 'underline'|'box', text }] — text 안 substring match path
//   renderWithSymbols (= [[sym:KEY]] → <img>) 도입 path 안 정합 의무 path
//   PassagePanel applyInlineAnns 와 분리 — 각 컴포넌트 텍스트 처리 path 별개.
function applyInlineAnnsLocal(text, anns) {
  if (!text || !anns || anns.length === 0) return renderWithSymbols(text);
  const sorted = anns
    .map((a) => ({ text: a.text, type: a.type, idx: text.indexOf(a.text) }))
    .filter((a) => a.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  if (!sorted.length) return renderWithSymbols(text);
  const parts = [];
  let cursor = 0;
  for (const a of sorted) {
    if (a.idx < cursor) continue;
    if (a.idx > cursor) parts.push({ t: text.slice(cursor, a.idx), type: null });
    parts.push({ t: a.text, type: a.type });
    cursor = a.idx + a.text.length;
  }
  if (cursor < text.length) parts.push({ t: text.slice(cursor), type: null });
  return parts.map((p, i) => {
    const inner = renderWithSymbols(p.t);
    if (p.type === "underline")
      return (
        <span
          key={i}
          style={{
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {inner}
        </span>
      );
    if (p.type === "box")
      return (
        <span
          key={i}
          style={{
            border: "1px solid #555",
            borderRadius: "2px",
            padding: "0 3px",
          }}
        >
          {inner}
        </span>
      );
    return <span key={i}>{inner}</span>;
  });
}

// ══════════════════════════════════════════════════════════
// [2] BogiRenderer — 보기 타입을 단일 컴포넌트에서 처리
// bogi 값의 종류:
//   string                          → 텍스트 보기
//   { type: 'annotated_image', image }   → 이미지 보기
//   { type: 'diagram', description, flow, items, layout } → 도식 보기
//   (bogiType='table'은 BogiTable이 별도 처리)
// markdown 표 파서 (단순 GFM 호환)
//   bogi string 안 첫 번째 separator row(--- | ---) 검출 → header(직전 line) +
//   separator + body(이후 연속 line). 표 외 영역은 before / after 분리.
//   header 안 cell 안 '\n' 보존 (multi-line 헤더 지원).
//   파싱 실패 시 null 반환 (호출측 fallback pre-wrap).
function parseMarkdownTable(text) {
  if (!text || typeof text !== "string") return null;
  const lines = text.split("\n");
  // separator row index 검출 (직전 line includes("|") 조건 제거 — multi-line header 지원)
  const sepRe = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
  let sepIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (sepRe.test(lines[i])) {
      sepIdx = i;
      break;
    }
  }
  if (sepIdx < 1) return null;
  const splitRow = (line) =>
    line
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split("|")
      .map((c) => c.trim());
  // header 영역: separator 직전부터 위로 올라가 빈 line(혹은 시작)까지 합쳐서
  //   "\n" 보존 후 "|" split. cell 안 multi-line 지원 (예: "1차 조사\n선거일\n15일 전").
  let headerStart = sepIdx;
  while (headerStart > 0 && lines[headerStart - 1].trim() !== "") {
    headerStart--;
  }
  if (headerStart >= sepIdx) return null;
  const headerArea = lines.slice(headerStart, sepIdx).join("\n");
  if (!headerArea.includes("|")) return null;
  const header = splitRow(headerArea);
  const rows = [];
  let bodyEnd = sepIdx + 1;
  for (let i = sepIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim() || !l.includes("|")) {
      bodyEnd = i;
      break;
    }
    rows.push(splitRow(l));
    bodyEnd = i + 1;
  }
  if (rows.length === 0) return null;
  const before = lines.slice(0, headerStart).join("\n").trim();
  const after = lines.slice(bodyEnd).join("\n").trim();
  return { before, header, rows, after };
}

// applyBogiInlineAnns(text, anns)
//   bogi string 안 inline underline/box/blank-box overlay path.
//   plain text + substring match path — replaceImagePlaceholders 미적용.
//   [도식/사진] placeholder 사용 set 안 본 path 미적용 의무 (안 호환 path).
//   blank-box: marker 또는 [label] 패턴을 회색 박스(width 지정)로 표시.
function applyBogiInlineAnns(text, anns) {
  if (!text || !anns || anns.length === 0) return text;
  // 각 ann 에 대해 검색할 substring (matchText) 과 표시할 내용(displayText) 결정.
  //   - underline / box: a.text 그대로
  //   - blank-box marker: a.marker 검색, marker 표시
  //   - blank-box label: "[a.label]" 검색, label 표시
  const sorted = anns
    .map((a) => {
      let matchText = null;
      let displayText = null;
      if (a.type === "blank-box") {
        if (a.marker) {
          matchText = a.marker;
          displayText = a.marker;
        } else if (a.label) {
          matchText = `[${a.label}]`;
          displayText = a.label;
        }
      } else {
        matchText = a.text;
        displayText = a.text;
      }
      if (!matchText) return null;
      return {
        matchText,
        displayText,
        type: a.type,
        width: a.width,
        idx: text.indexOf(matchText),
      };
    })
    .filter((a) => a && a.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  if (!sorted.length) return text;
  const parts = [];
  let cursor = 0;
  for (const a of sorted) {
    if (a.idx < cursor) continue;
    if (a.idx > cursor) parts.push({ t: text.slice(cursor, a.idx), type: null });
    parts.push({ t: a.displayText, type: a.type, width: a.width });
    cursor = a.idx + a.matchText.length;
  }
  if (cursor < text.length) parts.push({ t: text.slice(cursor), type: null });
  return parts.map((p, i) => {
    if (p.type === "underline")
      return (
        <span
          key={i}
          style={{
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
        >
          {p.t}
        </span>
      );
    if (p.type === "box")
      return (
        <span
          key={i}
          style={{
            border: "1px solid #555",
            borderRadius: "2px",
            padding: "0 3px",
          }}
        >
          {p.t}
        </span>
      );
    if (p.type === "blank-box")
      return (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: p.width || "3em",
            background: "#f3f4f6",
            border: "1px solid #9ca3af",
            borderRadius: "4px",
            padding: "0 6px",
            color: "#6b7280",
            textAlign: "center",
            verticalAlign: "baseline",
          }}
        >
          {p.t}
        </span>
      );
    return <span key={i}>{p.t}</span>;
  });
}

// ══════════════════════════════════════════════════════════
function BogiRenderer({ bogi, anns = [] }) {
  if (!bogi) return null;
  // bogi string 안 inline underline/box overlay (target='bogi' annotation 도입 path).
  //   anns 비어있으면 기존 replaceImagePlaceholders path 정합 maintain.
  //   anns 있으면 본문에 substring underline overlay 추가.
  //   annotated_image / diagram / table 분기 안 본 anns 영향 X (text 영역 단독).
  const hasAnns = Array.isArray(anns) && anns.length > 0;

  // 수업 대화·학습 활동 박스(예: "선생님 : ...")는 시험지 원문에 <보기> 라벨이 없음
  //   → 라벨 없이 텍스트 박스만 렌더 (2027_6월 Q30 사양, 2026-06-05)
  const isActivityBox =
    typeof bogi === "string" && /^\s*선생님\s*[:：]/.test(bogi);

  const wrap = (children) => (
    <div
      style={{
        background: "#fff",
        border: "1px solid #d1d5db",
        borderRadius: "6px",
        padding: "12px 14px",
        fontSize: "0.82rem",
        color: "#374151",
        lineHeight: "1.75",
      }}
    >
      {!isActivityBox && (
        <div
          style={{
            fontWeight: "700",
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          〈보기〉
        </div>
      )}
      {children}
    </div>
  );

  // ── 문자열 보기
  if (typeof bogi === "string") {
    // markdown 표 detection — '|' + 'separator row(--- | ---)' 패턴
    //   header / separator / body 분리 후 table 렌더. table 외 영역(서두/말미)은
    //   별도 pre-wrap 블록으로 분리하여 정합 노출.
    const mdTable = parseMarkdownTable(bogi);
    if (mdTable) {
      return wrap(
        <>
          {mdTable.before && (
            <div
              style={{
                whiteSpace: "pre-wrap",
                textAlign: "justify",
                marginBottom: "10px",
              }}
            >
              {replaceImagePlaceholders(mdTable.before)}
            </div>
          )}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.78rem",
              marginBottom: mdTable.after ? "10px" : 0,
              border: "1px solid #d1d5db",
            }}
          >
            <thead>
              <tr>
                {mdTable.header.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      background: "#f3f4f6",
                      border: "1px solid #d1d5db",
                      padding: "6px 8px",
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "pre-wrap",
                      verticalAlign: "middle",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mdTable.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        border: "1px solid #d1d5db",
                        padding: "6px 8px",
                        textAlign: ci === 0 ? "left" : "center",
                        whiteSpace: "pre-wrap",
                        verticalAlign: "middle",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {mdTable.after && (
            <div style={{ whiteSpace: "pre-wrap", textAlign: "justify" }}>
              {replaceImagePlaceholders(mdTable.after)}
            </div>
          )}
        </>,
      );
    }
    // anns 있으면 substring underline overlay 우선 path.
    //   replaceImagePlaceholders 호환 X path 안 부분 대체 의무 path.
    //   대신 plain text + underline 사용. [도식/사진] placeholder 가 본 분기 안
    //   재현 안 됨 — bogi 안 image placeholder 미사용 set 한정 path.
    if (hasAnns) {
      return wrap(
        <div style={{ whiteSpace: "pre-wrap", textAlign: "justify" }}>
          {applyBogiInlineAnns(bogi, anns)}
        </div>,
      );
    }
    return wrap(
      <div style={{ whiteSpace: "pre-wrap", textAlign: "justify" }}>
        {replaceImagePlaceholders(bogi)}
      </div>,
    );
  }

  // ── annotated_image: 텍스트(선택) + 이미지
  //   imagePosition: 'right' | 'left' → 텍스트 옆 배치 (데스크탑)
  //                  'top' | 'bottom' | undefined → 세로 배치
  //   모바일(<=640px)에서는 항상 세로 배치로 fallback
  if (bogi.type === "annotated_image") {
    const pos = bogi.imagePosition;
    const isHorizontal = pos === "right" || pos === "left";
    const imgSrc = bogi.image.startsWith("/")
      ? bogi.image
      : `/images/${bogi.image}`;
    const imgEl = (
      <img
        src={imgSrc}
        alt="보기 그림"
        style={{
          maxWidth: "100%",
          borderRadius: "4px",
          border: "1px solid #e5e7eb",
        }}
      />
    );
    const textEl = bogi.text ? (
      <div style={{ whiteSpace: "pre-wrap", textAlign: "justify", flex: 1 }}>
        {applyBogiInlineAnns(bogi.text, anns)}
      </div>
    ) : null;

    if (isHorizontal) {
      return wrap(
        <div
          className="bogi-annotated-image-horizontal"
          style={{
            display: "flex",
            flexDirection: pos === "left" ? "row-reverse" : "row",
            gap: "14px",
            alignItems: "flex-start",
          }}
        >
          <style>{`
            @media (max-width: 640px) {
              .bogi-annotated-image-horizontal {
                flex-direction: column !important;
              }
              .bogi-annotated-image-horizontal > .bogi-img-wrap {
                width: 100% !important;
                text-align: center !important;
              }
            }
          `}</style>
          {textEl}
          <div
            className="bogi-img-wrap"
            style={{
              flex: "0 0 40%",
              maxWidth: "40%",
              textAlign: "center",
            }}
          >
            {imgEl}
          </div>
        </div>,
      );
    }

    // 기본: 세로 배치 (텍스트 위, 이미지 아래)
    return wrap(
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {textEl}
        <div style={{ textAlign: "center" }}>{imgEl}</div>
      </div>,
    );
  }

  // ── diagram: description + flow 박스 도식 + items 이미지 그리드
  if (bogi.type === "diagram") {
    // flow 파싱: "⇨" "→" "⟶" 기준으로 토큰 분리
    const flowTokens = bogi.flow
      ? bogi.flow
          .split(/(⇨|→|⟶)/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    return wrap(
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* 1. description 텍스트 */}
        {bogi.description && (
          <div
            style={{
              whiteSpace: "pre-wrap",
              textAlign: "left",
              color: "#374151",
            }}
          >
            {bogi.description}
          </div>
        )}

        {/* 2. flow 박스 도식 */}
        {flowTokens.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "4px",
              justifyContent: "center",
            }}
          >
            {flowTokens.map((tok, i) => {
              const isArrow = /^(⇨|→|⟶)$/.test(tok);
              const isParen = /^\(.+\)$/.test(tok); // (가), (나) 등 → 텍스트만
              if (isArrow)
                return (
                  <span
                    key={i}
                    style={{
                      fontSize: "1rem",
                      color: "#6b7280",
                      padding: "0 2px",
                    }}
                  >
                    {tok}
                  </span>
                );
              if (isParen)
                return (
                  <span
                    key={i}
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      color: "#374151",
                    }}
                  >
                    {tok}
                  </span>
                );
              return (
                <span
                  key={i}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    border: "1.5px solid #374151",
                    background: "#f9fafb",
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#111827",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tok}
                </span>
              );
            })}
          </div>
        )}

        {/* 3. items: 수평(row) 또는 수직(column) */}
        {bogi.items?.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: bogi.layout === "horizontal" ? "row" : "column",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            {bogi.items.map((item, i) => (
              <div
                key={i}
                style={{
                  flex: "1 1 100px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px",
                  borderRadius: "8px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <span
                    style={{
                      fontWeight: "800",
                      fontSize: "0.88rem",
                      color: "#1f2937",
                    }}
                  >
                    {item.label}
                  </span>
                  {item.desc && (
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {item.desc}
                    </span>
                  )}
                </div>
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.label}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "120px",
                      objectFit: "contain",
                      borderRadius: "4px",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>,
    );
  }

  // ── 알 수 없는 타입: 안전하게 무시
  return null;
}

// ══════════════════════════════════════════════════════════
// [3] AnalysisBlock — 해설 블록
// ══════════════════════════════════════════════════════════
function AnalysisBlock({ text }) {
  const cleaned = cleanAnalysis(text);
  if (!cleaned || cleaned.length < 5) return null;

  const chunks = cleaned.includes("➔")
    ? cleaned
        .split("➔")
        .map((s) => s.trim())
        .filter(Boolean)
    : [cleaned];

  return (
    <div
      style={{
        marginTop: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "5px",
      }}
    >
      {chunks.map((chunk, i) => {
        let bg = "#f9fafb",
          bl = "#d1d5db",
          tc = "#374151",
          label = "";
        if (chunk.includes("[지문 팩트]")) {
          bg = "#dbeafe";
          bl = "#3b82f6";
          tc = "#1e40af";
          label = "📌 지문 팩트";
        } else if (
          chunk.includes("[선지 분析]") ||
          chunk.includes("[선지 분석]")
        ) {
          bg = "#f3f4f6";
          bl = "#9ca3af";
          tc = "#374151";
          label = "🔍 선지 분석";
        } else if (chunk.includes("[소거 판별")) {
          const isTrue = /True/.test(chunk),
            isFalse = /False/.test(chunk);
          bg = isTrue ? "#dcfce7" : isFalse ? "#fee2e2" : "#f9fafb";
          bl = isTrue ? "#16a34a" : isFalse ? "#dc2626" : "#9ca3af";
          tc = isTrue ? "#14532d" : isFalse ? "#7f1d1d" : "#374151";
          label = isTrue ? "✅ True" : isFalse ? "❌ False" : "⚖️";
        } else if (/\[패턴/.test(chunk)) {
          bg = "#fef9c3";
          bl = "#ca8a04";
          tc = "#713f12";
          label = "🔖 패턴";
        }
        const clean = chunk
          .replace(/\[지문 팩트\]/g, "")
          .replace(/\[선지 분析\]/g, "")
          .replace(/\[선지 분석\]/g, "")
          .replace(/\[소거 판별[^\]]*\]/g, "")
          .replace(/\[패턴[^\]]*\]/g, "")
          .trim();
        return (
          <div
            key={i}
            style={{
              background: bg,
              borderLeft: `3px solid ${bl}`,
              borderRadius: "0 4px 4px 0",
              padding: "6px 10px",
              fontSize: "0.79rem",
              lineHeight: "1.6",
              color: tc,
            }}
          >
            {label && (
              <div
                style={{
                  fontSize: "0.67rem",
                  fontWeight: "700",
                  marginBottom: "2px",
                  opacity: 0.75,
                }}
              >
                {label}
              </div>
            )}
            <div style={{ whiteSpace: "pre-wrap" }}>{clean}</div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// [4] PatternBadge
// ══════════════════════════════════════════════════════════
function PatternBadge({ pat }) {
  if (!pat || !P[pat]) return null;
  if (pat === "V") return null; // 어휘 = 단순 어휘 문제, badge 미표시 (사용자 결정)
  const p = P[pat];
  return (
    <span
      style={{
        fontSize: "0.68rem",
        fontWeight: "700",
        color: p.color,
        background: p.bg,
        border: `1px solid ${p.color}55`,
        borderRadius: "4px",
        padding: "1px 6px",
        marginLeft: "7px",
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      }}
    >
      {pat} {p.name}
    </span>
  );
}

// ══════════════════════════════════════════════════════════
// [5] ChoiceItem
// ══════════════════════════════════════════════════════════
function ChoiceItem({
  choice,
  qid,
  questionType,
  clicked,
  myAnswer,
  onSelect,
  mode,
  submitted,
  isReview,
  isVocab,
  passageSents,
  user,
  yearKey,
  setId,
  choiceAnns = [],
}) {
  const [evidenceVote, setEvidenceVote] = useState(null);
  const uid = `q${qid}_c${choice.num}`;
  const isActive = clicked === uid;
  const isMe = myAnswer === uid;
  const isCorrect =
    questionType === "positive" ? choice.ok === true : choice.ok === false;

  const showResult = mode !== MODE.STUDY || submitted;

  let bg = "#ffffff",
    border = "1px solid #e5e7eb",
    tc = "#1f2937";
  let numBg = "#f3f4f6",
    numColor = CC[choice.num]?.text ?? "#374151";

  if (isReview) {
    // 복습 모드: 정답(초록 테두리) / 원래 오답(빨간 테두리) 항상 표시
    // 현재 active 선지는 배경색으로 강조
    if (isCorrect && isActive) {
      bg = "#ecfdf5";
      border = "2px solid #10b981";
      tc = "#065f46";
      numBg = "#10b981";
      numColor = "#fff";
    } else if (isCorrect) {
      border = "2px solid #10b981";
      tc = "#065f46";
      numBg = "#d1fae5";
      numColor = "#065f46";
    } else if (isMe && isActive) {
      bg = "#fef2f2";
      border = "2px solid #ef4444";
      tc = "#7f1d1d";
      numBg = "#ef4444";
      numColor = "#fff";
    } else if (isMe) {
      border = "2px solid #ef4444";
      tc = "#7f1d1d";
      numBg = "#fee2e2";
      numColor = "#b91c1c";
    } else if (isActive) {
      bg = "#f8fafc";
      border = "2px solid #6366f1";
      tc = "#1f2937";
      numBg = "#6366f1";
      numColor = "#fff";
    }
  } else if (isActive && showResult) {
    if (isCorrect) {
      bg = "#ecfdf5";
      border = "2px solid #10b981";
      tc = "#065f46";
      numBg = "#10b981";
      numColor = "#fff";
    } else {
      bg = "#fef2f2";
      border = "2px solid #ef4444";
      tc = "#7f1d1d";
      numBg = "#ef4444";
      numColor = "#fff";
    }
  } else if (isActive) {
    bg = "#eff6ff";
    border = "2px solid #3b82f6";
    tc = "#1e40af";
    numBg = "#3b82f6";
    numColor = "#fff";
  }

  // 해설: 복습 모드는 클릭한 선지에만, 일반은 기존 로직
  const showAnalysis = isReview ? isActive : isActive && showResult;

  // cs 기반 문단 번호 계산 — para 필드가 있는 sents에서만 동작
  const paraNums = passageSents
    ? [
        ...new Set(
          passageSents
            .filter(
              (s) =>
                s.para != null && Array.isArray(s.cs) && s.cs.includes(uid),
            )
            .map((s) => s.para),
        ),
      ].sort((a, b) => a - b)
    : [];

  // 패턴 뱃지: 학생이 클릭한 선지 + 결과 표시 시점 + pat 있는 (= ok:false) 경우만 표시
  //   - isActive: 학생이 직접 클릭한 선지 (다른 선지는 badge 미표시 — 학습 효과 보호)
  //   - choice.pat: ok:false 선지만 부여 (정답이 적절하지 않은 진술인 경우 그 선지에 badge)
  //   - !isCorrect 제거: 학생이 정답 (= 적절하지 않은 선지) 선택해도 그 선지에 pat badge 표시 의무
  const showBadge = isActive && (isReview || showResult) && choice.pat;

  // 아이콘: 복습 모드는 정답/원래오답에 항상, 일반은 클릭+결과
  const showIcon = isReview ? isCorrect || isMe : isActive && showResult;

  const icon = isCorrect ? "✅" : "❌";

  return (
    <div>
      <div
        onClick={() => onSelect(uid, choice)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "10px 12px",
          borderRadius: showAnalysis && choice.analysis ? "8px 8px 0 0" : "8px",
          background: bg,
          border,
          cursor: "pointer",
          transition: "background 0.12s, border 0.12s",
          userSelect: "none",
        }}
      >
        <span
          style={{
            minWidth: "22px",
            height: "22px",
            borderRadius: "50%",
            flexShrink: 0,
            marginTop: "1px",
            background: numBg,
            color: numColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.77rem",
            fontWeight: "700",
          }}
        >
          {choice.num}
        </span>
        <div
          style={{
            flex: 1,
            fontSize: "0.88rem",
            lineHeight: "1.65",
            color: tc,
            textAlign: "left",
          }}
        >
          <span>{applyInlineAnnsLocal(choice.t, choiceAnns)}</span>
          {showBadge && choice.pat && <PatternBadge pat={choice.pat} />}
        </div>
        {showIcon && icon && (
          <span style={{ fontSize: "1rem", flexShrink: 0, paddingTop: "1px" }}>
            {icon}
          </span>
        )}
      </div>
      {showAnalysis && choice.analysis && (
        <div
          style={{
            background: isVocab
              ? isCorrect
                ? "#f0fdf4"
                : "#fff5f5"
              : isCorrect
                ? "#f0fdf4"
                : "#fff5f5",
            borderLeft: `2px solid ${isCorrect ? "#10b981" : "#ef4444"}`,
            borderBottom: `1px solid ${isCorrect ? "#a7f3d0" : "#fca5a5"}`,
            borderRight: `1px solid ${isCorrect ? "#a7f3d0" : "#fca5a5"}`,
            borderRadius: "0 0 8px 8px",
            padding: "10px 14px",
          }}
        >
          {/* 문단 참조 뱃지 — para 데이터가 있을 때만 표시 */}
          {paraNums.length > 0 && (
            <div style={{ marginBottom: "6px" }}>
              {paraNums.map((n) => (
                <span
                  key={n}
                  style={{
                    display: "inline-block",
                    marginRight: "5px",
                    fontSize: "0.68rem",
                    fontWeight: "700",
                    color: "#6366f1",
                    background: "#ede9fe",
                    border: "1px solid #c4b5fd",
                    borderRadius: "4px",
                    padding: "1px 7px",
                  }}
                >
                  {n}문단
                </span>
              ))}
              <span style={{ fontSize: "0.68rem", color: "#9ca3af" }}>
                을 보면
              </span>
            </div>
          )}
          {isVocab ? (
            // 어휘 문제: 단순 텍스트 해설 (형광펜 연동 없음)
            <div
              style={{
                fontSize: "0.82rem",
                lineHeight: "1.75",
                color: "#374151",
                whiteSpace: "pre-wrap",
              }}
            >
              {cleanAnalysis(choice.analysis)}
            </div>
          ) : (
            <AnalysisBlock text={choice.analysis} />
          )}
          {/* 근거 납득 KPI — 베타 측정용 */}
          <div
            style={{
              marginTop: "10px",
              paddingTop: "8px",
              borderTop: "1px dashed #d1d5db",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.72rem",
              color: "#6b7280",
              flexWrap: "wrap",
            }}
          >
            <span>근거가 납득되시나요?</span>
            <button
              disabled={evidenceVote !== null}
              onClick={(e) => {
                e.stopPropagation();
                setEvidenceVote(true);
                saveEvidenceFeedback({
                  user,
                  yearKey,
                  setId,
                  questionId: qid,
                  choiceNum: choice.num,
                  vote: true,
                });
              }}
              style={{
                border: "1px solid #d1d5db",
                background: evidenceVote === true ? "#dcfce7" : "#fff",
                borderRadius: "12px",
                padding: "3px 10px",
                cursor: evidenceVote === null ? "pointer" : "default",
                fontSize: "0.72rem",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              👍 납득
            </button>
            <button
              disabled={evidenceVote !== null}
              onClick={(e) => {
                e.stopPropagation();
                setEvidenceVote(false);
                saveEvidenceFeedback({
                  user,
                  yearKey,
                  setId,
                  questionId: qid,
                  choiceNum: choice.num,
                  vote: false,
                });
              }}
              style={{
                border: "1px solid #d1d5db",
                background: evidenceVote === false ? "#fee2e2" : "#fff",
                borderRadius: "12px",
                padding: "3px 10px",
                cursor: evidenceVote === null ? "pointer" : "default",
                fontSize: "0.72rem",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              👎 안됨
            </button>
            {evidenceVote !== null && (
              <span style={{ color: "#10b981", fontWeight: 600 }}>
                고맙습니다
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// [6] QuestionBlock
// ══════════════════════════════════════════════════════════

// 어휘 문제 판별 — 발문에 아래 키워드 포함 시
function isVocabQuestion(questionText) {
  const t = questionText ?? "";
  return /사전적\s*의미|문맥상\s*의미|문맥적\s*의미|밑줄\s*친.*의미|㉠.*~.*㉤|ⓐ.*~.*ⓔ|단어의\s*뜻/i.test(
    t,
  );
}

function QuestionBlock({
  question,
  passageId,
  sel,
  onSelect,
  mode,
  submitted,
  isReview,
  initialClicked,
  yearKey,
  passageSents,
  user,
  setId,
  annotations = [],
}) {
  const [clicked, setClicked] = useState(
    isReview ? null : (initialClicked ?? null),
  );
  const isVocab = isVocabQuestion(question.t);

  // 선지·<보기> annotation 분류 (target field 호환 path):
  //   target === 'bogi' + qId === question.id → 본 문제 bogi 영역
  //   target === 'choice' + qId === question.id → 본 문제 선지 영역
  //     (choiceNum 별 분류는 ChoiceItem 안에서)
  const bogiAnns = annotations.filter(
    (a) =>
      a.target === "bogi" &&
      a.qId === question.id &&
      (a.type === "underline" || a.type === "box"),
  );
  const choiceAnnsAll = annotations.filter(
    (a) =>
      a.target === "choice" &&
      a.qId === question.id &&
      (a.type === "underline" || a.type === "box"),
  );

  function handleClick(uid, choice) {
    if (mode === MODE.STUDY && submitted && !isReview) return;
    if (clicked === uid) {
      setClicked(null);
      onSelect(null, null, false); // deselect
      return;
    }
    setClicked(uid);
    // [FIX] uid는 항상 실제값 전달. isVocab 플래그로 형광펜 차단은 QuizPanel에서 처리
    onSelect(uid, choice, isVocab);
  }

  const hasBogiTable = question.bogiType === "table" && question.bogiTable;

  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {/* 발문 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div
          style={{
            fontSize: "0.88rem",
            fontWeight: "600",
            color: "#111827",
            lineHeight: "1.6",
            textAlign: "left",
            flex: 1,
          }}
        >
          <span style={{ color: "#9ca3af", marginRight: "5px" }}>
            {question.id}.
          </span>
          {question.t}
        </div>
        {question.correctRate != null && (
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: "700",
              whiteSpace: "nowrap",
              flexShrink: 0,
              marginTop: "2px",
              padding: "2px 7px",
              borderRadius: "4px",
              color:
                question.correctRate >= 70
                  ? "#15803d"
                  : question.correctRate >= 40
                    ? "#854d0e"
                    : "#dc2626",
              background:
                question.correctRate >= 70
                  ? "#dcfce7"
                  : question.correctRate >= 40
                    ? "#fef9c3"
                    : "#fee2e2",
            }}
          >
            정답률 {question.correctRate}%
          </span>
        )}
      </div>

      {/* 보기 — BogiTable or BogiRenderer */}
      {hasBogiTable ? (
        <BogiTable
          bogiTable={question.bogiTable}
          sel={sel}
          onSelect={(num) => {
            const c = question.choices.find((c) => c.num === num);
            if (c) handleClick(`q${question.id}_c${num}`, c);
          }}
        />
      ) : (
        <BogiRenderer bogi={question.bogi} anns={bogiAnns} />
      )}

      {/* 어휘 문제 안내 */}
      {isVocab && (
        <div
          style={{
            fontSize: "0.72rem",
            color: "#6b7280",
            background: "#f3f4f6",
            borderRadius: "6px",
            padding: "6px 10px",
            lineHeight: 1.6,
          }}
        >
          📖 어휘 문제 — 각 선지의 단어가 지문 문맥에서 쓰인 의미와 일치하는지
          확인하세요
        </div>
      )}

      {/* 선지 목록 — BogiTable과 독립 렌더링 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {question.choices.map((c) => (
          <ChoiceItem
            key={c.num}
            choice={c}
            qid={question.id}
            questionType={question.questionType ?? "negative"}
            clicked={clicked}
            myAnswer={initialClicked ?? null}
            onSelect={handleClick}
            mode={mode}
            submitted={submitted}
            isReview={isReview}
            isVocab={isVocab}
            passageSents={passageSents}
            user={user}
            yearKey={yearKey}
            setId={setId}
            choiceAnns={choiceAnnsAll.filter((a) => a.choiceNum === c.num)}
          />
        ))}
      </div>

      {/* AI Q&A — 복습 모드에서만 */}
      {isReview && (
        <QuestionQA
          questionKey={`${yearKey}_${passageId}_${question.id}`}
          questionText={question.t}
          choices={question.choices}
          passageSents={passageSents}
          user={user}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// [7] ReportModal — 지문 단위 오답 리포트
// ══════════════════════════════════════════════════════════
function ReportModal({ totalQ, correctCount, wrongCount, log, onClose }) {
  const rate = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
  const patCounts = {};
  let unclassified = 0;
  for (const { pat } of log) {
    if (pat) patCounts[pat] = (patCounts[pat] || 0) + 1;
    else unclassified++;
  }
  const totalWrong = log.length;
  const topPat = Object.entries(patCounts).sort(([, a], [, b]) => b - a)[0];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "14px",
          padding: "24px",
          maxWidth: "380px",
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: "18px" }}>
          <div
            style={{
              fontSize: "2.2rem",
              fontWeight: "800",
              color:
                rate >= 80 ? "#16a34a" : rate >= 50 ? "#ca8a04" : "#dc2626",
            }}
          >
            {rate}%
          </div>
          <div
            style={{ fontSize: "0.82rem", color: "#6b7280", marginTop: "4px" }}
          >
            {totalQ}문제 중{" "}
            <span style={{ color: "#16a34a", fontWeight: "700" }}>
              {correctCount}개 정답
            </span>{" "}
            ·{" "}
            <span style={{ color: "#dc2626", fontWeight: "700" }}>
              {wrongCount}개 오답
            </span>
          </div>
        </div>

        <div
          style={{ height: "1px", background: "#e5e7eb", margin: "0 0 14px" }}
        />

        <h4
          style={{
            fontSize: "0.88rem",
            fontWeight: "700",
            marginBottom: "10px",
            color: "#111827",
          }}
        >
          오답 패턴 분석
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {Object.keys(P).map((k) => {
            const p = P[k];
            const n = patCounts[k] || 0;
            const pct = totalWrong > 0 ? Math.round((n / totalWrong) * 100) : 0;
            const isEmpty = n === 0;
            return (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: isEmpty ? "#f9fafb" : p.bg,
                  opacity: isEmpty ? 0.5 : 1,
                }}
              >
                <span
                  style={{
                    fontWeight: "800",
                    color: isEmpty ? "#9ca3af" : p.color,
                    minWidth: "28px",
                    fontSize: "0.75rem",
                  }}
                >
                  {k}
                </span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: "600",
                      color: isEmpty ? "#9ca3af" : "#374151",
                    }}
                  >
                    {p.name}
                  </div>
                  {!isEmpty && (
                    <div
                      style={{
                        marginTop: "3px",
                        height: "6px",
                        background: "#e5e7eb",
                        borderRadius: "3px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: p.color,
                          borderRadius: "3px",
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: "0.73rem",
                    fontWeight: "700",
                    color: isEmpty ? "#d1d5db" : p.color,
                    minWidth: "32px",
                    textAlign: "right",
                  }}
                >
                  {n > 0 ? `${n}건 ${pct}%` : "0"}
                </span>
              </div>
            );
          })}
          {unclassified > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 10px",
                borderRadius: "6px",
                background: "#f3f4f6",
              }}
            >
              <span
                style={{
                  fontWeight: "800",
                  color: "#9ca3af",
                  minWidth: "28px",
                  fontSize: "0.75rem",
                }}
              >
                -
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: "600",
                    color: "#6b7280",
                  }}
                >
                  미분류
                </div>
              </div>
              <span
                style={{
                  fontSize: "0.73rem",
                  fontWeight: "700",
                  color: "#9ca3af",
                  minWidth: "32px",
                  textAlign: "right",
                }}
              >
                {unclassified}건
              </span>
            </div>
          )}
        </div>

        {topPat && P[topPat[0]] && (
          <div
            style={{
              marginTop: "14px",
              padding: "10px 12px",
              background: "#fffbeb",
              border: "1px solid #fbbf24",
              borderRadius: "8px",
              fontSize: "0.8rem",
              lineHeight: "1.5",
              color: "#92400e",
            }}
          >
            <strong>
              {topPat[0]} {P[topPat[0]].name}
            </strong>
            이 가장 많습니다. {P[topPat[0]].desc}
          </div>
        )}
        {!topPat && wrongCount === 0 && (
          <div
            style={{
              marginTop: "14px",
              padding: "10px 12px",
              background: "#ecfdf5",
              border: "1px solid #6ee7b7",
              borderRadius: "8px",
              fontSize: "0.8rem",
              color: "#065f46",
              textAlign: "center",
            }}
          >
            전문 만점! 훌륭합니다 🎉
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "10px",
            borderRadius: "8px",
            background: "#1f2937",
            color: "#fff",
            border: "none",
            fontWeight: "700",
            cursor: "pointer",
            fontSize: "0.88rem",
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// [8] QuizPanel — 메인 컴포넌트
// ══════════════════════════════════════════════════════════
export default function QuizPanel({
  passageSet,
  sel,
  onSelChange,
  user,
  yearKey,
  mode,
  studyAnswers = {},
  onStudyAnswer,
  submitted = false,
  isReview = false,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) {
  const isStudy = mode === MODE.STUDY;

  const [log, setLog] = useState([]);
  const [answered, setAnswered] = useState(new Set());
  const [showReport, setShowReport] = useState(false);
  const autoShownRef = useRef(false);

  // 세트 변경 시 리셋
  const setId = passageSet?.id;
  useEffect(() => {
    setLog([]);
    setAnswered(new Set());
    setShowReport(false);
    autoShownRef.current = false;
  }, [setId]);

  // 풀이 모드 제출 완료 시 log/answered 계산
  useEffect(() => {
    if (!submitted || !passageSet) return;
    const newLog = [];
    const newAnswered = new Set();
    for (const [qidStr, choiceNum] of Object.entries(studyAnswers)) {
      const qid = parseInt(qidStr, 10);
      const q = passageSet.questions.find((q) => q.id === qid);
      if (!q) continue;
      const choice = q.choices.find((c) => c.num === choiceNum);
      if (!choice) continue;
      const qt = q.questionType ?? "negative";
      const isCorrect =
        qt === "positive" ? choice.ok === true : choice.ok === false;
      newAnswered.add(qid);
      if (!isCorrect)
        newLog.push({ uid: `q${qid}_c${choiceNum}`, pat: choice.pat });
    }
    setAnswered(newAnswered);
    setLog(newLog);
    // 복습 모드에서는 ReportModal 자동 표시 안 함
    if (!autoShownRef.current && !isReview) {
      autoShownRef.current = true;
      setTimeout(() => setShowReport(true), 400);
    }
  }, [submitted, setId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!passageSet) return null;

  const totalQ = passageSet.questions.length;
  const correctCount = answered.size - log.length;
  const wrongCount = log.length;

  // [FIX] isVocab 3번째 인자 추가
  // uid는 항상 실제값(non-null) 또는 deselect 시 null
  // isVocab=true 이면 형광펜 연동(onSelChange) 생략
  function handleSelect(uid, choice, isVocab) {
    if (isStudy && !submitted && !isReview) {
      // 풀이 모드 미제출
      if (!choice || !uid) return; // deselect 또는 안전 가드
      const qid = parseInt(uid.split("_c")[0].replace("q", ""), 10);
      onStudyAnswer(qid, choice.num);
      // 어휘 문제는 형광펜 비활성화, 그 외는 null (풀이 모드 중 형광펜 없음)
      onSelChange(null, null);
    } else {
      // 보기/복습/제출 후 모드
      // 어휘 문제는 형광펜 연동 안 함
      onSelChange(isVocab ? null : uid, isVocab ? null : choice);
      if (!choice || !uid) return;
      // VIEW 모드에서는 answered/log/ReportModal 추적 안 함
      if (!isStudy) return;
      const qid = parseInt(uid.split("_c")[0].replace("q", ""), 10);
      const q = passageSet.questions.find((q) => q.id === qid);
      const qt = q?.questionType ?? "negative";
      const isCorrect =
        qt === "positive" ? choice.ok === true : choice.ok === false;
      setAnswered((prev) => {
        const next = new Set(prev);
        next.add(qid);
        if (next.size === totalQ && !autoShownRef.current && !isReview) {
          autoShownRef.current = true;
          setTimeout(() => setShowReport(true), 400);
        }
        return next;
      });
      if (!isCorrect) {
        setLog((prev) =>
          prev.find((w) => w.uid === uid)
            ? prev
            : [...prev, { uid, pat: choice.pat }],
        );
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {passageSet.questions.map((q) => (
        <QuestionBlock
          key={`${passageSet.id}-${q.id}`}
          question={q}
          passageId={passageSet.id}
          sel={sel}
          onSelect={handleSelect}
          mode={mode}
          submitted={submitted}
          isReview={isReview}
          initialClicked={
            studyAnswers[q.id] != null
              ? `q${q.id}_c${studyAnswers[q.id]}`
              : undefined
          }
          yearKey={yearKey}
          passageSents={passageSet.sents}
          user={user}
          setId={passageSet.id}
          annotations={passageSet.annotations || []}
        />
      ))}

      {/* 지문별 리포트 버튼 (보기 모드) */}
      {!isStudy && answered.size > 0 && (
        <button
          onClick={() => setShowReport(true)}
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            background: "#1f2937",
            color: "#fff",
            border: "none",
            fontWeight: "700",
            cursor: "pointer",
            alignSelf: "flex-end",
            fontSize: "0.85rem",
          }}
        >
          📊 리포트 ({answered.size}/{totalQ})
        </button>
      )}

      {showReport && (
        <ReportModal
          totalQ={totalQ}
          correctCount={correctCount}
          wrongCount={wrongCount}
          log={log}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* 이전/다음 지문 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "8px",
        }}
      >
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          style={{
            padding: "9px 16px",
            borderRadius: "8px",
            fontSize: "0.83rem",
            fontWeight: "600",
            border: "1px solid #d1d5db",
            cursor: hasPrev ? "pointer" : "not-allowed",
            background: hasPrev ? "#f2f7f2" : "#f9fafb",
            color: hasPrev ? "#2d6e2d" : "#d1d5db",
          }}
        >
          ← 이전 지문
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          style={{
            padding: "9px 16px",
            borderRadius: "8px",
            fontSize: "0.83rem",
            fontWeight: "600",
            border: "1px solid #d1d5db",
            cursor: hasNext ? "pointer" : "not-allowed",
            background: hasNext ? "#f2f7f2" : "#f9fafb",
            color: hasNext ? "#2d6e2d" : "#d1d5db",
          }}
        >
          다음 지문 →
        </button>
      </div>
    </div>
  );
}
