Strip.register({
  id: "simonsays",
  label: "PUZZLE",
  title: "Sequence",
  tag: "🧠",
  hint: "Watch the pattern, repeat it",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();

    const COLORS = [
      { name:"a", hex:"#FFB347", hexLit:"#FFD08A" },
      { name:"b", hex:"#8B7FE8", hexLit:"#B4ACF0" },
      { name:"c", hex:"#E8637F", hexLit:"#F0A0B2" },
      { name:"d", hex:"#6FCF97", hexLit:"#A6E6BF" },
    ];

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:16px; width:100%;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>ROUND <span id="sm-round" style="color:var(--amber)">0</span></div><div>BEST <span id="sm-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid; grid-template-columns:1fr 1fr; gap:8px; width:min(60vw,200px); height:min(60vw,200px);";
    wrap.appendChild(grid);

    const startBtn = document.createElement("button");
    startBtn.className = "btn accent";
    startBtn.textContent = "Start";
    wrap.appendChild(startBtn);

    container.appendChild(wrap);

    const pads = COLORS.map(c => {
      const pad = document.createElement("button");
      pad.style.cssText = `border:none; border-radius:12px; background:${c.hex}; cursor:pointer; transition:background .1s ease;`;
      grid.appendChild(pad);
      return pad;
    });

    let sequence = [], playerPos = 0, accepting = false, round = 0;

    const PAD_FREQS = [329.6, 415.3, 523.3, 622.3]; // distinct pitch per pad

    function flash(i, duration=350, playTone=true){
      if(playTone) Feedback.tone(PAD_FREQS[i], 0.16);
      return new Promise(resolve => {
        pads[i].style.background = COLORS[i].hexLit;
        pads[i].style.boxShadow = `0 0 20px ${COLORS[i].hex}`;
        setTimeout(() => {
          pads[i].style.background = COLORS[i].hex;
          pads[i].style.boxShadow = "none";
          setTimeout(resolve, 120);
        }, duration);
      });
    }

    async function playSequence(){
      accepting = false;
      await new Promise(r => setTimeout(r, 500));
      for(const i of sequence){
        await flash(i, Math.max(220, 400 - round*10));
      }
      accepting = true;
      playerPos = 0;
    }

    function nextRound(){
      round++;
      sequence.push(Math.floor(Math.random()*4));
      q("#sm-round").textContent = round;
      playSequence();
    }

    function padTap(i){
      if(!accepting) return;
      Feedback.haptic("light");
      flash(i, 150);
      if(sequence[playerPos] !== i){
        Feedback.buzz("fail");
        endGame();
        return;
      }
      playerPos++;
      if(playerPos === sequence.length){
        accepting = false;
        Feedback.tone("success");
        setTimeout(nextRound, 500);
      }
    }

    function endGame(){
      accepting = false;
      const finalRound = round - 1;
      startBtn.textContent = "Try again";
      startBtn.disabled = false;
      if(finalRound > 0){
        api.setHighscore(finalRound).then(v => {
          best = v;
          q("#sm-best").textContent = best;
        });
      }
    }

    function start(){
      sequence = []; round = 0; playerPos = 0;
      q("#sm-round").textContent = 0;
      startBtn.disabled = true;
      startBtn.textContent = "Watch…";
      nextRound();
    }

    pads.forEach((pad, i) => pad.addEventListener("click", () => padTap(i)));
    startBtn.addEventListener("click", start);
  }
});
