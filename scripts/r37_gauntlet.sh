#!/bin/bash
# scripts/r37_gauntlet.sh — run regression suites r23..r37 on FRESH sessions.
# R35/R37 lessons baked in: wipe must complete on-origin BEFORE the final
# navigation (a wipe/nav race contaminates depth/hint assertions); collect
# with Promise.race so a pending suite never trips the CLI's 30s CDP eval
# timeout; strip the CLI's JSON quotes before parsing.
# Usage: bash scripts/r37_gauntlet.sh 23 24 25 ...
PORT=8779
BASE="http://localhost:$PORT"
PASS=0; FAIL=0; declare -a FAILED

run_suite() {
  local N=$1
  echo "=== r$N ==="
  agent-browser open "$BASE/" > /dev/null 2>&1
  sleep 2
  # R37 lesson (cost us a phantom r36-A4 failure): python http.server sends no
  # Cache-Control, so Chrome's heuristic freshness (10% of age-since-
  # Last-Modified) serves HOURS-old shell js from the HTTP cache and never
  # revalidates mid-session. SW reset doesn't help (its fetch(req) hits the
  # same HTTP cache). Force a reload-request for the round's touched assets —
  # this refreshes the HTTP cache entries themselves, so the NEXT navigation
  # gets fresh bytes.
  agent-browser eval "Promise.all(['/js/app.js','/js/drawer.js','/js/settings.js','/js/registry.js','/css/style.css','/index.html','/sw.js'].map(u => fetch(u, {cache:'reload'}).catch(()=>null))).then(() => 'cache-reloaded')" > /dev/null 2>&1
  sleep 1
  agent-browser eval "try{indexedDB.deleteDatabase('strip-db')}catch(e){}; localStorage.clear(); sessionStorage.clear(); 'wiped'" > /dev/null 2>&1
  sleep 1
  agent-browser open "$BASE/" > /dev/null 2>&1
  sleep 4
  agent-browser eval "$(cat qa/r${N}-regression.js); 'injected'" > /dev/null 2>&1
  # poll with an in-page race guard (≤8s per poll, never trips CDP timeout)
  for i in $(seq 1 24); do
    sleep 8
    OUT=$(agent-browser eval "window.__qa${N} ? window.__qa${N}.then(r => JSON.stringify(r.results ? {n: r.results.length, fails: r.results.filter(x => !x.pass)} : {n: (Array.isArray(r)?r.length:0), fails: (Array.isArray(r)?r:[]).filter(x => !x.pass)})) : 'missing'" 2>/dev/null)
    CLEAN=$(echo "$OUT" | sed 's/^"//; s/"$//; s/\\"/"/g')
    # R37 lesson: empty/errored CLI output is NOT a pass — keep polling,
    # and if the window expires report it as a hard failure (no vacuous green)
    if echo "$CLEAN" | rg -q "PENDING|missing"; then continue; fi
    if echo "$CLEAN" | rg -q '"fails":'; then
      echo "r$N -> $CLEAN"
      local NFAIL=$(echo "$CLEAN" | sed 's/.*"fails":\[//' | sed 's/\].*//')
      if [ "$NFAIL" = "" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); FAILED+=("r$N"); fi
      return
    fi
  done
  echo "r$N -> TIMEOUT/NO-RESULT (last output: ${CLEAN:-<empty>})"
  FAIL=$((FAIL+1)); FAILED+=("r$N:timeout")
}

for N in "$@"; do run_suite "$N"; done

echo "==================================="
echo "GAUNTLET: suites green=$FAIL-failed" | sed 's/=0-failed/=0-failed/'
echo "failed: ${FAILED[*]:-none}"
