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
    // Factory, not a shared template. The old DEFAULT object got ALIASED as
    // state on a fresh (save-less) mount, so playing mutated the template —
    // and "New kingdom"'s Object.assign(state, DEFAULT) then restored the
    // MUTATED values: gold/food/population/buildings never actually reset.
    // Every state now comes from a fresh object; resets call the factory.
    const POP_CAP_PER_HOUSE = 4; // declared early so the factory's own defaults provably respect the cap
    const mkState = () => ({
      day: 1, gold: 20, food: 30, population: 4, // 4 == 1 house x POP_CAP_PER_HOUSE — the old 6/4 violated the game's own housing cap on every fresh boot
      farms: 1, mines: 0, houses: 1,
      assign: { farm: 1, mine: 0 }, // 1 == farms built; the old default assigned 2 workers to 1 farm
      peakPop: 4, collapsed: false,
    });
    const saved = await api.load();
    const state = saved ? Object.assign(mkState(), saved) : mkState();
    // assign must never alias anything nested in `saved` either
    state.assign = Object.assign({ farm: 1, mine: 0 }, state.assign);
    if(!Number.isFinite(state.peakPop)) state.peakPop = state.population;
    state.collapsed = !!state.collapsed;
    // MIGRATION CLAMP: old saves predate the cap fixes — a legacy save can
    // carry population 6 with 1 house (POP 6/4) and 2 farmers on 1 farm.
    // The old code left those on screen until famine and even paid double
    // farm yield for the phantom worker on the first Advance. Sanitize to the
    // CURRENT rules at mount so every save, old or new, obeys the same game.
    state.population = Math.min(state.population, state.houses * POP_CAP_PER_HOUSE);
    state.assign.farm = Math.min(state.assign.farm, state.farms, state.population);
    state.assign.mine = Math.min(state.assign.mine, state.mines, state.population - state.assign.farm);
    let best = await api.getHighscore(); // best = longest survived day count
    const BUILD_BASE = { farms: 15, mines: 20, houses: 25 };
    // Round 19 (AUDIT.md — Kingdom P1): flat build costs exhausted gold's
    // purpose around day 10, after which mines printed a dead currency. Costs
    // now escalate ×1.35 per built, so the Nth farm genuinely costs a plan.
    const buildCost = (key) => Math.round(BUILD_BASE[key] * Math.pow(1.35, state[key]));
    const FARM_YIELD = 4, MINE_YIELD = 3, FOOD_UPKEEP_PER_POP = 1.2;
    // era goals — the progression ladder the audit said was missing
    const ERAS = [
      { pop: 4,  title: "Hamlet" },
      { pop: 10, title: "Village" },
      { pop: 18, title: "Town" },
      { pop: 30, title: "City" },
      { pop: 50, title: "Metropolis" },
    ];
    function eraFor(pop){ let e = ERAS[0]; for(const x of ERAS){ if(pop >= x.pop) e = x; } return e; }

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

    // era line — the audit's missing progression ladder, visible at a glance
    const eraEl = document.createElement("div");
    eraEl.style.cssText = "font-size:10px; color:var(--purple); min-height:14px; text-align:center;";
    wrap.appendChild(eraEl);

    const advanceBtn = document.createElement("button");
    advanceBtn.className = "btn accent";
    advanceBtn.textContent = "Advance day →";
    wrap.appendChild(advanceBtn);

    // collapse recap overlay — mounted over the assign box, shown on death
    const recap = document.createElement("div");
    recap.style.cssText = "display:none; position:relative; margin-top:-2px; width:100%; background:var(--panel-2); border:1px solid var(--danger); border-radius:12px; padding:14px 10px; flex-direction:column; align-items:center; gap:8px;";
    wrap.appendChild(recap);

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
      const era = eraFor(state.population);
      statRow.innerHTML = `
        <div>DAY<br><span style="color:var(--ink); font-size:12px;">${state.day}</span></div>
        <div>GOLD<br><span style="color:var(--amber); font-size:12px;">${fmt(state.gold)}</span></div>
        <div>FOOD<br><span style="color:#6FCF97; font-size:12px;">${fmt(state.food)}</span></div>
        <div>POP<br><span style="color:var(--purple); font-size:12px;">${state.population}/${state.houses*POP_CAP_PER_HOUSE}</span></div>
        <div>BEST<br><span style="color:var(--ink-dim); font-size:12px;">${best}</span></div>
      `;
      eraEl.textContent = `the ${era.title} of day ${state.day} · next era at pop ${ERAS[Math.min(ERAS.indexOf(era)+1, ERAS.length-1)].pop}`;
    }

    function renderAssign(){
      if(state.collapsed) { assignBox.innerHTML = ""; return; } // the dead assign no one
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
        // honest disabled state — the old buttons stayed clickable and silently
        // no-op'd at the cap, which read like the game was broken
        const capNow = key === "farm" ? state.farms : state.mines;
        const canPlus = state.assign[key] < capNow && idleWorkers() > 0;
        const canMinus = state.assign[key] > 0;
        plus.disabled = !canPlus;
        minus.disabled = !canMinus;
        plus.style.opacity = canPlus ? 1 : 0.35;
        minus.style.opacity = canMinus ? 1 : 0.35;
        if(!canPlus) plus.title = state.assign[key] >= capNow ? "Fully staffed — build more " + label.toLowerCase() + " to assign" : "No idle workers";
        controls.appendChild(minus); controls.appendChild(val); controls.appendChild(plus);
        row.appendChild(controls);
        assignBox.appendChild(row);
      });
    }

    function renderBuild(){
      buildRow.innerHTML = "";
      if(state.collapsed) return; // a dead kingdom builds nothing
      [["farms","🌾 Farm"],["mines","⛏ Mine"],["houses","🏠 House"]].forEach(([key,label]) => {
        const btn = document.createElement("button");
        btn.className = "btn purple";
        btn.style.fontSize = "11px";
        const c = buildCost(key);
        btn.textContent = `${label} (${c}g)`;
        btn.disabled = state.gold < c;
        btn.style.opacity = btn.disabled ? 0.5 : 1;
        btn.addEventListener("click", () => {
          const cost = buildCost(key);
          if(state.gold < cost) return;
          Feedback.tone("place"); Feedback.haptic("medium");
          state.gold -= cost;
          state[key]++;
          persist();
          renderAll();
        });
        buildRow.appendChild(btn);
      });
    }

    function advance(){
      if(state.collapsed) return; // the kingdom is dead until re-founded
      // CLAMP FIRST, then compute yields — the old order paid the yield for
      // over-cap assignments (a legacy 2-farmers-on-1-farm save earned double
      // on its first Advance before the clamp silently ate the extra worker)
      state.assign.farm = Math.min(state.assign.farm, state.population, state.farms);
      state.assign.mine = Math.min(state.assign.mine, state.population - state.assign.farm, state.mines);

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
        // growth: surplus food attracts new population, capped by housing
        if(state.food > state.population * 3 && state.population < state.houses * POP_CAP_PER_HOUSE){
          state.population++;
          state.food -= 5;
        }
      }

      // Round 19: random events — the audit's "no threat after equilibrium"
      // fix. The day can now surprise you in both directions.
      const prevEra = eraFor(state.population);
      if(Math.random() < 0.28){
        const roll = Math.random();
        if(roll < 0.22 && state.food > 4){
          const lost = Math.ceil(state.food * 0.2);
          state.food -= lost;
          note.textContent = `☀ Drought — ${lost} food spoiled`;
        } else if(roll < 0.44 && state.gold > 6){
          const lost = Math.max(4, Math.ceil(state.gold * 0.3));
          state.gold -= lost;
          note.textContent = `🏴 Bandits! — ${lost} gold stolen`;
        } else if(roll < 0.66){
          const gain = 3 + state.assign.mine * 2;
          state.gold += gain;
          note.textContent = `🧳 Traders passed — +${gain} gold`;
        } else if(roll < 0.85){
          state.food += farmYield;
          note.textContent = `🌾 Blessed harvest — +${farmYield} food`;
        } else if(state.population < state.houses * POP_CAP_PER_HOUSE){
          state.population++;
          note.textContent = `🚶 Wanderers joined — +1 population`;
        } else {
          note.textContent = `🚶 Wanderers passed by — no room to stay`;
        }
        Feedback.tone("ok");
      } else if(!note.textContent.startsWith("Famine")){
        note.textContent = "";
      }

      state.peakPop = Math.max(state.peakPop, state.population);
      state.day++;

      // era fanfare — crossing a population threshold is the game's milestone
      const newEra = eraFor(state.population);
      if(newEra !== prevEra && !state.collapsed){
        Feedback.buzz("win");
        note.textContent = `👑 Your settlement is now a ${newEra.title}!`;
      }

      if(state.population <= 0){
        // collapse now freezes the run behind a RECAP CARD — the one dramatic
        // moment this game can produce used to reset with a one-line note (S8)
        state.collapsed = true;
        Feedback.buzz("lose");
        api.setHighscore(state.day - 1 >= 0 ? state.day - 1 : 0).then(v => { best = v; });
        showRecap();
      } else if(state.day > best){
        best = state.day;
        api.setHighscore(best);
        Feedback.tone("success"); Feedback.haptic("medium");
      } else if(!state.collapsed){
        Feedback.tone("tap"); Feedback.haptic("light");
      }

      persist();
      renderAll();
    }

    // the tombstone: "your kingdom lasted 34 days" with the run's shape on it
    function showRecap(){
      recap.innerHTML = "";
      const t = document.createElement("div");
      t.style.cssText = "font-family:var(--font-display); font-size:15px; color:var(--danger); letter-spacing:1px;";
      t.textContent = "THE KINGDOM HAS FALLEN";
      const era = eraFor(state.peakPop);
      const s = document.createElement("div");
      s.style.cssText = "font-size:11px; color:var(--ink); line-height:1.9; text-align:center;";
      s.innerHTML = `it lasted <b style="color:var(--amber)">${state.day - 1} days</b><br>peaked at <b style="color:var(--purple)">${state.peakPop} people</b> — a ${era.title}<br>best reign: <b>${best} days</b>`;
      const b = document.createElement("button");
      b.className = "btn accent";
      b.textContent = "Found a new kingdom";
      b.addEventListener("click", () => {
        state.collapsed = false;
        recap.style.display = "none";
        resetState();
        persist();
        renderAll();
      });
      recap.appendChild(t); recap.appendChild(s); recap.appendChild(b);
      recap.style.display = "flex";
    }

    function renderAll(){
      renderStats();
      if(state.collapsed){
        showRecap();
        advanceBtn.disabled = true;
        advanceBtn.style.opacity = 0.4;
      } else {
        if(recap.style.display === "flex"){ recap.style.display = "none"; }
        advanceBtn.disabled = false;
        advanceBtn.style.opacity = 1;
      }
      renderAssign();
      renderBuild();
    }

    function persist(){ api.save(state); }

    // reset must build FRESH nested objects. Object.assign(state, DEFAULT, ...)
    // copied DEFAULT.assign by reference, so every later assignment mutated the
    // shared template and worker allocations leaked across resets.
    function resetState(){
      // rebuild from the FACTORY — Object.assign(state, DEFAULT) restored the
      // mutated template itself when a fresh mount had aliased it, so gold,
      // food, population and buildings silently survived "New kingdom".
      // (mkState() already carries day 1 + the correct assign split.)
      Object.assign(state, mkState());
      state.assign = { farm: 1, mine: 0 }; // fresh nested object — never alias the factory's
    }

    advanceBtn.addEventListener("click", advance);
    resetBtn.addEventListener("click", () => {
      state.collapsed = false;
      recap.style.display = "none";
      resetState();
      persist();
      renderAll();
    });

    // a legacy save can mount already-collapsed (crashed mid-recap) — show it
    renderAll();
  }
});
