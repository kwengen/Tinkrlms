-- Innmelding og forsøk (bestilling §4)

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  user_id uuid not null references auth.users (id),
  course_version_id uuid not null references course_versions (id),
  status enrollment_status_type not null default 'active',
  assigned_by uuid references auth.users (id),
  assigned_at timestamptz not null default now(),
  due_at timestamptz
);

create index enrollments_org_id_idx on enrollments (org_id);
create index enrollments_user_id_idx on enrollments (user_id);
create index enrollments_course_version_id_idx on enrollments (course_version_id);

-- Én cmi5-registrering per forsøk per AU (attempt-nivå). current_session_id's
-- FK to registration_sessions is added below (registration_sessions.registration_id
-- points back here, so the cycle is resolved with an ALTER TABLE after both exist).
create table registrations (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments (id),
  au_id uuid not null references assignable_units (id),
  registration_uuid uuid not null unique default gen_random_uuid(),
  org_id uuid not null references organizations (id),
  user_id uuid not null references auth.users (id),
  current_session_id uuid,
  launch_mode launch_mode_type not null default 'Normal',
  status registration_status_type not null default 'active',
  attempt_number integer not null default 1,
  started_at timestamptz not null default now(),
  last_statement_at timestamptz,
  ended_at timestamptz
);

create index registrations_enrollment_id_idx on registrations (enrollment_id);
create index registrations_au_id_idx on registrations (au_id);
create index registrations_org_id_idx on registrations (org_id);
create index registrations_user_id_idx on registrations (user_id);

-- Aktiv-registration-policy (bestilling §4): én `active` registrering per
-- enrollment + au om gangen.
create unique index registrations_one_active_per_enrollment_au
  on registrations (enrollment_id, au_id)
  where (status = 'active');

-- Én rad per launch/session. Historikk overskrives ALDRI: hver relansering
-- setter inn en NY rad.
create table registration_sessions (
  session_id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations (id),
  org_id uuid not null references organizations (id),
  user_id uuid not null references auth.users (id),
  launched_at timestamptz not null default now(),
  token_expires_at timestamptz not null,
  ended_at timestamptz,
  status session_status_type not null default 'active'
);

create index registration_sessions_registration_id_idx on registration_sessions (registration_id);

-- Only one session may be `active` per registration at a time (a new launch
-- must supersede the previous one first, per bestilling §4's two-tabs policy).
create unique index registration_sessions_one_active_per_registration
  on registration_sessions (registration_id)
  where (status = 'active');

alter table registrations
  add constraint registrations_current_session_id_fkey
  foreign key (current_session_id) references registration_sessions (session_id);
