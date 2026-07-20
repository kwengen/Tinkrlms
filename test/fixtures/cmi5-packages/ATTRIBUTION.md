# Attribution

These cmi5 course packages are vendored from [ADL Project CATAPULT](https://github.com/adlnet/CATAPULT)
(`course_examples/packages/`), © Rustici Software, licensed under Apache License 2.0.
See the upstream repo for the full license text and source HTML/JS.

They are used here as **known-good, conformance-tested cmi5 input** for the LMS's
import/parser/ingest test suite (bestilling §10, point 1) — not authored content.

| File | CATAPULT example | Notable shape |
|---|---|---|
| `single_au_basic_framed.zip` | `single_au_basic_framed` | one `<au>`, no blocks |
| `single_au_basic_responsive.zip` | `single_au_basic_responsive` | one `<au>`, responsive layout |
| `multi_au_framed.zip` | `multi_au_framed` | multiple `<au>` at top level |
| `pre_post_test_framed.zip` | `pre_post_test_framed` | two `<block>`s, three `<au>` each, `<requires>` commented out |
| `masteryscore_framed.zip` | `masteryscore_framed` | `masteryScore` + `passed`/`failed` mastery-score context extension |

Do not hand-edit these zips. If a newer CATAPULT revision changes them, re-run
`scripts/fetch-catapult.sh` and re-copy from `.catapult/course_examples/packages/`.
