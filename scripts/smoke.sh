#!/usr/bin/env bash
# End-to-end smoke test against a running API. Usage: ./scripts/smoke.sh [base-url]
set -euo pipefail

BASE="${1:-http://127.0.0.1:8099}"
API="$BASE/api"
pass=0
fail=0

green() { printf '\033[32m%s\033[0m' "$1"; }
red() { printf '\033[31m%s\033[0m' "$1"; }

ok() {
  printf '  %s %s\n' "$(green ok)" "$1"
  pass=$((pass + 1))
}

no() {
  printf '  %s %s\n' "$(red FAIL)" "$1"
  shift
  for line in "$@"; do printf '       %s\n' "$line"; done
  fail=$((fail + 1))
}

# assert_contains <label> <needle> <haystack>
assert_contains() {
  if [[ "$3" == *"$2"* ]]; then ok "$1"; else no "$1" "expected to contain: $2" "got: ${3:0:200}"; fi
}

# assert_missing <label> <needle> <haystack>
assert_missing() {
  if [[ "$3" != *"$2"* ]]; then ok "$1"; else no "$1" "expected NOT to contain: $2" "got: ${3:0:200}"; fi
}

# assert_eq <label> <expected> <actual>
assert_eq() {
  if [[ "$3" == "$2" ]]; then ok "$1"; else no "$1" "expected: $2" "got:      $3"; fi
}

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
body() { curl -s "$@"; }
jqf() { python3 -c "import json,sys;d=json.load(sys.stdin);print(d$1)"; }

echo "TaskFlow smoke test against $BASE"
echo

echo "health"
assert_contains "healthz returns ok" '"status":"ok"' "$(body "$API/healthz")"

echo
echo "projects"
PROJECT=$(body -X POST "$API/projects" -H 'Content-Type: application/json' \
  -d '{"name":"Website redesign","description":"Marketing site rebuild","color":"#6366f1"}')
assert_contains "create project" '"name":"Website redesign"' "$PROJECT"
PROJECT_ID=$(echo "$PROJECT" | jqf "['id']")
echo "       project id = $PROJECT_ID"

SECOND=$(body -X POST "$API/projects" -H 'Content-Type: application/json' -d '{"name":"Q3 reporting","color":"#10b981"}')
SECOND_ID=$(echo "$SECOND" | jqf "['id']")
body -X POST "$API/projects/$SECOND_ID/tasks" -H 'Content-Type: application/json' \
  -d '{"title":"Draft the summary","priority":"normal"}' > /dev/null

assert_contains "list projects includes it" 'Website redesign' "$(body "$API/projects")"
assert_contains "list projects carries counts" '"task_count"' "$(body "$API/projects")"
assert_eq "rejects a blank project name" 400 "$(code -X POST "$API/projects" -H 'Content-Type: application/json' -d '{"name":"  "}')"

echo
echo "tasks"
T1=$(body -X POST "$API/projects/$PROJECT_ID/tasks" -H 'Content-Type: application/json' \
  -d '{"title":"Design the new nav","description":"Explore three layouts.","priority":"high","due_date":"2026-10-01"}')
T1_ID=$(echo "$T1" | jqf "['id']")
assert_contains "create task lands in todo" '"status":"todo"' "$T1"
assert_contains "task keeps its description" 'Explore three layouts' "$T1"
assert_contains "task keeps its due date" '"due_date":"2026-10-01"' "$T1"

T2=$(body -X POST "$API/projects/$PROJECT_ID/tasks" -H 'Content-Type: application/json' -d '{"title":"Ship the blog","priority":"urgent"}')
T2_ID=$(echo "$T2" | jqf "['id']")
body -X POST "$API/projects/$PROJECT_ID/tasks" -H 'Content-Type: application/json' -d '{"title":"Write copy","priority":"low"}' > /dev/null
body -X POST "$API/projects/$PROJECT_ID/tasks" -H 'Content-Type: application/json' -d '{"title":"Fix a11y bugs","priority":"normal"}' > /dev/null

