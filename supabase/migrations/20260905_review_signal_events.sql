begin;

alter table public.learning_events
  drop constraint learning_events_activity_type_allowed;

alter table public.learning_events
  add constraint learning_events_activity_type_allowed
    check (
      activity_type in (
        'answer',
        'remediation_complete',
        'review_complete',
        'concept_complete',
        'review_signal'
      )
    );

alter table public.learning_events
  drop constraint learning_events_payload_matches_activity;

alter table public.learning_events
  add constraint learning_events_payload_matches_activity
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
      or
      (
        activity_type = 'concept_complete'
        and subject = 'math'
        and correct is null
        and outcome = 'completed'
        and correct_first is null
        and review_offset is null
      )
      or
      (
        activity_type = 'review_signal'
        and correct is null
        and outcome in ('gave_up', 'sure_wrong')
        and correct_first is null
        and review_offset is null
      )
    );

comment on constraint learning_events_payload_matches_activity
  on public.learning_events is
  'Keeps question, remediation, review, math concept completion, and post-solve review-signal events semantically distinct.';

commit;
