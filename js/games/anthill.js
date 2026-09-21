/**
 * Ant Colony — idle/strategy sim, v2.
 *
 * Core loop change from v1 (the "Hamster Kombat" fix):
 * Passive production no longer flows straight into your spendable balance.
 * It fills a capped VAULT instead. The vault has a max capacity — once full,
 * production is WASTED until you open the app and collect. This is the
 * entire point: it makes "check back in" meaningfully better than "walk away
 * for two weeks," because a full vault caps out regardless of how long you
 * ignore it. Vault capacity is itself an upgrade line, so the strategic
 * question becomes: spend food on more production, or on a bigger vault to
 * capture more of that production before it's wasted?
 *
 * Resources:
 *  - food        : spendable balance (from tapping + vault collection)
 *  - vault       : accrues at ratePerSec() while away/idle, caps at vaultCap
 *  - lifetimeFood: highscore metric (total ever earned, never decreases)
 *
 * Roles (each own exponential cost curve, cost = base * growth^count):
 *  - foragers : +food/sec into the vault, cheap, linear scaling
 *  - farmers  : +food/sec into the vault, pricier, grows a fertility multiplier
 *  - soldiers : reduce raid losses — raids now steal from the VAULT specifically,
 *               so soldiers matter most for players who leave it idle a lot
 *  - vaultTier: increases vault capacity — the resource-allocation tension piece
 *
 * Offline is still capped at 8h of accrual time, but that's now almost always
 * a secondary limit to the vault capacity itself, which is the real ceiling.
 */
