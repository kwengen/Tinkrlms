-- RLS (bestilling §7) — ikke valgfritt. Autorisasjon i databasen, ikke bare
-- frontend. Skru på RLS på ALLE tenant-scopede tabeller.
--
-- Skriveregel som gjelder flere tabeller under (dokumentert per tabell):
-- xapi_statements, xapi_state, completion_state, course_completion,
-- registrations og registration_sessions skrives av API-rutene via Supabase
-- service role (forbi RLS, bestilling §5 punkt 4/6). Det er derfor bevisst
-- INGEN insert/update/delete-policy for authenticated/anon på disse — service
-- role omgår RLS uansett, og normale roller skal aldri skrive der direkte.
--
-- Viktig implementasjonsdetalj: policies bruker ALDRI en rå
-- `exists (select 1 from user_roles ...)`-subquery direkte — de går via
-- has_role_in_org/has_any_role_in_org/has_role (security definer,
-- 20260716230700_rls_helpers.sql). user_roles har RLS på seg selv, så en
-- rå subquery mot user_roles fra en policy på user_roles selv gir
-- "infinite recursion detected in policy" (verifisert). De security-definer
-- funksjonene kjører som eier (bypasser RLS) og bryter sirkelen.

-- ============================================================ organizations
alter table organizations enable row level security;

create policy organizations_select on organizations for select
  using (has_org_access(auth.uid(), id));

create policy organizations_write_superadmin on organizations for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

-- ================================================================ profiles
alter table profiles enable row level security;

create policy profiles_select_own on profiles for select
  using (user_id = auth.uid());

create policy profiles_select_org on profiles for select
  using (
    org_id is not null
    and has_any_role_in_org(auth.uid(), array['org_ansvarlig', 'kurs_ansvarlig']::user_role[], profiles.org_id)
  );

create policy profiles_select_kundeadmin on profiles for select
  using (org_id is not null and has_org_access(auth.uid(), org_id));

create policy profiles_select_superadmin on profiles for select
  using (is_superadmin(auth.uid()));

create policy profiles_update_own on profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy profiles_write_superadmin on profiles for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

-- =============================================================== user_roles
-- Sensitiv tabell. Leserettigheter følger samme mønster som profiles;
-- skriving er bevisst begrenset til superadmin i RLS — org_ansvarlig sin
-- invitasjons-/rolletildelingsflyt går via en server-rute (service role) som
-- håndhever "kun innenfor egen org" i applikasjonskode, ikke som en generell
-- RLS-insert-policy her (unngår at en org_ansvarlig kan tildele seg selv
-- superadmin ved et RLS-hull).
alter table user_roles enable row level security;

create policy user_roles_select_own on user_roles for select
  using (user_id = auth.uid());

create policy user_roles_select_org on user_roles for select
  using (
    org_id is not null
    and has_any_role_in_org(auth.uid(), array['org_ansvarlig', 'kurs_ansvarlig']::user_role[], user_roles.org_id)
  );

create policy user_roles_select_kundeadmin on user_roles for select
  using (org_id is not null and has_org_access(auth.uid(), org_id));

create policy user_roles_write_superadmin on user_roles for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

-- ====================================================== kundeadmin_orgs/courses
alter table kundeadmin_orgs enable row level security;

create policy kundeadmin_orgs_select_own on kundeadmin_orgs for select
  using (kundeadmin_user_id = auth.uid());

create policy kundeadmin_orgs_write_superadmin on kundeadmin_orgs for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

alter table kundeadmin_courses enable row level security;

create policy kundeadmin_courses_select_own on kundeadmin_courses for select
  using (kundeadmin_user_id = auth.uid());

create policy kundeadmin_courses_write_superadmin on kundeadmin_courses for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

-- ============================================================ course_responsibles
-- "Org-side" konfigurasjon (bestilling §4): org_ansvarlig kan sette dette for
-- egen org; superadmin har full tilgang.
alter table course_responsibles enable row level security;

create policy course_responsibles_select on course_responsibles for select
  using (
    has_org_access(auth.uid(), org_id)
    or user_id = auth.uid()
    or has_any_role_in_org(auth.uid(), array['org_ansvarlig', 'kurs_ansvarlig']::user_role[], course_responsibles.org_id)
  );

