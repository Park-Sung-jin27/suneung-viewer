import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { engMathAuthUrl } from './engMathAccess.js';
import { fetchMaster } from './engMathMasterClient.js';
import './EngMathMaster.css';

const tracks = { common: '공통', cal: '미적분', sta: '확률과 통계', geo: '기하' };
function MathText({ text = '', expression = false }) {
  const parts = expression ? [`$${text}$`] : String(text).split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  return <>{parts.map((part, index) => {
    if (!part.startsWith('$') || !part.endsWith('$')) return <span key={index}>{part}</span>;
    try {
      const block = part.startsWith('$$');
      const html = katex.renderToString(part.slice(block ? 2 : 1, block ? -2 : -1), { displayMode: block, throwOnError: true, trust: false, strict: 'ignore' });
      return <span key={index} className="em-master__formula" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch { return <code key={index}>{part}</code>; }
  })}</>;
}
function PrivateImage({ image, userId }) {
  const [state, setState] = useState({ url: '', error: '' });
  useEffect(() => {
    const controller = new AbortController();
    let url;
    fetchMaster(`asset=${encodeURIComponent(image.id)}`, userId, controller.signal)
      .then(r => r.blob()).then(blob => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob); setState({ url, error: '' });
      }).catch(error => { if (!controller.signal.aborted) setState({ url: '', error: error.message }); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [image.id, userId]);
  if (state.error) return <p role="alert">원문 이미지: {state.error}</p>;
  return state.url ? <figure><a href={state.url} target="_blank" rel="noreferrer"><img src={state.url} alt={image.alt} /></a><figcaption>{image.alt} · 이미지를 누르면 원래 크기로 엽니다.</figcaption></figure> : <p role="status">원문 이미지 준비 중…</p>;
}
function Review({ review, subject }) {
  if (!review) return <p className="em-master__warning">등록된 검증 해설이 없습니다. 정답만 참고하고, 해설이 완성된 문항으로 취급하지 마세요.</p>;
  const text = value => subject === 'math' ? <MathText text={value} /> : value;
  return <>
    <p>{text(review.summary)}</p>
    {(review.fullTranslation) && <section><h3>전체 지문 해석</h3><p>{review.fullTranslation}</p></section>}
    {(review.typeApproach || review.approach) && <section><h3>풀이 접근</h3><p>{text(review.typeApproach || review.approach)}</p></section>}
    {review.expression && <p><MathText text={review.expression} expression /></p>}
    {(review.steps ?? []).map((step, index) => <section key={index}><h3>{step.title || `${index + 1}단계`}</h3>{step.expression && <p><MathText text={step.expression} expression /></p>}<p>{text(step.explanation)}</p></section>)}
    {(review.evidence ?? []).map((item, index) => <blockquote key={index}><strong>{item.role}</strong><p>{item.quote || item.display}</p><p>{item.translation}</p></blockquote>)}
    {review.correctReason && <section><h3>정답 판단</h3><p>{text(review.correctReason)}</p></section>}
    {review.trap && <section><h3>헷갈리는 선지</h3><p>{review.trap.mark} {review.trap.text}</p><p>{review.trap.reason}</p></section>}
    {review.commonMistake && <section><h3>자주 하는 실수</h3><p>{text(review.commonMistake)}</p></section>}
    {review.transferRule && <section><h3>다음 문제에 적용</h3><p>{text(review.transferRule)}</p></section>}
  </>;
}
function MasterReader({ user }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('english');
  const [exam, setExam] = useState('');
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [retry, setRetry] = useState(0);
  const heading = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchMaster('', user.id, controller.signal).then(r => r.json()).then(data => {
      if (!controller.signal.aborted) {
        if (!Array.isArray(data.questions)) throw new Error('문항 목록 형식을 확인하지 못했습니다.');
        setCatalog(data.questions); setError('');
      }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [user.id, retry]);
  const exams = useMemo(() => [...new Map((catalog ?? []).filter(q => q.subject === subject).map(q => [q.examId, q.examLabel])).entries()].sort((a,b)=>b[0].localeCompare(a[0])), [catalog, subject]);
  const activeExam = exams.some(([id])=>id===exam) ? exam : exams[0]?.[0];
  const questions = (catalog ?? []).filter(q=>q.subject===subject && q.examId===activeExam);
  const activeId = questions.some(q=>q.id===selected) ? selected : questions[0]?.id;
  useEffect(() => {
    if (!activeId) return;
    const controller = new AbortController();
    fetchMaster(`question=${encodeURIComponent(activeId)}`, user.id, controller.signal).then(r=>r.json()).then(data=>{
      if (!controller.signal.aborted) { setDetail(data); setDetailError(''); }
    }).catch(e=>{ if (!controller.signal.aborted) setDetailError(e.message); });
    return ()=>controller.abort();
  }, [activeId, user.id, retry]);
  useEffect(()=> { if (detail?.id === activeId) heading.current?.focus({ preventScroll: false }); }, [detail, activeId]);
  if (error) return <div role="alert"><p>{error}</p><button onClick={()=>setRetry(retry+1)}>다시 확인</button><Link to={engMathAuthUrl('/eng-math/master')}>로그인 화면</Link></div>;
  if (!catalog) return <p role="status">마스터 권한과 문항 목록을 확인하고 있습니다.</p>;
  return <>
    <p className="em-master__access">마스터 열람 허용 · 영어 {catalog.filter(q=>q.subject==='english').length}문항 · 수학 {catalog.filter(q=>q.subject==='math').length}문항</p>
    <div className="em-master__layout"><aside aria-label="시험과 문항 선택">
      <label>과목<select value={subject} onChange={e=>{setSubject(e.target.value);setSelected('');setDetailError('');}}><option value="english">영어</option><option value="math">수학</option></select></label>
      <label>시험<select value={activeExam || ''} onChange={e=>{setExam(e.target.value);setSelected('');setDetailError('');}}>{exams.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <p>{questions.length}문항 · 해설 등록 {questions.filter(q=>q.reviewStatus==='registered').length}</p>
      <div className="em-master__numbers">{questions.map(q=><button key={q.id} aria-pressed={q.id===activeId} onClick={()=>{setSelected(q.id);setDetailError('');heading.current?.focus();}}>{tracks[q.track] || ''} {q.number}<small>{q.reviewStatus==='registered'?'해설 등록':'해설 준비 중'}</small></button>)}</div>
    </aside><article aria-live="polite">
      {detailError ? <div role="alert"><p>{detailError}</p><button onClick={()=>setRetry(retry+1)}>문항 다시 불러오기</button></div> : detail?.id===activeId ? <>
        <h2 tabIndex={-1} ref={heading}>{detail.examLabel} · {tracks[detail.track] || ''} {detail.number}번</h2>
        <p className="em-master__warning">{detail.warning}</p>
        <div className="em-master__question"><h3>문제</h3>
          {detail.subject==='english' ? <>{detail.sharedPassage && <p className="em-master__raw">{detail.sharedPassage}</p>}<p className="em-master__raw">{detail.rawText}</p></> : <><p><MathText text={detail.prompt}/></p>{detail.choices.map((c,i)=><p key={i}>{c.mark} <MathText text={c.text}/></p>)}</>}
          {detail.images.map(image=><PrivateImage key={image.id} image={image} userId={user.id}/>)}
          {detail.figureDescription && <p>그림 설명(원본 대체 아님): <MathText text={detail.figureDescription}/></p>}
        </div>
        <details key={detail.id}><summary>정답·해설 확인하기</summary><h3>정답 {detail.answerMark || detail.answer}</h3><Review review={detail.review} subject={detail.subject}/></details>
      </> : <p role="status">선택한 문항을 불러오고 있습니다.</p>}
    </article></div>
  </>;
}
export default function EngMathMaster({ user, authReady }) {
  return <main className="em-master"><nav><Link to="/eng-math-beta">영어·수학 학습 홈</Link><Link to="/eng-math/classroom">수업 관리</Link></nav><header><span>대표 전용 자료실</span><h1>수업 전에, 문항 전체를.</h1><p>영어·수학 내부 자료 열람용입니다. 이 화면은 학습 실적을 기록하거나 학생에게 문항을 공개하지 않습니다.</p></header>
    {!authReady ? <p>로그인 확인 중…</p> : user ? <MasterReader key={user.id} user={user}/> : <p><Link to={engMathAuthUrl('/eng-math/master')}>마스터 계정으로 로그인</Link></p>}
  </main>;
}
