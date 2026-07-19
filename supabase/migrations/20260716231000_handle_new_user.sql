-- Auth (bestilling §12 steg 2): hver ny auth.users-rad får automatisk en
-- profiles-rad. org_id/rolle settes IKKE her — det skjer i invite-flyten
-- (server-rute med service role), siden v1 er invite-only (org_ansvarlig/
-- superadmin oppretter brukere; ingen selvregistrering uten org — se
-- migrasjonskommentar i user_roles om "én org per lærling").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
