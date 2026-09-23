Strip.register({
  id: "typespeed",
  label: "REFLEX",
  title: "Type Speed",
  tag: "WPM",
  hint: "Type the phrase as fast as you can",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();

    const PHRASES = [
      "the quick brown fox jumps over the lazy dog",
      "pack my box with five dozen liquor jugs",
      "how vexingly quick daft zebras jump",
      "the five boxing wizards jump quickly",
      "sphinx of black quartz judge my vow",
      "waltz nymph for quick jigs vex bud",
      "bright vixens jump dozy fowl quack",
      "quick zephyrs blow vexing daft jim",
      "two driven jocks help fax my big quiz",
      "five quacking zephyrs jolt my wax bed",
    ];

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px; width:100%; max-width:290px;";

    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between
    // title and playfield, one type scale, tabular nums, <=4 stats. The old
    // header's span ids live on as value keys so update sites stay one-liners.
    const statVals = {
      "ty-score": "-",
      "ty-acc": "-",
      "ty-best": String(best),
    };
    const STAT_KEYS = [
      ["ty-score", "WPM", "var(--amber)", null],
      ["ty-acc", "ACC", "var(--ink)", null],
      ["ty-best", "BEST", "var(--purple)", null],
    ];
    function renderStats(){
      api.setStats(STAT_KEYS.map(([k, label, color, fixed]) => ({
        label,
        value: k ? statVals[k] : fixed,
        color,
      })));
    }
    renderStats();

    const phraseBox = document.createElement("div");
    phraseBox.style.cssText = "font-size:15px; line-height:1.6; text-align:center; padding:14px; background:var(--panel-2); border-radius:12px; min-height:60px;";
    wrap.appendChild(phraseBox);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Tap here and start typing…";
    input.autocapitalize = "off";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.autocorrect = "off"; // iOS word-replacement mutates the input mid-run — false mistakes + multi-char insertions the keystroke judge can't score
    // honesty guard: a pasted phrase lands in one input event and scores an
    // absurd WPM (observed 420000 in testing) that then sits on the BEST line
    // forever. Typing is the entire point of the cartridge — block paste and
    // say so, instead of silently accepting a meaningless record.
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      Feedback.buzz("error");
      input.placeholder = "No pasting — type it out!";
      setTimeout(() => { input.placeholder = "Tap here and start typing…"; }, 1800);
    });
    input.addEventListener("drop", (e) => e.preventDefault());
    input.addEventListener("contextmenu", (e) => e.preventDefault());
    input.style.cssText = `
      width:100%; padding:12px 14px; border-radius:10px; border:1px solid var(--line);
      background:var(--bg); color:var(--ink); font-size:14px;
    `;
    wrap.appendChild(input);

    const retryBtn = document.createElement("button");
    retryBtn.className = "btn accent";
    retryBtn.textContent = "New phrase";
    wrap.appendChild(retryBtn);

    container.appendChild(wrap);

    let phrase, startTime, done;
    // Round 22 (P2 tail): the ACCURACY gate. The old run only checked the
    // FINAL text — you could maul the phrase, patch it with 30 backspaces,
    // and bank a record WPM. Now every keystroke is tracked; finish with
    // accuracy under 80% and the WPM displays but scores nothing. The BEST
    // line means what it says.
    let keystrokes = 0, mistakes = 0, prevLen = 0;

    function accuracy(){
      return keystrokes ? Math.max(0, Math.round(100 * (keystrokes - mistakes) / keystrokes)) : 100;
    }

    function renderPhrase(typed){
      let html = "";
      for(let i=0;i<phrase.length;i++){
        const ch = phrase[i];
        if(i < typed.length){
          const correct = typed[i] === ch;
          html += `<span style="color:${correct ? "var(--good, #6FCF97)" : "var(--danger)"}; ${correct?"":"text-decoration:underline;"}">${ch}</span>`;
        } else {
          html += `<span style="color:var(--ink-dim);">${ch}</span>`;
        }
      }
      phraseBox.innerHTML = html;
    }

    function newPhrase(){
      RunCeremony.hide(container); // a restart never fights the flourish
      phrase = PHRASES[Math.floor(Math.random()*PHRASES.length)];
      startTime = null;
      done = false;
      keystrokes = 0; mistakes = 0; prevLen = 0;
      input.value = "";
      input.disabled = false;
      statVals["ty-score"] = "-"; renderStats();
      statVals["ty-acc"] = "-"; renderStats();
      renderPhrase("");
    }

    input.addEventListener("input", () => {
      if(done) return;
      if(!startTime) startTime = Date.now();
      const typed = input.value;
      if(typed.length > prevLen){
        // an insertion: judge the newest character (deletions don't re-judge
        // characters the player already paid for)
        keystrokes++;
        const i = typed.length - 1;
        if(typed[i] !== phrase[i]) mistakes++;
      }
      prevLen = typed.length;
      statVals["ty-acc"] = accuracy() + "%"; renderStats();
      renderPhrase(typed);
      if(typed === phrase){
        done = true;
        input.disabled = true;
        const seconds = (Date.now() - startTime) / 1000;
        const words = phrase.split(" ").length;
        const wpm = seconds > 0 ? Math.round((words / seconds) * 60) : 0; // a same-event completion (autofill) must not divide by zero → Infinity best
        const acc = accuracy();
        statVals["ty-score"] = wpm; renderStats();
        const prevBest = best;
        if(acc >= 80){
          Feedback.buzz("success");
          api.gameover("win", wpm);
          api.setHighscore(wpm).then(v => {
            best = v;
            statVals["ty-best"] = best; renderStats();
          });
        } else {
          api.gameover("over", wpm);
          Feedback.buzz("error");
          statVals["ty-acc"] = acc + "%"; renderStats(); // the danger hue rides the failing run's number
          phraseBox.title = "Accuracy below 80% — this run can't set a best";
        }
        // R35 ceremony adoption: a finished phrase was a stat-row update —
        // the panel carries the WPM out, and a sub-80% run says WHY it
        // scored nothing instead of going quiet.
        RunCeremony.show(container, {
          tone: acc >= 80 ? "win" : "over",
          label: acc >= 80 ? "TYPED" : "UNDER 80%",
          score: String(wpm),
          unit: "wpm",
          delta: acc >= 80
            ? (wpm > prevBest ? "NEW BEST" : (prevBest ? "BEST " + prevBest : ""))
            : acc + "% accurate — no best",
          deltaTone: acc >= 80 && wpm > prevBest ? "good" : "",
          verb: "NEW PHRASE",
          onVerb: newPhrase,
        });
      }
    });

    retryBtn.addEventListener("click", newPhrase);
    newPhrase();
  }
});
