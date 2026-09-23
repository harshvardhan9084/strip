Strip.register({
  id: "slidepuzzle",
  scoreEncoding: "inverted", scoreCeiling: 100000, // stores 100000 - moves (CLASSIC 4×4 only); NEVER double it (twist)
  label: "PUZZLE",
  title: "Slide Puzzle",
  tag: "3 sizes",
  hint: "Tap a tile next to the gap to slide it",
  async mount(container, api){
    // Round 22 (P2 tail): the ladder arrives — 3×3 / 4×4 / 5×5. The classic
    // 4×4 still feeds the inverted highscore store; the other sizes keep
    // honest per-size bests in the save. Every shuffle is random valid moves
    // from the solved state, so solvability holds at every size.
    const SIZES = [
      { key: "junior",  label: "3×3", n: 3 },
      { key: "classic", label: "4×4", n: 4 },
      { key: "grand",   label: "5×5", n: 5 },
    ];
    const INV = 100000;
    const saved0 = await api.load().catch(() => null);
    let sizeIdx = saved0 && Number.isFinite(saved0.size) ? Math.min(2, Math.max(0, Math.floor(saved0.size))) : 1; // floor: a fractional save would index SIZES[1.5] → undefined → mount throws
    const bests = saved0 && saved0.bests ? saved0.bests : {};
    const stored = await api.getHighscore();
    let bestClassic = stored ? INV - stored : Infinity;
    let SIZE = SIZES[sizeIdx].n;
    let best = sizeIdx === 1 ? bestClassic : (bests[SIZES[sizeIdx].key] ?? Infinity);

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px;";

    // R36 — the stat row is shell-owned (api.setStats): MOVES + BEST live in
    // the slot between title and playfield. The solved sentence is the run
    // ceremony's job now.

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

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "Shuffle";
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    let tiles, moves, won;

    function isSolved(t){
      for(let i=0;i<t.length-1;i++) if(t[i] !== i+1) return false;
      return t[t.length-1] === 0;
    }

    function newGame(){
      RunCeremony.hide(container); // a restart never fights the flourish
      tiles = Array.from({length: SIZE*SIZE-1}, (_,i) => i+1).concat(0);
      board.style.cssText = `display:grid; grid-template-columns:repeat(${SIZE},1fr); gap:6px; width:min(70vw,calc(${SIZE * 62}px * var(--board-scale,1))); height:min(70vw,calc(${SIZE * 62}px * var(--board-scale,1)));`;
      // shuffle via random valid moves from solved state -> always solvable
      const shuffleSteps = SIZE === 3 ? 80 : SIZE === 4 ? 150 : 260;
      let blank = tiles.indexOf(0);
      for(let i=0;i<shuffleSteps;i++){
        const neighbors = getNeighbors(blank);
        const swap = neighbors[Math.floor(Math.random()*neighbors.length)];
        [tiles[blank], tiles[swap]] = [tiles[swap], tiles[blank]];
        blank = swap;
      }
      moves = 0;
      won = false;
      render();
      updateStat();
    }

    function getNeighbors(pos){
      const r = Math.floor(pos/SIZE), c = pos%SIZE;
      const out = [];
      if(r>0) out.push(pos-SIZE);
      if(r<SIZE-1) out.push(pos+SIZE);
      if(c>0) out.push(pos-1);
      if(c<SIZE-1) out.push(pos+1);
      return out;
    }

    function render(){
      board.innerHTML = "";
      tiles.forEach((v, i) => {
        const cell = document.createElement("button");
        cell.style.cssText = `
          border:none; border-radius:8px; font-weight:700; font-size:${SIZE === 5 ? 13 : 16}px; cursor:pointer;
          background:${v===0 ? "transparent" : "var(--panel-2)"};
          color:${v===0 ? "transparent" : "var(--ink)"};
          box-shadow:${v===0 ? "none" : "0 2px 6px rgba(0,0,0,.3)"};
        `;
        cell.textContent = v || "";
        cell.disabled = v === 0 || won;
        cell.addEventListener("click", () => tryMove(i));
        board.appendChild(cell);
      });
    }

    function tryMove(i){
      const blank = tiles.indexOf(0);
      if(!getNeighbors(blank).includes(i)) return;
      [tiles[blank], tiles[i]] = [tiles[i], tiles[blank]];
      moves++;
      Feedback.tone("swap"); Feedback.haptic("light");
      if(isSolved(tiles)){
        won = true;
        Feedback.buzz("win");
        api.gameover("win", moves);
        const prevBest = best;
        if(moves < best){
          best = moves;
          bests[SIZES[sizeIdx].key] = moves;
          if(sizeIdx === 1){
            bestClassic = moves;
            api.setHighscore(INV - moves); // only the classic 4×4 feeds the store
          } else {
            api.save({ size: sizeIdx, bests }).catch(()=>{});
          }
        }
        // R35 ceremony adoption: the solved board used to just go disabled —
        // the standard panel announces it with the honest delta + verb.
        RunCeremony.show(container, {
          tone: "clear",
          label: "SOLVED",
          score: String(moves),
          unit: "moves",
          delta: moves < prevBest ? "NEW BEST" : "BEST " + prevBest,
          deltaTone: moves < prevBest ? "good" : "",
          verb: "SHUFFLE",
          onVerb: newGame,
        });
      }
      render();
      updateStat();
    }

    function updateStat(){
      api.setStats([
        { label: "MOVES", value: String(moves), color: "var(--amber)" },
        { label: "BEST", value: best === Infinity ? "—" : String(best), color: "var(--purple)" },
      ]);
    }

    newBtn.addEventListener("click", newGame);
    paintSizes();
    newGame();
  }
});
