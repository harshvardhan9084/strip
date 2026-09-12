Strip.register({
  id: "lightsout",
  scoreEncoding: "inverted", scoreCeiling: 100000, // stores 100000 - moves|seconds; NEVER double it (twist)
  label: "PUZZLE",
  title: "Lights Out",
  tag: "5×5",
  hint: "Tap to toggle neighbors — clear the board",
  async mount(container, api){
    const SIZE = 5;
    // best = fewest moves to clear (lower is better; stored inverted for the
    // max-based highscore store). Fetch and convert exactly ONCE — the old code
    // fetched twice (await + then) and the stat line briefly showed the raw
    // inverted value before the second fetch corrected it.
    let stored = await api.getHighscore();
    let best = stored ? 100000 - stored : Infinity;
    let grid, moves, solved;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const board = document.createElement("div");
    board.style.cssText = `display:grid; grid-template-columns:repeat(${SIZE},1fr); gap:6px; width:min(70vw,240px);`;
    wrap.appendChild(board);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New puzzle";
    newBtn.addEventListener("click", newGame);
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    const cells = [];
    for(let i=0;i<SIZE*SIZE;i++){
      const c = document.createElement("button");
      c.style.cssText = "aspect-ratio:1; border-radius:6px; border:none; cursor:pointer; transition:background .12s ease;";
      c.addEventListener("click", () => toggle(Math.floor(i/SIZE), i%SIZE));
      board.appendChild(c);
      cells.push(c);
    }

    function render(){
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
        const el = cells[r*SIZE+c];
        el.style.background = grid[r][c] ? "var(--amber)" : "var(--panel-2)";
        el.style.boxShadow = grid[r][c] ? "0 0 14px rgba(255,179,71,.5)" : "none";
      }
      statRow.textContent = solved ? `SOLVED in ${moves} moves — best ${best === Infinity ? "-" : best}` : `MOVES ${moves}`;
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
        // lower moves = better; store as a "score" where higher is better by inverting
        const scoreValue = 100000 - moves; // keeps store's max-wins semantics useful
        api.setHighscore(scoreValue).then(v => { best = 100000 - v; render(); });
      }
    }

    function newGame(){
      grid = Array.from({length:SIZE}, () => Array(SIZE).fill(0));
      moves = 0; solved = false;
      // scramble via N valid random toggles from solved state, guarantees solvability
      const scrambleSteps = 15 + Math.floor(Math.random()*10);
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

    newGame();
  }
});
