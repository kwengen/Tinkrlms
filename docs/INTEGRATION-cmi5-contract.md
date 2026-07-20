# Integration contract — Tinkr Studio (cmi5 producer) ⇄ Tinkrakademiet LMS (consumer)

> **Normative annex: `docs/INTEGRATION-cmi5-contract.md` — Current revision: v4.**
> This is the living normative contract; both sides cite it by this stable path + the
> revision above, **not** a version-suffixed filename. Change log lives in §11–§13.

> Hand this to the team/chat building the Tinkrakademiet LMS. It freezes exactly what
> Tinkr Studio emits and how its AU behaves at runtime, so both sides can build against
> a stable interface. The ONLY coupling between the two systems is the cmi5 package plus
> the cmi5/xAPI launch + LRS behavior described here. The LMS never reads Studio internals
> (`course.json` is private to the player).

## 0. Who does what
- **Tinkr Studio** (authoring) *produces* a cmi5 package (a zip). It contains no LRS and mints no tokens.
- **Tinkrakademiet LMS** *consumes* it: imports the package, parses `cmi5.xml`, hosts the AU on the player origin, mints the scoped launch token, runs the LRS, derives completion.
- Contact surface = this document. Anything not here is an implementation detail either side may change.

## 1. The package Tinkr Studio emits (cmi5 target)
A zip with:
```
cmi5.xml        course structure (course + one AU in v1)
index.html      the AU launch file  (launchMethod = AnyWindow)
player.js       the learner runtime bundle (renders the course, talks to the LRS)
course.json     Studio-internal course data (LMS should ignore it)
assets/…        images/media referenced by the course
```
The **AU launch file is `index.html`**. The LMS launches it in an iframe on the player origin.

## 2. `cmi5.xml` shape the LMS must parse
```xml
<courseStructure xmlns="https://w3id.org/xapi/profiles/cmi5/v1/CourseStructure.xsd">
  <course id="{PUBLISHER_BASE}/course/{courseId}">
    <title><langstring lang="en">…</langstring></title>
    <description><langstring lang="en">…</langstring></description>
  </course>
  <au id="{PUBLISHER_BASE}/course/{courseId}/v/{version}/au/0"
      moveOn="CompletedAndPassed"      <!-- full cmi5 enum, see §5 -->
      masteryScore="0.80"              <!-- = passingScore/100; omitted when moveOn=NotApplicable -->
      launchMethod="AnyWindow">
    <title>…</title><description>…</description>
    <url>index.html</url>
  </au>
</courseStructure>
```
- **`au@id` is the cmi5 `publisher_id`** — used for **import and version-pinning only**. It is **stable and version-namespaced** (re-exporting the same version yields the same id; a new version yields a new id). Key `assignable_units.publisher_id` on it. **Per cmi5 it must NOT be reused as the runtime `activityId`** (see §3) — the LMS generates a distinct runtime IRI and places `au@id` in `contextTemplate.contextActivities.grouping`.
- `PUBLISHER_BASE` is configurable in Studio (`VITE_PUBLISHER_BASE`, default `https://tinkrakademiet.no/xapi`). **Agree this value once** so ids are consistent.
- v1 emits exactly **one `<au>`**. Studio may emit several later (one per top-level page); parse `<au>` as a list, not a singleton.

## 3. Launch — what Studio's AU expects from the LMS
On launch the LMS must open `index.html` with the standard cmi5 query params:
```
endpoint      LRS base URL (trailing slash tolerated)
fetch         one-time URL that returns the auth token
actor         xAPI Agent JSON (account-IFI, opaque id) — echoed verbatim into every statement
registration  registration UUID — echoed verbatim into every statement
activityId    the LMS-generated RUNTIME activity IRI for the AU (cmi5 §8.1: this MUST
              be unique and MUST NOT equal au@id/publisher_id). Studio uses it verbatim
              as the statement Object id and asserts nothing about its value.
```
The AU then:
1. `POST`s to `fetch` → expects JSON `{ "auth-token": "<token>" }`.
2. `GET`s the **`LMS.LaunchData`** State document (see §6) — the LMS **must have written it before launch** (cmi5 requirement). Studio reads `contextTemplate`, `launchMode`, `masteryScore`, `moveOn` from it.
3. Sends statements to `{endpoint}statements` and reads/writes State at `{endpoint}activities/state`.

