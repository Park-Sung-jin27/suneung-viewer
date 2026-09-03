begin;

create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  activity_type text not null,
  problem_key text not null,
  source_session_id text not null,
  occurred_at timestamptz not null,
  correct boolean,
  outcome text,
  correct_first boolean,
  review_offset smallint,
  created_at timestamptz not null default now(),

  constraint learning_events_user_event_unique unique (user_id, event_id),
  constraint learning_events_event_id_length
    check (char_length(event_id) between 1 and 240),
  constraint learning_events_problem_key_length
    check (char_length(problem_key) between 1 and 180),
  constraint learning_events_source_session_id_length
    check (char_length(source_session_id) between 1 and 180),
  constraint learning_events_subject_allowed
    check (subject in ('english', 'math')),
  constraint learning_events_activity_type_allowed
    check (activity_type in ('answer', 'remediation_complete', 'review_complete')),
  constraint learning_events_payload_matches_activity
    check (
      (
        activity_type = 'answer'
        and correct is not null
        and outcome in ('answered', 'gave_up')
        and correct_first is null
        and review_offset is null
      )
      or
      (
        activity_type = 'remediation_complete'
        and correct is null
        and outcome in ('corrected', 'gave_up')
        and correct_first is null
        and review_offset is null
      )
      or
      (
        activity_type = 'review_complete'
        and correct is null
        and outcome is null
        and correct_first is not null
        and review_offset in (1, 3, 7)
      )
    )
);

comment on table public.learning_events is
  'Append-only English and math learning events used for weekly member progress.';
comment on column public.learning_events.event_id is
  'Stable client event identifier. Uniqueness is scoped to user_id.';
comment on column public.learning_events.user_id is
  'Authenticated Supabase user. Never copied from the local internal-member placeholder.';

create index learning_events_user_occurred_at_idx
  on public.learning_events (user_id, occurred_at desc);

create index learning_events_user_activity_occurred_at_idx
  on public.learning_events (user_id, activity_type, occurred_at desc);

create index learning_events_user_subject_occurred_at_idx
  on public.learning_events (user_id, subject, occurred_at desc);

alter table public.learning_events enable row level security;

revoke all on table public.learning_events from anon, authenticated;
grant select, insert on table public.learning_events to authenticated;

create policy learning_events_select_own
  on public.learning_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy learning_events_insert_own
  on public.learning_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

commit;
