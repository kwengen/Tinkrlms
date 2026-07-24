-- "Active version" selection for catalog purposes (tillegg v2 §10's
-- activeVersionId). The model has no explicit published/current pointer on
-- courses yet — bestilling's central-catalog concept assumed superadmin
-- publish gates a version, but that mechanism was never actually built
-- (flagging, not guessing a fix). Interim rule: the most recently created
-- version of a course is "active". security_invoker so RLS on
-- course_versions is still evaluated per-caller, not as the view owner.
create view course_active_versions
with (security_invoker = true) as
select distinct on (course_id)
  course_id, id as course_version_id, version_label, created_at
from course_versions
order by course_id, created_at desc;

-- Atomically creates-or-links enrollments for a batch of target users
-- against one assignment (tillegg v2 §1/§4). For each user: if no
-- enrollment exists yet for (org, user, course_version), create one linked
-- to this assignment; if one exists, (re)point its assignment_id at this
-- assignment UNCONDITIONALLY — this is deliberately last-write-wins,
-- matching the documented, accepted edge case in tillegg §4 ("hvis to ulike
-- ... tildelinger begge treffer samme bruker ... vil assignment_id peke på
-- den SISTE som traff raden"). had_other_assignment tells the caller which
-- targets already belonged to a DIFFERENT assignment, for the non-blocking
-- overlap warning (tillegg §1).
create or replace function assign_enrollments(p_assignment_id uuid, p_user_ids uuid[])
returns table (user_id uuid, enrollment_id uuid, had_other_assignment boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_course_version_id uuid;
  v_created_by uuid;
  v_uid uuid;
  v_existing_id uuid;
  v_existing_assignment_id uuid;
begin
  select a.org_id, a.course_version_id, a.created_by
    into v_org_id, v_course_version_id, v_created_by
    from assignments a where a.id = p_assignment_id;

  if v_org_id is null then
    raise exception 'Unknown assignment %', p_assignment_id;
  end if;

  foreach v_uid in array p_user_ids loop
    select e.id, e.assignment_id into v_existing_id, v_existing_assignment_id
    from enrollments e
    where e.org_id = v_org_id and e.user_id = v_uid and e.course_version_id = v_course_version_id;

    if v_existing_id is null then
      insert into enrollments (org_id, user_id, course_version_id, assignment_id, status, assigned_by)
      values (v_org_id, v_uid, v_course_version_id, p_assignment_id, 'active', v_created_by)
      returning id into v_existing_id;
      v_existing_assignment_id := null;
    else
      update enrollments set assignment_id = p_assignment_id where id = v_existing_id;
    end if;

    user_id := v_uid;
    enrollment_id := v_existing_id;
    had_other_assignment := v_existing_assignment_id is not null and v_existing_assignment_id <> p_assignment_id;
    return next;
  end loop;
end;
$$;
