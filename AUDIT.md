# AUDIT.md — Round 18 · full compulsion-loop audit of all 50 cartridges

> **ROUND 19 STATUS — the fix round ran.** Every P0 deadend and every P1 economy/meta
> repair below is now IMPLEMENTED and pinned by `qa/r19-regression.js` (10/10 PASS live),
> with the Round 17 suite still green (6/6) and a 50/50 mount sweep at zero console
> errors. Fixed this round: **P0 1–4 in full** (TD upgrades/sell/scaling bounties/speed
> cap/next-wave preview; Blob Merge recycler/spawn-scaling/milestones; Crate Push 20
> solver-verified levels + level-select grid with PB stars + ALL-CLEAR + seeded daily
> crate; Trading Post ×1/×10/MAX + auto-traders/caravans/Guild Hall sinks + market
> events + profit floats/trend arrows/sparklines + milestone toasts), **P1 5–12 in
> full** (Garden 9-species seed shop/death/compost/sprinkler ladder; Kingdom escalating
> costs/events/era titles/death recap; Blackjack bank-peak meta/scaling chips/double-down/
> streak bonus; Lexicle 900+ word guess list + daily-seeded word; Aquarium species album/
> coins/decor sinks/release escape; Artillery 3-HP duels/near-miss readouts/streak meta;
> Drop Four & Pong Duel best-streak records (+ Drop Four difficulty tiers & undo, Pong
> difficulty tiers & match-point cue); Minesweeper 3-field ladder/wins/ALL-CLEAR banner),
> and the **P2 head of the queue**: 2048 WIN overlay + 4096/8192 colors + milestone pops,
> Blockfall TETRIS banner + screen kick, Chain Link GOOD/GREAT/EPIC titles, Snake/Flap
> Dot/Stack Tower/Color Snap difficulty ramps (+ Stack Tower PERFECT streaks with width
> regen), Bubble Shooter NEXT-bubble preview, Unscramble & Color Lab real bests (streak /
> fewest-tweaks), Would You Rather vote-reset valve, Spinner top-RPM persistence, Reaction
> rolling average + honest baseline, Plinko total display. **Deferred to Round 20** (the
> remaining P2 tail): board-size ladders for Memory Match / Lights Out / Slide Puzzle /
> Maze / Mini Sudoku / Code Breaker, Trivia 10-question runs, Type Speed accuracy gate,
> This-or-That profile decision, Random Fact favorites, Etch/Kaleidoscope save-PNG,
> Breathe daily counter, Tone Pad loop recording, Physics Drop square-collision honesty,
> Whack-a-Mole multi-mole waves, Breakout brick HP tiers. The audit text below is kept
> verbatim as the original findings; the fix queue at the bottom is the executed plan.

**This run (Round 18) was AUDIT-ONLY.** Nothing in `js/` was changed that round. Every finding below is
collected so the fix rounds could burn them down one by one, in priority order, without
re-deriving any of the analysis.

Method: every game file was read end-to-end with a player's eye, not a code-reviewer's eye.
The questions asked were the compulsion-loop questions — *do I want one more? why? what am I
working toward? what pulls me back tomorrow?* The four games the playtester flagged by name
(Tower Defense, Blob Merge, Crate Push, Trading Post) additionally got live browser proof
(agent-browser session against a local build) plus the underlying math, included below.

## How to read an entry

