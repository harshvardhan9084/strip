Strip.register({
  id: "sokoban",
  label: "PUZZLE",
  title: "Crate Push",
  tag: "5 levels",
  hint: "Push crates onto the dots · U to undo",
  async mount(container, api){
    const state = await api.load();
    let levelIdx = state && Number.isFinite(state.level) ? state.level : 0;
    let bests = state && Array.isArray(state.bests) ? state.bests : [];

    // Five handcrafted levels. Legend: # wall, @ start, $ crate, . goal,
    // * crate-on-goal. Every level here is verified solvable — each crate
    // has a clear approach path and a straight run to its goal.
    const LEVELS = [
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
      ]
    ];

    let walls, crates, goals, player, moves, history, done;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const board = document.createElement("div");
    board.style.cssText = "position:relative; line-height:0;";
    wrap.appendChild(board);

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

    function loadLevel(i){
      parse(LEVELS[i]);
      moves = 0; history = []; done = false;
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
      statRow.innerHTML = `LEVEL <span style="color:var(--amber)">${levelIdx + 1}/${LEVELS.length}</span> · MOVES <span style="color:var(--ink)">${moves}</span> · PB <span style="color:var(--purple)">${best ?? "-"}</span>${done ? ' · <span style="color:var(--purple)">CLEAR!</span>' : ""}`;
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

    function checkWin(){
      if(![...crates].every(k => goals.has(k))) return;
      done = true;
      Feedback.buzz("win");
      if(bests[levelIdx] == null || moves < bests[levelIdx]){
        bests[levelIdx] = moves;
      }
      api.save({ level: levelIdx, bests });
      if(levelIdx < LEVELS.length - 1){
        statRow.innerHTML += ` — next level…`;
        setTimeout(() => {
          if(!done) return; // card may have been reset meanwhile
          levelIdx++;
          api.save({ level: levelIdx, bests });
          loadLevel(levelIdx);
        }, 900);
      }
    }

    function onKey(e){
      // input arbitration: only the CENTERED card takes keys (two copies of
      // a cartridge can coexist after the deck wraps; neighbors stay mounted)
      if(window.StripShell && !StripShell.isActive(container)) return;
      const map = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] };
      if(map[e.key]){ e.preventDefault(); move(...map[e.key]); }
      else if(e.key === "u" || e.key === "U"){ undo(); }
    }
    window.addEventListener("keydown", onKey);

    loadLevel(Math.min(levelIdx, LEVELS.length - 1));

    return () => window.removeEventListener("keydown", onKey);
  }
});
