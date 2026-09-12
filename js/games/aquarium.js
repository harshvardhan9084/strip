Strip.register({
  id: "aquarium",
  label: "COLONY",
  title: "Tiny Aquarium",
  tag: "idle",
  hint: "Tap to feed · tap a fish twice to release it",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);

    // Round 19 (AUDIT.md — Aquarium P1): food went into a capped tank with no
    // economy, and at 8 fish the card just stopped reacting (S8). Now fish
    // have SPECIES with rarity + value: growing a fish pays its value once,
    // the ALBUM tracks species grown (collection compulsion), rare species
    // unlock as your best-fish record climbs, releasing a fish makes room
    // (the terminal-8 escape), and coins buy food packs + permanent decor.
    const SPECIES = [
      { key: "guppy",    name: "Guppy",     hue: [180, 220], value: 6,  w: 30,  min: 0 },
      { key: "tetra",    name: "Tetra",     hue: [300, 340], value: 8,  w: 25,  min: 0 },
      { key: "platy",    name: "Platy",     hue: [20, 50],   value: 10, w: 20,  min: 0 },
      { key: "angel",    name: "Angelfish", hue: [260, 290], value: 14, w: 12,  min: 2 },
      { key: "clown",    name: "Clownfish", hue: [10, 25],   value: 18, w: 8,   min: 3 },
      { key: "betta",    name: "Betta",     hue: [330, 355], value: 25, w: 5,   min: 4 },
      { key: "koi",      name: "Koi",       hue: [40, 60],   value: 40, w: 3,   min: 5 },
      { key: "arowana",  name: "Arowana",   hue: [80, 110],  value: 70, w: 1.5, min: 6 },
    ];
    const SP = Object.fromEntries(SPECIES.map(s => [s.key, s]));
    const MAX_FISH = 8;

    function pickSpecies(){
      const pool = SPECIES.filter(s => best >= s.min);
      const total = pool.reduce((sum, s) => sum + s.w, 0);
      let roll = Math.random() * total;
      for(const s of pool){ roll -= s.w; if(roll <= 0) return s.key; }
      return "guppy";
    }

    function mkFish(forced){
      const key = forced || pickSpecies();
      const sp = SP[key];
      return {
        species: key,
        size: 0.6, paid: false,
        hue: sp.hue[0] + Math.floor(Math.random() * (sp.hue[1] - sp.hue[0])),
        x: Math.random()*80+10, y: Math.random()*60+20,
        dir: Math.random()<0.5?1:-1, age: 0,
      };
    }

    const DEFAULT = { fish: null, food: 5, coins: 0, album: {}, decor: [], lastSeen: Date.now() };
    const saved = await api.load();
    let best = await api.getHighscore(); // best = most fish ever raised
    const state = saved ? Object.assign({}, DEFAULT, saved, {
      album: Object.assign({}, saved.album),
      decor: Array.isArray(saved.decor) ? saved.decor : [],
    }) : DEFAULT;
    if(!Array.isArray(state.fish) || !state.fish.length){
      state.fish = [mkFish(Math.random() < 0.5 ? "guppy" : "tetra")];
    }
    // legacy migration: fish from before species existed get one assigned now
    state.fish.forEach(f => { if(!f.species){ const nf = mkFish(); f.species = nf.species; if(f.hue === undefined) f.hue = nf.hue; if(f.paid === undefined) f.paid = false; } });
    if(!Number.isFinite(state.coins)) state.coins = 0;

    // offline growth: fish age a bit, capped; offline-grown fish pay on return
    const elapsedSec = Math.min(3600*6, Math.max(0, (Date.now() - state.lastSeen)/1000));
    state.fish.forEach(f => {
      f.age += elapsedSec;
      if(f.size < 1.4){
        f.size = Math.min(1.4, f.size + elapsedSec*0.00006);
      }
    });

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:14px; font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const tank = document.createElement("div");
    tank.style.cssText = `
      position:relative; width:min(78vw,280px); height:min(45vh,220px);
      background:linear-gradient(to bottom, #16303a, #0c1a20);
      border-radius:14px; border:2px solid #234; overflow:hidden; cursor:pointer;
    `;
    wrap.appendChild(tank);

    const feedHint = document.createElement("div");
    feedHint.style.cssText = "font-size:11px; color:var(--ink-dim); min-height:15px; text-align:center;";
    wrap.appendChild(feedHint);

    const shopRow = document.createElement("div");
    shopRow.style.cssText = "display:flex; gap:6px; flex-wrap:wrap; justify-content:center;";
    wrap.appendChild(shopRow);

    const foodBtn = document.createElement("button");
    foodBtn.className = "btn";
    foodBtn.style.fontSize = "10px";
    shopRow.appendChild(foodBtn);

    const DECOR = [
      { key: "plant",   emoji: "🌿", name: "Plant",   cost: 50 },
      { key: "castle",  emoji: "🏰", name: "Castle",  cost: 150 },
      { key: "gems",    emoji: "💎", name: "Gems",    cost: 400 },
    ];
    DECOR.forEach(d => {
      const b = document.createElement("button");
      b.className = "btn";
      b.style.fontSize = "10px";
      b._decor = d;
      shopRow.appendChild(b);
      d._btn = b;
    });

    container.appendChild(wrap);

    function albumCount(){ return Object.keys(state.album).length; }

    function renderStats(){
      statRow.innerHTML = `<div>FISH <span style="color:var(--amber)">${state.fish.length}/${MAX_FISH}</span></div><div>FOOD <span style="color:var(--purple)">${state.food}</span></div><div>COINS <span style="color:var(--amber)">${Math.floor(state.coins)}</span></div><div>ALBUM <span style="color:var(--ink)">${albumCount()}/${SPECIES.length}</span></div><div>BEST <span style="color:var(--ink)">${best}</span></div>`;
      foodBtn.textContent = "Food +10 (15c)";
      foodBtn.disabled = state.coins < 15;
      foodBtn.style.opacity = foodBtn.disabled ? 0.5 : 1;
      DECOR.forEach(d => {
        const owned = state.decor.includes(d.key);
        d._btn.textContent = owned ? `${d.emoji} ${d.name} ✓` : `${d.emoji} ${d.cost}c`;
        d._btn.disabled = owned || state.coins < d.cost;
        d._btn.style.opacity = d._btn.disabled ? 0.5 : 1;
      });
    }

    function renderDecor(){
      tank.querySelectorAll(".aq-decor").forEach(el => el.remove());
      state.decor.forEach((key, i) => {
        const d = DECOR.find(x => x.key === key);
        if(!d) return;
        const el = document.createElement("div");
        el.className = "aq-decor";
        el.textContent = d.emoji;
        el.style.cssText = `position:absolute; bottom:2px; left:${10 + i * 28}%; font-size:${d.key === "castle" ? 26 : 20}px; opacity:.9; pointer-events:none; z-index:0;`;
        tank.appendChild(el);
      });
    }

    let armedFish = null; // two-tap release arming

    function renderFish(){
      tank.querySelectorAll(".fish").forEach(el => el.remove());
      state.fish.forEach((f, i) => {
        const el = document.createElement("div");
        el.className = "fish";
        const sp = SP[f.species] || SP.guppy;
        el.title = sp.name;
        el.style.cssText = `
          position:absolute; left:${f.x}%; top:${f.y}%;
          width:${18*f.size}px; height:${10*f.size}px;
          background:hsl(${f.hue},70%,60%);
          border-radius:50% 50% 50% 10%;
          transform:scaleX(${f.dir});
          transition:left 3s linear, top 3s linear;
          z-index:2; cursor:pointer;
          ${armedFish === f ? "outline:2px solid #FFB347; outline-offset:2px;" : ""}
        `;
        el.addEventListener("click", (e) => {
          e.stopPropagation(); // a fish tap is NOT a feed
          if(armedFish === f){
            // release: makes room, pays the fish's current worth, album keeps
            // the species (collection progress is never lost by releasing)
            const worth = Math.max(2, Math.round(sp.value * (f.size / 1.4) * 0.8));
            state.coins += worth;
            state.fish = state.fish.filter(o => o !== f);
            armedFish = null;
            Feedback.tone("thud"); Feedback.haptic("medium");
            floatText(`released +${worth}c`, "#EDEAE3");
            persist(); renderFish(); renderDecor(); renderStats();
          } else {
            armedFish = f;
            feedHint.textContent = `${sp.name} — tap again to release (+coins), tap elsewhere to cancel`;
            renderFish();
            setTimeout(() => {
              if(armedFish === f){ armedFish = null; if(el.isConnected){ renderFish(); } }
            }, 2500);
          }
        });
        tank.appendChild(el);
      });
    }

    function floatText(text, color){
      const out = document.createElement("div");
      out.textContent = text;
      out.style.cssText = `position:absolute; left:50%; top:12px; transform:translateX(-50%); font-size:11px; color:${color}; pointer-events:none; animation:aq-float .8s ease forwards; z-index:5; text-shadow:0 1px 3px rgba(0,0,0,.5);`;
      tank.appendChild(out);
      setTimeout(() => out.remove(), 850);
    }

    // grown fish pay their value once — the moment a species "completes"
    function checkGrown(){
      state.fish.forEach(f => {
        if(!f.paid && f.size >= 1.4){
          f.paid = true;
          const sp = SP[f.species] || SP.guppy;
          state.coins += sp.value;
          state.album[f.species] = (state.album[f.species] || 0) + 1;
          floatText(`${sp.name} grown! +${sp.value}c`, "#6FCF97");
          Feedback.tone("success");
        }
      });
    }
    checkGrown();

    function renderTank(){
      renderDecor();
      renderFish();
      renderStats();
      feedHint.textContent = state.food > 0
        ? (armedFish ? `${(SP[armedFish.species]||SP.guppy).name} — tap again to release` : "Tap the tank to feed · tap a fish twice to release it")
        : "Out of food — buy a pack below or wait for more";
    }
    renderTank();

    function swim(){
      state.fish.forEach(f => {
        f.x = Math.max(5, Math.min(85, f.x + f.dir * (10 + Math.random()*15)));
        f.y = Math.max(10, Math.min(80, f.y + (Math.random()-0.5)*20));
        if(f.x <= 5 || f.x >= 85) f.dir *= -1;
      });
      renderFish();
    }
    const swimInterval = setInterval(swim, 3000);

    // slow food regen: 1 food every 20s, capped at 10
    const regenInterval = setInterval(() => {
      if(state.food < 10){
        state.food++;
        renderStats();
        if(state.food > 0 && !armedFish) feedHint.textContent = "Tap the tank to feed · tap a fish twice to release it";
      }
    }, 20000);

    tank.addEventListener("click", () => {
      if(state.food <= 0){
        floatText("no food left", "var(--danger)");
        Feedback.haptic("light");
        return;
      }
      Feedback.tone("pop"); Feedback.haptic("light");
      state.food--;
      if(state.food === 0) feedHint.textContent = "Out of food — buy a pack below or wait for more";

      // feeding grows a random fish; grown fish pay once; the 12% spawn rolls
      // even at a full tank — there it sells as fry coins instead (the S8
      // escape: feeding ALWAYS does something now)
      const target = state.fish[Math.floor(Math.random()*state.fish.length)];
      target.size = Math.min(1.6, target.size + 0.08);
      checkGrown();

      if(Math.random() < 0.12){
        if(state.fish.length < MAX_FISH){
          state.fish.push(mkFish());
          Feedback.tone("success");
          floatText("a fry appeared!", "#FFB347");
          if(state.fish.length > best){
            best = state.fish.length;
            api.setHighscore(best);
          }
        } else {
          state.coins += 4;
          floatText("tank full — fry sold +4c", "#FFB347");
        }
      }
      persist();
      renderTank();
    });

    foodBtn.addEventListener("click", () => {
      if(state.coins < 15) return;
      state.coins -= 15;
      state.food = Math.min(10, state.food + 10);
      Feedback.tone("place"); Feedback.haptic("light");
      persist(); renderTank();
    });
    DECOR.forEach(d => {
      d._btn.addEventListener("click", () => {
        if(state.decor.includes(d.key) || state.coins < d.cost) return;
        state.coins -= d.cost;
        state.decor.push(d.key);
        Feedback.buzz("success");
        floatText(`${d.emoji} ${d.name} installed!`, "#6FCF97");
        persist(); renderTank();
      });
    });

    // own keyframes — never borrow another cartridge's <style> node
    if(!document.getElementById("aq-keyframes")){
      const style = document.createElement("style");
      style.id = "aq-keyframes";
      style.textContent = `@keyframes aq-float{ from{opacity:1; transform:translate(-50%,0);} to{opacity:0; transform:translate(-50%,-22px);} }`;
      document.head.appendChild(style);
    }

    function persist(){
      state.lastSeen = Date.now();
      api.save(state);
    }
    const autosave = setInterval(persist, 8000);

    return () => {
      clearInterval(swimInterval);
      clearInterval(regenInterval);
      clearInterval(autosave);
      persist();
    };
  }
});
