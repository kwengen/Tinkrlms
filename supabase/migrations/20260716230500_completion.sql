-- Avledet fullføringsdata. Dashboards leser DISSE tabellene, aldri rå
-- xapi_statements (bestilling §4).

-- AVLEDET per AU/registrering.
create table completion_state (
  registration uuid primary key references registrations (registration_uuid),
  org_id uuid not null references organizations (id),
  user_id uuid not null references auth.users (id),
  course_version_id uuid not null references course_versions (id),
  au_id uuid not null references assignable_units (id),
  completion text, -- cmi5/xAPI completion: 'true' | 'false' | null — separate from `success`, do not merge
  success text,    -- cmi5/xAPI success: 'true' | 'false' | null
  score numeric,
  satisfied boolean not null default false,
  updated_at timestamptz not null default now()
);

create index completion_state_org_id_idx on completion_state (org_id);
create index completion_state_user_id_idx on completion_state (user_id);
create index completion_state_course_version_id_idx on completion_state (course_version_id);

-- AVLEDET per enrollment/kurs. Diplomer og kursfullføring nøkles HER, ikke på
-- én AU-registrering (bestilling §4/§8). certificate_id's FK to certificates
-- is added once that table exists (next migration).
create table course_completion (
  enrollment_id uuid primary key references enrollments (id),
  org_id uuid not null references organizations (id),
  user_id uuid not null references auth.users (id),
  course_version_id uuid not null references course_versions (id),
  status course_completion_status_type not null default 'not_started',
  satisfied boolean not null default false, -- AND over obligatoriske AU-er; diplom kun når true
  score numeric, -- siste beståtte forsøk (bestilling §4, kontrakt v3 §13)
  completed_at timestamptz,
  certificate_id uuid,
  updated_at timestamptz not null default now()
);

create index course_completion_org_id_idx on course_completion (org_id);
create index course_completion_user_id_idx on course_completion (user_id);
create index course_completion_course_version_id_idx on course_completion (course_version_id);
