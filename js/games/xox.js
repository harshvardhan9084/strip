/**
 * XOX — Tic-Tac-Toe with a genuine minimax AI.
 *
 * Board is only 9 cells, so minimax runs an exhaustive search of the full
 * game tree (at most 9! = 362,880 leaf paths, trivially fast) — on "Hard"
 * the AI is mathematically unbeatable: best case for the player is a draw.
 * "Medium" occasionally plays a random legal move instead of the best one,
 * "Easy" mostly plays randomly. This is real, not simulated, difficulty.
 *
 * Depth is factored into the minimax score so the AI prefers winning FAST
 * and losing SLOW (a classic minimax refinement) — without it the AI would
 * happily let you drag out a loss it can already see coming.
 */
Strip.register({
  id: "xox",
  label: "GAME",
  title: "XOX",
  tag: "minimax AI",
  hint: "You're X. Beat the AI — or force a draw.",
  async mount(container, api){
    const saved = await api.load();
    const state = Object.assign({ wins: 0, losses: 0, draws: 0, difficulty: "hard" }, saved || {});

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px; width:100%;";

    const diffRow = document.createElement("div");
    diffRow.style.cssText = "display:flex; gap:6px;";
    const DIFFS = [["easy","Easy"],["medium","Medium"],["hard","Hard"]];
    const diffBtns = {};
    DIFFS.forEach(([key,label]) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = "font-size:10px; padding:6px 10px; border-radius:20px; border:1px solid var(--line); background:var(--panel-2); color:var(--ink-dim); cursor:pointer;";
      b.addEventListener("click", () => { state.difficulty = key; api.save(state); updateDiffButtons(); });
      diffBtns[key] = b;
      diffRow.appendChild(b);
    });
    function updateDiffButtons(){
      DIFFS.forEach(([key]) => {
        const active = state.difficulty === key;
        diffBtns[key].style.background = active ? "var(--amber)" : "var(--panel-2)";
        diffBtns[key].style.color = active ? "var(--on-accent)" : "var(--ink-dim)";
        diffBtns[key].style.borderColor = active ? "var(--amber)" : "var(--line)";
      });
    }

    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between
    // title and playfield, one type scale, tabular nums, <=4 stats. The old
    // header's keys live on so update sites stay one-liners.
    const statVals = {
      "YOU": "",
      "DRAWS": "",
      "AI": "",
    };
    const STAT_KEYS = [
      ["YOU", "YOU", "var(--amber)"],
      ["DRAWS", "DRAWS", "var(--ink)"],
      ["AI", "AI", "var(--purple)"],
    ];
    function renderStats(){
      api.setStats(STAT_KEYS.map(([k, label, color]) => ({ label, value: statVals[k], color })));
    }
    function syncStats36(){ statVals["YOU"] = state.wins; statVals["DRAWS"] = state.draws; statVals["AI"] = state.losses;renderStats(); }
    renderStats();

    const board = document.createElement("div");
    board.style.cssText = "display:grid; grid-template-columns:repeat(3,1fr); gap:6px; width:min(72vw,calc(248px * var(--board-scale,1))); height:min(72vw,calc(248px * var(--board-scale,1)));"; // R36 board-scale dial

    const statusLine = document.createElement("div");
    statusLine.style.cssText = "font-size:13px; color:var(--ink-dim); min-height:18px;";

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New round";

    wrap.appendChild(diffRow);
    wrap.appendChild(board);
    wrap.appendChild(statusLine);
    wrap.appendChild(newBtn);
    container.appendChild(wrap);

    const cells = [];
    for(let i=0;i<9;i++){
      const c = document.createElement("button");
      c.style.cssText = `
        background:var(--panel-2); border:1px solid var(--line); border-radius:10px;
        font-size:32px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center;
      `;
      c.addEventListener("click", () => onCellClick(i));
      board.appendChild(c);
      cells.push(c);
    }

    let grid, turn, over, roundGen = 0; // roundGen invalidates stale AI timeouts

    const LINES = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6],
    ];

    function checkWinner(g){
      for(const [a,b,c] of LINES){
        if(g[a] && g[a] === g[b] && g[a] === g[c]) return { winner: g[a], line: [a,b,c] };
      }
      if(g.every(v => v)) return { winner: "draw", line: null };
      return null;
    }

    // ---- minimax: exhaustive search, depth-aware scoring ----
    function minimax(g, depth, isMaximizing){
      const result = checkWinner(g);
      if(result){
        if(result.winner === "O") return 10 - depth;   // AI wins — prefer faster wins
        if(result.winner === "X") return depth - 10;   // player wins — prefer slower losses
        return 0;
      }
      const empties = g.map((v,i)=>v?null:i).filter(i=>i!==null);
      if(isMaximizing){
        let best = -Infinity;
        for(const i of empties){
          g[i] = "O";
          best = Math.max(best, minimax(g, depth+1, false));
          g[i] = null;
        }
        return best;
      } else {
        let best = Infinity;
        for(const i of empties){
          g[i] = "X";
          best = Math.min(best, minimax(g, depth+1, true));
          g[i] = null;
        }
        return best;
      }
    }

    function bestAiMove(g){
      const empties = g.map((v,i)=>v?null:i).filter(i=>i!==null);
      let bestScore = -Infinity, bestMoves = [];
      for(const i of empties){
        g[i] = "O";
        const score = minimax(g, 1, false);
        g[i] = null;
        if(score > bestScore){ bestScore = score; bestMoves = [i]; }
        else if(score === bestScore) bestMoves.push(i);
      }
      // among equally-best moves, pick randomly so hard mode doesn't feel robotic/repetitive
      return bestMoves[Math.floor(Math.random()*bestMoves.length)];
    }

    function aiMove(){
      const empties = grid.map((v,i)=>v?null:i).filter(i=>i!==null);
      if(!empties.length) return;

      let choice;
      const roll = Math.random();
      if(state.difficulty === "hard"){
        choice = bestAiMove(grid);
      } else if(state.difficulty === "medium"){
        choice = roll < 0.6 ? bestAiMove(grid) : empties[Math.floor(Math.random()*empties.length)];
      } else {
        choice = roll < 0.2 ? bestAiMove(grid) : empties[Math.floor(Math.random()*empties.length)];
      }
      grid[choice] = "O";
    }

    function render(winLine){
      cells.forEach((c,i) => {
        c.textContent = grid[i] || "";
        c.style.color = grid[i] === "X" ? "var(--amber)" : "var(--purple)";
        c.disabled = !!grid[i] || over;
        // R34: the winning row now wears a 2px accent stroke + glow — the
        // old 15% tint was invisible at arm's length.
        const isWin = winLine && winLine.includes(i);
        c.style.background = isWin ? "rgba(255,179,71,0.15)" : "var(--panel-2)";
        c.style.boxShadow = isWin ? "inset 0 0 0 2px var(--amber), 0 0 12px rgba(var(--glow-rgb),calc(.55*var(--glow-mul,1)))" : "none";
      });
      syncStats36();
    }

    function endRound(result){
      over = true;
      if(result.winner === "X"){ state.wins++; statusLine.textContent = "You win!"; Feedback.buzz("win"); api.gameover("win", state.wins); }
      else if(result.winner === "O"){ state.losses++; statusLine.textContent = "AI wins."; Feedback.buzz("lose"); api.gameover("over", 0); }
      else { state.draws++; statusLine.textContent = "Draw."; Feedback.tone("toggle"); Feedback.haptic("medium"); api.gameover("over", 0); }
      api.save(state);
      render(result.line);
      // R34: "AI wins." as a bare line was a fair duel told in a flat voice.
      // The standard panel closes every round — the draw keeps its minimax
      // pride, the win/loss carry the running tally.
      const tally = `${state.wins}W · ${state.draws}D · ${state.losses}L`;
      if(result.winner === "X"){
        RunCeremony.show(container, { tone: "win", label: "YOU WIN", score: "X", delta: tally, verb: "NEW ROUND", onVerb: newRound });
      } else if(result.winner === "O"){
        RunCeremony.show(container, { tone: "over", label: "AI WINS", score: "O", delta: tally, verb: "NEW ROUND", onVerb: newRound });
      } else {
        RunCeremony.show(container, { tone: "draw", label: "YOU HELD THE MACHINE", score: "=", delta: tally, verb: "NEW ROUND", onVerb: newRound });
      }
    }

    function onCellClick(i){
      if(over || grid[i] || turn !== "X") return;
      grid[i] = "X";
      Feedback.tone("place"); Feedback.haptic("light");
      let result = checkWinner(grid);
      render();
      if(result){ endRound(result); return; }

      turn = "O";
      render();
      const gen = roundGen;
      setTimeout(() => {
        if(gen !== roundGen) return; // board was reset mid-think — drop the stale move
        aiMove();
        result = checkWinner(grid);
        render();
        if(result){ endRound(result); return; }
        turn = "X";
        render();
      }, 350); // small delay so the AI's move feels like a "turn", not instant
    }

    function newRound(){
      roundGen++;
      grid = Array(9).fill(null);
      over = false;
      // alternate who starts so it's not always the player
      turn = state._lastStarter === "X" ? "O" : "X";
      state._lastStarter = turn;
      statusLine.textContent = turn === "X" ? "Your move" : "AI is thinking…";
      render();
      if(turn === "O"){
        const gen = roundGen;
        setTimeout(() => {
          if(gen !== roundGen) return; // stale — player reset before the AI moved
          aiMove();
          const result = checkWinner(grid);
          render();
          if(result){ endRound(result); return; }
          turn = "X";
          statusLine.textContent = "Your move";
          render();
        }, 400);
      }
    }

    newBtn.addEventListener("click", newRound);
    updateDiffButtons();
    newRound();

    // bumping roundGen on unmount defuses any pending AI timeout — without this,
    // an in-flight "AI is thinking" timer could fire against the detached board
    return () => { roundGen++; };
  }
});
