-- Additive assignment workflow. Existing classroom and learning_events stay unchanged.
-- Only the ten already-public questions are eligible. No new content release.
begin;

create table public.eng_math_assignment_packs (
  pack_id text not null, version integer not null check (version > 0),
  subject text not null check (subject in ('english','math')),
  label text not null, enabled boolean not null default true,
  primary key(pack_id, version)
);
create table public.eng_math_assignment_items (
  pack_id text not null, version integer not null, problem_key text not null,
  position integer not null check(position between 1 and 5),
  answer text not null check(answer in ('1','2','3','4','5')),
  primary key(pack_id, version, problem_key), unique(pack_id, version, position),
  foreign key(pack_id, version) references public.eng_math_assignment_packs
);
insert into public.eng_math_assignment_packs(pack_id, version, subject, label) values
  ('english-01',1,'english','2026학년도 수능 영어 19~23번'),
  ('math-2022_06-common-01',1,'math','2022학년도 6월 수학 공통 1·2·3·5·6번');
insert into public.eng_math_assignment_items values
  ('english-01',1,'2026_csat_19',1,'1'), ('english-01',1,'2026_csat_20',2,'2'),
  ('english-01',1,'2026_csat_21',3,'2'), ('english-01',1,'2026_csat_22',4,'1'),
  ('english-01',1,'2026_csat_23',5,'3'),
  ('math-2022_06-common-01',1,'2022_06_common_1',1,'4'),
  ('math-2022_06-common-01',1,'2022_06_common_2',2,'5'),
  ('math-2022_06-common-01',1,'2022_06_common_3',3,'1'),
  ('math-2022_06-common-01',1,'2022_06_common_5',4,'3'),
  ('math-2022_06-common-01',1,'2022_06_common_6',5,'4');

create table public.eng_math_assignments (
  id uuid primary key, class_id uuid not null references public.eng_math_classrooms on delete cascade,
  title text not null check(char_length(btrim(title)) between 1 and 80),
  pack_id text not null, version integer not null,
  study_date date not null, opens_at timestamptz not null, due_at timestamptz not null,
  assigned_at timestamptz not null default clock_timestamp(),
  state text not null default 'active' check(state in ('active','cancelled')),
  revision integer not null default 1 check(revision > 0),
  foreign key(pack_id, version) references public.eng_math_assignment_packs,
  check(due_at > opens_at and due_at > assigned_at)
);
create index eng_math_assignments_class_date on public.eng_math_assignments(class_id, study_date desc, id);
create table public.eng_math_assignment_recipients (
  assignment_id uuid not null references public.eng_math_assignments on delete cascade,
  student_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null,
  primary key(assignment_id, student_id)
);
create index eng_math_assignment_recipient_student on public.eng_math_assignment_recipients(student_id, assignment_id);
create table public.eng_math_assignment_receipts (
  id uuid primary key, assignment_id uuid not null, student_id uuid not null,
  problem_key text not null, parent_id uuid references public.eng_math_assignment_receipts,
  submitted_answer text, outcome text not null check(outcome in ('answered','gave_up')),
  correct boolean not null, received_at timestamptz not null default clock_timestamp(),
  foreign key(assignment_id, student_id) references public.eng_math_assignment_recipients on delete cascade,
  check((outcome = 'answered' and submitted_answer in ('1','2','3','4','5')) or
    (outcome = 'gave_up' and submitted_answer is null and not correct))
);
create unique index eng_math_assignment_first_answer on public.eng_math_assignment_receipts(assignment_id, student_id, problem_key) where parent_id is null;
create index eng_math_assignment_receipt_lookup on public.eng_math_assignment_receipts(assignment_id, student_id, received_at);
create table public.eng_math_assignment_changes (
  assignment_id uuid not null references public.eng_math_assignments on delete cascade,
  revision integer not null, actor_id uuid not null references auth.users,
  action text not null check(action in ('extend','cancel')),
  previous_due_at timestamptz not null, due_at timestamptz not null,
  reason text not null check(char_length(btrim(reason)) between 1 and 160),
  changed_at timestamptz not null default clock_timestamp(),
  primary key(assignment_id, revision)
);

alter table public.eng_math_assignment_packs enable row level security;
alter table public.eng_math_assignment_items enable row level security;
alter table public.eng_math_assignments enable row level security;
alter table public.eng_math_assignment_recipients enable row level security;
alter table public.eng_math_assignment_receipts enable row level security;
alter table public.eng_math_assignment_changes enable row level security;
revoke all on public.eng_math_assignment_packs, public.eng_math_assignment_items,
  public.eng_math_assignments, public.eng_math_assignment_recipients,
  public.eng_math_assignment_receipts, public.eng_math_assignment_changes
  from public, anon, authenticated;

