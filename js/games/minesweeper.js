Strip.register({
  id: "minesweeper",
  label: "PUZZLE",
  title: "Minesweeper",
  tag: "8×8",
  hint: "Tap to dig · long-press to flag",
  async mount(container, api){
    const W = 8, H = 8, MINES = 10;
    // best = fastest clear (seconds, lower is better). The highscore store is
    // max-wins, so time is stored inverted: 9999 - seconds.
    const INV = 9999;
    const stored = await api.getHighscore();
    let best = stored ? INV - stored : Infinity;

    let mines, revealed, flagged, placed, over, won, flags, elapsed, timerId;
    let longPress = null, suppressDig = false;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:12px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const board = document.createElement("div");
    board.style.cssText = `display:grid; grid-template-columns:repeat(${W},1fr); gap:3px; width:min(72vw,264px); touch-action:manipulation; user-select:none; -webkit-user-select:none;`;
    wrap.appendChild(board);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New field";
    newBtn.addEventListener("click", newGame);
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    const cells = [];
    for(let i = 0; i < W * H; i++){
      const c = document.createElement("button");
      c.style.cssText = "aspect-ratio:1; border-radius:5px; border:none; cursor:pointer; font-family:var(--font-display); font-size:9px; line-height:1; display:flex; align-items:center; justify-content:center; padding:0; background:var(--panel-2);";
      const r = Math.floor(i / W), col = i % W;

      c.addEventListener("pointerdown", () => {
        suppressDig = false;
        clearTimeout(longPress);
        longPress = setTimeout(() => { longPress = null; suppressDig = true; toggleFlag(r, col); }, 320);
      });
      c.addEventListener("pointerup", () => clearTimeout(longPress));
      c.addEventListener("pointerleave", () => clearTimeout(longPress));
      c.addEventListener("pointercancel", () => clearTimeout(longPress));
      // desktop right-click flags
      c.addEventListener("contextmenu", (e) => { e.preventDefault(); clearTimeout(longPress); suppressDig = true; toggleFlag(r, col); });
      c.addEventListener("click", () => { if(!suppressDig) dig(r, col); suppressDig = false; });

      board.appendChild(c);
      cells.push(c);
    }

    const NUM_COLORS = ["", "#6FA8FF", "#5AC98A", "#E8637F", "#B58CF2", "#FFB347", "#5FD4D0", "#EDEAE3", "#8B8A94"];

    function render(){
      statRow.innerHTML = `<div>MINES <span style="color:var(--danger)">${MINES - flags}</span></div><div>TIME <span style="color:var(--amber)">${elapsed}s</span></div><div>BEST <span style="color:var(--purple)">${best === Infinity ? "-" : best + "s"}</span></div>`;
      for(let i = 0; i < W * H; i++){
        const el = cells[i];
        if(revealed[i]){
          const n = mines[i];
          el.style.background = "#101018";
          el.textContent = n > 0 ? String(n) : "";
          el.style.color = NUM_COLORS[n];
        } else if(flagged[i]){
          el.style.background = "var(--panel-2)";
          el.textContent = "⚑";
          el.style.color = "var(--amber)";
        } else {
          el.style.background = "var(--panel-2)";
          el.textContent = "";
        }
        if(over && !won && mines[i] && revealed[i] !== true && !flagged[i]){
          el.style.background = "rgba(232,99,127,.35)";
        }
      }
    }

    function startTimer(){
      if(timerId) return;
      timerId = setInterval(() => { elapsed++; statUpdate(); }, 1000);
    }
    function statUpdate(){
      statRow.innerHTML = `<div>MINES <span style="color:var(--danger)">${MINES - flags}</span></div><div>TIME <span style="color:var(--amber)">${elapsed}s</span></div><div>BEST <span style="color:var(--purple)">${best === Infinity ? "-" : best + "s"}</span></div>`;
    }

    function placeMines(safeIdx){
      // mines placed on first dig, never in the 3×3 around the opening tap —
      // every game gets a real opening move instead of an instant loss
      mines = new Array(W * H).fill(0);
      const banned = new Set();
      const sr = Math.floor(safeIdx / W), sc = safeIdx % W;
      for(let dr = -1; dr <= 1; dr++) for(let dc = -1; dc <= 1; dc++){
        const rr = sr + dr, cc = sc + dc;
        if(rr >= 0 && rr < H && cc >= 0 && cc < W) banned.add(rr * W + cc);
      }
      let placedCount = 0;
      while(placedCount < MINES){
        const i = Math.floor(Math.random() * W * H);
        if(banned.has(i) || mines[i]) continue;
        mines[i] = 1;
        placedCount++;
      }
      placed = true;
    }

    function neighbors(i, fn){
      const r = Math.floor(i / W), c = i % W;
      for(let dr = -1; dr <= 1; dr++) for(let dc = -1; dc <= 1; dc++){
        if(!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if(rr >= 0 && rr < H && cc >= 0 && cc < W) fn(rr * W + cc);
      }
    }

    function countAt(i){
      let n = 0;
      neighbors(i, j => { n += mines[j]; });
      return n;
    }

    function dig(r, c){
      if(over) return;
      const i = r * W + c;
      if(flagged[i] || revealed[i]) return;
      if(!placed) placeMines(i);
      startTimer();
      Feedback.tone("tap"); Feedback.haptic("light");

      if(mines[i]){
        over = true; won = false;
        clearInterval(timerId);
        Feedback.buzz("lose");
        render();
        return;
      }
      // iterative flood fill — a recursive fill on a tiny board is fine, but
      // iterative keeps the stack flat and the reveal order feels like a wave
      const stack = [i];
      while(stack.length){
        const j = stack.pop();
        if(revealed[j] || flagged[j]) continue;
        revealed[j] = true;
        if(countAt(j) === 0) neighbors(j, k => { if(!revealed[k] && !mines[k]) stack.push(k); });
      }
      checkWin();
      render();
    }

    function toggleFlag(r, c){
      if(over) return;
      const i = r * W + c;
      if(revealed[i]) return;
      flagged[i] = !flagged[i];
      flags += flagged[i] ? 1 : -1;
      Feedback.haptic("light");
      render();
    }

    function checkWin(){
      const dug = revealed.reduce((s, v) => s + (v ? 1 : 0), 0);
      if(dug === W * H - MINES){
        over = true; won = true;
        clearInterval(timerId);
        Feedback.buzz("win");
        // flag remaining mines for a clean final board
        for(let i = 0; i < W * H; i++) if(mines[i]) flagged[i] = true;
        api.setHighscore(INV - elapsed).then(v => { best = INV - v; render(); });
      }
    }

    function newGame(){
      mines = new Array(W * H).fill(0);
      revealed = new Array(W * H).fill(false);
      flagged = new Array(W * H).fill(false);
      placed = false; over = false; won = false; flags = 0; elapsed = 0;
      clearInterval(timerId); timerId = null;
      render();
    }

    newGame();
    return () => clearInterval(timerId);
  }
});
