import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {supabase} from './supabase.js';
import {assignmentRpc,assignmentError,assignmentPacks,assignmentCreateStorage,createAssignmentDraft,kstDate,parseKstInput,evaluateAssignmentReceipts,ASSIGNMENT_STATUS_LABELS} from './engMathAssignments.js';
import {PracticeQuestion} from './EngMathPractice.jsx';
import {createScopedLearningHistoryStorage,recordLearningSession,readLearningHistory} from './engMathLearningHistory.js';
import {syncMemberLearningHistory} from './engMathLearningEventsSync.js';
import './EngMathAssignmentPreview.css';
import './EngMathClassroom.css';

const stamp=value=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
const href=id=>`/eng-math/classroom?role=student&assignment=${encodeURIComponent(id)}`;
function useAssignmentData(method,args,key) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const serializedArgs=JSON.stringify(args);
  useEffect(()=>{
    let active=true;
    Promise.resolve().then(()=>{if(active)setError('');});
    assignmentRpc(supabase,method,JSON.parse(serializedArgs)).then(result=>{if(active)setData(result);}).catch(e=>{if(active){setData(null);setError(assignmentError(e));}});
    return()=>{active=false;};
  },[method,key,revision,serializedArgs]);
  return {data,error,replace:setData,refresh:()=>setRevision(v=>v+1)};
}

