(function(){
  const stripEl   = document.getElementById("strip");
  const hudIndex  = document.getElementById("hud-index");
  const bootEl    = document.getElementById("boot");

  const BATCH_SIZE = 6;        // how many cards we append at a time
  const PRELOAD_THRESHOLD = 3; // append more when within N cards of the end

  let deck = [];            // the shuffled infinite-feeling order (repeats allowed after a full pass)
  let cards = [];           // { el, mod, cleanup, mounted, trueIdx } — array index i always corresponds to the i-th child of #strip
  let allModules = [];      // the full registered set — source of truth, never mutated
  let moduleIndex = new Map(); // mod -> its position in allModules, built once — avoids an O(n) indexOf scan on every scroll frame
  let baseModules = [];     // current shuffled pass, drawn down as cursor advances
  let cursor = 0;

  // ---- persistence helper passed into each game (backed by IndexedDB) ----
  function makeApi(id){
    return {
      save(obj){ return StripDB.saveState(id, obj); },      // returns a Promise
      load(){ return StripDB.loadState(id); },              // returns a Promise<data|null>
      getHighscore(){ return StripDB.getHighscore(id); },   // returns a Promise<number>
      // Round 14 "today's twist": the Daily Pick's cartridge counts DOUBLE
      // toward its highscore for the whole day. One central hook in the api
      // factory — every game gets the event without touching its own code,
      // and the pick's card wears the ×2 tag so the doubled best reads as
      // intentional. Non-pick days/games pass straight through.
      setHighscore(score){
        const boosted = (window.Daily && Daily.twistScore) ? Daily.twistScore(id, score) : score;
        return StripDB.setHighscore(id, boosted);
      } // returns a Promise<number> (new best)
    };
  }


  // Fisher-Yates
  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Build the next chunk of the "infinite" deck.
  // Strategy: shuffle full module set each pass so repeats don't clump,
  // and never place the same id twice in a row across pass boundaries.
  function nextBatch(n){
    const out = [];
    while(out.length < n){
      if(cursor >= baseModules.length){
        const fresh = shuffle(allModules);
        // avoid immediate repeat of the last card already in the deck
        if(deck.length){
          const lastId = deck[deck.length - 1].id;
          if(fresh[0] && fresh[0].id === lastId && fresh.length > 1){
            [fresh[0], fresh[1]] = [fresh[1], fresh[0]];
          }
        }
        baseModules = fresh;
        cursor = 0;
      }
      out.push(baseModules[cursor]);
      deck.push(baseModules[cursor]);
      cursor++;
    }
    return out;
  }

  function buildCardShell(mod, idx){
    const cart = document.createElement("section");
    cart.className = "cart";
    cart.dataset.idx = idx;

    cart.innerHTML = `
      <div class="cart-inner">
        <div class="cart-header">
          <div>
            <div class="cart-label">${escapeHtml(mod.label || "STRIP")}</div>
            <div class="cart-title">${escapeHtml(mod.title || mod.id)}</div>
          </div>
          ${mod.tag ? `<div class="cart-tag">${escapeHtml(mod.tag)}</div>` : ""}
        </div>
        <div class="cart-body"></div>
        ${mod.hint ? `<div class="cart-hint">${escapeHtml(mod.hint)}</div>` : ""}
      </div>
    `;
    return cart;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function appendCards(n){
    const batch = nextBatch(n);
    const frag = document.createDocumentFragment();
    batch.forEach(mod => {
      const idx = cards.length;
      const el = buildCardShell(mod, idx);
      frag.appendChild(el);
      const trueIdx = moduleIndex.get(mod);
      cards.push({ el, mod, cleanup:null, mounted:false, mounting:false, trueIdx });
    });
    stripEl.appendChild(frag);
  }

  function mountCard(entry){
    if(entry.mounted || entry.mounting) return;
    const body = entry.el.querySelector(".cart-body");
    entry.mounting = true;
    let result;
    try{
      result = entry.mod.mount(body, makeApi(entry.mod.id));
    }catch(err){
      entry.mounting = false;
      console.error("Failed to mount", entry.mod.id, err);
      body.innerHTML = `<div style="color:var(--ink-dim);font-size:13px;text-align:center;padding:20px;">This cartridge glitched.<br>(${escapeHtml(entry.mod.id)})</div>`;
      return;
    }
    Promise.resolve(result).then(cleanup => {
      entry.mounting = false;
      // if the card scrolled away and got unmounted while this was resolving, don't leave it mounted
      if(entry.unmountRequested){
        entry.unmountRequested = false;
        try{ typeof cleanup === "function" && cleanup(); }catch(e){}
        body.innerHTML = "";
        return;
      }
      entry.cleanup = typeof cleanup === "function" ? cleanup : null;
      entry.mounted = true;
    }).catch(err => {
      entry.mounting = false;
      console.error("Failed to mount", entry.mod.id, err);
      body.innerHTML = `<div style="color:var(--ink-dim);font-size:13px;text-align:center;padding:20px;">This cartridge glitched.<br>(${escapeHtml(entry.mod.id)})</div>`;
    });
  }

  function unmountCard(entry){
    if(entry.mounting){ entry.unmountRequested = true; return; }
    if(!entry.mounted) return;
    try{ entry.cleanup && entry.cleanup(); }catch(e){}
    const body = entry.el.querySelector(".cart-body");
    body.innerHTML = "";
    entry.mounted = false;
  }

  // Mount current + neighbors, unmount everything far away (keeps CPU/battery sane
  // during play). We deliberately do NOT remove card DOM nodes here or anywhere in
  // the scroll path — mutating scrollTop synchronously inside a scroll handler
  // fights the browser's own momentum scrolling on mobile and causes visible
  // snapping/jumping. Unmounted cards are just an empty <div class="cart-body">,
  // a few hundred bytes of DOM each — thousands of them cost nothing meaningful,
  // so there's no real need to remove them at all.
  //
  // Mounting happens immediately on every scroll frame (cheap: mountCard no-ops if
  // already mounted/mounting), so the card you land on is always ready instantly.
  // Unmounting is debounced to fire only once scrolling has settled — during a fast
  // flick, centerIdx jitters across several cards in quick succession, and tearing
  // a game down just because it was briefly "distant" mid-flick — only to remount
  // it a frame later when the flick lands back on it — is wasted work and, for any
  // game with setup cost (audio contexts, canvas sizing), a visible flicker.
  let settleTimer = null;
  const SETTLE_MS = 220;
  let currentCenterIdx = 0; // live center card — the input-arbitration source of truth

  function syncViewport(){
    const scrollTop = stripEl.scrollTop;
    const h = stripEl.clientHeight || 1;
    const centerIdx = Math.round(scrollTop / h);
    currentCenterIdx = centerIdx;

    const centerEntry = cards[centerIdx];
    if(centerEntry){
      // position now means something: "07/50", not a bare "07"
      hudIndex.textContent = String(centerEntry.trueIdx + 1).padStart(2, "0") + "/" + allModules.length;
      // Daily Pick (Round 13): tag/untag the centered card when it is/isn't
      // today's pick — runs on every scroll frame but no-ops once the DOM
      // already matches (daily.js keeps both branches cheap)
      if(window.Daily) Daily.badge(centerEntry.el, centerEntry.mod.id);
    }

    cards.forEach((entry, i) => {
      if(Math.abs(i - centerIdx) <= 1) mountCard(entry);
    });

    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => pruneDistantMounts(centerIdx), SETTLE_MS);

    // infinite: grow the deck as we approach the end
    if(cards.length - centerIdx <= PRELOAD_THRESHOLD){
      appendCards(BATCH_SIZE);
    }
  }

  function pruneDistantMounts(centerIdx){
    cards.forEach((entry, i) => {
      if(Math.abs(i - centerIdx) > 2) unmountCard(entry);
    });
    // the strip has settled — tell the shell which cartridge the player is
    // actually ON (the drawer uses this to maintain a recents list)
    const entry = cards[centerIdx];
    if(entry){
      window.dispatchEvent(new CustomEvent("strip:card-centered", { detail: { id: entry.mod.id } }));
    }
  }

  let rafPending = false;
  function onScroll(){
    if(rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { syncViewport(); rafPending = false; });
  }

  async function init(){
    await Settings.whenReady();
    allModules = Strip.all();
    if(!allModules.length){
      stripEl.innerHTML = `<div style="padding:40px;color:var(--ink-dim)">No cartridges registered yet.</div>`;
      bootEl.classList.add("hide");
      return;
    }
    moduleIndex = new Map(allModules.map((m, i) => [m, i]));
    appendCards(Math.max(BATCH_SIZE, allModules.length));
    syncViewport();
    stripEl.addEventListener("scroll", onScroll, { passive:true });

    setTimeout(() => bootEl.classList.add("hide"), 550);
  }

  document.addEventListener("DOMContentLoaded", init);

  // Shell API for the cartridge drawer (js/drawer.js): jump straight to a
  // specific cartridge instead of blind-scrolling through the deck.
  window.StripShell = {
    jumpToIndex(i){
      const h = stripEl.clientHeight || 1;
      stripEl.scrollTo({ top: i * h, behavior: "smooth" });
    },
    jumpToModule(mod){
      let i = cards.findIndex(c => c.mod === mod);
      // not in the visible deck yet? extend it (bounded) until the cartridge appears
      let guard = 0;
      while(i < 0 && guard++ < 30){
        appendCards(BATCH_SIZE);
        i = cards.findIndex(c => c.mod === mod);
      }
      if(i >= 0) this.jumpToIndex(i);
    },
    // input arbitration: a card is "active" only when it is the centered one.
    // Games with window-level keyboard handlers MUST gate on this — mount
    // windows keep up to 5 cards mounted, and the deck repeats after a full
    // pass, so two copies of the same cartridge can coexist and would
    // otherwise both consume the same arrow keys.
    isActive(el){
      if(el == null) return false;
      const cart = el.closest ? el.closest(".cart") : null;
      const entry = cards[currentCenterIdx];
      return !!(cart && entry && entry.el === cart);
    }
  };
})();
