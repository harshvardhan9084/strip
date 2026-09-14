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

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>WPM <span id="ty-score" style="color:var(--amber)">-</span></div><div>ACC <span id="ty-acc" style="color:var(--ink)">-</span></div><div>BEST <span id="ty-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const phraseBox = document.createElement("div");
    phraseBox.style.cssText = "font-size:15px; line-height:1.6; text-align:center; padding:14px; background:var(--panel-2); border-radius:12px; min-height:60px;";
    wrap.appendChild(phraseBox);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Tap here and start typing…";
    input.autocapitalize = "off";
    input.autocomplete = "off";
    input.spellcheck = false;
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
          html += `<span style="color:${correct ? "#6FCF97" : "var(--danger)"}; ${correct?"":"text-decoration:underline;"}">${ch}</span>`;
        } else {
          html += `<span style="color:var(--ink-dim);">${ch}</span>`;
        }
      }
      phraseBox.innerHTML = html;
    }

    function newPhrase(){
      phrase = PHRASES[Math.floor(Math.random()*PHRASES.length)];
      startTime = null;
      done = false;
      keystrokes = 0; mistakes = 0; prevLen = 0;
      input.value = "";
      input.disabled = false;
      q("#ty-score").textContent = "-";
      q("#ty-acc").textContent = "-";
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
      q("#ty-acc").textContent = accuracy() + "%";
      renderPhrase(typed);
      if(typed === phrase){
        done = true;
        input.disabled = true;
        const seconds = (Date.now() - startTime) / 1000;
        const words = phrase.split(" ").length;
        const wpm = Math.round((words / seconds) * 60);
        const acc = accuracy();
        q("#ty-score").textContent = wpm;
        if(acc >= 80){
          Feedback.buzz("success");
          api.setHighscore(wpm).then(v => {
            best = v;
            q("#ty-best").textContent = best;
          });
        } else {
          Feedback.buzz("error");
          q("#ty-acc").innerHTML = `<span style="color:var(--danger)">${acc}%</span>`;
          phraseBox.title = "Accuracy below 80% — this run can't set a best";
        }
      }
    });

    retryBtn.addEventListener("click", newPhrase);
    newPhrase();
  }
});
