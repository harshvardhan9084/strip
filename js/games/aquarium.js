Strip.register({
  id: "aquarium",
  label: "COLONY",
  title: "Tiny Aquarium",
  tag: "idle",
  hint: "Tap to sprinkle food, fish grow over time",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    const DEFAULT = { fish: [mkFish()], food: 5, lastSeen: Date.now() };
    const saved = await api.load();
    let best = await api.getHighscore(); // best = most fish ever raised

    function mkFish(){
      return { size: 0.6, hue: Math.floor(Math.random()*360), x: Math.random()*80+10, y: Math.random()*60+20, dir: Math.random()<0.5?1:-1, age: 0 };
    }

    const state = saved ? Object.assign({}, DEFAULT, saved) : DEFAULT;
    if(!Array.isArray(state.fish) || !state.fish.length) state.fish = [mkFish()];

    // offline growth: fish age a bit, capped
    const elapsedSec = Math.min(3600*6, Math.max(0, (Date.now() - state.lastSeen)/1000));
    state.fish.forEach(f => { f.age += elapsedSec; if(f.size < 1.4) f.size = Math.min(1.4, f.size + elapsedSec*0.00006); });

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:16px; font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>FISH <span id="aq-fish" style="color:var(--amber)">${state.fish.length}</span></div><div>FOOD <span id="aq-food" style="color:var(--purple)">${state.food}</span></div><div>BEST <span id="aq-best" style="color:var(--ink)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const tank = document.createElement("div");
    tank.style.cssText = `
      position:relative; width:min(78vw,280px); height:min(45vh,220px);
      background:linear-gradient(to bottom, #16303a, #0c1a20);
      border-radius:14px; border:2px solid #234; overflow:hidden; cursor:pointer;
    `;
    wrap.appendChild(tank);

    const feedHint = document.createElement("div");
    feedHint.style.cssText = "font-size:11px; color:var(--ink-dim);";
    feedHint.textContent = state.food > 0 ? "Tap the tank to feed" : "Out of food — wait for more or check back later";
    wrap.appendChild(feedHint);

    container.appendChild(wrap);

    function renderFish(){
      tank.querySelectorAll(".fish").forEach(el => el.remove());
      state.fish.forEach((f, i) => {
        const el = document.createElement("div");
        el.className = "fish";
        el.style.cssText = `
          position:absolute; left:${f.x}%; top:${f.y}%;
          width:${18*f.size}px; height:${10*f.size}px;
          background:hsl(${f.hue},70%,60%);
          border-radius:50% 50% 50% 10%;
          transform:scaleX(${f.dir});
          transition:left 3s linear, top 3s linear;
        `;
        tank.appendChild(el);
      });
    }
    renderFish();

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
        q("#aq-food").textContent = state.food;
        feedHint.textContent = "Tap the tank to feed";
      }
    }, 20000);

    tank.addEventListener("click", (e) => {
      if(state.food <= 0){
        // dead-tap honesty: say why nothing happened instead of staying silent
        const out = document.createElement("div");
        out.textContent = "no food left";
        out.style.cssText = "position:absolute; left:50%; top:12px; transform:translateX(-50%); font-size:11px; color:var(--danger); pointer-events:none; animation:aq-float .8s ease forwards;";
        tank.appendChild(out);
        setTimeout(() => out.remove(), 850);
        Feedback.haptic("light");
        return;
      }
      Feedback.tone("pop"); Feedback.haptic("light");
      state.food--;
      q("#aq-food").textContent = state.food;
      if(state.food === 0) feedHint.textContent = "Out of food — wait for more or check back later";

      // feeding grows a random fish, and has a small chance to spawn a new one
      const target = state.fish[Math.floor(Math.random()*state.fish.length)];
      target.size = Math.min(1.6, target.size + 0.08);

      if(Math.random() < 0.12 && state.fish.length < 8){
        state.fish.push(mkFish());
        Feedback.tone("success");
        q("#aq-fish").textContent = state.fish.length;
        if(state.fish.length > best){
          best = state.fish.length;
          api.setHighscore(best);
          q("#aq-best").textContent = best;
        }
      }
      renderFish();
      persist();
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

    q("#aq-fish").textContent = state.fish.length;
    q("#aq-best").textContent = best;

    return () => {
      clearInterval(swimInterval);
      clearInterval(regenInterval);
      clearInterval(autosave);
      persist();
    };
  }
});