assert_eq "board reports 4 tasks" 4 "$(body "$API/projects/$PROJECT_ID/board" | python3 -c "
import json,sys
b=json.load(sys.stdin)
print(sum(c['total'] for c in b['columns']))")"
assert_contains "board has a todo column" '"status":"todo"' "$(body "$API/projects/$PROJECT_ID/board")"
assert_contains "board includes work day counts" '"work_day_count"' "$(body "$API/projects/$PROJECT_ID/board")"

echo
echo "filters"
assert_contains "priority filter keeps urgent" 'Ship the blog' "$(body "$API/tasks?priority=urgent")"
assert_missing "priority filter drops others" 'Design the new nav' "$(body "$API/tasks?priority=urgent")"
assert_contains "search matches the title" 'Write copy' "$(body "$API/tasks?q=copy")"
assert_missing "search excludes others" 'Ship the blog' "$(body "$API/tasks?q=copy")"
assert_contains "search covers descriptions" 'Design the new nav' "$(body "$API/tasks?q=layouts")"
assert_contains "status filter works" 'Ship the blog' "$(body "$API/tasks?status=todo")"
assert_missing "status filter excludes done" 'Ship the blog' "$(body "$API/tasks?status=done")"
assert_contains "due filter (none) returns tasks" 'Write copy' "$(body "$API/tasks?due=none")"
assert_missing "due filter (none) drops dated tasks" 'Design the new nav' "$(body "$API/tasks?due=none")"
assert_contains "project filter scopes results" 'Draft the summary' "$(body "$API/tasks?project_id=$SECOND_ID")"
assert_missing "project filter excludes other projects" 'Ship the blog' "$(body "$API/tasks?project_id=$SECOND_ID")"
assert_contains "project filter accepts several ids" 'Ship the blog' \
  "$(body "$API/tasks?project_id=$PROJECT_ID,$SECOND_ID")"
assert_eq "rejects an unknown status" 400 "$(code "$API/tasks?status=nope")"
assert_eq "rejects an unknown priority" 400 "$(code "$API/tasks?priority=nope")"
assert_eq "rejects an unknown due filter" 400 "$(code "$API/tasks?due=nope")"

BOARD_FILTERED=$(body "$API/projects/$PROJECT_ID/board?priority=urgent")
assert_contains "board filter marks itself filtered" '"filtered":true' "$BOARD_FILTERED"
assert_eq "board filter hides the rest" 3 "$(echo "$BOARD_FILTERED" | python3 -c "
import json,sys
b=json.load(sys.stdin)
print(sum(c['hidden'] for c in b['columns']))")"

echo
echo "start and work days"
TODAY=$(date -u +%F)
assert_contains "start moves the task to ongoing" '"status":"ongoing"' \
  "$(body -X POST "$API/tasks/$T1_ID/start" -H 'Content-Type: application/json' -d "{\"start_date\":\"$TODAY\"}")"
assert_contains "start records the start date" "\"start_date\":\"$TODAY\"" \
  "$(body "$API/tasks/$T1_ID")"
assert_contains "log a work day" '"work_day_count":1' \
  "$(body -X POST "$API/tasks/$T1_ID/work-days" -H 'Content-Type: application/json' -d "{\"work_date\":\"$TODAY\"}")"
assert_contains "log a second day" '"work_day_count":2' \
  "$(body -X POST "$API/tasks/$T1_ID/work-days" -H 'Content-Type: application/json' -d '{"work_date":"2026-09-20"}')"
assert_contains "remove a work day" '"work_day_count":1' "$(body -X DELETE "$API/tasks/$T1_ID/work-days/2026-09-20")"
assert_contains "work days list the date" "$TODAY" "$(body "$API/tasks/$T1_ID")"
assert_eq "work day on a todo task is rejected" 400 \
  "$(code -X POST "$API/tasks/$T2_ID/work-days" -H 'Content-Type: application/json' -d "{\"work_date\":\"$TODAY\"}")"
