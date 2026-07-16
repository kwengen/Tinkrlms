-- Tenancy and users (bestilling §4 "Tenancy og brukere")

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Extends auth.users. org_id is NULL for platform staff (superadmin,
-- kundeadmin); org users always have it set. Denormalized convenience only —
-- user_roles is authoritative for org membership and role (see below).
create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid references organizations (id),
  full_name text,
  created_at timestamptz not null default now()
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role user_role not null,
  org_id uuid references organizations (id),
  created_at timestamptz not null default now(),
  unique (user_id, role, org_id),
  constraint org_scoped_role_requires_org check (
    (role in ('superadmin', 'kundeadmin') and org_id is null)
    or (role in ('org_ansvarlig', 'kurs_ansvarlig', 'bruker') and org_id is not null)
  )
);

create index user_roles_user_id_idx on user_roles (user_id);
create index user_roles_org_id_idx on user_roles (org_id);

-- BESLUTNING (bestilling §4): én org per lærling i v1. An org-scoped user
-- (org_ansvarlig / kurs_ansvarlig / bruker) may hold multiple role rows, but
-- all of them must point at the same org_id. A plain unique index can't
-- express "same value across rows for this user", so enforce it with a
-- trigger. Multi-org support later = drop this trigger + stop trusting
-- profiles.org_id in RLS.
create or replace function enforce_single_org_per_user()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is not null and exists (
    select 1 from user_roles
    where user_id = new.user_id
      and org_id is not null
      and org_id <> new.org_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'user % already has org-scoped role(s) in a different organization (one org per org-user in v1)', new.user_id;
  end if;
  return new;
end;
$$;

create trigger user_roles_single_org_per_user
  before insert or update on user_roles
  for each row execute function enforce_single_org_per_user();

-- Kundeadmin-tilgang: subset av orgs OG kurs (bestilling §4/§6)
create table kundeadmin_orgs (
  kundeadmin_user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  primary key (kundeadmin_user_id, org_id)
);
