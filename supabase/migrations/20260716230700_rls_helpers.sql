-- RLS helper functions (bestilling §6/§7). security definer so they can read
-- user_roles/kundeadmin_orgs/kundeadmin_courses/course_responsibles regardless
-- of the calling policy's own RLS, with search_path pinned against hijacking.

create or replace function has_org_access(p_uid uuid, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    where ur.user_id = p_uid
      and (
        ur.role = 'superadmin'
        or (
          ur.role = 'kundeadmin'
          and exists (
            select 1 from kundeadmin_orgs ko
            where ko.kundeadmin_user_id = p_uid and ko.org_id = p_org_id
          )
        )
        or (
          ur.role in ('org_ansvarlig', 'kurs_ansvarlig', 'bruker')
          and ur.org_id = p_org_id
        )
      )
  );
$$;

create or replace function has_course_access(p_uid uuid, p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    where ur.user_id = p_uid
      and (
        ur.role = 'superadmin'
        or (
          ur.role = 'kundeadmin'
          and exists (
            select 1 from kundeadmin_courses kc
            where kc.kundeadmin_user_id = p_uid and kc.course_id = p_course_id
          )
        )
        or (
          ur.role = 'kurs_ansvarlig'
          and exists (
            select 1 from course_responsibles cr
            where cr.user_id = p_uid and cr.course_id = p_course_id
          )
        )
      )
  );
$$;

-- De fleste resultattabellene nøkler på course_version_id, ikke course_id
-- (bestilling §6). Traverserer course_version_id -> course_id -> has_course_access
-- so kurs_ansvarlig/kundeadmin actually see results on version-keyed tables.
create or replace function has_course_version_access(p_uid uuid, p_course_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_course_access(
    p_uid,
    (select course_id from course_versions where id = p_course_version_id)
  );
$$;

create or replace function is_superadmin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles where user_id = p_uid and role = 'superadmin'
  );
$$;

-- has_role_in_org / has_any_role_in_org / has_role: used by RLS policies on
-- OTHER tables to check the caller's org-scoped role(s) WITHOUT a plain
-- inline `select ... from user_roles` subquery. That matters specifically
-- because user_roles has RLS enabled on itself: an inline subquery runs as
-- the invoking role and re-triggers user_roles' own policies, which (if they
-- also inline-query user_roles) recurses infinitely. Routing through a
-- security definer function breaks the cycle since it executes as the
-- function owner, which bypasses RLS.
create or replace function has_role_in_org(p_uid uuid, p_role user_role, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = p_uid and role = p_role and org_id = p_org_id
  );
$$;

create or replace function has_any_role_in_org(p_uid uuid, p_roles user_role[], p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = p_uid and role = any(p_roles) and org_id = p_org_id
  );
$$;

create or replace function has_role(p_uid uuid, p_role user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles where user_id = p_uid and role = p_role
  );
$$;
