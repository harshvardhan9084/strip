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
    //
    // Round 21 (user: "do something about blob merge again"):
    //   4. THE BOARD PERSISTS — scrolling away used to silently reset a run
    //      (unmount threw the grid away); score/grid/record now survive the
    //      strip's mount windows, like every deep game in the deck.
    //   5. COMBO CHAIN — merges within 2.5s stack a ×2..×5 multiplier. The
    //      rush verb is CHAINING, not merging: plan two moves, feel the
    //      multiplier climb, hear the pitch rise.
    //   6. MERGES MAKE SOUND — the core verb was completely silent (only
    //      FAILED drops had a tone). Merges now chirp, rising with stage
    //      and combo; spawns pop in; merges bounce; blobs have depth.
    //   7. JAM CEREMONY — the (near-impossible) stuck board announces its
    //      reshuffle instead of silently wiping your score mid-drag.
    let maxStageEver = 0;
    let savedState = null;
    try{
      savedState = await api.load();
      if(savedState && Number.isFinite(savedState.maxStageEver)) maxStageEver = savedState.maxStageEver;
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
    statRow.innerHTML = `<div>SCORE <span id="bm-score" style="color:var(--amber)">0</span></div><div>BEST <span id="bm-best" style="color:var(--purple)">${best}</span></div><div id="bm-combo" style="display:none; color:#6FCF97;"></div>`;
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

    // ---- Round 21: combo chain ----
    let combo = 0, lastMergeAt = 0;
    const COMBO_MS = 2500, COMBO_MAX = 5;
    function updateComboChip(){
      const chip = q("#bm-combo");
      if(!chip) return;
      const hot = combo >= 2 && (Date.now() - lastMergeAt) <= COMBO_MS;
      chip.style.display = hot ? "block" : "none";
      if(hot) chip.textContent = "COMBO ×" + combo;
    }
    // one low-rate heartbeat just for the combo chip's expiry
    const comboTick = setInterval(updateComboChip, 400);

    // ---- Round 21: board persistence ----
    function persistState(){
      api.save({ grid, score, maxStage, winShown, maxStageEver }).catch(()=>{});
    }
    function restoreState(){
      const s = savedState;
      if(!s || !Array.isArray(s.grid) || s.grid.length !== ROWS) return false;
      if(!s.grid.every(row => Array.isArray(row) && row.length === COLS)) return false;
      grid = s.grid.map(row => row.map(b => (b && Number.isFinite(b.stage) && b.stage >= 0) ? { stage: Math.floor(b.stage) } : null));
      score = Number.isFinite(s.score) && s.score > 0 ? Math.floor(s.score) : 0;
      maxStage = Number.isFinite(s.maxStage) ? Math.max(0, Math.floor(s.maxStage)) : 0;
      winShown = !!s.winShown;
      q("#bm-score").textContent = score;
      return true;
    }

    function newGame(){
      grid = Array.from({length:ROWS}, () => Array(COLS).fill(null));
      score = 0;
      winShown = false;
      maxStage = 0;
      combo = 0; lastMergeAt = 0;
      for(let i=0;i<4;i++) addBlob();
      render();
      q("#bm-score").textContent = 0;
      persistState();
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
      grid[r][c] = { stage, _new: true }; // _new: one pop-in animation
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
      st.textContent =
        "@keyframes bmFloat{from{opacity:1; transform:translateY(0)}to{opacity:0; transform:translateY(-26px)}}" +
        "@keyframes bmPopIn{from{transform:scale(0)}to{transform:scale(1)}}" +
        "@keyframes bmMergeBounce{0%{transform:scale(.6)}55%{transform:scale(1.22)}100%{transform:scale(1)}}";
      document.head.appendChild(st);
    }

    function render(){
      board.innerHTML = "";
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const blob = grid[r][c];
        if(!blob) continue;
        const el = document.createElement("div");
        el.dataset.r = r; el.dataset.c = c;
        const col = STAGE_COLORS[Math.min(blob.stage, STAGE_COLORS.length-1)];
        // Round 21: depth + high-stage aura — flat discs read as buttons;
        // inset light/shadow reads as a physical blob worth touching
        const aura = blob.stage >= 5 ? `, 0 0 16px ${col}66` : "";
        el.style.cssText = `
          position:absolute; left:${c*CELL+4}px; top:${r*CELL+4}px; width:${CELL-8}px; height:${CELL-8}px;
          border-radius:50%; background:${col};
          display:flex; align-items:center; justify-content:center; font-weight:700; color:#fff; font-size:14px;
          cursor:grab; user-select:none;
          box-shadow:0 4px 10px rgba(0,0,0,.3), inset 0 -5px 8px rgba(0,0,0,.28), inset 0 4px 7px rgba(255,255,255,.22)${aura};
          transition:left .15s ease, top .15s ease;
        `;
        el.textContent = blob.stage + 1;
        if(blob._new){ el.style.animation = "bmPopIn .18s ease-out"; blob._new = false; }
        else if(blob._merged){ el.style.animation = "bmMergeBounce .3s ease-out"; blob._merged = false; }
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
        el.style.transform = "scale(1.12)"; // the grab is FELT, not just seen
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
        el.style.transform = "";

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
      // Round 21: spending breaks the chain — recycle OR chain-merge is a
      // real tempo decision now
      combo = 0;
      updateComboChip();
      Feedback.tone("thud"); Feedback.haptic("light");
      addFloat(r, c, "+" + pts, "#EDEAE3");
      render();
      persistState();
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
        grid[tr][tc] = { stage: source.stage + 1, _merged: true };
        grid[r][c] = null;
        // Round 21 — combo chain: merges within COMBO_MS stack ×2..×5.
        // The rush verb is CHAINING; the pitch rises with the combo.
        const now = Date.now();
        combo = (now - lastMergeAt <= COMBO_MS) ? Math.min(COMBO_MAX, combo + 1) : 1;
        lastMergeAt = now;
        const mult = combo;
        const pts = Math.pow(2, source.stage + 1) * mult;
        score += pts;
        q("#bm-score").textContent = score;
        if(score > best){
          best = score;
          api.setHighscore(best);
          q("#bm-best").textContent = best;
        }
        try{ Feedback.tone(300 + source.stage * 55 + (mult - 1) * 70, 0.07); }catch(e){}
        Feedback.haptic("light");
        addFloat(tr, tc, "+" + Math.pow(2, source.stage + 1) + (mult > 1 ? " ×" + mult : ""), "#FFB347");
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
          persistState();
        }
        addBlob();
        success = true;
      }
      if(success){
        render();
        updateComboChip();
        persistState();
        if(emptyCells().length === 0 && !anyMergePossible()){
          // Round 21: the stuck board announces its reshuffle — the old
          // silent 900ms wipe read as the game hiccuping your score away
          showJam();
        }
      }
      return success;
    }

    // ---- Round 21: jam ceremony ----
    let jamShown = false;
    function showJam(){
      if(jamShown) return;
      jamShown = true;
      const banner = document.createElement("div");
      banner.style.cssText = "position:absolute; inset:0; background:rgba(10,10,16,.85); border-radius:12px; z-index:15; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; text-align:center;";
      banner.innerHTML =
        '<div style="font-family:var(--font-display); font-size:13px; color:var(--amber); letter-spacing:2px;">BOARD JAM</div>' +
        '<div style="font-size:11px; color:var(--ink-dim);">no merges left — reshuffling with a fresh board…</div>' +
        '<div style="font-size:10px; color:var(--ink);">score ' + score + ' banked · best ' + best + '</div>';
      board.appendChild(banner);
      try{ Feedback.buzz("win"); }catch(e){}
      setTimeout(() => { jamShown = false; newGame(); }, 1400);
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
    // Round 21: the board survives scroll-away unmounts — restore the run
    // if a valid one is saved, exactly like every deep game in the deck
    if(!restoreState()) newGame();
    render();

    return () => {
      clearInterval(comboTick);
      persistState();
      // no window listeners exist anymore — pointer capture keeps every drag
      // on its own element, and removing the element from the DOM ends its
      // event flow. Nothing to clean up, nothing can leak.
    };
  }
});
