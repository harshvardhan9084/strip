/**
 * Garden — idle sim with a decay mechanic (differentiates it from Ant Colony,
 * which has no downside to neglect). Plants need periodic watering; if you
 * ignore the garden too long, health drops and growth slows/reverses.
 * This creates a *return-visit* incentive rather than a pure "let it cook" loop.
 */
Strip.register({
  id: "garden",
  label: "COLONY",
  title: "Garden",
  tag: "sim",
  hint: "Water plants, keep them healthy, harvest",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    function mkPlant(){
      return { stage: 0, health: 100, lastWater: Date.now() };
    }
    const DEFAULT = { plants: [mkPlant(), mkPlant(), mkPlant()], coins: 0, lastSeen: Date.now() };
    const saved = await api.load();
    const state = saved ? Object.assign({}, DEFAULT, saved) : DEFAULT;
    // never share the DEFAULT template's plant array by reference (a saved
    // state missing `plants` would otherwise mutate the template)
    if(!Array.isArray(state.plants) || !state.plants.length){
      state.plants = [mkPlant(), mkPlant(), mkPlant()];
    }
    let best = await api.getHighscore(); // best = total harvests ever

    const STAGES = ["🌱","🌿","🪴","🌸"];
    const DRY_MS = 45 * 1000;        // needs water again after this long
    const DECAY_PER_MS = 0.00025;    // health lost per ms once dry
    const GROW_MS = 20 * 1000;       // healthy time needed to advance a stage

    // catch up offline: once past DRY_MS, health decays for the excess offline time
    const elapsedMs = Math.min(1000*60*60*8, Math.max(0, Date.now() - state.lastSeen));
    state.plants.forEach(p => {
      const overDry = Math.max(0, elapsedMs - DRY_MS);
      p.health = Math.max(0, p.health - overDry * DECAY_PER_MS);
    });

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:12px; width:100%; max-width:300px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:16px; font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>COINS <span id="gd-coins" style="color:var(--amber)">${state.coins}</span></div><div>HARVESTS <span id="gd-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const plotRow = document.createElement("div");
    plotRow.style.cssText = "display:flex; gap:10px;";
    wrap.appendChild(plotRow);

    const note = document.createElement("div");
    note.style.cssText = "font-size:11px; color:var(--ink-dim); min-height:16px; text-align:center;";
    wrap.appendChild(note);

    const addBtn = document.createElement("button");
    addBtn.className = "btn purple";
    addBtn.textContent = "New plot (20 coins)";
    wrap.appendChild(addBtn);

    container.appendChild(wrap);

    // Plant boxes are created ONCE and updated in place. The old render()
    // nuked plotRow.innerHTML and rebuilt every box + listener every second —
    // a pointless GC/relayout churn on a card that just needs its bars moved.
    const boxes = [];
    function makeBox(idx){
      const box = document.createElement("div");
      box.style.cssText = `
        width:74px; height:100px; border-radius:12px; background:var(--panel-2);
        border:1px solid var(--line); display:flex; flex-direction:column;
        align-items:center; justify-content:space-between; padding:8px; cursor:pointer;
      `;
      const emoji = document.createElement("div");
      emoji.style.fontSize = "28px";

      const healthBar = document.createElement("div");
      healthBar.style.cssText = "width:100%; height:4px; background:var(--bg); border-radius:3px; overflow:hidden;";
      const healthFill = document.createElement("div");
      healthFill.style.cssText = "height:100%; width:100%; transition:width .3s ease;";
      healthBar.appendChild(healthFill);

      const label = document.createElement("div");
      label.style.cssText = "font-size:9px; color:var(--ink-dim);";

      box.appendChild(emoji);
      box.appendChild(healthBar);
      box.appendChild(label);

      box.addEventListener("click", () => {
        const p = state.plants[idx];
        if(!p) return;
        if(p.stage >= STAGES.length - 1){
          // harvest
          Feedback.buzz("success");
          state.coins += 15;
          state.plants[idx] = mkPlant();
          best++;
          api.setHighscore(best);
          note.textContent = "Harvested! +15 coins";
        } else {
          Feedback.tone("tap"); Feedback.haptic("light");
          p.lastWater = Date.now();
          p.health = Math.min(100, p.health + 20);
          note.textContent = "Watered";
        }
        setTimeout(() => note.textContent = "", 1500);
        persist();
        render();
      });

      plotRow.appendChild(box);
      boxes[idx] = { emoji, healthFill, label };
    }

    function syncPlots(){
      // grow the box list only when the plot count changes
      for(let i = boxes.length; i < state.plants.length; i++) makeBox(i);
    }

    function render(){
      syncPlots();
      state.plants.forEach((p, i) => {
        const b = boxes[i];
        b.emoji.textContent = STAGES[Math.min(p.stage, STAGES.length-1)];
        b.healthFill.style.width = p.health + "%";
        b.healthFill.style.background = p.health > 50 ? "#6FCF97" : p.health > 20 ? "var(--amber)" : "var(--danger)";
        const isDry = Date.now() - p.lastWater > DRY_MS;
        b.label.textContent = p.stage >= STAGES.length - 1 ? "Ready!" : (isDry ? "Needs water" : "Growing");
      });
      q("#gd-coins").textContent = Math.floor(state.coins);
      q("#gd-best").textContent = best;
      addBtn.disabled = state.coins < 20 || state.plants.length >= 6;
      addBtn.style.opacity = addBtn.disabled ? 0.5 : 1;
      addBtn.textContent = state.plants.length >= 6 ? "Plot full (max 6)" : "New plot (20 coins)";
    }

    addBtn.addEventListener("click", () => {
      if(state.coins < 20 || state.plants.length >= 6) return;
      Feedback.tone("swap"); Feedback.haptic("light");
      state.coins -= 20;
      state.plants.push(mkPlant());
      persist();
      render();
    });

    function persist(){
      state.lastSeen = Date.now();
      api.save(state);
    }

    // growth/decay tick
    const tick = setInterval(() => {
      const now = Date.now();
      state.plants.forEach(p => {
        const isDry = now - p.lastWater > DRY_MS;
        if(isDry){
          p.health = Math.max(0, p.health - DECAY_PER_MS * 1000);
        } else if(p.health > 60 && p.stage < STAGES.length - 1){
          p._growAccum = (p._growAccum || 0) + 1000;
          if(p._growAccum >= GROW_MS && p.stage < STAGES.length - 1){
            p.stage++;
            p._growAccum = 0;
          }
        }
      });
      render();
    }, 1000);

    const autosave = setInterval(persist, 8000);

    render();

    return () => {
      clearInterval(tick);
      clearInterval(autosave);
      persist();
    };
  }
});
