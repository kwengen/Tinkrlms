-- Diplomer og revisjon (bestilling §4/§8)

create table certificates (
  id uuid primary key default gen_random_uuid(),
  cert_uuid uuid not null unique default gen_random_uuid(), -- public verify-URL key
  user_id uuid not null references auth.users (id),
  org_id uuid not null references organizations (id),
  course_version_id uuid not null references course_versions (id),
  pdf_storage_path text not null,
  issued_at timestamptz not null default now(),
  revoked boolean not null default false
);

create index certificates_user_id_idx on certificates (user_id);
create index certificates_org_id_idx on certificates (org_id);

alter table course_completion
  add constraint course_completion_certificate_id_fkey
  foreign key (certificate_id) references certificates (id);

-- Append-only. Logg hvem som fullførte hva og når (lovpålagt opplæring).
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations (id), -- null for platform-level actions
  actor_user_id uuid references auth.users (id),
  action text not null,
  target text not null,
  metadata jsonb,
  at timestamptz not null default now()
);

create index audit_log_org_id_idx on audit_log (org_id);
create index audit_log_actor_user_id_idx on audit_log (actor_user_id);
create index audit_log_at_idx on audit_log (at);
