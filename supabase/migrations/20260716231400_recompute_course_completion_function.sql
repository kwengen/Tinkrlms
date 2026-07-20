-- Course-level completion roll-up (bestilling §4/§8/§13-B): ALL obligatory
-- AUs satisfied ⇒ course_completion.satisfied = true (AND). "Obligatory"
-- excludes AUs with move_on = 'NotApplicable' — per cmi5, those AUs have no
-- bearing on moveOn/rollup criteria at all (see the deriveSatisfied() doc
-- comment in packages/shared/src/ingest/completion.ts for the same call).
--
-- Score = the most recently updated completion_state row across ALL of this
-- enrollment's registrations/attempts where success='true' — "siste
-- beståtte" (bestilling §4, kontrakt v3 §13): Studio reports an honest score
-- per attempt, the LMS decides which one counts.
--
-- Called once per relevant xAPI ingest event (see packages/shared's
-- IngestPorts.recomputeCourseCompletion) — cheap enough to just recompute
-- from scratch each time rather than trying to incrementally patch state.
create or replace function recompute_course_completion(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_version_id uuid;
  v_org_id uuid;
  v_user_id uuid;
  v_all_satisfied boolean;
  v_score numeric;
  v_completed_at timestamptz;
begin
  select course_version_id, org_id, user_id
    into v_course_version_id, v_org_id, v_user_id
    from enrollments where id = p_enrollment_id;

  select not exists (
    select 1 from assignable_units au
    where au.course_version_id = v_course_version_id
      and au.move_on <> 'NotApplicable'
      and not exists (
        select 1 from registrations r
        join completion_state cs on cs.registration = r.registration_uuid
        where r.enrollment_id = p_enrollment_id
          and r.au_id = au.id
          and cs.satisfied = true
      )
  ) into v_all_satisfied;

  select cs.score into v_score
  from registrations r
  join completion_state cs on cs.registration = r.registration_uuid
  where r.enrollment_id = p_enrollment_id and cs.success = 'true'
  order by cs.updated_at desc
  limit 1;

  if v_all_satisfied then
    v_completed_at := now();
  end if;

  insert into course_completion (enrollment_id, org_id, user_id, course_version_id, status, satisfied, score, completed_at)
  values (
    p_enrollment_id, v_org_id, v_user_id, v_course_version_id,
    case when v_all_satisfied then 'completed' else 'in_progress' end::course_completion_status_type,
    v_all_satisfied, v_score, v_completed_at
  )
  on conflict (enrollment_id) do update set
    status = excluded.status,
    satisfied = excluded.satisfied,
    score = coalesce(excluded.score, course_completion.score),
    completed_at = coalesce(course_completion.completed_at, excluded.completed_at),
    updated_at = now();
end;
$$;
