Strip.register({
  id: "unscramble",
  label: "PUZZLE",
  title: "Unscramble",
  tag: "words",
  hint: "Tap letters in order to spell the word",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();
    const WORDS = [
      "PIXEL","CIRCUIT","ROCKET","GOBLIN","PUZZLE","CASTLE","DRAGON","GALAXY",
      "WIZARD","JUNGLE","METEOR","ISLAND","CIPHER","ORCHID","THUNDER","VELVET",
      "GADGET","MARBLE","FOSSIL","GLITCH"
    ];

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:18px; width:100%;";

    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between
    // title and playfield, one type scale, tabular nums, <=4 stats. The old
    // header's span ids live on as value keys so update sites stay one-liners.
    const statVals = {
      "us-score": "0",
      "us-best": String(best),
    };
    const STAT_KEYS = [
      ["us-score", "SOLVED", "var(--amber)", null],
      ["us-best", "BEST", "var(--purple)", null],
    ];
    function renderStats(){
      api.setStats(STAT_KEYS.map(([k, label, color, fixed]) => ({
        label,
        value: k ? statVals[k] : fixed,
        color,
      })));
    }
    renderStats();

    const answerRow = document.createElement("div");
    answerRow.style.cssText = "display:flex; gap:6px; min-height:44px; flex-wrap:wrap; justify-content:center;";
    wrap.appendChild(answerRow);

    const lettersRow = document.createElement("div");
    lettersRow.style.cssText = "display:flex; gap:6px; flex-wrap:wrap; justify-content:center; max-width:280px;";
    wrap.appendChild(lettersRow);

    const controls = document.createElement("div");
    controls.style.cssText = "display:flex; gap:10px;";
    const clearBtn = document.createElement("button");
    clearBtn.className = "btn";
    clearBtn.textContent = "Clear";
    const skipBtn = document.createElement("button");
    // R35 verb hierarchy: Skip wore the purple accent while the game's real
    // verb (tapping letters into the amber slot) had no button at all —
    // demoted to a plain secondary control.
    skipBtn.className = "btn";
    skipBtn.textContent = "Skip";
    controls.appendChild(clearBtn);
    controls.appendChild(skipBtn);
    wrap.appendChild(controls);

    container.appendChild(wrap);

    let word, scrambled, chosen, solvedCount = 0;
    let runStreak = 0; // consecutive solves; a skip or a wrong word breaks it
    // Round 19 (S7 fix): BEST was lifetime SOLVED mirrored back (always equal
    // — meaningless). Now it's a real streak record.

    function shuffle(arr){
      const a = arr.slice();
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [a[i],a[j]] = [a[j],a[i]];
      }
      return a;
    }

    function newWord(){
      word = WORDS[Math.floor(Math.random()*WORDS.length)];
      let letters = word.split("");
      do { scrambled = shuffle(letters); } while(scrambled.join("") === word);
      chosen = [];
      renderLetters();
      renderAnswer();
    }

    function renderAnswer(){
      answerRow.innerHTML = "";
      for(let i=0;i<word.length;i++){
        const slot = document.createElement("div");
        // Round 34: the TARGET state was a faint 1px outline — the slots now
        // read as wells, and the NEXT empty slot wears the accent so the tap
        // destination is visible before the first letter lands.
        const isNext = i === chosen.length;
        slot.style.cssText = `
          width:30px; height:36px; border-radius:8px;
          border:${isNext ? "2px" : "1px"} solid ${isNext ? "var(--amber)" : "var(--ink-dim)"};
          ${isNext ? "box-shadow:0 0 10px rgba(var(--glow-rgb),calc(.35*var(--glow-mul,1)));" : ""}
          display:flex; align-items:center; justify-content:center;
          font-weight:700; font-size:16px; background:var(--panel-2);
        `;
        slot.textContent = chosen[i] ? chosen[i].letter : "";
        answerRow.appendChild(slot);
      }
    }

    function renderLetters(){
      lettersRow.innerHTML = "";
      scrambled.forEach((letter, idx) => {
        const used = chosen.some(c => c.idx === idx);
        const btn = document.createElement("button");
        btn.textContent = letter;
        btn.disabled = used;
        btn.style.cssText = `
          width:36px; height:40px; border-radius:8px; border:1px solid ${used ? "var(--line)" : "var(--ink-dim)"};
          background:${used ? "var(--bg)" : "var(--panel-2)"}; color:${used ? "var(--ink-dim)" : "var(--ink)"};
          font-weight:700; font-size:16px; cursor:${used ? "default" : "pointer"};
        `;
        btn.addEventListener("click", () => {
          if(used) return;
          Feedback.tone("tap"); Feedback.haptic("light");
          chosen.push({ letter, idx });
          renderLetters();
          renderAnswer();
          if(chosen.length === word.length) checkAnswer();
        });
        lettersRow.appendChild(btn);
      });
    }

    function checkAnswer(){
      const guess = chosen.map(c => c.letter).join("");
      if(guess === word){
        Feedback.buzz("success");
        solvedCount++;
        runStreak++;
        statVals["us-score"] = solvedCount; renderStats();
        api.gameover("over", runStreak);
        api.setHighscore(runStreak).then(v => {
          best = v;
          statVals["us-best"] = best; renderStats();
        });
        setTimeout(newWord, 500);
      } else {
        Feedback.tone("fail"); Feedback.haptic("medium");
        const dead = runStreak;
        runStreak = 0;
        // R35 ceremony adoption: a real streak (3+) dying used to be a
        // 400ms tile reset with nothing said — the panel gives the run its
        // honest goodbye. Short streaks keep the quiet reset (a 1-word
        // stumble isn't a run worth interrupting).
        if(dead >= 3){
          RunCeremony.show(container, {
            tone: "over",
            label: "STREAK BROKEN",
            score: dead,
            unit: "streak",
            delta: best ? "BEST " + best : "",
            verb: "NEXT WORD",
          });
        }
        setTimeout(() => { chosen = []; renderLetters(); renderAnswer(); }, 400);
      }
    }

    clearBtn.addEventListener("click", () => { chosen = []; renderLetters(); renderAnswer(); });
    skipBtn.addEventListener("click", () => { runStreak = 0; newWord(); });

    newWord();
  }
});
