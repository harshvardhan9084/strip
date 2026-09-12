Strip.register({
  id: "minisudoku",
  scoreEncoding: "inverted", scoreCeiling: 100000, // stores 100000 - moves|seconds; NEVER double it (twist)
  label: "PUZZLE",
  title: "Mini Sudoku",
  tag: "4×4",
  hint: "Fill 1-4, no repeats in row/col/box",
  async mount(container, api){
    let best = await api.getHighscore(); // best = fastest solve in seconds, stored inverted

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const board = document.createElement("div");
    board.style.cssText = "display:grid; grid-template-columns:repeat(4,1fr); gap:4px; width:min(64vw,200px); background:var(--line); padding:4px; border-radius:10px;";
    wrap.appendChild(board);

    const numRow = document.createElement("div");
    numRow.style.cssText = "display:flex; gap:8px;";
    wrap.appendChild(numRow);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New puzzle";
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    let solution, puzzle, fixed, selected, startTime, solved;

    // valid 4x4 latin-square generator via base pattern + shuffles
    function genSolution(){
      const base = [
        [1,2,3,4],
        [3,4,1,2],
        [2,1,4,3],
        [4,3,2,1],
      ];
      // random row/col band swaps to vary it
      let g = base.map(r => r.slice());
      if(Math.random() < 0.5) [g[0],g[1]] = [g[1],g[0]];
      if(Math.random() < 0.5) [g[2],g[3]] = [g[3],g[2]];
      // random relabeling of digits 1-4
      const perm = shuffle([1,2,3,4]);
      g = g.map(row => row.map(v => perm[v-1]));
      // transpose sometimes
      if(Math.random() < 0.5){
        const t = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
        for(let r=0;r<4;r++) for(let c=0;c<4;c++) t[c][r] = g[r][c];
        g = t;
      }
      return g;
    }

    function shuffle(arr){
      const a = arr.slice();
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [a[i],a[j]]=[a[j],a[i]];
      }
      return a;
    }

    function newGame(){
      solution = genSolution();
      puzzle = solution.map(row => row.slice());
      fixed = solution.map(row => row.map(()=>true));
      // remove ~8 cells to leave a puzzle
      let removed = 0;
      while(removed < 8){
        const r = Math.floor(Math.random()*4), c = Math.floor(Math.random()*4);
        if(fixed[r][c]){ fixed[r][c] = false; puzzle[r][c] = 0; removed++; }
      }
      selected = null;
      solved = false;
      startTime = Date.now();
      renderBoard();
      updateStat();
    }

    function renderBoard(){
      board.innerHTML = "";
      for(let r=0;r<4;r++) for(let c=0;c<4;c++){
        const cell = document.createElement("button");
        const boxParity = (Math.floor(r/2) + Math.floor(c/2)) % 2;
        cell.style.cssText = `
          aspect-ratio:1; border:none; cursor:pointer;
          background:${fixed[r][c] ? "var(--panel-2)" : (boxParity ? "#1B1B24" : "#161620")};
          color:${fixed[r][c] ? "var(--ink-dim)" : "var(--amber)"};
          font-size:18px; font-weight:700;
          outline:${selected && selected[0]===r && selected[1]===c ? "2px solid var(--amber)" : "none"};
          outline-offset:-2px;
        `;
        cell.textContent = puzzle[r][c] || "";
        cell.disabled = fixed[r][c] || solved;
        cell.addEventListener("click", () => { Feedback.tone("select"); selected = [r,c]; renderBoard(); });
        board.appendChild(cell);
      }
    }

    function place(n){
      if(!selected || solved) return;
      const [r,c] = selected;
      if(fixed[r][c]) return;
      puzzle[r][c] = n;
      Feedback.tone("place"); Feedback.haptic("light");
      renderBoard();
      checkSolved();
    }

    function checkSolved(){
      // RULE-BASED win check, not solution-equality. With only 8 clues a 4x4
      // puzzle can legally have two valid completions (~22% of generated
      // deals) — a player who correctly completes the *other* one must still
      // win, or the game silently robs them.
      const want = [1,2,3,4];
      const ok = (arr) => want.every(n => arr.includes(n));
      for(let r=0;r<4;r++){
        if(!ok(puzzle[r])) return;
      }
      for(let c=0;c<4;c++){
        if(!ok(puzzle.map(row => row[c]))) return;
      }
      for(let br=0;br<2;br++) for(let bc=0;bc<2;bc++){
        const box = [];
        for(let r=0;r<2;r++) for(let c=0;c<2;c++) box.push(puzzle[br*2+r][bc*2+c]);
        if(!ok(box)) return;
      }
      solved = true;
      Feedback.buzz("win");
      const seconds = Math.round((Date.now() - startTime)/1000);
      const scoreValue = 100000 - seconds;
      api.setHighscore(scoreValue).then(v => { best = 100000 - v; updateStat(); });
      updateStat();
      renderBoard();
    }

    function updateStat(){
      if(solved){
        const seconds = Math.round((Date.now() - startTime)/1000);
        statRow.textContent = `SOLVED in ${seconds}s — best ${best === Infinity ? "-" : best+"s"}`;
      } else {
        statRow.textContent = "Fill the grid";
      }
    }

    [1,2,3,4].forEach(n => {
      const btn = document.createElement("button");
      btn.className = "btn purple";
      btn.textContent = n;
      btn.style.width = "44px";
      btn.addEventListener("click", () => place(n));
      numRow.appendChild(btn);
    });

    newBtn.addEventListener("click", newGame);
    best = best ? 100000 - best : Infinity;
    newGame();
  }
});
