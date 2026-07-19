-- Registration/session state transition for a cmi5 launch (bestilling §4,
-- §12 steg 4). Implemented as a single Postgres function (not sequential
-- app-code calls) specifically so the whole thing is one transaction: two
-- concurrent launches for the same enrollment+au must never both "win" and
-- leave two active sessions, or double-supersede incorrectly. `FOR UPDATE`
-- on the active registration row (when one exists) serializes concurrent
-- relaunches/supersede races for that registration.
--
-- Policy encoded here (bestilling §4 "Aktiv-registration- og session-policy"):
--  - Reuse the active registration for enrollment+au if one exists (relaunch
--    of an in-progress attempt); supersede its current session first.
--  - No active registration ⇒ new one. attempt_number continues from the
--    highest attempt_number ever seen for this enrollment+au (so a retake
--    after `satisfied` increments correctly) — 1 if there's no history at all.
--  - Every branch ends with exactly one new `active` registration_sessions
--    row and registrations.current_session_id pointing at it.
--
-- KNOWN GAP: if no registration exists yet at all, two fully concurrent
-- first-launches for the same enrollment+au both pass the "not found"
-- branch and race on the `registrations_one_active_per_enrollment_au`
-- partial unique index — the loser gets a unique-violation error rather
-- than transparently retrying. Rare (near-simultaneous first launch of the
-- same AU by the same enrollment) and fails safely (error, not corruption);
-- an advisory lock keyed on (enrollment_id, au_id) would close this if it
-- ever matters in practice.
create or replace function launch_registration(
  p_enrollment_id uuid,
  p_au_id uuid,
  p_org_id uuid,
  p_user_id uuid,
  p_token_expires_at timestamptz,
  p_launch_mode launch_mode_type default 'Normal'
)
returns table (
  out_registration_id uuid,
  out_registration_uuid uuid,
  out_session_id uuid,
  out_attempt_number integer,
  out_is_new_registration boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration registrations%rowtype;
  v_session_id uuid;
  v_is_new boolean := false;
  v_last_attempt integer;
begin
  select * into v_registration from registrations
    where enrollment_id = p_enrollment_id and au_id = p_au_id and status = 'active'
    for update;

  if not found then
    select max(attempt_number) into v_last_attempt from registrations
      where enrollment_id = p_enrollment_id and au_id = p_au_id;

    insert into registrations (enrollment_id, au_id, org_id, user_id, launch_mode, attempt_number)
    values (p_enrollment_id, p_au_id, p_org_id, p_user_id, p_launch_mode, coalesce(v_last_attempt, 0) + 1)
    returning * into v_registration;
    v_is_new := true;
  else
    if v_registration.current_session_id is not null then
      update registration_sessions
        set status = 'superseded', ended_at = now()
        where registration_sessions.session_id = v_registration.current_session_id
          and status = 'active';
    end if;
  end if;

  insert into registration_sessions (registration_id, org_id, user_id, token_expires_at, status)
  values (v_registration.id, p_org_id, p_user_id, p_token_expires_at, 'active')
  returning registration_sessions.session_id into v_session_id;

  update registrations set current_session_id = v_session_id where id = v_registration.id;

  return query select v_registration.id, v_registration.registration_uuid, v_session_id, v_registration.attempt_number, v_is_new;
end;
$$;
