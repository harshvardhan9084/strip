Strip.register({
  id: "lexicle",
  label: "WORD",
  title: "Lexicle",
  tag: "daily-ish",
  hint: "Guess the 5-letter word in 6 tries",
  async mount(container, api){
    // ANSWERS — small but honest curated answer list; every entry is a legal
    // guess AND a legal answer
    const RAW = ("about brave crane drink eagle flame grape house ivory juice kneel light mouse noble ocean " +
      "piano queen river stone tiger urban voice water yeast zebra apple beach cloud dance earth feast " +
      "ghost heart ideal jolly koala lemon money night orbit plant quiet robot smile train unity vivid " +
      "whale amber bench candy delta ember frost glide humor inlet joker karma lunar mango olive pearl " +
      "quest royal spice tulip villa wound yacht zonal album boast chalk dwell elope fable grind hinge " +
      "input knead latch mirth nurse opal prism quill spark tempo uphold vital wizard adapt blaze crest " +
      "donut elbow flint grove husk indign lumen maple nylon offal plume quirk shine trust wander amino " +
      "brink chess clash drift epoch flail gourd hoist knoll lush moped nudge oaken pouch rally scope " +
      "thorn unity vapor whisk yearn zeroed alike bloom crisp daisy evoke fern gauge honey infer jewel " +
      "known latch murmur notch onyx pedal quaint rust solar surge tunic vapor wharf yield zippy").split(" ");
    const WORDS = [...new Set(RAW.filter(w => w.length === 5 && /^[a-z]+$/.test(w)))]
      // filter non-words that snuck into the historic list ("indign" is not a word)
      .filter(w => w !== "indign");

    // Round 19 (AUDIT.md — Lexicle P1, live-proven BLOCKING): ARISE and ADIEU —
    // the two most standard openers in the genre — were rejected with "not in
    // word list" because the dictionary WAS the answer list. Guesses are now
    // checked against a separate ~300-word common-guess list first; answers
    // stay curated. Deduction workflow no longer fights its own tool.
    const GUESS_EXTRA = ("adieu irate arose arise abide above abuse acute adapt admit adopt adult after again agent agree ahead " +
      "alarm alert alive allow alone along alter among anger angle angry ankle apart apply arena argue " +
      "arise armor aroma array arrow aside asset atlas audio audit avoid awake award aware awful bacon " +
      "badge baker basic basil basin basis batch beach beard beast begin begun being belly below bilge " +
      "birch birth bison black blade blame blank blast blaze bleak blend bless blind blink block blood " +
      "board boast bonus boost booth bound brain brake brand brass bread break breed brick bride brief " +
      "bring brink broad broke brook brown brush build built bunch burst cabin cable carry carve catch " +
      "cause chain chair chalk charm chart chase cheap check cheek cheer chess chest chief child chill " +
      "choir chose chunk churn civic civil claim clash class clean clear clerk click cliff climb cling " +
      "cloak clock close cloth coach coast color comic coral could count court cover crack craft crane " +
      "crash crawl crazy cream crest crime crisp cross crowd crown crush curl curly curse curve cycle " +
      "daily dairy daisy dealt death debut decay decor delay dense depth diary dirty dodge doing donor " +
      "doubt dough dozen draft drain drama drank drape drawl drawn dress dried drift drill drive drown " +
      "dryer eager early eaten ebony edict eerie eight elbow elder elect elite empty enemy enjoy enter " +
      "entry equal equip erase error erupt essay ethic evade event every exact exile exist extra fable " +
      "faith fancy fatal fault favor feast fetch fever fiber field fiery fifth fifty fight final first " +
      "flash fleet flesh flick fling flint float flock flood floor flour fluid flute focus foggy force " +
      "forge forth forty forum found frame fraud freak fresh fried frill front frost froze fruit fully " +
      "funny fuzzy gauge genre giant given glass gleam glide gloom glory glove going goose gorge grace " +
      "grade grain grand grant grasp grass grave gravy graze great greed green greet grief grill grind " +
      "gross group grove growl grown guard guess guest guide guilt hairy handy happy harsh haste hatch " +
      "haste haunt heavy hedge hefty hello hence hinge hippo hobby hollow honey honor horse hotel hound " +
      "human humid humor hurry ideal image imply index inner input irony issue ivory jelly jewel joint " +
      "jolly judge juice juicy kneel knife knock known label labor large laser later laugh layer learn " +
      "lease leash least leave legal lemon level lever limit linen liver lobby local lodge logic loose " +
      "lorry lower loyal lucky lunar lunch lying magic major maker maple march match maybe mayor meant " +
      "medal media melon mercy merge merit merry metal meter midst might minor minus mirth model moist " +
      "money month moral motor mount mourn mouse mouth movie music muddy mummy mural murky nerve never " +
      "newly nicer niche niece nightly ninja noble noise noisy north notch noted novel nurse nylon oasis " +
      "occur ocean offer often olive onion onset opera orange orbit order organ other otter ought ounce " +
      "outer owner oxide ozone paint panel panic paper party pasta paste patch pause peace peach pearl " +
      "pedal penny perch peril petal phase phone photo piece pilot pinch pitch pivot pixel place plaid " +
      "plain plane plate plaza plead plumb plume plunge point polar polka porch pouch pound power press " +
      "price pride prime print prize probe prone proof proud prove prune pulse punch pupil puppy purse " +
      "queen query queue quick quiet quill quilt quirk quite quota quote radar radio raise rally ranch " +
      "range rapid ratio raven reach react ready realm rebel refer reign relax relay renew repay reply " +
      "rerun reset resin retro rhyme rider ridge rifle right rigid rinse risky rival river roast robin " +
      "robot rocky rodeo rogue roomy roost rotor rough round route royal rugby ruler rumor rural rusty " +
      "sadly saint salad salon salsa salty sandy sappy sassy sauce saucy scale scarf scene scent scoop " +
      "scope score scout scrap screw scrub sedan seize sense serve seven shade shaft shake shall shame " +
      "shape share shark sharp shave shelf shell shift shine shiny shock shoot shore short shout shown " +
      "sight silly since siren sixth sixty skate skill skirt skull slate sleek sleep slice slide slope " +
      "slosh small smart smash smell smile smirk smoke snack snake sneak solar solid solve sorry sound " +
      "south space spare spark speak spear speed spell spend spice spicy spike spine spite split spoil " +
      "spoke spoon sport spray spread spring squad squat stack staff stage stain stair stake stale stalk " +
      "stall stamp stand stare start state steam steel steep steer stern stick stiff still sting stock " +
      "stoic stone stood stool store storm story stout stove strap straw stray strip strut study stuff " +
      "stump style sugar suite sunny super surge sushi swear sweat sweep sweet swell swift swing sword " +
      "table taboo tacit tacky tailor taken tally tango tardy taste tasty teary tease tempo tenor tense " +
      "tenth thank theft their theme there these thick thief thigh thing think third those three threw " +
      "throw thumb tidal tiger tight timer tired title toast today token tonal tooth topic torch total " +
      "touch tough towel tower toxic trace track trade trail train trait trash treat trend trial tribe " +
      "trick tried tripe troop trout truck truly trunk trust truth tulip tumor tutor twice twist tying " +
      "udder ultra umber uncle under union unite unity until upper upset urban usage usher usual utter " +
      "vague valid value valve vapor vault venue verse video vigor villa vinyl viola viper viral virus " +
      "visit vital vivid vocal vodka vogue voice voter wagon waist waste watch water weary wedge weird " +
      "whale wharf wheat wheel where which while whine whirl whose widen width wield windy witty woman " +
      "world worry worse worst worth would wound woven wrath wreck wrist write wrong wrote yeast yield " +
      "young yours zebra zesty").split(" ");
    const GUESSES = [...new Set(GUESS_EXTRA.filter(w => w.length === 5 && /^[a-z]+$/.test(w)))];
    const isLegalGuess = (w) => WORDS.includes(w) || GUESSES.includes(w);

    const stored = await api.load();
    let streak = stored && Number.isFinite(stored.streak) ? stored.streak : 0;
    let played = stored && Number.isFinite(stored.played) ? stored.played : 0;
    // DAILY: the tag always said "daily-ish" — now it means it. The day string
    // seeds one word for everyone; solving it grows a real once-per-day streak.
    // Free play ("New word") stays available and never touches the daily streak.
    function todayStr(){
      const d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
    }
    function yesterdayStr(){
      const d = new Date(Date.now() - 86400000);
      return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
    }
    let daily = stored && stored.daily ? stored.daily : { last: "", streak: 0 };
    let mode = "daily";   // "daily" | "free"
    let dailyDone = daily.last === todayStr();
    function dailyAnswer(){
      const t = todayStr();
      let h = 0;
      for(let i=0;i<t.length;i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
      return WORDS[h % WORDS.length];
    }

    const TRIES = 6, LEN = 5;
    let answer, row, col, over;
    const letterState = {}; // best color per letter across keyboard: 2=green 1=yellow 0=gray

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const grid = document.createElement("div");
    grid.style.cssText = "display:grid; grid-template-rows:repeat(6,1fr); gap:5px;";
    const rowEls = [];
    for(let r = 0; r < TRIES; r++){
      const rowEl = document.createElement("div");
      rowEl.style.cssText = "display:flex; gap:4px;";
      const tileEls = [];
      for(let c = 0; c < LEN; c++){
        const t = document.createElement("div");
        t.style.cssText = "width:34px; height:38px; border-radius:6px; border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-size:13px; color:var(--ink); background:transparent; transition:all .15s ease;";
        rowEl.appendChild(t);
        tileEls.push(t);
      }
      grid.appendChild(rowEl);
      rowEls.push(tileEls);
    }
    wrap.appendChild(grid);

    const kb = document.createElement("div");
    kb.style.cssText = "display:flex; flex-direction:column; gap:5px; margin-top:2px;";
    wrap.appendChild(kb);

    const keyEls = {};
    const ROWS_KB = [["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["enter","z","x","c","v","b","n","m","back"]];
    ROWS_KB.forEach(keys => {
      const kr = document.createElement("div");
      kr.style.cssText = "display:flex; gap:3px; justify-content:center;";
      keys.forEach(k => {
        const b = document.createElement("button");
        b.textContent = k === "enter" ? "⏎" : k === "back" ? "⌫" : k.toUpperCase();
        b.style.cssText = `min-width:${k.length > 1 ? 44 : 26}px; height:36px; border-radius:6px; border:1px solid var(--line); background:var(--panel-2); color:var(--ink); font-family:var(--font-display); font-size:${k.length > 1 ? 8 : 10}px; cursor:pointer;`;
        b.addEventListener("click", () => handleKey(k));
        kr.appendChild(b);
        keyEls[k] = b;
      });
      kb.appendChild(kr);
    });

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex; gap:8px;";
    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New word";
    newBtn.addEventListener("click", () => newGame(true, "free"));
    btnRow.appendChild(newBtn);
    const dailyBtn = document.createElement("button");
    dailyBtn.className = "btn";
    dailyBtn.textContent = "Today's word";
    dailyBtn.addEventListener("click", () => newGame(false, "daily"));
    btnRow.appendChild(dailyBtn);
    wrap.appendChild(btnRow);

    container.appendChild(wrap);

    function statUpdate(msg){
      if(msg){ statRow.innerHTML = msg; return; }
      if(mode === "daily"){
        statRow.innerHTML = `DAILY · STREAK <span style="color:var(--amber)">${daily.streak}</span>${dailyDone ? " · ✓ solved" : ""}`;
      } else {
        statRow.innerHTML = `FREE PLAY · PLAYED <span style="color:var(--purple)">${played}</span> · daily streak <span style="color:var(--amber)">${daily.streak}</span>`;
      }
    }

    function newGame(countPlay, newMode){
      if(countPlay && over === false && row > 0) played++; // abandoned games don't count
      mode = newMode || mode;
      answer = mode === "daily" ? dailyAnswer() : WORDS[Math.floor(Math.random() * WORDS.length)];
      row = 0; col = 0; over = false;
      for(const k of Object.keys(letterState)) delete letterState[k];
      for(let r = 0; r < TRIES; r++) for(let c = 0; c < LEN; c++){
        const t = rowEls[r][c];
        t.textContent = "";
        t.style.background = "transparent";
        t.style.borderColor = "var(--line)";
        t.style.color = "var(--ink)";
      }
      Object.keys(keyEls).forEach(k => { keyEls[k].style.background = "var(--panel-2)"; });
      statUpdate();
    }

    function handleKey(k){
      if(over) return;
      if(k === "enter"){
        if(col < LEN){ Feedback.tone("thud"); flashRow(); return; }
        submit();
      } else if(k === "back"){
        if(col > 0){ col--; rowEls[row][col].textContent = ""; }
      } else if(/^[a-z]$/.test(k) && col < LEN){
        rowEls[row][col].textContent = k.toUpperCase();
        col++;
        Feedback.tone("tap");
      }
    }

    function flashRow(){
      rowEls[row].forEach(t => { t.style.borderColor = "var(--danger)"; setTimeout(() => { t.style.borderColor = "var(--line)"; }, 250); });
    }

    function submit(){
      const guess = rowEls[row].map(t => t.textContent.toLowerCase()).join("");
      if(!isLegalGuess(guess)){
        flashRow();
        statUpdate(`<span style="color:var(--danger)">not in word list</span>`);
        setTimeout(() => statUpdate(), 1200);
        return;
      }
      // two-pass coloring: greens first, then yellows from remaining letter pool —
      // the classic bug where "EACH" against "HOUSE" shows two yellows for one H
      const pool = answer.split("");
      const result = Array(LEN).fill(0);
      for(let i = 0; i < LEN; i++){
        if(guess[i] === answer[i]){ result[i] = 2; pool.splice(pool.indexOf(guess[i]), 1); }
      }
      for(let i = 0; i < LEN; i++){
        if(result[i] === 2) continue;
        const p = pool.indexOf(guess[i]);
        if(p >= 0){ result[i] = 1; pool.splice(p, 1); }
      }
      for(let i = 0; i < LEN; i++){
        const t = rowEls[row][i];
        t.style.background = result[i] === 2 ? "#4E9A5B" : result[i] === 1 ? "#B08A2E" : "#33333D";
        t.style.borderColor = "transparent";
      }
      // keyboard reflects the BEST known state per letter
      for(let i = 0; i < LEN; i++){
        const k = guess[i];
        const rank = { 0: 0, 1: 1, 2: 2 };
        const cur = letterState[k] ?? -1;
        if(rank[result[i]] > cur){
          letterState[k] = result[i];
          keyEls[k].style.background = result[i] === 2 ? "#4E9A5B" : result[i] === 1 ? "#B08A2E" : "#33333D";
        }
      }
      Feedback.haptic("light");
      if(guess === answer){
        over = true;
        played++;
        if(mode === "daily"){
          // once-per-day streak: solved today already counts once; consecutive
          // days chain, a skipped day resets (the standard daily-word rule)
          if(daily.last !== todayStr()){
            daily.streak = (daily.last === yesterdayStr()) ? daily.streak + 1 : 1;
            daily.last = todayStr();
            dailyDone = true;
          }
          api.save({ streak, played, daily });
          Feedback.buzz("win");
          statUpdate(`<span style="color:var(--purple)">DAILY SOLVED — streak ${daily.streak}</span> · "New word" for free play`);
        } else {
          streak++;
          api.save({ streak, played, daily });
          Feedback.buzz("win");
          statUpdate(`<span style="color:var(--purple)">SOLVED — played ${played}</span>`);
        }
        return;
      }
      row++;
      col = 0;
      if(row >= TRIES){
        over = true;
        played++;
        if(mode === "free") streak = 0; // a missed daily simply doesn't extend the daily streak
        api.save({ streak, played, daily });
        Feedback.buzz("lose");
        statUpdate(`the word was <span style="color:var(--amber)">${answer.toUpperCase()}</span> · ${mode === "daily" ? "daily streak intact until tomorrow" : "streak reset"}`);
      }
    }

    function onKey(e){
      // input arbitration: only the CENTERED card takes keys
      if(window.StripShell && !StripShell.isActive(container)) return;
      if(e.key === "Enter") handleKey("enter");
      else if(e.key === "Backspace") handleKey("back");
      else if(/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toLowerCase());
    }
    window.addEventListener("keydown", onKey);

    newGame(false, "daily");

    return () => window.removeEventListener("keydown", onKey);
  }
});
