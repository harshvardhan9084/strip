/**
 * STRIP — Score Sparkline (Round 15)
 * ----------------------------------
 * Per-game depth (judge move): the cartridge you're ON wears a tiny chart of
 * your last plays, fed by the history[] ring StripDB already keeps (capped
 * at 20). One hook in app.js syncViewport — Sparkline.badge(centerEl, mod) —
 * same shape as Daily.badge, cheap no-op once the DOM already matches.
 *
 * Rules the chart lives by:
 *   - history < 2 points can't draw a line -> nothing renders
 *   - inverted-encoding games (stores CEILING - moves/seconds) are DECODED
 *     first, so the line plots real moves/seconds — and inverted games also
 *     wear a visible "FEWER WINS" note (title tooltips are unreachable on a
 *     pointer-events:none element — the disclosure must be readable, not
 *     hover-only)
 *   - the chip is IDEMPOTENT per data signature (best + history length + last
 *     point — history is append-only, so that triple fully determines the
 *     picture): once rendered, identical data never touches the DOM again, so
 *     the entrance animation runs once and there is no per-frame rebuild
 *   - the record is re-fetched after a TTL, so finishing a round and
 *     returning to the card shows the new point (no event plumbing needed)
 *   - a wiped record (Clear all / twist repair) resolves null on the next
 *     fetch and REMOVES the chip — the chart can never outlive its data
 *   - fetch failures back off for 30s instead of retrying every scroll frame
 */
