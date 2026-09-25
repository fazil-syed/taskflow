#!/usr/bin/env bash
# Seeds a realistic dataset so the UI has something to show.
# Usage: ./scripts/seed.sh [base-url]
set -euo pipefail

BASE="${1:-http://127.0.0.1:8099}"
API="$BASE/api"

post() { curl -s -X POST "$API/$1" -H 'Content-Type: application/json' -d "${2:-}"; }
# day <n> prints the date n days from today, so `day -9` is nine days ago.
day() { python3 -c "import datetime,sys;print((datetime.date.today()+datetime.timedelta(days=int(sys.argv[1]))).isoformat())" "$1"; }

echo "seeding $API"

PROJECT_A=$(post "projects" '{"name":"Website redesign","description":"Rebuild the marketing site on a new design system.","color":"#6366f1"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
PROJECT_B=$(post "projects" '{"name":"Q3 reporting","description":"Automate the monthly numbers the team keeps retyping.","color":"#10b981"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
PROJECT_C=$(post "projects" '{"name":"Onboarding docs","description":"Everything a new hire needs in week one.","color":"#f59e0b"}' | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
echo "  projects: $PROJECT_A $PROJECT_B $PROJECT_C"

task() { # task <project> <title> <priority> <due-or-empty>
  post "projects/$1/tasks" "{\"title\":\"$2\",\"priority\":\"$3\",\"due_date\":\"$4\"}" |
    python3 -c "import json,sys;print(json.load(sys.stdin)['id'])"
}

# --- to do ---------------------------------------------------------------
T1=$(task "$PROJECT_A" "Design the new navigation" "high" "$(day -12)")
T2=$(task "$PROJECT_A" "Pick a component library" "urgent" "$(day -4)")
T3=$(task "$PROJECT_A" "Write the launch announcement" "normal" "")
T4=$(task "$PROJECT_B" "Model the churn cohort" "high" "$(day -20)")
T5=$(task "$PROJECT_C" "Draft the local setup guide" "normal" "")
T6=$(task "$PROJECT_A" "Audit image payloads" "low" "")

# --- ongoing -------------------------------------------------------------
O1=$(task "$PROJECT_A" "Build the pricing page" "urgent" "$(day -3)")
post "tasks/$O1/start" "{\"start_date\":\"$(day -9)\"}" > /dev/null
for d in 9 8 7 6 4 3 1; do post "tasks/$O1/work-days" "{\"work_date\":\"$(day -$d)\"}" > /dev/null; done

O2=$(task "$PROJECT_B" "Script the revenue export" "normal" "$(day -6)")
post "tasks/$O2/start" "{\"start_date\":\"$(day -5)\"}" > /dev/null
for d in 5 4 2; do post "tasks/$O2/work-days" "{\"work_date\":\"$(day -$d)\"}" > /dev/null; done

O3=$(task "$PROJECT_C" "Record the setup walkthrough" "low" "")
post "tasks/$O3/start" "{\"start_date\":\"$(day -2)\"}" > /dev/null
for d in 2 1; do post "tasks/$O3/work-days" "{\"work_date\":\"$(day -$d)\"}" > /dev/null; done

# --- done (locked) -------------------------------------------------------
D1=$(task "$PROJECT_A" "Set up the CI pipeline" "high" "")
post "tasks/$D1/start" "{\"start_date\":\"$(day -30)\"}" > /dev/null
for d in 30 29 28 27 25; do post "tasks/$D1/work-days" "{\"work_date\":\"$(day -$d)\"}" > /dev/null; done
post "tasks/$D1/complete" > /dev/null

D2=$(task "$PROJECT_B" "Define the metric glossary" "normal" "")
post "tasks/$D2/start" "{\"start_date\":\"$(day -21)\"}" > /dev/null
for d in 21 20 18; do post "tasks/$D2/work-days" "{\"work_date\":\"$(day -$d)\"}" > /dev/null; done
post "tasks/$D2/complete" > /dev/null

echo "  tasks: $T1 $T2 $T3 $T4 $T5 $T6 (todo) $O1 $O2 $O3 (ongoing) $D1 $D2 (done)"
echo "done. open $BASE"
