-- Assignments as a first-class object (tillegg v2 §1). status is NOT stored
-- — it's derived at query time from archived_at/available_from/due_at/the
-- linked enrollments' satisfied state, same principle as
-- completion_state/course_completion (hoveddokumentet §4).
create table assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  course_version_id uuid not null references course_versions (id),
  created_by uuid not null references auth.users (id),
  target_type text not null check (target_type in ('users', 'groups', 'whole_org')),
  target_label text,
  is_mandatory boolean not null default true,
  visible_in_dashboard boolean not null default true,
  available_from timestamptz,
  due_at timestamptz,
  archived_at timestamptz, -- terminal: no unarchive endpoint exists (§1)
  created_at timestamptz not null default now(),

  -- Enables the composite FK from enrollments below (§4): "an enrollment's
  -- assignment must belong to the same org+course_version" is enforced by
  -- the database itself, not just application code.
  unique (id, org_id, course_version_id)
);

create index assignments_org_id_idx on assignments (org_id);
create index assignments_course_version_id_idx on assignments (course_version_id);

alter table assignments enable row level security;

create policy assignments_select_org on assignments for select
  using (has_any_role_in_org(auth.uid(), array['org_ansvarlig', 'kurs_ansvarlig']::user_role[], org_id));

create policy assignments_select_kundeadmin on assignments for select
  using (has_role(auth.uid(), 'kundeadmin') and has_org_access(auth.uid(), org_id));

create policy assignments_select_superadmin on assignments for select
  using (is_superadmin(auth.uid()));

create policy assignments_write_org_ansvarlig on assignments for all
  using (has_role_in_org(auth.uid(), 'org_ansvarlig', org_id))
  with check (has_role_in_org(auth.uid(), 'org_ansvarlig', org_id));

create policy assignments_write_superadmin on assignments for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

-- ============================================================ enrollments changes

-- NULL = self-enrolled (tillegg §4). Nullable so the composite FK below is a
-- no-op for self-enrolled rows (a multi-column FK with any NULL member is
-- unenforced under MATCH SIMPLE, Postgres's default).
alter table enrollments add column assignment_id uuid;

alter table enrollments
  add constraint enrollments_assignment_fkey
  foreign key (assignment_id, org_id, course_version_id)
  references assignments (id, org_id, course_version_id);

-- Supersedes the narrower, status='active'-only partial unique index from
-- an earlier phase: the tillegg's dedup model (§4) is ONE enrollment row per
-- (org, user, course_version) ever, found-or-created via
-- INSERT ... ON CONFLICT DO NOTHING, not recreated after
-- completion/withdrawal. A completed enrollment cannot be re-created; a new
-- assignment/self-enroll hitting the same trio reuses the existing row
-- (see fan_out_whole_org_assignments() below and the self-enroll route).
drop index if exists enrollments_user_course_version_active_uidx;
alter table enrollments
  add constraint enrollments_org_user_course_version_key
  unique (org_id, user_id, course_version_id);

-- ============================================================ whole_org dynamic fan-out

-- Tillegg §3: a whole_org assignment must also catch users added to the org
-- AFTER it was created, not just a snapshot at creation time. Fires on every
-- user_roles insert; only rows with role='bruker' actually get enrolled
-- (org_ansvarlig/kurs_ansvarlig holding a role in the org don't automatically
-- become learners of whole_org assignments).
create or replace function fan_out_whole_org_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.role = 'bruker' and NEW.org_id is not null then
    insert into enrollments (org_id, user_id, course_version_id, assignment_id, status, assigned_by)
    select a.org_id, NEW.user_id, a.course_version_id, a.id, 'active', a.created_by
    from assignments a
    where a.org_id = NEW.org_id
      and a.target_type = 'whole_org'
      and a.archived_at is null
      and (a.due_at is null or a.due_at > now())
    on conflict (org_id, user_id, course_version_id) do nothing;
  end if;
  return NEW;
end;
$$;

create trigger user_roles_fan_out_whole_org
  after insert on user_roles
  for each row execute function fan_out_whole_org_assignments();
