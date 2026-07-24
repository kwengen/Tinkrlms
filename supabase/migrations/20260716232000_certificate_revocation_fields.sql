-- Tillegg v2 §8: revoked boolean isn't precise enough to answer "when" and
-- "by whom" a certificate was revoked.
alter table certificates add column revoked_at timestamptz;
alter table certificates add column revoked_by uuid references auth.users (id);
alter table certificates add column revocation_reason text;

update certificates set revoked_at = now() where revoked = true;

alter table certificates drop column revoked;
