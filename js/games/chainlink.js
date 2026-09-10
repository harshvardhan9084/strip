Strip.register({
  id: "chainlink",
  label: "PUZZLE",
  title: "Chain Link",
  tag: "connect",
  hint: "Drag through matching-color dots to clear them",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();
    const SIZE = 6;
    const COLORS = ["#FFB347","#8B7FE8","#E8637F","#6FCF97"];

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:12px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>SCORE <span id="cl-score" style="color:var(--amber)">0</span></div><div>BEST <span id="cl-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const boardWrap = document.createElement("div");
    boardWrap.style.cssText = `position:relative; width:min(72vw,240px); height:min(72vw,240px); touch-action:none;`;
    wrap.appendChild(boardWrap);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 240 240");
    svg.style.cssText = "position:absolute; inset:0; width:100%; height:100%; pointer-events:none;";
    boardWrap.appendChild(svg);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New board";
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    let grid, score, chain, dragging;
    const CELL = 240 / SIZE;

    function newGame(){
      grid = Array.from({length:SIZE}, () => Array(SIZE).fill(0).map(() => Math.floor(Math.random()*COLORS.length)));
      score = 0;
      chain = [];
      dragging = false;
      render();
      q("#cl-score").textContent = 0;
    }

    function cellCenter(r,c){ return [c*CELL + CELL/2, r*CELL + CELL/2]; }

    function render(){
      boardWrap.querySelectorAll(".dot").forEach(d => d.remove());
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
        const colorIdx = grid[r][c];
        if(colorIdx === null) continue;
        const [x,y] = cellCenter(r,c);
        const dot = document.createElement("div");
        dot.className = "dot";
        const inChain = chain.some(([cr,cc]) => cr===r && cc===c);
        dot.style.cssText = `
          position:absolute; left:${x - CELL*0.32}px; top:${y - CELL*0.32}px;
          width:${CELL*0.64}px; height:${CELL*0.64}px; border-radius:50%;
          background:${COLORS[colorIdx]}; opacity:${inChain ? 1 : 0.85};
          transform:scale(${inChain ? 1.15 : 1}); transition:transform .1s ease;
          box-shadow:${inChain ? `0 0 12px ${COLORS[colorIdx]}` : "none"};
        `;
        dot.dataset.r = r; dot.dataset.c = c;
        boardWrap.appendChild(dot);
      }
      drawChainLine();
    }

    function drawChainLine(){
      svg.innerHTML = "";
      if(chain.length < 2) return;
      const pts = chain.map(([r,c]) => cellCenter(r,c));
      const d = pts.map((p,i) => (i===0?"M":"L") + p[0] + "," + p[1]).join(" ");
      const path = document.createElementNS("http://www.w3.org/2000/svg","path");
      path.setAttribute("d", d);
      path.setAttribute("stroke", COLORS[grid[chain[0][0]][chain[0][1]]]);
      path.setAttribute("stroke-width", "6");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("opacity", "0.6");
      svg.appendChild(path);
    }

    function cellFromPoint(clientX, clientY){
      const rect = boardWrap.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width * 240;
      const y = (clientY - rect.top) / rect.height * 240;
      const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
      if(r<0||r>=SIZE||c<0||c>=SIZE) return null;
      return [r,c];
    }

    function isAdjacent(a,b){
      return Math.abs(a[0]-b[0]) <= 1 && Math.abs(a[1]-b[1]) <= 1 && !(a[0]===b[0]&&a[1]===b[1]);
    }

    function onStart(e){
      const t = e.touches ? e.touches[0] : e;
      const cell = cellFromPoint(t.clientX, t.clientY);
      if(!cell || grid[cell[0]][cell[1]] === null) return;
      dragging = true;
      chain = [cell];
      render();
    }
    function onMove(e){
      if(!dragging) return;
      if(e.cancelable) e.preventDefault();
      const t = e.touches ? e.touches[0] : e;
      const cell = cellFromPoint(t.clientX, t.clientY);
      if(!cell || grid[cell[0]][cell[1]] === null) return;
      const color = grid[chain[0][0]][chain[0][1]];
      if(grid[cell[0]][cell[1]] !== color) return;

      const last = chain[chain.length-1];
      if(cell[0]===last[0] && cell[1]===last[1]) return;

      // backtrack support
      if(chain.length > 1 && cell[0]===chain[chain.length-2][0] && cell[1]===chain[chain.length-2][1]){
        chain.pop();
        render();
        return;
      }

      if(isAdjacent(last, cell) && !chain.some(([r,c])=>r===cell[0]&&c===cell[1])){
        chain.push(cell);
        Feedback.tone("swap");
        render();
      }
    }
    function onEnd(){
      if(!dragging) return;
      dragging = false;
      if(chain.length >= 3){
        chain.forEach(([r,c]) => { grid[r][c] = null; });
        Feedback.tone("success"); Feedback.haptic("medium");
        score += chain.length * (chain.length - 1);
        q("#cl-score").textContent = score;
        if(score > best){
          best = score;
          api.setHighscore(best);
          q("#cl-best").textContent = best;
        }
        applyGravity();
      }
      chain = [];
      render();
    }

    function applyGravity(){
      for(let c=0;c<SIZE;c++){
        let write = SIZE-1;
        for(let r=SIZE-1;r>=0;r--){
          if(grid[r][c] !== null){
            grid[write][c] = grid[r][c];
            if(write !== r) grid[r][c] = null;
            write--;
          }
        }
        for(let r=write;r>=0;r--){
          grid[r][c] = Math.floor(Math.random()*COLORS.length);
        }
      }
    }

    boardWrap.addEventListener("mousedown", onStart);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    boardWrap.addEventListener("touchstart", onStart, {passive:true});
    boardWrap.addEventListener("touchmove", onMove, {passive:false});
    window.addEventListener("touchend", onEnd);

    newBtn.addEventListener("click", newGame);
    newGame();

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }
});