create function public.eng_math_assignment_create(p_id uuid, p_class_id uuid, p_title text,
  p_pack_id text, p_study_date date, p_due_at timestamptz, p_students uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := clock_timestamp(); v_open timestamptz;
  v_pack public.eng_math_assignment_packs; v_old public.eng_math_assignments; v_count integer;
begin
  if auth.uid() is null then raise exception 'ASSIGN_AUTH_REQUIRED'; end if;
  perform 1 from public.eng_math_classrooms where id=p_class_id and teacher_id=auth.uid() for update;
  if not found then raise exception 'ASSIGN_FORBIDDEN'; end if;
  if p_id is null or p_title is null or char_length(btrim(p_title)) not between 1 and 80
    or p_students is null or cardinality(p_students) not between 1 and 60
    or exists(select 1 from unnest(p_students) s where s is null)
    or (select count(distinct s) from unnest(p_students) s) <> cardinality(p_students)
    then raise exception 'ASSIGN_INVALID_INPUT'; end if;
  select * into v_old from public.eng_math_assignments where id=p_id;
  if found then
    if v_old.class_id <> p_class_id or v_old.title <> btrim(p_title) or v_old.pack_id is distinct from p_pack_id
      or v_old.study_date is distinct from p_study_date or v_old.due_at is distinct from p_due_at
      or (select array_agg(student_id order by student_id) from public.eng_math_assignment_recipients where assignment_id=p_id)
        is distinct from (select array_agg(s order by s) from unnest(p_students) s)
      then raise exception 'ASSIGN_REQUEST_CONFLICT'; end if;
    return p_id;
  end if;
  v_open := p_study_date::timestamp at time zone 'Asia/Seoul';
  if p_study_date is null or p_study_date < (v_now at time zone 'Asia/Seoul')::date
    or p_study_date > (v_now at time zone 'Asia/Seoul')::date + 90
    or p_due_at is null or p_due_at <= greatest(v_open,v_now)
    or p_due_at > v_open + interval '31 days' then raise exception 'ASSIGN_INVALID_DATE'; end if;
  select * into v_pack from public.eng_math_assignment_packs where pack_id=p_pack_id and enabled order by version desc limit 1;
  if not found then raise exception 'ASSIGN_PACK_UNAVAILABLE'; end if;
  if (select count(*) from public.eng_math_assignments where class_id=p_class_id and study_date=p_study_date) >= 20
    then raise exception 'ASSIGN_DAILY_LIMIT'; end if;
  perform 1 from public.eng_math_class_members where class_id=p_class_id and student_id=any(p_students) for share;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(p_students) then raise exception 'ASSIGN_MEMBER_MISSING'; end if;
  insert into public.eng_math_assignments(id,class_id,title,pack_id,version,study_date,opens_at,due_at,assigned_at)
    values(p_id,p_class_id,btrim(p_title),p_pack_id,v_pack.version,p_study_date,v_open,p_due_at,v_now);
  insert into public.eng_math_assignment_recipients
    select p_id,student_id,joined_at from public.eng_math_class_members where class_id=p_class_id and student_id=any(p_students);
  return p_id;
end $$;

create function public.eng_math_assignment_list(p_class_id uuid default null, p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'ASSIGN_AUTH_REQUIRED'; end if;
  if p_offset is null or p_offset < 0 or p_offset > 10000 then raise exception 'ASSIGN_INVALID_INPUT'; end if;
  if p_class_id is not null and not exists(select 1 from public.eng_math_classrooms where id=p_class_id and teacher_id=auth.uid())
    then raise exception 'ASSIGN_FORBIDDEN'; end if;
  return jsonb_build_object('asOf',clock_timestamp(), 'items', coalesce((select jsonb_agg(to_jsonb(t)) from (
    select a.id,a.title,a.study_date,a.due_at,a.state,a.revision,p.subject,p.label,c.name as class_name
    from public.eng_math_assignments a join public.eng_math_assignment_packs p using(pack_id,version)
      join public.eng_math_classrooms c on c.id=a.class_id
    where (p_class_id is not null and a.class_id=p_class_id) or (p_class_id is null and exists(
      select 1 from public.eng_math_assignment_recipients r join public.eng_math_class_members m
      on m.class_id=a.class_id and m.student_id=r.student_id and m.joined_at=r.joined_at
      where r.assignment_id=a.id and r.student_id=auth.uid()))
    order by a.study_date desc,a.id limit 50 offset p_offset
  ) t),'[]'::jsonb));
end $$;

create function public.eng_math_assignment_detail(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.eng_math_assignments; v_teacher boolean; v_now timestamptz := clock_timestamp();
begin
  select * into a from public.eng_math_assignments where id=p_id;
  if not found then raise exception 'ASSIGN_FORBIDDEN'; end if;
  select exists(select 1 from public.eng_math_classrooms where id=a.class_id and teacher_id=auth.uid()) into v_teacher;
  if not v_teacher and not exists(select 1 from public.eng_math_assignment_recipients r
    join public.eng_math_class_members m on m.class_id=a.class_id and m.student_id=r.student_id and m.joined_at=r.joined_at
    where r.assignment_id=a.id and r.student_id=auth.uid()) then raise exception 'ASSIGN_FORBIDDEN'; end if;
  return jsonb_build_object('asOf',v_now,'teacher',v_teacher,'assignment',jsonb_build_object(
    'id',a.id,'title',a.title,'version',a.version,'revision',a.revision,'packId',a.pack_id,
    'subject',(select subject from public.eng_math_assignment_packs where pack_id=a.pack_id and version=a.version),
    'studyDate',a.study_date,'opensAt',a.opens_at,'assignedAt',a.assigned_at,'dueAt',a.due_at,'state',a.state,
    'problemKeys',(select jsonb_agg(problem_key order by position) from public.eng_math_assignment_items where pack_id=a.pack_id and version=a.version),
    'recipientIds',(select jsonb_agg(student_id order by student_id) from public.eng_math_assignment_recipients where assignment_id=a.id and (v_teacher or student_id=auth.uid()))),
    'recipients',coalesce((select jsonb_agg(jsonb_build_object('studentId',r.student_id,'name',coalesce(m.student_name,'연결 해제된 학생'),
      'connected',m.student_id is not null)) from public.eng_math_assignment_recipients r left join public.eng_math_class_members m
      on m.class_id=a.class_id and m.student_id=r.student_id and m.joined_at=r.joined_at
      where r.assignment_id=a.id and (v_teacher or r.student_id=auth.uid())),'[]'::jsonb),
    'receipts',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'assignmentId',a.id,'version',a.version,
      'studentId',r.student_id,'subject',(select subject from public.eng_math_assignment_packs where pack_id=a.pack_id and version=a.version),
      'problemKey',r.problem_key,'attemptId',coalesce(r.parent_id,r.id),'kind',case when r.parent_id is null then 'answer' else 'correction' end,
      'outcome',r.outcome,'correct',r.correct,'receivedAt',r.received_at) order by r.received_at,r.id)
      from public.eng_math_assignment_receipts r join public.eng_math_assignment_recipients ar on ar.assignment_id=r.assignment_id and ar.student_id=r.student_id
      join public.eng_math_class_members m on m.class_id=a.class_id and m.student_id=r.student_id and m.joined_at=ar.joined_at
      where r.assignment_id=a.id and (v_teacher or r.student_id=auth.uid())),'[]'::jsonb),
    'changes',coalesce((select jsonb_agg(jsonb_build_object('revision',revision,'action',action,'dueAt',due_at,'previousDueAt',previous_due_at,'reason',reason,'changedAt',changed_at) order by revision)
      from public.eng_math_assignment_changes where assignment_id=a.id),'[]'::jsonb));
