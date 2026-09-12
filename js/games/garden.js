/**
 * Garden — idle sim with a decay mechanic (differentiates it from Ant Colony,
 * which has no downside to neglect). Plants need periodic watering; if you
 * ignore the garden too long, health drops and growth slows.
 *
 * Round 19 (AUDIT.md — Garden P1): the coin sink used to exhaust at 6 plots
 * (120g total) and harvests accumulated forever with nothing to buy — the
 * exact S1 disease as Trading Post, and a 0-health plant just sat there, so
 * neglect had no teeth. Repairs:
 *   1. SEED SHOP — 9 species with real tradeoffs (grow time vs yield vs
 *      price), the expensive ones gated by price alone. Buying a seed is a
 *      decision; the species album (harvest counts) is the collection hook.
 *   2. PLANT DEATH + COMPOST — a plant that dries to 0 health dies (🥀).
 *      Composting clears the plot for a token +3 rebate. Loss is honest now.
 *   3. SPRINKLER LADDER — two auto-water tiers as the deep coin sink
 *      (300g / 1200g), so coins always have a "next".
 */
Strip.register({
  id: "garden",
  label: "COLONY",
  title: "Garden",
  tag: "sim",
  hint: "Tap a plot: plant, water, harvest · dead plants compost",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);

    // the seed shop — price gates the ladder, grow-time is the cost of yield
    const SPECIES = [
      { key: "daisy",     emoji: "🌼", name: "Daisy",     growMs: 20000,  yield: 15,  cost: 0,    decay: 1 },
      { key: "mushroom",  emoji: "🍄", name: "Mushroom",  growMs: 15000,  yield: 14,  cost: 8,    decay: 1.2 },
      { key: "tulip",     emoji: "🌷", name: "Tulip",     growMs: 35000,  yield: 32,  cost: 25,   decay: 1 },
      { key: "rose",      emoji: "🌹", name: "Rose",      growMs: 55000,  yield: 60,  cost: 60,   decay: 1 },
      { key: "sunflower", emoji: "🌻", name: "Sunflower", growMs: 80000,  yield: 100, cost: 120,  decay: 1 },
      { key: "orchid",    emoji: "🪻", name: "Orchid",    growMs: 120000, yield: 180, cost: 250,  decay: 1.3 },
      { key: "cactus",    emoji: "🌵", name: "Cactus",    growMs: 180000, yield: 280, cost: 420,  decay: 0.2 },
      { key: "bonsai",    emoji: "🎋", name: "Bonsai",    growMs: 240000, yield: 420, cost: 700,  decay: 0.8 },
      { key: "lotus",     emoji: "🪷", name: "Lotus",     growMs: 300000, yield: 650, cost: 1100, decay: 1 },
    ];
    const SP = Object.fromEntries(SPECIES.map(s => [s.key, s]));

    function mkPlant(species){
      return { species: species || "daisy", stage: 0, health: 100, lastWater: Date.now(), dead: false };
    }
    const DEFAULT = { plants: [mkPlant(), mkPlant(), mkPlant()], coins: 0, album: {}, sprinkler: 0, lastSprinkle: 0, lastSeen: Date.now() };
    const saved = await api.load();
    const state = saved ? Object.assign({}, DEFAULT, saved, {
      album: Object.assign({}, saved.album),
    }) : DEFAULT;
    // never share the DEFAULT template's plant array by reference (a saved
    // state missing `plants` would otherwise mutate the template)
    if(!Array.isArray(state.plants) || !state.plants.length){
      state.plants = [mkPlant(), mkPlant(), mkPlant()];
    }
    // legacy migration: plants from before the seed shop are daisies
    state.plants.forEach(p => { if(!p.species) p.species = "daisy"; if(p.dead === undefined) p.dead = false; });
    if(!Number.isFinite(state.sprinkler)) state.sprinkler = 0;

    let best = await api.getHighscore(); // best = total harvests ever

    const STAGES = ["🌱","🌿","🪴","🌸"];
    const DRY_MS = 45 * 1000;        // needs water again after this long
    const DECAY_PER_MS = 0.00025;    // health lost per ms once dry (×species.decay)
    const GROW_MS = 20000;           // base; species growMs replaces it
    const SPRINKLERS = [
      { cost: 300,  everyMs: 40000 }, // plants dip, almost never die
      { cost: 1200, everyMs: 20000 }, // never dry, never die
    ];

    // catch up offline: once past DRY_MS, health decays for the excess offline time
    const elapsedMs = Math.min(1000*60*60*8, Math.max(0, Date.now() - state.lastSeen));
    state.plants.forEach(p => {
      const overDry = Math.max(0, elapsedMs - DRY_MS);
      const decay = SP[p.species] ? SP[p.species].decay : 1;
      p.health = Math.max(0, p.health - overDry * DECAY_PER_MS * decay);
      if(p.health <= 0) p.dead = true;
    });

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:12px; width:100%; max-width:300px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:16px; font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>COINS <span id="gd-coins" style="color:var(--amber)">${Math.floor(state.coins)}</span></div><div>HARVESTS <span id="gd-best" style="color:var(--purple)">${best}</span></div><div>ALBUM <span id="gd-album" style="color:var(--ink)">${Object.keys(state.album).length}/${SPECIES.length}</span></div>`;
    wrap.appendChild(statRow);

    const plotRow = document.createElement("div");
    plotRow.style.cssText = "display:flex; gap:10px; flex-wrap:wrap; justify-content:center;";
    wrap.appendChild(plotRow);

    const note = document.createElement("div");
    note.style.cssText = "font-size:11px; color:var(--ink-dim); min-height:16px; text-align:center;";
    wrap.appendChild(note);

    const addBtn = document.createElement("button");
    addBtn.className = "btn purple";
    wrap.appendChild(addBtn);

    const sprinklerBtn = document.createElement("button");
    sprinklerBtn.className = "btn";
    wrap.appendChild(sprinklerBtn);

    // seed picker overlay — the collection compulsion lives here
    const picker = document.createElement("div");
    picker.style.cssText = "display:none; position:fixed; inset:0; background:rgba(10,10,16,0.8); z-index:60; align-items:center; justify-content:center;";
    const pickerCard = document.createElement("div");
    pickerCard.style.cssText = "background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:14px; max-width:280px; width:88%; max-height:70vh; overflow:auto;";
    picker.appendChild(pickerCard);
    document.body.appendChild(picker);
    let pickerTarget = -1; // plot index being planted

    container.appendChild(wrap);

    function albumCount(){ return Object.keys(state.album).length; }

    function openPicker(idx){
      pickerTarget = idx;
      pickerCard.innerHTML = "";
      const t = document.createElement("div");
      t.style.cssText = "font-size:11px; color:var(--ink-dim); margin-bottom:8px; text-align:center;";
      t.textContent = "choose a seed";
      pickerCard.appendChild(t);
      SPECIES.forEach(s => {
        const b = document.createElement("button");
        b.className = "btn";
        b.style.cssText = "display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:5px; padding:7px 10px; font-size:11px;" +
          (state.coins < s.cost ? " opacity:0.45;" : "");
        const owned = state.album[s.key] ? `<span style="color:var(--purple)">×${state.album[s.key]}</span>` : "";
        b.innerHTML = `<span>${s.emoji} ${s.name} ${owned}</span><span style="color:var(--ink-dim); font-size:9px;">${s.cost ? s.cost + "g · " : ""}${Math.round(s.growMs/1000)}s → ${s.yield}g</span>`;
        b.disabled = state.coins < s.cost;
        b.addEventListener("click", () => {
          if(state.coins < s.cost) return;
          state.coins -= s.cost;
          state.plants[pickerTarget] = mkPlant(s.key);
          Feedback.tone("place"); Feedback.haptic("light");
          closePicker();
          persist(); render();
        });
        pickerCard.appendChild(b);
      });
      const close = document.createElement("button");
      close.className = "btn";
      close.textContent = "Close";
      close.style.cssText = "width:100%; margin-top:4px;";
      close.addEventListener("click", closePicker);
      pickerCard.appendChild(close);
      picker.style.display = "flex";
    }
    function closePicker(){ picker.style.display = "none"; pickerTarget = -1; }

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
        if(p.dead){
          // compost: the loss is honest, the rebate is a token
          state.plants[idx] = null;
          state.coins += 3;
          Feedback.tone("thud"); Feedback.haptic("medium");
          note.textContent = "Composted (+3 coins) — replant something";
        } else if(!p.species){
          openPicker(idx);
          return;
        } else if(p.stage >= STAGES.length - 1){
          // harvest — yield now depends on the species you chose
          const sp = SP[p.species] || SP.daisy;
          Feedback.buzz("success");
          state.coins += sp.yield;
          state.plants[idx] = null;
          state.album[sp.key] = (state.album[sp.key] || 0) + 1;
          best++;
          api.setHighscore(best);
          note.textContent = `Harvested ${sp.emoji} +${sp.yield} coins`;
        } else {
          Feedback.tone("tap"); Feedback.haptic("light");
          p.lastWater = Date.now();
          p.health = Math.min(100, p.health + 20);
          note.textContent = "Watered";
        }
        clearTimeout(note._t);
        note._t = setTimeout(() => note.textContent = "", 1800);
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
        if(!b) return;
        if(!p){
          b.emoji.textContent = "➕";
          b.emoji.style.opacity = 0.4;
          b.healthFill.style.width = "0%";
          b.label.textContent = "empty · tap";
          return;
        }
        if(p.dead){
          b.emoji.textContent = "🥀";
          b.emoji.style.opacity = 1;
          b.healthFill.style.width = "0%";
          b.label.textContent = "dead · compost";
          return;
        }
        const sp = SP[p.species] || SP.daisy;
        const isDry = Date.now() - p.lastWater > DRY_MS;
        // the stage emoji stays generic while growing; the species shows at bloom
        b.emoji.textContent = p.stage >= STAGES.length - 1 ? sp.emoji : STAGES[p.stage];
        b.emoji.style.opacity = 1;
        b.healthFill.style.width = p.health + "%";
        b.healthFill.style.background = p.health > 50 ? "#6FCF97" : p.health > 20 ? "var(--amber)" : "var(--danger)";
        b.label.textContent = p.stage >= STAGES.length - 1 ? "Ready!" : (isDry ? "Needs water" : "Growing");
      });
      q("#gd-coins").textContent = Math.floor(state.coins);
      q("#gd-best").textContent = best;
      q("#gd-album").textContent = albumCount() + "/" + SPECIES.length;
      const canAdd = state.coins >= 20 && state.plants.length < 6;
      addBtn.disabled = !canAdd;
      addBtn.style.opacity = canAdd ? 1 : 0.5;
      addBtn.textContent = state.plants.length >= 6 ? "Plot full (max 6)" : "New plot (20 coins)";
      if(state.sprinkler < SPRINKLERS.length){
        const s = SPRINKLERS[state.sprinkler];
        sprinklerBtn.textContent = `Sprinkler ${state.sprinkler + 1} (${s.cost}g) — waters every ${Math.round(s.everyMs/1000)}s`;
        sprinklerBtn.disabled = state.coins < s.cost;
      } else {
        sprinklerBtn.textContent = "Sprinklers MAX — garden waters itself";
        sprinklerBtn.disabled = true;
      }
      sprinklerBtn.style.opacity = sprinklerBtn.disabled ? 0.5 : 1;
    }

    addBtn.addEventListener("click", () => {
      if(state.coins < 20 || state.plants.length >= 6) return;
      Feedback.tone("swap"); Feedback.haptic("light");
      state.coins -= 20;
      state.plants.push(null); // an empty plot — the seed picker does the rest
      persist();
      render();
    });

    sprinklerBtn.addEventListener("click", () => {
      if(state.sprinkler >= SPRINKLERS.length) return;
      const s = SPRINKLERS[state.sprinkler];
      if(state.coins < s.cost) return;
      state.coins -= s.cost;
      state.sprinkler++;
      state.lastSprinkle = Date.now();
      Feedback.buzz("success");
      note.textContent = "Sprinkler installed!";
      clearTimeout(note._t);
      note._t = setTimeout(() => note.textContent = "", 1800);
      persist(); render();
    });

    function persist(){
      state.lastSeen = Date.now();
      api.save(state);
    }

    // growth/decay tick + sprinkler sweep
    const tick = setInterval(() => {
      const now = Date.now();
      if(state.sprinkler > 0 && now - state.lastSprinkle >= SPRINKLERS[state.sprinkler - 1].everyMs){
        state.lastSprinkle = now;
        state.plants.forEach(p => { if(p && !p.dead) p.lastWater = now; });
      }
      state.plants.forEach(p => {
        if(!p || p.dead) return;
        const sp = SP[p.species] || SP.daisy;
        const isDry = now - p.lastWater > DRY_MS;
        if(isDry){
          p.health = Math.max(0, p.health - DECAY_PER_MS * 1000 * sp.decay);
          if(p.health <= 0){
            p.dead = true;
            Feedback.tone("lose");
            note.textContent = sp.emoji + " withered — compost it and replant";
            clearTimeout(note._t);
            note._t = setTimeout(() => note.textContent = "", 2500);
          }
        } else if(p.health > 60 && p.stage < STAGES.length - 1){
          p._growAccum = (p._growAccum || 0) + 1000;
          if(p._growAccum >= sp.growMs && p.stage < STAGES.length - 1){
            p.stage++;
            p._growAccum = 0;
            if(p.stage === STAGES.length - 1) Feedback.tone("ok");
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
      picker.remove();
    };
  }
});
