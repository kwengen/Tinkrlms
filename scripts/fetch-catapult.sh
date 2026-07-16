#!/usr/bin/env bash
# Clones ADL Project CATAPULT (course_examples, cts, lts, requirements) into
# a gitignored .catapult/ directory. Used to run the LMS Test Suite (LTS)
# against this LMS and to pull additional course_examples fixtures.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -d .catapult/.git ]; then
  echo "Updating existing .catapult checkout..."
  git -C .catapult pull --ff-only
else
  echo "Cloning github.com/adlnet/CATAPULT into .catapult/ ..."
  git clone --depth 1 https://github.com/adlnet/CATAPULT.git .catapult
fi

echo "Done. LMS Test Suite: .catapult/lts (see .catapult/lts/README.md and procedure.md)"
echo "Course examples:      .catapult/course_examples/packages/*.zip"