end $$;

create function public.eng_math_assignment_submit(p_id uuid,p_version integer,p_request_id uuid,p_problem_key text,
  p_answer text,p_outcome text,p_parent_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.eng_math_assignments; v_answer text; v_correct boolean; r public.eng_math_assignment_receipts;
  v_now timestamptz; v_parent public.eng_math_assignment_receipts;
begin
  if auth.uid() is null then raise exception 'ASSIGN_AUTH_REQUIRED'; end if;
  select * into a from public.eng_math_assignments where id=p_id for update;
  if not found then raise exception 'ASSIGN_FORBIDDEN'; end if;
  perform 1 from public.eng_math_class_members m join public.eng_math_assignment_recipients ar
    on ar.assignment_id=a.id and ar.student_id=m.student_id and ar.joined_at=m.joined_at
    where m.class_id=a.class_id and m.student_id=auth.uid() for share of m;
  if not found then raise exception 'ASSIGN_FORBIDDEN'; end if;
  if p_version is distinct from a.version then raise exception 'ASSIGN_VERSION_MISMATCH'; end if;
  if p_request_id is null or p_outcome is null or p_outcome not in ('answered','gave_up')
    or (p_outcome='answered' and (p_answer is null or p_answer not in ('1','2','3','4','5')))
    or (p_outcome='gave_up' and p_answer is not null) then raise exception 'ASSIGN_INVALID_INPUT'; end if;
  select * into r from public.eng_math_assignment_receipts where id=p_request_id;
  if found then
    if r.assignment_id<>a.id or r.student_id<>auth.uid() or r.problem_key is distinct from p_problem_key
      or r.parent_id is distinct from p_parent_id or r.submitted_answer is distinct from p_answer or r.outcome<>p_outcome
      then raise exception 'ASSIGN_REQUEST_CONFLICT'; end if;
    return jsonb_build_object('id',r.id,'correct',r.correct,'receivedAt',r.received_at);
  end if;
  v_now := clock_timestamp(); -- after permission/row locks, never a client clock
  if a.state<>'active' then raise exception 'ASSIGN_CANCELLED'; end if;
  if v_now<a.opens_at then raise exception 'ASSIGN_NOT_OPEN'; end if;
  select answer into v_answer from public.eng_math_assignment_items where pack_id=a.pack_id and version=a.version and problem_key=p_problem_key;
  if not found then raise exception 'ASSIGN_PROBLEM_MISMATCH'; end if;
  if p_parent_id is not null then
    select * into v_parent from public.eng_math_assignment_receipts where id=p_parent_id;
    if not found or v_parent.assignment_id<>a.id or v_parent.student_id<>auth.uid() or v_parent.problem_key<>p_problem_key
      or v_parent.parent_id is not null or v_parent.correct then raise exception 'ASSIGN_PARENT_MISMATCH'; end if;
  elsif exists(select 1 from public.eng_math_assignment_receipts where assignment_id=a.id and student_id=auth.uid() and problem_key=p_problem_key and parent_id is null)
    then raise exception 'ASSIGN_ALREADY_ANSWERED';
  end if;
  if (select count(*) from public.eng_math_assignment_receipts where assignment_id=a.id and student_id=auth.uid() and problem_key=p_problem_key) >= 50
    then raise exception 'ASSIGN_ATTEMPT_LIMIT'; end if;
  v_correct := p_outcome='answered' and p_answer=v_answer;
  insert into public.eng_math_assignment_receipts(id,assignment_id,student_id,problem_key,parent_id,submitted_answer,outcome,correct,received_at)
    values(p_request_id,a.id,auth.uid(),p_problem_key,p_parent_id,p_answer,p_outcome,coalesce(v_correct,false),v_now);
  return jsonb_build_object('id',p_request_id,'correct',coalesce(v_correct,false),'receivedAt',v_now);
end $$;

create function public.eng_math_assignment_change(p_id uuid,p_revision integer,p_action text,p_due_at timestamptz,p_reason text) returns integer
language plpgsql security definer set search_path = '' as $$
declare a public.eng_math_assignments;
begin
  select * into a from public.eng_math_assignments where id=p_id for update;
  if not found or not exists(select 1 from public.eng_math_classrooms where id=a.class_id and teacher_id=auth.uid()) then raise exception 'ASSIGN_FORBIDDEN'; end if;
  if p_revision is distinct from a.revision then raise exception 'ASSIGN_STALE_REVISION'; end if;
  if a.state<>'active' then raise exception 'ASSIGN_CANCELLED'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 160 or p_action is null or p_action not in ('extend','cancel')
    then raise exception 'ASSIGN_INVALID_INPUT'; end if;
  if p_action='extend' and (p_due_at is null or p_due_at<=a.due_at or p_due_at<=clock_timestamp() or p_due_at>a.opens_at+interval '31 days')
    then raise exception 'ASSIGN_INVALID_DATE'; end if;
  insert into public.eng_math_assignment_changes(assignment_id,revision,actor_id,action,previous_due_at,due_at,reason)
    values(a.id,a.revision+1,auth.uid(),p_action,a.due_at,case when p_action='extend' then p_due_at else a.due_at end,btrim(p_reason));
  update public.eng_math_assignments set revision=revision+1,
    due_at=case when p_action='extend' then p_due_at else due_at end,
    state=case when p_action='cancel' then 'cancelled' else state end where id=a.id;
  return a.revision+1;
end $$;

revoke all on function public.eng_math_assignment_create(uuid,uuid,text,text,date,timestamptz,uuid[]),
  public.eng_math_assignment_list(uuid,integer),public.eng_math_assignment_detail(uuid),
  public.eng_math_assignment_submit(uuid,integer,uuid,text,text,text,uuid),
  public.eng_math_assignment_change(uuid,integer,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.eng_math_assignment_create(uuid,uuid,text,text,date,timestamptz,uuid[]),
  public.eng_math_assignment_list(uuid,integer),public.eng_math_assignment_detail(uuid),
  public.eng_math_assignment_submit(uuid,integer,uuid,text,text,text,uuid),
  public.eng_math_assignment_change(uuid,integer,text,timestamptz,text) to authenticated;
commit;
