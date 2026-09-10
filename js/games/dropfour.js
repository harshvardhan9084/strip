Strip.register({
  id: "dropfour",
  label: "STRATEGY",
  title: "Drop Four",
  tag: "vs AI",
  hint: "Tap a column — connect four to win",
  async mount(container, api){
    const W = 7, H = 6;
    const state = await api.load();
    let streak = state && Number.isFinite(state.streak) ? state.streak : 0;

    let grid, over, aiTimer, busy;
    let roundGen = 0; // bumped on every reset/unmount — kills pending AI timers

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:12px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const board = document.createElement("div");
    board.style.cssText = `display:grid; grid-template-columns:repeat(${W},1fr); gap:5px; width:min(74vw,266px); background:var(--panel-2); padding:8px; border-radius:12px;`;
    wrap.appendChild(board);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New round";
    newBtn.addEventListener("click", newRound);
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    const holes = [];
    for(let r = 0; r < H; r++){
      for(let c = 0; c < W; c++){
        const d = document.createElement("div");
        d.style.cssText = "aspect-ratio:1; border-radius:50%; background:var(--bg); cursor:pointer; transition:background .15s ease, box-shadow .15s ease;";
        d.addEventListener("click", () => drop(c));
        board.appendChild(d);
        holes.push(d);
      }
    }

    function idx(r, c){ return r * W + c; }

    function render(winCells){
      for(let r = 0; r < H; r++) for(let c = 0; c < W; c++){
        const el = holes[idx(r, c)];
        const v = grid[r][c];
        el.style.background = v === 1 ? "var(--amber)" : v === 2 ? "var(--purple)" : "var(--bg)";
        el.style.boxShadow = "none";
        if(winCells && winCells.some(([wr, wc]) => wr === r && wc === c)){
          el.style.boxShadow = "0 0 12px rgba(255,255,255,.8)";
        }
      }
      statRow.innerHTML = `WIN STREAK <span style="color:var(--amber)">${streak}</span>`;
    }

    function lowestEmpty(col){
      for(let r = H - 1; r >= 0; r--) if(!grid[r][col]) return r;
      return -1;
    }

    function winLine(player, r, c){
      const dirs = [[0,1],[1,0],[1,1],[1,-1]];
      for(const [dr, dc] of dirs){
        const cells = [[r, c]];
        for(const sign of [1, -1]){
          let rr = r + dr * sign, cc = c + dc * sign;
          while(rr >= 0 && rr < H && cc >= 0 && cc < W && grid[rr][cc] === player){
            cells.push([rr, cc]);
            rr += dr * sign; cc += dc * sign;
          }
        }
        if(cells.length >= 4) return cells;
      }
      return null;
    }

    function drop(col){
      if(over || busy) return;
      const r = lowestEmpty(col);
      if(r < 0){ Feedback.tone("thud"); return; }
      Feedback.tone("tap"); Feedback.haptic("light");
      grid[r][col] = 1;
      const line = winLine(1, r, col);
      if(line){ finish(1, line); return; }
      if(grid.every(row => row.every(v => v))){ finish(0, null); return; }
      render();
      busy = true;
      // guard token: if the round resets (or the card unmounts) while the AI
      // "thinks", the stale timeout must not land a piece on the fresh board
      const gen = roundGen;
      aiTimer = { gen };
      setTimeout(() => {
        if(gen !== roundGen || over) return;
        aiMove();
      }, 380);
    }

    function aiMove(){
      // 1) take a winning drop  2) block the player's winning drop
      // 3) weight the center columns (statistically strongest in Connect Four)
      let col = findWinning(2);
      if(col < 0) col = findWinning(1);
      if(col < 0){
        const weights = [1, 2, 3, 4, 3, 2, 1];
        const open = [];
        for(let c = 0; c < W; c++){
          const r = lowestEmpty(c);
          if(r < 0) continue;
          // don't hand the player a win directly above our drop
          grid[r][c] = 2;
          const selfWin = winLine(2, r, c);
          grid[r][c] = 0;
          const above = r - 1;
          let gifts = false;
          if(above >= 0){
            grid[above][c] = 1;
            gifts = !!winLine(1, above, c);
            grid[above][c] = 0;
          }
          if(!selfWin && !gifts) for(let i = 0; i < weights[c]; i++) open.push(c);
        }
        col = open.length ? open[Math.floor(Math.random() * open.length)] : (() => {
          for(let c = 0; c < W; c++) if(lowestEmpty(c) >= 0) return c;
          return 0;
        })();
      }
      const r = lowestEmpty(col);
      grid[r][col] = 2;
      Feedback.tone("blip");
      const line = winLine(2, r, col);
      busy = false;
      if(line){ finish(2, line); return; }
      if(grid.every(row => row.every(v => v))){ finish(0, null); return; }
      render();
    }

    function findWinning(player){
      for(let c = 0; c < W; c++){
        const r = lowestEmpty(c);
        if(r < 0) continue;
        grid[r][c] = player;
        const line = winLine(player, r, c);
        grid[r][c] = 0;
        if(line) return c;
      }
      return -1;
    }

    function finish(winner, line){
      over = true;
      busy = false;
      if(winner === 1){
        Feedback.buzz("win");
        streak++;
        api.save({ streak });
      } else if(winner === 2){
        Feedback.buzz("lose");
        streak = 0;
        api.save({ streak });
      } else {
        Feedback.tone("thud");
      }
      render(line);
      statRow.innerHTML = winner === 1
        ? `YOU WIN — streak <span style="color:var(--amber)">${streak}</span>`
        : winner === 2 ? `AI WINS — streak reset` : `DRAW`;
    }

    function newRound(){
      roundGen++; // invalidate any AI move still pending from the old round
      grid = Array.from({ length: H }, () => Array(W).fill(0));
      over = false; busy = false;
      render();
    }

    newRound();
    return () => { roundGen++; };
  }
});
