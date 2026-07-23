-- Certificate issuance (bestilling §8): atomically insert a certificates row,
-- link it to course_completion, and log it — all in one transaction so a
-- concurrent duplicate xAPI statement (retried by the AU, or a second
-- request racing the first) can never issue two certificates for the same
-- enrollment. `select ... for update` locks the course_completion row for
-- the duration of the transaction, so a concurrent caller blocks until the
-- first one commits, then sees certificate_id already set and returns
-- already_issued = true instead of inserting a second row.
create or replace function issue_certificate(
  p_enrollment_id uuid,
  p_cert_uuid uuid,
  p_pdf_storage_path text
)
returns table (certificate_id uuid, already_issued boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row course_completion%rowtype;
  v_cert_id uuid;
begin
  select * into v_row from course_completion where enrollment_id = p_enrollment_id for update;

  if v_row.enrollment_id is null or not v_row.satisfied then
    raise exception 'Enrollment % is not satisfied; cannot issue certificate', p_enrollment_id;
  end if;

  if v_row.certificate_id is not null then
    return query select v_row.certificate_id, true;
    return;
  end if;

  insert into certificates (cert_uuid, user_id, org_id, course_version_id, pdf_storage_path)
  values (p_cert_uuid, v_row.user_id, v_row.org_id, v_row.course_version_id, p_pdf_storage_path)
  returning id into v_cert_id;

  update course_completion set certificate_id = v_cert_id, updated_at = now()
    where enrollment_id = p_enrollment_id;

  insert into audit_log (org_id, actor_user_id, action, target, metadata)
  values (
    v_row.org_id, null, 'certificate_issued', v_cert_id::text,
    jsonb_build_object('enrollment_id', p_enrollment_id, 'course_version_id', v_row.course_version_id)
  );

  return query select v_cert_id, false;
end;
$$;

-- KNOWN GAP (flagging, not guessing a fix): the caller uploads the PDF to
-- Storage BEFORE calling this function (so the row it inserts has a real
-- pdf_storage_path). If two requests race, the loser's already-uploaded PDF
-- is simply orphaned in Storage (harmless — no certificates row ever points
-- at it) rather than cleaned up. Acceptable for v1 given how narrow the race
-- is (requires two concurrent final-statement POSTs for the same
-- registration); a production hardening pass could add a cleanup job.

-- Private bucket (bestilling §8 / SETUP.md §4: "privat by default"), created
-- manually in the Supabase dashboard per SETUP.md. Guarded like the
-- content-packages policy: storage.objects only exists in a real Supabase
-- project, not the local-Postgres harness used to test the rest of this
-- migration set.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute $sql$
      create policy "certificates_read"
      on storage.objects for select
      using (
        bucket_id = 'certificates'
        and exists (
          select 1 from certificates c
          where c.pdf_storage_path = storage.objects.name
            and (
              c.user_id = auth.uid()
              or has_any_role_in_org(auth.uid(), array['org_ansvarlig', 'kurs_ansvarlig']::user_role[], c.org_id)
              or has_org_access(auth.uid(), c.org_id)
              or is_superadmin(auth.uid())
            )
        )
      )
    $sql$;
  end if;
end $$;
