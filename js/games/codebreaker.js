Strip.register({
  id: "codebreaker",
  label: "LOGIC",
  title: "Code Breaker",
  tag: "mastermind",
  hint: "Crack the 4-color code in 8 rows",
  async mount(container, api){
    const ROWS = 8, SLOTS = 4;
    const INV = 100; // fewer rows = better; stored inverted like Lights Out
    const stored = await api.getHighscore();
    let best = stored ? INV - stored : Infinity;

    const PALETTE = [
      { name: "amber",  hex: "#FFB347" },
      { name: "violet", hex: "#8B7FE8" },
      { name: "coral",  hex: "#E8637F" },
      { name: "mint",   hex: "#5AC98A" },
      { name: "sky",    hex: "#6FA8FF" },
      { name: "sand",   hex: "#EDEAE3" }
    ];

    let secret, row, cur, solved, failed;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const rowsEl = document.createElement("div");
    rowsEl.style.cssText = "display:flex; flex-direction:column; gap:6px;";
    wrap.appendChild(rowsEl);

    const paletteEl = document.createElement("div");
    paletteEl.style.cssText = "display:flex; gap:8px; margin-top:4px;";
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
    for(let r = 0; r < ROWS; r++){
      const rowEl = document.createElement("div");
      rowEl.style.cssText = "display:flex; align-items:center; gap:14px;";
      const slots = document.createElement("div");
      slots.style.cssText = "display:flex; gap:6px;";
      const slotEls = [];
      for(let s = 0; s < SLOTS; s++){
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

    PALETTE.forEach(color => {
      const b = document.createElement("button");
      b.style.cssText = `width:30px; height:30px; border-radius:50%; border:2px solid var(--line); cursor:pointer; background:${color.hex};`;
      b.setAttribute("aria-label", color.name);
      b.addEventListener("click", () => pick(color.hex));
      paletteEl.appendChild(b);
    });

    function render(){
      statRow.innerHTML = `ROW <span style="color:var(--amber)">${Math.min(row + 1, ROWS)}/${ROWS}</span> · BEST <span style="color:var(--purple)">${best === Infinity ? "-" : best + " rows"}</span>`;
      for(let r = 0; r < ROWS; r++){
        const { slotEls, pegs } = rowEls[r];
        const active = r === row && !solved && !failed;
        for(let s = 0; s < SLOTS; s++){
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
      for(let i = 0; i < SLOTS; i++){
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

    let history = [];

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
      if(exact === SLOTS){
        solved = true;
        Feedback.buzz("win");
        api.setHighscore(INV - (row + 1)).then(v => { best = INV - v; render(); });
        render();
        return;
      }
      row++;
      if(row >= ROWS){
        failed = true;
        Feedback.buzz("lose");
        row = ROWS - 1;
        statRow.innerHTML = `CODE WAS <span style="color:var(--danger)">&nbsp;</span>`;
        showSecret();
        render();
        return;
      }
      cur = Array(SLOTS).fill(null);
      render();
    }

    function showSecret(){
      const { slotEls } = rowEls[row];
      for(let s = 0; s < SLOTS; s++) slotEls[s].style.background = secret[s];
    }

    function newGame(){
      secret = Array.from({ length: SLOTS }, () => PALETTE[Math.floor(Math.random() * PALETTE.length)].hex);
      row = 0; cur = Array(SLOTS).fill(null);
      solved = false; failed = false; history = [];
      render();
    }

    newGame();
  }
});
