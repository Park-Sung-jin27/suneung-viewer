-- Applied to production ychfoizuogscrhcwnris on 2026-09-07 with representative approval.
begin;

create table public.eng_math_classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  invite_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
create index eng_math_classrooms_teacher on public.eng_math_classrooms(teacher_id);
create table public.eng_math_class_members (
  class_id uuid not null references public.eng_math_classrooms(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null check (char_length(btrim(student_name)) between 1 and 40),
  english_target integer not null default 0 check (english_target between 0 and 200),
  math_target integer not null default 0 check (math_target between 0 and 200),
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index eng_math_class_members_student on public.eng_math_class_members(student_id);
alter table public.eng_math_classrooms enable row level security;
alter table public.eng_math_class_members enable row level security;
-- No direct table access. All calls below explicitly check the authenticated caller.
revoke all on public.eng_math_classrooms, public.eng_math_class_members from public, anon, authenticated;

create function public.eng_math_classroom_list() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'CLASS_AUTH_REQUIRED'; end if;
  return jsonb_build_object(
    'owned', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name,
      'invite_code', c.invite_code) order by c.created_at) from public.eng_math_classrooms c
      where c.teacher_id = auth.uid()), '[]'::jsonb),
    'joined', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name,
      'student_name', m.student_name, 'english_target', m.english_target, 'math_target', m.math_target)
      order by m.joined_at) from public.eng_math_class_members m
      join public.eng_math_classrooms c on c.id = m.class_id
      where m.student_id = auth.uid()), '[]'::jsonb));
end $$;

create function public.eng_math_classroom_create(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'CLASS_AUTH_REQUIRED'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'CLASS_INVALID_NAME'; end if;
  if (select count(*) from public.eng_math_classrooms where teacher_id = auth.uid()) >= 10 then
    raise exception 'CLASS_LIMIT'; end if;
  insert into public.eng_math_classrooms(teacher_id, name) values(auth.uid(), btrim(p_name)) returning id into v_id;
  return v_id;
end $$;

create function public.eng_math_classroom_preview(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_class public.eng_math_classrooms;
begin
  if auth.uid() is null then raise exception 'CLASS_AUTH_REQUIRED'; end if;
  select * into v_class from public.eng_math_classrooms where invite_code = lower(btrim(p_code));
  if not found then raise exception 'CLASS_INVITE_INVALID'; end if;
  return jsonb_build_object('id', v_class.id, 'name', v_class.name);
end $$;

create function public.eng_math_classroom_join(p_code text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_class public.eng_math_classrooms;
begin
  if auth.uid() is null then raise exception 'CLASS_AUTH_REQUIRED'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then raise exception 'CLASS_INVALID_NAME'; end if;
  select * into v_class from public.eng_math_classrooms where invite_code = lower(btrim(p_code)) for update;
  if not found then raise exception 'CLASS_INVITE_INVALID'; end if;
  if v_class.teacher_id = auth.uid() then raise exception 'CLASS_SELF_JOIN'; end if;
  if not exists(select 1 from public.eng_math_class_members where class_id = v_class.id and student_id = auth.uid())
    and (select count(*) from public.eng_math_class_members where class_id = v_class.id) >= 60 then
    raise exception 'CLASS_MEMBER_LIMIT'; end if;
  insert into public.eng_math_class_members(class_id, student_id, student_name)
    values(v_class.id, auth.uid(), btrim(p_name))
    on conflict(class_id, student_id) do update set student_name = excluded.student_name;
  return v_class.id;
end $$;

create function public.eng_math_classroom_roster(p_class_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.eng_math_classrooms where id = p_class_id and teacher_id = auth.uid()) then
    raise exception 'CLASS_FORBIDDEN'; end if;
  return jsonb_build_object('as_of', now(), 'members', coalesce((select jsonb_agg(
    jsonb_build_object('student_id', student_id, 'student_name', student_name,
      'english_target', english_target, 'math_target', math_target, 'joined_at', joined_at)
    order by joined_at, student_id) from public.eng_math_class_members where class_id = p_class_id), '[]'::jsonb));
end $$;

create function public.eng_math_classroom_events(p_class_id uuid, p_as_of timestamptz, p_offset integer default 0)
returns table(event_id text, user_id uuid, subject text, activity_type text, problem_key text,
  source_session_id text, occurred_at timestamptz, correct boolean, outcome text, correct_first boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.eng_math_classrooms where id = p_class_id and teacher_id = auth.uid()) then
    raise exception 'CLASS_FORBIDDEN'; end if;
  if p_as_of is null or p_as_of > now() or p_as_of < now() - interval '1 hour'
    or p_offset is null or p_offset < 0 or p_offset > 50000 then raise exception 'CLASS_INVALID_WINDOW'; end if;
  return query select e.event_id, e.user_id, e.subject, e.activity_type, e.problem_key,
    e.source_session_id, e.occurred_at, e.correct, e.outcome, e.correct_first
    from public.learning_events e join public.eng_math_class_members m on m.student_id = e.user_id
    where m.class_id = p_class_id and e.occurred_at between p_as_of - interval '30 days' and p_as_of
      and e.created_at <= p_as_of
    order by e.occurred_at desc, e.id desc limit 500 offset p_offset;
end $$;

create function public.eng_math_classroom_member_update(p_class_id uuid, p_student_id uuid,
  p_action text, p_english integer default 0, p_math integer default 0) returns void
language plpgsql security definer set search_path = '' as $$
declare v_teacher boolean;
begin
  if auth.uid() is null then raise exception 'CLASS_AUTH_REQUIRED'; end if;
  select exists(select 1 from public.eng_math_classrooms where id = p_class_id and teacher_id = auth.uid()) into v_teacher;
  if p_action = 'leave' and (v_teacher or p_student_id = auth.uid()) then
    delete from public.eng_math_class_members where class_id = p_class_id and student_id = p_student_id;
  elsif p_action = 'targets' and v_teacher then
    if p_english is null or p_math is null or p_english not between 0 and 200 or p_math not between 0 and 200 then
      raise exception 'CLASS_INVALID_TARGET'; end if;
    update public.eng_math_class_members set english_target = p_english, math_target = p_math
      where class_id = p_class_id and student_id = p_student_id;
    if not found then raise exception 'CLASS_MEMBER_MISSING'; end if;
  else raise exception 'CLASS_FORBIDDEN'; end if;
end $$;

create function public.eng_math_classroom_rotate_code(p_class_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  update public.eng_math_classrooms set invite_code = replace(gen_random_uuid()::text, '-', '')
    where id = p_class_id and teacher_id = auth.uid() returning invite_code into v_code;
  if not found then raise exception 'CLASS_FORBIDDEN'; end if;
  return v_code;
end $$;

revoke all on function public.eng_math_classroom_list(), public.eng_math_classroom_create(text),
  public.eng_math_classroom_preview(text), public.eng_math_classroom_join(text,text),
  public.eng_math_classroom_roster(uuid), public.eng_math_classroom_events(uuid,timestamptz,integer),
  public.eng_math_classroom_member_update(uuid,uuid,text,integer,integer), public.eng_math_classroom_rotate_code(uuid)
  from public, anon, authenticated;
grant execute on function public.eng_math_classroom_list(), public.eng_math_classroom_create(text),
  public.eng_math_classroom_preview(text), public.eng_math_classroom_join(text,text),
  public.eng_math_classroom_roster(uuid), public.eng_math_classroom_events(uuid,timestamptz,integer),
  public.eng_math_classroom_member_update(uuid,uuid,text,integer,integer), public.eng_math_classroom_rotate_code(uuid)
  to authenticated;
commit;
