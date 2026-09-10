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

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>SOLVED <span id="us-score" style="color:var(--amber)">0</span></div><div>BEST <span id="us-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

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
    skipBtn.className = "btn purple";
    skipBtn.textContent = "Skip";
    controls.appendChild(clearBtn);
    controls.appendChild(skipBtn);
    wrap.appendChild(controls);

    container.appendChild(wrap);

    let word, scrambled, chosen, solvedCount = 0;

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
        slot.style.cssText = `
          width:30px; height:36px; border-radius:8px; border:1px solid var(--line);
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
          width:36px; height:40px; border-radius:8px; border:1px solid var(--line);
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
        q("#us-score").textContent = solvedCount;
        api.setHighscore(solvedCount).then(v => {
          best = v;
          q("#us-best").textContent = best;
        });
        setTimeout(newWord, 500);
      } else {
        Feedback.tone("fail"); Feedback.haptic("medium");
        setTimeout(() => { chosen = []; renderLetters(); renderAnswer(); }, 400);
      }
    }

    clearBtn.addEventListener("click", () => { chosen = []; renderLetters(); renderAnswer(); });
    skipBtn.addEventListener("click", newWord);

    newWord();
  }
});
