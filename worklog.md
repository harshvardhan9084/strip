# STRIP — Refactor Worklog

Product intent: an endless scrollable strip of tiny, instant, offline-first games (PWA).
No frameworks, no build step, one file per game, saved progress on-device.
Goal of this pass: fix every logical error, remove cartridges that do nothing meaningful,
and keep the strip fast, fun, and consistent.

---

## Round 0 — Full audit (47 cartridges read line-by-line)

### Verdicts

REMOVE (absurd / does nothing sensefully — no goal, no skill, no creative output):
- talktowall — type at a wall, it says nothing. Joke with zero interaction value.
- petrock — pet a rock; nothing you do changes anything (by design, still nothing).
- thebutton — press a button, get a random sentence. No game.
- papercrumple — tap 8 times to crumple a paper, toss it. Mindless tapping.
- bubblewrap — pop 35 bubbles once, then the grid is dead forever (also never restores
  saved popped-state, so its persistence is cosmetic).
- breakglass — tap 5 times, glass shatters. Mindless tapping.
Junk files removed: `css/test`, `js/games/test` (1-byte placeholders).

KEEP (41 cartridges) — bug list compiled from the audit:

CRITICAL (game-breaking):
1. stacktower — moving block spawned OUTSIDE the canvas (x=-w or x=w+), and the wall
   bounce (`x<=0 || x+w>=w`) trapped it there oscillating forever. The block was never
   visibly playable; the next tap measured ~zero overlap and ended the run instantly.
2. snake — placeFood() spins in an infinite do/while when the snake fills the board
   (no win condition) -> tab freeze. Also no win state, duplicate DOM ids.
3. bubbleshoot — (a) popped clusters leave floating bubbles that never fall (no
   floating-cluster removal); (b) rows are never collapsed, grid.length only grows, so
   the game-over line eventually triggers even on a near-empty board; (c) no win state
   when the board is cleared; (d) newly created odd rows were allocated COLS slots
   instead of COLS-1, misaligning the hex grid.
4. plinko — canvas fillStyle set to a CSS variable ("var(--ink-dim)"), which is invalid
   in canvas; the slot score labels rendered in an unintended color.
5. kingdom — reset used Object.assign(state, DEFAULT), copying DEFAULT.assign BY
   REFERENCE; every subsequent assignment mutated the shared DEFAULT object and leaked
   worker assignments across resets.

LOGIC/CORRECTNESS:
6. spinner — RPM readout formula was |v|*0.6 instead of |v|/6 (3.6x too high).
7. tonepad — created its own AudioContext and bypassed Settings.sound (violates the
   app's own house rule: route all audio through Feedback).
8. lightsout — double highscore fetch (await + then) left `best` briefly unconverted,
   so the stat line flickered a raw inverted score.
9. flapdot — gameOver() could fire several times in one frame (multiple pipe hits +
   floor/ceiling), stacking buzzes and redundant saves.
10. sandbox2048 — moved-detection compared grids across rotated coordinate spaces via
    a convoluted re-rotation (verified correct but fragile); no game-over surface
    (board silently freezes); arrow keys also scrolled the strip.
11. thisorthat — hint promised "Swipe left/right" but only tap handlers exist.
12. snake/maze/2048 — arrow keys were not preventDefault'ed, so playing also scrolled
    the page.
13. kingdom/garden/aquarium — shallow Object.assign of DEFAULT could share nested
    object references (plants/fish/assign) with the template.

STRUCTURAL (14 games used document.getElementById with per-card ids like "sn-score"):
Two copies of a card can coexist in the DOM briefly (mount window is ±1 with debounced
prune), so getElementById could grab the stale card's node and update the wrong one.
Fixed by scoping all queries to the card container (container.querySelector).

### Round 0 outcome
Proceeding to Round 1 implementation: delete 6 games + 2 junk files, rewire index.html,
apply all fixes above, update README (47 -> 41), bump SW cache versions, then syntax +
runtime smoke tests before critic scoring.

---

## Round 1 — Implementation + Verification

### Changes shipped
DELETED (6 cartridges + 2 junk files):
- talktowall.js, petrock.js, thebutton.js, papercrumple.js, bubblewrap.js, breakglass.js
- css/test, js/games/test
- index.html rewired: 41 script tags, all verified to match js/games/ 1:1.

CRITICAL FIXES:
- stacktower: block now spawns INSIDE canvas (x=0 or x=w-prev.w) — was trapped
  oscillating at the wall, instant-loss on 2nd tap. VERIFIED in headless browser:
  start -> block visible -> drop -> HEIGHT=1.
- snake: placeFood() now collects free cells (no infinite loop when board fills);
  added win() state; dir/nextDir initialized at mount (keydown handler used to throw
  TypeError: reading '0' when pressing arrows before ever pressing Start — caught by
  the mount sweep); arrows preventDefault'ed; ids scoped. VERIFIED: arrows before
  start = 0 errors, start + steer = 0 errors.
- bubbleshoot: added floating-bubble removal (anchoredSet BFS from ceiling),
  trailing empty-row collapse, win state ("You cleared the board!"), correct odd-row
  width allocation, death line now uses lowest OCCUPIED row, ids scoped.
  VERIFIED: 25 shots -> cluster popped (score 30), 0 errors.
- plinko: canvas slot labels no longer use invalid CSS var fillStyle.
- kingdom: resetState() deep-copies assign (Object.assign used to share
  DEFAULT.assign by reference across resets).
- sandbox2048: move() rewritten — before/after compared in the same coordinate
  space (rotate-back then compare, no fragile double re-rotation); game-over overlay
  surfaced on the board; arrows preventDefault'ed.
- lightsout: single highscore fetch/convert (stat line no longer flickers raw value).
- flapdot: gameOver() guarded against multi-fire per frame.
- spinner: RPM formula fixed (was 3.6x too high).
- tonepad: routed through shared Feedback layer — respects Settings.sound, one
  AudioContext; hint corrected (no "hold to sustain" existed).
- thisorthat: hint no longer promises nonexistent swipe controls.
- garden/aquarium: state plants/fish arrays never shared by reference with template.

STRUCTURAL FIX:
- 18 games' document.getElementById calls scoped to the card container
  (q = sel => container.querySelector(sel)) — duplicate per-card ids across two
  briefly-coexisting copies of a cartridge could update the stale copy.
  (anthill's ah-keyframes head-injection check correctly left document-scoped.)

DOCS/INFRA:
- README updated: 41 cartridges, honest category lists, house rules now state the
  no-no-op-cartridge rule and the container-scoping convention.
- sw.js: cache versions bumped v1 -> v2 so installed clients pick up the changes.

### Verification (headless Chromium via agent-browser)
- Page loads with 0 console errors, 0 page errors.
- 41/41 cards registered; index.html script list == js/games/ exactly.
- Full mount sweep: scrolled through all 41 cards — 0 runtime errors.
- Functional: stacktower stack=1 (was instant-loss), snake full lifecycle,
  2048 48-arrow stress + overlay, bubbleshoot 25-shot pop, XOX AI responds,
  whackmole timer, lightsout 3 moves, memorymatch flip, reaction 2222ms round,
  colorsnap/balloonpop covered by mount sweep + shared fix patterns.
- Note: first-open IndexedDB latency in headless env made some async mounts take
  ~1s; app logic handles it (async mount design) — not a bug.

### Round 1 outcome
Ready for critic scoring.
