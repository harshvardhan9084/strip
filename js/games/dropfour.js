Strip.register({
  id: "dropfour",
  label: "STRATEGY",
  title: "Drop Four",
  tag: "vs AI",
  hint: "Tap a column — connect four to win",
  async mount(container, api){
    const W = 7, H = 6;
    const saved = await api.load();
    let streak = saved && Number.isFinite(saved.streak) ? saved.streak : 0;
    // Round 19 (AUDIT.md — Drop Four P1): the streak reset to 0 on a loss and
    // an all-time best was NEVER recorded — every defeat erased the player's
    // history. The best streak now lives in the highscore store (max-wins),
    // difficulty is a choice, and an Undo exists for the "one column to the
    // left" regret every Connect Four player knows.
    let best = await api.getHighscore();
    let difficulty = saved && saved.difficulty ? saved.difficulty : "normal";

    let grid, over, busy;
    let history = []; // pre-move snapshots for Undo
    let roundGen = 0; // bumped on every reset/unmount — kills pending AI timers

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:12px;";

    // R36 — the stat row is shell-owned (api.setStats): WIN STREAK · BEST in
    // the slot between title and playfield; the round-end sentence is the run
    // ceremony's job now.

    const diffRow = document.createElement("div");
    diffRow.style.cssText = "display:flex; gap:6px;";
    const DIFFS = [["easy","Easy"],["normal","Normal"],["hard","Hard"]];
    const diffBtns = {};
    DIFFS.forEach(([key,label]) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = "font-size:10px; padding:4px 9px; border-radius:20px; border:1px solid var(--line); background:var(--panel-2); color:var(--ink-dim); cursor:pointer;";
      b.addEventListener("click", () => { difficulty = key; api.save({ streak, difficulty }); updateDiffButtons(); });
      diffBtns[key] = b;
      diffRow.appendChild(b);
    });
    function updateDiffButtons(){
      DIFFS.forEach(([key]) => {
        const active = difficulty === key;
        diffBtns[key].style.background = active ? "var(--amber)" : "var(--panel-2)";
        diffBtns[key].style.color = active ? "var(--on-accent)" : "var(--ink-dim)";
      });
    }
    wrap.appendChild(diffRow);

    const board = document.createElement("div");
    board.style.cssText = `display:grid; grid-template-columns:repeat(${W},1fr); gap:5px; width:min(74vw,calc(266px * var(--board-scale,1))); background:var(--panel-2); padding:8px; border-radius:12px;`;
    wrap.appendChild(board);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New round";
    newBtn.addEventListener("click", newRound);
    wrap.appendChild(newBtn);

    const undoBtn = document.createElement("button");
    undoBtn.className = "btn";
    undoBtn.textContent = "Undo";
    undoBtn.addEventListener("click", undoMove);
    wrap.appendChild(undoBtn);

    container.appendChild(wrap);

    const holes = [];
    for(let r = 0; r < H; r++){
      for(let c = 0; c < W; c++){
        const d = document.createElement("div");
        // R35 ACCESS: position:relative hosts the colorblind-symbol overlay;
        // data-cb is stamped per-state in render().
        d.style.cssText = "position:relative; aspect-ratio:1; border-radius:50%; background:var(--bg); cursor:pointer; box-shadow:inset 0 3px 6px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.06); transition:background .15s ease, box-shadow .15s ease;";
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
        // R34 contrast floor: empty holes are RECESSED wells (they used to be
        // flat --bg dots on a --panel-2 board — near-invisible); discs sit
        // raised with a top light so the column reads at a glance.
        el.style.background = v === 1 ? "var(--amber)" : v === 2 ? "var(--purple)" : "var(--bg)";
        // R35 ACCESS: player ▲ / AI ● — discs read without hue when the
        // colorblind-symbols setting is on (empty wells carry no symbol).
        el.dataset.cb = v === 1 ? "▲" : v === 2 ? "●" : "";
        el.style.boxShadow = v
          ? "inset 0 2px 3px rgba(255,255,255,.25), inset 0 -2px 4px rgba(0,0,0,.3)"
          : "inset 0 3px 6px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.06)";
        if(winCells && winCells.some(([wr, wc]) => wr === r && wc === c)){
          // the winning four: 2px ink stroke + glow — the moment exists now
          el.style.boxShadow = "0 0 0 2px var(--ink), 0 0 14px rgba(255,255,255,.85)";
        }
      }
      api.setStats([
        { label: "WIN STREAK", value: String(streak), color: "var(--amber)" },
        { label: "BEST", value: String(best), color: "var(--purple)" },
      ]);
      undoBtn.disabled = !history.length || busy || over;
      undoBtn.style.opacity = undoBtn.disabled ? 0.4 : 1;
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
      history.push(grid.map(row => row.slice())); // snapshot for Undo
      Feedback.tone("tap"); Feedback.haptic("light");
      grid[r][col] = 1;
      const line = winLine(1, r, col);
      if(line){ finish(1, line); return; }
      if(grid.every(row => row.every(v => v))){ finish(0, null); return; }
      render();
      busy = true;
      // guard: if the round resets (or the card unmounts) while the AI
      // "thinks", the stale timeout must not land a piece on the fresh board
      const gen = roundGen;
      setTimeout(() => {
        if(gen !== roundGen || over) return;
        aiMove();
      }, 380);
    }

    function undoMove(){
      if(!history.length || busy || over) return;
      grid = history.pop();
      Feedback.tone("swap");
      render();
    }

    function aiMove(){
      // 1) take a winning drop  2) block the player's winning drop
      // 3) weight the center columns (statistically strongest in Connect Four)
      let col = findWinning(2);
      if(col < 0) col = findWinning(1);
      if(col < 0){
        if(difficulty === "easy" && Math.random() < 0.45){
          // easy: genuinely fallible — sometimes ignores the center and danger
          const open = [];
          for(let c = 0; c < W; c++) if(lowestEmpty(c) >= 0) open.push(c);
          col = open[Math.floor(Math.random() * open.length)];
        } else if(difficulty === "hard"){
          col = hardMove();
        } else {
          col = normalMove();
        }
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

    // the classic heuristic, factored out so difficulty tiers can compose it
    function normalMove(){
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
      return open.length ? open[Math.floor(Math.random() * open.length)] : (() => {
        for(let c = 0; c < W; c++) if(lowestEmpty(c) >= 0) return c;
        return 0;
      })();
    }

    // hard: 2-ply tactic scan — prefer moves that build double threats, refuse
    // moves that gift the player a winning reply
    function hardMove(){
      const weights = [0, 1, 2, 3, 2, 1, 0];
      let bestCol = -1, bestScore = -Infinity;
      for(let c = 0; c < W; c++){
        const r = lowestEmpty(c);
        if(r < 0) continue;
        grid[r][c] = 2;
        let score = weights[c];
        // my winning drops next turn = threats created
        score += countWins(2) * 3;
        // if the player can win by ANY reply, this move is nearly disqualified
        let gift = 0;
        for(let pc = 0; pc < W; pc++){
          const pr = lowestEmpty(pc);
          if(pr < 0) continue;
          grid[pr][pc] = 1;
          if(winLine(1, pr, pc)) gift++;
          grid[pr][pc] = 0;
        }
        score -= gift * 12;
        grid[r][c] = 0;
        score += Math.random() * 0.1; // deterministic-tie breaker
        if(score > bestScore){ bestScore = score; bestCol = c; }
      }
      return bestCol >= 0 ? bestCol : normalMove();
    }
    function countWins(player){
      let n = 0;
      for(let c = 0; c < W; c++){
        const r = lowestEmpty(c);
        if(r < 0) continue;
        grid[r][c] = player;
        if(winLine(player, r, c)) n++;
        grid[r][c] = 0;
      }
      return n;
    }

    function finish(winner, line){
      over = true;
      busy = false;
      if(winner === 1){
        Feedback.buzz("win");
        streak++;
        best = Math.max(best, streak);
        api.gameover("win", streak);
        api.setHighscore(best); // the all-time streak survives every defeat now
        api.save({ streak, difficulty });
      } else if(winner === 2){
        Feedback.buzz("lose");
        api.gameover("over", 0);
        streak = 0; // current streak resets; BEST no longer vanishes with it
        api.save({ streak, difficulty });
      } else {
        Feedback.tone("thud");
      }
      render(line);
      // R36 — the round-end sentence became the standard run ceremony
      try{
        RunCeremony.show(container, winner === 1
          ? { tone: "win", label: "YOU WIN", score: String(streak), unit: "streak", delta: "BEST " + best, deltaTone: "good", verb: "NEW ROUND", onVerb: () => { RunCeremony.hide(container); newRound(); } }
          : winner === 2
          ? { tone: "over", label: "AI WINS", score: "0", unit: "streak", delta: "STREAK RESET · BEST " + best, verb: "NEW ROUND", onVerb: () => { RunCeremony.hide(container); newRound(); } }
          : { tone: "draw", label: "STALEMATE", delta: "BEST " + best, verb: "NEW ROUND", onVerb: () => { RunCeremony.hide(container); newRound(); } });
      }catch(e){}
    }

    function newRound(){
      roundGen++; // invalidate any AI move still pending from the old round
      RunCeremony.hide(container); // a restart never fights the flourish
      grid = Array.from({ length: H }, () => Array(W).fill(0));
      history = [];
      over = false; busy = false;
      render();
    }

    updateDiffButtons();
    newRound();
    return () => { roundGen++; };
  }
});
