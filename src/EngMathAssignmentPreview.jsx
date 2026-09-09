import { useEffect, useState } from "react";
import { assignmentPacks, createAssignmentDraft, draftDeadlineState, kstDate } from "./engMathAssignments.js";
import "./EngMathAssignmentPreview.css";

// Mounted ONLY in the explicit fictional-student preview. No persistence or RPC.
export default function EngMathAssignmentPreview({ members }) {
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [now, setNow] = useState(() => new Date().toISOString());
  const [form, setForm] = useState(() => ({ title: "오늘의 영어 학습", subject: "english", packId: "", studyDate: kstDate(new Date().toISOString()), dueDate: kstDate(new Date().toISOString()), dueTime: "23:00", recipientIds: members.map(m => m.student_id) }));
  const update = patch => { setForm(f => ({ ...f, ...patch })); setError(""); };
  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    fetch("/data/eng-math/catalog-public.json", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("목록을 불러오지 못했습니다.");
      const data = await response.json();
      if (!Array.isArray(data?.subjects?.english?.packs) || !Array.isArray(data?.subjects?.math?.packs)) throw new Error("목록 형식을 확인해 주세요.");
      setCatalog(data);
    }).catch(e => { if (e.name !== "AbortError") setLoadError("문항 목록을 불러오지 못했습니다. 다시 불러오기를 눌러 주세요."); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 30000);
    return () => clearInterval(timer);
  }, []);
  const packs = assignmentPacks(catalog).filter(p => p.subject === form.subject);
  const packId = packs.some(p => p.id === form.packId) ? form.packId : packs[0]?.id || "";
  return <section className="classroom-assignment" aria-labelledby="assignment-preview-title">
    <div className="classroom-section-head"><div><span className="classroom-eyebrow">가상 학생 전용 · 개발 미리보기</span><h2 id="assignment-preview-title">날짜별 과제 배정안</h2><p>학생에게 보내지 않습니다. 새로고침하면 배정안이 사라집니다.</p></div></div>
    <div className="assignment-preview-grid">
      <form onSubmit={event => {
        event.preventDefault();
        try {
          const current = new Date().toISOString();
          const draft = createAssignmentDraft({ ...form, packId }, { catalog, members, now: current });
          if (drafts.length >= 20) throw new Error("미리보기 배정안은 20개까지입니다. 새로고침하면 초기화됩니다.");
          setDrafts(list => [...list, { ...draft, id: crypto.randomUUID() }]); setError(""); setNow(current);
        } catch (e) { setError(e.message); }
      }}>
        <label>과제 이름<input value={form.title} onChange={e => update({ title: e.target.value })} maxLength={80} required /></label>
        <label>과목<select value={form.subject} onChange={e => update({ subject: e.target.value, packId: "" })}><option value="english">영어</option><option value="math">수학</option></select></label>
        <label>문항 묶음<select value={packId} onChange={e => update({ packId: e.target.value })} required disabled={!catalog || !!loadError}>{!packs.length && <option value="">선택 가능한 묶음 없음</option>}{packs.map(p => <option key={p.id} value={p.id}>{p.examLabel} {p.label} · {p.questionCount}문항</option>)}</select></label>
        <p className="classroom-muted">현재 학생에게 열린 영어·수학 각 5문항만 선택됩니다. 날짜를 바꿔도 새 문제가 생기지는 않습니다.</p>
        {loadError && <p role="alert">{loadError} <button type="button" onClick={() => setRetry(v => v + 1)}>목록 다시 불러오기</button></p>}
        <div className="assignment-date-fields"><label>학습일<input type="date" value={form.studyDate} onChange={e => update({ studyDate: e.target.value })} required /></label><label>마감일<input type="date" value={form.dueDate} onChange={e => update({ dueDate: e.target.value })} required /></label><label>마감 시간 · 한국 시간<input type="time" value={form.dueTime} onChange={e => update({ dueTime: e.target.value })} required /></label></div>
        <fieldset><legend>배정할 가상 학생</legend>{members.map(m => <label className="classroom-check" key={m.student_id}><input type="checkbox" checked={form.recipientIds.includes(m.student_id)} onChange={e => update({ recipientIds: e.target.checked ? [...form.recipientIds, m.student_id] : form.recipientIds.filter(id => id !== m.student_id) })}/>{m.student_name}</label>)}</fieldset>
        {error && <p role="alert">{error}</p>}
        <button className="classroom-primary" disabled={!packId || !!loadError}>배정안 추가 · 전송 안 함</button>
      </form>
      <div className="assignment-preview-list" aria-live="polite">
        <h3>날짜별 배정안 {drafts.length}개</h3>
        {!drafts.length && <p>왼쪽에서 날짜와 학생을 고른 뒤 배정안을 추가해 보세요. 모바일에서는 위쪽 입력란을 이용하세요.</p>}
        {[...drafts].sort((a, b) => a.opensAt.localeCompare(b.opensAt)).map(draft => <article key={draft.id}>
          <time>{draft.studyDate}</time><strong>{draft.title}</strong>
          <p>{draft.subject === "english" ? "영어" : "수학"} · {draft.packLabel}<br/>{draft.questionCount}문항 · {draft.recipientIds.map(id => members.find(m => m.student_id === id)?.student_name).join(", ")}</p>
          <p>마감 {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(draft.dueAt))}<br/>{draftDeadlineState(draft, now)}</p>
        </article>)}
        <aside><h3>과제 완료 기준안</h3><p>정답 제출 또는 틀린·못 푼 문제의 재풀이 정답까지 확인합니다. 해설을 열기만 한 기록은 완료로 세지 않습니다.</p><p>기존 학습 기록을 새 과제 완료로 바꾸지 않습니다. 마감 판정은 서버 접수 시각으로 하며, 늦게 동기화된 기록은 별도 확인 대상으로 남깁니다.</p><p>운영 저장·학생 전달·완료 판정은 아직 연결하지 않았습니다.</p></aside>
      </div>
    </div>
  </section>;
}
