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

    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between
    // title and playfield, one type scale, tabular nums, <=4 stats. The old
    // header's span ids live on as value keys so update sites stay one-liners.
    const statVals = {
      "sm-round": "0",
      "sm-best": String(best),
    };
    const STAT_KEYS = [
      ["sm-round", "ROUND", "var(--amber)", null],
      ["sm-best", "BEST", "var(--purple)", null],
    ];
    function renderStats(){
      api.setStats(STAT_KEYS.map(([k, label, color, fixed]) => ({
        label,
        value: k ? statVals[k] : fixed,
        color,
      })));
    }
    renderStats();

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid; grid-template-columns:1fr 1fr; gap:8px; width:min(60vw,200px); height:min(60vw,200px);";
    wrap.appendChild(grid);

    // R37 (auuudit.md §37 CHANGE "no WATCH / YOUR TURN state indicator") —
    // one anchored status line that morphs: TAP START → WATCH… → REPEAT n.
    // The player finally knows whose beat it is (the flash timing alone
    // never said — 10 audit shots couldn't tell either).
    const turnChip = document.createElement("div");
    turnChip.className = "status-chip";
    turnChip.textContent = "TAP START";
    wrap.appendChild(turnChip);

    const startBtn = document.createElement("button");
    startBtn.className = "btn accent";
    startBtn.textContent = "Start";
    wrap.appendChild(startBtn);

    container.appendChild(wrap);

    const pads = COLORS.map((c, i) => {
      const pad = document.createElement("button");
      // R35 ACCESS: pads are color-only signals — data-cb carries the shape
      // the colorblind-symbols setting shows (pure CSS, live flip).
      pad.className = "simon-pad";
      pad.dataset.cb = ["▲", "●", "■", "◆"][i];
      pad.style.cssText = `position:relative; border:none; border-radius:12px; background:${c.hex}; cursor:pointer; transition:background .1s ease;`;
      grid.appendChild(pad);
      return pad;
    });

    let sequence = [], playerPos = 0, accepting = false, round = 0;
    let dead = false; // unmount kills the playback chain — without it the
                      // WATCH→flash loop plays tones forever in a dead card

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
      if(dead) return;
      accepting = false;
      turnChip.textContent = "WATCH\u2026";
      await new Promise(r => setTimeout(r, 500));
      if(dead) return;
      for(const i of sequence){
        if(dead) return;
        await flash(i, Math.max(220, 400 - round*10));
      }
      if(dead) return;
      accepting = true;
      playerPos = 0;
      // the banner is the turn handoff: the number is the sequence LENGTH
      // (what you must reproduce), not the round number
      turnChip.textContent = "REPEAT " + sequence.length;
    }

    function nextRound(){
      if(dead) return;
      round++;
      sequence.push(Math.floor(Math.random()*4));
      statVals["sm-round"] = round; renderStats();
      playSequence();
    }

    function padTap(i){
      if(!accepting || dead) return;
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
        turnChip.textContent = "WATCH\u2026";
        Feedback.tone("success");
        setTimeout(nextRound, 500);
      }
    }

    function endGame(){
      accepting = false;
      turnChip.textContent = "TAP START";
      const finalRound = round - 1;
      startBtn.textContent = "Try again";
      startBtn.disabled = false;
      const prevBest = best;
      if(finalRound > 0){
        api.gameover("over", finalRound);
        api.setHighscore(finalRound).then(v => {
          best = v;
          statVals["sm-best"] = best; renderStats();
        });
      }
      // R35 ceremony adoption: the fail state was a bare button relabel —
      // now the broken sequence lands on the standard panel. Dying on the
      // very first run still speaks, with an empty hero rather than a
      // fake score (the store contract: nothing reported at 0).
      RunCeremony.show(container, {
        tone: "over",
        label: "SEQUENCE BROKEN",
        score: finalRound > 0 ? finalRound : null,
        unit: finalRound > 0 ? "rounds" : null,
        delta: finalRound > 0 ? (finalRound > prevBest ? "NEW BEST" : (prevBest ? "BEST " + prevBest : "")) : "",
        deltaTone: finalRound > 0 && finalRound > prevBest ? "good" : "",
        verb: "TRY AGAIN",
        onVerb: start,
      });
    }

    function start(){
      RunCeremony.hide(container); // a restart never fights the flourish
      sequence = []; round = 0; playerPos = 0;
      statVals["sm-round"] = 0; renderStats();
      startBtn.disabled = true;
      startBtn.textContent = "Watch…";
      nextRound();
    }

    pads.forEach((pad, i) => pad.addEventListener("click", () => padTap(i)));
    startBtn.addEventListener("click", start);

    return () => { dead = true; }; // stops any playback chain mid-flight
  }
});
