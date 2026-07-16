-- Uforanderlighet som databasegaranti (bestilling §7). Privileges alene er
-- ikke nok fordi service role omgår dem — triggeren stopper ALLE, inkl.
-- service role. Voiding skjer ved INSERT av en void-statement (xAPI-spesifikt
-- verb), aldri ved UPDATE/DELETE.

create or replace function prevent_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'append-only table: % on % is not permitted', tg_op, tg_table_name;
end;
$$;

create trigger xapi_statements_append_only
  before update or delete on xapi_statements
  for each row execute function prevent_update_delete();

create trigger audit_log_append_only
  before update or delete on audit_log
  for each row execute function prevent_update_delete();
