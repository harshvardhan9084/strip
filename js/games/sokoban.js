Strip.register({
  id: "sokoban",
  label: "PUZZLE",
  title: "Crate Push",
  tag: "20 levels",
  hint: "Push crates onto the dots · U to undo",
  async mount(container, api){
    const state = await api.load();
    let levelIdx = state && Number.isFinite(state.level) ? state.level : 0;
    let bests = state && Array.isArray(state.bests) ? state.bests : [];
    // unlocked = highest level index reachable in the select grid (legacy saves
    // only stored the current level — adopt it as the unlock floor)
    let unlocked = state && Number.isFinite(state.unlocked) ? Math.max(state.unlocked, levelIdx) : levelIdx;
    let daily = state && state.daily ? state.daily : { last: "", streak: 0 };

    // Round 19 (AUDIT.md DEEP DIVE 3 — "only 5 levels" / the very short end):
    // the shelf grew from 5 boards to 20 with a real difficulty curve, a
    // level-select grid with PB stars, an ALL-CLEAR ceremony, and a seeded
    // DAILY CRATE so the strip has a tomorrow. Every level below was verified
    // solvable by a BFS/push-A* solver before shipping (scripts/ in the repo
    // history holds the verifier); pars come from solver-optimal move counts
    // (par = optimal × 1.4, rounded up) so a star means "at the solver's pace".
    const LEVELS = [
      // 1–5 · the original handcrafted five
      [
        "#######",
        "#     #",
        "# @$. #",
        "#     #",
        "#######"
      ],
      [
        "#######",
        "#     #",
        "# .$. #",
        "# @   #",
        "#     #",
        "#######"
      ],
      [
        "#######",
        "#     #",
        "# .#  #",
        "# $@  #",
        "#     #",
        "#######"
      ],
      [
        "#########",
        "#       #",
        "# $ .   #",
        "#  @$.  #",
        "#       #",
        "#########"
      ],
      [
        "########",
        "#      #",
        "# .$   #",
        "# @    #",
        "# $  . #",
        "#      #",
        "########"
      ],
      // 6–20 · the expansion: singles teach the push, doubles teach routing,
      // walls teach order-of-operations, the finale stacks four crates
      [
        "#########",
        "#  ..   #",
        "#  $$   #",
        "#  @    #",
        "#       #",
        "#########"
      ],
      [
        "#######",
        "#     #",
        "#@$ . #",
        "#  $ .#",
        "#     #",
        "#######"
      ],
      [
        "###########",
        "#         #",
        "#  .###   #",
        "#  $  @   #",
        "#  $   .  #",
        "#         #",
        "###########"
      ],
      [
        "##########",
        "#        #",
        "#   ##   #",
        "#  $  $  #",
        "#  @     #",
        "#  .  .  #",
        "#        #",
        "##########"
      ],
      [
        "##########",
        "#        #",
        "#  $ $   #",
        "#   @    #",
        "#   . .  #",
        "#        #",
        "##########"
      ],
      [
        "##########",
        "#        #",
        "# .$ $ . #",
        "#   @    #",
        "#  $..$  #",
        "#        #",
        "##########"
      ],
      [
        "##########",
        "#        #",
        "#  ####  #",
        "#  $  .  #",
        "#  @  $  #",
        "#  .     #",
        "#        #",
        "##########"
      ],
      [
        "#########",
        "#       #",
        "#   $   #",
        "#  $@$  #",
        "#   .   #",
        "#  . .  #",
        "#       #",
        "#########"
      ],
      [
        "#########",
        "#       #",
        "# $ $ $ #",
        "#   @   #",
        "# . . . #",
        "#       #",
        "#########"
      ],
      [
        "#########",
        "#       #",
        "#  #$.  #",
        "#  @    #",
        "#  $  . #",
        "#       #",
        "#########"
      ],
      [
        "##########",
        "#  $  .  #",
        "#  #     #",
        "#  @  .  #",
        "#  $     #",
        "#      ###",
        "##########"
      ],
      [
        "###########",
        "#  .   .  #",
        "#  $ # $  #",
        "#   @   # #",
        "#  $ . $  #",
        "#    .    #",
        "#         #",
        "###########"
      ],
      [
        "#########",
        "#       #",
        "#  $$   #",
        "#  @  ..#",
        "#       #",
        "#########"
      ],
      [
        "###########",
        "#         #",
        "# $$   $  #",
        "#  @      #",
        "#  .   .  #",
        "#    .    #",
        "#         #",
        "###########"
      ],
      [
        "###########",
        "#         #",
        "#  $ $ $  #",
        "#    @    #",
        "#  . . .  #",
        "#    $    #",
        "#  .      #",
        "###########"
      ]
    ];
    const PARS = [2,3,5,10,12, 6,9,19,21,20, 21,23,26,26,26, 26,26,27,34,32];

    // DAILY CRATE: the day string seeds a stable pick from the full shelf.
    // Completing it (any level, once per day) grows a streak — the audit's
    // "so the strip has a tomorrow" hook.
    function todayStr(){
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
    }
    function dailyLevelIdx(){
      const t = todayStr();
      let h = 0;
      for(let i=0;i<t.length;i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
      return h % LEVELS.length;
    }
    let dailyActive = false; // currently playing the daily pick?

    let walls, crates, goals, player, moves, history, done;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const boardWrap = document.createElement("div");
    boardWrap.style.cssText = "position:relative;";
    wrap.appendChild(boardWrap);

    const board = document.createElement("div");
    board.style.cssText = "position:relative; line-height:0;";
    boardWrap.appendChild(board);

    // ALL-CLEAR ceremony overlay (S8 fix): the old game froze on a cleared
    // board after level 5 with no recap and no exit. Now the last clear gets
    // a proper tombstone-to-triumph card.
    const overlay = document.createElement("div");
    overlay.style.cssText = "display:none; position:absolute; inset:0; background:rgba(10,10,16,0.88); border-radius:10px; flex-direction:column; align-items:center; justify-content:center; gap:10px; text-align:center; z-index:5; padding:12px; box-sizing:border-box;";
    boardWrap.appendChild(overlay);

    const ctrlRow = document.createElement("div");
    ctrlRow.style.cssText = "display:flex; gap:8px; justify-content:center;";
    wrap.appendChild(ctrlRow);

    function mkBtn(label, fn){
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = label;
      b.style.minWidth = "46px";
      b.addEventListener("click", fn);
      return b;
    }

    const upBtn = mkBtn("▲", () => move(-1, 0));
    const leftBtn = mkBtn("◀", () => move(0, -1));
    const downBtn = mkBtn("▼", () => move(1, 0));
    const rightBtn = mkBtn("▶", () => move(0, 1));
    ctrlRow.appendChild(leftBtn);
    const midCol = document.createElement("div");
    midCol.style.cssText = "display:flex; flex-direction:column; gap:8px;";
    midCol.appendChild(upBtn);
    midCol.appendChild(downBtn);
    ctrlRow.appendChild(midCol);
    ctrlRow.appendChild(rightBtn);

    const undoBtn = mkBtn("Undo", undo);
    undoBtn.style.minWidth = "60px";
    const resetBtn = mkBtn("Reset", () => loadLevel(levelIdx));
    resetBtn.style.minWidth = "60px";
    ctrlRow.appendChild(undoBtn);
    ctrlRow.appendChild(resetBtn);

    const selectRow = document.createElement("div");
    selectRow.style.cssText = "display:flex; gap:8px; justify-content:center;";
    wrap.appendChild(selectRow);
    const levelsBtn = mkBtn("Levels", () => toggleSelect());
    levelsBtn.style.minWidth = "60px";
    selectRow.appendChild(levelsBtn);
    const dailyBtn = mkBtn("Daily", () => startDaily());
    dailyBtn.style.minWidth = "60px";
    selectRow.appendChild(dailyBtn);

    // the select grid: every level shows its number, a PB move count, and a
    // ★ when the PB beats the solver-derived par. Locked levels stay visible
    // but dimmed — a visible "next" is itself a pull.
    const grid = document.createElement("div");
    grid.style.cssText = "display:none; position:absolute; inset:0; background:rgba(10,10,16,0.92); border-radius:10px; z-index:4; padding:12px; box-sizing:border-box; overflow:auto;";
    boardWrap.appendChild(grid);
    function toggleSelect(force){
      const show = force !== undefined ? force : grid.style.display === "none";
      grid.style.display = show ? "block" : "none";
      if(show) renderGrid();
    }
    function renderGrid(){
      grid.innerHTML = "";
      const title = document.createElement("div");
      title.style.cssText = "font-size:10px; color:var(--ink-dim); margin-bottom:8px; text-align:center;";
      title.textContent = "★ = PB within solver par";
      grid.appendChild(title);
      const cells = document.createElement("div");
      cells.style.cssText = "display:grid; grid-template-columns:repeat(5,1fr); gap:6px;";
      LEVELS.forEach((_, i) => {
        const b = document.createElement("button");
        b.className = "btn";
        const locked = i > unlocked;
        b.style.cssText = "padding:7px 2px; font-size:10px; display:flex; flex-direction:column; align-items:center; gap:1px;" +
          (locked ? " opacity:0.35;" : "") +
          (i === levelIdx && !dailyActive ? " border-color:var(--amber);" : "");
        const star = bests[i] != null && bests[i] <= PARS[i] ? " ★" : "";
        b.innerHTML = `<b>${i+1}${star}</b><span style="font-size:8px; color:var(--ink-dim)">${bests[i] != null ? bests[i] + "mv" : (locked ? "locked" : "—")}</span>`;
        if(!locked) b.addEventListener("click", () => { dailyActive = false; levelIdx = i; saveState(); toggleSelect(false); loadLevel(i); });
        cells.appendChild(b);
      });
      grid.appendChild(cells);
      const close = mkBtn("Close", () => toggleSelect(false));
      close.style.marginTop = "10px";
      grid.appendChild(close);
    }
    function startDaily(){
      const t = todayStr();
      const already = daily.last === t;
      if(already){
        statRow.innerHTML = `DAILY CRATE — done today · streak <span style="color:var(--amber)">${daily.streak}</span>`;
      }
      dailyActive = true;
      levelIdx = dailyLevelIdx();
      loadLevel(levelIdx);
      toggleSelect(false);
      if(already) statRow.innerHTML = `DAILY CRATE — replay · streak <span style="color:var(--amber)">${daily.streak}</span>`;
      else statRow.innerHTML = `DAILY CRATE — level ${levelIdx+1} · beat it for the streak`;
    }

    container.appendChild(wrap);

    function parse(rows){
      walls = new Set(); crates = new Set(); goals = new Set();
      player = null;
      rows.forEach((line, r) => {
        for(let c = 0; c < line.length; c++){
          const ch = line[c];
          if(ch === "#") walls.add(r + "," + c);
          if(ch === "$") crates.add(r + "," + c);
          if(ch === ".") goals.add(r + "," + c);
          if(ch === "*"){ crates.add(r + "," + c); goals.add(r + "," + c); }
          if(ch === "@") player = [r, c];
        }
      });
    }

    function key(r, c){ return r + "," + c; }

    function saveState(){
      api.save({ level: levelIdx, bests, unlocked, daily });
    }

    function loadLevel(i){
      parse(LEVELS[i]);
      moves = 0; history = []; done = false;
      overlay.style.display = "none";
      render();
    }

    function render(){
      const rows = LEVELS[levelIdx].length;
      const cols = Math.max(...LEVELS[levelIdx].map(r => r.length));
      board.innerHTML = "";
      board.style.display = "grid";
      board.style.gridTemplateColumns = `repeat(${cols},18px)`;
      board.style.gridAutoRows = "18px";
      board.style.gap = "1px";
      for(let r = 0; r < rows; r++){
        for(let c = 0; c < cols; c++){
          const d = document.createElement("div");
          d.style.cssText = "width:18px; height:18px; border-radius:3px; display:flex; align-items:center; justify-content:center; font-size:11px;";
          const k = key(r, c);
          if(walls.has(k)){
            d.style.background = "var(--panel-2)";
            d.style.borderRadius = "2px";
          } else if(player && player[0] === r && player[1] === c){
            d.style.background = "var(--amber)";
            d.style.borderRadius = "50%";
          } else if(crates.has(k)){
            d.style.background = goals.has(k) ? "var(--purple)" : "#C08A3E";
            d.style.borderRadius = "3px";
          } else if(goals.has(k)){
            d.style.background = "#101018";
            d.style.boxShadow = "inset 0 0 0 2px var(--purple-dim)";
            d.style.borderRadius = "50%";
          } else {
            d.style.background = "#12121a";
          }
          board.appendChild(d);
        }
      }
      const best = bests[levelIdx];
      const parStar = best != null && best <= PARS[levelIdx] ? "★ " : "";
      const label = dailyActive ? `DAILY · level ${levelIdx+1}` : `LEVEL ${levelIdx + 1}/${LEVELS.length}`;
      statRow.innerHTML = `${label} · MOVES <span style="color:var(--ink)">${moves}</span> · PB <span style="color:var(--purple)">${best ?? "-"}</span> · par ${PARS[levelIdx]}${done ? ' · <span style="color:var(--purple)">' + parStar + 'CLEAR!</span>' : ""}`;
    }

    function move(dr, dc){
      if(done) return;
      const [pr, pc] = player;
      const nr = pr + dr, nc = pc + dc;
      const nk = key(nr, nc);
      if(walls.has(nk)) return;
      const pushing = crates.has(nk);
      if(pushing){
        const br = nr + dr, bc = nc + dc;
        const bk = key(br, bc);
        if(walls.has(bk) || crates.has(bk)) return;
        // undo snapshot BEFORE mutating — captured state must match what the
        // player saw, or Undo replays a future instead of the past
        history.push({ p: [pr, pc], c: [...crates] });
        crates.delete(nk);
        crates.add(bk);
        player = [nr, nc];
      } else {
        history.push({ p: [pr, pc], c: [...crates] });
        player = [nr, nc];
      }
      moves++;
      Feedback.haptic("light");
      checkWin();
      render();
    }

    function undo(){
      if(done || !history.length) return;
      const snap = history.pop();
      player = snap.p;
      crates = new Set(snap.c);
      moves++;
      render();
    }

    function showAllClear(){
      // total-moves tally across every PB on the shelf
      const total = bests.reduce((s, m) => s + (m || 0), 0);
      const stars = PARS.reduce((s, p, i) => s + ((bests[i] != null && bests[i] <= p) ? 1 : 0), 0);
      overlay.innerHTML = "";
      const t = document.createElement("div");
      t.style.cssText = "font-family:var(--font-display); font-size:18px; color:var(--amber); letter-spacing:2px;";
      t.textContent = "ALL CLEAR";
      const s1 = document.createElement("div");
      s1.style.cssText = "font-size:11px; color:var(--ink); line-height:1.8;";
      s1.innerHTML = `all 20 crates shipped<br>total moves <b style="color:var(--purple)">${total}</b> · par stars <b style="color:var(--amber)">${stars}/20</b>`;
      const s2 = document.createElement("div");
      s2.style.cssText = "font-size:10px; color:var(--ink-dim);";
      s2.textContent = "the DAILY CRATE resets tomorrow — keep the streak";
      const b1 = mkBtn("Level select", () => { overlay.style.display = "none"; toggleSelect(true); });
      const b2 = mkBtn("Daily crate", () => { overlay.style.display = "none"; startDaily(); });
      b1.style.minWidth = "90px"; b2.style.minWidth = "90px";
      const row = document.createElement("div");
      row.style.cssText = "display:flex; gap:8px;";
      row.appendChild(b1); row.appendChild(b2);
      overlay.appendChild(t); overlay.appendChild(s1); overlay.appendChild(s2); overlay.appendChild(row);
      overlay.style.display = "flex";
    }

    function checkWin(){
      if(![...crates].every(k => goals.has(k))) return;
      done = true;
      Feedback.buzz("win");
      const wasDaily = dailyActive;
      if(bests[levelIdx] == null || moves < bests[levelIdx]){
        bests[levelIdx] = moves;
      }
      if(levelIdx + 1 > unlocked) unlocked = levelIdx + 1;
      if(wasDaily && daily.last !== todayStr()){
        daily = { last: todayStr(), streak: daily.streak + 1 };
        Feedback.buzz("success");
      }
      saveState();
      render();
      if(wasDaily){
        // daily clears celebrate and return to the shelf — the daily level is
        // often one you've already beaten, so no unlock/advance flow
        statRow.innerHTML += ` — streak <span style="color:var(--amber)">${daily.streak}</span>!`;
        dailyActive = false;
        return;
      }
      if(levelIdx < LEVELS.length - 1){
        statRow.innerHTML += ` — next level…`;
        setTimeout(() => {
          if(!done) return; // card may have been reset meanwhile
          levelIdx++;
          saveState();
          loadLevel(levelIdx);
        }, 900);
      } else {
        // the shelf is complete — ceremony instead of silence (S8)
        setTimeout(() => { if(done && !dailyActive) showAllClear(); }, 700);
      }
    }

    function onKey(e){
      // input arbitration: only the CENTERED card takes keys (two copies of
      // a cartridge can coexist after the deck wraps; neighbors stay mounted)
      if(window.StripShell && !StripShell.isActive(container)) return;
      if(e.key === "Escape"){ toggleSelect(false); return; }
      const map = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] };
      if(map[e.key]){ e.preventDefault(); move(...map[e.key]); }
      else if(e.key === "u" || e.key === "U"){ undo(); }
    }
    window.addEventListener("keydown", onKey);

    loadLevel(Math.min(levelIdx, LEVELS.length - 1));

    return () => window.removeEventListener("keydown", onKey);
  }
});
