#!/bin/bash
# scripts/r38_sweep.sh — run the Round 38 per-game runtime smoke sweep on a
# fresh session (cache-reload preamble per the R37 HTTP-cache lesson).
PORT=${PORT:-8777}
BASE="http://localhost:$PORT"
agent-browser open "$BASE/" > /dev/null 2>&1
sleep 2
# R38 lesson (bitten live during verification): the cache-warm must cover the
# GAME FILES too — a stale dicepig.js rendered its R36 codemod debris through a
# "fixed" build and nearly passed as green. Reload every cartridge + shell asset.
GAMELIST=$(ls js/games/*.js | sed 's|^|/|; s|$|,|' | tr -d '\n' | sed 's/,$//')
agent-browser eval "Promise.all(['/js/app.js','/js/drawer.js','/js/settings.js','/js/registry.js','/css/style.css','/index.html','/sw.js','$GAMELIST'].map(u => fetch(u, {cache:'reload'}).catch(()=>null))).then(() => 'cache-reloaded')" > /dev/null 2>&1
sleep 1
agent-browser eval "try{indexedDB.deleteDatabase('strip-db')}catch(e){}; localStorage.clear(); sessionStorage.clear(); 'wiped'" > /dev/null 2>&1
sleep 1
agent-browser open "$BASE/" > /dev/null 2>&1
sleep 4
agent-browser eval "$(cat qa/r38-sweep.js); 'injected'" > /dev/null 2>&1
# poll up to ~8 min (52 games x ~4.5s + boot)
for i in $(seq 1 60); do
  sleep 8
  OUT=$(agent-browser eval "window.__sweep38 ? window.__sweep38.then(r => JSON.stringify({total:r.total, bad:r.games.filter(g=>!g.mounted||g.errs.length).map(g=>({id:g.id, m:g.mounted?1:0, e:g.errs}))})) : 'pending'" 2>/dev/null)
  CLEAN=$(echo "$OUT" | sed 's/^"//; s/"$//; s/\\"/"/g')
  if echo "$CLEAN" | rg -q "pending|missing|PENDING"; then continue; fi
  if echo "$CLEAN" | rg -q '"total":'; then echo "SWEEP: $CLEAN"; exit 0; fi
done
echo "SWEEP TIMEOUT (last: ${CLEAN:-<empty>})"
exit 1
