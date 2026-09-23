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

    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between
    // title and playfield, one type scale, tabular nums, <=4 stats. The old
    // header's span ids live on as value keys so update sites stay one-liners.
    const statVals = {
      "cl-score": "0",
      "cl-best": String(best),
    };
    const STAT_KEYS = [
      ["cl-score", "SCORE", "var(--amber)", null],
      ["cl-best", "BEST", "var(--purple)", null],
    ];
    function renderStats(){
      api.setStats(STAT_KEYS.map(([k, label, color, fixed]) => ({
        label,
        value: k ? statVals[k] : fixed,
        color,
      })));
    }
    renderStats();

    const boardWrap = document.createElement("div");
    // R36 — the dial scales the wrap; the svg's 240×240 viewBox scales with it
    boardWrap.style.cssText = `position:relative; width:min(72vw,calc(240px * var(--board-scale,1))); height:min(72vw,calc(240px * var(--board-scale,1))); touch-action:none;`;
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
      // the board IS the run: its score banks exactly once, here at the only
      // reset boundary — the old per-chain gameover paid the shell's run
      // ladder on every pop (XP/mission farming, depth spam)
      if(score > 0){ try{ api.gameover("over", score); }catch(e){} }
      grid = Array.from({length:SIZE}, () => Array(SIZE).fill(0).map(() => Math.floor(Math.random()*COLORS.length)));
      score = 0;
      chain = [];
      dragging = false;
      render();
      statVals["cl-score"] = 0; renderStats();
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
        // R35 ACCESS: four colors, four shapes — data-cb feeds the CSS
        // overlay while the colorblind-symbols setting is on.
        dot.dataset.cb = ["▲", "●", "■", "◆"][colorIdx];
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
      // orthogonal steps only — GAMES.md pins "diagonals don't connect"
      return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) === 1;
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
      if(window.StripShell && !StripShell.isActive(container)) return;
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
      if(window.StripShell && !StripShell.isActive(container)) return;
      if(!dragging) return;
      dragging = false;
      if(chain.length >= 3){
        chain.forEach(([r,c]) => { grid[r][c] = null; });
        Feedback.tone("success"); Feedback.haptic("medium");
        score += chain.length * (chain.length - 1);
        statVals["cl-score"] = score; renderStats();
        // Round 19 (S6): an 8-chain used to land exactly like a 3-chain —
        // length titles give every tier its own little flagpole
        const n = chain.length;
        const title = n >= 12 ? "EPIC" : n >= 8 ? "GREAT" : n >= 5 ? "GOOD" : null;
        if(title) showChainTitle(title, n);
        if(n >= 8) Feedback.buzz("win");
        if(score > best){
          best = score;
          api.setHighscore(best);
          statVals["cl-best"] = best; renderStats();
        }
        applyGravity();
      }
      chain = [];
      render();
    }

    let chainTitleTimer = null;
    function showChainTitle(text, n){
      let t = boardWrap.querySelector(".cl-title");
      if(!t){
        t = document.createElement("div");
        t.className = "cl-title";
        t.style.cssText = "position:absolute; left:0; right:0; top:40%; text-align:center; font-family:var(--font-display); font-size:16px; letter-spacing:2px; pointer-events:none; z-index:10; text-shadow:0 2px 8px rgba(0,0,0,.7);";
        boardWrap.appendChild(t);
      }
      t.textContent = `${text} ×${n}`;
      t.style.color = n >= 12 ? "#FFB347" : "#8B7FE8";
      t.style.opacity = "1";
      clearTimeout(chainTitleTimer);
      chainTitleTimer = setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .5s"; }, 850);
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
      clearTimeout(chainTitleTimer);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }
});
