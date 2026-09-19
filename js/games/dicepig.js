/**
 * DICE PIG — push-your-luck dice (Round 32, cartridge #52).
 *
 * The deck had no dice game, and push-your-luck is the purest fit for a
 * half-minute cartridge: one honest decision, repeated — keep rolling to
 * grow the turn pot, or bank it and step closer to safety. Every roll past
 * the first is a bet the pot already won you against a 1-in-6 wipeout.
 *
 * The run (real Pig rules, solo):
 *   - 5 turns. Each turn: roll to build the pot, BANK anytime to keep it.
 *   - Roll a 1 → the turn's pot is LOST and the turn ends. Your banked
 *     total never burns — the pot does.
 *   - Bank your way to 50+ at ANY moment → you win the run on the spot.
 *   - Five turns gone without 50 → the run ends with what you banked.
 *
 * Why 50: five turns averaging a 10-point bank. Greedy averages say ~8.3
 * per turn if you always bank at 10 — so 50 asks for real courage somewhere,
 * not just five polite banks. Depth loves this game: your over-runs land
 * wherever your nerve does.
 *
 * House rules honored: container-scoped lookups, audio through Feedback,
 * one gameover() at the natural end, window keys gated on StripShell.isActive.
 */
Strip.register({
  id: "dicepig",
  label: "GAME",
  title: "Dice Pig",
  tag: "push your luck",
  hint: "Roll to build the pot — BANK before the 1 wipes it. 50 wins.",
  async mount(container, api){
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();

    const GOAL = 50;
    const TURNS = 5;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%; font-variant-numeric:tabular-nums;";

    // ---- top row: banked total vs best, and the goal ----
    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:18px; font-family:var(--font-display); font-size:10px; letter-spacing:.14em; color:var(--ink-dim);";
    statRow.innerHTML =
      '<div>BANKED <span id="dp-total" style="color:var(--amber); font-size:13px;">0</span></div>' +
      '<div>GOAL <span style="color:var(--ink)">' + GOAL + '</span></div>' +
      '<div>BEST <span id="dp-best" style="color:var(--purple)">' + best + '</span></div>';
    wrap.appendChild(statRow);

    // ---- turn dots (5) — spent turns fill in ----
    const dots = document.createElement("div");
    dots.id = "dp-dots";
    dots.style.cssText = "display:flex; gap:6px;";
    dots.setAttribute("aria-label", "Turns remaining");
    wrap.appendChild(dots);

    // ---- the die: a real pip face, no emoji, no image ----
    const die = document.createElement("div");
    die.id = "dp-die";
    die.style.cssText =
      "width:84px; height:84px; border-radius:16px; background:var(--panel);" +
      "border:1px solid rgba(var(--glow-rgb),calc(.4*var(--glow-mul,1)));" +
      "box-shadow:0 0 18px rgba(var(--glow-rgb),calc(.16*var(--glow-mul,1))), inset 0 -2px 6px rgba(0,0,0,.35);" +
      "display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr);" +
      "padding:14px; gap:2px; user-select:none;";
    wrap.appendChild(die);

    // pip layout per face (grid cells 1..9)
    const PIPS = {
      1: [5],
      2: [1, 9],
      3: [1, 5, 9],
      4: [1, 3, 7, 9],
      5: [1, 3, 5, 7, 9],
      6: [1, 3, 4, 6, 7, 9],
    };
    function drawDie(v, hot){
      die.innerHTML = "";
      const on = new Set(PIPS[v] || []);
      for(let i = 1; i <= 9; i++){
        const c = document.createElement("span");
        c.style.cssText = "border-radius:50%; place-self:center; width:11px; height:11px;" +
          (on.has(i)
            ? "background:" + (hot ? "var(--danger)" : "var(--amber)") + ";" +
              "box-shadow:0 0 8px rgba(var(--glow-rgb),calc(.5*var(--glow-mul,1)));"
            : "background:transparent;");
        die.appendChild(c);
      }
    }
    drawDie(6, false);

    // ---- pot + log ----
    const pot = document.createElement("div");
    pot.id = "dp-pot";
    pot.style.cssText = "font-family:var(--font-display); font-size:12px; letter-spacing:.18em; color:var(--ink); min-height:16px;";
    pot.textContent = "POT 0";
    wrap.appendChild(pot);

    const log = document.createElement("div");
    log.id = "dp-log";
    log.style.cssText = "font-size:11px; color:var(--ink-dim); min-height:15px; text-align:center;";
    log.textContent = "Five turns. Bank 50 before they're gone.";
    wrap.appendChild(log);

    // ---- controls ----
    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex; gap:10px; margin-top:2px;";
    const rollBtn = document.createElement("button");
    rollBtn.id = "dp-roll";
    rollBtn.className = "btn accent";
    rollBtn.type = "button";
    rollBtn.textContent = "ROLL";
    const bankBtn = document.createElement("button");
    bankBtn.id = "dp-bank";
    bankBtn.className = "btn";
    bankBtn.type = "button";
    bankBtn.textContent = "BANK";
    btnRow.appendChild(rollBtn);
    btnRow.appendChild(bankBtn);
    wrap.appendChild(btnRow);

    // ---- end overlay (win/lose) — replaces the controls, one-shot ----
    const endBox = document.createElement("div");
    endBox.id = "dp-end";
    endBox.style.cssText = "display:none; flex-direction:column; align-items:center; gap:8px; margin-top:2px;";
    const endMsg = document.createElement("div");
    endMsg.id = "dp-end-msg";
    endMsg.style.cssText = "font-family:var(--font-display); font-size:14px; letter-spacing:.2em;";
    const againBtn = document.createElement("button");
    againBtn.id = "dp-again";
    againBtn.className = "btn";
    againBtn.type = "button";
    againBtn.textContent = "PLAY AGAIN";
    endBox.appendChild(endMsg);
    endBox.appendChild(againBtn);
    wrap.appendChild(endBox);

    container.appendChild(wrap);

    // ---- state ----
    let turn, total, potVal, over;
    function reset(){
      turn = 1; total = 0; potVal = 0; over = false;
      endBox.style.display = "none";
      btnRow.style.display = "flex";
      q("#dp-total").textContent = "0";
      log.textContent = "Five turns. Bank 50 before they're gone.";
      drawDots();
      drawDie(6, false);
      setPot();
      rollBtn.disabled = false;
      bankBtn.disabled = true;
    }
    function drawDots(){
      dots.innerHTML = "";
      for(let i = 1; i <= TURNS; i++){
        const d = document.createElement("span");
        d.style.cssText = "width:7px; height:7px; border-radius:50%;" +
          (i < turn
            ? "background:var(--purple); box-shadow:0 0 6px rgba(var(--accent2-rgb),.5);"
            : i === turn
              ? "border:1px solid var(--amber);"
              : "border:1px solid var(--line);");
        dots.appendChild(d);
      }
    }
    function setPot(){
      pot.textContent = "POT " + potVal;
      pot.style.color = potVal > 0 ? "var(--amber)" : "var(--ink-dim)";
      bankBtn.disabled = over || potVal <= 0;
    }

    // dice roll animation: a short pip shuffle so the roll FEELS rolled
    let rolling = false;
    function rollAnim(final, done){
      rolling = true;
      let n = 0;
      const iv = setInterval(() => {
        drawDie(1 + Math.floor(Math.random() * 6), false);
        if(++n >= 6){
          clearInterval(iv);
          drawDie(final, final === 1);
          rolling = false;
          done();
        }
      }, 55);
    }

    function endRun(win){
      over = true;
      rollBtn.disabled = true;
      bankBtn.disabled = true;
      btnRow.style.display = "none";
      endBox.style.display = "flex";
      if(win){
        endMsg.textContent = "SAFE AT " + total + " — WIN";
        endMsg.style.color = "var(--good)";
        // turn was NOT advanced on the winning bank, so the unspent turns
        // are exactly TURNS - turn (banked on 5 → "with the last turn")
        const spare = TURNS - turn;
        log.textContent = spare === 0
          ? "Banked the goal on the last turn. Nerves of phosphor."
          : "Banked the goal with " + spare + " turn" + (spare === 1 ? "" : "s") + " to spare.";
      } else {
        endMsg.textContent = "FIVE TURNS — " + total;
        endMsg.style.color = "var(--ink-dim)";
        log.textContent = total >= GOAL - 8
          ? "So close to " + GOAL + " — the pot will haunt you."
          : "The pig keeps what you banked. Push harder next run.";
      }
      // ONE gameover at the natural end — the shell pays the run ladder,
      // missions and depth from this single honest call.
      try{ api.gameover(win ? "win" : "over", total); }catch(e){}
    }

    rollBtn.addEventListener("click", () => {
      if(over || rolling) return;
      const v = 1 + Math.floor(Math.random() * 6);
      try{ Feedback.tone("tap"); Feedback.haptic("light"); }catch(e){}
      rollAnim(v, () => {
        if(v === 1){
          const lost = potVal;
          potVal = 0;
          setPot();
          try{ Feedback.tone("error"); Feedback.haptic([30, 40, 30]); }catch(e){}
          if(turn >= TURNS){
            drawDots(); // all five spent
            log.textContent = lost > 0
              ? ("A one. The " + lost + "-point pot burns with the last turn.")
              : "A one on the last turn. Cruel.";
            endRun(false);
          } else {
            log.textContent = "A one — the " + lost + "-point pot burns. Turn " + (turn + 1) + ".";
            turn++;
            drawDots();
          }
        } else {
          potVal += v;
          setPot();
          log.textContent = v === 6
            ? "A six! The pot is " + potVal + " — push or bank?"
            : "Rolled " + v + " — pot " + potVal + ".";
        }
      });
    });

    bankBtn.addEventListener("click", () => {
      if(over || rolling || potVal <= 0) return;
      total += potVal;
      potVal = 0;
      q("#dp-total").textContent = total;
      try{ Feedback.tone("win"); Feedback.haptic("medium"); }catch(e){}
      if(total >= GOAL){
        setPot();
        log.textContent = "Banked " + total + " — that's the goal!";
        endRun(true);
        return;
      }
      if(turn >= TURNS){
        log.textContent = "Banked " + total + ", but the turns are gone.";
        endRun(false);
        return;
      }
      log.textContent = "Banked. " + (GOAL - total) + " to go, turn " + (turn + 1) + " of " + TURNS + ".";
      turn++;
      drawDots();
      setPot();
    });

    againBtn.addEventListener("click", () => {
      reset();
      try{ Feedback.uiTone("tap"); }catch(e){}
    });

    // keyboard: space/enter rolls, B banks — gated on THIS card being the
    // centered one (two copies of a cartridge can be mounted at once)
    const onKey = (e) => {
      if(window.StripShell && !StripShell.isActive(container)) return;
      if(e.repeat) return;
      if(e.key === " " || e.key === "Enter"){
        e.preventDefault();
        if(!over && !rolling) rollBtn.click();
      } else if(e.key === "b" || e.key === "B"){
        e.preventDefault();
        bankBtn.click();
      }
    };
    window.addEventListener("keydown", onKey);

    reset();

    // cleanup — the mount contract: stop every listener when scrolled away
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }
});
