-- GDPR basics (bestilling §9), on top of the EU-region + audit_log
-- foundation already in place.
--
-- privacy_notice_ack_at/version: this is a TRANSPARENCY acknowledgment, not
-- an opt-in consent checkbox. This system exists to document completion of
-- employer-mandated training, so the lawful basis for processing is a legal
-- obligation / legitimate interest (GDPR art. 6(1)(c)/(f)), not consent —
-- consent would be legally invalid here anyway (an employee cannot freely
-- refuse mandatory job training, so "consent" wouldn't be freely given).
-- What GDPR actually requires in this situation is that the user has been
-- INFORMED (art. 13/14), which is what this gate enforces.
alter table profiles add column privacy_notice_ack_at timestamptz;
alter table profiles add column privacy_notice_version text;

-- pseudonymized_at: right-to-erasure (art. 17) is limited here by the same
-- legal-obligation basis (art. 17(3)(b)) — an employer must be able to
-- prove Kari completed fire-safety training even after she has left, so
-- training/completion/statement records are deliberately NOT deleted.
-- What CAN and does happen on request: the auth identity is banned and its
-- email replaced with a non-identifying placeholder, and profiles.full_name
-- is cleared — see the issue_certificate-style atomic function below.
-- xapi_statements/completion_state/certificates etc. already key on the
-- user's opaque UUID, never on email/name (bestilling §4), so they were
-- pseudonymous by design from the start; this column just marks the
-- profile itself as scrubbed, so UI pickers (e.g. the enrollment page's
-- user list) can filter these out.
alter table profiles add column pseudonymized_at timestamptz;