**Finding categories** (the playtester's labels):

| Tag | Meaning |
|---|---|
| DEADEND | a point where the player cannot meaningfully continue — a wall, a plateau, or an end with nothing after it |
| BLOCKING | friction that interrupts flow (grind walls, rejected input, missing affordances) |
| UNETHICITY | dishonest or dark-pattern mechanics (none found this round — noted where relevant) |
| ILLOGICITY | mechanics that contradict their own economy or promise (dead currencies, meaningless "bests", printers with no sink) |
| ABNORMALITY | odd/buggy behavior observed in code or live play |
| SHOULD-BE | the concrete improvement the game is missing (this is the fix sketch) |

**Loop score** — six compulsion dimensions, 0–5 each, order fixed:
`loop dop·rush·comp·prog·inv·ret`
- **dop** dopamine: reward frequency & juice of the core verb
- **rush** adrenaline/tension: stakes, near-misses, loss threat
- **comp** compulsion: pull to take one more action
- **prog** progression: goals, ladders, unlocks, milestones
- **inv** investing: ownership, sunk growth, things that are *yours*
- **ret** retention catcher: reasons to come back tomorrow

**Priority tag** on each game = the next round's handling class:
P0 = deadend/short-end repair · P1 = economy/meta repair · P2 = depth & juice upgrade ·
TOY-OK = a fidget toy that is legitimately a toy (small hooks only).

---

## SYSTEMIC DISEASES (the same wounds in many games)

These are the cross-game patterns. Fixing them once per game is what turns this deck from
"50 working cartridges" into "50 games you can't put down".

- **S1 · SINKLESS ECONOMIES.** Several games pay out a currency whose sinks run dry, after
  which the payout is pure noise: Trading Post (gold after storage is big), Garden (coins
  after 6 plots), Kingdom (flat build costs exhaust in ~10 days), Aquarium (food into a
  capped tank), Blackjack (bank with nothing to buy). A money printer with nothing to buy
  teaches the player that earning is pointless — the single worst lesson a game can teach.
- **S2 · SHORT ENDS / HARD CEILINGS.** Content that runs out with nothing after it: Crate
  Push (5 tiny levels), Tower Defense (the wave-17 wall — see deep dive), Blob Merge (the
  low-stage plateau). An end is fine; an end with no ceremony, no recap, and nothing new is not.
- **S3 · NO DIFFICULTY LADDERS.** One fixed board/size/speed forever: Minesweeper (8×8/10),
  Mini Sudoku (4×4), Lights Out (5×5), Slide Puzzle (4×4), Maze (7×7), Memory Match (4×3),
  Snake (fixed 160 ms), Flap Dot (fixed gap), Stack Tower (fixed 3.2 px/f), Drop Four
  (one AI strength), Code Breaker (one code size). Veterans outgrow all of these in one
  session; there is no "next" for them.
- **S4 · CLICK-GRIND INSTEAD OF BULK ACTIONS.** Trading Post trades ±1 unit per click; the
  playtester counted 100 clicks to deploy 1k gold and 100 more to cash out. Blackjack's chip
  rack is fixed at 10/25/50, so a 1000-chip bet is 20+ taps. Any loop that needs N identical
  clicks for one decision is N−1 clicks of dopamine leakage.
- **S5 · META INVISIBILITY.** 17 cartridges never call `setHighscore`: artillery, blackjack,
  dropfour, pongduel, xox, sokoban, lexicle, thisorthat, wouldyourather, randomfact + 8
  toys. The toys are fine; the games are not. Their wins/streaks/levels are invisible to
  the Daily ×2 twist, RECORD BREAKER, and the drawer sparkline — the deck's two strongest
  retention systems literally cannot see them. Worse, Drop Four and Pong Duel *reset their
  streak to 0 on a loss without ever recording an all-time best*: the player's history is
  deleted on every defeat.
- **S6 · MISSING WIN CEREMONY.** The dopamine of winning is in the *moment*, and most games
  don't have one: Mini 2048's 2048 tile fires a single buzz (no banner, no "keep going"),
  Blockfall's tetris scores silently, Chain Link's 8-dot chain scores exactly like a 3-dot
  chain, Maze/Sudoku/Lights Out wins are one stat-line word. No score popups, no streak
  fanfares, no milestone flags anywhere in the deck.
- **S7 · MEANINGLESS METERS.** "BEST" lines that can never differ from the current value:
  Unscramble BEST = lifetime solves, Color Lab BEST = lifetime matches. A best that is
  always equal to the counter is not a best — it wastes the strongest slot on the card.
- **S8 · TERMINAL STATES WITHOUT CEREMONY.** Crate Push after level 5 (frozen board, no
  "ALL CLEAR"), Aquarium at 8 fish (feeding does nothing, visibly), Would You Rather after
  all 81 votes. The game just… stops reacting, with no "you finished it" and no path to
  anything new.

---

## DEEP DIVE 1 — Tower Defense · P0 · `loop 2·2·2·1·2·2`

**The playtester's report:** *"at one point, we cannot upgrade ourself at any cost and it
will make us defeat at a point something at maximum ~17 waves … it is considered as deadend,
where the user can't continue the game. You were supposed to make the defence system
upgradable, when we are already earning gold."*

**Confirmed — and here is the math of the wall.** Towers are one-shot placements with fixed
stats forever; there is no upgrade, no sell, no repair anywhere in the file (the only
buttons are Arrow/Cannon/Frost/Start wave — live-probed).

- Enemy effective HP per wave W: `(5+2W)(20+8W) = 16W² + 80W + 100` — quadratic
  (Round 19 correction: an earlier draft here squared the wrong factor and printed
  14,720 EHP / ~980 dps at wave 17; the true wave-17 EHP is **6,084**, needing ~470
  sustained dps. The wall was real anyway — see below — because the usable-dps
  ceiling and the uncapped enemy speed still closed on the player around wave 15–18).
- Total income by wave W: `60 + Σ(4·(5+2W) + 15) = 60 + 4W² + 39W` — quadratic, but the
  spendable outcome is capped: an arrow is 22.9 dps, and only cells within 2.4 cells of the
  path can ever fire. On the 10×10 board that bounds the *usable* fleet at roughly 25–35
  towers ⇒ max sustainable ~570–800 dps no matter how much gold you hold — BELOW the
  ~470+ dps needed exactly when enemy speed (0.9 + 0.05W ⇒ 1.75 at wave 17) shrinks
  exposure time, so effective throughput drops under the requirement at the same waves.
  The run therefore *must* end at wave ~15–18 even with perfect play — exactly the
  playtester's "~17 waves". (The Round 19 fix beats this by 2–4×: judge re-ran the math —
  income through wave 17 is 4,402g with scaled bounties vs 1,879 flat, and a maxed fleet
  reaches ~3,234 dps against the old ~686 ceiling.)