assert_eq "malformed work day is rejected" 400 \
  "$(code -X POST "$API/tasks/$T1_ID/work-days" -H 'Content-Type: application/json' -d '{"work_date":"nope"}')"

echo
echo "reordering and moving"
MOVE_BODY=$(body -X POST "$API/tasks/$T2_ID/move" -H 'Content-Type: application/json' \
  -d "{\"status\":\"ongoing\",\"prev_id\":$T1_ID}")
assert_contains "move between queues" '"status":"ongoing"' "$MOVE_BODY"
assert_contains "moved task lands after its neighbour" "$T2_ID" \
  "$(body "$API/projects/$PROJECT_ID/board" | python3 -c "
import json,sys
b=json.load(sys.stdin)
col=[c for c in b['columns'] if c['status']=='ongoing'][0]
print(' '.join(str(t['id']) for t in col['tasks']))")"
assert_eq "move rejects an unknown status" 400 \
  "$(code -X POST "$API/tasks/$T2_ID/move" -H 'Content-Type: application/json' -d '{"status":"nope"}')"

echo
echo "lock semantics"
assert_contains "complete locks the task" '"locked":true' "$(body -X POST "$API/tasks/$T1_ID/complete")"
assert_contains "complete sets completed_at" '"completed_at":"' "$(body "$API/tasks/$T1_ID")"
assert_eq "edit refused while locked" 423 \
  "$(code -X PATCH "$API/tasks/$T1_ID" -H 'Content-Type: application/json' -d '{"title":"nope","description":"","priority":"low","due_date":""}')"
assert_eq "work day refused while locked" 423 \
  "$(code -X POST "$API/tasks/$T1_ID/work-days" -H 'Content-Type: application/json' -d "{\"work_date\":\"$TODAY\"}")"
assert_eq "start refused while locked" 423 \
  "$(code -X POST "$API/tasks/$T1_ID/start" -H 'Content-Type: application/json' -d '{}')"
assert_eq "delete refused while locked" 423 "$(code -X DELETE "$API/tasks/$T1_ID")"
assert_eq "unlocking is always allowed" 200 "$(code -X POST "$API/tasks/$T1_ID/unlock")"
assert_contains "unlock clears the lock" '"locked":false' "$(body "$API/tasks/$T1_ID")"
assert_eq "edit allowed after unlock" 200 \
  "$(code -X PATCH "$API/tasks/$T1_ID" -H 'Content-Type: application/json' -d '{"title":"Design the new nav v2","description":"Three layouts chosen.","priority":"high","due_date":""}')"
assert_contains "edit was persisted" 'Design the new nav v2' "$(body "$API/tasks/$T1_ID")"
assert_contains "re-lock works" '"locked":true' "$(body -X POST "$API/tasks/$T1_ID/lock")"
assert_eq "forced delete of a locked task" 204 "$(code -X DELETE "$API/tasks/$T1_ID?force=1")"

# log a surviving work day for the calendar assertions below
body -X POST "$API/tasks/$T2_ID/work-days" -H 'Content-Type: application/json' -d "{\"work_date\":\"$TODAY\"}" > /dev/null

echo
echo "calendar"
CAL=$(body "$API/calendar?from=2026-09-01&to=2026-09-30&project_id=$PROJECT_ID")
assert_contains "calendar returns days" '"days"' "$CAL"
assert_contains "calendar counts the logged day" '"logged":1' "$CAL"
assert_contains "calendar names the project" 'Website redesign' "$CAL"
assert_contains "calendar carries the task status" '"status":"ongoing"' "$CAL"
assert_contains "calendar names the task" 'Ship the blog' "$CAL"
assert_contains "calendar exposes due dates too" '"due_tasks"' "$CAL"
assert_contains "calendar totals the union" '"both":' "$CAL"

DUE=$(body -X POST "$API/projects/$PROJECT_ID/tasks" -H 'Content-Type: application/json' \
  -d '{"title":"Due soon","priority":"urgent","due_date":"2026-09-15"}')
