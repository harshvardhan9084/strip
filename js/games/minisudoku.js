Strip.register({
  id: "minisudoku",
  scoreEncoding: "inverted", scoreCeiling: 100000, // stores 100000 - seconds (CLASSIC 4×4 only); NEVER double it (twist)
  label: "PUZZLE",
  title: "Mini Sudoku",
  tag: "2 sizes",
  hint: "Fill the grid, no repeats in row/col/box",
  async mount(container, api){
    // Round 22 (P2 tail): a second rung on the ladder. The classic 4×4 keeps
    // the inverted-store best; a 6×6 (2×3 boxes, digits 1-6) joins as the
    // veteran field with its own save-bested time. Both keep the honest
    // rule-based win check — any legal completion wins, not just the dealt
    // solution's twin.
    const SIZES = [
      { key: "classic", label: "4×4", n: 4, bh: 2, bw: 2, dig: 4, holes: 8 },
      { key: "grand",   label: "6×6", n: 6, bh: 2, bw: 3, dig: 6, holes: 14 },
    ];
    const INV = 100000;
    const saved0 = await api.load().catch(() => null);
    let sizeIdx = saved0 && Number.isFinite(saved0.size) ? Math.min(SIZES.length - 1, Math.max(0, saved0.size)) : 0;
    const bests = saved0 && saved0.bests ? saved0.bests : {};
    const stored = await api.getHighscore();
    let bestClassic = stored ? INV - stored : Infinity;
    let S = SIZES[sizeIdx];
    let best = sizeIdx === 0 ? bestClassic : (bests[S.key] ?? Infinity);
    let N = S.n;

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
        sizeIdx = i; S = SIZES[i]; N = S.n;
        best = sizeIdx === 0 ? bestClassic : (bests[S.key] ?? Infinity);
        api.save({ size: sizeIdx, bests }).catch(()=>{});
        paintSizes();
        buildNumRow();
        newGame();
      });
      sizeBtns.push(b);
      sizeRow.appendChild(b);
    });
    function paintSizes(){
      sizeBtns.forEach((b, i) => {
        const active = i === sizeIdx;
        b.style.background = active ? "var(--amber)" : "var(--panel-2)";
        b.style.color = active ? "var(--on-accent)" : "var(--ink-dim)";
      });
    }
    wrap.appendChild(sizeRow);

    const board = document.createElement("div");
    wrap.appendChild(board);

    const numRow = document.createElement("div");
    numRow.style.cssText = "display:flex; gap:8px; flex-wrap:wrap; justify-content:center;";
    wrap.appendChild(numRow);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New puzzle";
    newBtn.addEventListener("click", newGame);
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    let solution, puzzle, fixed, selected, startTime, solved;

    function shuffle(arr){
      const a = arr.slice();
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [a[i],a[j]]=[a[j],a[i]];
      }
      return a;
    }

    // canonical solved grid from the box-pattern formula, then randomized by
    // digit relabeling + row swaps within bands + column swaps within stacks
    // (every move preserves the box constraint — the result is always valid)
    function genSolution(){
      const g = [];
      for(let r=0;r<N;r++){
        const row = [];
        for(let c=0;c<N;c++) row.push((S.bh * (r % S.bh) + Math.floor(r / S.bh) + c) % N + 1);
        g.push(row);
      }
      const perm = shuffle(Array.from({length:N}, (_,i) => i+1));
      for(let r=0;r<N;r++) for(let c=0;c<N;c++) g[r][c] = perm[g[r][c]-1];
      for(let band=0; band < N/S.bh; band++){
        if(Math.random() < 0.5){
          const a = band * S.bh, b = a + 1;
          [g[a], g[b]] = [g[b], g[a]];
        }
      }
      for(let stack=0; stack < N/S.bw; stack++){
        if(Math.random() < 0.5 && S.bw > 1){
          // swap two columns inside this stack (keeps every box's contents)
          const c1 = stack * S.bw + Math.floor(Math.random() * S.bw);
          let c2 = stack * S.bw + Math.floor(Math.random() * S.bw);
          if(c2 === c1) c2 = stack * S.bw + ((c1 + 1) % S.bw);
          for(let r=0;r<N;r++) [g[r][c1], g[r][c2]] = [g[r][c2], g[r][c1]];
        }
      }
      return g;
    }

    function newGame(){
      solution = genSolution();
      puzzle = solution.map(row => row.slice());
      fixed = solution.map(row => row.map(() => true));
      let removed = 0, guard = 0;
      while(removed < S.holes && guard++ < 500){
        const r = Math.floor(Math.random()*N), c = Math.floor(Math.random()*N);
        if(fixed[r][c]){ fixed[r][c] = false; puzzle[r][c] = 0; removed++; }
      }
      selected = null;
      solved = false;
      startTime = Date.now();
      board.style.cssText = `display:grid; grid-template-columns:repeat(${N},1fr); gap:4px; width:min(72vw,${N * 52}px); background:var(--line); padding:4px; border-radius:10px;`;
      renderBoard();
      updateStat();
    }

    function renderBoard(){
      board.innerHTML = "";
      const bh = S.bh, bw = S.bw;
      for(let r=0;r<N;r++) for(let c=0;c<N;c++){
        const cell = document.createElement("button");
        const boxParity = (Math.floor(r/bh) + Math.floor(c/bw)) % 2;
        cell.style.cssText = `
          aspect-ratio:1; border:none; cursor:pointer;
          background:${fixed[r][c] ? "var(--panel-2)" : (boxParity ? "var(--screen-2, #1B1B24)" : "var(--screen, #161620)")};
          color:${fixed[r][c] ? "var(--ink)" : "var(--amber)"};
          font-size:${N === 6 ? 14 : 18}px; font-weight:${fixed[r][c] ? 800 : 700};
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
      // RULE-BASED win check, not solution-equality — a puzzle this thin can
      // legally have several completions, and every legal one must win.
      const want = Array.from({length:N}, (_,i) => i+1);
      const ok = (arr) => want.every(n => arr.includes(n));
      for(let r=0;r<N;r++){ if(!ok(puzzle[r])) return; }
      for(let c=0;c<N;c++){ if(!ok(puzzle.map(row => row[c]))) return; }
      for(let br=0;br<N/S.bh;br++) for(let bc=0;bc<N/S.bw;bc++){
        const box = [];
        for(let r=0;r<S.bh;r++) for(let c=0;c<S.bw;c++) box.push(puzzle[br*S.bh+r][bc*S.bw+c]);
        if(!ok(box)) return;
      }
      solved = true;
      Feedback.buzz("win");
      const seconds = Math.round((Date.now() - startTime)/1000);
      api.gameover("win", seconds);
      if(seconds < best){
        best = seconds;
        bests[S.key] = seconds;
        if(sizeIdx === 0){
          bestClassic = seconds;
          api.setHighscore(INV - seconds); // only the classic time feeds the store
        } else {
          api.save({ size: sizeIdx, bests }).catch(()=>{});
        }
      }
      updateStat();
      renderBoard();
    }

    function updateStat(){
      if(solved){
        const seconds = Math.round((Date.now() - startTime)/1000);
        statRow.textContent = `SOLVED in ${seconds}s — best ${best === Infinity ? "-" : best+"s"}`;
      } else {
        statRow.textContent = `Fill the grid — ${S.label}, no repeats`;
      }
    }

    function buildNumRow(){
      numRow.innerHTML = "";
      for(let n=1;n<=N;n++){
        const btn = document.createElement("button");
        btn.className = "btn purple";
        btn.textContent = n;
        btn.style.width = N === 6 ? "36px" : "44px";
        btn.addEventListener("click", () => place(n));
        numRow.appendChild(btn);
      }
    }

    paintSizes();
    buildNumRow();
    newGame();
  }
});
