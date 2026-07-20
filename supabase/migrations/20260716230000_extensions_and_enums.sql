-- Extensions
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- Enums (bestilling §4/§5/§6)

create type user_role as enum (
  'superadmin',
  'kundeadmin',
  'org_ansvarlig',
  'kurs_ansvarlig',
  'bruker'
);

create type move_on_type as enum (
  'Passed',
  'Completed',
  'CompletedOrPassed',
  'CompletedAndPassed',
  'NotApplicable'
);

-- cmi5 CourseStructure schema's au@launchMethod enum.
create type launch_method_type as enum (
  'AnyWindow',
  'OwnWindow'
);

create type launch_mode_type as enum (
  'Normal',
  'Browse',
  'Review'
);

create type registration_status_type as enum (
  'active',
  'terminated',
  'satisfied',
  'abandoned',
  'superseded'
);

create type session_status_type as enum (
  'active',
  'ended',
  'superseded',
  'expired'
);

-- Not specified verbatim in bestilling §4; own choice for the enrollment
-- lifecycle (distinct from registration/session status, which are cmi5-driven).
create type enrollment_status_type as enum (
  'active',
  'completed',
  'withdrawn'
);

-- Own choice for course_completion.status (course_completion.satisfied is the
-- authoritative diploma gate per bestilling §4/§8; this is a display/reporting
-- convenience alongside it).
create type course_completion_status_type as enum (
  'not_started',
  'in_progress',
  'completed'
);

-- cmi5 result.success / result.completion values (xAPI): 'true' | 'false' | null.
-- Stored as text per bestilling §4 ("Hold completion og success som separate
-- kolonner"); no enum needed since a genuine NULL (unknown/unset) is valid.