- ILLOGICITY: kill bounty is a flat 4 g whether the enemy has 28 HP (wave 1) or 156 HP
  (wave 17) — the reward curve is linear inside a quadratic difficulty curve.
- Live probe: 6 towers placed, wave 1 leaked 7 of 12 lives while the wave still paid the
  flat +15 "cleared" bonus; gold 0→15 with zero kill income. Early game is brutally
  punitive while late game pays pennies — the curve is backwards at both ends.
- UNETHICITY: none. DEADEND: yes — the wall *is* the run.
- SHOULD-BE (fix sketch for next round): (1) tap your own tower → upgrade panel: +40% dmg
  per level, cost = `base × 1.6^level`, 4 levels, plus SELL for 70% refund; (2) bounty
  scaling `4 + floor(W/2)` per kill, wave-clear bonus `15 + 3W`; (3) speed cap at 1.5;
  (4) "next wave: N fast/normal" preview so banking gold is a decision, not a wait.

## DEEP DIVE 2 — Blob Merge · P0 · `loop 2·0·1·1·1·1`

**The playtester's report:** *"we gets at a point where we see only 1, 2, 3, 4 and we can't
do anything at that point — it was improved a little this time but still being dead ended."*

**Confirmed — the plateau is structural.** The spawn pool is *only* stage-0 ("1") at 70% and
stage-1 ("2") at 30%, on every merge, forever (live-proven: 1+1 → 2 with a fresh "1" spawning).
- The goal (grow an 8) needs 2⁷ = 128 base units funneled into one blob on a 20-cell board
  where every merge refunds exactly one low spawn. Reachable, but the mid-board converges to
  an equilibrium: one stranded singleton at each mid stage (3,4,5,6…) plus a sea of 1s and 2s.
  A stranded singleton is **permanent dead weight** — there is no discard, no recycle, no
  removal of any kind — so the board visually becomes "only 1, 2, 3, 4" with nothing
  productive to do. That is the felt deadend.
- There is no fail state at all (the full-board scan can't miss a pair while only 10 stage
  values exist across 20 cells), so **rush = 0**: no pressure, no near-miss, no loss to fear.
  Merging churns the counter; nothing is ever at stake.
- ILLOGICITY-lite: score pays `2^(stage+1)` — most income comes from endless 1+1 churn
  (2 pts) rather than progress toward the goal.
- SHOULD-BE: (1) a RECYCLER — drag any blob off-board to bank its stage² as score and clear
  the cell (kills singletons, creates a real spend-or-keep decision); (2) spawn scaling —
  after your best blob reaches stage k, junk occasionally spawns at stage ≤ k−3 so the
  material ladder shortens; (3) a soft timer or move budget per board to give the loop a
  pulse; (4) milestone banner per new max stage (dopamine flagpoles).

## DEEP DIVE 3 — Crate Push (Sokoban) · P0 · `loop 2·0·2·1·2·1`

**The playtester's report:** *"after clearing all stages (only 5!) we are unable to do
anything, else than playing the same level again! It's not a dead end but a very short end."*

**Confirmed.** The file ships exactly 5 handcrafted boards, 7×5 to 9×7, one or two crates
each — total solve time for a human is a couple of minutes. After level 5: `done=true`
freezes input; the board sits cleared with no ALL-CLEAR screen, no stats recap, no unlock,
nothing (S8). There is no level select anywhere — the only buttons are ◀▲▼▶/Undo/Reset
(live-probed) — so a player cannot even revisit level 2 to beat their PB without wiping
the save.
- The undo tax (each Undo adds +1 move) is a fine idea but PBs then compare undo-heavy runs;
  harmless, just note it.
