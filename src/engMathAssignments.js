// Draft/preview rules only. Production must validate membership, content access,
// assignment version and receipt timestamps on the server before using these rules.
const SUBJECTS = ["english", "math"];
const DAY = 86400000;
const fail = message => { throw new Error(message); };

export async function assignmentRpc(client, method, args = {}) {
  const {data,error} = await client.rpc(`eng_math_assignment_${method}`,args);
  if (error) throw new Error(['PGRST202','42883','42P01'].includes(error.code) ? 'ASSIGN_SETUP_REQUIRED' : error.message || 'ASSIGN_NETWORK');
  return data;
}
export function assignmentError(error) {
  const message=error?.message || '';
  const messages={
    ASSIGN_SETUP_REQUIRED:'과제 저장 기능을 준비 중입니다. 기존 학습은 계속 이용할 수 있습니다.',
    ASSIGN_FORBIDDEN:'이 과제를 볼 권한이 없거나 수업반 연결이 해제됐습니다.',
    ASSIGN_AUTH_REQUIRED:'다시 로그인해 주세요.', ASSIGN_INVALID_INPUT:'입력 내용과 대상 학생을 확인해 주세요.',
    ASSIGN_INVALID_DATE:'학습일과 마감을 확인해 주세요. 마감 연장은 기존 마감보다 뒤여야 합니다.',
    ASSIGN_PACK_UNAVAILABLE:'현재 학생에게 열린 문항 묶음만 배정할 수 있습니다.',
    ASSIGN_MEMBER_MISSING:'수업반 학생이 변경됐습니다. 학생 목록을 새로 불러와 주세요.',
    ASSIGN_REQUEST_CONFLICT:'같은 제출 번호에 다른 내용이 있습니다. 최신 기록을 확인해 주세요.',
    ASSIGN_ALREADY_ANSWERED:'이미 첫 답안이 접수됐습니다. 최신 기록을 확인하고 재풀이로 이어가세요.',
    ASSIGN_CANCELLED:'취소된 과제입니다. 추가 제출은 받지 않습니다.',
    ASSIGN_NOT_OPEN:'아직 학습일 전입니다.', ASSIGN_VERSION_MISMATCH:'과제 버전이 달라 최신 기록 확인이 필요합니다.',
    ASSIGN_STALE_REVISION:'다른 화면에서 과제가 변경됐습니다. 최신 기록을 불러온 후 다시 시도해 주세요.',
    ASSIGN_ATTEMPT_LIMIT:'이 문제의 제출 횟수가 많습니다. 선생님께 확인해 주세요.',
    ASSIGN_DAILY_LIMIT:'하루 한 수업반에는 과제를 20개까지 배정할 수 있습니다.',
  };
  return Object.entries(messages).find(([key])=>message.includes(key))?.[1] || '서버에서 확인하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
}
export const ASSIGNMENT_STATUS_LABELS={not_assigned:'배정 취소',scheduled:'학습일 전',not_started:'접수 기록 없음',in_progress:'학습 중',overdue_pending:'마감 지남 · 확인 필요',completed_on_time:'정시 완료',completed_late:'지연 완료'};

