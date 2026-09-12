Strip.register({
  id: "minesweeper",
  scoreEncoding: "inverted", scoreCeiling: 9999, // stores 9999 - seconds; NEVER double it (twist)
  label: "PUZZLE",
  title: "Minesweeper",
  tag: "3 fields",
  hint: "Tap to dig · long-press to flag",
  async mount(container, api){
    // Round 19 (AUDIT.md — Minesweeper P1): 8×8/10 was the only field forever,
    // wins counted toward nothing, and the clutch finish (the genre's best
    // dopamine hit) happened in total silence. Now: a 3-size ladder with
    // per-size bests, a wins/streak record, and an ALL-CLEAR banner that
    // names your time the moment the last cell drops.
    const DIFFS = [
      { key: "rookie",  label: "8×8",   W: 8,  H: 8,  MINES: 10 },
      { key: "field",   label: "12×10", W: 12, H: 10, MINES: 24 },
      { key: "veteran", label: "16×14", W: 16, H: 14, MINES: 40 },
    ];
    // best = fastest clear (seconds, lower is better). The highscore store is
    // max-wins, so time is stored inverted: 9999 - seconds. Only the ROOKIE
    // field feeds the store (a 16×14 time is not comparable to an 8×8 time);
    // the other two sizes keep honest bests inside the save.
    const INV = 9999;
    const saved0 = await api.load();
    let diffIdx = saved0 && Number.isFinite(saved0.diff) ? Math.min(2, Math.max(0, saved0.diff)) : 0;
    let D = DIFFS[diffIdx];
    let W = D.W, H = D.H, MINES = D.MINES;
    const stored = await api.getHighscore();
    let bestRookie = stored ? INV - stored : Infinity;
    const bests = saved0 && saved0.bests ? saved0.bests : {};
    let wins = saved0 && Number.isFinite(saved0.wins) ? saved0.wins : 0;
    let streak = saved0 && Number.isFinite(saved0.streak) ? saved0.streak : 0;
    function bestFor(){ return diffIdx === 0 ? bestRookie : (bests[D.key] ?? Infinity); }

    let mines, revealed, flagged, placed, over, won, flags, elapsed, timerId;
    let longPress = null, suppressDig = false;
    let restored = false;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:12px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:16px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim); flex-wrap:wrap; justify-content:center;";
    wrap.appendChild(statRow);

    const diffRow = document.createElement("div");
    diffRow.style.cssText = "display:flex; gap:6px;";
    const diffBtns = [];
    DIFFS.forEach((d, i) => {
      const b = document.createElement("button");
      b.textContent = d.label;
      b.style.cssText = "font-size:10px; padding:4px 9px; border-radius:20px; border:1px solid var(--line); background:var(--panel-2); color:var(--ink-dim); cursor:pointer;";
      b.addEventListener("click", () => {
        if(i === diffIdx) return;
        diffIdx = i; D = DIFFS[i];
        W = D.W; H = D.H; MINES = D.MINES;
        api.save({ diff: diffIdx, bests, wins, streak }).catch(()=>{});
        restored = true; // switching fields abandons the old board
        buildBoard();
        freshBoard();
        paintDiff();
        persist();
        render();
      });
      diffBtns.push(b);
      diffRow.appendChild(b);
    });
    function paintDiff(){
      diffBtns.forEach((b, i) => {
        const active = i === diffIdx;
        b.style.background = active ? "var(--amber)" : "var(--panel-2)";
        b.style.color = active ? "#000" : "var(--ink-dim)";
      });
    }
    wrap.appendChild(diffRow);

    const boardWrap = document.createElement("div");
    boardWrap.style.cssText = "position:relative;";
    wrap.appendChild(boardWrap);

    const board = document.createElement("div");
    boardWrap.appendChild(board);

    // ALL-CLEAR banner — the clutch finish gets its moment (S6/S8)
    const clearBanner = document.createElement("div");
    clearBanner.style.cssText = "display:none; position:absolute; inset:0; background:rgba(10,10,16,0.85); border-radius:10px; z-index:5; flex-direction:column; align-items:center; justify-content:center; gap:6px; text-align:center;";
    boardWrap.appendChild(clearBanner);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New field";
    newBtn.addEventListener("click", newGame);
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    let cells = [];
    function buildBoard(){
      board.innerHTML = "";
      board.style.gridTemplateColumns = `repeat(${W},1fr)`;
      board.style.width = `min(72vw,${W * 24}px)`;
      cells = [];
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
        c.addEventListener("click", () => {
          if(suppressDig){ suppressDig = false; return; }
          if(placed && revealed[r * W + c]) chord(r, col);
          else dig(r, col);
        });

        board.appendChild(c);
        cells.push(c);
      }
    }

    const NUM_COLORS = ["", "#6FA8FF", "#5AC98A", "#E8637F", "#B58CF2", "#FFB347", "#5FD4D0", "#EDEAE3", "#8B8A94"];

    function statUpdate(){
      statRow.innerHTML = `<div>MINES <span style="color:var(--danger)">${MINES - flags}</span></div><div>TIME <span style="color:var(--amber)">${elapsed}s</span></div><div>BEST <span style="color:var(--purple)">${bestFor() === Infinity ? "-" : bestFor() + "s"}</span></div><div>WINS <span style="color:var(--ink)">${wins}</span>${streak > 1 ? ` · <span style="color:#6FCF97">×${streak} streak</span>` : ""}</div>`;
    }

    function render(){
      statUpdate();
      for(let i = 0; i < W * H; i++){
        const el = cells[i];
        if(!el) continue;
        const r = Math.floor(i / W) + 1, c = (i % W) + 1;
        if(revealed[i]){
          const n = mines[i];
          el.style.background = "#101018";
          el.textContent = n > 0 ? String(n) : "";
          el.style.color = NUM_COLORS[n];
          el.setAttribute("aria-label", `row ${r} col ${c}, revealed${n ? `, ${n} neighbor mine${n>1?"s":""}` : ""}`);
        } else if(flagged[i]){
          el.style.background = "var(--panel-2)";
          el.textContent = "⚑";
          el.style.color = "var(--amber)";
          el.setAttribute("aria-label", `row ${r} col ${c}, flagged`);
        } else {
          el.style.background = "var(--panel-2)";
          el.textContent = "";
          el.setAttribute("aria-label", `row ${r} col ${c}, hidden`);
        }
        if(over && !won && mines[i] && revealed[i] !== true && !flagged[i]){
          el.style.background = "rgba(232,99,127,.35)";
          el.textContent = "✱"; // the hit wasn't just visual — show WHAT was there
          el.setAttribute("aria-label", `row ${r} col ${c}, mine`);
        }
      }
    }

    function startTimer(){
      if(timerId) return;
      timerId = setInterval(() => { elapsed++; statUpdate(); }, 1000);
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
        streak = 0;
        persist();
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
      persist();
      render();
    }

    function toggleFlag(r, c){
      if(over) return;
      const i = r * W + c;
      if(revealed[i]) return;
      // flag supply is capped at the real mine count — a scoreboard that can
      // read "-3" mines left is nonsense
      if(!flagged[i] && flags >= MINES) return;
      flagged[i] = !flagged[i];
      flags += flagged[i] ? 1 : -1;
      Feedback.haptic("light");
      persist();
      render();
    }

    // chord: tapping a revealed number whose flag count matches reveals its
    // remaining neighbors — the standard efficiency move for veterans
    function chord(r, c){
      const i = r * W + c;
      if(over || !revealed[i] || !minesOrZero(i)) return;
      let flaggedAround = 0;
      neighbors(i, j => { if(flagged[j]) flaggedAround++; });
      if(flaggedAround !== countAt(i)) return;
      const targets = [];
      neighbors(i, j => { if(!revealed[j] && !flagged[j]) targets.push(j); });
      if(!targets.length) return;
      for(const j of targets){
        if(mines[j]){ over = true; won = false; clearInterval(timerId); Feedback.buzz("lose"); streak = 0; persist(); render(); return; }
        const stack = [j];
        while(stack.length){
          const k = stack.pop();
          if(revealed[k] || flagged[k]) continue;
          revealed[k] = true;
          if(countAt(k) === 0) neighbors(k, m => { if(!revealed[m] && !mines[m]) stack.push(m); });
        }
      }
      Feedback.tone("ok");
      checkWin();
      persist();
      render();
    }
    function minesOrZero(i){ return mines[i] ? true : countAt(i) > 0; }

    function showClear(newBest){
      clearBanner.innerHTML = "";
      const t = document.createElement("div");
      t.style.cssText = "font-family:var(--font-display); font-size:16px; color:#6FCF97; letter-spacing:2px;";
      t.textContent = "FIELD CLEARED";
      const s = document.createElement("div");
      s.style.cssText = "font-size:11px; color:var(--ink);";
      s.innerHTML = `${D.label} · ${elapsed}s${newBest ? ' · <span style="color:var(--amber)">NEW BEST!</span>' : ""}`;
      const b = document.createElement("button");
      b.className = "btn accent";
      b.textContent = "Next field";
      b.addEventListener("click", () => { clearBanner.style.display = "none"; newGame(); });
      clearBanner.appendChild(t); clearBanner.appendChild(s); clearBanner.appendChild(b);
      clearBanner.style.display = "flex";
    }

    function checkWin(){
      const dug = revealed.reduce((s, v) => s + (v ? 1 : 0), 0);
      if(dug === W * H - MINES){
        over = true; won = true;
        clearInterval(timerId);
        Feedback.buzz("win");
        // flag remaining mines for a clean final board
        for(let i = 0; i < W * H; i++) if(mines[i]) flagged[i] = true;
        // wins ladder + streak — the record the ladder never kept
        wins++; streak++;
        const prevBest = bestFor();
        const isBest = elapsed < prevBest;
        if(isBest){
          bests[D.key] = elapsed;
          if(diffIdx === 0){
            bestRookie = elapsed;
            api.setHighscore(INV - elapsed); // store only carries the rookie time
          }
        }
        persist();
        render();
        showClear(isBest);
      }
    }

    // mid-game persistence: the board survives scrolling away or an app switch
    function persist(){
      if(!mines) return;
      api.save({ mines, revealed, flagged, elapsed, placed, over, won, flags, diff: diffIdx, bests, wins, streak }).catch(()=>{});
    }

    function newGame(){
      restored = true; // explicit reset — never resurrect the old board
      clearBanner.style.display = "none";
      freshBoard();
      clearInterval(timerId); timerId = null;
      persist();
      render();
    }

    function freshBoard(){
      mines = new Array(W * H).fill(0);
      revealed = new Array(W * H).fill(false);
      flagged = new Array(W * H).fill(false);
      placed = false; over = false; won = false; flags = 0; elapsed = 0;
      render();
    }

    // restore an in-progress board exactly once per mount (placed + not over);
    // only for the CURRENT difficulty size
    api.load().then(saved => {
      if(restored || !saved || !saved.placed || saved.over || !Array.isArray(saved.mines) || saved.mines.length !== W * H) return;
      restored = true;
      mines = saved.mines;
      revealed = saved.revealed;
      flagged = saved.flagged;
      elapsed = saved.elapsed || 0;
      flags = saved.flags || 0;
      placed = true; over = false; won = false;
      startTimer(); // the clock resumes with the board
      render();
    }).catch(()=>{});

    buildBoard();
    paintDiff();
    freshBoard();
    return () => { clearInterval(timerId); persist(); };
  }
});
