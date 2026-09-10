Strip.register({
  id: "lexicle",
  label: "WORD",
  title: "Lexicle",
  tag: "daily-ish",
  hint: "Guess the 5-letter word in 6 tries",
  async mount(container, api){
    // small but honest dictionary — every entry is a legal guess AND a legal answer
    const RAW = ("about brave crane drink eagle flame grape house ivory juice kneel light mouse noble ocean " +
      "piano queen river stone tiger urban voice water yeast zebra apple beach cloud dance earth feast " +
      "ghost heart ideal jolly koala lemon money night orbit plant quiet robot smile train unity vivid " +
      "whale amber bench candy delta ember frost glide humor inlet joker karma lunar mango olive pearl " +
      "quest royal spice tulip villa wound yacht zonal album boast chalk dwell elope fable grind hinge " +
      "input knead latch mirth nurse opal prism quill spark tempo uphold vital wizard adapt blaze crest " +
      "donut elbow flint grove husk indign lumen maple nylon offal plume quirk shine trust wander amino " +
      "brink chess clash drift epoch flail gourd hoist knoll lush moped nudge oaken pouch rally scope " +
      "thorn unity vapor whisk yearn zeroed alike bloom crisp daisy evoke fern gauge honey infer jewel " +
      "known latch murmur notch onyx pedal quaint rust solar surge tunic vapor wharf yield zippy").split(" ");
    const WORDS = [...new Set(RAW.filter(w => w.length === 5 && /^[a-z]+$/.test(w)))];

    const stored = await api.load();
    let streak = stored && Number.isFinite(stored.streak) ? stored.streak : 0;
    let played = stored && Number.isFinite(stored.played) ? stored.played : 0;

    const TRIES = 6, LEN = 5;
    let answer, row, col, over;
    const letterState = {}; // best color per letter across keyboard: 2=green 1=yellow 0=gray

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid; grid-template-rows:repeat(6,1fr); gap:5px;";
    const rowEls = [];
    for(let r = 0; r < TRIES; r++){
      const rowEl = document.createElement("div");
      rowEl.style.cssText = "display:flex; gap:4px;";
      const tileEls = [];
      for(let c = 0; c < LEN; c++){
        const t = document.createElement("div");
        t.style.cssText = "width:34px; height:38px; border-radius:6px; border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-size:13px; color:var(--ink); background:transparent; transition:all .15s ease;";
        rowEl.appendChild(t);
        tileEls.push(t);
      }
      grid.appendChild(rowEl);
      rowEls.push(tileEls);
    }
    wrap.appendChild(grid);

    const kb = document.createElement("div");
    kb.style.cssText = "display:flex; flex-direction:column; gap:5px; margin-top:2px;";
    wrap.appendChild(kb);

    const keyEls = {};
    const ROWS_KB = [["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["enter","z","x","c","v","b","n","m","back"]];
    ROWS_KB.forEach(keys => {
      const kr = document.createElement("div");
      kr.style.cssText = "display:flex; gap:3px; justify-content:center;";
      keys.forEach(k => {
        const b = document.createElement("button");
        b.textContent = k === "enter" ? "⏎" : k === "back" ? "⌫" : k.toUpperCase();
        b.style.cssText = `min-width:${k.length > 1 ? 44 : 26}px; height:36px; border-radius:6px; border:1px solid var(--line); background:var(--panel-2); color:var(--ink); font-family:var(--font-display); font-size:${k.length > 1 ? 8 : 10}px; cursor:pointer;`;
        b.addEventListener("click", () => handleKey(k));
        kr.appendChild(b);
        keyEls[k] = b;
      });
      kb.appendChild(kr);
    });

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New word";
    newBtn.addEventListener("click", () => newGame(true));
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    function statUpdate(msg){
      statRow.innerHTML = msg || `STREAK <span style="color:var(--amber)">${streak}</span> · PLAYED <span style="color:var(--purple)">${played}</span>`;
    }

    function newGame(countPlay){
      if(countPlay && over === false && row > 0) played++; // abandoned games don't count
      answer = WORDS[Math.floor(Math.random() * WORDS.length)];
      row = 0; col = 0; over = false;
      for(const k of Object.keys(letterState)) delete letterState[k];
      for(let r = 0; r < TRIES; r++) for(let c = 0; c < LEN; c++){
        const t = rowEls[r][c];
        t.textContent = "";
        t.style.background = "transparent";
        t.style.borderColor = "var(--line)";
        t.style.color = "var(--ink)";
      }
      Object.keys(keyEls).forEach(k => { keyEls[k].style.background = "var(--panel-2)"; });
      statUpdate();
    }

    function handleKey(k){
      if(over) return;
      if(k === "enter"){
        if(col < LEN){ Feedback.tone("thud"); flashRow(); return; }
        submit();
      } else if(k === "back"){
        if(col > 0){ col--; rowEls[row][col].textContent = ""; }
      } else if(/^[a-z]$/.test(k) && col < LEN){
        rowEls[row][col].textContent = k.toUpperCase();
        col++;
        Feedback.tone("tap");
      }
    }

    function flashRow(){
      rowEls[row].forEach(t => { t.style.borderColor = "var(--danger)"; setTimeout(() => { t.style.borderColor = "var(--line)"; }, 250); });
    }

    function submit(){
      const guess = rowEls[row].map(t => t.textContent.toLowerCase()).join("");
      if(!WORDS.includes(guess)){
        flashRow();
        statUpdate(`<span style="color:var(--danger)">not in word list</span>`);
        setTimeout(() => statUpdate(), 1200);
        return;
      }
      // two-pass coloring: greens first, then yellows from remaining letter pool —
      // the classic bug where "EACH" against "HOUSE" shows two yellows for one H
      const pool = answer.split("");
      const result = Array(LEN).fill(0);
      for(let i = 0; i < LEN; i++){
        if(guess[i] === answer[i]){ result[i] = 2; pool.splice(pool.indexOf(guess[i]), 1); }
      }
      for(let i = 0; i < LEN; i++){
        if(result[i] === 2) continue;
        const p = pool.indexOf(guess[i]);
        if(p >= 0){ result[i] = 1; pool.splice(p, 1); }
      }
      for(let i = 0; i < LEN; i++){
        const t = rowEls[row][i];
        t.style.background = result[i] === 2 ? "#4E9A5B" : result[i] === 1 ? "#B08A2E" : "#33333D";
        t.style.borderColor = "transparent";
      }
      // keyboard reflects the BEST known state per letter
      for(let i = 0; i < LEN; i++){
        const k = guess[i];
        const rank = { 0: 0, 1: 1, 2: 2 };
        const cur = letterState[k] ?? -1;
        if(rank[result[i]] > cur){
          letterState[k] = result[i];
          keyEls[k].style.background = result[i] === 2 ? "#4E9A5B" : result[i] === 1 ? "#B08A2E" : "#33333D";
        }
      }
      Feedback.haptic("light");
      if(guess === answer){
        over = true;
        streak++; played++;
        api.save({ streak, played });
        Feedback.buzz("win");
        statUpdate(`<span style="color:var(--purple)">SOLVED — streak ${streak}</span>`);
        return;
      }
      row++;
      col = 0;
      if(row >= TRIES){
        over = true;
        streak = 0; played++;
        api.save({ streak, played });
        Feedback.buzz("lose");
        statUpdate(`the word was <span style="color:var(--amber)">${answer.toUpperCase()}</span> · streak reset`);
      }
    }

    function onKey(e){
      // input arbitration: only the CENTERED card takes keys
      if(window.StripShell && !StripShell.isActive(container)) return;
      if(e.key === "Enter") handleKey("enter");
      else if(e.key === "Backspace") handleKey("back");
      else if(/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toLowerCase());
    }
    window.addEventListener("keydown", onKey);

    newGame(false);

    return () => window.removeEventListener("keydown", onKey);
  }
});