export function AssignmentHub({classId=null,teacherId=null,members=[]}) {
  const [page,setPage]=useState(0),[revision,setRevision]=useState(0);
  const {data,error,refresh}=useAssignmentData('list',{p_class_id:classId,p_offset:page*50},`${classId}:${page}:${revision}`);
  return <section className="classroom-assignment" aria-label={classId?'날짜별 과제 관리':'내 과제'}>
    <div className="classroom-section-head"><div><h2>{classId?'날짜별 과제 관리':'내 과제'}</h2><p>과제별 접수 기록은 일반 학습 기록과 구분합니다. 시간은 한국 시간입니다.</p></div><button onClick={refresh}>과제 최신 기록</button></div>
    {classId && <details><summary>새 과제 배정</summary><AssignmentForm key={`${teacherId}:${classId}`} teacherId={teacherId} classId={classId} members={members} onCreated={()=>{setPage(0);setRevision(v=>v+1);}}/></details>}
    {error?<p role="alert">{error}</p>:!data?<p role="status">과제를 불러오고 있습니다.</p>:<>
      {!data.items.length&&<p>이 페이지에 배정된 과제가 없습니다.</p>}
      <div className="assignment-preview-list">{data.items.map(a=><article key={a.id}><time>{a.study_date} · {a.class_name}</time><strong>{a.title}</strong><p>{a.label}<br/>마감 {stamp(a.due_at)} · {a.state==='cancelled'?'취소됨':'배정됨'}</p><Link to={href(a.id)}>{classId?'학생별 완료 확인':'과제 열기'}</Link></article>)}</div>
      <div><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>이전 과제 목록</button><span> {page+1}페이지 </span><button disabled={data.items.length<50} onClick={()=>setPage(p=>p+1)}>다음 과제 목록</button></div>
    </>}
  </section>;
}
function recoveredAssignmentForm(value){
  const r=value.request,due=new Date(Date.parse(r.p_due_at)+9*3600000).toISOString();
  return {title:r.p_title,subject:value.subject,packId:r.p_pack_id,studyDate:r.p_study_date,dueDate:due.slice(0,10),dueTime:due.slice(11,16),recipientIds:r.p_students};
}
function AssignmentForm({classId,teacherId,members,onCreated}) {
  const storage=assignmentCreateStorage(teacherId,classId);
  const [recovery]=useState(()=>{try{return {value:storage.read(),error:''};}catch(e){return {value:null,error:e.message};}});
  const [catalog,setCatalog]=useState(null),[error,setError]=useState(recovery.error),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirmed,setConfirmed]=useState(false);
  const pending=useRef(recovery.value),inFlight=useRef(false);
  const [form,setForm]=useState(()=>recovery.value?recoveredAssignmentForm(recovery.value):({title:'오늘의 영어 학습',subject:'english',packId:'',studyDate:kstDate(new Date().toISOString()),dueDate:kstDate(new Date().toISOString()),dueTime:'23:00',recipientIds:[]}));
  useEffect(()=>{const controller=new AbortController(); fetch('/data/eng-math/catalog-public.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(setCatalog).catch(e=>{if(e.name!=='AbortError')setError('문항 목록을 불러오지 못했습니다. 화면을 새로고침해 주세요.');});return()=>controller.abort();},[]);
  const packs=assignmentPacks(catalog).filter(p=>p.subject===form.subject),packId=pending.current?.request.p_pack_id||packs.find(p=>p.id===form.packId)?.id||packs[0]?.id||'';
  const edit=patch=>{setForm(f=>({...f,...patch}));setConfirmed(false);setError('');setMessage('');};
  async function send(e){
    e.preventDefault();if(inFlight.current||confirmed)return;inFlight.current=true;setBusy(true);setError('');setMessage('');
    let serverAttempt=false;
    try {
      const existing=storage.read();
      if(existing&&existing.request.p_id!==pending.current?.request.p_id){
        pending.current=existing;setForm(recoveredAssignmentForm(existing));
        setMessage('다른 화면에서 확인 중인 배정을 불러왔습니다. 내용을 확인한 뒤 같은 배정 다시 확인을 눌러 주세요.');return;
      }
      if(!pending.current){
        const draft=createAssignmentDraft({...form,packId},{catalog,members,now:new Date().toISOString()});
        const value={teacherId,subject:form.subject,request:{p_id:crypto.randomUUID(),p_class_id:classId,p_title:draft.title,p_pack_id:draft.packId,p_study_date:draft.studyDate,p_due_at:draft.dueAt,p_students:draft.recipientIds}};
        storage.write(value);pending.current=value;
      }
      serverAttempt=true;const request=pending.current.request;
      const acceptedId=await assignmentRpc(supabase,'create',request);
      if(acceptedId!==request.p_id)throw new Error('ASSIGN_NETWORK');
      try{storage.clear(request.p_id);}catch{setError('배정은 확인됐지만 기기의 확인 정보를 정리하지 못했습니다. 재접속 시 같은 배정 번호로 다시 확인할 수 있습니다.');}
      pending.current=null;setConfirmed(true);setMessage('과제를 배정했습니다. 대상 학생의 내 과제에 표시됩니다.');onCreated();
    }catch(e){
      // These server validation failures occur before insertion. An uncertain network
      // failure never unlocks the request or issues a new ID.
      if(serverAttempt&&['ASSIGN_INVALID_INPUT','ASSIGN_INVALID_DATE','ASSIGN_PACK_UNAVAILABLE','ASSIGN_MEMBER_MISSING','ASSIGN_DAILY_LIMIT'].some(code=>e.message?.includes(code))){
        try{storage.clear(pending.current.request.p_id);pending.current=null;}catch{/* keep the original request when cleanup fails */}
      }
      setError(serverAttempt?assignmentError(e):e.message);
    }finally{inFlight.current=false;setBusy(false);}
  }
  return <form onSubmit={send} className="assignment-live-form">
    <fieldset disabled={busy||!!pending.current}>
      <label>과제 이름<input value={form.title} onChange={e=>edit({title:e.target.value})} maxLength={80} required/></label>
      <label>과목<select value={form.subject} onChange={e=>edit({subject:e.target.value,packId:''})}><option value="english">영어</option><option value="math">수학</option></select></label>
      <label>문항 묶음<select value={packId} onChange={e=>edit({packId:e.target.value})} required><option value="" disabled>묶음 선택</option>{packs.map(p=><option key={p.id} value={p.id}>{p.examLabel} {p.label}</option>)}</select></label>
      <p>현재 영어·수학 각 5문항만 배정됩니다. 날짜를 바꿔도 새로운 문제가 추가되지는 않습니다.</p>
      <div className="assignment-date-fields"><label>학습일<input type="date" value={form.studyDate} onChange={e=>edit({studyDate:e.target.value})} required/></label><label>마감일<input type="date" value={form.dueDate} onChange={e=>edit({dueDate:e.target.value})} required/></label><label>마감 시간<input type="time" value={form.dueTime} onChange={e=>edit({dueTime:e.target.value})} required/></label></div>
      <fieldset><legend>과제를 배정할 학생</legend>{members.map(m=><label className="classroom-check" key={m.student_id}><input type="checkbox" checked={form.recipientIds.includes(m.student_id)} onChange={e=>edit({recipientIds:e.target.checked?[...form.recipientIds,m.student_id]:form.recipientIds.filter(id=>id!==m.student_id)})}/>{m.student_name}</label>)}</fieldset>
    </fieldset>
    {pending.current&&<p>확인이 끝나지 않은 배정을 보관하고 있습니다. 새로고침하거나 다시 접속해도 같은 배정 번호로 확인합니다. 결과 확인 전에는 내용을 바꾸거나 새 배정으로 보내지 않습니다.</p>}
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    <button className="classroom-primary" disabled={busy||confirmed||!packId}>{busy?'배정 확인 중…':confirmed?'배정 확인 완료':pending.current?'같은 배정 다시 확인':'선택한 학생에게 과제 배정'}</button>
    {confirmed&&<p>다른 과제를 배정하려면 이름·날짜·대상 등 배정 내용을 먼저 바꿔 주세요.</p>}
  </form>;
}

export default function AssignedPractice({id,user}) {
  const {data,error,refresh,replace}=useAssignmentData('detail',{p_id:id},`${id}:${user.id}`);
  const [questions,setQuestions]=useState(null),[contentError,setContentError]=useState('');
  const [selected,setSelected]=useState(null),[retryKey,setRetryKey]=useState(0),[submitStatus,setSubmitStatus]=useState(''),[submitError,setSubmitError]=useState('');
  const [busy,setBusy]=useState(false),[localWarning,setLocalWarning]=useState('');
  const navigate=useNavigate(),inFlight=useRef(false),pending=useRef(null);
  const storageKey=`eng_math_assignment_pending_v1:${user.id}:${id}`;
  const historyStorage=createScopedLearningHistoryStorage(user.id);
  useEffect(()=>{
    if(!data?.assignment)return;
    const controller=new AbortController();
    fetch(`/data/eng-math/${data.assignment.subject}-free-public.json`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(content=>{
      if(content.packId!==data.assignment.packId||!data.assignment.problemKeys.every(key=>content.questions.some(q=>q.id===key)))throw new Error();
      setQuestions(data.assignment.problemKeys.map(key=>content.questions.find(q=>q.id===key)));
    }).catch(e=>{if(e.name!=='AbortError')setContentError('과제와 현재 문항 자료가 다릅니다. 선생님께 확인해 주세요.');});
    return()=>controller.abort();
  },[data?.assignment]);
  useEffect(()=>{
    try {const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&saved.p_id===id&&typeof saved.p_request_id==='string'){
      pending.current=saved;Promise.resolve().then(()=>{setSubmitStatus('error');setSubmitError('접수 확인이 끝나지 않은 답안이 있습니다. 같은 답안 다시 접수를 눌러 주세요.');});
    }}catch{ /* Corrupt local state never becomes a completed receipt. */ }
  },[id,storageKey]);
  async function flush(){
    if(!pending.current||inFlight.current)return;
    inFlight.current=true;setBusy(true);setSubmitStatus('sending');setSubmitError('');
    const request=pending.current;
    try{
      let fresh,superseded=false;
      try{await assignmentRpc(supabase,'submit',request);}
      catch(e){
        if(request.p_parent_id||!e.message?.includes('ASSIGN_ALREADY_ANSWERED'))throw e;
        fresh=await assignmentRpc(supabase,'detail',{p_id:id});
        // Another tab/device won the immutable first-answer race. Only an authorized,
        // matching server receipt can release this pending answer; network errors cannot.
        if(fresh.assignment?.id!==id||!fresh.receipts.some(r=>r.assignmentId===id&&r.studentId===user.id&&
          r.version===request.p_version&&r.problemKey===request.p_problem_key&&r.kind==='answer'&&r.id!==request.p_request_id))throw e;
        superseded=true;
      }
      fresh??=await assignmentRpc(supabase,'detail',{p_id:id});
      replace(fresh);
      pending.current=null;try{
        if(JSON.parse(localStorage.getItem(storageKey))?.p_request_id===request.p_request_id)localStorage.removeItem(storageKey);
      }catch{/* server receipt is durable; never remove another tab's pending request */}
      setSubmitStatus(superseded?'':'saved');
      if(superseded){setSelected(null);setSubmitError('다른 화면에서 먼저 접수된 첫 답안을 불러왔습니다. 이 화면의 답안은 추가 접수하지 않았습니다. 재풀이 필요 여부를 확인해 주세요.');}
    }catch(e){setSubmitStatus('error');setSubmitError(assignmentError(e));}
    finally{inFlight.current=false;setBusy(false);}
  }
  function answer(result){
    if(pending.current||inFlight.current)return;
    const initial=data.receipts.find(r=>r.studentId===user.id&&r.problemKey===result.questionId&&r.kind==='answer');
    const request={p_id:id,p_version:data.assignment.version,p_request_id:crypto.randomUUID(),p_problem_key:result.questionId,p_answer:result.gaveUp?null:String(result.selectedAnswer),p_outcome:result.gaveUp?'gave_up':'answered',p_parent_id:initial?.id||null};
    pending.current=request;
    try{localStorage.setItem(storageKey,JSON.stringify(request));}catch{setLocalWarning('이 기기에 재접수용 답안을 저장하지 못했습니다. 서버 접수 확인 전에는 화면을 닫지 마세요.');}
    const summary=recordLearningSession({sessionId:request.p_request_id,subject:data.assignment.subject,packId:data.assignment.packId,packLabel:data.assignment.title,isWrongRetry:!!initial,questionCount:1,results:[{...result,answeredAt:new Date().toISOString()}]},historyStorage);
    if(summary.storageStatus==='saved')void syncMemberLearningHistory({supabase,authenticatedUserId:user.id,history:readLearningHistory(historyStorage)}).catch(()=>{setLocalWarning('과제 접수와 별개로 일반 주간 기록 반영은 지연될 수 있습니다.');});
    void flush();
  }
  const a=data?.assignment;
  const statusFor=studentId=>evaluateAssignmentReceipts(a,studentId,data.receipts,data.asOf);
  // Keep a submitted question mounted while refreshing server detail; its answer is not erased.
  const view=data;
  const q=questions?.find(q=>q.id===selected);
  if(q&&view&&!view.teacher){
    const first=view.receipts.find(r=>r.studentId===user.id&&r.problemKey===q.id&&r.kind==='answer');
    return <><div className="classroom-assigned-bar"><button disabled={busy||!!pending.current} onClick={()=>setSelected(null)}>과제 목록으로</button><strong>{view.assignment.title}</strong><span>마감 {stamp(view.assignment.dueAt)}</span></div>
      {localWarning&&<p role="alert">{localWarning}</p>}
      <PracticeQuestion key={`${q.id}:${retryKey}`} question={q} subject={view.assignment.subject} navigate={navigate}
        onSubjectChange={()=>{if(!pending.current)setSelected(null);}} session={{current:view.assignment.problemKeys.indexOf(q.id)+1,total:view.assignment.problemKeys.length,isWrongRetry:!!first,isImmediateRetry:!!first,
          assignmentStatus:submitStatus,assignmentError:submitError,submissionPending:busy||!!pending.current,onSync:flush,
          recordStatus:'saved',syncStatus:'local',onAnswer:answer,onConfidence:()=>{},onRetryHere:()=>{setRetryKey(v=>v+1);setSubmitStatus('');},onNext:()=>{setSelected(null);setSubmitStatus('');refresh();}}}/></>;
  }
  return <main className="classroom"><div className="classroom-inner"><Link to={data?.teacher?'/eng-math/classroom':'/eng-math/classroom?role=student'}>수업 관리로 돌아가기</Link>
    {error&&<p role="alert">{error}</p>}{contentError&&<p role="alert">{contentError}</p>}
    {!data?<p role="status">과제 최신 기록을 불러오고 있습니다.</p>:<>
      <h1>{a.title}</h1><p>{a.studyDate} 학습 · 마감 {stamp(a.dueAt)}</p><p>서버 확인 {stamp(data.asOf)} · {a.state==='cancelled'?'취소된 과제':'배정된 과제'}</p><button onClick={refresh}>최신 접수 기록 확인</button>
      {data.teacher?<>
        <div className="classroom-table-wrap"><table><thead><tr><th>학생</th><th>완료 분량</th><th>접수 상태</th></tr></thead><tbody>{data.recipients.map(r=>{const s=statusFor(r.studentId);return <tr key={r.studentId}><td>{r.name}</td><td>{r.connected?`${s.completed} / ${s.total}`:'공유 중단'}</td><td>{r.connected?ASSIGNMENT_STATUS_LABELS[s.status]:'연결 해제'}</td></tr>;})}</tbody></table></div>
        <p>완료는 정답 제출 또는 오답·포기 후 정답 재풀이 기준입니다. 이해·장기 기억을 보장하지 않습니다. 접수 기록 없음은 미학습 단정이 아닙니다.</p>
        <AssignmentChange key={a.revision} assignment={a} onChanged={refresh}/>
      </>:<>
        <h2>{ASSIGNMENT_STATUS_LABELS[statusFor(user.id).status]} · {statusFor(user.id).completed}/{statusFor(user.id).total}문항</h2>
        {submitError&&<p role="alert">{submitError}</p>}{pending.current&&<button disabled={busy} onClick={flush}>같은 답안 다시 접수</button>}
        <p>자유롭게 푼 뒤 정답을 확인하세요. 틀렸거나 풀이를 먼저 본 문제는 해설을 가리고 다시 맞히면 완료로 기록합니다. 마감 뒤에도 학습할 수 있으나 지연 완료로 표시됩니다.</p>
        <p>이 과제의 답안·재풀이 결과·접수 시각은 배정한 선생님에게 공유됩니다. 수업반 연결을 해제하면 공유가 중단됩니다.</p>
        <div className="assignment-preview-list">{questions?.map(question=>{
          const rows=data.receipts.filter(r=>r.studentId===user.id&&r.problemKey===question.id),done=rows.some(r=>r.correct);
          return <article key={question.id}><strong>{question.label}</strong><span>{done?'완료':rows.length?'재풀이 필요':'아직 접수 없음'}</span><button disabled={done||busy||!!pending.current||a.state!=='active'||Date.parse(data.asOf)<Date.parse(a.opensAt)} onClick={()=>{setSelected(question.id);setRetryKey(v=>v+1);setSubmitStatus('');}}>{done?'완료한 문제':rows.length?'해설 가리고 다시 풀기':'문제 풀기'}</button></article>;
        })}</div>
      </>}
      {!!data.changes.length&&<details><summary>마감·취소 변경 이력</summary>{data.changes.map(c=><p key={c.revision}>{stamp(c.changedAt)} · {c.action==='extend'?`마감 연장 ${stamp(c.previousDueAt)} → ${stamp(c.dueAt)}`:'과제 취소'} · {c.reason}</p>)}</details>}
    </>}
  </div></main>;
}
function AssignmentChange({assignment:a,onChanged}){
  const [date,setDate]=useState(kstDate(a.dueAt)),[time,setTime]=useState('23:59'),[reason,setReason]=useState(''),[action,setAction]=useState('extend'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <details><summary>마감 연장 또는 과제 취소</summary><form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await assignmentRpc(supabase,'change',{p_id:a.id,p_revision:a.revision,p_action:action,p_due_at:action==='extend'?parseKstInput(date,time):null,p_reason:reason});onChanged();}catch(e){setError(assignmentError(e));}finally{setBusy(false);}}}>
    <label>변경 내용<select value={action} onChange={e=>setAction(e.target.value)}><option value="extend">마감 연장</option><option value="cancel">과제 취소 · 추가 제출 중지</option></select></label>
    {action==='extend'&&<div className="assignment-date-fields"><label>새 마감일<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label>새 마감 시간<input type="time" value={time} onChange={e=>setTime(e.target.value)} required/></label></div>}
    <label>변경 이유<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={160} required/></label><p>이미 접수된 답안은 보존됩니다. 마감 단축은 지원하지 않습니다.</p>{error&&<p role="alert">{error}</p>}<button disabled={busy||a.state!=='active'}>{action==='extend'?'마감 연장 저장':'과제 취소 확정'}</button>
  </form></details>;
}