DUE_ID=$(echo "$DUE" | jqf "['id']")
CAL_DUE=$(body "$API/calendar?from=2026-09-01&to=2026-09-30&project_id=$PROJECT_ID")
assert_contains "a due date shows up on the calendar" 'Due soon' "$CAL_DUE"
assert_contains "due entries are counted" '"due":1' "$CAL_DUE"
# "Ship the blog" is the task that still has a logged work day at this point.
assert_contains "calendar priority filter works" 'Ship the blog' \
  "$(body "$API/calendar?from=2026-09-01&to=2026-09-30&project_id=$PROJECT_ID&priority=urgent")"
assert_missing "calendar priority filter excludes other priorities" 'Ship the blog' \
  "$(body "$API/calendar?from=2026-09-01&to=2026-09-30&project_id=$PROJECT_ID&priority=low")"
assert_eq "calendar ignores a status filter it does not offer" 200 \
  "$(code "$API/calendar?from=2026-09-01&to=2026-09-30&status=todo")"
body -X DELETE "$API/tasks/$DUE_ID" > /dev/null
# The calendar UI only offers search and priority, but the endpoint still honours
# status and project, which keeps it scriptable.
assert_eq "calendar status filter can empty it" '[]' \
  "$(body "$API/calendar?from=2026-09-01&to=2026-09-30&project_id=$PROJECT_ID&status=done" | python3 -c "
import json,sys
print(json.load(sys.stdin)['days'])")"
assert_contains "calendar tolerates a priority param" '"days"' \
  "$(body "$API/calendar?from=2026-09-01&to=2026-09-30&priority=urgent")"
assert_eq "calendar rejects a bad date" 400 "$(code "$API/calendar?from=nope")"
assert_eq "calendar rejects an oversized range" 400 "$(code "$API/calendar?from=2000-01-01&to=2026-01-01")"

echo
echo "project lifecycle"
assert_contains "update project" 'Q3 reporting v2' \
  "$(body -X PATCH "$API/projects/$SECOND_ID" -H 'Content-Type: application/json' -d '{"name":"Q3 reporting v2","description":"","color":"#10b981"}')"
assert_contains "archive project" '"archived_at":"' \
  "$(body -X POST "$API/projects/$SECOND_ID/archive" -H 'Content-Type: application/json' -d '{"archived":true}')"
assert_missing "archived project hidden by default" 'Q3 reporting v2' "$(body "$API/projects")"
assert_contains "archived project shown on request" 'Q3 reporting v2' "$(body "$API/projects?include_archived=1")"
assert_contains "restore project" '"archived_at":null' \
  "$(body -X POST "$API/projects/$SECOND_ID/archive" -H 'Content-Type: application/json' -d '{"archived":false}')"
assert_eq "delete project" 204 "$(code -X DELETE "$API/projects/$SECOND_ID")"
assert_eq "board 404s after the project is gone" 404 "$(code "$API/projects/$SECOND_ID/board")"
assert_eq "unknown task 404s" 404 "$(code "$API/tasks/99999999")"
assert_eq "invalid id is a 400" 400 "$(code "$API/tasks/abc")"
assert_eq "project delete cascades to tasks" 204 "$(code -X DELETE "$API/projects/$PROJECT_ID")"

echo
echo "frontend"
assert_contains "index.html is served" '<div id="root"' "$(body "$BASE/")"
assert_contains "SPA fallback for /tasks" '<div id="root"' "$(body "$BASE/tasks")"
assert_contains "SPA fallback for a deep route" '<div id="root"' "$(body "$BASE/anything/else")"
assert_eq "unknown api route is a JSON 404" 404 "$(code "$API/nope")"
assert_contains "unknown api route explains itself" 'unknown API route' "$(body "$API/nope")"

echo
if [[ $fail -eq 0 ]]; then
  printf '%s passed, 0 failed\n' "$(green "$pass")"
else
  printf '%s passed, %s failed\n' "$(green "$pass")" "$(red "$fail")"
  exit 1
fi
