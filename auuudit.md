# auuudit — the 52-cartridge teardown
**Live build** · harshvardhan9084.github.io/strip · headless mobile 390×844 (+320px spot checks) · **520 screenshots** (10 per game: 8 dark scenes, 1 LIGHT, 1 amber skin) · every game actually played (clicks, keys, drags, long-presses, typing) · settings/drawer/trophy torn down separately.

Legend per entry: **ADD / REMOVE / CHANGE / KEEP** directives + **FEEL** = the gamer's one-liner.
Honest scope note: blind autoplay reached some games' deep states (TD waves, artillery duels, whackmole rounds, blackjack hands) only partially — those are marked.

---

## 0 · THE ONE UI — the centralized spec the deck is begging for

The deck already has a soul (phosphor + CRT + Press Start 2P). What it lacks is **one discipline**. 52 games means 52 hand-rolled stat rows, 9 different "SCORE/BEST" layouts, hint text said twice on 6 cards, and a dark-mode contrast floor that hides the actual game in 8 cartridges. Centralize these:

**Type scale (fix the 8px dust)**
- One scale, four steps: **22 (hero/center text) / 16 (titles) / 13 (stats) / 11 (labels, floor)**. Today stat rows range 8–13px per game (maze "par 2" wraps, TD header crushes, drawer eyebrows dust).
- Press Start 2P only for: logo, card title, hero numbers, ceremony panels. Never for 3-line instructions (blobmerge's goal paragraph is unreadable).

**One card anatomy (shell-owned, not game-owned)**
```
[shell]  eyebrow · title · tag          ← already good
[shell]  STAT ROW slot                  ← game declares {label,value,color}[]
[game]   playfield — flex:1, centered, min 55% of card
[game]   primary verb (one emphasized control)
[shell]  hint line                      ← the ONLY hint, kill in-card duplicates
```
- The STAT ROW kills 52 custom headers (SCORE/BEST, MOVES/PAIRS, GOLD/LIVES/WAVE, FOOD/RATE/BEST → one component, consistent 13px, tabular nums, ≤4 stats).
- Duplicated hints today: anthill, aquarium, flapdot, blobmerge, bubbleshoot, dicepig (in-card line + shell hint say the same thing).

**Contrast floor (the dark-mode ledger)**
- Any interactive cell must clear **3:1 against --panel**. Currently failing: maze walls, minesweeper dug-vs-undug, mini2048 tile ramp (2 vs 4 identical grays), dropfour holes, memory/unscramble empty slots, whackmole holes, sokoban walls, **physicsdrop shapes (invisible in dark)**.
- Light chassis got R33's daylight pass — dark mode now needs the same audit pass.

**Verb hierarchy**
- Exactly ONE accent-styled primary per card (Start / Deal / Fire / Roll / Drop). Today: blackjack Deal hides among 4 equal buttons; artillery FIRE is 4th in a chip row; unscramble Skip outranks the game itself.
- Restart never reads as disabled ("Playing…" button in breakout is a status masquerading as a control → make it a text chip).

**End-of-run ceremony (one token set)**
- Three exist and disagree: LEVEL UP panel (great), "GAME OVER" text (breakout, colorsnap), silent board-reset (lightsout clear, stacktower death). Standardize: run summary = outcome + score + delta-vs-best + one verb button, same panel as LEVEL UP, tier-hued.
- Winning line/goal states: xox's winning row, dropfour's four, bubbleshoot's clear — none highlighted. Draw a 2px accent stroke on the winning cells.

**Toast layer**
- Toasts land on the card title and overlap it (wouldyourather shots: trophy/share toasts eat "Would You Rather"; the XP pill already collides at 390px). Move toast column to below the title row, or top-center over the playfield.

**Meta integration = the deck's unfair advantage — standardize it**
- The BEST 374 · DEPTH 43% sparkline footer (spinner, stacktower, reaction light shot) is brilliant and exists on only ~3 cards. Put the depth/best readout on EVERY scored card's hint row.
- Keep: tier-up floats, trophy toasts, ×2 pick badge, LEVEL UP panels. These landed repeatedly during play and they work.

---

## 1 · CROSS-CUTTING FINDINGS (ranked by damage)

1. **Invisible playfields in dark mode** — 8 games hide their own boards (see contrast floor). Worst: physicsdrop (shapes unseeable), maze, minesweeper.
2. **Dead vertical space** — 15+ games float a small board in a 700px card with 30–45% nothing below (aquarium, balloonpop, xox, snake, unscramble, whackmole, blackjack, chainlink). Playfield must flex; sokoban/TD boards should scale UP, not float.
3. **First-tap affordance gap** — codebreaker (no active slot), chainlink (no selection state), plinko (drop zone unclear), bubbleshoot (aim line is 1px), typespeed (focus dance), simonsays (whose turn?). A 2s "tap here first" pulse fixes all of them.
4. **Win moments are silent** — lightsout board-clear → instant new board; stacktower death → instant reset; xox win row unmarked. The deck pays XP for these and shows nothing.
5. **Cryptic glyphs** — lives/hearts drawn as zigzag "~~~" (breakout, perfectring); wind "−0.6" unitless (artillery); "0.0/s" rate (anthill); dots in drawer rows (1 dot? 2 dots?).
6. **Duplicated hint text** (6 games) and **in-card microcopy collision** ("Tap to begin" under breathe's ring overlaps it).
7. **Stat rows below 10px** — TD, maze, kingdom header, drawer eyebrows. The data is good; the ink is dust.
8. **Palette outliers** — anthill's brown disc, sanddrag's sand pad, etch's cream canvas: fine as "screen surfaces", but three games (kaleidoscope, tonepad pads, spinner disc) hardcode hues that ignore the skin axis while others follow it. Pick one rule: screens keep phosphor, chrome follows skin.
9. **Numbered answer sets in trivia** ("1, 2, 3, 4" as options) — the only content-quality break in the deck.
10. **Blind-spot telemetry**: reaction's avg5 line overflows its result card; whackmole Start resisted synthetic tap (worth a real-device check).

---

## 2 · SETTINGS — rearrange, add, personalize

**Current sheet** (17 controls in 4 groups: GAME / CONTROLS / APPEARANCE / YOUR DATA) is honest and well-copywritten. The problems are ordering, grouping logic, and missing accessibility basics.

**Rearrange → 5 groups, one mental model ("how it plays / how it looks / who I am / my data"):**
1. **PLAY** — Sound · Interface sounds · Haptics · Haptic strength · Volume · Navigation arrows · Left-handed arrows *(the feel cluster; today it's split across two sections)*
2. **SCREEN** — Color scheme · CRT skin · Screen glow · CRT effects · Reduce motion *(all visual, one place; motion is visual, not "game")*
3. **ACCESS** — NEW: Text size · NEW: Colorblind symbols · NEW: Board scale · Reduce motion (mirrored here or moved here) · Glow OFF alias for photosensitivity
4. **SESSION** — Lock scroll · Keep screen awake · Fullscreen · Daily nudge
5. **DATA** — Export · Import · Replay tiers hint · Clear all · Install *(unchanged; well written)*

**New recommended settings (ship these five):**
- **Text size** (S/M/L) — scales the 11px floor to 13px. The stat-row dust is the deck's #1 accessibility debt.
- **Colorblind symbols** — adds shapes to color-only signals: bubbleshoot/chainlink dots, simonsays pads, mini2048 tiles, colormix sliders, dropfour discs. One CSS class, ~10 games benefit.
- **Board scale** (S/M/L) — zoom for grid games (sokoban's 150px board, minesweeper 8×8 at 320px). Games read a CSS var, renderers scale.
- **Flash reduction** (on top of Reduce motion) — colorsnap/flapdot/perfectring emit full-bloom flashes; motion-off doesn't cover single-frame flashes. Photosensitivity-safe tier.
- **Auto night chassis** — schedule LIGHT↔DARK by local hour (19:00–07:00). The chassis system already re-grades live (R33) — this is a timer + one call.

**Personalization approaches (roadmap order):**
1. **MY SHELF** — favorites (star) already exist; promote them into a virtual drawer filter that reorders the DECK itself (pinned cards cycle first). Zero new data.
2. **Deck order = user order** — drag-to-order in drawer, stored under __deck_meta__ (single-writer discipline already there).
3. **Skin per-cartridge override** — "this game in VIOLET" from the card's ⋯ menu; skins are tokens, the plumbing exists.
4. **FOR YOU order** — deck sorts by (recency↑, depth%↓, tend-neglect↑) using data already collected. The shell becomes a curator, not a slot machine.
5. **Profile ring color** — LV ring hue = earned tier (NEON→SUPERNOVA) instead of fixed accent; identity through progress, zero new systems.
6. **Two local profiles** — sibling-proof the save (state keys already namespaced; prefix layer is one function).

---

## 3 · THE CARTRIDGES

### 01 · Ant Colony `anthill` — COLONY · idle
- **KEEP:** vault-capped economy is the smartest idle loop in the deck; big tap disc is honest thumb bait; upgrade rows scan fast.
- **CHANGE:** 4 upgrade rows are visually identical — tint per line (production/vault/defense) + show AFFORDABLE state (cost turns amber when food ≥ price, dim otherwise). "0.0/s" rate → "0/s · vault 0/150" merged into the vault row.
- **ADD:** a collect float (+1 ▲ from the disc) — the core verb currently has zero feedback; a "raids in 4h" timer if soldiers exist.
- **REMOVE:** duplicate instruction ("Tap to collect into Food" + shell hint say the same thing).
- **FEEL:** patient, well-made, but tapping the disc feels like tapping a table.

### 02 · Tiny Aquarium `aquarium` — COLONY · idle
- **KEEP:** daylight water in LIGHT mode is lovely; feed economy caps are honest.
- **CHANGE:** tank is a 300×150 box floating in ~45% empty card — tank should fill the playfield slot (flex-1) and fish should scale up 2×. One 8px dot = aquarium with no fish visible.
- **ADD:** fish name/size on tap (identity makes care matter); hunger ripple when food runs out; ALBUM explanation ("tap a fish to see species" — 0/8 is a mystery number today).
- **REMOVE:** duplicated hint line.
- **FEEL:** the loneliest card in the deck — one dot, four buttons, emptiness.

### 03 · Artillery Duel `artillery` — GAME · physics *(deep states not reached blind)*
- **KEEP:** best header in the deck (YOU/AI/W-L/STREAK/BEST), daylight sky in LIGHT, tank silhouettes.
- **CHANGE:** FIRE is buried after difficulty chips — make it the single accent button; wind "−0.6" needs units (+ tail indicator on the crosshair); sliders need value bubbles while dragging.
- **ADD:** previous-shot ghost trail (aim memory = the actual skill); impact splash; "enemy adjusting…" line during AI turn so the wait reads as turn, not hang.
- **REMOVE:** nothing — cleanest card structure audited.
- **FEEL:** reads like a real game, plays (blind) like a screenshot — the one verb that matters isn't visually first.

### 04 · Balloon Pop `balloonpop` — REFLEX · 60s
- **KEEP:** pink balloon art, honest bomb promise, TIME color coding.
- **CHANGE:** spawn density is starved — 1 balloon on screen in 9 of 10 shots; 60s of this is dead air. Spawn 3–5 concurrent with size/height variety.
- **ADD:** pop burst particles + score float; combo counter; bomb = visual difference beyond shape (fuse spark) before tap, not after.
- **REMOVE:** the empty 40% below the field — field should flex to card bottom.
- **FEEL:** a pop-fest with no balloons is a screensaver. Best-ROI density fix in the deck.

### 05 · Blackjack 21 `blackjack` — CARDS
- **KEEP:** virtual-chips disclaimer footer (perfect), chip sizing buttons, BANK readout.
- **CHANGE:** the felt is a borderless dark rectangle — invisible as a "table" in DARK (shot 9's linen felt proves the token works; dark needs the border + vignette). Deal must be the accent button; Hit/Stand/Double are the active row mid-hand.
- **ADD:** actual card rendering in idle state (a face-down deck graphic — today the table is empty black); chip-stack pips on BET; dealer reveal animation.
- **REMOVE:** dead space above BANK row (pull the table up, cards need room to spread 5+ cards).
- **FEEL:** the only card where the game never visually happened in 10 shots — cards must exist.

### 06 · Blockfall `blockfall` — ARCADE
- **KEEP:** control cluster (◀ ↻ ▶ / soft / drop) is the best mobile control pad in the deck; NEXT preview; LIGHT-mode cream board is gorgeous.
- **CHANGE:** board border in DARK is near-invisible (the well floats unanchored) — 1px --line + inner shadow. Start should sit ABOVE the controls (it's the first verb, it's last in column).
- **ADD:** line-clear flash + score float; level-up speed warning tint; hold-piece slot (classic QoL).
- **REMOVE:** nothing structural.
- **FEEL:** tight controls, invisible arena — one border away from feeling pro.

### 07 · Blob Merge `blobmerge` — PUZZLE
- **KEEP:** chunky numbered blobs read great; merge-with-gravity is a good mini-2048 sibling.
- **CHANGE:** 3-line goal paragraph at 11px = story text; compress to one line (the shell hint already says it). Board occupies ~30% of card — scale up (blobs can be 64px+).
- **ADD:** drag ghost (blob under finger), merge pulse + score float, "no moves" detection with honest end screen.
- **REMOVE:** the paragraph; duplicated hint.
- **FEEL:** good bones, empty room — it needs the board bigger and the merge to feel juicy.

### 08 · Breathe `breathe` — TOY · zen
- **KEEP:** the gradient sphere + ring is the deck's most beautiful object; session stats (TODAY/ALL TIME) are a kind touch; LIGHT-mode works.
- **CHANGE:** "Tap to begin" microcopy collides with the ring's bottom arc — move below the button. Sphere gradient ignores the skin axis (amber skin → violet sphere) while ring follows — make both follow.
- **ADD:** phase counter ("round 3 · 4-7-8 pattern"), optional soft chime on phase change (through Feedback), LONG-press for pattern picker (box/4-7-8/ coherence).
- **REMOVE:** nothing.
- **FEEL:** genuinely calming — the deck's quiet masterpiece, two nits from perfect.

### 09 · Breakout `breakout` — ARCADE
- **KEEP:** the full blind-playthrough happened here — bricks/ball/paddle/score/XP/GAME OVER all rendered; colored brick rows are correct; retry flow works.
- **CHANGE:** lives "~~~" zigzag glyph → heart pips; "Playing…" disabled button → status chip ("BALL 2"); GAME OVER panel → the standard end-of-run ceremony.
- **ADD:** paddle hit-angle indicator (tiny arc on impact), brick-break particles (even 3px), next-level wall pattern variety.
- **REMOVE:** nothing.
- **FEEL:** plays like the arcade classic it is — the deck's reference implementation.

### 10 · Bubble Shooter `bubbleshoot` — PUZZLE
- **KEEP:** candy board pops against dark; reload bubble + next-bubble pairing; LIGHT mode is candy-shop good.
- **CHANGE:** aim line is 1px × 30px — either a full dotted trajectory to first impact or a wider guide fan; ~200px of dead space between board and shooter — pull shooter up, board down, meet in the middle.
- **ADD:** wall-bounce preview dots on the aim line (the skill the game actually wants); pop animation cluster; "ceiling approaching" tint at 2 rows left.
- **REMOVE:** nothing.
- **FEEL:** looks ready, aims blind — the aim guide is the whole game.

### 11 · Chain Link `chainlink` — PUZZLE
- **KEEP:** 6×6 dot field is clean; 4-color palette is colorblind-tolerable but needs the symbols setting.
- **CHANGE:** zero visible selection state in any of 10 shots — drag chains must highlight (dots glow + connecting line while dragging). Dots ~24px with tight gaps — grow to 30px+ (thumb error rate).
- **ADD:** chain-length score preview while dragging ("×5 = 25"); floating-cluster fall animation; daily board seed (shareable).
- **REMOVE:** dead space below (board should center in flex-1).
- **FEEL:** the deck's best drag concept that currently refuses to talk to your finger.

### 12 · Code Breaker `codebreaker` — LOGIC
- **KEEP:** mastermind peg feedback rows, 3 difficulties, honest BEST (inverted encoding now declared).
- **CHANGE:** no active-slot indicator — first-time users see 8 faint empty rows and 6 pegs with no invitation; pulse the active row. Guess rows are near-invisible outlines in DARK.
- **ADD:** tap-peg → fills next slot (verify current interaction: blind taps placed nothing in 8 shots); right-click/long-press to clear a peg; row history stays visible after submit with pegs rendered.
- **REMOVE:** nothing.
- **FEEL:** a logic game that hides its own paper — needs the worksheet feel.

### 13 · Color Lab `colormix` — TOY
- **KEEP:** target-vs-mix swatch comparison is the correct design; slider hue-tracks (R/G/B); LIGHT mode re-grade works.
- **CHANGE:** sliders lack value labels — show % under each thumb while dragging; "MATCHED 0 · BEST –" header is dust-sized; closeness feedback ("Getting close…") is text-only — add a distance ring on the target swatch.
- **ADD:** delta readout ("±12") after each match; streak mode (5 targets timed); skin-follow slider accents.
- **REMOVE:** the 45% empty bottom — sliders + swatches can breathe lower.
- **FEEL:** a puzzle wearing a toy's clothes, quietly excellent, needs one meter to feel fair.

### 14 · Color Snap `colorsnap` — REFLEX · stroop
- **KEEP:** giant stroop word is instantly readable; MATCH/MISMATCH verb pair is the correct minimal UI; LIGHT word "GREEN" on paper works.
- **CHANGE:** GAME OVER persisted 6 consecutive shots with no restart affordance visible — add "tap to retry" pulse (reaction does this right); progress bar under the word is too thin to read peripherally.
- **ADD:** per-word timing grade ("fast!", "hesitant"); miss explanation on death ("you snapped a MATCH — word and color agreed"); streak flame at 5+.
- **REMOVE:** dead bottom 40%.
- **FEEL:** one wrong tap = a wall of pink GAME OVER and no invitation back. The loop is great; the exit from failure is broken.

### 15 · Dice Pig `dicepig` — GAME · push-your-luck
- **KEEP:** the whole card — pip die, POT glow, turn dots, BANK gating, status line voice ("A one — the 0-point pot burns"), LIGHT die is beautiful, winDepth integration.
- **CHANGE:** BANKED/GOAL/BEST row is dust — give BANKED the hero number (it's the score); die could tilt/bounce on roll (animation exists as pip shuffle — add vertical motion).
- **ADD:** running odds hint ("bank now = 41 avg win") for teaching moment; win ceremony tied to the standard panel; lose line variants when turns expire vs pot burn.
- **REMOVE:** nothing.
- **FEEL:** the deck's card-game gem — courage in 15 seconds, already award-worthy UI.

### 16 · Drop Four `dropfour` — STRATEGY
- **KEEP:** 7×6 hole grid honest, Undo present, difficulty chips, streak survives losses.
- **CHANGE:** empty holes are near-invisible dark-on-dark — holes need inner shadow/rim so the GRID reads before you play; my 8 aimed taps at columns did nothing visible (verify tap-zone = column width, not just disc center); AI move needs a drop animation + last-move ring.
- **ADD:** column hover/tap highlight (full-column tint); win-line stroke; "AI is thinking…" beat.
- **REMOVE:** dead space below Undo.
- **FEEL:** the board barely exists visually; the game behind it is worth the effort.

### 17 · Etch Pad `etch` — TOY
- **KEEP:** cream pad pops on both chassis; Color button label = current color name (smart); Save PNG; drags drew cleanly.
- **CHANGE:** "Shake to clear" is a BUTTON labeled like a gesture — rename "Clear" (or actually support shake). Theme flip appears to wipe the canvas (drawing gone in the LIGHT shot) — preserve strokes across mode changes.
- **ADD:** stroke width toggle (2 steps), eraser mode, undo last stroke; auto-save last drawing to state (restore on mount).
- **REMOVE:** nothing else.
- **FEEL:** honest fun — the deck's pocket sketchbook; two fixes from flawless.

### 18 · Flap Dot `flapdot` — REFLEX
- **KEEP:** one-tap honesty; purple bars + amber dot palette; +2 XP surfaced in HUD.
- **CHANGE:** runs died in <2s repeatedly — first 3 bars should be a grace corridor (wider gaps, slower scroll); "Tap to try again" microcopy is 11px at the field's bottom edge — needs a centered pulse.
- **ADD:** score float per bar, death shatter on the dot, best-streak marker in the field ("★ your best here" ghost bar), music-free beat tick through Feedback.
- **REMOVE:** the double hint (in-field "Tap the canvas to start" + shell hint).
- **FEEL:** brutally fair and brutally fast — needs a ramp, not a wall.

### 19 · Garden `garden` — COLONY
- **KEEP:** seed-picker modal is the best in-card dialog in the deck (9 seeds, cost/time/sell table, Close); plot health bars; sprinkler honesty (waters offline).
- **CHANGE:** upgrade rows are 2-line text blobs — convert to icon+name+cost rows like the seed table; COINS 0 start with nothing affordable — grant a first-harvest bonus path (starter seeds free).
- **ADD:** plot tap = contextual action wheel (plant/water/harvest by plant state), growth stage visuals (sprout→bud→bloom), compost toast.
- **REMOVE:** duplicated instructions.
- **FEEL:** the tend-loop champion — its dialog quality proves the deck's UI bar; the main screen should meet it.

### 20 · Kaleidoscope `kaleidoscope` — TOY
- **KEEP:** symmetric blooms are gorgeous and DRAGS WORKED (strokes accumulated shot-to-shot); Save PNG; Clear; palette adapts per chassis.
- **CHANGE:** canvas circle boundary invisible in LIGHT (white-on-white) — 1px rim; stroke hue is random — offer 5-swatch picker (still toy, more authorship).
- **ADD:** symmetry count control (4/6/8/12), stroke width, long-press = continuous sparkle trail; gallery of last 3 saves.
- **REMOVE:** nothing.
- **FEEL:** pure delight — the deck's art toy, one rim away from perfect on paper.

### 21 · Kingdom `kingdom` — COLONY
- **KEEP:** interlocking gold/food/pop loop with real loss condition; worker steppers; era goal ("next era at pop 10") gives direction; factory-cloned state hygiene.
- **CHANGE:** header (DAY/GOLD/FOOD/POP/BEST) is sub-10px dust; "the Hamlet of day 1" lowercase style breaks voice; steppers are small — pad to 44px; Advance day must be the accent verb (it's a plain outline among equals).
- **ADD:** day-summary toast (+gold −food ▲▼), building icons, population faces row; event flavor once per era.
- **REMOVE:** dead space below New kingdom.
- **FEEL:** a real strategy sim compressed into a card — one typographic pass from feeling premium.

### 22 · Lexicle `lexicle` — WORD
- **KEEP:** full game played blind — CRANE graded, keyboard states colored, "not in word list" rejection, New word/Today's word split; LIGHT cream tiles; everything about the loop.
- **CHANGE:** empty tile cells are faint outlines (grid doesn't read until filled); green/amber-only grading needs the colorblind symbols setting.
- **ADD:** hard mode toggle (revealed hints must be reused), share-result grid (□■ emoji) — the genre's ritual, streak calendar chip, definition on win.
- **REMOVE:** nothing.
- **FEEL:** the deck's daily-habit anchor — already 90% of the product it should be.

### 23 · Lights Out `lightsout` — PUZZLE
- **KEEP:** glowing cyan tiles are iconic (the phosphor fantasy, exact); moves counter; size chips; amber skin re-tints tiles correctly; solved a board blind — it's fully playable.
- **CHANGE:** board-clear was SILENT (win → fresh 4×4 with zero ceremony) — the deck's loudest missing dopamine; size chip row should show current size emphasized bigger.
- **ADD:** win flash (all tiles ripple out/in), "par" moves hint, undo single move, best-per-size display.
- **REMOVE:** nothing.
- **FEEL:** hypnotic and tactile — the win moment just doesn't exist yet.

### 24 · Maze `maze` — PUZZLE
- **KEEP:** swipe-to-star loop, 3 sizes, moves counter, inverted-encoding honesty.
- **CHANGE:** walls are ~invisible in DARK (worst contrast case with physicsdrop) — walls need --panel-2 fill + --line stroke; LIGHT mode reads far better, which proves the fix is cheap.
- **ADD:** player dot trail (breadcrumbs), "new best" ceremony, fog-of-war hard mode, swipe-anywhere (currently grid-locked?).
- **REMOVE:** dead space below board.
- **FEEL:** the concept works, the ink vanished — highest-contrast-fix ROI in the deck.

### 25 · Memory Match `memorymatch` — PUZZLE
- **KEEP:** mint card backs clean; MOVES · PAIRS header logic; 3 fields; inverted encoding declared.
- **CHANGE:** card faces are tiny single glyphs (~20px orb) — faces need distinct, larger art (6+ distinguishable symbols); amber skin turned the whole board purple (backs follow accent2 — decide one rule).
- **ADD:** flip animation (3D), pair-lock glow, move-par per field ("par 14"), streak timer optional.
- **REMOVE:** dead space below board (board can be 30% taller).
- **FEEL:** classic and functional — the faces are the memory game, and they're placeholder-grade.

### 26 · Minesweeper `minesweeper` — PUZZLE
- **KEEP:** MINES red counter, timer, long-press flag (worked in shots!), 3 fields, first-tap safety implied.
- **CHANGE:** dug vs undug cells differ by ~4% luminance — dug cells need a recessed fill; flags are 6px red dots — full-size flag glyph; number inks (R33 tokens) weren't visible at any dig depth — verify contrast per digit.
- **ADD:** flag-mode toggle switch (long-press alternative for shaky hands), win face, chord-tap (both buttons on revealed numbers), per-field best times shown.
- **REMOVE:** nothing.
- **FEEL:** the classic, running in fog — the board's own readability is the bug.

### 27 · Mini Sudoku `minisudoku` — PUZZLE
- **KEEP:** two sizes; number pads are thumb-perfect; cell selection outline; 6×6 upgrade; inverted encoding declared.
- **CHANGE:** given-cell styling inconsistent — 4×4 dims digits, LIGHT 6×6 renders givens as SOLID BLACK blocks (jarring); unify: givens = bold ink, user digits = accent.
- **ADD:** conflict highlighting (row/col/box pulse), pencil notes, timer toggle, mistake counter.
- **REMOVE:** duplicated instruction lines (top "Fill the grid — 4×4" + shell hint).
- **FEEL:** solid snack-size sudoku; the black-block givens are the one ugly surprise.

### 28 · Perfect Ring `perfectring` — REFLEX
- **KEEP:** orbit + arc timing is pure; center-text role swap (TAP TO BEGIN / score / NEW BEST); "one heart left — careful" honesty; NEW BEST 2 shown in-ring.
- **CHANGE:** "[TAP TO RETRY]" renders literal brackets — placeholder-flavored copy bug; lives zigzag again; arc-vs-dot spatial relationship needs a first-visit 1s slow-mo demo.
- **ADD:** perfect-center spark, streak multiplier display, ring speed variance per level, haptic tick when dot enters arc.
- **REMOVE:** the bracket glyphs.
- **FEEL:** one-more-go magnet — needs its retry copy and its juice.

### 29 · Gravity Drop `physicsdrop` — TOY
- **KEEP:** the concept (zero-stakes pile) fits the deck; LIGHT shot proves shapes CAN render (pink/orange squares).
- **CHANGE:** in DARK, 8 drop attempts produced ZERO visible shapes — shapes are dark-on-dark or spawn off-view; this is the deck's most broken-looking card. Fix visibility first, everything else second.
- **ADD:** shape counter, pile-height readout ("46% full"), shape palette picker, settle physics tick sounds.
- **REMOVE:** the two orphan side-dots (pink/blue) whose purpose never explains itself.
- **FEEL:** a toy the player can't see — can't grade its feel, only its absence.

### 30 · Plinko `plinko` — TOY
- **KEEP:** slot value row (100/30/10/5/10/30/100 with amber center), peg triangle layout, Drop ball verb, tend() hook.
- **CHANGE:** pegs are sub-visible gray dots in DARK (LIGHT proves the layout); "Tap to drop a ball" implies tap-anywhere — either honor it (tap x = drop x) or route all drops through the button.
- **ADD:** ball trail + slot bounce flash, DROPS counter increment feedback (10 shots, counter never moved — synthetic taps didn't register; real-device check), multiplier edge slots glow.
- **REMOVE:** dead space below the button.
- **FEEL:** physics promised, pebbles delivered — pegs first, then it sings.

### 31 · Pong Duel `pongduel` — ARCADE
- **KEEP:** full rally played blind (ball visible, AI scored, paddle drags tracked); chill/classic/feral chips; orange-vs-purple paddles.
- **CHANGE:** "First to 7…" is a disabled-looking button doing scoreboard duty — make it a status line; court is a small band with ~200px dead margins — court should flex to fill.
- **ADD:** score pop on point, paddle-hit blip + flash, ball speed tint (white→amber), best-streak ghost paddle.
- **REMOVE:** nothing.
- **FEEL:** playable and fair — needs the court to own the card.

### 32 · Random Fact `randomfact` — ODDBALL
- **KEEP:** fact card typography; favorite star + counter; shuffle-bag no-repeat honesty; LIGHT cream card.
- **CHANGE:** "FACT #1" label stayed #1 while content changed (elephants ≠ peanuts) — either number facts truly or drop the counter; star toggle vs Favorites(N) list button is redundant plumbing on a tiny card.
- **ADD:** category tags (space/mind/body), "since forever" total count, share-as-image, night-sky background variant.
- **REMOVE:** the Favorites list button (star long-press = list).
- **FEEL:** pleasant tap machine — numbering lie is the only wart.

### 33 · Reaction Time `reaction` — REFLEX
- **KEEP:** the state machine is flawless (wait → too-soon → TAP NOW → result with avg5 + adult baseline); BEST · DEPTH sparkline integration; ms honesty; LIGHT red-on-paper.
- **CHANGE:** result text overflows the mint card (6 cramped lines) — result card needs the standard end-of-run panel; too-soon state = info blue, should be warn amber.
- **ADD:** 5-tap rolling average graph, false-start counter, "share ms" card.
- **REMOVE:** nothing.
- **FEEL:** the purest reflex toy, slightly outgrowing its card.

### 34 · Rhythm Tap `rhythmtap` — REFLEX
- **KEEP:** closing-ring timing is legible; TAP pad; SUPERNOVA TOUCH trophy toast captured mid-play (the depth ladder pays here — visible!).
- **CHANGE:** hit grades (perfect/good) never surfaced in any shot — blind taps mostly "Missed" with a bare pink word; pad is ~130px in a 350px field — 2× it.
- **ADD:** grade text + ring color per grade, combo pitch rise (Feedback tones), BPM selection, 16-beat runs with accent beats.
- **REMOVE:** dead space around the pad.
- **FEEL:** the meta loves it, the timing feedback is mute — grades on screen, please.

### 35 · Mini 2048 `mini2048` — PUZZLE
- **KEEP:** arrows + swipes both worked (score 0→20, merges real); 8-tile amber step in the ramp; LIGHT cream tiles are the classic look; sparkline footer.
- **CHANGE:** dark tile ramp 2-vs-4 is nearly the same gray — daylight the dark ramp (the CSS class ramp exists, re-grade it); SCORE/BEST pills dust-sized.
- **ADD:** merge pulse, score float per merge, board-size option (4×4/5×5), undo one move (costs a move count).
- **REMOVE:** the ~35% empty bottom.
- **FEEL:** the classic, playable, one contrast pass from being the deck's default time-killer.

### 36 · Sand Drag `sanddrag` — FIDGET
- **KEEP:** raking grooves WORK and accumulate beautifully; "Smooth sand" verb copy; golden pad holds identity on both chassis.
- **CHANGE:** groove contrast is subtle at rest — deep strokes should darken; pad corners vs card radius mismatch (pad is square-ish in rounded card).
- **ADD:** rake width via pressure/speed, zen sound (soft granular sweep through Feedback, gated on Sound), pattern stamps (spiral rake).
- **REMOVE:** nothing.
- **FEEL:** the deck's best zero-stakes toy — tactile, quiet, real.

### 37 · Sequence `simonsays` — PUZZLE · memory
- **KEEP:** the 2×2 quad pads are bold, beautiful, Simon-correct; LIGHT keeps hues; Start gating.
- **CHANGE:** no "WATCH / YOUR TURN" state indicator — the player never knows whose beat it is (flash timing was invisible to 10 shots; real users need the turn banner). ROUND counter stayed 0 through taps (start flow unclear).
- **ADD:** turn banner ("WATCH…" / "REPEAT 3"), pad press ripple, speed-up tick per round, fail shake + replay of correct sequence (learning mode).
- **REMOVE:** dead space below Start.
- **FEEL:** the memory classic — one state banner away from feeling fair.

### 38 · Slide Puzzle `slidepuzzle` — PUZZLE
- **KEEP:** numbered tiles read great, MOVES counter, 3 sizes, always-solvable shuffles, tiles big enough for thumbs.
- **CHANGE:** the gap cell is invisible in DARK (empty slot blends into panel — the puzzle's negative space is its most important cell): give the gap a recessed well; LIGHT proves it.
- **ADD:** solved-state ceremony (tiles ripple + time/moves), target-order ghost numbers (optional aid), shuffle animation, best-per-size.
- **REMOVE:** dead space below Shuffle.
- **FEEL:** honest 15-puzzle — the invisible gap is the only real crime.

### 39 · Crate Push `sokoban` — PUZZLE
- **KEEP:** 20 levels + Daily; Undo (the humane verb); d-pad + Reset + Levels/Daily structure; par shown.
- **CHANGE:** the level board is ~150px wide floating in a 350px card — scale boards to fill (cells 40px+); header crams LEVEL/MOVES/PB/par into one wrapping line; "par 2" text wrapped mid-word in shots.
- **ADD:** crate-on-target glow + level-complete ceremony, move-par compare, replay ghost of best solution, dark-mode wall texture bump.
- **REMOVE:** the dead band between board and controls (~150px).
- **FEEL:** a puzzle game hiding in a matchbox — scale it and it's console-grade.

### 40 · Snake `snake` — PUZZLE
- **KEEP:** mint snake + pink food pop nicely; two-tone snake in amber shot (head accent) is a nice touch; R0 fixes mean win state exists.
- **CHANGE:** 10 shots = snake never started (Start not pressed by blind flow, and arrows don't start) — allow arrows/swipe to start; board has NO border (floats in void); food placement can overlap HUD-adjacent cells.
- **ADD:** board grid dots (subtle), eat pulse + score float, speed warning tint at length 15, death ceremony with length recap, swipe + arrow co-equality stated in hint.
- **REMOVE:** dead space below Start.
- **FEEL:** the classic, correctly built, presentational Ghost — border it and start it.

### 41 · Spinner `spinner` — FIDGET
- **KEEP:** the disc is beautiful; RPM readout honest; NEON tier float + "+25 XP NEW BEST" + "BEST 374 · DEPTH 43%" sparkline — a TOY with the full meta engine visible, exactly the right integration.
- **CHANGE:** disc gradient ignored the skin axis in dark/ice but followed it in amber/light — one rule (follow it always); RPM caption swaps position with "flick to spin" — anchor one line that morphs.
- **ADD:** spin-down whoosh, flick-strength meter (peak rpm ghost), spin-time stat, bearing upgrade joke line at 1000 rpm.
- **REMOVE:** nothing.
- **FEEL:** proof that zero-stakes + meta hooks = retention. The deck's quiet geniuses.

### 42 · Stack Tower `stacktower` — REFLEX
- **KEEP:** colored blocks per level (amber/purple/pink/green), overhang slicing visible, HEIGHT/BEST, DEPTH 100% sparkline, R0 spawn bug long dead.
- **CHANGE:** death → instant reset with no summary (height achieved vanishes); tower stays bottom-anchored — at height 15+ the camera must rise (verify; can't reach blind).
- **ADD:** perfect-drop pulse + streak ("PERFECT ×3"), cut-piece fall animation (the sliced slab tumbling), death panel (height/best/delta), subtle camera rise.
- **REMOVE:** nothing.
- **FEEL:** the dopamine loop is real — it just forgets to say goodbye.

### 43 · This or That `thisorthat` — ODDBALL
- **KEEP:** option cards with emoji are charming; PICKED counter; "you lean LEFT · 100%" — the running identity line is the hook; LIGHT cream cards.
- **CHANGE:** "100%" after ONE pick is statistically silly — hide the lean line until n≥5, then show it; the middle emoji button's purpose never explains itself.
- **ADD:** past-picks log (drawer or long-press), streak of same-side answers ("left-leaning week"), share pair-of-the-day, 100-question milestone badge.
- **REMOVE:** nothing else.
- **FEEL:** lightweight personality mirror — needs its memory made visible.

### 44 · Tone Pad `tonepad` — TOY
- **KEEP:** pastel pad grid (LIGHT version is lovely), REC/Play loop, all audio through Feedback.
- **CHANGE:** pads have zero pitch affordance — add note labels or a pitch ladder (low→high) so the grid maps to sound; REC state needs a timer/loop-length ring while recording.
- **ADD:** clear-loop button, tempo tap, pad press glow + haptic, record playback indicator, pentatonic scale choice.
- **REMOVE:** the 45% empty bottom (pads can be 25% bigger).
- **FEEL:** a real instrument seed — currently an unlabeled xylops.

### 45 · Tower Defense `towerdefense` — GAME *(waves not reached blind)*
- **KEEP:** GOLD/LIVES/WAVE/BEST header, tower placement with RANGE RINGS visible on tap, 3 tower chips with costs, "Not enough gold" inline error, spawn/base markers, BFS honesty.
- **CHANGE:** tower chips are tiny; the checkered board is subtle (path dots too); Start wave buried after chips — promote.
- **ADD:** enemy preview before wave ("7 foes · normal" exists — show sprites), tower tap = upgrade/sell popover (exists per hint — verify reachability), wave-clear gold float, range circle persists while placing.
- **REMOVE:** nothing.
- **FEEL:** the deck's most ambitious systems card — placement already feels strategic blind.

### 46 · Trading Post `tradingpost` — COLONY
- **KEEP:** goods rows with PRICE SPARKLINES + ▲▼ arrows = the best data-viz in the deck; Buy/Sell disabled logic visible; ×1/×10/MAX sizing; Guild ladder copy; LIGHT re-grade complete.
- **CHANGE:** "Hire trader (400g) — 0/5 · 0g/s" is unreadable shorthand; goods icons are 10px; header 4 stats dust; Guild row looks like text but may be a button — affordance unclear.
- **ADD:** profit/loss color on trades, market-event banner ("GRAIN FESTIVAL +50%"), caravan progress bar, tooltip-free plain-language hover line.
- **REMOVE:** nothing.
- **FEEL:** a portfolio sim that respects the player — needs one typography pass to stop whispering.

### 47 · Quick Trivia `trivia` — PUZZLE
- **KEEP:** stacked full-width answers = thumb-perfect; progress N/10 bar; question quality mostly solid; score banks across run.
- **CHANGE:** "How many hearts does an octopus have? → 1, 2, 3, 4" — numeric-sequence distractors break the quiz contract; audit the pool for this pattern; right/wrong flash was never visible in shots (make it 300ms+ persistent marker).
- **ADD:** answer explanation line ("octopuses have 3"), streak bonus, category mix chip, BEST RUN updates mid-run.
- **REMOVE:** nothing.
- **FEEL:** a solid quiz undermined by one lazy question archetype.

### 48 · Type Speed `typespeed` — REFLEX
- **KEEP:** pangram phrases; WPM/ACC/BEST header concept; tap-to-focus field.
- **CHANGE:** phrase box never showed typed progress in 10 shots (no per-letter coloring visible) — live character-by-character highlight is the entire genre; WPM "–" until completion means no mid-run feedback; input focus dance on mobile should be one tap (autofocus on mount).
- **ADD:** per-letter states (done=amber, wrong=red shake), WPM live ticker, phrase difficulty tiers, error forgiveness setting.
- **REMOVE:** nothing.
- **FEEL:** the right words, silent scoreboard — it must show progress as you type.

### 49 · Unscramble `unscramble` — PUZZLE
- **KEEP:** letter tiles with place-and-dim feedback (tap worked: N filled slot 1); Skip/Clear; word variety (6-letter pool).
- **CHANGE:** answer slots are faint outlines (the target state is invisible); Skip is green-accent while the game's real verb (tapping letters) has no home button — swap emphasis.
- **ADD:** hint (reveal one letter, costs solved-streak), solved ceremony + word meaning, timer-free "streak" framing, keyboard input for desktop.
- **REMOVE:** the 45% dead bottom.
- **FEEL:** a clean word snack with no stage — build the slots a home.

### 50 · Whack-a-Mole `whackmole` — REFLEX
- **KEEP:** 3×3 hole grid honest; 30s framing; Start gating.
- **CHANGE:** holes are dark-brown-on-dark (invisible); LIGHT shot shows holes as PURE BLACK discs (too bold) — neither chassis reads right; Start resisted synthetic tap (10 idle shots) — real-device check.
- **ADD:** mole pop animation (raise from hole), hit star + miss dust, escape taunt line, speed ramp per 10s, combo multiplier.
- **REMOVE:** dead space below Start.
- **FEEL:** the grid is there, the moles never showed — the deck's most unfinished-looking reflex card.

### 51 · Would You Rather `wouldyourather` — ODDBALL · daily pick
- **KEEP:** vote-split FILLS THE BUTTON BACKGROUNDS (25%/75%) — brilliant, instant, honest; "an imaginary crowd agrees… (no one else is asked — this is offline)" is the deck's brand voice at its best; ×2 pick badge; vote memory.
- **CHANGE:** trophy/share toasts OVERLAP the card title (repeated across shots) — toast layer placement; Reset my votes is one tap from destruction — confirm sheet.
- **ADD:** question author credit + submit-your-own (local), category tags, "your pick history" strip, streak for answering 7 days.
- **REMOVE:** nothing.
- **FEEL:** the daily-ritual centerpiece — the split-fill is the single best UI idea in the audit.

### 52 · XOX `xox` — GAME · minimax
- **KEEP:** honest minimax ("force a draw" is real — AI won the blind game), Easy/Medium/Hard, YOU/DRAWS/AI record, clean grid.
- **CHANGE:** "AI wins." is a plain line — no winning-line stroke, no ceremony; X and O marks are both cyan-family — player/AI marks need hue contrast (amber X vs cyan O); grid borders faint in DARK.
- **ADD:** winning-line animation, draw ceremony (minimax pride: "you held the machine"), score persistence display, AI "thinking" beat on Hard.
- **REMOVE:** dead space below New round.
- **FEEL:** a fair duel told in a flat voice — one stroke of paint from drama.

---

## 4 · PRIORITY MATRIX (what moves the deck most per hour spent)

| Tier | Work | Why first |
|------|------|-----------|
| **P0 — feel-alive** | Dark-mode contrast floor (maze, physicsdrop, minesweeper, 2048 ramp, dropfour, memory, unscramble, whackmole, blockfall border, sokoban scale) | 10 games go from invisible to playable; pure CSS/token work |
| **P0 — dopamine** | Standard end-of-run ceremony + win-line strokes + lightsout/stacktower/colorsnap/xox moments | The deck pays XP everywhere but celebrates almost nowhere |
| **P1 — structure** | Shell-owned STAT ROW + single-hint rule + verb hierarchy (Deal/FIRE/Advance/Start promoted) | Kills 52 inconsistencies in one component |
| **P1 — density** | balloonpop spawns, aquarium tank fill, breakout ramp, TD court, TD enemies preview, space reclamation | Turns 6 "screenshot games" into games |
| **P2 — access** | Text size + colorblind symbols + board scale settings | The deck's goodwill play; unblocks players, not just polish |
| **P2 — meta** | Sparkline footer on every scored card; toast layer fix; XP-pill/title collision | The retention engine, surfaced everywhere |
| **P3 — voice** | Copy pass ([TAP TO RETRY], FACT #1, "100%" at n=1, "the Hamlet of day 1", blackjack footer stays) | The writing is 90% there; the last 10% is trust |

**The one-line verdict:** the deck's systems (XP, depth, trophies, daily, skins) are world-class for its size — the cartridge layer needs one centralized anatomy pass (stat row, contrast floor, verb hierarchy, ceremony) to stop hiding world-class bones behind hand-made panels.
