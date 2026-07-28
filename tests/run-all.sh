#!/usr/bin/env bash
#
# Run every suite in one command.
#
#   npx wrangler pages dev . --port 8789 --local     (in another shell)
#   tests/run-all.sh  [baseUrl]
#
# There is no root package.json, so each suite is a standalone node script and
# "test everything" was seven separate commands. This runs them in order,
# cheapest first, and stops at the first failure so the output ends on the
# thing that broke.
#
# Exits 0 only if every suite passed.
set -uo pipefail

BASE="${1:-http://localhost:8789}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

if ! curl -sf -o /dev/null --max-time 10 "$BASE/index.html"; then
  echo "Cannot reach $BASE"
  echo "Start it with:  npx wrangler pages dev . --port 8789 --local"
  exit 1
fi

# valetax-links reads the repo and takes no baseUrl; the rest drive $BASE.
SUITES=(
  "valetax-links.spec.js"
  "site-integrity.spec.js"
  "nav-links.spec.js"
  "user-journey.spec.js"
  "app-banner.spec.js"
  "api-journey.spec.js"
  "valetax-reconcile.spec.js"
  "valetax-admin-ui.spec.js"
)

failed=""
for suite in "${SUITES[@]}"; do
  echo
  echo "=============================================================="
  echo "  $suite"
  echo "=============================================================="
  if [ "$suite" = "valetax-links.spec.js" ]; then
    node "tests/$suite"
  else
    node "tests/$suite" "$BASE"
  fi
  if [ $? -ne 0 ]; then
    failed="$suite"
    break
  fi
done

echo
if [ -n "$failed" ]; then
  echo "FAILED in $failed"
  exit 1
fi
echo "ALL SUITES PASSED"