## 4. xAPI runtime behavior Studio guarantees
- **Auth header:** Studio sends `Authorization: <auth-token>`. If the token has no scheme (no whitespace), Studio prepends `Bearer `. So a bare JWT is sent as `Authorization: Bearer <jwt>`. *(Confirm the LRS accepts this — see checklist.)*
- **Actor & registration:** echoed **verbatim** from the launch params into every statement. Your ingest can safely enforce `statement.actor == token.actor` and `statement.context.registration == token.registration`.
- **Statement id:** every statement carries a **client-generated UUID `id`** → idempotent ingest. Same id + same content ⇒ safe to discard; same id + different content ⇒ 409, as your spec requires.
- **contextTemplate:** merged into **every** statement's `context`. Defined statements keep the cmi5 category activity; *allowed* (`answered`) statements have the cmi5 category stripped (per cmi5).
- **Statement order & set (Normal launch):** `initialized` (first) → `answered` (0..n, batched during play) → per `moveOn`: `passed`/`failed` and/or `completed` → `terminated` (last, with ISO-8601 `result.duration`). Timestamps enforce order.
- **Browse/Review launch:** no `passed`/`failed`/`completed` are sent (moveOn is not satisfied); only `initialized` … `terminated`.
- **Batching & unload:** `answered` statements are buffered and POSTed as a **JSON array** (also auto-flushed once the buffer reaches ~10). The buffer is flushed early on **`visibilitychange` → hidden** (fires sooner and more reliably than `pagehide`, especially on mobile), with **`pagehide` as backup**; `terminated` is sent only on `pagehide`/Finish. All flushes use `fetch(..., { keepalive: true })` and the identical request form. Your `/statements` endpoint must accept an **array** body.
- **Resume:** Studio stores bookmark/answers in the `suspendData` State document and reloads it on next launch.
- **Verbs used:** `initialized, answered, passed, failed, completed, terminated` (ADL verb IRIs).
- **Score:** `result.score.scaled` (0..1), plus `raw` (0..100), `min` 0, `max` 100, on `passed`/`failed`.

## 5. `moveOn` values Studio can emit
`Passed`, `Completed`, `CompletedOrPassed`, `CompletedAndPassed` (default), `NotApplicable`. Your `assignable_units.move_on` enum already matches; store the value from `cmi5.xml` verbatim and let it (plus `masteryScore`) drive `satisfied`.

## 6. `LMS.LaunchData` the LMS must provide
Studio GETs the State doc `stateId=LMS.LaunchData` (scoped by `activityId` + `agent` + `registration`) at init. It should contain at least:
```json
{
  "launchMode": "Normal",              // or "Browse" | "Review"
  "moveOn": "CompletedAndPassed",      // LMS is authoritative at runtime; overrides manifest
  "masteryScore": 0.80,                // 0..1; overrides manifest
  "contextTemplate": { "contextActivities": { "grouping": [ … ], "category": [ … ] }, "extensions": { "https://w3id.org/xapi/cmi5/context/extensions/sessionid": "…" } }
}
```
Studio treats runtime `moveOn`/`masteryScore` from LaunchData as authoritative over the manifest.

## 7. What Studio does NOT do (LMS owns these)
Mint/scope the launch token; run the LRS/ingest; write `LMS.LaunchData`; send `launched`/`satisfied`; derive completion; void/correct statements; enforce CORS. Studio only *consumes* the launch and *emits* statements/State.