window.Sparkline = (function(){
  const REFETCH_TTL = 15000; // ms a cached record stays trusted on a card
  const FAIL_BACKOFF = 30000; // ms to wait after a fetch error before retrying
  const MAX_POINTS = 12;     // chart the most recent N (history holds up to 20)
  const W = 64, H = 16, PAD = 2;

  // ---- decode a stored score into the game's real metric ----
  // Linear games store the score as-is. Inverted games (Round 14 metadata)
  // store CEILING - real, so real = CEILING - stored.
  function decode(mod, v){
    if(mod && mod.scoreEncoding === "inverted" && Number.isFinite(mod.scoreCeiling)){
      return Math.max(0, mod.scoreCeiling - v);
    }
    return v;
  }

  function fmt(n){
    if(!Number.isFinite(n)) return "0";
    if(n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if(n >= 1e4) return Math.round(n / 1e3) + "k";
    return String(Math.round(n * 10) / 10);
  }

  // Normalize points into an SVG polyline in W×H space.
  function polyline(points){
    const min = Math.min.apply(null, points);
    const max = Math.max.apply(null, points);
    const span = (max - min) || 1; // flat line (all equal scores) still renders
    const step = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
    let d = "";
    let lx = 0, ly = 0;
    points.forEach((p, i) => {
      const x = PAD + i * step;
      const y = H - PAD - ((p - min) / span) * (H - PAD * 2);
      d += (i ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      lx = x; ly = y;
    });
    // glowing dot on the most recent play
    return '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="1.8" fill="currentColor"/>';
  }

  function buildChip(mod, rec, sig, thin){
    const real = rec.history.slice(-MAX_POINTS).map(v => decode(mod, v));
    const bestReal = decode(mod, rec.best);
    const lowerBetter = !!(mod && mod.scoreEncoding === "inverted");

    // Round 26 — per-cartridge depth rides the same chip: BEST is what you
    // reached once; DEPTH is how often you play near it. Only over-runs
    // sample (Depth's contract), and no data means no readout.
    let depth = null, depthN = 0;
    try{
      if(window.Depth && Depth.avgFor){
        depth = Depth.avgFor(mod.id);
        depthN = Depth.countFor(mod.id) || 0;
      }
    }catch(e){}

    // Round 29 — the readout speaks the league's tier color (same classes the
    // drawer chips wear) and becomes the ladder's handle: role=button,
    // keyboard-operable, aria-expanded tracked by Depth's ladder state.
    const tierCls = (depth != null && window.Depth && Depth.tierFor)
      ? " " + Depth.tierFor(depth).cls : "";
    const chip = document.createElement("div");
    chip.className = "cart-sparkline" + (thin ? " cart-sparkline-thin" : "");
    chip.dataset.sig = sig;
    chip.innerHTML =
      // R36 — a record with ONE play can't draw a line, but it already earned
      // its readout: the thin chip carries BEST (+ DEPTH) without the chart
      // so every scored card speaks after its very first run — the audit's
      // "the footer exists on only ~3 cards" was exactly this gate.
      (thin ? '' :
        '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">' +
          polyline(real) +
        '</svg>') +
      '<span class="cart-sparkline-best">BEST ' + fmt(bestReal) +
        (lowerBetter ? ' <span class="cart-sparkline-note">· FEWER WINS</span>' : '') +
      '</span>' +
      (depth != null
        ? '<span class="cart-sparkline-depth' + tierCls + '" role="button" tabindex="0"' +
          ' aria-haspopup="dialog" aria-expanded="false"' +
          ' title="Depth ' + depth + '% of your best · tap for the ladder">· DEPTH ' + depth + '%' +
          // Round 30 — the affordance becomes VISIBLE: a chevron that flips
          // with aria-expanded (down = opens the ladder, up = it's open).
          // Glyph-free (border-drawn) so it can't rasterize differently
          // across CRT skins, and it inherits the tier hue via currentColor.
          '<i class="depth-chev" aria-hidden="true"></i></span>'
        : '');
    // "lower is better" only reads honestly if we also say what the chart is
    const n = real.length;
    chip.title = "Your last " + n + " play" + (n > 1 ? "s" : "") +
      " of " + (mod.title || mod.id) +
      (lowerBetter ? " — fewer moves/faster wins, so a dip is good" : " — higher is better") +
      (depth != null ? " · your last " + depthN + " finished runs averaged " + depth + "% of your best" : "");
    // role=group (not img): the chip now CONTAINS a real button — role=img
    // would presentationalize its subtree and hide the ladder handle from AT.
    chip.setAttribute("role", "group");
    chip.setAttribute("aria-label",
      "Recent scores for " + (mod.title || mod.id) + ": last " + n + " plays, best " + fmt(bestReal) +
      (lowerBetter ? " (lower is better on this one)" : "") +
      (depth != null ? ", average run depth " + depth + "%" : ""));
    // Round 29 — the readout opens the depth ladder (pointer or keyboard).
    // Toggle semantics live in Depth (it owns the one-open-at-a-time state);
    // the chip only routes the intent with its card + game.
    const readout = chip.querySelector(".cart-sparkline-depth");
    if(readout){
      const openLadder = () => {
        try{
          if(window.Depth && Depth.toggleLadder){
            Depth.toggleLadder(chip.closest(".cart"), mod);
          }
        }catch(e){}
      };
      readout.addEventListener("click", openLadder);
      readout.addEventListener("keydown", (e) => {
        if(e.key === "Enter" || e.key === " "){ e.preventDefault(); openLadder(); }
      });
    }
    return chip;
  }

  // Identity of the rendered picture: history is append-only, so best +
  // length + last point pin it UNTIL the 20-cap window starts shifting —
  // a new play at the cap (concat + slice(-20)) can tie the previous score
  // without changing best, leaving the triple identical over a DIFFERENT
  // 12-point picture. The window's first drawn point closes that hole.
  // Round 26: the depth readout lives on this chip, so its avg + sample
  // count join the signature — a new run re-grades the chip even when the
  // score history itself didn't move.
  function signature(mod, rec){
    const h = (rec && Array.isArray(rec.history)) ? rec.history : [];
    const firstDrawn = h.length > MAX_POINTS ? h[h.length - MAX_POINTS] : (h.length ? h[0] : "");
    let d = "";
    try{
      if(window.Depth && Depth.avgFor){
        const avg = Depth.avgFor(mod.id);
        d = "|" + (avg == null ? "-" : avg) + "/" + Depth.countFor(mod.id);
      }
    }catch(e){}
    return mod.id + "|" + (rec ? rec.best : 0) + "|" + h.length + "|" + (h.length ? h[h.length - 1] : "") + "|" + firstDrawn + d;
  }

  // Called by app.js on every scroll frame for the CENTERED card. Three
  // guards keep it cheap: (1) signature idempotence — matching data never
  // rebuilds the DOM; (2) a TTL cache — one IndexedDB read at most every
  // 15s per card; (3) an in-flight lock + 30s failure backoff — a slow or
  // erroring read can't stack one fetch per scroll frame. The async render
  // can never mislabel a card: data is applied only to the element it was
  // fetched for, and belongs to that card's own game id regardless of when
  // it lands.
  function badge(cartEl, mod){
    if(!cartEl || !mod || !window.StripDB || !StripDB.getScoreRecord) return;
    const cached = cartEl._sparkRec;
    const fresh = cached && cached.id === mod.id && (Date.now() - cached.at) < REFETCH_TTL;

    if(fresh){
      apply(cartEl, mod, cached.rec);
      return;
    }
    if(cartEl._sparkBusy) return;
    if(Date.now() - (cartEl._sparkFailAt || 0) < FAIL_BACKOFF) return;
    cartEl._sparkBusy = true;
    StripDB.getScoreRecord(mod.id).then(rec => {
      cartEl._sparkRec = { id: mod.id, rec: rec, at: Date.now() };
      cartEl._sparkFailAt = 0;
      apply(cartEl, mod, rec);
    }).catch(() => {
      cartEl._sparkFailAt = Date.now();
    }).then(() => { cartEl._sparkBusy = false; });
  }

  function apply(cartEl, mod, rec){
    const existing = cartEl.querySelector(".cart-sparkline");
    if(!rec || !Array.isArray(rec.history) || rec.history.length < 2){
      // R36 — ONE play still earns the readout: a real best with a too-thin
      // history renders the chart-less chip. Zero data (never played, or the
      // record was wiped) still removes the chip — absence stays honest.
      if(rec && rec.best > 0){
        const sig = "thin|" + signature(mod, rec);
        if(existing && existing.dataset.sig === sig){ syncLadderAria(cartEl); return; }
        const chip = buildChip(mod, rec, sig, true);
        if(existing) existing.replaceWith(chip);
        else{
          const inner = cartEl.querySelector(".cart-inner");
          if(inner) inner.appendChild(chip);
        }
        syncLadderAria(cartEl);
        return;
      }
      if(existing){
        existing.remove(); // record gone (wipe/repair) or too thin to chart
        // Round 29 — a ladder anchored to a readout that no longer exists
        // closes instead of drifting (honest absence, everywhere).
        if(cartEl.querySelector(".depth-ladder") && window.Depth && Depth.closeLadders){
          Depth.closeLadders({ restoreFocus: false });
        }
      }
      return;
    }
    const sig = signature(mod, rec);
    if(existing && existing.dataset.sig === sig){
      // Round 30 — even a true no-op rebuild must not outlive its aria
      // state: if the ladder is open on this card, the handle says so.
      syncLadderAria(cartEl);
      return; // DOM already correct — true no-op
    }
    if(existing){
      existing.replaceWith(buildChip(mod, rec, sig));
      syncLadderAria(cartEl);
      return;
    }
    const inner = cartEl.querySelector(".cart-inner");
    if(inner){
      inner.appendChild(buildChip(mod, rec, sig));
      syncLadderAria(cartEl);
    }
  }

  // Round 30 — a chip rebuilt while its ladder is open (live refresh path:
  // the shell busts the cache, badge() rebuilds, refreshLadder moves the
  // panel) would otherwise boot with the markup-default aria-expanded=false
  // while the panel it owns is on screen — and the new chevron would point
  // the wrong way. Depth owns the truth; we only mirror it.
  function syncLadderAria(cartEl){
    try{
      if(!window.Depth || !Depth.ladderOn || !Depth.ladderOn(cartEl)) return;
      const r = cartEl.querySelector(".cart-sparkline-depth");
      if(r) r.setAttribute("aria-expanded", "true");
    }catch(e){}
  }

  return { badge };
})();
