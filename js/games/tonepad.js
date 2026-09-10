Strip.register({
  id: "tonepad",
  label: "TOY",
  title: "Tone Pad",
  tag: "🔊",
  hint: "Tap the pads to play notes",
  mount(container, api){
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px; width:100%;";

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid; grid-template-columns:repeat(4,1fr); gap:8px; width:min(78vw,260px);";
    wrap.appendChild(grid);

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:10px; color:var(--ink-dim);";
    hint.textContent = "";
    wrap.appendChild(hint);

    container.appendChild(wrap);

    // pentatonic scale across 2 octaves — sounds pleasant in any combination
    const NOTES = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3,
                   784.0, 880.0, 1046.5, 1174.7];
    const COLORS = ["#FFB347","#8B7FE8","#E8637F","#6FCF97"];

    function playTone(freq, padEl){
      // route through the shared Feedback layer: one AudioContext app-wide,
      // and the Settings.sound toggle is respected (the old version created its
      // own AudioContext and played even with sound off)
      Feedback.tone(freq, 0.9);

      padEl.style.transform = "scale(0.93)";
      padEl.style.filter = "brightness(1.4)";
      setTimeout(() => { padEl.style.transform = "scale(1)"; padEl.style.filter = "none"; }, 150);
    }

    NOTES.forEach((freq, i) => {
      const pad = document.createElement("button");
      pad.style.cssText = `
        aspect-ratio:1; border-radius:12px; border:none; cursor:pointer;
        background:${COLORS[i % COLORS.length]}; opacity:${0.55 + (i%3)*0.15};
        transition:transform .1s ease, filter .1s ease;
      `;
      pad.addEventListener("touchstart", (e) => { e.preventDefault(); playTone(freq, pad); }, {passive:false});
      pad.addEventListener("mousedown", () => playTone(freq, pad));
      grid.appendChild(pad);
    });
  }
});
