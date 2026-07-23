-- Guards an assumption the launch route already makes (.maybeSingle() when
-- looking up "the" active enrollment for a user+course_version): without
-- this, the new org-enrollment UI (or a double form submit) could create two
-- active enrollments for the same user+course_version, and the launch route
-- would then error on a query that expects at most one row.
create unique index enrollments_user_course_version_active_uidx
  on enrollments (user_id, course_version_id)
  where status = 'active';