// Only the minimum retry payload is stored, scoped to the teacher and classroom.
// This is never evidence of server acceptance; every retry still uses the authorized RPC.
export function assignmentCreateStorage(teacherId,classId,suppliedStorage) {
  const key=`eng_math_assignment_create_pending_v1:${teacherId}:${classId}`;
  const disk=()=>suppliedStorage??globalThis.localStorage;
  const valid=value=>!!teacherId&&!!classId&&value?.teacherId===teacherId&&SUBJECTS.includes(value.subject)&&
    value.request?.p_class_id===classId&&typeof value.request.p_id==='string'&&
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.request.p_id)&&
    typeof value.request.p_title==='string'&&typeof value.request.p_pack_id==='string'&&
    /^\d{4}-\d{2}-\d{2}$/.test(value.request.p_study_date)&&Number.isFinite(Date.parse(value.request.p_due_at))&&
    Array.isArray(value.request.p_students)&&value.request.p_students.length>0&&value.request.p_students.every(s=>typeof s==='string');
  function read(){
    try{const raw=disk().getItem(key);if(raw===null)return null;const value=JSON.parse(raw);if(!valid(value))throw new Error();return value;}
    catch{fail('기기에 저장된 배정 확인 정보를 읽지 못했습니다. 기존 과제 목록과 브라우저 저장 상태를 확인해 주세요.');}
  }
  return {key,read,
    write(value){
      if(!valid(value))fail('배정 확인 정보가 올바르지 않아 전송하지 않았습니다.');
      const previous=read();
      if(previous&&JSON.stringify(previous)!==JSON.stringify(value))fail('다른 화면의 미확인 배정이 있습니다. 화면을 새로고침해 먼저 확인해 주세요.');
      try{const serialized=JSON.stringify(value);disk().setItem(key,serialized);if(disk().getItem(key)!==serialized)throw new Error();}
      catch{fail('이 기기에 배정 확인 정보를 저장하지 못해 전송하지 않았습니다. 저장 공간·브라우저 설정을 확인한 후 다시 눌러 주세요.');}
    },
    clear(requestId){if(read()?.request.p_id===requestId)disk().removeItem(key);},
  };
}

export function kstDate(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) fail("기준 시간을 확인해 주세요.");
  return new Date(time + 9 * 3600000).toISOString().slice(0, 10);
}

export function parseKstInput(date, time = "00:00") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    fail("날짜와 시간을 정확히 입력해 주세요.");
  const stamp = Date.parse(`${date}T${time}:00+09:00`);
  if (!Number.isFinite(stamp) || kstDate(new Date(stamp).toISOString()) !== date)
    fail("존재하는 날짜를 입력해 주세요.");
  return new Date(stamp).toISOString();
}

export function assignmentPacks(catalog) {
  return SUBJECTS.flatMap(subject => (catalog?.subjects?.[subject]?.packs || [])
    // The current math catalog has no contentStatus. Only its explicit freePackId
    // is eligible; absence of a quality flag never makes a locked pack eligible.
    .filter(pack => pack.access === "free" && pack.id === catalog.subjects[subject].freePackId &&
      (pack.contentStatus === "review_ready" || (subject === "math" && pack.contentStatus === undefined)) &&
      Number.isInteger(pack.questionCount) && pack.questionCount > 0)
    .map(pack => ({ ...pack, subject })));
}

export function createAssignmentDraft(input, { catalog, members, now }) {
  const today = kstDate(now);
  const opensAt = parseKstInput(input.studyDate);
  const dueAt = parseKstInput(input.dueDate, input.dueTime);
  if (input.studyDate < today) fail("학습일은 오늘 이후로 정해 주세요.");
  if (Date.parse(dueAt) <= Math.max(Date.parse(opensAt), Date.parse(now)))
    fail("마감은 학습 시작과 현재 시간보다 뒤여야 합니다.");
  if (Date.parse(dueAt) - Date.parse(opensAt) > 31 * DAY)
    fail("한 과제의 기간은 31일 이내로 정해 주세요.");
  const title = String(input.title || "").trim();
  if (!title || title.length > 80) fail("과제 이름을 1~80자로 입력해 주세요.");
  const pack = assignmentPacks(catalog).find(p => p.id === input.packId && p.subject === input.subject);
  if (!pack) fail("학생에게 열린 검수 완료 묶음만 선택할 수 있습니다.");
  const recipientIds = [...new Set(input.recipientIds || [])];
  if (!recipientIds.length || recipientIds.length > 60 || recipientIds.some(id => !members.some(m => m.student_id === id)))
    fail("현재 수업반의 학생을 한 명 이상 선택해 주세요.");
  return {
    title, studyDate: input.studyDate, opensAt, dueAt, createdAt: new Date(now).toISOString(),
    subject: pack.subject, packId: pack.id, packLabel: `${pack.examLabel} ${pack.label}`,
    questionCount: pack.questionCount, recipientIds,
    completionRule: "answer_then_correct", state: "draft", // Never a sent/active assignment.
  };
}

