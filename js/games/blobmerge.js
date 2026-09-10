Strip.register({
  id: "blobmerge",
  label: "PUZZLE",
  title: "Blob Merge",
  tag: "drag",
  hint: "Drag a blob onto a matching one to merge",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();
    const COLS = 4, ROWS = 5;
    const CELL = 56;
    const STAGE_COLORS = ["#7A5A22","#9A6A1E","#C07E1A","#FFB347","#8B7FE8","#5D54A0","#E8637F"];

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>SCORE <span id="bm-score" style="color:var(--amber)">0</span></div><div>BEST <span id="bm-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const board = document.createElement("div");
    board.style.cssText = `position:relative; width:${COLS*CELL}px; height:${ROWS*CELL}px; background:var(--panel-2); border-radius:12px; touch-action:none;`;
    wrap.appendChild(board);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New game";
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    let grid, score, dragging;

    function newGame(){
      grid = Array.from({length:ROWS}, () => Array(COLS).fill(null));
      score = 0;
      dragging = null;
      for(let i=0;i<4;i++) addBlob();
      render();
      q("#bm-score").textContent = 0;
    }

    function emptyCells(){
      const out = [];
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(!grid[r][c]) out.push([r,c]);
      return out;
    }

    function addBlob(){
      const empties = emptyCells();
      if(!empties.length) return;
      const [r,c] = empties[Math.floor(Math.random()*empties.length)];
      grid[r][c] = { stage: Math.random() < 0.7 ? 0 : 1 };
    }

    function render(){
      board.innerHTML = "";
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const blob = grid[r][c];
        if(!blob) continue;
        const el = document.createElement("div");
        el.dataset.r = r; el.dataset.c = c;
        el.style.cssText = `
          position:absolute; left:${c*CELL+4}px; top:${r*CELL+4}px; width:${CELL-8}px; height:${CELL-8}px;
          border-radius:50%; background:${STAGE_COLORS[Math.min(blob.stage, STAGE_COLORS.length-1)]};
          display:flex; align-items:center; justify-content:center; font-weight:700; color:#fff; font-size:14px;
          cursor:grab; box-shadow:0 4px 10px rgba(0,0,0,.3); user-select:none;
          transition:left .15s ease, top .15s ease;
        `;
        el.textContent = blob.stage + 1;
        attachDrag(el);
        board.appendChild(el);
      }
    }

    function attachDrag(el){
      let startX, startY, origLeft, origTop;

      function onDown(e){
        const t = e.touches ? e.touches[0] : e;
        startX = t.clientX; startY = t.clientY;
        origLeft = parseFloat(el.style.left);
        origTop = parseFloat(el.style.top);
        el.style.zIndex = 10;
        el.style.transition = "none";
        dragging = el;
        window.addEventListener("mousemove", onMove);
        window.addEventListener("touchmove", onMove, {passive:false});
        window.addEventListener("mouseup", onUp);
        window.addEventListener("touchend", onUp);
      }
      function onMove(e){
        if(e.cancelable) e.preventDefault();
        const t = e.touches ? e.touches[0] : e;
        el.style.left = (origLeft + t.clientX - startX) + "px";
        el.style.top = (origTop + t.clientY - startY) + "px";
      }
      function onUp(){
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchend", onUp);
        el.style.zIndex = 1;

        const r = +el.dataset.r, c = +el.dataset.c;
        const curLeft = parseFloat(el.style.left), curTop = parseFloat(el.style.top);
        // find the nearest actual cell center by distance, not just axis-independent rounding —
        // rounding each axis separately can disagree with which cell is genuinely closest when
        // a drop lands near a corner between four cells, silently snapping to the wrong one.
        let targetRow = 0, targetCol = 0, bestDist = Infinity;
        for(let rr=0; rr<ROWS; rr++) for(let cc=0; cc<COLS; cc++){
          const cellLeft = cc*CELL+4, cellTop = rr*CELL+4;
          const d = (cellLeft-curLeft)**2 + (cellTop-curTop)**2;
          if(d < bestDist){ bestDist = d; targetRow = rr; targetCol = cc; }
        }
        const moved = tryMove(r, c, targetRow, targetCol);
        if(!moved){
          // snap back with a visible bounce so a failed merge is never silent —
          // this is the direct fix for drops that looked like they "did nothing"
          el.style.transition = "left .18s cubic-bezier(.34,1.56,.64,1), top .18s cubic-bezier(.34,1.56,.64,1)";
          el.style.left = (c*CELL+4) + "px";
          el.style.top = (r*CELL+4) + "px";
          Feedback.haptic("medium");
          Feedback.tone("pop");
        } else {
          el.style.transition = "left .15s ease, top .15s ease";
        }
      }

      el.addEventListener("mousedown", onDown);
      el.addEventListener("touchstart", onDown, {passive:true});
    }

    function tryMove(r, c, tr, tc){
      if(tr < 0 || tr >= ROWS || tc < 0 || tc >= COLS || (tr===r && tc===c)){
        return false;
      }
      const source = grid[r][c];
      const target = grid[tr][tc];
      let success = false;
      if(!target){
        grid[tr][tc] = source;
        grid[r][c] = null;
        success = true;
      } else if(target.stage === source.stage){
        grid[tr][tc] = { stage: source.stage + 1 };
        grid[r][c] = null;
        score += Math.pow(2, source.stage + 1);
        q("#bm-score").textContent = score;
        if(score > best){
          best = score;
          api.setHighscore(best);
          q("#bm-best").textContent = best;
        }
        addBlob();
        success = true;
      }
      if(success){
        render();
        if(emptyCells().length === 0 && !anyMergePossible()){
          setTimeout(newGame, 900);
        }
      }
      return success;
    }

    function anyMergePossible(){
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const b = grid[r][c];
        if(!b) return true;
        const neighbors = [[r+1,c],[r-1,c],[r,c+1],[r,c-1]];
        for(const [nr,nc] of neighbors){
          if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&grid[nr][nc]&&grid[nr][nc].stage===b.stage) return true;
        }
      }
      return false;
    }

    newBtn.addEventListener("click", newGame);
    newGame();
  }
});
