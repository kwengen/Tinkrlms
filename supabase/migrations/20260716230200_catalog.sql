-- Sentral kurskatalog (bestilling §4). Kun superadmin skriver (håndheves i RLS, §7).

create table content_packages (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique, -- immutabel per kursversjon (§9c): gammel pakke overskrives ALDRI
  imsmanifest_or_cmi5_parsed jsonb not null,
  -- §9c import-sikkerhet bookkeeping: not in the bestilling's table sketch,
  -- added so the size/count caps and file hashing it requires have somewhere
  -- to live.
  package_sha256 text not null,
  size_bytes bigint not null,
  file_count integer not null,
  imported_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  publisher text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Versjonering er kritisk for compliance-trening; enrollments peker på en versjon.
create table course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id),
  version_label text not null,
  content_package_id uuid not null references content_packages (id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (course_id, version_label)
);

create index course_versions_course_id_idx on course_versions (course_id);

-- Own addition (not in bestilling's §4 table list): cmi5 <block> nesting.
-- Studio emits a flat course->au(s) today (contract §11.A), but CATAPULT's
-- pre_post_test_framed fixture uses two <block>s with three <au> each, and
-- the parser MUST handle it for LTS (bestilling §4). Blocks get LMS-generated
-- ids too, matching the au@id-vs-activity_id split ("Blokk- og kurs-objekter
-- har tilsvarende krav", bestilling §4).
create table course_blocks (
  id uuid primary key default gen_random_uuid(),
  course_version_id uuid not null references course_versions (id),
  parent_block_id uuid references course_blocks (id),
  block_index integer not null,
  publisher_block_id text not null, -- block@id from cmi5.xml, import/reference only
  activity_id text not null unique, -- LMS-generated runtime IRI, same rule as AUs
  title text,
  description text,
  unique (course_version_id, publisher_block_id)
);

create index course_blocks_course_version_id_idx on course_blocks (course_version_id);
create index course_blocks_parent_block_id_idx on course_blocks (parent_block_id);

-- Parset fra cmi5.xml. Parse <au> as a list; Studio emits one today, more later.
create table assignable_units (
  id uuid primary key default gen_random_uuid(),
  course_version_id uuid not null references course_versions (id),
  block_id uuid references course_blocks (id), -- null when <au> is a direct child of <course>
  au_index integer not null,
  publisher_id text not null unique, -- au@id: import/version-pinning ONLY, never runtime activityId
  activity_id text not null unique,  -- LMS-generated runtime IRI (cmi5 §8.1 conformance requirement)
  launch_url text not null,
  move_on move_on_type not null,
  mastery_score numeric(3, 2),
  launch_method launch_method_type not null default 'AnyWindow',
  created_at timestamptz not null default now(),
  constraint mastery_score_range check (mastery_score is null or (mastery_score >= 0 and mastery_score <= 1)),
  constraint mastery_score_omitted_when_not_applicable check (
    move_on <> 'NotApplicable' or mastery_score is null
  ),
  constraint activity_id_not_publisher_id check (activity_id <> publisher_id)
);

create index assignable_units_course_version_id_idx on assignable_units (course_version_id);
create index assignable_units_block_id_idx on assignable_units (block_id);

-- Kundeadmin-tilgang: hvilke kurs en kundeadmin ser (bestilling §4/§6)
create table kundeadmin_courses (
  kundeadmin_user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  primary key (kundeadmin_user_id, course_id)
);

-- Kurs_ansvarlig-tilgang (org-side): hvilke kurs en kurs_ansvarlig ser
-- resultater/fremdrift for, innenfor egen org (bestilling §4/§6).
create table course_responsibles (
  org_id uuid not null references organizations (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (org_id, course_id, user_id)
);

create index course_responsibles_user_id_idx on course_responsibles (user_id);
