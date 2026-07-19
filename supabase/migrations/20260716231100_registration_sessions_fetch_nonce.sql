-- cmi5's `fetch` URL is single-use (bestilling §5: "Engangs-fetch, kan kun
-- kalles én gang"). A bare JWT can't enforce that on its own (it's replayable
-- until it expires), so the one-time-ness is enforced with server-side state:
-- a random nonce minted at launch time, hashed here, and consumed (cleared)
-- the first time /api/cmi5/fetch-token successfully redeems it.
alter table registration_sessions
  add column fetch_nonce_hash text,
  add column fetch_consumed_at timestamptz;
