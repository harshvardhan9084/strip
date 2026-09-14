Strip.register({
  id: "tonepad",
  label: "TOY",
  title: "Tone Pad",
  tag: "loop rec",
  hint: "Tap pads to play · record a loop",
  mount(container, api){
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px; width:100%;";

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid; grid-template-columns:repeat(4,1fr); gap:8px; width:min(78vw,260px);";
    wrap.appendChild(grid);

    // Round 22 (P2 tail): LOOP RECORD. The pad was a one-shot instrument —
    // nothing you played could ever build into a piece. Now: hit REC, play a
    // phrase, hit REC again; PLAY loops your clip back over the pads (the
    // pads light up as the loop triggers them), so you can overdub layer on
    // layer into a real tune. The compulsion loop, made literal.
    const recBtn = document.createElement("button");
    recBtn.className = "btn";
    recBtn.textContent = "● REC";
    const playBtn = document.createElement("button");
    playBtn.className = "btn";
    playBtn.textContent = "▶ Play loop";
    const recRow = document.createElement("div");
    recRow.style.cssText = "display:flex; gap:10px;";
    recRow.appendChild(recBtn);
    recRow.appendChild(playBtn);
    wrap.appendChild(recRow);

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:10px; color:var(--ink-dim); min-height:14px; text-align:center;";
    hint.textContent = "";
    wrap.appendChild(hint);

    container.appendChild(wrap);

    // pentatonic scale across 2 octaves — sounds pleasant in any combination
    const NOTES = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3,
                   784.0, 880.0, 1046.5, 1174.7];
    const COLORS = ["#FFB347","#8B7FE8","#E8637F","#6FCF97"];

    const padEls = [];
    function playTone(freq, padEl){
      // route through the shared Feedback layer: one AudioContext app-wide,
      // and the Settings.sound toggle is respected (the old version created its
      // own AudioContext and played even with sound off)
      Feedback.tone(freq, 0.9);

      if(padEl){
        padEl.style.transform = "scale(0.93)";
        padEl.style.filter = "brightness(1.4)";
        setTimeout(() => { padEl.style.transform = "scale(1)"; padEl.style.filter = "none"; }, 150);
      }
    }

    NOTES.forEach((freq, i) => {
      const pad = document.createElement("button");
      pad.style.cssText = `
        aspect-ratio:1; border-radius:12px; border:none; cursor:pointer;
        background:${COLORS[i % COLORS.length]}; opacity:${0.55 + (i%3)*0.15};
        transition:transform .1s ease, filter .1s ease;
      `;
      pad.addEventListener("touchstart", (e) => { e.preventDefault(); tapNote(i); }, {passive:false});
      pad.addEventListener("mousedown", () => tapNote(i));
      grid.appendChild(pad);
      padEls.push(pad);
    });

    // ---- loop recorder ----
    let recording = false, recStart = 0;
    let clip = [];           // [{ note, at }] — at = ms relative to record start
    let playing = false;
    let playTimers = [];

    function tapNote(i){
      playTone(NOTES[i], padEls[i]);
      if(recording) clip.push({ note: i, at: performance.now() - recStart });
    }

    function clearTimers(){
      playTimers.forEach(t => clearTimeout(t));
      playTimers = [];
    }

    function stopPlay(){
      playing = false;
      clearTimers();
      playBtn.textContent = "▶ Play loop";
      playBtn.style.borderColor = "";
    }

    function playLoop(){
      if(!clip.length){
        hint.textContent = "record a phrase first — tap ● REC, play, ● REC";
        setTimeout(() => { if(hint.textContent.startsWith("record")) hint.textContent = ""; }, 2600);
        return;
      }
      playing = true;
      playBtn.textContent = "■ Stop";
      playBtn.style.borderColor = "var(--amber)";
      const LOOP_MS = Math.max(1600, clip[clip.length - 1].at + 500);
      const schedule = () => {
        if(!playing) return;
        clip.forEach(({ note, at }) => {
          playTimers.push(setTimeout(() => {
            if(!playing) return;
            playTone(NOTES[note], padEls[note]);
          }, at));
        });
        playTimers.push(setTimeout(() => {
          clearTimers();
          schedule(); // the loop lives until stopped
        }, LOOP_MS));
      };
      schedule();
    }

    recBtn.addEventListener("click", () => {
      if(!recording){
        stopPlay();
        recording = true;
        clip = [];
        recStart = performance.now();
        recBtn.textContent = "■ STOP";
        recBtn.style.borderColor = "var(--danger)";
        recBtn.style.color = "var(--danger)";
        hint.textContent = "recording — play a phrase, then tap STOP";
      } else {
        recording = false;
        recBtn.textContent = "● REC";
        recBtn.style.borderColor = "";
        recBtn.style.color = "";
        hint.textContent = clip.length ? `clip: ${clip.length} notes · press Play to loop it` : "nothing recorded";
      }
    });
    playBtn.addEventListener("click", () => {
      if(playing) stopPlay();
      else playLoop();
    });

    return () => { clearTimers(); };
  }
});
