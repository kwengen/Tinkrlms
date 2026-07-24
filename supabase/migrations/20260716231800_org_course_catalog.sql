-- Org course catalog (tillegg v2 §5): which courses an org has enabled for
-- self-enrollment, and in what order they're shown. Disabling a course only
-- blocks NEW self-enrollments — it never touches existing enrollments,
-- history, or access (tillegg §5 "viktig regel").
create table org_course_catalog (
  org_id uuid not null references organizations (id),
  course_id uuid not null references courses (id),
  enabled boolean not null default false,
  enabled_by uuid references auth.users (id),
  enabled_at timestamptz,
  disabled_by uuid references auth.users (id),
  disabled_at timestamptz,
  sort_order integer,
  primary key (org_id, course_id)
);

alter table org_course_catalog enable row level security;

-- Same pattern as other org-scoped tables (hoveddokumentet §7): org roles see
-- their own org; a plain bruker only sees enabled=true rows for their org
-- (enforced by a narrower using() clause, not a separate role check —
-- has_org_access already covers superadmin/kundeadmin/org-scoped roles for
-- the write policy; the read policy for ordinary members is intentionally
-- looser (no role check) but gated on enabled=true).
create policy org_course_catalog_select_org_roles on org_course_catalog for select
  using (has_org_access(auth.uid(), org_id));

create policy org_course_catalog_select_enabled_own_org on org_course_catalog for select
  using (enabled = true and has_role_in_org(auth.uid(), 'bruker', org_id));

create policy org_course_catalog_write_org_ansvarlig on org_course_catalog for all
  using (has_role_in_org(auth.uid(), 'org_ansvarlig', org_id))
  with check (has_role_in_org(auth.uid(), 'org_ansvarlig', org_id));

-- kundeadmin is a global role (org_id is null on its own user_roles row —
-- hoveddokumentet §6/§7); its actual org access is via kundeadmin_orgs, which
-- has_org_access() already checks. Combined with has_role() here so this
-- doesn't also grant write to kurs_ansvarlig/bruker, who has_org_access()
-- also returns true for.
create policy org_course_catalog_write_kundeadmin on org_course_catalog for all
  using (has_role(auth.uid(), 'kundeadmin') and has_org_access(auth.uid(), org_id))
  with check (has_role(auth.uid(), 'kundeadmin') and has_org_access(auth.uid(), org_id));

create policy org_course_catalog_write_superadmin on org_course_catalog for all
  using (is_superadmin(auth.uid()))
  with check (is_superadmin(auth.uid()));
