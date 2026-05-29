// ============================================================
// AuditPanel.jsx — annotation 검수 보드 (MVP 1차, view-only)
// 라우트: /audit/:setId
// 권한: 마스터 (MASTER_ALLOWLIST) 전용 — 일반 메뉴 노출 X
// 기능:
//   ① 본문 sents + 발문/선지/bogi marker 시각화
//   ② annotation (underline/marker/bracket/box) 표시
//   ③ 자동 의심 이슈 (marker/underline/bracket/DEAD 분리)
// ============================================================

import { useEffect, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { isAllowlisted } from "./constants";
import { loadAllData } from "./dataLoader";

const MARKER_RE = /[ⓐ-ⓩ㉠-㉮]/g;

function getBogiText(bogi) {
  if (typeof bogi === "string") return bogi;
  if (bogi && typeof bogi === "object") return bogi.text || "";
  return "";
}

// 본문 marker 추출 (sentId → markers[])
function extractBodyMarkers(sents) {
  const map = new Map();
  for (const sent of sents) {
    const t = sent.t || "";
    if (typeof t !== "string") continue;
    const ms = t.match(MARKER_RE);
    if (ms && ms.length > 0) map.set(sent.id, ms);
  }
  return map;
}

// 발문/선지/bogi 의 marker 추출
function extractQuestionMarkers(questions) {
  const out = [];
  for (const q of questions) {
    const qm = new Set();
    const fields = [q.t, getBogiText(q.bogi)];
    for (const c of q.choices || []) {
      if (typeof c === "string") fields.push(c);
      else fields.push(c.t || c.text || "");
    }
    for (const f of fields) {
      if (typeof f !== "string") continue;
      const ms = f.match(MARKER_RE);
      if (ms) ms.forEach((m) => qm.add(m));
    }
    if (qm.size > 0) out.push({ qid: q.id, markers: [...qm].sort() });
  }
  return out;
}

// 자동 의심 이슈 검증
function auditSet(set, annList) {
  const sents = set.sents || [];
  const realSids = new Set(sents.map((s) => s.id));
  const bodyMarkerMap = extractBodyMarkers(sents);
  const bodyMarkers = new Set();
  for (const ms of bodyMarkerMap.values()) ms.forEach((m) => bodyMarkers.add(m));
  const qMarkers = extractQuestionMarkers(set.questions || []);
  const allQMarkers = new Set();
  for (const q of qMarkers) q.markers.forEach((m) => allQMarkers.add(m));

  const issues = { marker: [], underline: [], bracket: [], dead: [] };

  // ── A. marker 이슈 ──
  // 발문/선지/bogi 에 marker 있는데 본문에 없음 (verbatim 위반)
  for (const m of allQMarkers) {
    if (!bodyMarkers.has(m)) {
      const qs = qMarkers.filter((q) => q.markers.includes(m)).map((q) => q.qid);
      issues.marker.push({
        kind: "Q_has_no_body",
        marker: m,
        detail: `발문/선지/bogi(Q${qs.join(",")})에 있으나 본문에 없음`,
      });
    }
  }
  // 본문에 marker 있는데 발문/선지/bogi 어디에도 없음 (orphan)
  for (const m of bodyMarkers) {
    if (!allQMarkers.has(m)) {
      const sids = [];
      for (const [sid, ms] of bodyMarkerMap)
        if (ms.includes(m)) sids.push(sid);
      issues.marker.push({
        kind: "body_orphan",
        marker: m,
        detail: `본문(${sids.slice(0, 2).join(", ")})에 있으나 문제 어디에도 없음`,
      });
    }
  }

  // ── B. underline 이슈 ──
  const underlines = annList.filter((a) => a.type === "underline");
  // 본문 marker 수 vs underline 수
  const bodyMarkerCount = [...bodyMarkers].length;
  if (underlines.length < bodyMarkerCount) {
    issues.underline.push({
      kind: "count_mismatch",
      detail: `본문 marker ${bodyMarkerCount}개 vs underline ${underlines.length}개 — ${bodyMarkerCount - underlines.length}개 누락`,
    });
  }
  // underline 의 text 가 본문 sent 에 실제 있는지
  for (const u of underlines) {
    const sentT = sents.find((s) => s.id === u.sentId)?.t || "";
    if (typeof sentT === "string" && u.text && !sentT.includes(u.text)) {
      issues.underline.push({
        kind: "text_not_found",
        detail: `underline @ ${u.sentId} text="${u.text.slice(0, 30)}..." — 본문에 없음`,
      });
    }
  }
  // marker 필드 vs 본문 위치 일치
  for (const u of underlines) {
    if (!u.marker) continue;
    const sentT = sents.find((s) => s.id === u.sentId)?.t || "";
    if (typeof sentT !== "string" || !u.text) continue;
    const idx = sentT.indexOf(u.text);
    if (idx <= 0) continue;
    const prev = sentT[idx - 1];
    if (prev !== u.marker) {
      issues.underline.push({
        kind: "marker_position_mismatch",
        detail: `underline @ ${u.sentId} marker="${u.marker}" — 본문 직전 문자 "${prev}" 불일치`,
      });
    }
  }

  // ── C. bracket 이슈 ──
  const brackets = annList.filter((a) => a.type === "bracket");
  for (const b of brackets) {
    if (b.sentFrom === b.sentTo) {
      issues.bracket.push({
        kind: "single_sent",
        detail: `bracket [${b.label}] sentFrom == sentTo (${b.sentFrom}) — 범위 단일`,
      });
    }
    if (!realSids.has(b.sentFrom)) {
      issues.bracket.push({
        kind: "from_not_exist",
        detail: `bracket [${b.label}] sentFrom="${b.sentFrom}" — 실제 sentId 아님`,
      });
    }
    if (!realSids.has(b.sentTo)) {
      issues.bracket.push({
        kind: "to_not_exist",
        detail: `bracket [${b.label}] sentTo="${b.sentTo}" — 실제 sentId 아님`,
      });
    }
  }

  // ── D. DEAD 이슈 ──
  for (const a of annList) {
    for (const field of ["sentId", "sentFrom", "sentTo"]) {
      if (a[field] && !realSids.has(a[field])) {
        issues.dead.push({
          kind: "dead_ann_sentid",
          detail: `${a.type} ${field}="${a[field]}" — 실제 sentId 아님`,
        });
      }
    }
  }
  // cs_ids DEAD
  for (const q of set.questions || []) {
    for (const c of q.choices || []) {
      for (const cid of c.cs_ids || []) {
        if (!realSids.has(cid)) {
          issues.dead.push({
            kind: "dead_cs_ids",
            detail: `Q${q.id} 선지${c.num} cs_ids="${cid}" — 실제 sentId 아님`,
          });
        }
      }
    }
  }

  return {
    bodyMarkers: [...bodyMarkers].sort(),
    bodyMarkerMap,
    qMarkers,
    allQMarkers: [...allQMarkers].sort(),
    annList,
    issues,
    realSids,
  };
}

export default function AuditPanel({ user }) {
  const { setId } = useParams();
  const [allData, setAllData] = useState(null);
  const [annotations, setAnnotations] = useState(null);
  const [err, setErr] = useState(null);

  // 마스터 권한 체크
  if (!user || !isAllowlisted(user.email)) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    loadAllData()
      .then((data) => setAllData(data))
      .catch((e) => setErr(e.message));
    fetch("/data/annotations.json")
      .then((r) => r.json())
      .then((a) => setAnnotations(a))
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div style={{ padding: 20 }}>오류: {err}</div>;
  if (!allData || !annotations)
    return <div style={{ padding: 20 }}>데이터 로딩 중…</div>;

  // setId 검색
  let foundSet = null;
  let foundYear = null;
  for (const yk of Object.keys(allData)) {
    for (const dom of ["reading", "literature"]) {
      const list = allData[yk]?.[dom] || [];
      const found = list.find((s) => s.id === setId);
      if (found) {
        foundSet = found;
        foundYear = yk;
        break;
      }
    }
    if (foundSet) break;
  }

  if (!foundSet)
    return (
      <div style={{ padding: 20 }}>
        setId={setId} 못 찾음. <Link to="/">홈으로</Link>
      </div>
    );

  const annList = annotations[foundYear]?.[setId] || [];
  const audit = auditSet(foundSet, annList);

  return (
    <div
      style={{
        padding: "20px 24px",
        fontFamily: "'Noto Sans KR', sans-serif",
        background: "#f9fafb",
        minHeight: "100vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Link to="/" style={{ fontSize: 12, color: "#6b7280" }}>
          ← 홈
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1f2937", margin: 0 }}>
          🔍 Audit: {setId}
        </h1>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          {foundYear} · {foundSet.sents?.length || 0} sents ·{" "}
          {foundSet.questions?.length || 0} Qs
        </span>
        <span
          style={{
            fontSize: 11,
            background: "#fef3c7",
            color: "#92400e",
            padding: "3px 8px",
            borderRadius: 4,
            fontWeight: 700,
          }}
        >
          MASTER ONLY · view-only
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        {/* 좌측: 본문 + 발문/선지/bogi marker */}
        <div>
          <Section title="본문 sents (marker 강조)">
            <div
              style={{
                maxHeight: "55vh",
                overflowY: "auto",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              {foundSet.sents.map((sent) => {
                const t = sent.t || "";
                const hasMarker = typeof t === "string" && MARKER_RE.test(t);
                MARKER_RE.lastIndex = 0;
                return (
                  <div
                    key={sent.id}
                    style={{
                      padding: "4px 0",
                      borderBottom: "1px dashed #f3f4f6",
                      background: hasMarker ? "#fffbea" : "transparent",
                    }}
                  >
                    <code style={{ color: "#6b7280", fontSize: 11, marginRight: 8 }}>
                      {sent.id}
                    </code>
                    {renderTextWithMarkers(t)}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="발문 / 선지 / bogi marker">
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
              }}
            >
              {foundSet.questions.map((q) => {
                const qMarkers = (q.t || "").match(MARKER_RE) || [];
                const bogiMarkers =
                  (getBogiText(q.bogi).match(MARKER_RE) || []);
                const choiceMarkers = (q.choices || [])
                  .flatMap((c) =>
                    ((typeof c === "string" ? c : c.t || c.text || "").match(
                      MARKER_RE,
                    ) || []),
                  );
                const allM = [
                  ...new Set([
                    ...qMarkers,
                    ...bogiMarkers,
                    ...choiceMarkers,
                  ]),
                ].sort();
                if (allM.length === 0) return null;
                return (
                  <div
                    key={q.id}
                    style={{
                      padding: "6px 0",
                      borderBottom: "1px dashed #f3f4f6",
                    }}
                  >
                    <strong>Q{q.id}</strong>{" "}
                    <span style={{ color: "#6b7280" }}>
                      발문={qMarkers.join("") || "·"} · 선지=
                      {[...new Set(choiceMarkers)].join("") || "·"} · bogi=
                      {bogiMarkers.join("") || "·"}
                    </span>
                    <span
                      style={{
                        marginLeft: 8,
                        background: "#dbeafe",
                        color: "#1e40af",
                        padding: "2px 6px",
                        borderRadius: 3,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {allM.join("")}
                    </span>
                  </div>
                );
              })}
              {foundSet.questions.every(
                (q) =>
                  !((q.t || "").match(MARKER_RE) || []).length &&
                  !((getBogiText(q.bogi) || "").match(MARKER_RE) || []).length &&
                  !(q.choices || []).some((c) =>
                    ((typeof c === "string" ? c : c.t || c.text || "").match(
                      MARKER_RE,
                    ) || []).length,
                  ),
              ) && (
                <div style={{ color: "#9ca3af", fontSize: 12 }}>
                  발문/선지/bogi 에 marker 없음
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* 우측: annotation 목록 + 의심 이슈 */}
        <div>
          <Section title={`annotations (${annList.length}건)`}>
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                maxHeight: "40vh",
                overflowY: "auto",
              }}
            >
              {annList.length === 0 && (
                <div style={{ color: "#9ca3af" }}>annotation 없음</div>
              )}
              {annList.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: 6,
                    marginBottom: 4,
                    background: typeColor(a.type),
                    borderRadius: 4,
                  }}
                >
                  <strong>{a.type}</strong>
                  {a.marker && (
                    <span
                      style={{
                        marginLeft: 6,
                        background: "#1f2937",
                        color: "#fff",
                        padding: "1px 6px",
                        borderRadius: 3,
                        fontWeight: 700,
                      }}
                    >
                      {a.marker}
                    </span>
                  )}
                  {a.label && (
                    <span style={{ marginLeft: 6, fontWeight: 700 }}>
                      [{a.label}]
                    </span>
                  )}{" "}
                  {a.sentId && (
                    <code style={{ color: "#6b7280" }}>{a.sentId}</code>
                  )}
                  {a.sentFrom && (
                    <code style={{ color: "#6b7280" }}>
                      {a.sentFrom} ~ {a.sentTo}
                    </code>
                  )}
                  {a.text && (
                    <div style={{ color: "#374151", marginTop: 2 }}>
                      "{a.text.slice(0, 80)}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title="🚨 의심 이슈 (자동 검증)">
            <IssueBlock
              label="marker"
              color="#ef4444"
              issues={audit.issues.marker}
            />
            <IssueBlock
              label="underline"
              color="#f59e0b"
              issues={audit.issues.underline}
            />
            <IssueBlock
              label="bracket"
              color="#3b82f6"
              issues={audit.issues.bracket}
            />
            <IssueBlock
              label="DEAD"
              color="#7c3aed"
              issues={audit.issues.dead}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#374151",
          marginBottom: 6,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function IssueBlock({ label, color, issues }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            background: color,
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 3,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {issues.length} 건
        </span>
      </div>
      {issues.length === 0 ? (
        <div style={{ fontSize: 11, color: "#10b981", paddingLeft: 4 }}>
          ✓ 이슈 없음
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: 8,
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {issues.map((iss, i) => (
            <div
              key={i}
              style={{
                padding: 4,
                color: "#1f2937",
                borderBottom: i < issues.length - 1 ? "1px dashed #f3f4f6" : "none",
              }}
            >
              <strong style={{ color }}>[{iss.kind}]</strong> {iss.detail}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function typeColor(type) {
  switch (type) {
    case "underline":
      return "#fef9c3";
    case "marker":
      return "#fce7f3";
    case "bracket":
      return "#dbeafe";
    case "box":
      return "#dcfce7";
    default:
      return "#f3f4f6";
  }
}

// marker 시각 강조 — 텍스트 안의 marker 를 하이라이트
function renderTextWithMarkers(text) {
  if (typeof text !== "string") return text;
  const parts = [];
  let last = 0;
  const re = /[ⓐ-ⓩ㉠-㉮]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span
        key={m.index}
        style={{
          background: "#fcd34d",
          color: "#7c2d12",
          fontWeight: 700,
          padding: "0 3px",
          borderRadius: 2,
        }}
      >
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