create policy course_responsibles_write_org_ansvarlig on course_responsibles for all
  using (has_role_in_org(auth.uid(), 'org_ansvarlig', course_responsibles.org_id))
  with check (has_role_in_org(auth.uid(), 'org_ansvarlig', course_responsibles.org_id));

create policy course_responsibles_write_superadmin on course_responsibles for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

-- ===================================== Kurskatalog: courses, course_versions,
-- content_packages, course_blocks, assignable_units.
-- Lesbar for alle autentiserte; skrivbar KUN for superadmin (bestilling §7).
alter table courses enable row level security;

create policy courses_select_authenticated on courses for select
  using (auth.uid() is not null);

create policy courses_write_superadmin on courses for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

alter table course_versions enable row level security;

create policy course_versions_select_authenticated on course_versions for select
  using (auth.uid() is not null);

create policy course_versions_write_superadmin on course_versions for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

alter table content_packages enable row level security;

create policy content_packages_select_authenticated on content_packages for select
  using (auth.uid() is not null);

create policy content_packages_write_superadmin on content_packages for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

alter table course_blocks enable row level security;

create policy course_blocks_select_authenticated on course_blocks for select
  using (auth.uid() is not null);

create policy course_blocks_write_superadmin on course_blocks for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

alter table assignable_units enable row level security;

create policy assignable_units_select_authenticated on assignable_units for select
  using (auth.uid() is not null);

create policy assignable_units_write_superadmin on assignable_units for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

-- ============================================================== enrollments
alter table enrollments enable row level security;

create policy enrollments_select_own on enrollments for select
  using (user_id = auth.uid());

create policy enrollments_select_org on enrollments for select
  using (
    has_role_in_org(auth.uid(), 'org_ansvarlig', enrollments.org_id)
    or (
      has_role(auth.uid(), 'kurs_ansvarlig')
      and has_course_version_access(auth.uid(), enrollments.course_version_id)
    )
  );

create policy enrollments_select_kundeadmin on enrollments for select
  using (
    has_org_access(auth.uid(), org_id)
    and has_course_version_access(auth.uid(), course_version_id)
  );

create policy enrollments_select_superadmin on enrollments for select
  using (is_superadmin(auth.uid()));

-- org_ansvarlig melder på brukere i egen org (kurstildeling, bestilling §6).
create policy enrollments_write_org_ansvarlig on enrollments for all
  using (has_role_in_org(auth.uid(), 'org_ansvarlig', enrollments.org_id))
  with check (has_role_in_org(auth.uid(), 'org_ansvarlig', enrollments.org_id));

create policy enrollments_write_superadmin on enrollments for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

-- ============================================================ registrations
-- Kun SELECT-policies: skriving skjer via service role i launch-/ingest-rutene.
alter table registrations enable row level security;

create policy registrations_select_own on registrations for select
  using (user_id = auth.uid());

create policy registrations_select_org on registrations for select
  using (
    has_role_in_org(auth.uid(), 'org_ansvarlig', registrations.org_id)
    or (
      has_role(auth.uid(), 'kurs_ansvarlig')
      and exists (
        select 1 from enrollments e
        where e.id = registrations.enrollment_id
          and has_course_version_access(auth.uid(), e.course_version_id)
      )
    )
  );

create policy registrations_select_kundeadmin on registrations for select
  using (
    has_org_access(auth.uid(), org_id)
    and exists (
      select 1 from enrollments e
      where e.id = registrations.enrollment_id
        and has_course_version_access(auth.uid(), e.course_version_id)
    )
  );

create policy registrations_select_superadmin on registrations for select
  using (is_superadmin(auth.uid()));

-- ==================================================== registration_sessions
alter table registration_sessions enable row level security;

create policy registration_sessions_select_own on registration_sessions for select
  using (user_id = auth.uid());

create policy registration_sessions_select_org on registration_sessions for select
  using (has_role_in_org(auth.uid(), 'org_ansvarlig', registration_sessions.org_id));

create policy registration_sessions_select_superadmin on registration_sessions for select
  using (is_superadmin(auth.uid()));

-- ============================================================ xapi_statements
-- Kun SELECT: skriving skjer utelukkende via ingest-endepunktet med service
-- role (bestilling §5 punkt 4), i tillegg til append-only-triggeren i neste
-- migrasjon.
alter table xapi_statements enable row level security;