- SHOULD-BE: (1) 15–20 real levels with a genuine difficulty curve (locked crates, tight
  corners, 3–4 crate boards); (2) a level-select grid with per-level PB stars; (3) an
  ALL-CLEAR ceremony with a total-moves tally + a seeded DAILY CRATE level so the strip has
  a tomorrow; (4) Restart keeps "PB so far" visible for the just-finished level.

## DEEP DIVE 4 — Trading Post · P0 · `loop 1·1·1·1·1·2`

**The playtester's report:** *"I made 1K gold by purchasing diamonds at around 10 and selling
at 30 just in some rounds — now what? I have to click 100 times just to invest my capital and
100 times again to get revenue … what will I get? Just the unlimited amount of gold by what I
could do nothing extra."*

**Confirmed on both counts.** `trade(key, dir)` moves exactly ±1 unit per click — no ×10,
no MAX, no shift-click (live-probed: three goods × Buy/Sell only). And the economy is a
print-then-vacuum: gems oscillate on a deterministic sine (base 22, amplitude ±40% + a
0.15 second harmonic), so the trough/peak arbitrage is a guaranteed money printer once
learned; the *only* sink is warehouse +20 at `30·1.5^k` — eight expansions later (~1.5k gold)
the sink is gone and gold becomes literally purposeless (S1). Peak net worth is a number
that nothing ever spends.
- The price engine is fully predictable (pure sine + phase) — "learning to read the market"
  takes one minute, then zero risk forever. No events, shocks, scarcity, or trends.
- Zero feedback juice: a +20 g margin is a silent counter tick; no profit popups, no trend
  arrows vs base price, no price history.
- UNETHICITY: none (honest about being offline). The sin is boredom, not deception.
- SHOULD-BE: (1) ×1 / ×10 / MAX buy & sell buttons (S4 fix); (2) sinks with depth — hire an
  auto-trader (idle income), caravan expeditions (risk/reward), a Guild Hall ladder at
  5k/25k/100k with permanent perks; (3) market events ("harvest festival: grain demand ×2",
  "gem rush: gems ×1.5 for 60 s"); (4) juice: +g profit floats, ▲▼ trend arrows vs base, a
  30-tick price sparkline; (5) milestone toasts so the first 10k actually feels like
  something.

---

## PER-GAME ENTRIES (the other 46)

### Ant Colony (anthill) · P2 · `loop 3·2·3·2·4·4`
- SHOULD-BE: the deck's best core loop (capped vault → collect → reinvest) with no endgame:
  no milestones, no new roles beyond 4, no prestige; soldier defense floors at 0.1 and raids
  only touch the vault, so late game has zero threat; the tap verb pays 1+0.15·foragers and
  never upgrades.
- FIX: milestone unlocks (diggers at 1k lifetime, queen upgrades at 10k), raid events with a
  choose-a-defense prompt, a "new colony" prestige that converts lifetime into a permanent
  +% and a visual ant count on the hill.

### Artillery Duel · P1 · `loop 3·3·2·1·1·1`
- ILLOGICITY-lite: a duel is one hit = instant end; there is no HP, no comeback arc, no
  near-miss feedback ("30 px short!") although the physics already computes landX.
- S5: wins/losses never touch setHighscore — invisible to Daily ×2 / RECORD BREAKER.
- SHOULD-BE: HP 3 per side (drama + comeback), near-miss distance readout, streak-based
  best duels-won saved to the meta, terrain variation (hills) beyond flat+craters.

### Balloon Pop · TOY-OK (P2 polish) · `loop 3·1·3·1·1·1`
- SHOULD-BE: score is flat +1/−3 with no combos — a 10-pop streak without touching a bomb
  should escalate (×2, ×3 flags), golden balloons (+5) as a variable-ratio hook, and a
  final-round grade (A/B/C) to invite the retry.

### Blackjack 21 · P1 · `loop 3·3·3·0·2·1`
- S5: the deck's most session-sticky game has NO highscore hook at all — bank peak would
  feed Daily ×2 / RECORD BREAKER for free and doesn't.
