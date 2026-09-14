Strip.register({
  id: "maze",
  scoreEncoding: "inverted", scoreCeiling: 100000, // stores 100000 - moves (CLASSIC 7×7 only); NEVER double it (twist)
  label: "PUZZLE",
  title: "Maze",
  tag: "3 sizes",
  hint: "Swipe to move the dot to the star",
  async mount(container, api){
    // Round 22 (P2 tail): size ladder — 5×5 warm-up, 7×7 classic (still feeds
    // the inverted store), 9×9 deep run. Every maze is DFS-carved from the
    // solved corner, so solvability holds at every size.
    const SIZES = [
      { key: "junior",  label: "5×5", n: 5, holes: 3 },
      { key: "classic", label: "7×7", n: 7, holes: 6 },
      { key: "grand",   label: "9×9", n: 9, holes: 9 },
    ];
    const INV = 100000;
    const saved0 = await api.load().catch(() => null);
    let sizeIdx = saved0 && Number.isFinite(saved0.size) ? Math.min(2, Math.max(0, saved0.size)) : 1;
    const bests = saved0 && saved0.bests ? saved0.bests : {};
    const stored = await api.getHighscore();
    let bestClassic = stored ? INV - stored : Infinity;
    let SIZE = SIZES[sizeIdx].n;
    let best = sizeIdx === 1 ? bestClassic : (bests[SIZES[sizeIdx].key] ?? Infinity);

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:12px;";

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
        fitBoard();
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

    const boardWrap = document.createElement("div");
    wrap.appendChild(boardWrap);
    function fitBoard(){
      boardWrap.style.cssText = `
        display:grid; grid-template-columns:repeat(${SIZE},1fr); grid-template-rows:repeat(${SIZE},1fr);
        width:min(72vw,${SIZE * 38}px); height:min(72vw,${SIZE * 38}px); gap:2px; touch-action:none;
      `;
    }
    fitBoard();

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New maze";
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    let walls, player, goal, moves, won;

    function generateMaze(){
      // simple randomized DFS carve on an odd grid; walls[r][c] = true means blocked
      const w = Array.from({length:SIZE}, () => Array(SIZE).fill(true));
      function carve(r,c){
        w[r][c] = false;
        const dirs = shuffle([[0,2],[0,-2],[2,0],[-2,0]]);
        dirs.forEach(([dr,dc]) => {
          const nr = r+dr, nc = c+dc;
          if(nr>=0 && nr<SIZE && nc>=0 && nc<SIZE && w[nr][nc]){
            w[r+dr/2][c+dc/2] = false;
            carve(nr,nc);
          }
        });
      }
      carve(0,0);
      // ensure some extra connectivity so it doesn't feel too corridor-y
      const holes = SIZES[sizeIdx].holes;
      for(let i=0;i<holes;i++){
        const r = Math.floor(Math.random()*SIZE), c = Math.floor(Math.random()*SIZE);
        w[r][c] = false;
      }
      return w;
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
      walls = generateMaze();
      player = [0,0];
      goal = [SIZE-1, SIZE-1];
      walls[goal[0]][goal[1]] = false;
      moves = 0;
      won = false;
      render();
      updateStat();
    }

    function render(){
      boardWrap.innerHTML = "";
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
        const cell = document.createElement("div");
        const isPlayer = player[0]===r && player[1]===c;
        const isGoal = goal[0]===r && goal[1]===c;
        cell.style.cssText = `
          background:${walls[r][c] ? "var(--panel-2)" : "var(--bg)"};
          border-radius:2px; display:flex; align-items:center; justify-content:center;
          font-size:${SIZE === 9 ? 11 : 14}px;
        `;
        if(isPlayer) cell.textContent = "🐾";
        else if(isGoal) cell.textContent = "⭐";
        boardWrap.appendChild(cell);
      }
    }

    function updateStat(){
      statRow.textContent = won ? `REACHED in ${moves} moves — best ${best === Infinity ? "-" : best}` : `MOVES ${moves}`;
    }

    function move(dr,dc){
      if(won) return;
      const nr = player[0]+dr, nc = player[1]+dc;
      if(nr<0||nr>=SIZE||nc<0||nc>=SIZE||walls[nr][nc]){
        Feedback.haptic("light");
        return;
      }
      player = [nr,nc];
      moves++;
      Feedback.tone("tap");
      if(nr===goal[0] && nc===goal[1]){
        won = true;
        Feedback.buzz("win");
        if(moves < best){
          best = moves;
          bests[SIZES[sizeIdx].key] = moves;
          if(sizeIdx === 1){
            bestClassic = moves;
            api.setHighscore(INV - moves); // only the classic maze feeds the store
          } else {
            api.save({ size: sizeIdx, bests }).catch(()=>{});
          }
        }
        updateStat();
      }
      render();
      updateStat();
    }

    let sx=0, sy=0;
    function onStart(e){ const t = e.touches?e.touches[0]:e; sx=t.clientX; sy=t.clientY; }
    function onEnd(e){
      const t = e.changedTouches?e.changedTouches[0]:e;
      const dx = t.clientX-sx, dy = t.clientY-sy;
      if(Math.max(Math.abs(dx),Math.abs(dy)) < 20) return;
      if(Math.abs(dx) > Math.abs(dy)) move(0, dx>0?1:-1);
      else move(dy>0?1:-1, 0);
    }
    boardWrap.addEventListener("touchstart", onStart, {passive:true});
    boardWrap.addEventListener("touchend", onEnd, {passive:true});
    boardWrap.addEventListener("mousedown", onStart);
    boardWrap.addEventListener("mouseup", onEnd);

    function onKey(e){
      // input arbitration: only the CENTERED card takes keys (two copies of
      // a cartridge can coexist after the deck wraps; neighbors stay mounted)
      if(window.StripShell && !StripShell.isActive(container)) return;
      const map = { ArrowLeft:[0,-1], ArrowRight:[0,1], ArrowUp:[-1,0], ArrowDown:[1,0] };
      if(map[e.key]){
        e.preventDefault(); // arrows move the dot, not the strip scroll
        move(...map[e.key]);
      }
    }
    window.addEventListener("keydown", onKey);

    newBtn.addEventListener("click", newGame);
    paintSizes();
    newGame();

    return () => window.removeEventListener("keydown", onKey);
  }
});