Strip.register({
  id: "anthill",
  label: "COLONY",
  title: "Ant Colony",
  tag: "strategy",
  hint: "Tap to gather · collect the vault often",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    const DEFAULT = {
      food: 0,
      lifetimeFood: 0,
      vault: 0,
      foragers: 0,
      farmers: 0,
      soldiers: 0,
      vaultTier: 0,
      fertility: 1,
      lastSeen: Date.now(),
    };
    const saved = await api.load();
    const state = Object.assign({}, DEFAULT, saved || {});
    let best = await api.getHighscore();

    const COST_GROWTH = 1.14;
    const BASE_COST = { foragers: 8, farmers: 30, soldiers: 45, vaultTier: 60 };
    const BASE_RATE = { foragers: 0.4, farmers: 0.9 };
    const VAULT_BASE_CAP = 150;
    const VAULT_CAP_GROWTH = 1.35; // each vault tier meaningfully raises the ceiling
    const TAP_YIELD = () => 1 + state.foragers * 0.15; // tapping fills food directly, bypassing the vault entirely — the "active play" reward
    const OFFLINE_CAP_SEC = 8 * 3600;
    const RAID_CHANCE_PER_MIN = 0.05;
    const RAID_LOSS_UNDEFENDED = 0.18; // steeper than v1 since it only hits the vault, not your spendable food

    function cost(role){
      return Math.ceil(BASE_COST[role] * Math.pow(COST_GROWTH, state[role === "vaultTier" ? "vaultTier" : role]));
    }
    // ---- Round 22 economy repair (the user's playtest finding) ----
    // "A farmer bought at MILLIONS returns the same as one bought at 8 gold."
    // Foragers were a flat 0.4/s forever and farmers only had the small
    // fertility bump, so deep into the 1.14^n cost curve every new ant was
    // economically meaningless — the ladder punished you for climbing it.
    // Two standard idle-genre fairness mechanics, layered:
    //   1. SYNERGY — each role's per-ant output scales with how many of that
    //      role you already run (+1.5% per ant). A late forager out-earns an
    //      early one; never as steep as its price, but no longer flat.
    //   2. MILESTONES — every 25th ant of a role DOUBLES that role's whole
    //      output (×2 at 25, ×4 at 50, ×8 at 75…). Legible targets that
    //      puncture the exponential cost wall in every bracket.
    const MILESTONE_EVERY = 25;
    function milestoneMult(role){
      return Math.pow(2, Math.floor(state[role] / MILESTONE_EVERY));
    }
    function nextMilestone(role){
      return (Math.floor(state[role] / MILESTONE_EVERY) + 1) * MILESTONE_EVERY;
    }
    function foragerEach(){
      return BASE_RATE.foragers * (1 + 0.015 * state.foragers) * milestoneMult("foragers");
    }
    function farmerEach(){
      return BASE_RATE.farmers * state.fertility * milestoneMult("farmers");
    }
    function ratePerSec(){
      return state.foragers * foragerEach() + state.farmers * farmerEach();
    }
    function vaultCap(){
      return Math.round(VAULT_BASE_CAP * Math.pow(VAULT_CAP_GROWTH, state.vaultTier));
    }
    function defenseFactor(){
      return Math.max(0.1, Math.pow(0.9, state.soldiers));
    }

    // ---- offline accrual: fills the vault, clamped to its capacity ----
    const elapsedSec = Math.min(OFFLINE_CAP_SEC, Math.max(0, (Date.now() - state.lastSeen) / 1000));
    const rawOfflineGain = elapsedSec * ratePerSec();
    const cap = vaultCap();
    const vaultBefore = state.vault;
    state.vault = Math.min(cap, state.vault + rawOfflineGain);
    const offlineGain = state.vault - vaultBefore;
    const wasted = Math.max(0, rawOfflineGain - offlineGain);

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%; max-width:300px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:12px; font-family:var(--font-display); font-size:8px; color:var(--ink-dim); text-align:center;";
    statRow.innerHTML = `
      <div>FOOD<br><span id="ah-food" style="color:var(--amber); font-size:13px;">0</span></div>
      <div>RATE<br><span id="ah-rate" style="color:var(--purple); font-size:13px;">0/s</span></div>
      <div>BEST<br><span id="ah-best" style="color:var(--ink); font-size:13px;">0</span></div>
    `;

    // vault UI — the centerpiece of the new loop
    const vaultBox = document.createElement("button");
    vaultBox.style.cssText = `
      width:100%; border:1px solid var(--amber-dim); border-radius:14px; background:var(--panel-2);
      padding:12px 14px; cursor:pointer; text-align:left;
    `;
    vaultBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:12px;">🧺 <b style="color:var(--ink)">Vault</b></span>
        <span id="ah-vault-text" style="font-family:var(--font-display); font-size:9px; color:var(--amber);">0 / 0</span>
      </div>
      <div style="height:8px; background:var(--bg); border-radius:4px; overflow:hidden;">
        <div id="ah-vault-bar" style="height:100%; width:0%; background:linear-gradient(90deg, var(--amber), var(--purple)); transition:width .3s ease;"></div>
      </div>
    `;

    const hillBtn = document.createElement("button");
    hillBtn.setAttribute("aria-label", "gather food");
    hillBtn.style.cssText = `
      width:96px; height:96px; border-radius:50%; border:none; cursor:pointer;
      background:radial-gradient(circle at 40% 30%, #3a2f1e, #1a1510 75%);
      box-shadow:0 8px 24px rgba(0,0,0,.5), inset 0 4px 10px rgba(255,255,255,.06);
      font-size:30px; display:flex; align-items:center; justify-content:center;
      position:relative; flex-shrink:0;
    `;
    hillBtn.textContent = "🐜";

    const offlineNote = document.createElement("div");
    offlineNote.style.cssText = "font-size:10px; color:var(--ink-dim); min-height:14px; text-align:center;";
    if(offlineGain > 0.5){
      offlineNote.textContent = wasted > 0.5
        ? `Vault filled while away (+${fmt(offlineGain)}) — ${fmt(wasted)} overflowed and was lost`
        : `+${fmt(offlineGain)} accrued in the vault while away`;
    }

    const raidNote = document.createElement("div");
    raidNote.style.cssText = "font-size:10px; color:var(--danger); min-height:14px; text-align:center;";

    const rolesWrap = document.createElement("div");
    rolesWrap.style.cssText = "display:flex; flex-direction:column; gap:6px; width:100%;";

    function roleRow(role, icon, desc){
      const row = document.createElement("button");
      row.className = "btn";
      row.style.cssText = "display:flex; justify-content:space-between; align-items:center; text-align:left; width:100%; padding:8px 12px;";
      row.innerHTML = `
        <span style="font-size:12px;">${icon} <b style="color:var(--ink)">${label(role)}</b> <span style="color:var(--ink-dim); font-size:10px;">×<span class="count">0</span></span><br><span class="desc" style="color:var(--ink-dim); font-size:9px; font-weight:400;">${desc}</span></span>
        <span class="cost" style="font-family:var(--font-display); font-size:9px; color:var(--amber); white-space:nowrap; margin-left:8px;">0</span>
      `;
      row.addEventListener("click", () => {
        const c = cost(role);
        if(state.food < c){
          // honest feedback instead of a silent no-op — the old button just
          // did nothing, which read like the game was broken
          row.style.borderColor = "var(--danger)";
          spawnFloat(`need ${fmt(c)} food`, row);
          Feedback.buzz("error");
          // the card may unmount (scroll away) within the flash window —
          // refresh() must never touch lookups on a dead card
          setTimeout(() => { if(container.isConnected) refresh(); }, 700);
          return;
        }
        state.food -= c;
        state[role]++;
        api.tend(); // Round 24: growing the colony is tending
        if(role === "farmers") state.fertility = 1 + state.farmers * 0.03;
        if((role === "foragers" || role === "farmers") && state[role] % MILESTONE_EVERY === 0){
          // the milestone lands at the exact tap that earned it — seen, heard, felt
          spawnFloat(`${label(role).toUpperCase()} ×${milestoneMult(role)}!`, row);
          try{ Feedback.buzz("success"); Feedback.tone("win"); }catch(e){}
        }
        persist();
        refresh();
      });
      rolesWrap.appendChild(row);
      return row;
    }
    function label(role){
      return { foragers:"Foragers", farmers:"Farmers", soldiers:"Soldiers", vaultTier:"Bigger Vault" }[role];
    }

    const foragerRow = roleRow("foragers", "🌿", "+0.4 food/s each — grows with the colony");
    const farmerRow  = roleRow("farmers", "🌾", "+0.9 food/s each — grows with the colony");
    const vaultRow   = roleRow("vaultTier", "🧺", "raises vault capacity");
    const soldierRow = roleRow("soldiers", "🛡", "reduces raid losses on the vault");

    wrap.appendChild(statRow);
    wrap.appendChild(vaultBox);
    wrap.appendChild(hillBtn);
    wrap.appendChild(offlineNote);
    wrap.appendChild(raidNote);
    wrap.appendChild(rolesWrap);
    container.appendChild(wrap);

    function fmt(n){
      if(n >= 1e6) return (n/1e6).toFixed(2) + "M";
      if(n >= 1e3) return (n/1e3).toFixed(1) + "k";
      return Math.floor(n).toString();
    }

    function refresh(){
      q("#ah-food").textContent = fmt(state.food);
      q("#ah-rate").textContent = ratePerSec().toFixed(1) + "/s";
      q("#ah-best").textContent = fmt(best);

      const c = vaultCap();
      const pct = Math.min(100, (state.vault / c) * 100);
      q("#ah-vault-text").textContent = `${fmt(state.vault)} / ${fmt(c)}`;
      q("#ah-vault-bar").style.width = pct + "%";
      vaultBox.style.borderColor = pct >= 95 ? "var(--danger)" : "var(--amber-dim)";

      [["foragers", foragerRow], ["farmers", farmerRow], ["soldiers", soldierRow], ["vaultTier", vaultRow]].forEach(([role, row]) => {
        row.querySelector(".count").textContent = state[role];
        const rc = cost(role);
        row.querySelector(".cost").textContent = fmt(rc);
        const affordable = state.food >= rc;
        row.style.opacity = affordable ? 1 : 0.55;
        row.style.borderColor = affordable ? "var(--amber-dim)" : "var(--line)";
      });
      // live per-ant honesty (Round 22): the number you earn with is the
      // number on the button — synergy and the next ×2 target included
      const fd = foragerRow.querySelector(".desc"), fmd = farmerRow.querySelector(".desc");
      if(fd) fd.textContent = `+${foragerEach().toFixed(2)} food/s each · ×2 at ${nextMilestone("foragers")}`;
      if(fmd) fmd.textContent = `+${farmerEach().toFixed(2)} food/s each · ×2 at ${nextMilestone("farmers")}`;
    }

    function collectVault(){
      if(state.vault < 1){
        // an empty-vault tap used to be a dead tap — tell the player why
        // nothing happened (production fills it while you're away)
        spawnFloat(state.vault > 0 ? "collects at 1+" : "vault is empty — foragers fill it", vaultBox);
        Feedback.haptic("light");
        return;
      }
      const amount = state.vault;
      state.food += amount;
      state.lifetimeFood += amount;
      state.vault = 0;
      spawnFloat(`+${fmt(amount)}`, vaultBox);
      persist();
      refresh();
    }
    vaultBox.addEventListener("click", collectVault);

    function persist(){
      state.lastSeen = Date.now();
      api.save(state);
      if(state.lifetimeFood > best){
        best = state.lifetimeFood;
        api.setHighscore(best);
      }
    }

    hillBtn.addEventListener("click", () => {
      const gain = TAP_YIELD();
      state.food += gain;
      state.lifetimeFood += gain;
      api.tend(); // Round 24: tapping the hill IS the caretaking beat
      spawnFloat(`+${gain.toFixed(1)}`, hillBtn);
      Feedback.haptic("light");
      Feedback.tone("tap");
      refresh();
    });

    function spawnFloat(text, anchor){
      const f = document.createElement("div");
      f.textContent = text;
      f.style.cssText = `
        position:absolute; left:50%; top:0; transform:translateX(-50%);
        color:var(--amber); font-weight:700; font-size:13px; pointer-events:none;
        animation:ah-float .6s ease forwards;
      `;
      anchor.style.position = "relative";
      anchor.appendChild(f);
      setTimeout(() => f.remove(), 650);
    }
    if(!document.getElementById("ah-keyframes")){
      const style = document.createElement("style");
      style.id = "ah-keyframes";
      style.textContent = `@keyframes ah-float{ from{opacity:1; transform:translate(-50%,0);} to{opacity:0; transform:translate(-50%,-26px);} }`;
      document.head.appendChild(style);
    }

    // ---- live tick: production fills the vault (capped), raids steal from the vault ----
    let lastTick = performance.now();
    const tickInterval = setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTick) / 1000;
      lastTick = now;

      const gain = ratePerSec() * dt;
      const room = Math.max(0, vaultCap() - state.vault);
      state.vault += Math.min(gain, room);
      // note: lifetimeFood only counts once collected, not while sitting in the vault —
      // this keeps the highscore honest to food you actually secured, not food that could still be raided/overflow-wasted

      if(Math.random() < (RAID_CHANCE_PER_MIN / 60) * dt && state.vault > 0){
        const loss = state.vault * RAID_LOSS_UNDEFENDED * defenseFactor();
        if(loss > 0.5){
          state.vault = Math.max(0, state.vault - loss);
          raidNote.textContent = state.soldiers > 0
            ? `Raid on the vault! Soldiers held most — lost ${fmt(loss)} food`
            : `Raid on the vault! Lost ${fmt(loss)} food — soldiers reduce this`;
          setTimeout(() => { raidNote.textContent = ""; }, 3500);
        }
      }
      refresh();
    }, 1000);

    const autosave = setInterval(persist, 5000);
    refresh();

    return () => {
      clearInterval(tickInterval);
      clearInterval(autosave);
      persist();
    };
  }
});
