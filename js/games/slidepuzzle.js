Strip.register({
  id: "slidepuzzle",
  scoreEncoding: "inverted", scoreCeiling: 100000, // stores 100000 - moves|seconds; NEVER double it (twist)
  label: "PUZZLE",
  title: "Slide Puzzle",
  tag: "4×4",
  hint: "Tap a tile next to the gap to slide it",
  async mount(container, api){
    let best = await api.getHighscore(); // fewest moves, inverted store
    const SIZE = 4;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const board = document.createElement("div");
    board.style.cssText = `display:grid; grid-template-columns:repeat(${SIZE},1fr); gap:6px; width:min(70vw,240px); height:min(70vw,240px);`;
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
      tiles = Array.from({length: SIZE*SIZE-1}, (_,i) => i+1).concat(0);
      // shuffle via random valid moves from solved state -> always solvable
      let blank = tiles.indexOf(0);
      for(let i=0;i<150;i++){
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
          border:none; border-radius:8px; font-weight:700; font-size:16px; cursor:pointer;
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
        const scoreValue = 100000 - moves;
        api.setHighscore(scoreValue).then(v => { best = 100000 - v; updateStat(); });
      }
      render();
      updateStat();
    }

    function updateStat(){
      statRow.textContent = won ? `SOLVED in ${moves} moves — best ${best === Infinity ? "-" : best}` : `MOVES ${moves}`;
    }

    newBtn.addEventListener("click", newGame);
    best = best ? 100000 - best : Infinity;
    newGame();
  }
});
