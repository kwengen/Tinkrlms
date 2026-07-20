-- Player origin must only ever need SUPABASE_ANON_KEY, never the service
-- role (bestilling §11b sikkerhetsregel + §3 architecture) — including for
-- serving course content itself. Course content is published,
-- superadmin-controlled material (not personal data), so a public read
-- policy on just this one bucket is the right trade-off vs. handing player
-- a service-role key or routing every asset request through app-origin.
--
-- Guarded because `storage.objects` only exists in a real Supabase project
-- (Auth/Storage schemas aren't part of this repo's migrations, and aren't
-- present in the local-Postgres harness used to test the rest of this
-- migration set) — this becomes a no-op there instead of failing db push.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute $sql$
      create policy "content_packages_public_read"
      on storage.objects for select
      using (bucket_id = 'content-packages')
    $sql$;
  end if;
end $$;
