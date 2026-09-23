Strip.register({
  id: "colormix",
  // GAMES.md audit (R34 pre-task): BEST here is stored inverted (9999 -
  // tweaks, fewest-tweaks-per-match, the R19 S7 fix) but was never DECLARED
  // — the R14 tripwire regex only matches setHighscore(CEILING - x) inline,
  // and the Math.max(1, ...) wrapper hid the arithmetic. Undeclared meant
  // the Daily ×2 twist would double the encoded record if colormix ever
  // became the pick (decodes to negative tweaks). Zero behavior change on
  // any normal run; closes the corruption path like reaction.js's fix.
  scoreEncoding: "inverted", scoreCeiling: 9999,
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
    // sanitize what loaded (house rule 10): a junk matched used to render as
    // "undefined" and then NaN once incremented
    state.matched = Number.isFinite(state.matched) ? state.matched : 0;
    let tweakCount = 0; // resets each new target — the per-match skill metric
    let solved = false; // one win per target — slider input keeps firing after a match
    let best = await api.getHighscore();

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px; width:100%; max-width:280px;";

    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between
    // title and playfield, one type scale, tabular nums, <=4 stats. The old
    // header's span ids live on as value keys so update sites stay one-liners.
    const statVals = {
      "cm-score": String(state.matched),
      "cm-best": String(best ? (9999 - best) + " tweaks" : "-"),
    };
    const STAT_KEYS = [
      ["cm-score", "MATCHED", "var(--amber)", null],
      ["cm-best", "BEST", "var(--purple)", null],
    ];
    function renderStats(){
      api.setStats(STAT_KEYS.map(([k, label, color, fixed]) => ({
        label,
        value: k ? statVals[k] : fixed,
        color,
      })));
    }
    renderStats();

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
      sliderEls.forEach(s => s.value = 128); // thumbs follow the reset mix — they used to keep the old target's positions while the swatch snapped to grey
      tweakCount = 0; // fresh target, fresh tweak budget
      solved = false; // fresh target, fresh win
      targetSwatch.style.background = `rgb(${target.join(",")})`;
      updateMix();
      matchNote.textContent = "";
    }

    function updateMix(){
      mixSwatch.style.background = `rgb(${rgb.join(",")})`;
    }

    const sliderEls = [];
    ["R","G","B"].forEach((label, i) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex; align-items:center; gap:8px;";
      const SEM = ["var(--danger, #E8637F)", "var(--good, #6FCF97)", "var(--info, #56B4E9)"]; // R25: semantic vars keep R/G/B labels legible on the paper chassis
      const tag = document.createElement("span");
      tag.textContent = label;
      tag.style.cssText = `font-family:var(--font-display); font-size:10px; width:14px; color:${SEM[i]};`;
      const slider = document.createElement("input");
      slider.type = "range"; slider.min = 0; slider.max = 255; slider.value = 128;
      slider.style.cssText = "flex:1; accent-color: " + SEM[i] + ";";
      slider.addEventListener("input", () => {
        rgb[i] = +slider.value;
        tweakCount++; // every nudge counts toward the fewest-tweaks record
        updateMix();
        checkMatch();
      });
      row.appendChild(tag);
      row.appendChild(slider);
      sliders.appendChild(row);
      sliderEls.push(slider);
    });

    function dist(){
      return Math.sqrt(rgb.reduce((sum,v,i) => sum + (v-target[i])**2, 0));
    }

    function checkMatch(){
      if(solved) return; // the win already paid — a drag inside the threshold fires input per pixel
      const d = dist();
      if(d < 22){
        solved = true;
        matchNote.textContent = "Matched!";
        matchNote.style.color = "var(--amber)";
        Feedback.buzz("success");
        state.matched++;
        statVals["cm-score"] = state.matched; renderStats();
        api.gameover("win", tweakCount);
        api.save(state);
        // Round 19 (S7 fix): BEST used to be the lifetime counter mirrored
        // back at you (always equal to MATCHED). Now it's a real skill record:
        // fewest slider tweaks per match, stored inverted for the max-wins store
        const record = Math.max(1, 9999 - tweakCount);
        api.setHighscore(record).then(v => {
          best = v;
          statVals["cm-best"] = (9999 - best) + " tweaks"; renderStats();
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