export function draftDeadlineState(draft, now) {
  const time = Date.parse(now);
  if (!Number.isFinite(time)) fail("기준 시간을 확인해 주세요.");
  if (time < Date.parse(draft.opensAt)) return "학습일 전";
  return time > Date.parse(draft.dueAt) ? "마감 지남 · 미배정" : "배정 전";
}

// Contract for the future server endpoint, not a learning_events adapter.
// Receipts must be server-issued AFTER authorization and immutable on receipt.
// Missing assignment/version/recipient context cannot reuse historical answers.
export function evaluateAssignmentReceipts(assignment, studentId, receipts, asOf) {
  if (!assignment?.id || !Number.isInteger(assignment.version) || assignment.version < 1 ||
      !SUBJECTS.includes(assignment.subject) || !Array.isArray(assignment.problemKeys) ||
      !assignment.problemKeys.length || new Set(assignment.problemKeys).size !== assignment.problemKeys.length ||
      !Array.isArray(assignment.recipientIds)) fail("과제 판정 정보가 올바르지 않습니다.");
  const now = Date.parse(asOf);
  const start = Math.max(Date.parse(assignment.opensAt), Date.parse(assignment.assignedAt));
  const due = Date.parse(assignment.dueAt);
  if (![now, start, due].every(Number.isFinite) || due <= start) fail("과제 판정 기간이 올바르지 않습니다.");
  if (assignment.state !== "active" || !assignment.recipientIds.includes(studentId))
    return { status: "not_assigned", completed: 0, total: assignment.problemKeys.length };
  const rows = receipts.filter(r => r.assignmentId === assignment.id && r.version === assignment.version &&
    r.studentId === studentId && r.subject === assignment.subject && assignment.problemKeys.includes(r.problemKey) &&
    typeof r.id === "string" && r.id && typeof r.attemptId === "string" && r.attemptId &&
    Date.parse(r.receivedAt) >= start && Date.parse(r.receivedAt) <= now);
  const unique = new Map();
  for (const row of rows) {
    if (unique.has(row.id) && JSON.stringify(unique.get(row.id)) !== JSON.stringify(row))
      fail("중복 제출 기록이 달라 판정을 중단했습니다.");
    unique.set(row.id, row);
  }
  const events = [...unique.values()].sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
  const done = assignment.problemKeys.map(key => {
    const attempts = events.filter(r => r.problemKey === key && r.kind === "answer");
    // A submitted correct answer completes a problem. Wrong/gave-up attempts need
    // a later successful retry tied to that same attempt; opening a solution is insufficient.
    const completions = attempts.flatMap(answer => {
      if (answer.correct === true && answer.outcome === "answered") return [Date.parse(answer.receivedAt)];
      if (!((answer.correct === false && answer.outcome === "answered") || answer.outcome === "gave_up")) return [];
      return events.filter(r => r.problemKey === key && r.attemptId === answer.attemptId &&
        r.kind === "correction" && r.correct === true && Date.parse(r.receivedAt) >= Date.parse(answer.receivedAt))
        .map(r => Date.parse(r.receivedAt));
    });
    return completions.length ? Math.min(...completions) : null;
  });
  const completed = done.filter(time => time !== null).length;
  const finished = completed === done.length;
  return {
    status: finished ? (Math.max(...done) <= due ? "completed_on_time" : "completed_late") :
      now < start ? "scheduled" : now > due ? "overdue_pending" : completed || events.length ? "in_progress" : "not_started",
    completed, total: done.length, completedAt: finished ? new Date(Math.max(...done)).toISOString() : null,
  };
}
