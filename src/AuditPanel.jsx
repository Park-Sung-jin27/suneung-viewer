// ============================================================
// AuditPanel.jsx — annotation 검수 보드 (v3: 정정 입력 폼 + 명세 출력)
// 라우트: /audit/:setId
// 권한: 마스터 (MASTER_ALLOWLIST) 전용 — 일반 메뉴 노출 X
// 기능:
//   ① 본문 sents + 발문/선지/bogi marker 시각화 (view-only)
//   ② annotation (underline/marker/bracket/box) 표시 (view-only)
//   ③ 자동 의심 이슈 (marker_body / marker_bogi / underline / bracket / DEAD 분리)
//   ④ [v3] 정정 입력 폼 — staging 후 텍스트/JSON 명세 출력 (데이터 변경 X)
// ============================================================

import { useEffect, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { isAllowlisted } from "./constants";
import { loadAllData } from "./dataLoader";

const MARKER_RE = /[ⓐ-ⓩ㉠-㉮]/g;

const MARKER_CHOICES = [
  "ⓐ","ⓑ","ⓒ","ⓓ","ⓔ","ⓕ","ⓖ","ⓗ","ⓘ","ⓙ",
  "ⓚ","ⓛ","ⓜ","ⓝ","ⓞ","ⓟ","ⓠ","ⓡ","ⓢ","ⓣ",
  "ⓤ","ⓥ","ⓦ","ⓧ","ⓨ","ⓩ",
  "㉠","㉡","㉢","㉣","㉤","㉥","㉦","㉧","㉨","㉩",
  "㉪","㉫","㉬","㉭","㉮",
];

function getBogiText(bogi) {
  if (typeof bogi === "string") return bogi;
  if (bogi && typeof bogi === "object") return bogi.text || "";
  return "";
}

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

function extractQuestionMarkers(questions) {
  const out = [];
  for (const q of questions) {
    const qStem = new Set();
    const qChoice = new Set();
    const qBogi = new Set();
    const stemT = typeof q.t === "string" ? q.t : "";
    const stemMs = stemT.match(MARKER_RE);
    if (stemMs) stemMs.forEach((m) => qStem.add(m));
    for (const c of q.choices || []) {
      const cT = typeof c === "string" ? c : (c.t || c.text || "");
      if (typeof cT !== "string") continue;
      const ms = cT.match(MARKER_RE);
      if (ms) ms.forEach((m) => qChoice.add(m));
    }
    const bogiT = getBogiText(q.bogi);
    if (typeof bogiT === "string") {
      const ms = bogiT.match(MARKER_RE);
      if (ms) ms.forEach((m) => qBogi.add(m));
    }
    if (qStem.size + qChoice.size + qBogi.size > 0) {
      out.push({
        qid: q.id,
        stemMarkers: [...qStem].sort(),
        choiceMarkers: [...qChoice].sort(),
        bogiMarkers: [...qBogi].sort(),
        markers: [...new Set([...qStem, ...qChoice, ...qBogi])].sort(),
      });
    }
  }
  return out;
}

function auditSet(set, annList) {
  const sents = set.sents || [];
  const realSids = new Set(sents.map((s) => s.id));
  const bodyMarkerMap = extractBodyMarkers(sents);
  const bodyMarkers = new Set();
  for (const ms of bodyMarkerMap.values()) ms.forEach((m) => bodyMarkers.add(m));
  const qMarkers = extractQuestionMarkers(set.questions || []);
  const allQMarkers = new Set();
  for (const q of qMarkers) q.markers.forEach((m) => allQMarkers.add(m));

  const stemSet = new Set();
  const choiceSet = new Set();
  const bogiSet = new Set();
  for (const q of qMarkers) {
    q.stemMarkers.forEach((m) => stemSet.add(m));
    q.choiceMarkers.forEach((m) => choiceSet.add(m));
    q.bogiMarkers.forEach((m) => bogiSet.add(m));
  }

  const issues = { marker_body: [], marker_bogi: [], underline: [], bracket: [], dead: [] };

  for (const m of stemSet) {
    if (!bodyMarkers.has(m)) {
      const qs = qMarkers.filter((q) => q.stemMarkers.includes(m)).map((q) => q.qid);
      issues.marker_body.push({ kind: "q_in_body_missing", scope: "q", marker: m, detail: `발문(Q${qs.join(",")})에 있으나 본문에 없음` });
    }
  }
  for (const m of choiceSet) {
    if (!bodyMarkers.has(m) && !bogiSet.has(m)) {
      const qs = qMarkers.filter((q) => q.choiceMarkers.includes(m)).map((q) => q.qid);
      issues.marker_body.push({ kind: "choice_in_body_missing", scope: "choice", marker: m, detail: `선지(Q${qs.join(",")})에 있으나 본문/bogi 어디에도 없음` });
    }
  }
  for (const m of bodyMarkers) {
    if (!allQMarkers.has(m)) {
      const sids = [];
      for (const [sid, ms] of bodyMarkerMap) if (ms.includes(m)) sids.push(sid);
      issues.marker_body.push({ kind: "body_orphan", scope: "body", marker: m, detail: `본문(${sids.slice(0, 2).join(", ")})에 있으나 문제 어디에도 없음` });
    }
  }
  for (const m of bogiSet) {
    const qs = qMarkers.filter((q) => q.bogiMarkers.includes(m)).map((q) => q.qid);
    if (bodyMarkers.has(m)) continue;
    const referencedByStem = qMarkers.some((q) => q.bogiMarkers.includes(m) && q.stemMarkers.includes(m));
    const referencedByChoice = qMarkers.some((q) => q.bogiMarkers.includes(m) && q.choiceMarkers.includes(m));
    if (referencedByStem || referencedByChoice) {
      issues.marker_bogi.push({ kind: "bogi_self_definition", scope: "bogi", marker: m, detail: `bogi(Q${qs.join(",")})에서 자체 정의 — 발문/선지에서 참조 O (정상)` });
    } else {
      issues.marker_bogi.push({ kind: "bogi_orphan", scope: "bogi", marker: m, detail: `bogi(Q${qs.join(",")})에 있으나 발문/선지에서 참조 X` });
    }
  }

  const underlines = annList.filter((a) => a.type === "underline");
  const bodyMarkerCount = [...bodyMarkers].length;
  if (underlines.length < bodyMarkerCount) {
    issues.underline.push({ kind: "count_mismatch", detail: `본문 marker ${bodyMarkerCount}개 vs underline ${underlines.length}개 — ${bodyMarkerCount - underlines.length}개 누락` });
  }
  for (const u of underlines) {
    const sentT = sents.find((s) => s.id === u.sentId)?.t || "";
    if (typeof sentT === "string" && u.text && !sentT.includes(u.text)) {
      issues.underline.push({ kind: "text_not_found", detail: `underline @ ${u.sentId} text="${u.text.slice(0, 30)}..." — 본문에 없음` });
    }
  }
  for (const u of underlines) {
    if (!u.marker) continue;
    const sentT = sents.find((s) => s.id === u.sentId)?.t || "";
    if (typeof sentT !== "string" || !u.text) continue;
    const idx = sentT.indexOf(u.text);
    if (idx <= 0) continue;
    const prev = sentT[idx - 1];
    if (prev !== u.marker) {
      issues.underline.push({ kind: "marker_position_mismatch", detail: `underline @ ${u.sentId} marker="${u.marker}" — 본문 직전 문자 "${prev}" 불일치` });
    }
  }

  const brackets = annList.filter((a) => a.type === "bracket");
  for (const b of brackets) {
    if (b.sentFrom === b.sentTo) {
      issues.bracket.push({ kind: "single_sent", detail: `bracket [${b.label}] sentFrom == sentTo (${b.sentFrom}) — 범위 단일` });
    }
    if (!realSids.has(b.sentFrom)) {
      issues.bracket.push({ kind: "from_not_exist", detail: `bracket [${b.label}] sentFrom="${b.sentFrom}" — 실제 sentId 아님` });
    }
    if (!realSids.has(b.sentTo)) {
      issues.bracket.push({ kind: "to_not_exist", detail: `bracket [${b.label}] sentTo="${b.sentTo}" — 실제 sentId 아님` });
    }
  }

  for (const a of annList) {
    for (const field of ["sentId", "sentFrom", "sentTo"]) {
      if (a[field] && !realSids.has(a[field])) {
        issues.dead.push({ kind: "dead_ann_sentid", detail: `${a.type} ${field}="${a[field]}" — 실제 sentId 아님` });
      }
    }
  }
  for (const q of set.questions || []) {
    for (const c of q.choices || []) {
      for (const cid of c.cs_ids || []) {
        if (!realSids.has(cid)) {
          issues.dead.push({ kind: "dead_cs_ids", detail: `Q${q.id} 선지${c.num} cs_ids="${cid}" — 실제 sentId 아님` });
        }
      }
    }
  }

  return { bodyMarkers: [...bodyMarkers].sort(), bodyMarkerMap, qMarkers, allQMarkers: [...allQMarkers].sort(), annList, issues, realSids };
}

export default function AuditPanel({ user }) {
  const { setId } = useParams();
  const [allData, setAllData] = useState(null);
  const [annotations, setAnnotations] = useState(null);
  const [err, setErr] = useState(null);

  const [stagedItems, setStagedItems] = useState([]);
  const [activeSentId, setActiveSentId] = useState(null);
  const [bracketStartSent, setBracketStartSent] = useState(null);
  const [bracketEndSent, setBracketEndSent] = useState(null);

  // v3.1: cs_ids review state
  const [csCandidates, setCsCandidates] = useState(null);
  const [csApprovals, setCsApprovals] = useState({}); // key: "qId-cNum" → { sentId, score }

  // v3.2: deletion staging — conditional return 앞에 위치 의무 (React Hooks 규칙)
  const [stagedDeletions, setStagedDeletions] = useState([]);

  const [uMarker, setUMarker] = useState("");
  const [uText, setUText] = useState("");
  const [mkMarker, setMkMarker] = useState("");
  const [mkText, setMkText] = useState("");
  const [mkEndMarker, setMkEndMarker] = useState(false);
  const [brLabel, setBrLabel] = useState("");
  const [boxMarker, setBoxMarker] = useState("");
  const [boxWidth, setBoxWidth] = useState("");
  const [boxLabel, setBoxLabel] = useState("");
  const [boxTarget, setBoxTarget] = useState("body");
  const [boxQid, setBoxQid] = useState("");

  if (!user || !isAllowlisted(user.email)) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    loadAllData().then((data) => setAllData(data)).catch((e) => setErr(e.message));
    fetch("/data/annotations.json").then((r) => r.json()).then((a) => setAnnotations(a)).catch((e) => setErr(e.message));
    // v3.1: cs_ids candidates fetch (optional — 없어도 보드 동작)
    fetch("/audit_data/cs_ids_candidates.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setCsCandidates(c))
      .catch(() => setCsCandidates(null));
  }, []);

  if (err) return <div style={{ padding: 20 }}>오류: {err}</div>;
  if (!allData || !annotations) return <div style={{ padding: 20 }}>데이터 로딩 중…</div>;

  let foundSet = null;
  let foundYear = null;
  for (const yk of Object.keys(allData)) {
    for (const dom of ["reading", "literature"]) {
      const list = allData[yk]?.[dom] || [];
      const found = list.find((s) => s.id === setId);
      if (found) { foundSet = found; foundYear = yk; break; }
    }
    if (foundSet) break;
  }

  if (!foundSet) return (<div style={{ padding: 20 }}>setId={setId} 못 찾음. <Link to="/">홈으로</Link></div>);

  const annList = annotations[foundYear]?.[setId] || [];
  const audit = auditSet(foundSet, annList);

  const addStaged = (item) => setStagedItems((prev) => [...prev, item]);
  const removeStaged = (idx) => setStagedItems((prev) => prev.filter((_, i) => i !== idx));
  const clearStaged = () => { setStagedItems([]); setBracketStartSent(null); setBracketEndSent(null); };

  const handleAddUnderline = () => {
    if (!activeSentId || !uText.trim()) { alert("sent 를 좌측에서 클릭하고 text 를 입력하세요."); return; }
    addStaged({ type: "underline", sentId: activeSentId, marker: uMarker || "", text: uText.trim() });
    setUMarker(""); setUText("");
  };

  const handleAddMarker = () => {
    if (!activeSentId || !mkText.trim()) { alert("sent 를 좌측에서 클릭하고 text 를 입력하세요."); return; }
    addStaged({ type: "marker", sentId: activeSentId, marker: mkMarker || "", text: mkText.trim(), endMarker: mkEndMarker });
    setMkMarker(""); setMkText(""); setMkEndMarker(false);
  };

  const handleAddBracket = () => {
    if (!bracketStartSent || !bracketEndSent || !brLabel.trim()) { alert("시작 sent / 끝 sent / label 을 모두 입력하세요."); return; }
    addStaged({ type: "bracket", label: brLabel.trim(), sentFrom: bracketStartSent, sentTo: bracketEndSent });
    setBracketStartSent(null); setBracketEndSent(null); setBrLabel("");
  };

  const handleAddBox = () => {
    if (!boxMarker && !boxLabel) { alert("marker 또는 label 중 하나는 입력하세요."); return; }
    const payload = { type: "blank-box", target: boxTarget };
    if (boxMarker) payload.marker = boxMarker;
    if (boxLabel) payload.label = boxLabel;
    if (boxWidth) payload.width = boxWidth;
    if (boxTarget === "bogi" && boxQid) payload.qId = boxQid;
    addStaged(payload);
    setBoxMarker(""); setBoxWidth(""); setBoxLabel(""); setBoxQid("");
  };

  const buildTextSpec = () => {
    const lines = [`[${setId}]`];
    for (const item of stagedItems) {
      if (item.type === "underline") {
        const mk = item.marker ? ` [${item.marker}]` : "";
        const sidPart = item.sentId.replace(setId, "");
        lines.push(`underline @ ${sidPart}${mk} "${item.text}"`);
      } else if (item.type === "marker") {
        const mk = item.marker ? ` [${item.marker}]` : "";
        const sidPart = item.sentId.replace(setId, "");
        const endTag = item.endMarker ? " (endMarker)" : "";
        lines.push(`marker @ ${sidPart}${mk} "${item.text}"${endTag}`);
      } else if (item.type === "bracket") {
        const fromPart = item.sentFrom.replace(setId, "");
        const toPart = item.sentTo.replace(setId, "");
        lines.push(`bracket [${item.label}] ${fromPart} ~ ${toPart}`);
      } else if (item.type === "blank-box") {
        const mk = item.marker ? ` [${item.marker}]` : "";
        const lbl = item.label ? ` label="${item.label}"` : "";
        const w = item.width ? ` width="${item.width}"` : "";
        const qPart = item.qId ? ` qId=${item.qId}` : "";
        lines.push(`blank-box @ ${item.target}${qPart}${mk}${lbl}${w}`);
      }
    }
    return lines.join("\n");
  };

  // v3.2: deletion staging — 함수들 (state 는 위 conditional return 앞에 선언됨)
  const addDeletion = (ann) => {
    // ann = annotations.json 안 한 entry. 식별자 = sentId + type + (marker || text)
    const key = JSON.stringify({
      type: ann.type,
      sentId: ann.sentId || null,
      sentFrom: ann.sentFrom || null,
      sentTo: ann.sentTo || null,
      marker: ann.marker || null,
      text: ann.text || null,
      label: ann.label || null,
      target: ann.target || null,
      qId: ann.qId || null,
    });
    setStagedDeletions((prev) => prev.includes(key) ? prev : [...prev, key]);
  };
  const removeDeletion = (idx) => setStagedDeletions((prev) => prev.filter((_, i) => i !== idx));
  const clearDeletions = () => setStagedDeletions([]);
  const isStagedForDeletion = (ann) => {
    const key = JSON.stringify({
      type: ann.type,
      sentId: ann.sentId || null,
      sentFrom: ann.sentFrom || null,
      sentTo: ann.sentTo || null,
      marker: ann.marker || null,
      text: ann.text || null,
      label: ann.label || null,
      target: ann.target || null,
      qId: ann.qId || null,
    });
    return stagedDeletions.includes(key);
  };

  const buildJsonSpec = () => {
    const deletions = stagedDeletions.map((k) => JSON.parse(k));
    return JSON.stringify({ setId, year: foundYear, additions: stagedItems, deletions }, null, 2);
  };

  const copyToClipboard = (text) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => alert("클립보드에 복사됨"),
        () => alert("복사 실패 — 직접 선택 후 Ctrl+C 하세요."),
      );
    } else {
      alert("클립보드 API 미지원 — 직접 선택 후 Ctrl+C 하세요.");
    }
  };

  return (
    <div style={{ padding: "20px 24px", fontFamily: "'Noto Sans KR', sans-serif", background: "#f9fafb", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Link to="/" style={{ fontSize: 12, color: "#6b7280" }}>← 홈</Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1f2937", margin: 0 }}>🔍 Audit: {setId}</h1>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{foundYear} · {foundSet.sents?.length || 0} sents · {foundSet.questions?.length || 0} Qs</span>
        <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: 4, fontWeight: 700 }}>MASTER ONLY · view-only (+ 정정 명세)</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <div>
          <Section title="본문 sents (클릭 → 활성 sent 선택 · marker 강조)">
            <div style={{ maxHeight: "55vh", overflowY: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.7 }}>
              {foundSet.sents.map((sent) => {
                const t = sent.t || "";
                const hasMarker = typeof t === "string" && MARKER_RE.test(t);
                MARKER_RE.lastIndex = 0;
                const isActive = activeSentId === sent.id;
                const isBrFrom = bracketStartSent === sent.id;
                const isBrTo = bracketEndSent === sent.id;
                return (
                  <div
                    key={sent.id}
                    style={{
                      padding: "4px 6px",
                      borderBottom: "1px dashed #f3f4f6",
                      background: isActive ? "#dbeafe" : (isBrFrom || isBrTo) ? "#e0e7ff" : hasMarker ? "#fffbea" : "transparent",
                      cursor: "pointer",
                      borderLeft: isActive ? "3px solid #2563eb" : "3px solid transparent",
                    }}
                    onClick={() => setActiveSentId(sent.id)}
                  >
                    <code style={{ color: "#6b7280", fontSize: 11, marginRight: 8 }}>{sent.id}</code>
                    {renderTextWithMarkers(t)}
                    {isBrFrom && (<span style={{ marginLeft: 6, fontSize: 10, color: "#4338ca", fontWeight: 700 }}>[Br Start]</span>)}
                    {isBrTo && (<span style={{ marginLeft: 6, fontSize: 10, color: "#4338ca", fontWeight: 700 }}>[Br End]</span>)}
                  </div>
                );
              })}
            </div>
            {activeSentId && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#1e40af", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span>활성 sent: <code>{activeSentId}</code></span>
                <button type="button" onClick={() => setBracketStartSent(activeSentId)} style={btnSmStyle("#6366f1")}>[Bracket Start]</button>
                <button type="button" onClick={() => setBracketEndSent(activeSentId)} style={btnSmStyle("#6366f1")}>[Bracket End]</button>
                <button type="button" onClick={() => setActiveSentId(null)} style={btnSmStyle("#9ca3af")}>선택 해제</button>
              </div>
            )}
          </Section>

          <Section title="발문 / 선지 / bogi marker">
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, fontSize: 13 }}>
              {foundSet.questions.map((q) => {
                const qMarkers = (q.t || "").match(MARKER_RE) || [];
                const bogiMarkers = (getBogiText(q.bogi).match(MARKER_RE) || []);
                const choiceMarkers = (q.choices || []).flatMap((c) => ((typeof c === "string" ? c : c.t || c.text || "").match(MARKER_RE) || []));
                const allM = [...new Set([...qMarkers, ...bogiMarkers, ...choiceMarkers])].sort();
                if (allM.length === 0) return null;
                return (
                  <div key={q.id} style={{ padding: "6px 0", borderBottom: "1px dashed #f3f4f6" }}>
                    <strong>Q{q.id}</strong>{" "}
                    <span style={{ color: "#6b7280" }}>
                      발문={qMarkers.join("") || "·"} · 선지={[...new Set(choiceMarkers)].join("") || "·"} · bogi={bogiMarkers.join("") || "·"}
                    </span>
                    <span style={{ marginLeft: 8, background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: 3, fontSize: 11, fontWeight: 700 }}>{allM.join("")}</span>
                  </div>
                );
              })}
              {foundSet.questions.every((q) => !((q.t || "").match(MARKER_RE) || []).length && !((getBogiText(q.bogi) || "").match(MARKER_RE) || []).length && !(q.choices || []).some((c) => ((typeof c === "string" ? c : c.t || c.text || "").match(MARKER_RE) || []).length)) && (
                <div style={{ color: "#9ca3af", fontSize: 12 }}>발문/선지/bogi 에 marker 없음</div>
              )}
            </div>
          </Section>
        </div>

        <div>
          <Section title={`annotations (${annList.length}건)`}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, fontSize: 12, maxHeight: "40vh", overflowY: "auto" }}>
              {annList.length === 0 && (<div style={{ color: "#9ca3af" }}>annotation 없음</div>)}
              {annList.map((a, i) => (
                <div key={i} style={{ padding: 6, marginBottom: 4, background: typeColor(a.type), borderRadius: 4 }}>
                  <strong>{a.type}</strong>
                  {a.marker && (<span style={{ marginLeft: 6, background: "#1f2937", color: "#fff", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>{a.marker}</span>)}
                  {a.label && (<span style={{ marginLeft: 6, fontWeight: 700 }}>[{a.label}]</span>)}{" "}
                  {a.sentId && (<code style={{ color: "#6b7280" }}>{a.sentId}</code>)}
                  {a.sentFrom && (<code style={{ color: "#6b7280" }}>{a.sentFrom} ~ {a.sentTo}</code>)}
                  {a.text && (<div style={{ color: "#374151", marginTop: 2 }}>"{a.text.slice(0, 80)}"</div>)}
                </div>
              ))}
            </div>
          </Section>

          <Section title="🚨 의심 이슈 (자동 검증)">
            <IssueBlock label="marker (body)" color="#ef4444" issues={audit.issues.marker_body} />
            <IssueBlock label="marker (bogi)" color="#ec4899" issues={audit.issues.marker_bogi} />
            <IssueBlock label="underline" color="#f59e0b" issues={audit.issues.underline} />
            <IssueBlock label="bracket" color="#3b82f6" issues={audit.issues.bracket} />
            <IssueBlock label="DEAD" color="#7c3aed" issues={audit.issues.dead} />
          </Section>

          <Section title={`📋 기존 annotation 목록 (${annList.length}건) — 삭제 staging`}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, fontSize: 12, maxHeight: 320, overflowY: "auto" }}>
              {annList.length === 0 ? (
                <div style={{ color: "#9ca3af" }}>annotation 없음</div>
              ) : (
                annList.map((ann, i) => {
                  const staged = isStagedForDeletion(ann);
                  return (
                    <div key={i} style={{ padding: 6, marginBottom: 4, background: staged ? "#fee2e2" : typeColor(ann.type), borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, opacity: staged ? 0.6 : 1 }}>
                      <div style={{ flex: 1, wordBreak: "break-all" }}>
                        <strong>{ann.type}</strong>
                        {ann.marker && (<span style={{ marginLeft: 6, background: "#1f2937", color: "#fff", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>{ann.marker}</span>)}
                        {ann.label && (<span style={{ marginLeft: 6, fontWeight: 700 }}>[{ann.label}]</span>)}{" "}
                        {ann.sentId && (<code style={{ color: "#6b7280" }}>{ann.sentId}</code>)}
                        {ann.sentFrom && (<code style={{ color: "#6b7280" }}>{ann.sentFrom}~{ann.sentTo}</code>)}
                        {ann.target && (<span style={{ marginLeft: 6, color: "#374151" }}>({ann.target}{ann.qId ? `/Q${ann.qId}` : ""})</span>)}
                        {ann.text && (<div style={{ color: "#374151", marginTop: 2 }}>"{ann.text.slice(0, 80)}"</div>)}
                      </div>
                      {staged ? (
                        <span style={{ fontSize: 10, color: "#991b1b", fontWeight: 700, padding: "2px 6px" }}>삭제 예정</span>
                      ) : (
                        <button type="button" onClick={() => addDeletion(ann)} style={btnSmStyle("#dc2626")}>삭제</button>
                      )}
                    </div>
                  );
                })
              )}
              {stagedDeletions.length > 0 && (
                <div style={{ marginTop: 8, padding: 8, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "#991b1b", fontWeight: 700, marginBottom: 4 }}>삭제 staging: {stagedDeletions.length}건</div>
                  <button type="button" onClick={clearDeletions} style={btnSmStyle("#6b7280")}>모두 취소</button>
                </div>
              )}
            </div>
          </Section>

          <CsIdsReviewSection
            csCandidates={csCandidates}
            setId={setId}
            foundYear={foundYear}
            foundSet={foundSet}
            csApprovals={csApprovals}
            setCsApprovals={setCsApprovals}
            copyToClipboard={copyToClipboard}
          />
        </div>
      </div>

      <div style={{ marginTop: 24, paddingTop: 18, borderTop: "2px solid #d1d5db" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1f2937", marginBottom: 4 }}>📝 정정 입력 (텍스트 명세 출력)</h2>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>
          입력값은 실제 데이터에 적용되지 않습니다. staging → 클립보드 복사 → 채팅 paste → AI 일괄 처리.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <FormBox title="① underline 추가">
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                활성 sent: {activeSentId ? (<code style={{ color: "#1e40af" }}>{activeSentId}</code>) : (<span style={{ color: "#dc2626" }}>(좌측에서 sent 클릭)</span>)}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <select value={uMarker} onChange={(e) => setUMarker(e.target.value)} style={inputStyle({ width: 70 })}>
                  <option value="">(no marker)</option>
                  {MARKER_CHOICES.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
                <textarea rows={2} value={uText} onChange={(e) => setUText(e.target.value)} placeholder="text (본문 그대로 verbatim)" style={inputStyle({ flex: 1, resize: "vertical" })} />
              </div>
              <button type="button" onClick={handleAddUnderline} style={btnStyle("#f59e0b")}>+ underline staging</button>
            </FormBox>

            <FormBox title="② marker 추가 (단순 marker 표시)">
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                활성 sent: {activeSentId ? (<code style={{ color: "#1e40af" }}>{activeSentId}</code>) : (<span style={{ color: "#dc2626" }}>(좌측에서 sent 클릭)</span>)}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <select value={mkMarker} onChange={(e) => setMkMarker(e.target.value)} style={inputStyle({ width: 70 })}>
                  <option value="">(no marker)</option>
                  {MARKER_CHOICES.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
                <input type="text" value={mkText} onChange={(e) => setMkText(e.target.value)} placeholder="text" style={inputStyle({ flex: 1 })} />
              </div>
              <label style={{ fontSize: 11, color: "#374151", display: "block", marginBottom: 4 }}>
                <input type="checkbox" checked={mkEndMarker} onChange={(e) => setMkEndMarker(e.target.checked)} /> endMarker
              </label>
              <button type="button" onClick={handleAddMarker} style={btnStyle("#ec4899")}>+ marker staging</button>
            </FormBox>

            <FormBox title="③ bracket 추가">
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                시작 sent: {bracketStartSent ? (<code style={{ color: "#4338ca" }}>{bracketStartSent}</code>) : (<span style={{ color: "#dc2626" }}>(좌측 sent 클릭 → [Bracket Start])</span>)}
                {" / "}끝 sent: {bracketEndSent ? (<code style={{ color: "#4338ca" }}>{bracketEndSent}</code>) : (<span style={{ color: "#dc2626" }}>(→ [Bracket End])</span>)}
              </div>
              <input type="text" value={brLabel} onChange={(e) => setBrLabel(e.target.value)} placeholder="label (예: A, B, C)" style={inputStyle({ width: "100%", marginBottom: 4 })} />
              <button type="button" onClick={handleAddBracket} style={btnStyle("#3b82f6")}>+ bracket staging</button>
            </FormBox>

            <FormBox title="④ blank-box 추가">
              <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <select value={boxMarker} onChange={(e) => setBoxMarker(e.target.value)} style={inputStyle({ width: 70 })}>
                  <option value="">(no marker)</option>
                  {MARKER_CHOICES.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
                <input type="text" value={boxLabel} onChange={(e) => setBoxLabel(e.target.value)} placeholder="label (옵션)" style={inputStyle({ flex: 1 })} />
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                <input type="text" value={boxWidth} onChange={(e) => setBoxWidth(e.target.value)} placeholder='width (예: "3em")' style={inputStyle({ flex: 1 })} />
                <select value={boxTarget} onChange={(e) => setBoxTarget(e.target.value)} style={inputStyle({ width: 90 })}>
                  <option value="body">body</option>
                  <option value="bogi">bogi</option>
                </select>
                {boxTarget === "bogi" && (<input type="text" value={boxQid} onChange={(e) => setBoxQid(e.target.value)} placeholder="qId" style={inputStyle({ width: 70 })} />)}
              </div>
              <button type="button" onClick={handleAddBox} style={btnStyle("#10b981")}>+ blank-box staging</button>
            </FormBox>
          </div>

          <div>
            <FormBox title={`📦 Staging (${stagedItems.length}건)`} right={stagedItems.length > 0 && (<button type="button" onClick={clearStaged} style={btnSmStyle("#dc2626")}>모두 삭제</button>)}>
              {stagedItems.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 12 }}>staging 비어있음 — 좌측 폼으로 추가</div>
              ) : (
                <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 12 }}>
                  {stagedItems.map((it, i) => (
                    <div key={i} style={{ padding: 6, marginBottom: 4, background: typeColor(it.type), borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                      <div style={{ flex: 1, wordBreak: "break-all" }}>
                        <strong>{it.type}</strong>
                        {it.marker && (<span style={{ marginLeft: 6, background: "#1f2937", color: "#fff", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>{it.marker}</span>)}
                        {it.label && (<span style={{ marginLeft: 6, fontWeight: 700 }}>[{it.label}]</span>)}{" "}
                        {it.sentId && (<code style={{ color: "#6b7280" }}>{it.sentId}</code>)}
                        {it.sentFrom && (<code style={{ color: "#6b7280" }}>{it.sentFrom} ~ {it.sentTo}</code>)}
                        {it.width && (<span style={{ marginLeft: 6, color: "#374151" }}>w={it.width}</span>)}
                        {it.target && (<span style={{ marginLeft: 6, color: "#374151" }}>({it.target}{it.qId ? `/Q${it.qId}` : ""})</span>)}
                        {it.endMarker && (<span style={{ marginLeft: 6, fontSize: 10, color: "#7c2d12" }}>endMarker</span>)}
                        {it.text && (<div style={{ color: "#374151", marginTop: 2 }}>"{it.text.slice(0, 60)}"</div>)}
                      </div>
                      <button type="button" onClick={() => removeStaged(i)} style={btnSmStyle("#dc2626")}>삭제</button>
                    </div>
                  ))}
                </div>
              )}
            </FormBox>

            <FormBox title="📋 형식 1: 간결 텍스트" right={<button type="button" onClick={() => copyToClipboard(buildTextSpec())} disabled={stagedItems.length === 0} style={btnSmStyle(stagedItems.length === 0 ? "#9ca3af" : "#2563eb")}>클립보드 복사</button>}>
              <pre style={{ background: "#1f2937", color: "#e5e7eb", padding: 10, borderRadius: 4, fontSize: 11, maxHeight: 160, overflow: "auto", whiteSpace: "pre-wrap", margin: 0 }}>
                {stagedItems.length === 0 ? "(staging 비어있음)" : buildTextSpec()}
              </pre>
            </FormBox>

            <FormBox title="📋 형식 2: JSON 명세" right={<button type="button" onClick={() => copyToClipboard(buildJsonSpec())} disabled={stagedItems.length === 0} style={btnSmStyle(stagedItems.length === 0 ? "#9ca3af" : "#2563eb")}>클립보드 복사</button>}>
              <pre style={{ background: "#1f2937", color: "#e5e7eb", padding: 10, borderRadius: 4, fontSize: 11, maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap", margin: 0 }}>
                {stagedItems.length === 0 ? "(staging 비어있음)" : buildJsonSpec()}
              </pre>
            </FormBox>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>{title}</h3>
      {children}
    </div>
  );
}

function FormBox({ title, right, children }) {
  return (
    <div style={{ marginBottom: 10, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h4 style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: 0 }}>{title}</h4>
        {right || null}
      </div>
      {children}
    </div>
  );
}

function IssueBlock({ label, color, issues }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ background: color, color: "#fff", padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontSize: 11, color: "#6b7280" }}>{issues.length} 건</span>
      </div>
      {issues.length === 0 ? (
        <div style={{ fontSize: 11, color: "#10b981", paddingLeft: 4 }}>✓ 이슈 없음</div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 8, fontSize: 11, lineHeight: 1.5 }}>
          {issues.map((iss, i) => (
            <div key={i} style={{ padding: 4, color: "#1f2937", borderBottom: i < issues.length - 1 ? "1px dashed #f3f4f6" : "none" }}>
              <strong style={{ color }}>[{iss.kind}]</strong>
              {iss.scope && (<span style={{ marginLeft: 4, background: "#f3f4f6", color: "#374151", padding: "1px 5px", borderRadius: 2, fontSize: 10, fontWeight: 600 }}>{iss.scope}</span>)}
              {iss.marker && (<span style={{ marginLeft: 4, background: "#fcd34d", color: "#7c2d12", padding: "1px 5px", borderRadius: 2, fontSize: 11, fontWeight: 700 }}>{iss.marker}</span>)}{" "}
              {iss.detail}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function typeColor(type) {
  switch (type) {
    case "underline": return "#fef9c3";
    case "marker": return "#fce7f3";
    case "bracket": return "#dbeafe";
    case "box":
    case "blank-box": return "#dcfce7";
    default: return "#f3f4f6";
  }
}

function inputStyle(extra) {
  return { fontSize: 12, padding: "4px 6px", border: "1px solid #d1d5db", borderRadius: 4, fontFamily: "inherit", ...(extra || {}) };
}

function btnStyle(bg) {
  return { fontSize: 12, padding: "5px 10px", background: bg, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700 };
}

function btnSmStyle(bg) {
  return { fontSize: 10, padding: "2px 7px", background: bg, color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 700 };
}

function renderTextWithMarkers(text) {
  if (typeof text !== "string") return text;
  const parts = [];
  let last = 0;
  const re = /[ⓐ-ⓩ㉠-㉮]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={m.index} style={{ background: "#fcd34d", color: "#7c2d12", fontWeight: 700, padding: "0 3px", borderRadius: 2 }}>{m[0]}</span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ────────────────────────────────────────────────────────
// v3.1: cs_ids 후보 검토 섹션
// ────────────────────────────────────────────────────────
function CsIdsReviewSection({ csCandidates, setId, foundYear, foundSet, csApprovals, setCsApprovals, copyToClipboard }) {
  if (!csCandidates) {
    return (
      <Section title="🔗 cs_ids 후보 검토 (v3.1)">
        <div style={{ color: "#9ca3af", fontSize: 12, padding: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          cs_ids_candidates.json 로딩 안 됨. `pipeline/cs_ids_recovery.mjs` 실행 + `public/audit_data/cs_ids_candidates.json` 복사 필요.
        </div>
      </Section>
    );
  }
  // 현재 set 의 후보만 필터
  const setCands = (csCandidates.candidates || []).filter(
    (c) => c.setId === setId && c.yearKey === foundYear,
  );
  if (setCands.length === 0) {
    return (
      <Section title="🔗 cs_ids 후보 검토 (v3.1)">
        <div style={{ color: "#10b981", fontSize: 12, padding: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          ✓ 이 set 에 cs_ids 비어있는 choice 없음 (또는 후보 산출 불가)
        </div>
      </Section>
    );
  }
  const byDecision = {
    auto_apply: setCands.filter((c) => c.decision === "auto_apply"),
    batch_review: setCands.filter((c) => c.decision === "batch_review"),
    manual_needed: setCands.filter((c) => c.decision === "manual_needed"),
    no_quote_extractable: setCands.filter((c) => c.decision === "no_quote_extractable"),
    duplicate_sentid_hold: setCands.filter((c) => c.decision === "duplicate_sentid_hold"),
  };
  // v2: duplicate sentId hold 표시 — 자동/배치 금지
  const isDuplicateHold = byDecision.duplicate_sentid_hold.length > 0 || setCands.some((c) => c.set_safety === "duplicate_sentid_hold");
  const approvalKey = (c) => `${c.questionId}-${c.choiceNum}`;
  const approve = (c, sentId, score) => {
    setCsApprovals((prev) => ({ ...prev, [approvalKey(c)]: { sentId, score, quote: c.candidates?.[0]?.quotes_matched?.[0] || null } }));
  };
  const unapprove = (c) => {
    setCsApprovals((prev) => {
      const next = { ...prev };
      delete next[approvalKey(c)];
      return next;
    });
  };
  const approvedCount = Object.keys(csApprovals).filter((k) => {
    return setCands.some((c) => approvalKey(c) === k);
  }).length;

  const exportApprovals = () => {
    const items = [];
    for (const c of setCands) {
      const a = csApprovals[approvalKey(c)];
      if (!a) continue;
      items.push({
        yearKey: c.yearKey,
        setId: c.setId,
        questionId: c.questionId,
        choiceNum: c.choiceNum,
        cs_ids: [a.sentId],
        score: a.score,
        quote: a.quote,
        source: "batch_approval",
      });
    }
    const payload = {
      tool: "cs_ids_review_v3.1",
      ts: new Date().toISOString(),
      setId,
      yearKey: foundYear,
      approvals: items,
    };
    copyToClipboard(JSON.stringify(payload, null, 2));
  };

  return (
    <Section title={`🔗 cs_ids 후보 검토 (${setCands.length}건) — 승인 ${approvedCount}건`}>
      {isDuplicateHold && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 12, color: "#991b1b", fontWeight: 700 }}>
          ⚠️ duplicate_sent_id 결함: 본 set 안 sentId 중복 — cs_ids 자동/배치 반영 금지. sentId 재매핑 sprint 후 처리.
        </div>
      )}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, fontSize: 13 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", fontSize: 11 }}>
          <span style={{ background: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>auto: {byDecision.auto_apply.length}</span>
          <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>batch: {byDecision.batch_review.length}</span>
          <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>manual: {byDecision.manual_needed.length}</span>
          <span style={{ background: "#f3f4f6", color: "#374151", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>no_quote: {byDecision.no_quote_extractable.length}</span>
          {approvedCount > 0 && (
            <button type="button" onClick={exportApprovals} style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}>
              📋 승인 {approvedCount}건 JSON 복사
            </button>
          )}
        </div>

        {/* batch_review + manual_needed 만 표시 (auto 는 이미 반영 또는 안전) */}
        {[...byDecision.batch_review, ...byDecision.manual_needed].map((c) => {
          const key = approvalKey(c);
          const approved = csApprovals[key];
          const choiceObj = (foundSet.questions || [])
            .find((q) => q.id === c.questionId)
            ?.choices?.find((cc) => cc.num === c.choiceNum);
          return (
            <div key={key} style={{ borderBottom: "1px solid #f3f4f6", padding: "8px 0", marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div>
                  <strong style={{ color: "#1f2937" }}>Q{c.questionId} 선지{c.choiceNum}</strong>
                  <span style={{ marginLeft: 8, fontSize: 11, color: c.ok ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                    {c.ok ? "✓ ok:true" : `✗ ok:false${c.pat ? ` (${c.pat})` : ""}`}
                  </span>
                  <span style={{ marginLeft: 8, fontSize: 11, background: c.decision === "batch_review" ? "#fef3c7" : "#fee2e2", color: c.decision === "batch_review" ? "#92400e" : "#991b1b", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>
                    {c.decision}
                  </span>
                </div>
                {approved && (
                  <button type="button" onClick={() => unapprove(c)} style={{ fontSize: 10, padding: "2px 7px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontWeight: 700 }}>
                    승인 해제
                  </button>
                )}
              </div>
              {choiceObj?.analysis && (
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, padding: "4px 6px", background: "#f9fafb", borderRadius: 3, maxHeight: 60, overflow: "auto" }}>
                  📝 {(choiceObj.analysis || "").slice(0, 220)}
                </div>
              )}
              {c.analysis_quotes?.length > 0 && (
                <div style={{ fontSize: 11, color: "#374151", marginBottom: 6 }}>
                  💬 인용문: {c.analysis_quotes.map((q, i) => (<span key={i} style={{ background: "#fef9c3", padding: "1px 4px", borderRadius: 2, marginRight: 4 }}>"{q.slice(0, 50)}"</span>))}
                </div>
              )}
              {c.candidates?.length === 0 ? (
                <div style={{ fontSize: 11, color: "#dc2626" }}>후보 없음 — 수동 입력 필요</div>
              ) : (
                <div>
                  {c.candidates.slice(0, 3).map((cand, idx) => {
                    const isApproved = approved?.sentId === cand.sentId;
                    return (
                      <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 6px", background: isApproved ? "#dcfce7" : "transparent", borderRadius: 3, marginBottom: 2 }}>
                        <input type="radio" name={key} checked={isApproved} onChange={() => approve(c, cand.sentId, cand.normalized_score)} style={{ marginTop: 4 }} />
                        <div style={{ flex: 1, fontSize: 12 }}>
                          <code style={{ color: "#6b7280" }}>{cand.sentId}</code>
                          <span style={{ marginLeft: 6, fontSize: 10, color: cand.normalized_score >= 0.8 ? "#16a34a" : cand.normalized_score >= 0.5 ? "#ca8a04" : "#dc2626", fontWeight: 700 }}>
                            score={cand.normalized_score.toFixed(2)}
                          </span>
                          <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>{cand.sentText}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {byDecision.batch_review.length === 0 && byDecision.manual_needed.length === 0 && (
          <div style={{ color: "#9ca3af", fontSize: 12 }}>이 set 은 batch/manual 후보 없음 (auto 만 또는 후보 없음)</div>
        )}
      </div>
    </Section>
  );
}
