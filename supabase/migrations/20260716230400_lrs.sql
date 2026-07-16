-- LRS — to lagre med ULIK natur (bestilling §4). Ikke bland dem.

-- UFORANDERLIG, append-only. Voided-status utledes ved oppslag på en
-- void-statement, lagres ALDRI som muterbar kolonne (se append-only-trigger
-- i egen migrasjon og §7-begrunnelsen).
create table xapi_statements (
  statement_id uuid primary key, -- klient-generert (Studio), idempotent nøkkel
  registration uuid not null references registrations (registration_uuid),
  org_id uuid not null references organizations (id),
  actor_account text not null,
  verb_id text not null,
  activity_id text not null,
  statement jsonb not null, -- hele utsagnet i xAPI-form
  statement_hash text not null, -- kanonisk hash for idempotens (§5)
  stored_at timestamptz not null default now()
);

create index xapi_statements_statement_gin_idx on xapi_statements using gin (statement);
create index xapi_statements_registration_idx on xapi_statements (registration);
create index xapi_statements_actor_account_idx on xapi_statements (actor_account);
create index xapi_statements_verb_id_idx on xapi_statements (verb_id);
create index xapi_statements_org_id_idx on xapi_statements (org_id);

-- FORANDERLIG arbeidslager (resume/bookmark). Rommer suspendData og cmi5
-- LMS.LaunchData. state_id is whitelisted at the app layer (§5: only
-- LMS.LaunchData and suspendData are served in v1) with a matching DB check
-- as defense in depth.
create table xapi_state (
  actor_account text not null,
  activity_id text not null,
  registration uuid not null references registrations (registration_uuid),
  state_id text not null,
  document jsonb not null, -- app layer enforces the 64 KB cap (bestilling §5)
  org_id uuid not null references organizations (id),
  updated_at timestamptz not null default now(),
  primary key (actor_account, activity_id, registration, state_id),
  constraint state_id_whitelist check (state_id in ('LMS.LaunchData', 'suspendData'))
);

create index xapi_state_org_id_idx on xapi_state (org_id);