## 8. Please confirm on the LMS side (integration risk points)
These are the cheap-to-fix-now, expensive-to-fix-later items:
1. **Auth scheme.** Your spec returns `{ "auth-token": "<jwt>" }` and says the AU adds `Bearer`. Studio does exactly that. **Confirm the ingest validates `Authorization: Bearer <jwt>`** (not a bare token). If you prefer the LRS to return the full header value, say so and Studio will use it verbatim.
2. **`sendBeacon` vs keepalive.** Your §5 says final flush via `navigator.sendBeacon()`. `sendBeacon` **cannot set the `Authorization` header**, so Studio uses `fetch(keepalive:true)` instead. **Confirm your endpoint accepts an authenticated keepalive POST on unload.** (If you require sendBeacon, we'd need a token-in-URL scheme — please advise.)
3. **`LMS.LaunchData` pre-populated before launch**, including `contextTemplate` with the cmi5 category + a `sessionid` extension. Studio depends on GETting it at init.
4. **Array bodies on `/statements`.** Studio batches (`answered`) as a JSON array; terminal statements are also sent as an array. Confirm supported.
5. **Sub-activity ids for interactions.** `answered` statements use object id `{activityId}/interactions/{id}` (allowed statements). Your ingest's actor/registration check should pass; just don't reject non-AU object ids on allowed statements.
6. **Publisher base + versioning.** Agree `PUBLISHER_BASE`. Key `assignable_units.publisher_id` on `au@id`; treat a changed version segment as a new AU/version.
7. **Idempotency contract.** Studio sends client UUID `id`s — aligns with your "same content → discard, different → 409" rule. Confirm.

## 9. Shared quality gate
Both sides use ADL CATAPULT, at opposite ends: the **LMS must pass the LMS Test Suite (LTS)**; **Studio output must pass the Content Test Suite (CTS)**. Recommended joint test: import a CATAPULT `course_examples` package into the LMS *and* run a Studio-exported course through the same LMS, comparing statement/state behavior.

## 10. Note on SCORM
Studio also exports **SCORM 1.2** for *third-party* LMSs (Moodle etc.). That path is irrelevant to Tinkrakademiet, which is cmi5-only. It shares the same player; only the manifest and tracking adapter differ.

## 11. Resolutions (agreed with the LMS team)
The LMS side confirmed §8.1–8.7. Agreed decisions and Studio's answers to their A–E:

- **Auth header (8.1):** LMS will return the **full header value verbatim** — `{"auth-token":"Bearer <jwt>"}`. Preferred (removes client inference). Studio uses the value as-is; its "prepend `Bearer` if scheme-less" normalization stays as a harmless fallback, so either form works.
- **sessionid (their Q on 3):** Confirmed identical by design — `contextTemplate.extensions[...sessionid]` == the token's `session_id`. Studio never derives its own; it propagates whatever is in `contextTemplate` verbatim, so keeping them equal is an LMS-side correlation convenience Studio fully supports.
- **A — future structure:** Predominantly **flat `course → au(s)`**. When Studio splits into multiple AUs (per top-level menu section), nested pages are rendered *inside* an AU by the player, so LMS-visible nesting stays minimal; `<block>` grouping is *possible* later but not planned, `<objectives>` not planned. **`<require>`/prerequisites will never be emitted — cmi5 has no prerequisite element; cross-AU sequencing is intentionally left to the LMS.** (Your parser supporting nesting for LTS is correct regardless.)
- **B — multi-AU course completion:** Studio's intended roll-up is **all AUs `satisfied` ⇒ course complete (AND)**. Studio sends no course-level statement; the LMS owns roll-up. If we ever introduce optional/elective AUs it will be an explicit, communicated change.
- **C — version switch mid-attempt:** **Yes — keep hosting the old version's AU for in-flight registrations.** `au@id` is immutable and version-namespaced; a new version is a new activity, so its State (resume) is separate anyway. Existing registrations must run to `terminated`/`satisfied` on the version they started; new enrollments get the new version. Matches your `course_version` pinning.
- **D — signed statements / attachments:** **Not used** in v1 or the current roadmap. Leave it out.
- **E — CORS preflight on unload:** **Confirmed form-identical.** As of this revision, *every* POST to `{endpoint}statements` (normal and the unload keepalive) goes through one code path — same URL, method `POST`, and headers `Authorization`, `Content-Type: application/json`, `X-Experience-API-Version: 1.0.3`; body is always a JSON array. The only delta is the `keepalive` flag, which is not CORS-relevant. Set `Access-Control-Allow-Headers` to exactly those three. **One residual caveat:** the cached preflight is time-boxed from the session's first POST, so set `Access-Control-Max-Age` to **exceed your longest expected session** — a learner can go idle and then close the tab long after the last statement, and Studio does not re-issue statements just to refresh the cache.

Shared quality gate stands: LMS → CATAPULT **LTS**; Studio output → CATAPULT **CTS**; plus the §9 joint test.

## 12. Corrections & clarifications from the LMS review (cmi5-verified)
The external review of the LMS surfaced one **correction to this contract** and several clarifications. All checked against the cmi5 spec (§8.1, §9.3, §9.6).

- **`activityId` ≠ `au@id` (contract correction).** Earlier revisions said the launch `activityId` equals the AU `publisher_id`. **That is wrong and would fail CATAPULT LTS.** cmi5 §8.1 requires the LMS to generate a **unique runtime `activityId` that MUST NOT match `au@id`/publisher_id**; the publisher id belongs only in `contextTemplate.contextActivities.grouping`. **No Studio code change** — Studio already uses the launch `activityId` verbatim as the statement Object id and never assumes it equals `au@id`. §2/§3 above are corrected. The reviewer's recommended split (runtime `activity_id` distinct from `publisher_id`) is the correct, conformant model.
- **`masteryscore` context extension (Studio code fix, done).** cmi5 §9.3 requires `passed`/`failed` statements made against a mastery score to carry the `https://w3id.org/xapi/cmi5/context/extensions/masteryscore` context extension. Studio now attaches it (value = mastery used, 0..1). Previously missing; CTS would have flagged it.
- **Studio's exact LRS operations (so the LMS can scope the token tightly).** Studio makes only: `POST {endpoint}statements`; `GET` State `stateId=LMS.LaunchData`; `GET`/`PUT` State `stateId=suspendData`. It **never** PUT/DELETEs `LMS.LaunchData`, never voids, never touches other stateIds. So the reviewer's tighter scope (`statements:write`, `state:read` LMS.LaunchData, `state:read+write` suspendData) fits Studio exactly.
- **State concurrency (ETag).** Studio does **not** send `If-Match`/`If-None-Match` on `suspendData` (single writer, last-write-wins). Recommend the LMS **not require ETag concurrency for `suspendData` in v1**; if it does, Studio must add conditional-request handling.
- **Token TTL vs session (extends §11 E).** Studio **cannot refresh** the one-time auth token (cmi5 `fetch` is single-use). If the token expires while the tab is open, the final `terminated` on unload is lost. The LMS **must set token TTL ≥ max session (active + idle)**, and `Access-Control-Max-Age` likewise. This is an LMS/ops constraint, not fixable in Studio.
- **Package hygiene (satisfies LMS import checks).** Studio emits a **relative** launch URL (`index.html`), **local assets only** (no external absolute URLs), and schema-valid `cmi5.xml` (CTS-gated) — so it passes the LMS's XSD validation, MIME allowlist, and "reject external launch URL" import rules.
- **`satisfied` is the LMS's to write.** Confirmed: Studio (the AU) sends `initialized/answered/completed/passed/failed/terminated`; the **LMS** issues `satisfied` when moveOn is met. Studio never sends it. (Matches §7.)

## 13. Round 2 — confirmations & additions (LMS external review)
- **`activityId` ≠ `au@id` — confirmed done (their point 1).** Studio reads `activityId` **verbatim from the launch query param** and uses it as the Object id in all statements, the State API `activityId`, and interaction sub-activity ids. **Nothing in Studio's runtime references `au@id` or assumes equality** (the AU never even sees `cmi5.xml`). So the LMS's model — LMS-generated runtime `activityId`, `au@id`/publisher_id only for import/versioning and in `contextTemplate.grouping` — works unchanged. §3 above is already corrected accordingly.
- **Early flush on `visibilitychange` — added (their point 2).** Since browsers cap the CORS preflight cache (Chromium ~2h, Safari ~5m) regardless of `Access-Control-Max-Age`, "Max-Age > longest session" (v2 §11.E) can't be relied on. Studio now flushes the statement buffer on **`visibilitychange` → hidden** (does not terminate — the tab may return), with `pagehide` as backup for the terminal `terminated`. Request form is unchanged (same single code path as §11.E), so no CORS impact. This supersedes the §11.E Max-Age caveat: the LMS should still set a sane Max-Age, but resilience now comes from earlier flushing plus the LMS deriving completion from `completed`/`passed` + its own `satisfied` (so a lost `terminated` never affects completion).
- **Retakes = new registration (decided).** A retake after passing is a **new cmi5 registration** (per recertification policy). Studio is registration-agnostic — it uses whatever `registration` the launch provides — so each attempt is tracked independently with no Studio change. The LMS owns retake eligibility/recertification cadence.
- **Score model = last passed (decided, LMS roll-up).** Studio reports an honest score on **each** attempt's `passed`/`failed`; the **LMS** decides which attempt counts. Agreed policy: **last passed** score drives the certificate/dashboard. No Studio change.
- **Interactions are an event log, not a snapshot (decided).** `answered` statements are deduped **within a session** (client), but a resume or a new launch may re-emit the same item's `answered` with a new statement id. Treat `answered` as an **append-only event stream**; the "final answer" is the last event (or is implied by the terminal `passed`/`failed` score). If you ever need exactly one `answered` per item per attempt, dedupe LMS-side on `(registration, interaction id)` — Studio does not persist cross-session interaction dedupe in v1.
- **Retry after an unconfirmed flush (relies on your idempotency).** Studio's flush keeps the queue until the POST is confirmed (`res.ok`). If the server stored a batch but the client never got the response, Studio **will resend the same statements — same `id`s, same content — on the next flush / `pagehide`.** This is safe **only because** your ingest treats same `statement_id` + same content as idempotent (discard), per LMS spec §5.4. Please keep that guarantee; it's what makes at-least-once delivery from the AU correct.