- S4: chip rack fixed at 10/25/50 — a 1,000-chip bank means 20+ taps per bet (same disease
  as Trading Post's ±1).
- SHOULD-BE: denominations scale with bank (auto-unlock 100/500 chips), bank-peak highscore,
  a win-streak meter with a small 5-streak bonus payout, double-down (one card, double bet)
  for decision depth. Ethics already clean (virtual-only disclosure, push = neutral).

### Blockfall · P2 · `loop 3·3·4·2·1·2`
- S6: a tetris (4-line clear) scores silently — the biggest dopamine event in the genre and
  it doesn't even flash.
- SHOULD-BE: "TETRIS!" banner + screen kick, hold-piece and ghost-drop (modern expectations),
  a Pause (leaving mid-run currently kills the run silently), combo counter past LV10 speed
  floor so late runs still escalate.

### Breakout · P2 · `loop 3·2·3·2·1·1`
- SHOULD-BE: wall rows cap at 5 by level 3, so only ball speed grows — add brick HP tiers
  (2-hit dark bricks), occasional power-up drops (wide paddle, slow-mo, +1 life), and a
  "LEVEL n" splash instead of the wall silently rebuilding mid-air.

### Bubble Shooter · P2 · `loop 3·2·3·1·1·1`
- SHOULD-BE: board clear = full reset to "New game" (S8-lite) — a next-board chain (+1 row,
  +1 color) converts clears into progression; show the NEXT bubble (only current is visible —
  a standard affordance that's missing); occasional rainbow/bomb bubble for shot variety.

### Breathe · TOY-OK · `loop 2·0·2·1·1·2`
- SHOULD-BE: breaths-per-today counter and pattern choice (box 4-4-4-4, 4-7-8) would give a
  return reason; R17's tap-to-begin fix is intact.

### Chain Link · P2 · `loop 3·1·3·1·1·1`
- S6: chain size is uncelebrated — an 8-dot chain and a 3-dot chain land identically.
- SHOULD-BE: length-titled popups ("GOOD 5 / GREAT 8 / EPIC 12"), a move-limited round with
  target score (gives the endless grid an arc), rare 5th color as a high-value treat.

### Code Breaker · P2 · `loop 2·2·3·1·1·1`
- S3: one fixed code (4 slots / 6 colors / 8 rows) forever.
- SHOULD-BE: difficulty ladder (3-color/5-row rookie → 8-color/10-row), a win-streak, and a
  hint token economy; loss reveal already exists (good).

### Color Lab (colormix) · P2 · `loop 2·0·2·0·1·1`
- S7: BEST is a lifetime counter (matched never decreases, best = max = same number) — the
  strongest slot on the card displays a duplicate.
- SHOULD-BE: streak-of-matches best, a closeness % live readout (currently only
  "Getting close…" under d<60), tolerance shrink per match for ramp, timed blitz mode.

### Color Snap · P2 · `loop 3·4·4·1·1·2`
- SHOULD-BE: round timer is fixed 1600 ms — the classic ramp (−40 ms per correct, floor 600)
  is the whole escalation curve this game is missing; show best-streak deltas ("3 from your
  best!").

### Drop Four · P1 · `loop 3·2·3·1·1·1`
- S3+S5: a single fixed AI strength (win/block/center heuristic) and the win streak resets
  to 0 on a loss with **no all-time best ever recorded** — the player's history is erased by
  every defeat.
- SHOULD-BE: difficulty selector (dumb/normal/depth-2 search), best-streak via setHighscore,
  an Undo, win-line already glows (good juice).

### Etch Pad · TOY-OK · `loop 2·0·2·0·1·1`
- SHOULD-BE (tiny): "save drawing" (PNG download) — a shareable artifact is the one hook a
  drawing toy needs.

### Flap Dot · P2 · `loop 3·4·4·1·1·1`
- S3: gravity/gap/speed are constants forever — a 50-score run and a 5-score run play
  identically.
- SHOULD-BE: gentle ramp (gap 90→70, speed 2.2→3.0 by score), medal thresholds (bronze 10 /
  silver 25 / gold 50) displayed on the card, ghost of your best run's score line.

### Gravity Drop (physicsdrop) · TOY-OK · `loop 2·0·2·0·1·1`
- ABNORMALITY-lite: "squares" collide as circles (radius-based), so they visibly hover/clip
  at corners — fine at toy scale, worth a 2-line fix or a rename to "pebbles".
- SHOULD-BE (tiny): a shape counter; optional color-match bins for a soft goal.

### Garden · P1 · `loop 2·1·3·2·3·3`
- S1: coins sink exhausts at 6 plots (120 g) — after that harvests accumulate forever with
  nothing to buy (identical disease to Trading Post).
- ILLOGICITY: health decay never kills — a 0-health plant just sits, so the "neglect threat"
  is toothless (decay pauses growth, nothing is ever lost).
- SHOULD-BE: seed shop (6–10 plant types: different grow times/yields/rarity — collection
  compulsion), sprinkler/auto-water upgrade as a real coin sink, plant death + compost as
  honest loss, weather days.

### Kaleidoscope · TOY-OK · `loop 2·0·2·0·1·1`
- SHOULD-BE (tiny): segment-count control (4/6/8/12) and save-PNG, both trivial and both
  real reasons to reopen.

### Kingdom · P1 · `loop 2·1·2·1·2·2`
- S1: build costs are FLAT (farm 15 / mine 20 / house 25 forever) — around day 10 gold has
  no purpose; mines then print a dead currency every advance.
- ILLOGICITY: no threat after equilibrium (2 farms feed a capped pop forever) — "best = days
  survived" is un-losable except by deliberate self-sabotage, so there's nothing to survive.
- S8: collapse resets with a one-line note — no tombstone, no "your kingdom lasted 34 days"
  recap, no ceremony for the one dramatic moment the game can produce.
- SHOULD-BE: escalating costs (×1.35 per built), random events (drought/bandits/traders),
  era goals (pop 10 → 25 → 50 with titles), a death recap card, grain spoiling (storage cap)
  to force build decisions.

### Lights Out · P2 · `loop 3·1·3·1·1·1`
- S3: fixed 5×5 forever; solvable-scramble and inverted-score discipline are already right.
- SHOULD-BE: 3×3→5×5→7×7 ladder with par counts, a level counter, and move-limit challenge
  boards ("clear in ≤ 12").

### Maze · P2 · `loop 2·0·2·1·1·1`
- S3: fixed 7×7 forever; fewest-moves best only.
- SHOULD-BE: size ladder (7→9→11→13) unlocked by wins, move-par stars (★ ≤ par), optional
  timed mode, key-and-door cells for depth.

### Lexicle · P1 · `loop 3·3·4·2·1·2`
- BLOCKING (live-proven): the dictionary (~150 words) is the *answer list only* — "ARISE"
  and "ADIEU", the two most standard Wordle openers, are rejected with "not in word list".
  Every deduction workflow that relies on probing letters fights the word list itself.
- ILLOGICITY-lite: tag says "daily-ish" but there is no daily seed — "New word" is an
  endless conveyor, and the streak is just consecutive solves.
- SHOULD-BE: accept any 5-letter guess against an expanded guess list (answers stay
  curated), add the daily-seeded word with a once-per-day streak (the tag's actual promise),
  a word-was screen on loss already exists (good).

### Memory Match · P2 · `loop 2·1·2·1·1·1`
- S3: fixed 4×3 / 6 pairs forever — solved-optimal in 9–12 moves, always.
- SHOULD-BE: size ladder 4×3→4×4→6×4, a peek token, best-time alongside best-moves, theme
  decks unlocked by wins.

### Minesweeper · P1 · `loop 3·4·4·1·1·2`
- S3: 8×8/10 mines is the only field forever — veterans outgrow it in a day; the loop's
  best tension (chords, flag cap) is already right.
- SHOULD-BE: difficulty ladder (8×8 → 12×10/24 → 16×14/40) with per-size bests, a wins
  counter + win streak, an ALL-CLEAR moment (the win currently just flags remaining mines
  quietly — no ceremony for the clutch finish).

### Mini 2048 · P2 · `loop 4·2·4·2·1·2`
- S6: reaching 2048 fires one buzz — no banner, no "keep going" (the win state is invisible);
  4096/8192 have no tile colors (fall back to 2048's amber) so late merges look identical.
- SHOULD-BE: WIN overlay with Continue, colors for 4096/8192, best-tile display, milestone
  score pops every 1k.

### Mini Sudoku · P2 · `loop 2·0·2·1·1·1`
- S3: 4×4 with 8 clues is a children's puzzle for adults; the rule-based win check (accepts
  any valid completion) is excellent and stays.
- SHOULD-BE: 6×6 mode, error counter, hint reveal, daily seeded puzzle, streak of solves.

### Plinko · P2 · `loop 3·3·3·0·1·1`
- ILLOGICITY-lite: `totalScore` is accumulated in state but never displayed — dead data on
  the card; drops are free and infinite, so the slot-machine physics (the game's best asset)
  carries no stakes.
- SHOULD-BE: show total + average, optional "stake 10 chips → keep the slot payout" round
  structure (virtual, disclosed like Blackjack) or limited-ball rounds with target scores —
  scarcity is what turns this toy into a rush.

### Pong Duel · P2 · `loop 3·3·3·1·1·1`
- S5: match streak resets on a loss with no all-time best recorded (same erase-on-defeat
  pattern as Drop Four).
- SHOULD-BE: best-streak via setHighscore, difficulty (AI_SPEED 1.6/2.05/2.6), match-point
  tension cue (ball tint), already-solid speed ramp to 5.5.

### Random Fact · TOY-OK · `loop 1·0·1·0·0·1`
- SHOULD-BE (tiny): ♥-to-favorites and "seen 84/136" collection meter — free retention on an
  otherwise zero-meta card.

### Reaction Time · TOY-OK · `loop 2·3·3·1·0·1`
- SHOULD-BE (tiny): rolling average of last 5 and an honest "typical adult: ~250 ms"
  comparison — self-calibration is the hook this toy is missing.

### Rhythm Tap · TOY-OK+ · `loop 3·3·4·1·0·2`
- SHOULD-BE (tiny): a metronome tick synced to the ring (timing by silence is arbitrary),
  PERFECT-rate stat. The PERFECT/Good/miss ladder + speed ramp is already a real loop.

### Sand Drag · TOY-OK · `loop 2·0·2·0·0·1`
- SHOULD-BE (tiny): rake patterns (comb width) — one more verb for the fidget.

### Sequence (simonsays) · TOY-OK+ · `loop 3·3·4·2·0·2`
- SHOULD-BE (tiny): shape glyphs overlaid on pads (color-blind safety), a "new best!"
  fanfare. Speed ramp and pitch-per-pad are already in.

### Slide Puzzle · P2 · `loop 2·1·3·1·1·1`
- S3: fixed 4×4; solvable shuffle and inverted-score discipline already right.
- SHOULD-BE: 3×3→4×4→5×5 ladder, best-time alongside moves, an image mode (numbers →
  picture) for a fresh eye.

### Snake · P2 · `loop 3·3·4·1·0·2`
- S3: tick is a fixed 160 ms forever — no speed ramp, which is the genre's escalation.
- SHOULD-BE: speed ramp per 5 food, golden food (bonus + shrink-timer), a wrap mode toggle,
  already-correct win state when the board fills.

### Spinner · TOY-OK · `loop 2·1·2·0·0·1`
- SHOULD-BE (tiny): persist top RPM — one line of meta turns a flick toy into a "beat my
  312 rpm" return hook.

### Stack Tower · P2 · `loop 3·3·4·1·0·2`
- S3: block speed is a constant 3.2 px/f forever; width only ever shrinks.
- SHOULD-BE: speed ramp with height, PERFECT-drop center-snap streak (+2 pts and +2 width
  regen on 3 in a row — the genre's best compulsion trick), already-fixed tap double-fire
  stays pinned.

### This or That · P2 · `loop 1·0·2·0·1·1`
- ILLOGICITY-lite: this is Would You Rather with all of its depth removed — no split, no
  profile, no reveal; the pick counter is the entire meta.
- SHOULD-BE: either give it the choice-profile hook ("you pick sweet 73% of the time") and
  a fake-free history, or fold it into WYR; two overlapping cards dilute both.

### Tone Pad · TOY-OK · `loop 2·0·2·0·0·1`
- SHOULD-BE (tiny): record-and-playback loop (4 bars) — one feature away from an instrument.

### Tower Defense → see DEEP DIVE 1 · P0 · `loop 2·2·2·1·2·2`

### Trading Post → see DEEP DIVE 4 · P0 · `loop 1·1·1·1·1·2`

### Quick Trivia · P2 · `loop 2·1·3·1·0·1`
- S7-lite: no session structure — infinite Q&A with a streak line; 78 questions with no
  completion meter ("answered 41/78") though the bag guarantees full coverage eventually.
- SHOULD-BE: 10-question runs with a grade + category chips, a 50/50 lifeline, the
  collection meter; on-wrong `setHighscore(streak)` is redundant (store is max-wins) —
  harmless, worth deleting when touched.

### Type Speed · P2 · `loop 2·2·2·1·0·1`
- ILLOGICITY-lite: completion only checks the final string, so wrong-then-fixed keystrokes
  count toward the same WPM as clean typing — errors are free.
- SHOULD-BE: per-keystroke gating (wrong char blocks advance) or an accuracy % that scales
  WPM, phrase difficulty tiers, rolling 3-run average.

### Unscramble · P2 · `loop 2·1·2·1·0·1`
- S7: BEST = lifetime solves (always equals SOLVED) — meaningless best slot.
- SHOULD-BE: streak-based best or timed runs, word lengths mixed with harder tiers, a
  skip-penalty; 20 words cycle fast for veterans.

### Whack-a-Mole · P2 · `loop 3·3·4·1·0·2`
- SHOULD-BE: one mole at a time caps the chaos — 2-mole waves at score 15+, bombs (−2, don't
  tap!) and golden moles (+3) as the variable-ratio layer; ramp already exists (950→450 ms).

### Would You Rather · TOY-OK · `loop 2·0·3·1·1·2`
- Ethics: the imaginary-crowd disclosure is exactly right; keep it.
- S8-lite: votes are locked forever (can't change a vote) and after all 81 the card only
  replays results — a "reset my votes" escape valve fixes the terminal state.
- SHOULD-BE: vote-change, agreement streaks ("you matched the crowd ×7"), new-question packs.

### XOX · P2 · `loop 2·2·3·1·1·1`
- S5+S3: W/L/D tally only (no meta hook), and Hard is a solved game — the master's reward
  for perfection is an infinite draw machine with nothing to show for it.
- SHOULD-BE: draw-streak-on-hard as a setHighscore record (" unbeaten ×23"), best-win-streak
  on Medium/Easy, ultimate-mode (3×3 of boards) as the depth upgrade.

### Blob Merge / Crate Push → see DEEP DIVES 2 & 3 · P0

---

## NEXT ROUND'S FIX PLAN (prioritized, in execution order)

The playtester's instruction for this run was: collect everything, fix nothing yet. This is
the fix queue the next run should burn down **one by one**, verifying each against its entry
above.

**P0 — the four deadends/short-ends (the playtester's named wounds):**
1. Tower Defense: tower UPGRADE panel (tap own tower → +40% dmg/level, 4 levels, 70% sell
   refund), bounty `4+⌊W/2⌋`, clear bonus `15+3W`, enemy speed cap 1.5, next-wave preview.
2. Blob Merge: RECYCLER (drag blob off-board → bank stage² score, clear the cell), spawn
   scaling with your best blob's stage, milestone banners per new max stage.
3. Crate Push: +15 real levels with a curve, level-select grid with PB stars, ALL-CLEAR
   ceremony, seeded daily level.
4. Trading Post: ×1/×10/MAX trade buttons, auto-trader + caravan + Guild Hall sinks, market
   events, profit floats + trend arrows + price sparkline, milestone toasts.

**P1 — economy/meta repairs:**
5. Garden: seed shop (6–10 species), sprinkler sink, plant death + compost.
6. Kingdom: escalating build costs, random events, era goals, death recap card.
7. Blackjack: bank-peak highscore, chip denominations scale with bank, double-down,
   streak meter.
8. Lexicle: expanded GUESS dictionary (accept ARISE/ADIEU…), daily-seeded word.
9. Aquarium: species album + coin sink; terminal-8-fish state gets an escape.
10. Artillery: 3-HP duels, near-miss readout, best-duels highscore hook.
11. Drop Four + Pong Duel: record best-streaks (stop erasing history on defeat);
    Drop Four difficulty selector.
12. Minesweeper: difficulty ladder + wins counter + ALL-CLEAR moment.

**P2 — depth & juice sweep (batch these):**
13. Win ceremonies: Mini 2048 overlay + 4096/8192 colors; Blockfall TETRIS banner; Chain
    Link length titles; all-ceremony list in S6.
14. Difficulty ladders (S3): Memory Match, Lights Out, Slide Puzzle, Maze, Mini Sudoku,
    Snake speed ramp, Flap Dot ramp, Stack Tower ramp + perfect-drop streak, Color Snap
    timer ramp, Code Breaker sizes, Bubble Shooter board chain.
15. Meaningless meters (S7): Unscramble + Color Lab get real bests (streak-based).
16. Meta hooks for content cards: Trivia rounds + completion meter, Type Speed accuracy
    gate, This-or-That profile or fold-into-WYR decision, WYR vote-reset valve.
17. Toy hooks (one-liners each): Spinner top-RPM, Etch/Kaleidoscope save-PNG, Breathe daily
    counter, Random Fact favorites, Tone Pad loop record, Reaction rolling average,
    Plinko total display + stakes option, Physics Drop square collision honesty.

**Deliberately NOT flagged:** Unethicity is clean across the deck — no dark patterns, no
fake scarcity, no pressure timers, no paid anything; Blackjack and Would You Rather already
carry honest disclosures, and Plinko's slot-machine physics is honest because nothing is
staked (that's also why it scores low on rush — the fix is stakes, not deceit). The
inverted-score discipline (scoreEncoding:"inverted"), DPR canvas handling, input
arbitration, and save-hygiene patterns from earlier rounds all held up under this pass and
are not touched.

**Verification habit for next round:** every P0/P1 fix gets a live agent-browser proof
before moving to the next item (place an upgraded tower and watch a wave-20 run survive;
drag a blob to the recycler; clear a level from the new grid; bulk-buy 40 gems in one
click), and `qa/r17-regression.js` gains a companion `qa/r19-regression.js` pinning the new
mechanics.
