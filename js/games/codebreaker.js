Strip.register({
  id: "codebreaker",
  scoreEncoding: "inverted", scoreCeiling: 100, // stores 100 - rows (CLASSIC code only); NEVER double it (twist)
  label: "LOGIC",
  title: "Code Breaker",
  tag: "3 codes",
  hint: "Crack the hidden color code before rows run out",
  async mount(container, api){
    // Round 22 (P2 tail): the ladder. ROOKIE eases the deduction (5 colors),
    // CLASSIC stays the pure Mastermind the store scores, VETERAN stretches
    // it (5 slots, 7 colors, 10 rows) — a genuinely deeper search tree with
    // its own save-best. The scoring pegs, duplicate handling and loss
    // reveal all carry over unchanged.
    const SIZES = [
      { key: "rookie",  label: "4×5", slots: 4, colors: 5, rows: 8 },
      { key: "classic", label: "4×6", slots: 4, colors: 6, rows: 8 },
      { key: "veteran", label: "5×7", slots: 5, colors: 7, rows: 10 },
    ];
    const INV = 100;
    const saved0 = await api.load().catch(() => null);
    let sizeIdx = saved0 && Number.isFinite(saved0.size) ? Math.min(2, Math.max(0, saved0.size)) : 1;
    const bests = saved0 && saved0.bests ? saved0.bests : {};
    const stored = await api.getHighscore();
    let bestClassic = stored ? INV - stored : Infinity;
    let S = SIZES[sizeIdx];
    let best = sizeIdx === 1 ? bestClassic : (bests[S.key] ?? Infinity);

    const PALETTE = [
      { name: "amber",  hex: "#FFB347" },
      { name: "violet", hex: "#8B7FE8" },
      { name: "coral",  hex: "#E8637F" },
      { name: "mint",   hex: "#5AC98A" },
      { name: "sky",    hex: "#6FA8FF" },
      { name: "sand",   hex: "#EDEAE3" },
      { name: "teal",   hex: "#5FD4D0" } // Round 22: the veteran's 7th color
    ];

    let secret, row, cur, solved, failed, history;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const sizeRow = document.createElement("div");
    sizeRow.style.cssText = "display:flex; gap:6px;";
    const sizeBtns = [];
    SIZES.forEach((d, i) => {
      const b = document.createElement("button");
      b.textContent = d.label;
      b.title = `${d.slots} slots · ${d.colors} colors · ${d.rows} rows`;
      b.style.cssText = "font-size:10px; padding:4px 9px; border-radius:20px; border:1px solid var(--line); background:var(--panel-2); color:var(--ink-dim); cursor:pointer;";
      b.addEventListener("click", () => {
        if(i === sizeIdx) return;
        sizeIdx = i; S = SIZES[i];
        best = sizeIdx === 1 ? bestClassic : (bests[S.key] ?? Infinity);
        api.save({ size: sizeIdx, bests }).catch(()=>{});
        paintSizes();
        buildRows();
        buildPalette();
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

    const rowsEl = document.createElement("div");
    rowsEl.style.cssText = "display:flex; flex-direction:column; gap:6px;";
    wrap.appendChild(rowsEl);

    const paletteEl = document.createElement("div");
    paletteEl.style.cssText = "display:flex; gap:8px; margin-top:4px; flex-wrap:wrap; justify-content:center;";
    wrap.appendChild(paletteEl);

    const actionRow = document.createElement("div");
    actionRow.style.cssText = "display:flex; gap:8px;";
    wrap.appendChild(actionRow);

    const submitBtn = document.createElement("button");
    submitBtn.className = "btn accent";
    submitBtn.textContent = "Check";
    submitBtn.addEventListener("click", submit);
    actionRow.appendChild(submitBtn);

    const newBtn = document.createElement("button");
    newBtn.className = "btn";
    newBtn.textContent = "New code";
    newBtn.addEventListener("click", newGame);
    actionRow.appendChild(newBtn);

    container.appendChild(wrap);

    const rowEls = [];
    function buildRows(){
      rowsEl.innerHTML = "";
      rowEls.length = 0;
      for(let r = 0; r < S.rows; r++){
        const rowEl = document.createElement("div");
        rowEl.style.cssText = "display:flex; align-items:center; gap:14px;";
        const slots = document.createElement("div");
        slots.style.cssText = "display:flex; gap:6px;";
        const slotEls = [];
        for(let s = 0; s < S.slots; s++){
          const d = document.createElement("div");
          d.style.cssText = "width:22px; height:22px; border-radius:50%; border:1px solid var(--line); background:transparent;";
          slots.appendChild(d);
          slotEls.push(d);
        }
        const pegs = document.createElement("div");
        pegs.style.cssText = "font-size:11px; letter-spacing:1px; color:var(--ink-dim); min-width:52px;";
        rowEl.appendChild(slots);
        rowEl.appendChild(pegs);
        rowsEl.appendChild(rowEl);
        rowEls.push({ slotEls, pegs });
      }
    }

    function buildPalette(){
      paletteEl.innerHTML = "";
      PALETTE.slice(0, S.colors).forEach(color => {
        const b = document.createElement("button");
        b.style.cssText = `width:30px; height:30px; border-radius:50%; border:2px solid var(--line); cursor:pointer; background:${color.hex};`;
        b.setAttribute("aria-label", color.name);
        b.addEventListener("click", () => pick(color.hex));
        paletteEl.appendChild(b);
      });
    }

    function render(){
      if(failed) return; // loss board is frozen with the reveal — don't repaint it
      statRow.innerHTML = `ROW <span style="color:var(--amber)">${Math.min(row + 1, S.rows)}/${S.rows}</span> · BEST <span style="color:var(--purple)">${best === Infinity ? "-" : best + " rows"}</span>`;
      for(let r = 0; r < S.rows; r++){
        const { slotEls, pegs } = rowEls[r];
        const active = r === row && !solved && !failed;
        for(let s = 0; s < S.slots; s++){
          const el = slotEls[s];
          const v = (r === row) ? cur[s] : (r < row ? history[r][s] : null);
          el.style.background = v || "transparent";
          el.style.borderColor = active ? "var(--amber)" : "var(--line)";
        }
        pegs.textContent = r < row ? pegText(history[r]) : "";
      }
      submitBtn.disabled = solved || failed || cur.some(v => !v);
      submitBtn.style.opacity = submitBtn.disabled ? ".45" : "1";
    }

    function pegText(guess){
      // standard Mastermind scoring: exact hits first, then color-only hits
      // counted from what's left — no double-counting even with duplicate colors
      let exact = 0;
      const gPool = [], sPool = [];
      for(let i = 0; i < S.slots; i++){
        if(guess[i] === secret[i]) exact++;
        else { gPool.push(guess[i]); sPool.push(secret[i]); }
      }
      // partials via multiset intersection — no double-counting with duplicates
      let p = 0;
      gPool.forEach(g => {
        const k = sPool.indexOf(g);
        if(k >= 0){ p++; sPool.splice(k, 1); }
      });
      return "●".repeat(exact) + "○".repeat(p);
    }

    function pick(hex){
      if(solved || failed) return;
      const s = cur.findIndex(v => !v);
      if(s < 0) return;
      cur[s] = hex;
      Feedback.tone("tap"); Feedback.haptic("light");
      render();
    }

    function submit(){
      if(solved || failed || cur.some(v => !v)) return;
      Feedback.tone("ok");
      history.push(cur.slice());
      const exact = cur.filter((v, i) => v === secret[i]).length;
      if(exact === S.slots){
        solved = true;
        Feedback.buzz("win");
        const used = row + 1;
        api.gameover("win", used);
        if(used < best){
          best = used;
          bests[S.key] = used;
          if(sizeIdx === 1){
            bestClassic = used;
            api.setHighscore(INV - used); // only the classic code feeds the store
          } else {
            api.save({ size: sizeIdx, bests }).catch(()=>{});
          }
        }
        render();
        return;
      }
      row++;
      if(row >= S.rows){
        failed = true;
        Feedback.buzz("lose");
        row = S.rows - 1;
        render();
        // paint the secret AFTER render() — render() repaints the active row
        // from cur[] (the last guess), which used to overwrite the reveal
        showSecret();
        statRow.innerHTML = `CODE WAS <span style="color:var(--danger)">${secret.map(hexColoredDot).join("")}</span>`;
        return;
      }
      cur = Array(S.slots).fill(null);
      render();
    }

    function hexColoredDot(hex){
      return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${hex};margin-left:3px;vertical-align:middle"></span>`;
    }

    function showSecret(){
      const { slotEls } = rowEls[row];
      for(let s = 0; s < S.slots; s++) slotEls[s].style.background = secret[s];
    }

    function newGame(){
      secret = Array.from({ length: S.slots }, () => PALETTE[Math.floor(Math.random() * S.colors)].hex);
      row = 0; cur = Array(S.slots).fill(null);
      solved = false; failed = false; history = [];
      render();
    }

    paintSizes();
    buildRows();
    buildPalette();
    newGame();
  }
});
