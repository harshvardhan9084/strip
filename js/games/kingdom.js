/**
 * Kingdom — turn-based resource strategy, distinct from the real-time idle
 * sims (Ant Colony, Garden). Each "day" (a tap of Advance) you allocate
 * workers across three finite resources with interlocking tradeoffs:
 * gold funds new buildings, food feeds your population (population decays
 * if food runs out — real loss condition), and population is your worker
 * pool for next turn. No real-time ticking at all — entirely turn-based,
 * so it rewards a few seconds of thinking per visit rather than raw
 * clock-watching.
 */
Strip.register({
  id: "kingdom",
  label: "COLONY",
  title: "Kingdom",
  tag: "turns",
  hint: "Assign workers, advance the day",
  async mount(container, api){
    const DEFAULT = {
      day: 1, gold: 20, food: 30, population: 6,
      farms: 1, mines: 0, houses: 1,
      assign: { farm: 2, mine: 0 },
    };
    const saved = await api.load();
    const state = saved ? Object.assign({}, DEFAULT, saved) : DEFAULT;
    // deep-copy nested defaults on a first mount — Object.assign is shallow,
    // and state.assign must never alias the local template object
    state.assign = Object.assign({}, DEFAULT.assign, state.assign);
    let best = await api.getHighscore(); // best = longest survived day count
    const BUILD_COST = { farms: 15, mines: 20, houses: 25 };
    const FARM_YIELD = 4, MINE_YIELD = 3, FOOD_UPKEEP_PER_POP = 1.2;
    const POP_CAP_PER_HOUSE = 4;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%; max-width:300px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:10px; font-family:var(--font-display); font-size:8px; color:var(--ink-dim); text-align:center; flex-wrap:wrap; justify-content:center;";
    wrap.appendChild(statRow);

    const assignBox = document.createElement("div");
    assignBox.style.cssText = "width:100%; background:var(--panel-2); border-radius:12px; padding:10px 12px; display:flex; flex-direction:column; gap:8px;";
    wrap.appendChild(assignBox);

    const buildRow = document.createElement("div");
    buildRow.style.cssText = "display:flex; gap:6px; width:100%; flex-wrap:wrap; justify-content:center;";
    wrap.appendChild(buildRow);

    const note = document.createElement("div");
    note.style.cssText = "font-size:11px; color:var(--ink-dim); min-height:16px; text-align:center;";
    wrap.appendChild(note);

    const advanceBtn = document.createElement("button");
    advanceBtn.className = "btn accent";
    advanceBtn.textContent = "Advance day →";
    wrap.appendChild(advanceBtn);

    const resetBtn = document.createElement("button");
    resetBtn.className = "btn";
    resetBtn.textContent = "New kingdom";
    resetBtn.style.fontSize = "11px";
    wrap.appendChild(resetBtn);

    container.appendChild(wrap);

    function idleWorkers(){
      return state.population - state.assign.farm - state.assign.mine;
    }

    function fmt(n){ return Math.round(n*10)/10; }

    function renderStats(){
      statRow.innerHTML = `
        <div>DAY<br><span style="color:var(--ink); font-size:12px;">${state.day}</span></div>
        <div>GOLD<br><span style="color:var(--amber); font-size:12px;">${fmt(state.gold)}</span></div>
        <div>FOOD<br><span style="color:#6FCF97; font-size:12px;">${fmt(state.food)}</span></div>
        <div>POP<br><span style="color:var(--purple); font-size:12px;">${state.population}/${state.houses*POP_CAP_PER_HOUSE}</span></div>
        <div>BEST<br><span style="color:var(--ink-dim); font-size:12px;">${best}</span></div>
      `;
    }

    function renderAssign(){
      assignBox.innerHTML = `<div style="font-size:10px; color:var(--ink-dim); margin-bottom:2px;">WORKERS · ${idleWorkers()} idle</div>`;
      [["farm","🌾 Farms",state.farms],["mine","⛏ Mines",state.mines]].forEach(([key,label,built]) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; justify-content:space-between; gap:8px;";
        row.innerHTML = `<span style="font-size:12px;">${label} <span style="color:var(--ink-dim); font-size:10px;">(${built} built)</span></span>`;
        const controls = document.createElement("div");
        controls.style.cssText = "display:flex; align-items:center; gap:8px;";
        const minus = document.createElement("button");
        minus.textContent = "−"; minus.className = "btn"; minus.style.cssText = "padding:2px 10px; font-size:14px;";
        const val = document.createElement("span");
        val.textContent = state.assign[key];
        val.style.cssText = "font-family:var(--font-display); font-size:11px; min-width:16px; text-align:center;";
        const plus = document.createElement("button");
        plus.textContent = "+"; plus.className = "btn"; plus.style.cssText = "padding:2px 10px; font-size:14px;";

        minus.addEventListener("click", () => {
          if(state.assign[key] > 0){ state.assign[key]--; renderAssign(); }
        });
        plus.addEventListener("click", () => {
          const cap = key === "farm" ? state.farms : state.mines;
          if(state.assign[key] < cap && idleWorkers() > 0){ state.assign[key]++; renderAssign(); }
        });
        controls.appendChild(minus); controls.appendChild(val); controls.appendChild(plus);
        row.appendChild(controls);
        assignBox.appendChild(row);
      });
    }

    function renderBuild(){
      buildRow.innerHTML = "";
      [["farms","🌾 Farm"],["mines","⛏ Mine"],["houses","🏠 House"]].forEach(([key,label]) => {
        const btn = document.createElement("button");
        btn.className = "btn purple";
        btn.style.fontSize = "11px";
        const c = BUILD_COST[key];
        btn.textContent = `${label} (${c}g)`;
        btn.disabled = state.gold < c;
        btn.style.opacity = btn.disabled ? 0.5 : 1;
        btn.addEventListener("click", () => {
          if(state.gold < c) return;
          Feedback.tone("place"); Feedback.haptic("medium");
          state.gold -= c;
          state[key]++;
          persist();
          renderAll();
        });
        buildRow.appendChild(btn);
      });
    }

    function advance(){
      const farmYield = state.assign.farm * FARM_YIELD;
      const mineYield = state.assign.mine * MINE_YIELD;
      const upkeep = state.population * FOOD_UPKEEP_PER_POP;

      state.food += farmYield - upkeep;
      state.gold += mineYield;

      if(state.food < 0){
        // starvation: lose population, harsh but recoverable
        const starved = Math.min(state.population, Math.ceil(-state.food / 5));
        state.population = Math.max(0, state.population - starved);
        state.food = 0;
        Feedback.buzz("error");
        note.textContent = `Famine! Lost ${starved} population`;
      } else {
        note.textContent = "";
        // growth: surplus food attracts new population, capped by housing
        if(state.food > state.population * 3 && state.population < state.houses * POP_CAP_PER_HOUSE){
          state.population++;
          state.food -= 5;
        }
      }

      state.assign.farm = Math.min(state.assign.farm, state.population, state.farms);
      state.assign.mine = Math.min(state.assign.mine, state.population - state.assign.farm, state.mines);

      state.day++;
      if(state.population <= 0){
        note.textContent = "Your kingdom has collapsed. Starting fresh.";
        Feedback.buzz("lose");
        api.setHighscore(state.day).then(v => { best = v; renderAll(); });
        resetState();
      } else if(state.day > best){
        best = state.day;
        api.setHighscore(best);
        Feedback.tone("success"); Feedback.haptic("medium");
      } else {
        Feedback.tone("tap"); Feedback.haptic("light");
      }

      persist();
      renderAll();
    }

    function renderAll(){
      renderStats();
      renderAssign();
      renderBuild();
    }

    function persist(){ api.save(state); }

    // reset must build FRESH nested objects. Object.assign(state, DEFAULT, ...)
    // copied DEFAULT.assign by reference, so every later assignment mutated the
    // shared template and worker allocations leaked across resets.
    function resetState(){
      Object.assign(state, DEFAULT);
      state.assign = { farm: 2, mine: 0 };
      state.day = 1;
    }

    advanceBtn.addEventListener("click", advance);
    resetBtn.addEventListener("click", () => {
      resetState();
      persist();
      renderAll();
    });

    renderAll();
  }
});
