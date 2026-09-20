# GAMES.md — The Cartridge Catalog

**What this file is:** the single source of truth for every cartridge in the strip deck —
what it is, how it works, how it scores, and the words people use for it.

**Why it exists — the duplicate-prevention ledger:** at 52 cartridges, the most likely
way to waste a build is to ship a game the deck already has under a different name
("let me add Wordle!" → Lexicle ships in R??). Every entry carries a `Mechanics` line
and an `Aliases` line, and the [Mechanics Index](#mechanics-index) at the bottom maps
every mechanic → the games that already own it. **Check both before writing a line of
code.** A new cartridge must either occupy an unclaimed mechanic or improve a claimed
one in a genuinely distinct way (different verb, different brain, different feel —
not a reskin).

**How it stays iterable:** every entry below uses the exact same 5-line block format.
Adding game #53 = appending one block + one Mechanics Index row. No prose to rewrite,
no structure to renegotiate. The [Adding Cartridge #53](#adding-cartridge-53--the-checklist)
checklist covers the code side.

---

## Deck at a glance

| # | Title | id | Category | One-liner |
|---|-------|----|----------|-----------|
| 01 | Pong Duel | `pongduel` | ARCADE | First to 7 against the AI |
| 02 | Breakout | `breakout` | ARCADE | Brick-wall clearing, 3 lives |
| 03 | Blockfall | `blockfall` | ARCADE | Falling-block stacker |
| 04 | Blackjack 21 | `blackjack` | CARDS | Beat the dealer on virtual chips |
| 05 | Kingdom | `kingdom` | COLONY | Turn-based worker allocation |
| 06 | Trading Post | `tradingpost` | COLONY | Buy low, sell high market sim |
| 07 | Garden | `garden` | COLONY | Idle plots with real decay |
| 08 | Tiny Aquarium | `aquarium` | COLONY | Feed fish, grow a tank |
| 09 | Ant Colony | `anthill` | COLONY | Idle vault-economy strategy |
| 10 | Sand Drag | `sanddrag` | FIDGET | Drag through the sand |
| 11 | Spinner | `spinner` | FIDGET | Flick the wheel |
| 12 | Tower Defense | `towerdefense` | GAME | BFS-pathfinding wave defense |
| 13 | Dice Pig | `dicepig` | GAME | Push-your-luck banking |
| 14 | XOX | `xox` | GAME | Tic-tac-toe vs minimax |
| 15 | Artillery Duel | `artillery` | GAME | Angle, power, wind |
| 16 | Code Breaker | `codebreaker` | LOGIC | Mastermind color codes |
| 17 | Would You Rather | `wouldyourather` | ODDBALL | Pick a side, see the split |
| 18 | This or That | `thisorthat` | ODDBALL | No-wrong-answers picker |
| 19 | Random Fact | `randomfact` | ODDBALL | One fact per tap |
| 20 | Sequence | `simonsays` | PUZZLE | Watch the pattern, repeat it |
| 21 | Mini Sudoku | `minisudoku` | PUZZLE | 4×4 / 6×6 number logic |
| 22 | Unscramble | `unscramble` | PUZZLE | Tap letters to spell the word |
| 23 | Snake | `snake` | PUZZLE | Steer, eat, don't bite yourself |
| 24 | Mini 2048 | `mini2048` | PUZZLE | Slide-merge to 2048 |
| 25 | Bubble Shooter | `bubbleshoot` | PUZZLE | Aim, shoot, match 3+ |
| 26 | Quick Trivia | `trivia` | PUZZLE | 10-question bank runs |
| 27 | Maze | `maze` | PUZZLE | Swipe the dot to the star |
| 28 | Chain Link | `chainlink` | PUZZLE | Drag through same-color dots |
| 29 | Lights Out | `lightsout` | PUZZLE | Toggle neighbors, clear the board |
| 30 | Slide Puzzle | `slidepuzzle` | PUZZLE | The classic 15-puzzle |
| 31 | Blob Merge | `blobmerge` | PUZZLE | Drag blobs onto matches to merge |
| 32 | Minesweeper | `minesweeper` | PUZZLE | Dig safely, flag the mines |
| 33 | Crate Push | `sokoban` | PUZZLE | 20 levels of warehouse pushing |
| 34 | Memory Match | `memorymatch` | PUZZLE | Flip two, find the pairs |
| 35 | Type Speed | `typespeed` | REFLEX | Type the phrase, get WPM |
| 36 | Flap Dot | `flapdot` | REFLEX | One-tap flight through bars |
| 37 | Balloon Pop | `balloonpop` | REFLEX | 60s pop-fest, dodge the bombs |
| 38 | Perfect Ring | `perfectring` | REFLEX | Tap as the dot crosses the arc |
| 39 | Stack Tower | `stacktower` | REFLEX | Drop blocks, stack precision |
| 40 | Color Snap | `colorsnap` | REFLEX | Stroop test: tap only the mismatch |
| 41 | Reaction Time | `reaction` | REFLEX | Tap the instant it turns green |
| 42 | Rhythm Tap | `rhythmtap` | REFLEX | Tap exactly when the ring closes |
| 43 | Whack-a-Mole | `whackmole` | REFLEX | 30s of mole duty |
| 44 | Drop Four | `dropfour` | STRATEGY | Connect four vs the AI |
| 45 | Plinko | `plinko` | TOY | Drop balls through the pegs |
| 46 | Kaleidoscope | `kaleidoscope` | TOY | Symmetric finger painting |
| 47 | Etch Pad | `etch` | TOY | Draw with your finger |
| 48 | Breathe | `breathe` | TOY | Guided in–hold–out circle |
| 49 | Color Lab | `colormix` | TOY | Slider-match the target color |
| 50 | Gravity Drop | `physicsdrop` | TOY | Drop shapes, watch them pile |
| 51 | Tone Pad | `tonepad` | TOY | Pads, notes, loop recording |
| 52 | Lexicle | `lexicle` | WORD | 5-letter word, 6 guesses |

---

## ARCADE

### 01 · Pong Duel — `pongduel`
- **What:** the classic paddle duel, compressed to first-to-7 against the shell's AI.
- **Working:** drag your paddle vertically; the ball speeds up with each exchange and
  the AI tracks with human-enough imperfection. First to 7 points takes the run.
- **Scores & saves:** best = wins stored via the shell highscore store (max-wins).
- **Mechanics:** `paddle` `ball-bounce` `drag` `vs-ai`
- **Aliases:** pong, paddle game, tennis

### 02 · Breakout — `breakout`
- **What:** brick-wall demolition with a paddle and 3 lives.
- **Working:** drag the paddle, the ball chips the wall row by row; angle off the
  paddle edges is the skill. Clear the wall to win; lose all 3 balls and the run is over.
- **Scores & saves:** best stored max-wins.
- **Mechanics:** `paddle` `ball-bounce` `brick-grid` `lives`
- **Aliases:** brick breaker, arkanoid

### 03 · Blockfall — `blockfall`
- **What:** the falling-block stacker — full rows clear, garbage ends the run.
- **Working:** arrows or on-screen buttons move/rotate the pieces; complete rows flash
  and collapse. Speed climbs as you clear. Stack to the top → run over.
- **Scores & saves:** best = lines/score, max-wins.
- **Mechanics:** `falling-pieces` `grid` `line-clear` `keyboard+buttons`
- **Aliases:** tetris, falling blocks, stacker

---

## CARDS

### 04 · Blackjack 21 — `blackjack`
- **What:** casino blackjack on virtual chips — no real money, no purchases, ever.
- **Working:** deal, hit, stand, (double); dealer stands on 17. Chip balance persists
  between visits so a good session is felt next time.
- **Scores & saves:** chip balance persisted via `api.save`; best via shell store.
- **Mechanics:** `cards` `hand-values` `bankroll` `dealer-ai`
- **Aliases:** 21, twenty-one, vingt-et-un

---

## COLONY
*The tend() family — these are caretaking beats, not runs. They call `api.tend()`
(the shell's idle-caretaking event) instead of `api.gameover()`, and missions count
them as TEND goals. They all persist full sim state through `api.save`.*

### 05 · Kingdom — `kingdom`
- **What:** turn-based resource strategy — three finite resources with interlocking tradeoffs.
- **Working:** each tap of Advance is a day: assign workers across gold/food/population.
  Gold funds buildings, food feeds the population (which decays if unfed — a real loss
  condition), population is next turn's workforce. Entirely turn-based; no clock pressure.
- **Scores & saves:** full state persisted (factory-cloned defaults — never a shared template object).
- **Mechanics:** `turn-based` `worker-allocation` `population` `buildings`
- **Aliases:** settle, town builder, realm

### 06 · Trading Post — `tradingpost`
- **What:** portfolio-allocation strategy under a fluctuating market.
- **Working:** goods oscillate around base prices with random demand spikes/gluts
  (grain festival, gem rush…). Bulk-trade ×1/×10/MAX, buy auto-traders (idle income),
  send caravans (risk/reward), climb the 3-tier Guild Hall ladder for permanent perks.
  Timing the market events IS the skill.
- **Scores & saves:** gold + holdings persisted via `api.save`.
- **Mechanics:** `market` `price-oscillation` `bulk-trade` `idle-income` `risk-reward`
- **Aliases:** market sim, merchant, bazaar

### 07 · Garden — `garden`
- **What:** idle plots with a real decay mechanic — neglect has visible cost.
- **Working:** tap a plot to plant, water, harvest; plants lose health and growth if
  ignored too long, dead plants compost. Seed shop + sprinkler ladder (which water for
  you, offline, honestly). The anti-ant-colony: decay makes checking in matter.
- **Scores & saves:** plots/health/timers persisted via `api.save` (NaN-sanitized on load).
- **Mechanics:** `idle` `decay` `watering` `seed-shop` `offline-progress`
- **Aliases:** plant sim, farm, greenhouse

### 08 · Tiny Aquarium — `aquarium`
- **What:** a living fish tank — feed them, watch them grow, release when crowded.
- **Working:** tap to drop food (economy, not bottomless); fish eat, grow, and breed
  the tank's value. Tap a fish twice to release it. Tank capacity caps the population,
  so the feed/cull balance is the game.
- **Scores & saves:** tank state persisted via `api.save`.
- **Mechanics:** `idle` `feeding` `population-cap` `creatures`
- **Aliases:** fish tank, koi pond

### 09 · Ant Colony — `anthill`
- **What:** idle/strategy with a vault — "check back in" beats "walk away for weeks."
- **Working:** passive production fills a capped VAULT, not your balance; once full,
  production is wasted until you collect. Spend food on more production or a bigger
  vault (or defense) — the capacity line is the strategic question.
- **Scores & saves:** colony state persisted via `api.save`.
- **Mechanics:** `idle` `vault-cap` `upgrades` `offline-progress`
- **Aliases:** ant farm, idle hive, hamster-kombat-done-right

---

## FIDGET

### 10 · Sand Drag — `sanddrag`
- **What:** a finger-through-the-sand toy. No goal, no fail, pure texture.
- **Working:** drag anywhere; the grains part and settle behind your finger. Nothing
  to win — the deck keeps a couple of zero-stakes toys on purpose.
- **Scores & saves:** none (toy).
- **Mechanics:** `drag` `particle-visual` `zero-stakes`
- **Aliases:** zen garden, sand tray

### 11 · Spinner — `spinner`
- **What:** the fidget wheel. Flick it, watch it hum.
- **Working:** drag/flick sets it spinning with realistic decay; the RPM readout is
  the toy's only number. Zero stakes, honest physics feel.
- **Scores & saves:** none (toy).
- **Mechanics:** `flick` `spin-physics` `zero-stakes`
- **Aliases:** fidget spinner, wheel

---

## GAME

### 12 · Tower Defense — `towerdefense`
- **What:** wave defense with genuine pathfinding — enemies reroute around your towers.
- **Working:** BFS from spawn to base runs every placement, so towers are walls and
  enemies walk the shortest open path; a placement that would seal the only route is
  rejected. Three tower types (fast/cheap, heavy/slow, splash) make placement real.
  Survive the waves; best = highest wave survived.
- **Scores & saves:** best = wave, max-wins.
- **Mechanics:** `pathfinding-bfs` `waves` `tower-types` `economy`
- **Aliases:** TD, tower wars, lane defense

### 13 · Dice Pig — `dicepig` ⭐ `winDepth:true`
- **What:** push-your-luck dice — the deck's first dice game (#52, R32).
- **Working:** 5 turns. Roll to grow the turn pot; a 1 burns the pot and ends the
  turn (banked points never burn). BANK anytime to keep the pot. Bank 50+ at ANY
  moment = instant win; five turns gone without 50 = run over with what you banked.
  The only game that has ever taught courage in five turns.
- **Scores & saves:** best = banked total, max-wins. **Win-depth opt-in:** the WIN's
  banked total feeds the depth ring (`winDepth:true` at register — the shell resolves
  it into `strip:gameover` detail).
- **Mechanics:** `dice` `push-your-luck` `bank` `turns`
- **Aliases:** pig, bank dice, greedy

### 14 · XOX — `xox`
- **What:** tic-tac-toe against a minimax AI — you will not outsmart it, only tie it.
- **Working:** you're X, AI is O; the AI plays perfect minimax so the honest ceiling
  is a draw (the hint says exactly that). Win/draw record persists between visits.
- **Scores & saves:** record via `api.save`.
- **Mechanics:** `grid-3x3` `minimax` `perfect-info`
- **Aliases:** tic-tac-toe, noughts and crosses, XO

### 15 · Artillery Duel — `artillery`
- **What:** turn-by-turn shelling — angle, power, and a live wind reading.
- **Working:** set angle + power each turn, compensate for wind, and watch the shell
  arc over terrain toward the enemy tank. Hit to win; miss and they shoot back.
- **Scores & saves:** best via shell store.
- **Mechanics:** `projectile-physics` `wind` `turn-based` `aim`
- **Aliases:** scorched earth, tank duel, cannon

---

## LOGIC

### 16 · Code Breaker — `codebreaker` ⚠️ inverted
- **What:** Mastermind — crack the hidden color code before your rows run out.
- **Working:** submit a guess, read the peg feedback (right color / right place),
  deduce the code across the remaining rows. Three code lengths = three difficulties.
- **Scores & saves:** CLASSIC code only stores `100000 − rows` (lower rows = better);
  declared `scoreEncoding:"inverted"`, ceiling 100 — **never double it (twist)**.
- **Mechanics:** `deduction` `feedback-pegs` `hidden-code` `limited-rows`
- **Aliases:** mastermind, bulls and cows

---

## ODDBALL
*No score, no fail — the deck's personality shelf.*

### 17 · Would You Rather — `wouldyourather`
- **What:** dilemmas with a memory — pick a side and see how your past votes split.
- **Working:** question, two buttons, your vote is recorded and shown next time the
  question resurfaces (bag-randomized, no immediate repeats). Infinite content, zero stakes.
- **Scores & saves:** votes persisted via `api.save`.
- **Mechanics:** `opinion-pick` `vote-memory` `infinite-bag`
- **Aliases:** WYR, dilemmas

### 18 · This or That — `thisorthat`
- **What:** the lighter cousin — tap a side, no wrong answers, no judgment.
- **Working:** two options per card, tap your pick, a running total of your choices
  persists. Pure tap-therapy with a faint portrait of your taste over time.
- **Scores & saves:** totals persisted via `api.save`.
- **Mechanics:** `opinion-pick` `tap-counter`
- **Aliases:** pick one, preferences

### 19 · Random Fact — `randomfact`
- **What:** one fact per tap, from a shuffled bag.
- **Working:** tap → a fact appears; the bag (shuffle-bag pattern) guarantees no
  repeats within a pass, and your seen-count persists so you can watch the number grow.
- **Scores & saves:** seen-count + bag position via `api.save`.
- **Mechanics:** `content-tap` `shuffle-bag` `counter`
- **Aliases:** fun facts, did-you-know

---

## PUZZLE

### 20 · Sequence — `simonsays`
- **What:** the memory chain — watch the pattern grow, play it back.
- **Working:** pads flash a sequence; repeat it to grow it by one. One slip ends the
  run. The classic working-memory burner.
- **Scores & saves:** best = longest sequence, max-wins.
- **Mechanics:** `memory-sequence` `playback` `grows-each-round`
- **Aliases:** simon, copy the pattern

### 21 · Mini Sudoku — `minisudoku` ⚠️ inverted
- **What:** sudoku in two snack sizes (4×4 and 6×6).
- **Working:** fill the grid so no row/column/box repeats a symbol. Timer runs; the
  win screen shows your time.
- **Scores & saves:** CLASSIC 4×4 only stores `100000 − seconds`; declared
  `scoreEncoding:"inverted"`, ceiling 100000 — **never double it (twist)**.
- **Mechanics:** `number-grid` `constraint-satisfaction` `timed`
- **Aliases:** sudoku, number place

### 22 · Unscramble — `unscramble`
- **What:** the letters are shuffled; tap them in order to spell the word.
- **Working:** each word shows as scrambled tiles; tap letters to build the answer,
  wrong picks cost nothing but time. Streak-friendly vocabulary snack.
- **Scores & saves:** best via shell store.
- **Mechanics:** `anagram` `letter-tiles` `vocabulary`
- **Aliases:** word jumble, anagram

### 23 · Snake — `snake`
- **What:** the classic — steer, eat, grow, don't bite yourself.
- **Working:** swipe (or arrows) to steer; food grows the snake and the score; walls
  and your own tail are lethal. Board has a real win state now (the R0 audit killed
  the fill-the-board freeze).
- **Scores & saves:** best = length/score, max-wins.
- **Mechanics:** `grid-steer` `growth` `self-collision` `swipe+keys`
- **Aliases:** worm, nibbles

### 24 · Mini 2048 — `mini2048`
- **What:** the slide-merge classic on a 4×4 board.
- **Working:** swipe to slide all tiles; equal tiles merge into their sum; the board
  spawns a new tile every move. Reach 2048 (or die trying — the board fills up).
  Tile ramp is CSS-graded (`s2-t*` classes): dark keeps the original hexes, light
  wears the daylight ramp.
- **Scores & saves:** best = highest tile/score, max-wins.
- **Mechanics:** `slide-merge` `grid` `swipe+keys` `doubling`
- **Aliases:** 2048, threes, merge tiles

### 25 · Bubble Shooter — `bubbleshoot`
- **What:** aim-and-shoot cluster clearing on a hex grid.
- **Working:** tap to shoot the loaded bubble at the cluster; 3+ same-color connections
  pop (floaters fall properly — an R0 fix). Board cleared = win; the ceiling line
  dropping low = over.
- **Scores & saves:** best = score, max-wins.
- **Mechanics:** `hex-grid` `aim-shoot` `cluster-match` `floaters`
- **Aliases:** bubble shooter, bubble popper

### 26 · Quick Trivia — `trivia`
- **What:** ten questions per run — bank as many as you can.
- **Working:** 4-choice questions, instant right/wrong flash, score accumulates across
  the run. The bag rotates so consecutive runs feel different.
- **Scores & saves:** best = correct answers per run, max-wins.
- **Mechanics:** `quiz` `multiple-choice` `run-of-10`
- **Aliases:** quiz, trivia night

### 27 · Maze — `maze` ⚠️ inverted
- **What:** swipe the dot through the corridors to the star — three sizes.
- **Working:** generated mazes per run; swipe steers until walls stop you. The star
  ends the run; fewer moves is better.
- **Scores & saves:** CLASSIC 7×7 only stores `100000 − moves`; declared
  `scoreEncoding:"inverted"`, ceiling 100000 — **never double it (twist)**.
- **Mechanics:** `maze-gen` `swipe-move` `move-count`
- **Aliases:** labyrinth

### 28 · Chain Link — `chainlink`
- **What:** drag a chain through same-color dots to clear them.
- **Working:** press and drag across connected same-color dots; release to clear the
  chain and score it. Longer chains pay disproportionately — greedy pulls break the
  chain (diagonals don't connect).
- **Scores & saves:** best = score, max-wins.
- **Mechanics:** `drag-chain` `same-color` `grid` `greedy-length`
- **Aliases:** dotted chain, color flow

### 29 · Lights Out — `lightsout` ⚠️ inverted
- **What:** toggle a cell and its neighbors — clear every light. Three sizes.
- **Working:** each tap flips the tapped cell plus orthogonal neighbors; some puzzles
  need parity thinking rather than chase-everything. Fewer moves = better.
- **Scores & saves:** CLASSIC 5×5 only stores `100000 − moves`; declared
  `scoreEncoding:"inverted"`, ceiling 100000 — **never double it (twist)**.
- **Mechanics:** `toggle-neighbors` `parity` `move-count`
- **Aliases:** lightsout, flip grid

### 30 · Slide Puzzle — `slidepuzzle` ⚠️ inverted
- **What:** the 15-puzzle — tap a tile beside the gap to slide it. Three sizes.
- **Working:** scramble is always solvable; order the grid by sliding into the gap.
  Fewer moves = better.
- **Scores & saves:** CLASSIC 4×4 only stores `100000 − moves`; declared
  `scoreEncoding:"inverted"`, ceiling 100000 — **never double it (twist)**.
- **Mechanics:** `sliding-tiles` `gap-move` `move-count`
- **Aliases:** 15-puzzle, tile slide

### 31 · Blob Merge — `blobmerge`
- **What:** drag a blob onto a matching one to merge — plan the fall of dominos.
- **Working:** a 4×5 grid of numbered blobs; drag one onto an equal one to merge into
  the next number, everything above drops down. Chain the merges, survive the fills.
- **Scores & saves:** best = score, max-wins.
- **Mechanics:** `drag-merge` `gravity-reflow` `doubling`
- **Aliases:** merge blobs, drop merge

### 32 · Minesweeper — `minesweeper` ⚠️ inverted
- **What:** the minefield classic — dig safely, flag the rest. Three fields.
- **Working:** tap to dig (numbers count adjacent mines), long-press to flag. Clear
  every safe cell to win; faster is better.
- **Scores & saves:** best field stores `9999 − seconds`; declared
  `scoreEncoding:"inverted"`, ceiling 9999 — **never double it (twist)**.
- **Mechanics:** `adjacency-numbers` `flag` `deduction` `timed`
- **Aliases:** minefield, mines

### 33 · Crate Push — `sokoban`
- **What:** 20 handcrafted levels of warehouse pushing.
- **Working:** push (never pull) crates onto the target dots; U undoes — because a
  cornered crate is a dead run and everyone deserves the undo. Levels escalate from
  trivial to think-hard.
- **Scores & saves:** level progress persisted via `api.save`.
- **Mechanics:** `grid-push` `undo` `level-ladder`
- **Aliases:** sokoban, warehouse keeper, box push

### 34 · Memory Match — `memorymatch` ⚠️ inverted
- **What:** flip two cards, remember the board, clear the pairs. Three fields.
- **Working:** cards flip in pairs; matched pairs stay open. Fewer moves = better
  (the CLASSIC field is what's ranked).
- **Scores & saves:** CLASSIC field stores `100000 − moves`; declared
  `scoreEncoding:"inverted"`, ceiling 100000 — **never double it (twist)**.
- **Mechanics:** `pairs` `board-memory` `move-count`
- **Aliases:** concentration, pairs, pelmanism

---

## REFLEX

### 35 · Type Speed — `typespeed`
- **What:** a typing test that fits in a card — type the phrase, get your WPM.
- **Working:** the phrase appears; keystrokes advance it (errors halt progress);
  finishing computes WPM from the elapsed time.
- **Scores & saves:** best = WPM, max-wins.
- **Mechanics:** `typing` `wpm` `keyboard`
- **Aliases:** typing test, wpm

### 36 · Flap Dot — `flapdot`
- **What:** one-tap flight through the gaps.
- **Working:** tap to flap, gravity does the rest; bars scroll in with uneven gaps.
  One hit ends the run (R0 killed the multi-gameover stacking).
- **Scores & saves:** best = bars passed, max-wins.
- **Mechanics:** `one-tap` `gravity` `scrolling-obstacles`
- **Aliases:** flappy, bird

### 37 · Balloon Pop — `balloonpop`
- **What:** a 60-second pop-fest with bombs hiding in the bunch.
- **Working:** balloons rise; tap to pop them for points, tap a bomb and it costs
  you. Timer ends the run.
- **Scores & saves:** best = score, max-wins.
- **Mechanics:** `timed-60s` `tap-frenzy` `avoid-targets`
- **Aliases:** popper, balloon tap

### 38 · Perfect Ring — `perfectring`
- **What:** pure timing — tap as the dot crosses the bright arc.
- **Working:** a dot orbits a ring; hitting the arc scores, dead-center scores
  PERFECT. Miss and the run costs you. One-tap zen with a scoreboard.
- **Scores & saves:** best = score/streak, max-wins.
- **Mechanics:** `orbit-timing` `one-tap` `precision-window`
- **Aliases:** ring timing, circle tap

### 39 · Stack Tower — `stacktower`
- **What:** drop the sliding block — every overlap miss shrinks the next one.
- **Working:** a block sweeps; tap to drop it on the tower. The overhang is sliced
  off, so the live area narrows with every drop. Total miss ends the run. (R0 fixed
  the spawn-outside-canvas bug that made it unplayable.)
- **Scores & saves:** best = height, max-wins.
- **Mechanics:** `timing-drop` `shrink-on-error` `precision`
- **Aliases:** tower stacker, stacker

### 40 · Color Snap — `colorsnap`
- **What:** the Stroop test as a game — tap only when the word and its color disagree.
- **Working:** a color word renders in a conflicting ink; snap the mismatch, pass the
  match. Wrong snaps cost the run.
- **Scores & saves:** best = score, max-wins.
- **Mechanics:** `stroop` `go/no-go` `ink-conflict`
- **Aliases:** stroop test, color trap

### 41 · Reaction Time — `reaction` ⚠️ inverted
- **What:** the purest reflex meter — tap the instant the panel turns green.
- **Working:** wait for green (early taps void the trial), tap, read your
  milliseconds; a rolling last-5 average sits under the result with an honest
  adult baseline (~250ms). Tap again for the next round.
- **Scores & saves:** best stores `100000 − ms` (lower ms = higher stored
  value); declared `scoreEncoding:"inverted"`, ceiling 100000 — **never double
  it (twist)**. Was shipped undeclared (the tripwire regex misses
  compute-then-pass subtraction) and was formally declared in the R34 lead-up.
- **Mechanics:** `reaction-gate` `ms-readout` `rolling-average`
- **Aliases:** reflex test, quickness

### 42 · Rhythm Tap — `rhythmtap`
- **What:** tap the pad exactly when the shrinking ring closes on it.
- **Working:** rings close in on the pad in rhythm; timing accuracy grades each tap
  (perfect/good/miss). Chains build the score; misses break it.
- **Scores & saves:** best = score, max-wins.
- **Mechanics:** `shrinking-ring` `timing` `combo`
- **Aliases:** beat tap, ring tap

### 43 · Whack-a-Mole — `whackmole`
- **What:** 30 seconds of mole duty.
- **Working:** moles pop from holes at rising rates; tap them before they duck. Timer
  ends the run.
- **Scores & saves:** best = score, max-wins.
- **Mechanics:** `timed-30s` `pop-up-targets` `tap-frenzy`
- **Aliases:** whack, mole tap

---

## STRATEGY

### 44 · Drop Four — `dropfour`
- **What:** connect-four against a real AI.
- **Working:** tap a column to drop your disc; four in a row (any direction) wins.
  The AI blocks, stacks, and sets traps at a fair-but-beatable level.
- **Scores & saves:** best = wins, max-wins.
- **Mechanics:** `column-drop` `line-of-4` `heuristic-ai`
- **Aliases:** connect four, four in a row

---

## TOY

### 45 · Plinko — `plinko`
- **What:** drop balls through a peg field into scoring slots.
- **Working:** tap to release a ball; pegs scatter it into a slot whose value is your
  points. Physics is honest, slots are greedy at the edges. (A tend() consumer —
  dropping a ball counts as caretaking.)
- **Scores & saves:** best = score, max-wins.
- **Mechanics:** `peg-physics` `drop` `slot-values`
- **Aliases:** pachinko, peg board

### 46 · Kaleidoscope — `kaleidoscope`
- **What:** symmetric finger painting — every stroke mirrored into a bloom.
- **Working:** drag to draw; the mirror math paints N-fold symmetry live. Shake/clear
  to start fresh. Pure expression, no score.
- **Scores & saves:** none (toy).
- **Mechanics:** `symmetry-paint` `drag` `zero-stakes`
- **Aliases:** spirograph, mirror paint

### 47 · Etch Pad — `etch`
- **What:** a bare drawing pad — finger, lines, done.
- **Working:** drag to draw thick ink strokes; clear resets the pad. The deck's
  simplest creative tool.
- **Scores & saves:** none (toy; sketch is session-only).
- **Mechanics:** `free-draw` `zero-stakes`
- **Aliases:** sketch, doodle pad

### 48 · Breathe — `breathe`
- **What:** a guided breathing pacer — in, hold, out.
- **Working:** the circle swells, holds, shrinks on a calm cycle; text cues the phase.
  Nothing to win. The deck's most honest "take a break" cartridge.
- **Scores & saves:** none (toy).
- **Mechanics:** `pacer` `cycle-animation` `zero-stakes`
- **Aliases:** breathing exercise, zen circle

### 49 · Color Lab — `colormix` ⚠️ inverted
- **What:** match the target color with three sliders.
- **Working:** target swatch shown; drag sliders until your swatch lands within
  tolerance; closeness grades the hit ("Matched!" / "Getting close…"). Each match
  spawns a new target — a puzzle wearing a toy's clothes.
- **Scores & saves:** best = fewest slider tweaks per match, stored as
  `9999 − tweaks`; declared `scoreEncoding:"inverted"`, ceiling 9999 — **never
  double it (twist)**. (R19 S7 made BEST a real skill record; the R34 lead-up
  audit added the missing encoding declaration.)
- **Mechanics:** `sliders` `color-match` `tolerance` `tweak-count`
- **Aliases:** color matcher, mixer

### 50 · Gravity Drop — `physicsdrop`
- **What:** tap to drop shapes and watch them pile up. No goal, honest physics.
- **Working:** each tap spawns a shape that falls, tumbles, and stacks; the pile
  persists until you clear it. Zero-stakes physics ashtray.
- **Scores & saves:** none (toy).
- **Mechanics:** `drop-physics` `pile-up` `zero-stakes`
- **Aliases:** sand pile, shape drop

### 51 · Tone Pad — `tonepad`
- **What:** a pocket soundboard — tap pads for notes, record a loop.
- **Working:** pads play pentatonic notes (audio routed through Feedback per house
  rule — never its own AudioContext); record captures your taps and loops them.
- **Scores & saves:** none (toy).
- **Mechanics:** `pads` `notes` `loop-recorder`
- **Aliases:** soundboard, drum pads

---

## WORD

### 52 · Lexicle — `lexicle`
- **What:** the 5-letter word game — six guesses, color-graded feedback.
- **Working:** guess the word; each tile grades green (right letter, right place) /
  amber (right letter, wrong place) / dark (absent). "Daily-ish" — fresh words on a
  cadence, not a hard calendar lock.
- **Scores & saves:** streak/best via shell store.
- **Mechanics:** `word-guess` `letter-feedback` `limited-guesses`
- **Aliases:** wordle, word guess

---

## Mechanics Index
*The duplicate detector. A new game idea → find its mechanic here → if it's claimed,
the burden of proof is on the new cartridge to be a distinct verb/brain/feel.*

| Mechanic | Already owned by |
|----------|------------------|
| slide-merge / doubling tiles | `mini2048`, `blobmerge` |
| sliding-tiles (gap slide) | `slidepuzzle` |
| word-guess / anagram / vocabulary | `lexicle`, `unscramble`, `typespeed` |
| memory-sequence / board-memory | `simonsays`, `memorymatch` |
| cluster-match on grid | `bubbleshoot`, `chainlink` |
| falling-pieces / line-clear | `blockfall` |
| paddle + ball physics | `breakout`, `pongduel` |
| aim & shoot (grid) | `bubbleshoot` |
| projectile / lobbed aim | `artillery` |
| push-your-luck / dice | `dicepig` |
| deck of cards / hand values | `blackjack` |
| grid deduction (numbers/flags) | `minesweeper` |
| parity / toggle logic | `lightsout` |
| constraint-grid (no repeats) | `minisudoku` |
| deduction via feedback pegs | `codebreaker` |
| line-of-N vs AI | `dropfour`, `xox` |
| maze navigation | `maze`, `snake` |
| grid push + undo | `sokoban` |
| timing window (orbit/ring) | `perfectring`, `rhythmtap` |
| reaction gate | `reaction`, `colorsnap` |
| timed tap-frenzy | `whackmole`, `balloonpop` |
| precision drop / shrink | `stacktower` |
| one-tap gravity flight | `flapdot` |
| peg physics / drop toys | `plinko`, `physicsdrop` |
| idle + tend loop | `garden`, `aquarium`, `anthill`, `tradingpost`, `kingdom` |
| market / price oscillation | `tradingpost` |
| wave pathfinding defense | `towerdefense` |
| opinion pick / zero-stakes content | `wouldyourather`, `thisorthat`, `randomfact` |
| quiz / knowledge run | `trivia` |
| creative toys (draw/paint/sound) | `etch`, `kaleidoscope`, `tonepad`, `colormix`, `sanddrag` |
| pacer / zen | `breathe`, `spinner` |

**Niches with exactly one claimant (fair game for a *genuinely different* sibling):**
dice (`dicepig`), cards (`blackjack`), typing (`typespeed`), rhythm (`rhythmtap`),
tower defense (`towerdefense`), sokoban-style pushing (`sokoban`).

---

## Special registry flags (the landmines)

### ⚠️ `scoreEncoding:"inverted"` — 9 carriers
`minisudoku` (100000−sec, CLASSIC 4×4) · `maze` (100000−moves, CLASSIC 7×7) ·
`lightsout` (100000−moves, CLASSIC 5×5) · `slidepuzzle` (100000−moves, CLASSIC 4×4) ·
`minesweeper` (9999−sec) · `codebreaker` (100−rows, CLASSIC code) ·
`memorymatch` (100000−moves, CLASSIC field) · `reaction` (100000−ms) ·
`colormix` (9999−tweaks).

These store `CEILING − x` so lower-is-better fits the store's max-wins semantics.
The registry **tripwire warns** at register-time if your `mount` source contains
`setHighscore(` with a subtraction but no `scoreEncoding:"inverted"` declaration —
but the tripwire has a known blindspot: it only matches the subtraction INLINE
inside the `setHighscore(...)` call. `reaction` (`const scoreValue = 100000 - ms`)
and `colormix` (`Math.max(1, 9999 - tweakCount)`) both computed the encoded value
into a variable and passed it, slipping past the regex undeclared until the R34
lead-up audit — meaning the Daily ×2 twist would have corrupted either game's
best had it ever been the pick, and `repairTwistDamage` couldn't have caught it
(no declared ceiling to check against). **Lesson: declare the encoding whenever
you store an inverted value, regex or no regex** — the twist gate
(`Daily.twistScore`) and the twist-damage repair both read the declaration, not
your arithmetic.

### 🌱 `tend()` — 5 consumers
`garden` · `aquarium` · `anthill` · `tradingpost` · `plinko` (also `blackjack` by the
R24 note). Idle/caretaking cartridges call `api.tend()` instead of `api.gameover()` —
missions count unique TEND cartridges per day; XP does not consume tend.

### ⭐ `winDepth:true` — 1 carrier
`dicepig` only (R33). A game whose WIN score is an honest performance number opts in
at register; the shell resolves it once into `strip:gameover` detail (`winDepth`) so
XP + Depth read one contract. Inverted-encoding games must NEVER opt in.

---

## Adding Cartridge #53 — the checklist

**Step 0 — duplicate check (this file is the gate):**
1. Search this file for your idea's name, mechanic, and 3 synonyms.
2. Check the [Mechanics Index](#mechanics-index) — claimed mechanics need a genuinely
   distinct take (different verb, different brain, different feel).
3. If it survives, write the entry block FIRST (What/Working/Scores/Mechanics/Aliases)
   — if you can't fill the 5 lines honestly, it's not ready to build.

**Step 1 — build from the template:** copy `js/game_template.js` (heavily commented,
contract-compliant skeleton) to `js/games/<yourid>.js`. Keep the id lowercase, unique,
and treat it as FOREVER — it's the save key; renaming orphans player saves.

**Step 2 — register the cartridge:** `Strip.register({ id, label, title, tag, hint,
mount })`. Pick `label` from the existing category set (GAME, PUZZLE, REFLEX, ARCADE,
CARDS, STRATEGY, LOGIC, WORD, COLONY, FIDGET, TOY, ODDBALL) — don't invent a category
for one game.

**Step 3 — wire it into the deck:**
- `index.html`: add `<script src="js/games/<yourid>.js"></script>` in registration order.
- `sw.js`: add the file to the precache list AND bump **both** cache versions
  (`strip-shell-vNN` / `strip-runtime-vNN`) — stale players otherwise never see the game.
- No other shell changes: the deck count, FULL SHELF trophy (`need:'ALL'`), and Player
  Card EXPLORED all read the live registry.

**Step 4 — house rules (enforced by review, some by tripwire):**
- DOM lookups scoped to `container.querySelector` — never `document.getElementById`
  (two copies of a cartridge can be mounted at once).
- All audio through `Feedback.tone/uiTone` + `Feedback.haptic` in try/catch — never
  your own AudioContext.
- `window` listeners (keydown especially) must be gated on `StripShell.isActive(container)`
  and removed in the returned cleanup function.
- ONE `api.gameover(outcome, score)` at the natural end of a run — never in a loop,
  never twice on the same frame.
- Colors from CSS tokens (`--panel`, `--ink`, `--ink-dim`, `--line`, `--amber`,
  `--purple`, `--good`, `--danger`, `--screen*`) — never hardcoded hexes (LIGHT mode
  re-grades everything; R33 has the scar tissue).
- Scroll-threatening keys get `preventDefault()`.

**Step 5 — prove it:**
- `node --check js/games/<yourid>.js`
- Mount sweep: all 52+1 cartridges mount, zero console errors (qa suites sweep the
  registry — keep sweeps registry-length-agnostic; A0 literals pinning exact counts
  are a documented R32 debt).
- Add your QA hooks (the `cart._xxx` seam pattern) if a suite will need to force states.

**Step 6 — close the ledger:** append the entry block here (alphabetical within its
category, next # in line), add its row to the Mechanics Index, move its mechanics from
"one claimant" to claimed, and update the count everywhere this file says 52.

