begin;

select plan(18);

select has_table('public', 'learning_events', 'learning_events table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.learning_events'::regclass),
  true,
  'row level security is enabled'
);
select has_index(
  'public',
  'learning_events',
  'learning_events_user_event_unique',
  'user-scoped event id is unique'
);
select has_index(
  'public',
  'learning_events',
  'learning_events_user_occurred_at_idx',
  'member timeline index exists'
);

select ok(not has_table_privilege('anon', 'public.learning_events', 'SELECT'), 'anon cannot select');
select ok(not has_table_privilege('anon', 'public.learning_events', 'INSERT'), 'anon cannot insert');
select ok(has_table_privilege('authenticated', 'public.learning_events', 'SELECT'), 'authenticated can select');
select ok(has_table_privilege('authenticated', 'public.learning_events', 'INSERT'), 'authenticated can insert');
select ok(not has_table_privilege('authenticated', 'public.learning_events', 'UPDATE'), 'authenticated cannot update');
select ok(not has_table_privilege('authenticated', 'public.learning_events', 'DELETE'), 'authenticated cannot delete');

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000001', 'learning-owner@example.test'),
  ('20000000-0000-4000-8000-000000000002', 'learning-other@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    insert into public.learning_events (
      event_id, user_id, subject, activity_type, problem_key,
      source_session_id, occurred_at, correct, outcome
    ) values (
      'session:q1:answer',
      '10000000-0000-4000-8000-000000000001',
      'english', 'answer', 'q1', 'session', now(), true, 'answered'
    )
  $$,
  'a member can insert an event for their own user id'
);

select lives_ok(
  $$
    insert into public.learning_events (
      event_id, user_id, subject, activity_type, problem_key,
      source_session_id, occurred_at, outcome
    ) values (
      'concept-v1:limit-1:complete',
      '10000000-0000-4000-8000-000000000001',
      'math', 'concept_complete', 'limit-1',
      'concept-v1:sequence-limits', now(), 'completed'
    )
  $$,
  'a member can insert a math concept completion for their own user id'
);

select throws_ok(
  $$
    insert into public.learning_events (
      event_id, user_id, subject, activity_type, problem_key,
      source_session_id, occurred_at, outcome
    ) values (
      'concept-v1:invalid:complete',
      '10000000-0000-4000-8000-000000000001',
      'english', 'concept_complete', 'invalid',
      'concept-v1:sequence-limits', now(), 'completed'
    )
  $$,
  '23514',
  null,
  'concept completion cannot be stored as an English event'
);

select throws_ok(
  $$
    insert into public.learning_events (
      event_id, user_id, subject, activity_type, problem_key,
      source_session_id, occurred_at, correct, outcome
    ) values (
      'session:q2:answer',
      '20000000-0000-4000-8000-000000000002',
      'math', 'answer', 'q2', 'session', now(), false, 'answered'
    )
  $$,
  '42501',
  null,
  'a member cannot insert an event for another user id'
);

select is(
  (select count(*)::integer from public.learning_events),
  2,
  'a member sees their own events'
);

select throws_ok(
  $$update public.learning_events set outcome = 'gave_up' where event_id = 'session:q1:answer'$$,
  '42501',
  null,
  'events cannot be updated by members'
);

select throws_ok(
  $$delete from public.learning_events where event_id = 'session:q1:answer'$$,
  '42501',
  null,
  'events cannot be deleted by members'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*)::integer from public.learning_events),
  0,
  'another member cannot see the owner event'
);

reset role;

select * from finish();
rollback;
