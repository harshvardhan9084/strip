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
    // 10 stages of paint: the merge chain now has a stated GOAL (a stage-8
    // MEGA BLOB) instead of an unreachable "no moves" endstate — with the
    // corrected merge rule a full board always holds a mergeable pair
    // (pigeonhole over the stage ladder), so the old game-over was dead code
    // and the game had no target at all.
    const STAGE_COLORS = ["#7A5A22","#9A6A1E","#C07E1A","#FFB347","#8B7FE8","#5D54A0","#E8637F","#56B4E9","#6FCF97","#F2A65A"];
    const WIN_STAGE = 7; // 0-indexed → the number shown on the blob is stage+1

    // Round 19 (AUDIT.md DEEP DIVE 2 — the "only 1,2,3,4" plateau): the spawn
    // pool used to be ONLY stage-0/1 forever, a stranded singleton was
    // permanent dead weight (no discard existed), and the board converged to
    // a sea of low blobs with nothing productive to do. Three structural fixes:
    //   1. RECYCLER — drag any blob OFF the board to bank stage² points and
    //      clear the cell. Singletons stop being dead weight; spend-or-keep
    //      becomes a real decision every drag.
    //   2. SPAWN SCALING — once your best blob this board reaches stage k,
    //      ~15% of spawns arrive as "junk" at stage k−3..k−2, so the material
    //      ladder shortens as you climb instead of every merge starting over.
    //   3. MILESTONES — every new max stage fires a banner + fanfare, so
    //      progress is felt, not just counted.
    let maxStageEver = 0;
    try{
      const saved = await api.load();
      if(saved && Number.isFinite(saved.maxStageEver)) maxStageEver = saved.maxStageEver;
    }catch(e){}

    function updateGoalLine(){
      const base = "goal — grow a blob to 8";
      const rec = " · drag a blob off the board to recycle it";
      const ever = maxStageEver > 1 ? ` · best ever ${maxStageEver+1}` : "";
      noteEl.textContent = base + rec + ever;
    }

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>SCORE <span id="bm-score" style="color:var(--amber)">0</span></div><div>BEST <span id="bm-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    // goal line: states the actual objective + carries the MEGA BLOB win note
    const noteEl = document.createElement("div");
    noteEl.id = "bm-note";
    noteEl.style.cssText = "font-size:11px; color:var(--amber); min-height:15px; text-align:center; letter-spacing:.4px;";
    updateGoalLine();
    wrap.appendChild(noteEl);

    const board = document.createElement("div");
    board.style.cssText = `position:relative; width:${COLS*CELL}px; height:${ROWS*CELL}px; background:var(--panel-2); border-radius:12px; touch-action:none;`;
    wrap.appendChild(board);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New game";
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    let grid, score;
    let winShown = false; // MEGA BLOB banner shows once per board
    let maxStage = 0;     // best blob grown THIS board (drives spawn scaling)

    function newGame(){
      grid = Array.from({length:ROWS}, () => Array(COLS).fill(null));
      score = 0;
      winShown = false;
      maxStage = 0;
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
      let stage;
      // spawn scaling: once the board's best blob is stage ≥ 3, some spawns
      // arrive as mid-tier "junk" (stage k−3..k−2) — the ladder you already
      // climbed partially spawns pre-climbed, so late boards keep moving
      if(maxStage >= 3 && Math.random() < 0.15){
        const lo = 1, hi = maxStage - 2;
        stage = lo + Math.floor(Math.random() * (hi - lo + 1));
      } else {
        stage = Math.random() < 0.7 ? 0 : 1;
      }
      grid[r][c] = { stage };
    }

    // floating +N chips — merges and recycles both pay VISIBLY now (the audit
    // called the old score "a silent counter tick")
    function addFloat(cellR, cellC, text, color){
      const f = document.createElement("div");
      f.textContent = text;
      f.style.cssText = `position:absolute; left:${cellC*CELL + CELL/2 - 14}px; top:${cellR*CELL + 6}px; font-weight:700; font-size:13px; color:${color}; pointer-events:none; z-index:20; animation:bmFloat .8s ease-out forwards; text-shadow:0 1px 3px rgba(0,0,0,.5);`;
      board.appendChild(f);
      setTimeout(() => f.remove(), 850);
    }
    // one shared keyframes node for the float chips (idempotent)
    if(!document.getElementById("bm-float-kf")){
      const st = document.createElement("style");
      st.id = "bm-float-kf";
      st.textContent = "@keyframes bmFloat{from{opacity:1; transform:translateY(0)}to{opacity:0; transform:translateY(-26px)}}";
      document.head.appendChild(st);
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
      let startX, startY, origLeft, origTop, heldPointer = null;
      // Pointer Events + capture, one handler set per element. History: the
      // original shared ONE module-level dragCleanup across all blobs, so a
      // second grab stripped the first blob's listeners mid-drag and leaked
      // its onUp on window forever (a later touchend could teleport an
      // unrelated blob with stale cell data). The intermediate fix still let
      // window-level events wake BOTH held blobs — releasing finger B also
      // committed finger A's drag. Pointer capture ends the whole class:
      // after setPointerCapture, move/up events fire ONLY on the capturing
      // element for THAT pointerId — two thumbs drag two blobs in perfect
      // isolation, and there are no window listeners left to leak on unmount.

      function onDown(e){
        if(el._held) return; // this blob is already mid-drag
        el._held = true;
        heldPointer = e.pointerId;
        try{ el.setPointerCapture(e.pointerId); }catch(err){}
        startX = e.clientX; startY = e.clientY;
        origLeft = parseFloat(el.style.left);
        origTop = parseFloat(el.style.top);
        el.style.zIndex = 10;
        el.style.transition = "none";
      }
      function onMove(e){
        if(!el._held || e.pointerId !== heldPointer) return;
        if(!el.isConnected) return; // render() can replace nodes mid-drag — a detached blob has no cells
        e.preventDefault();
        el.style.left = (origLeft + e.clientX - startX) + "px";
        el.style.top = (origTop + e.clientY - startY) + "px";
      }
      function onUp(e){
        if(!el._held || (e.pointerId !== undefined && e.pointerId !== heldPointer)) return;
        el._held = false;
        heldPointer = null;
        if(!el.isConnected){ return; } // detached mid-drag: nothing to commit, nothing to snap
        el.style.zIndex = 1;

        const r = +el.dataset.r, c = +el.dataset.c;
        const curLeft = parseFloat(el.style.left), curTop = parseFloat(el.style.top);
        // RECYCLER: dropped off the board (center past the edge by half a
        // cell) = bank stage² and clear the cell. This is the anti-plateau
        // valve — stranded singletons become points instead of dead weight.
        const cx = curLeft + (CELL-8)/2, cy = curTop + (CELL-8)/2;
        const off = cx < -CELL*0.5 || cy < -CELL*0.5 || cx > COLS*CELL + CELL*0.5 || cy > ROWS*CELL + CELL*0.5;
        if(off && e.type !== "pointercancel"){
          recycleBlob(r, c);
          return;
        }
        // find the nearest actual cell center by distance, not just axis-independent rounding —
        // rounding each axis separately can disagree with which cell is genuinely closest when
        // a drop lands near a corner between four cells, silently snapping to the wrong one.
        let targetRow = 0, targetCol = 0, bestDist = Infinity;
        for(let rr=0; rr<ROWS; rr++) for(let cc=0; cc<COLS; cc++){
          const cellLeft = cc*CELL+4, cellTop = rr*CELL+4;
          const d = (cellLeft-curLeft)**2 + (cellTop-curTop)**2;
          if(d < bestDist){ bestDist = d; targetRow = rr; targetCol = cc; }
        }
        // pointercancel = the gesture was taken away (incoming call, browser
        // gesture, element churn) — a cancel is not a drop, so snap home
        // instead of committing whatever position the finger last touched
        const cancelled = e.type === "pointercancel";
        const moved = cancelled ? false : tryMove(r, c, targetRow, targetCol);
        if(!moved){
          // snap back with a visible bounce so a failed merge (or a canceled
          // gesture) is never silent — this is the direct fix for drops that
          // looked like they "did nothing"
          el.style.transition = "left .18s cubic-bezier(.34,1.56,.64,1), top .18s cubic-bezier(.34,1.56,.64,1)";
          el.style.left = (c*CELL+4) + "px";
          el.style.top = (r*CELL+4) + "px";
          if(!cancelled){
            Feedback.haptic("medium");
            Feedback.tone("pop");
          }
        } else {
          el.style.transition = "left .15s ease, top .15s ease";
        }
      }

      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    }

    // bank stage² points, clear the cell, no fresh spawn (that's the whole
    // point: recycling OPENS the board instead of churning it)
    function recycleBlob(r, c){
      const blob = grid[r][c];
      if(!blob) return;
      const pts = (blob.stage + 1) * (blob.stage + 1); // stage² (displayed number is stage+1)
      score += pts;
      grid[r][c] = null;
      q("#bm-score").textContent = score;
      if(score > best){
        best = score;
        api.setHighscore(best);
        q("#bm-best").textContent = best;
      }
      Feedback.tone("thud"); Feedback.haptic("light");
      addFloat(r, c, "+" + pts, "#EDEAE3");
      render();
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
        addFloat(tr, tc, "+" + Math.pow(2, source.stage + 1), "#FFB347");
        // milestone: every NEW max stage this board fires a banner + fanfare —
        // progress is felt at the moment it happens, not read off a counter
        const newStage = source.stage + 1;
        if(newStage > maxStage){
          maxStage = newStage;
          if(newStage > maxStageEver){
            maxStageEver = newStage;
            api.save({ maxStageEver });
            updateGoalLine();
          }
          if(newStage >= 3){
            Feedback.buzz(newStage >= WIN_STAGE ? "win" : "success");
            noteEl.textContent = `▲ NEW MAX — a ${newStage + 1} blob!` + (newStage === WIN_STAGE + 1 ? " ★ MEGA BLOB" : "");
            clearTimeout(noteEl._t);
            noteEl._t = setTimeout(() => { if(noteEl.isConnected) updateGoalLine(); }, 4000);
          }
        }
        // the goal: grow any blob to MEGA (stage 8 shown). Announce once per
        // board — the board stays playable and bigger is still possible
        if(newStage === WIN_STAGE + 1 && !winShown){
          winShown = true;
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
      // A merge is legal between ANY two same-stage blobs — dragging is
      // distance-free, not adjacency-based — and any empty cell lets a blob
      // relocate. So the true "no moves" state is: board full AND no two
      // blobs share a stage. The old adjacency scan declared game over while
      // a legal long-range merge still existed (premature restart).
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const b = grid[r][c];
        if(!b) return true; // an empty cell always leaves repositioning room
        for(let r2=r;r2<ROWS;r2++) for(let c2=(r2===r?c+1:0);c2<COLS;c2++){
          const o = grid[r2][c2];
          if(o && o.stage === b.stage) return true;
        }
      }
      return false;
    }

    newBtn.addEventListener("click", newGame);
    newGame();

    return () => {
      // no window listeners exist anymore — pointer capture keeps every drag
      // on its own element, and removing the element from the DOM ends its
      // event flow. Nothing to clean up, nothing can leak.
    };
  }
});
