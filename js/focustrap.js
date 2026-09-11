/**
 * STRIP — Focus Trap (Round 13)
 * -----------------------------
 * Shared keyboard containment for the three sheets (cartridge drawer,
 * settings, trophy case). Round 12 gave every sheet focus-in/focus-out
 * parity, but Tab at the last control still escaped into the page behind
 * the modal overlay — focus could land on HUD buttons or (worse) the strip
 * itself while a sheet was visually on top. This completes the dialog
 * contract: Tab / Shift+Tab cycle inside the open sheet.
 *
 * Usage:  FocusTrap.attach(rootEl, isOpenFn);
 * No detach needed — sheets are singletons that live for the page's life;
 * the keydown handler ignores registrations whose isOpenFn() is false.
 */
window.FocusTrap = (function(){
  const traps = []; // { root, isOpen } — registration order = sheet stacking order

  const SELECTOR = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

  function focusables(root){
    return Array.from(root.querySelectorAll(SELECTOR)).filter(el => {
      if(el.disabled || el.getAttribute("aria-disabled") === "true") return false;
      if(el.closest("[hidden]")) return false;
      // display:none subtrees have empty client rects (critic NIT-9: the
      // settings sheet's hidden install button used to be counted)
      if(el.getClientRects().length === 0) return false;
      return true;
    });
  }

  function onKeydown(e){
    if(e.key !== "Tab") return;
    // don't fight genuine tab-stops inside a modifier chord (Ctrl+Tab = new
    // browser tab in most browsers anyway, but never trap it here)
    if(e.ctrlKey || e.altKey || e.metaKey) return;
    // last-open wins (only one sheet is ever open in practice; if two ever
    // overlap the one opened later sits on top)
    let trap = null;
    for(const t of traps){ if(t.isOpen()) trap = t; }
    if(!trap) return;

    const list = focusables(trap.root);
    if(!list.length){ e.preventDefault(); return; }

    const first = list[0];
    const last = list[list.length - 1];
    const idx = list.indexOf(document.activeElement);

    if(idx === -1){
      // focus is outside the open sheet (alt-tab back, programmatic drift):
      // pull it back in at the natural edge
      e.preventDefault();
      (e.shiftKey ? last : first).focus({ preventScroll: true });
      return;
    }
    if(e.shiftKey && idx === 0){
      e.preventDefault();
      last.focus({ preventScroll: true });
      return;
    }
    if(!e.shiftKey && idx === list.length - 1){
      e.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    // mid-list: the browser's native Tab order already stays inside the sheet
  }

  document.addEventListener("keydown", onKeydown, true); // capture: beat page-level handlers

  return {
    attach(root, isOpen){
      if(!root || typeof isOpen !== "function") return;
      if(!traps.some(t => t.root === root)) traps.push({ root, isOpen });
    }
  };
})();
