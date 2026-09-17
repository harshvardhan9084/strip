/**
 * Garden — idle sim with a decay mechanic (differentiates it from Ant Colony,
 * which has no downside to neglect). Plants need periodic watering; if you
 * ignore the garden too long, health drops and growth slows.
 *
 * Round 19 (AUDIT.md — Garden P1): seed shop, plant death + compost,
 * sprinkler ladder. Round 21 (user: "garden got glitches" + "fix economy"):
 *   GLITCHES KILLED
 *   1. NaN STATE — legacy saves could carry undefined lastSeen/lastWater/
 *      health; every comparison silently went false and the plant stuck
 *      forever with a "NaN%" health bar. All loaded numbers are sanitized
 *      to sane fallbacks now.
 *   2. SPRINKLERS DID NOTHING OFFLINE — a 300g purchase promised "the
 *      garden waters itself", yet every plant died the moment you left
 *      for 10 minutes. Sprinklers now water OFFLINE too, and kept plants
 *      GROW while you're away — coming back to a bloomed garden is the
 *      idle-genre reward, not a graveyard.
 *   3. THE HIDDEN 60-GATE — plants only grew above 60 health while the
 *      label said "Growing" at any health. Watering a 40-health plant to
 *      exactly 60 still froze it: "I watered it and nothing happened."
 *      Growth now continues whenever the soil is wet; the label is honest.
 *   4. TWO-TAP REPLANT — harvesting left a bare "➕ tap" plot; the picker
 *      now opens itself (cancellable), so the loop never stalls on friction.
 *
 *   ECONOMY REPAIRED (coins always have a "next" again — the old sinks
 *   capped at ~4k coins, and Lotus players swam in dead money):
 *   - PLOT LADDER to 8 (plot 7 = 150g, plot 8 = 600g)
 *   - GOLDEN WATERING CAN 2500g — one-tap water-everything (the late-game
 *     8-plot watering chore was the real tax on the fun)
 *   - GREENHOUSE LADDER 800/2000/5000g — +10% growth speed each, the
 *     permanent multiplier sink every idle game is built on
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

    // the seed shop — price gates the ladder; grow-time is the tax and the
    // PROFIT RATE climbs with tier (net/min: 45 → 51 → 65 → 90 → 115 → 143
    // → 175 → 240), so every species is strictly worth buying once you can
    // afford it. (Round 19 judge pass: the first cut had 6/9 species
    // net-negative — the sink operated against the player.)
    const SPECIES = [
      { key: "daisy",     emoji: "🌼", name: "Daisy",     growMs: 20000,  yield: 15,   cost: 0,    decay: 1 },
      { key: "mushroom",  emoji: "🍄", name: "Mushroom",  growMs: 15000,  yield: 20,   cost: 8,    decay: 1.2 },
      { key: "tulip",     emoji: "🌷", name: "Tulip",     growMs: 35000,  yield: 55,   cost: 25,   decay: 1 },
      { key: "rose",      emoji: "🌹", name: "Rose",      growMs: 55000,  yield: 120,  cost: 60,   decay: 1 },
      { key: "sunflower", emoji: "🌻", name: "Sunflower", growMs: 80000,  yield: 240,  cost: 120,  decay: 1 },
      { key: "orchid",    emoji: "🪻", name: "Orchid",    growMs: 120000, yield: 480,  cost: 250,   decay: 1.3 },
      { key: "cactus",    emoji: "🌵", name: "Cactus",    growMs: 180000, yield: 850,  cost: 420,   decay: 0.2 },
      { key: "bonsai",    emoji: "🎋", name: "Bonsai",    growMs: 240000, yield: 1400, cost: 700,   decay: 0.8 },
      { key: "lotus",     emoji: "🪷", name: "Lotus",     growMs: 300000, yield: 2300, cost: 1100,  decay: 1 },
    ];
    const SP = Object.fromEntries(SPECIES.map(s => [s.key, s]));

    // Round 21 economy: the sink ladder. Total buyable ≈ 13.5k coins.
    const PLOT_COSTS = [0, 0, 0, 20, 20, 20, 150, 600]; // plots 1-3 free, then the ladder
    const MAX_PLOTS = PLOT_COSTS.length;
    const GREENHOUSE = [
      { cost: 800,  speed: 1.1 },
      { cost: 2000, speed: 1.2 },
      { cost: 5000, speed: 1.3 },
    ];
    const CAN_COST = 2500;

    function mkPlant(species){
      return { species: species || "daisy", stage: 0, health: 100, lastWater: Date.now(), dead: false };
    }
    const DEFAULT = { plants: [mkPlant(), mkPlant(), mkPlant()], coins: 0, album: {}, sprinkler: 0, greenhouse: 0, can: false, lastSprinkle: 0, lastSeen: Date.now() };
    const saved = await api.load();
    const state = saved ? Object.assign({}, DEFAULT, saved, {
      album: Object.assign({}, saved.album),
    }) : DEFAULT;
    // never share the DEFAULT template's plant array by reference (a saved
    // state missing `plants` would otherwise mutate the template — and two
    // Garden cards mounted in one session would share one plant array)
    if(!Array.isArray(state.plants) || state.plants === DEFAULT.plants || !state.plants.length){
      state.plants = [mkPlant(), mkPlant(), mkPlant()];
    }
    // Round 22 — THE "GLITCHED CARTRIDGE" KILLER: empty plots are stored as
    // null (buy a plot, close the picker, scroll away → the autosave persists
    // a null entry). The old sanitize loop below then did `p.health = …` on
    // null and the mount THREW — the shell replaced the whole card with
    // "This cartridge glitched. (garden)", permanently, because every
    // remount re-threw on the same save. Normalize hostile entries first,
    // then guard the loop.
    state.plants = state.plants.map(p => (p && typeof p === "object") ? p : null);
    // legacy migration: plants from before the seed shop are daisies
    state.plants.forEach(p => { if(!p) return; if(!p.species) p.species = "daisy"; if(p.dead === undefined) p.dead = false; });

    let best = await api.getHighscore(); // best = total harvests ever

    const STAGES = ["🌱","🌿","🪴","🌸"];
    const DRY_MS = 45 * 1000;        // needs water again after this long
    const DECAY_PER_MS = 0.00025;    // health lost per ms once dry (×species.decay)
    const SPRINKLERS = [
      { cost: 300,  everyMs: 40000 }, // plants dip, almost never die
      { cost: 1200, everyMs: 20000 }, // never dry, never die
    ];

    // ---- Round 21 sanitization: NaN state killed here ----
    // Any number that isn't finite gets a sane fallback. Before this, a
    // single undefined lastSeen/lastWater (pre-shop save, imported save)
    // poisoned every derived comparison: health stayed "NaN%", decay never
    // ran, growth never ran, and the plant was permanently stuck.
    const fin = (v, fb) => Number.isFinite(v) ? v : fb;
    state.coins = Math.max(0, fin(state.coins, 0));
    state.lastSeen = fin(state.lastSeen, Date.now());
    state.sprinkler = Math.min(SPRINKLERS.length, Math.max(0, Math.floor(fin(state.sprinkler, 0))));
    state.greenhouse = Math.min(GREENHOUSE.length, Math.max(0, Math.floor(fin(state.greenhouse, 0))));
    state.can = !!state.can;
    state.plants.forEach(p => {
      if(!p) return; // a null is a REAL empty plot — never a reason to die
      p.health = Math.min(100, Math.max(0, fin(p.health, 100)));
      p.lastWater = fin(p.lastWater, Date.now());
      p.stage = Math.min(STAGES.length - 1, Math.max(0, Math.floor(fin(p.stage, 0))));
      if(typeof p.dead !== "boolean") p.dead = p.health <= 0;
      p._growAccum = fin(p._growAccum, 0);
    });

    // current greenhouse multiplier (1 + 0.1/level)
    function greenhouseSpeed(){
      return state.greenhouse > 0 ? GREENHOUSE[state.greenhouse - 1].speed : 1;
    }

    // ---- offline catch-up (Round 21 rewrite) ----
    // WITH a sprinkler: the garden watered itself while you were gone —
    // no decay, and hydrated plants kept growing. Stage-ups are applied
    // mathematically (elapsed × speed ÷ growMs), so a 5-minute absence on
    // Daisies comes home to blooms, not corpses.
    // WITHOUT one: the old teeth stay — soil dries after DRY_MS and health
    // decays for the excess offline time (neglect still has consequences).
    (function catchUpOffline(){
      const now = Date.now();
      const elapsedMs = Math.min(1000*60*60*8, Math.max(0, now - state.lastSeen));
      if(state.sprinkler > 0){
        state.plants.forEach(p => {
          if(!p || p.dead) return;
          const sp = SP[p.species] || SP.daisy;
          if(p.stage < STAGES.length - 1){
            const gained = Math.floor((elapsedMs * greenhouseSpeed()) / sp.growMs);
            p.stage = Math.min(STAGES.length - 1, p.stage + gained);
          }
          p.lastWater = now; // the sprinkler's last sweep was "just now"
        });
        state.lastSprinkle = now;
      } else {
        state.plants.forEach(p => {
          if(!p || p.dead) return;
          const overDry = Math.max(0, elapsedMs - DRY_MS);
          const decay = SP[p.species] ? SP[p.species].decay : 1;
          p.health = Math.max(0, p.health - overDry * DECAY_PER_MS * decay);
          if(p.health <= 0) p.dead = true;
        });
      }
      state.lastSeen = now;
    })();

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:12px; width:100%; max-width:300px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:16px; font-family:var(--font-display); font-size:9px; color:var(--ink-dim); flex-wrap:wrap; justify-content:center;";
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

    // Round 21 — golden watering can: the QoL luxury AND the chore killer.
    const canBtn = document.createElement("button");
    canBtn.className = "btn";
    wrap.appendChild(canBtn);

    // Round 21 — greenhouse ladder: the permanent growth-multiplier sink.
    const greenhouseBtn = document.createElement("button");
    greenhouseBtn.className = "btn";
    wrap.appendChild(greenhouseBtn);

    // seed picker overlay — the collection compulsion lives here
    const picker = document.createElement("div");
    picker.style.cssText = "display:none; position:fixed; inset:0; background:rgba(10,10,16,0.8); z-index:60; align-items:center; justify-content:center;";
    const pickerCard = document.createElement("div");
    pickerCard.style.cssText = "background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:14px; max-width:280px; width:88%; max-height:70vh; overflow:auto;";
    picker.appendChild(pickerCard);
    document.body.appendChild(picker);
    let pickerTarget = -1; // plot index being planted

    container.appendChild(wrap);

    function flashNote(msg, ms){
      note.textContent = msg;
      clearTimeout(note._t);
      note._t = setTimeout(() => note.textContent = "", ms || 1800);
    }

    // floating +N chips — every coin earned/paid is SEEN at the plot it
    // happened on (the audit's "silent counter tick" lesson, kept from R19)
    function addFloat(idx, text, color){
      const box = boxes[idx] && boxes[idx].el;
      if(!box) return;
      const f = document.createElement("div");
      f.textContent = text;
      f.style.cssText = `position:absolute; left:50%; top:6px; transform:translateX(-50%); font-weight:700; font-size:13px; color:${color}; pointer-events:none; z-index:5; animation:gdFloat .9s ease-out forwards; text-shadow:0 1px 3px rgba(0,0,0,.6);`;
      box.appendChild(f);
      setTimeout(() => f.remove(), 950);
    }
    if(!document.getElementById("gd-float-kf")){
      const st = document.createElement("style");
      st.id = "gd-float-kf";
      st.textContent = "@keyframes gdFloat{from{opacity:1; transform:translate(-50%,0)}to{opacity:0; transform:translate(-50%,-24px)}}";
      document.head.appendChild(st);
    }

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
    // Round 21: tapping the darkness closes the picker — the Close button
    // alone made every mis-tap feel like a trap
    picker.addEventListener("click", (e) => { if(e.target === picker) closePicker(); });

    // Plant boxes are created ONCE and updated in place. The old render()
    // nuked plotRow.innerHTML and rebuilt every box + listener every second —
    // a pointless GC/relayout churn on a card that just needs its bars moved.
    const boxes = [];
    function makeBox(idx){
      const box = document.createElement("div");
      box.style.cssText = `
        position:relative; width:74px; height:100px; border-radius:12px; background:var(--panel-2);
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
        api.tend(); // Round 24: a plot tap is tending (missions feed on it)
        if(p.dead){
          // compost: the loss is honest, the rebate is a token
          state.plants[idx] = null;
          state.coins += 3;
          addFloat(idx, "+3", "#EDEAE3");
          Feedback.tone("thud"); Feedback.haptic("medium");
          flashNote("Composted (+3 coins)");
          queueReplant(idx);
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
          addFloat(idx, "+" + sp.yield, "var(--amber)");
          flashNote(`Harvested ${sp.emoji} +${sp.yield} coins`);
          queueReplant(idx);
        } else {
          Feedback.tone("tap"); Feedback.haptic("light");
          p.lastWater = Date.now();
          p.health = Math.min(100, p.health + 20);
          flashNote("Watered");
        }
        persist();
        render();
      });

      plotRow.appendChild(box);
      boxes[idx] = { el: box, emoji, healthFill, label };
    }

    // Round 21 — auto-replant: after a harvest or compost the seed picker
    // opens itself (still cancellable). The old flow parked every spent
    // plot behind a second tap, and tap-friction is where compulsion dies.
    function queueReplant(idx){
      setTimeout(() => {
        if(state.plants[idx] === null && picker.style.display !== "flex") openPicker(idx);
      }, 300);
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
        b.healthFill.style.background = p.health > 50 ? "var(--good, #6FCF97)" : p.health > 20 ? "var(--amber)" : "var(--danger)";
        // Round 21: the label no longer lies. "Growing" means growing —
        // the hidden 60-health gate is gone; a thirsty-but-alive plant
        // says so, and a weak one asks for water while still progressing.
        b.label.textContent =
          p.stage >= STAGES.length - 1 ? "Ready!" :
          isDry ? "Needs water" :
          p.health < 30 ? "Weak · growing" : "Growing";
      });
      q("#gd-coins").textContent = Math.floor(state.coins);
      q("#gd-best").textContent = best;
      q("#gd-album").textContent = albumCount() + "/" + SPECIES.length;

      // Round 21 — plot ladder to 8
      const nextCost = PLOT_COSTS[state.plants.length];
      const canAdd = nextCost !== undefined && state.coins >= nextCost;
      addBtn.disabled = !canAdd;
      addBtn.style.opacity = canAdd ? 1 : 0.5;
      addBtn.textContent = nextCost === undefined ? "Plot full (max " + MAX_PLOTS + ")"
        : nextCost === 0 ? "New plot (free)" : "New plot (" + nextCost + " coins)";

      // sprinkler ladder (unchanged from R19)
      if(state.sprinkler < SPRINKLERS.length){
        const s = SPRINKLERS[state.sprinkler];
        sprinklerBtn.textContent = `Sprinkler ${state.sprinkler + 1} (${s.cost}g) — waters every ${Math.round(s.everyMs/1000)}s`;
        sprinklerBtn.disabled = state.coins < s.cost;
      } else {
        sprinklerBtn.textContent = "Sprinklers MAX — garden waters itself";
        sprinklerBtn.disabled = true;
      }
      sprinklerBtn.style.opacity = sprinklerBtn.disabled ? 0.5 : 1;

      // golden can: purchase → permanent water-all tool
      if(!state.can){
        canBtn.textContent = `Golden watering can (${CAN_COST}g) — water everything, forever`;
        canBtn.disabled = state.coins < CAN_COST;
      } else {
        canBtn.textContent = "💧 Water all";
        canBtn.disabled = false;
      }
      canBtn.style.opacity = canBtn.disabled ? 0.5 : 1;

      // greenhouse ladder: permanent growth speed
      if(state.greenhouse < GREENHOUSE.length){
        const g = GREENHOUSE[state.greenhouse];
        greenhouseBtn.textContent = `Greenhouse ${state.greenhouse + 1} (${g.cost}g) — all plants grow ${Math.round((g.speed - 1) * 100)}% faster`;
        greenhouseBtn.disabled = state.coins < g.cost;
      } else {
        greenhouseBtn.textContent = "Greenhouse MAX — ×" + GREENHOUSE[GREENHOUSE.length - 1].speed.toFixed(1) + " growth";
        greenhouseBtn.disabled = true;
      }
      greenhouseBtn.style.opacity = greenhouseBtn.disabled ? 0.5 : 1;
    }

    addBtn.addEventListener("click", () => {
      const cost = PLOT_COSTS[state.plants.length];
      if(cost === undefined || state.coins < cost || state.plants.length >= MAX_PLOTS) return;
      Feedback.tone("swap"); Feedback.haptic("light");
      state.coins -= cost;
      state.plants.push(null); // an empty plot — the seed picker does the rest
      persist();
      render();
      // the picker opens for the fresh plot — no dead "➕" limbo
      queueReplant(state.plants.length - 1);
    });

    sprinklerBtn.addEventListener("click", () => {
      if(state.sprinkler >= SPRINKLERS.length) return;
      const s = SPRINKLERS[state.sprinkler];
      if(state.coins < s.cost) return;
      state.coins -= s.cost;
      state.sprinkler++;
      state.lastSprinkle = Date.now();
      Feedback.buzz("success");
      flashNote("Sprinkler installed!");
      persist(); render();
    });

    // golden can — one purchase turns the 8-plot watering chore into a
    // single satisfying tap (the chore WAS the late-game experience)
    canBtn.addEventListener("click", () => {
      if(!state.can){
        if(state.coins < CAN_COST) return;
        state.coins -= CAN_COST;
        state.can = true;
        Feedback.buzz("success");
        flashNote("Golden watering can acquired!");
      } else {
        const now = Date.now();
        let watered = 0;
        state.plants.forEach((p, i) => {
          if(!p || p.dead) return;
          p.lastWater = now;
          p.health = Math.min(100, p.health + 20);
          addFloat(i, "💧", "var(--amber)");
          watered++;
        });
        if(watered > 0){ Feedback.tone("swap"); Feedback.haptic("light"); }
        else flashNote("Nothing needs watering");
      }
      persist(); render();
    });

    greenhouseBtn.addEventListener("click", () => {
      if(state.greenhouse >= GREENHOUSE.length) return;
      const g = GREENHOUSE[state.greenhouse];
      if(state.coins < g.cost) return;
      state.coins -= g.cost;
      state.greenhouse++;
      Feedback.buzz("success");
      flashNote("Greenhouse upgraded — ×" + greenhouseSpeed().toFixed(1) + " growth!");
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
      const speed = greenhouseSpeed();
      state.plants.forEach(p => {
        if(!p || p.dead) return;
        const sp = SP[p.species] || SP.daisy;
        const isDry = now - p.lastWater > DRY_MS;
        if(isDry){
          p.health = Math.max(0, p.health - DECAY_PER_MS * 1000 * sp.decay);
          if(p.health <= 0){
            p.dead = true;
            Feedback.tone("lose");
            flashNote(sp.emoji + " withered — compost it and replant", 2500);
          }
        } else if(p.stage < STAGES.length - 1){
          // Round 21: grows whenever the soil is wet — the old hidden
          // "health > 60" gate is gone. Greenhouse multiplies the accrual.
          p._growAccum = (p._growAccum || 0) + 1000 * speed;
          if(p._growAccum >= sp.growMs){
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
