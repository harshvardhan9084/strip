Strip.register({
  id: "lightsout",
  scoreEncoding: "inverted", scoreCeiling: 100000, // stores 100000 - moves (CLASSIC 5×5 only); NEVER double it (twist)
  label: "PUZZLE",
  title: "Lights Out",
  tag: "3 sizes",
  hint: "Tap to toggle neighbors — clear the board",
  async mount(container, api){
    // Round 22 (P2 tail): the 5×5 was the whole game since Round 1. Now the
    // classic ladder: 4×4 warm-up, 5×5 classic (still feeds the highscore
    // store, inverted), 6×6 for the veterans — per-size bests live in the
    // save, Minesweeper-ladder style. Every puzzle stays solvable by
    // construction: scrambles are always valid toggles from the solved state.
    const SIZES = [
      { key: "junior",  label: "4×4", n: 4 },
      { key: "classic", label: "5×5", n: 5 },
      { key: "grand",   label: "6×6", n: 6 },
    ];
    const INV = 100000;
    const saved0 = await api.load().catch(() => null);
    let sizeIdx = saved0 && Number.isFinite(saved0.size) ? Math.min(2, Math.max(0, saved0.size)) : 1;
    const bests = saved0 && saved0.bests ? saved0.bests : {};
    let stored = await api.getHighscore();
    let bestClassic = stored ? INV - stored : Infinity;
    let SIZE = SIZES[sizeIdx].n;
    let best = sizeIdx === 1 ? bestClassic : (bests[SIZES[sizeIdx].key] ?? Infinity);
    let grid, moves, solved;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const sizeRow = document.createElement("div");
    sizeRow.style.cssText = "display:flex; gap:6px;";
    const sizeBtns = [];
    SIZES.forEach((d, i) => {
      const b = document.createElement("button");
      b.textContent = d.label;
      b.style.cssText = "font-size:10px; padding:4px 9px; border-radius:20px; border:1px solid var(--line); background:var(--panel-2); color:var(--ink-dim); cursor:pointer;";
      b.addEventListener("click", () => {
        if(i === sizeIdx) return;
        sizeIdx = i; SIZE = SIZES[i].n;
        best = sizeIdx === 1 ? bestClassic : (bests[SIZES[i].key] ?? Infinity);
        api.save({ size: sizeIdx, bests }).catch(()=>{});
        paintSizes();
        buildCells();
        newGame();
      });
      sizeBtns.push(b);
      sizeRow.appendChild(b);
    });
    function paintSizes(){
      sizeBtns.forEach((b, i) => {
        const active = i === sizeIdx;
        b.style.background = active ? "var(--amber)" : "var(--panel-2)";
        b.style.color = active ? "#000" : "var(--ink-dim)";
      });
    }
    wrap.appendChild(sizeRow);

    const board = document.createElement("div");
    wrap.appendChild(board);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New puzzle";
    newBtn.addEventListener("click", newGame);
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    const cells = [];
    function buildCells(){
      board.innerHTML = "";
      cells.length = 0;
      board.style.cssText = `display:grid; grid-template-columns:repeat(${SIZE},1fr); gap:6px; width:min(70vw,${SIZE * 50}px);`;
      for(let i=0;i<SIZE*SIZE;i++){
        const c = document.createElement("button");
        c.style.cssText = "aspect-ratio:1; border-radius:6px; border:none; cursor:pointer; transition:background .12s ease;";
        c.addEventListener("click", () => toggle(Math.floor(i/SIZE), i%SIZE));
        board.appendChild(c);
        cells.push(c);
      }
    }

    function render(){
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
        const el = cells[r*SIZE+c];
        el.style.background = grid[r][c] ? "var(--amber)" : "var(--panel-2)";
        el.style.boxShadow = grid[r][c] ? "0 0 14px rgba(var(--glow-rgb),.5)" : "none";
      }
      statRow.textContent = solved ? `SOLVED in ${moves} — best ${best === Infinity ? "-" : best}` : `MOVES ${moves}`;
    }

    function toggle(r, c){
      if(solved) return;
      Feedback.tone("tap"); Feedback.haptic("light");
      [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc]) => {
        const rr = r+dr, cc = c+dc;
        if(rr>=0 && rr<SIZE && cc>=0 && cc<SIZE) grid[rr][cc] ^= 1;
      });
      moves++;
      checkSolved();
      render();
    }

    function checkSolved(){
      solved = grid.every(row => row.every(v => v === 0));
      if(solved){
        Feedback.buzz("win");
        api.gameover("win", moves);
        if(moves < best){
          best = moves;
          bests[SIZES[sizeIdx].key] = moves;
          if(sizeIdx === 1){
            bestClassic = moves;
            api.setHighscore(INV - moves); // only the classic 5×5 feeds the store
          } else {
            api.save({ size: sizeIdx, bests }).catch(()=>{});
          }
        }
        render();
      }
    }

    function newGame(){
      grid = Array.from({length:SIZE}, () => Array(SIZE).fill(0));
      moves = 0; solved = false;
      // scramble via N valid random toggles from solved state, guarantees solvability
      const scrambleSteps = SIZE * 3 + Math.floor(Math.random() * SIZE * 2);
      for(let i=0;i<scrambleSteps;i++){
        const r = Math.floor(Math.random()*SIZE), c = Math.floor(Math.random()*SIZE);
        [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc]) => {
          const rr = r+dr, cc = c+dc;
          if(rr>=0 && rr<SIZE && cc>=0 && cc<SIZE) grid[rr][cc] ^= 1;
        });
      }
      checkSolved();
      if(solved) return newGame(); // re-scramble on the rare chance it landed solved
      render();
    }

    paintSizes();
    buildCells();
    newGame();
  }
});
