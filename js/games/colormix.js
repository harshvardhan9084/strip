Strip.register({
  id: "colormix",
  label: "TOY",
  title: "Color Lab",
  tag: "🎨",
  hint: "Drag sliders, match the target color",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    const state = (await api.load()) || { matched: 0 };
    let tweakCount = 0; // resets each new target — the per-match skill metric
    let best = await api.getHighscore();

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px; width:100%; max-width:280px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>MATCHED <span id="cm-score" style="color:var(--amber)">${state.matched}</span></div><div>BEST <span id="cm-best" style="color:var(--purple)">${best ? (9999 - best) + " tweaks" : "-"}</span></div>`;
    wrap.appendChild(statRow);

    const swatches = document.createElement("div");
    swatches.style.cssText = "display:flex; gap:16px; align-items:center;";
    const targetSwatch = document.createElement("div");
    const mixSwatch = document.createElement("div");
    [targetSwatch, mixSwatch].forEach(s => {
      s.style.cssText = "width:80px; height:80px; border-radius:14px; border:2px solid var(--line);";
    });
    const arrow = document.createElement("div");
    arrow.textContent = "→";
    arrow.style.cssText = "font-size:20px; color:var(--ink-dim);";
    swatches.appendChild(targetSwatch);
    swatches.appendChild(arrow);
    swatches.appendChild(mixSwatch);
    wrap.appendChild(swatches);

    const sliders = document.createElement("div");
    sliders.style.cssText = "display:flex; flex-direction:column; gap:10px; width:100%;";
    wrap.appendChild(sliders);

    const matchNote = document.createElement("div");
    matchNote.style.cssText = "font-size:12px; color:var(--ink-dim); min-height:16px;";
    wrap.appendChild(matchNote);

    const skipBtn = document.createElement("button");
    skipBtn.className = "btn purple";
    skipBtn.textContent = "New target";
    wrap.appendChild(skipBtn);

    container.appendChild(wrap);

    let target, rgb;

    function randColor(){
      return [Math.floor(Math.random()*256), Math.floor(Math.random()*256), Math.floor(Math.random()*256)];
    }

    function newTarget(){
      target = randColor();
      rgb = [128,128,128];
      tweakCount = 0; // fresh target, fresh tweak budget
      targetSwatch.style.background = `rgb(${target.join(",")})`;
      updateMix();
      matchNote.textContent = "";
    }

    function updateMix(){
      mixSwatch.style.background = `rgb(${rgb.join(",")})`;
    }

    ["R","G","B"].forEach((label, i) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex; align-items:center; gap:8px;";
      const tag = document.createElement("span");
      tag.textContent = label;
      tag.style.cssText = `font-family:var(--font-display); font-size:10px; width:14px; color:${["#E8637F","#6FCF97","#56B4E9"][i]};`;
      const slider = document.createElement("input");
      slider.type = "range"; slider.min = 0; slider.max = 255; slider.value = 128;
      slider.style.cssText = "flex:1; accent-color: " + ["#E8637F","#6FCF97","#56B4E9"][i] + ";";
      slider.addEventListener("input", () => {
        rgb[i] = +slider.value;
        tweakCount++; // every nudge counts toward the fewest-tweaks record
        updateMix();
        checkMatch();
      });
      row.appendChild(tag);
      row.appendChild(slider);
      sliders.appendChild(row);
    });

    function dist(){
      return Math.sqrt(rgb.reduce((sum,v,i) => sum + (v-target[i])**2, 0));
    }

    function checkMatch(){
      const d = dist();
      if(d < 22){
        matchNote.textContent = "Matched!";
        matchNote.style.color = "var(--amber)";
        Feedback.buzz("success");
        state.matched++;
        q("#cm-score").textContent = state.matched;
        api.save(state);
        // Round 19 (S7 fix): BEST used to be the lifetime counter mirrored
        // back at you (always equal to MATCHED). Now it's a real skill record:
        // fewest slider tweaks per match, stored inverted for the max-wins store
        const record = Math.max(1, 9999 - tweakCount);
        api.setHighscore(record).then(v => {
          best = v;
          q("#cm-best").textContent = (9999 - best) + " tweaks";
        });
        setTimeout(newTarget, 600);
      } else if(d < 60){
        matchNote.textContent = "Getting close…";
        matchNote.style.color = "var(--ink-dim)";
      } else {
        matchNote.textContent = "";
      }
    }

    skipBtn.addEventListener("click", newTarget);
    newTarget();
  }
});