create policy xapi_statements_select_own on xapi_statements for select
  using (actor_account = auth.uid()::text);

create policy xapi_statements_select_org on xapi_statements for select
  using (has_any_role_in_org(auth.uid(), array['org_ansvarlig', 'kurs_ansvarlig']::user_role[], xapi_statements.org_id));

create policy xapi_statements_select_kundeadmin on xapi_statements for select
  using (has_org_access(auth.uid(), org_id));

create policy xapi_statements_select_superadmin on xapi_statements for select
  using (is_superadmin(auth.uid()));

-- =================================================================== xapi_state
alter table xapi_state enable row level security;

create policy xapi_state_select_own on xapi_state for select
  using (actor_account = auth.uid()::text);

create policy xapi_state_select_org on xapi_state for select
  using (has_any_role_in_org(auth.uid(), array['org_ansvarlig', 'kurs_ansvarlig']::user_role[], xapi_state.org_id));

create policy xapi_state_select_kundeadmin on xapi_state for select
  using (has_org_access(auth.uid(), org_id));

create policy xapi_state_select_superadmin on xapi_state for select
  using (is_superadmin(auth.uid()));

-- ============================================================ completion_state
alter table completion_state enable row level security;

create policy completion_state_select_own on completion_state for select
  using (user_id = auth.uid());

create policy completion_state_select_org on completion_state for select
  using (
    has_role_in_org(auth.uid(), 'org_ansvarlig', completion_state.org_id)
    or (
      has_role(auth.uid(), 'kurs_ansvarlig')
      and has_course_version_access(auth.uid(), completion_state.course_version_id)
    )
  );

create policy completion_state_select_kundeadmin on completion_state for select
  using (
    has_org_access(auth.uid(), org_id)
    and has_course_version_access(auth.uid(), course_version_id)
  );

create policy completion_state_select_superadmin on completion_state for select
  using (is_superadmin(auth.uid()));

-- ============================================================ course_completion
alter table course_completion enable row level security;

create policy course_completion_select_own on course_completion for select
  using (user_id = auth.uid());

create policy course_completion_select_org on course_completion for select
  using (
    has_role_in_org(auth.uid(), 'org_ansvarlig', course_completion.org_id)
    or (
      has_role(auth.uid(), 'kurs_ansvarlig')
      and has_course_version_access(auth.uid(), course_completion.course_version_id)
    )
  );

create policy course_completion_select_kundeadmin on course_completion for select
  using (
    has_org_access(auth.uid(), org_id)
    and has_course_version_access(auth.uid(), course_version_id)
  );

create policy course_completion_select_superadmin on course_completion for select
  using (is_superadmin(auth.uid()));

-- =============================================================== certificates
-- Ingen anon-policy her: den offentlige verifiseringssiden (bestilling §8)
-- går via en server-rute med service role som kun eksponerer de PII-godkjente
-- feltene (§8: fullt navn, kursnavn, dato, status — ikke e-post, ikke org med
-- mindre kunden krever det). Det unngår at en bred "anon kan lese cert_uuid"
-- policy lekker pdf_storage_path/org_id/user_id via vanlige REST-spørringer.
alter table certificates enable row level security;

create policy certificates_select_own on certificates for select
  using (user_id = auth.uid());

create policy certificates_select_org on certificates for select
  using (has_any_role_in_org(auth.uid(), array['org_ansvarlig', 'kurs_ansvarlig']::user_role[], certificates.org_id));

create policy certificates_select_kundeadmin on certificates for select
  using (has_org_access(auth.uid(), org_id));

create policy certificates_select_superadmin on certificates for select
  using (is_superadmin(auth.uid()));

create policy certificates_write_superadmin on certificates for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));

-- =================================================================== audit_log
alter table audit_log enable row level security;

create policy audit_log_select_org on audit_log for select
  using (org_id is not null and has_role_in_org(auth.uid(), 'org_ansvarlig', audit_log.org_id));

create policy audit_log_select_kundeadmin on audit_log for select
  using (org_id is not null and has_org_access(auth.uid(), org_id));

create policy audit_log_select_superadmin on audit_log for select
  using (is_superadmin(auth.uid()));
