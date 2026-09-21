#!/usr/bin/env node
/**
 * R36 codemod — convert hand-rolled game stat headers to the shell-owned
 * stat row (api.setStats). Handles the deck's dominant "Pattern A":
 *
 *   const statRow = document.createElement("div");
 *   statRow.style.cssText = "display:flex; ...";
 *   statRow.innerHTML = '<div>LABEL <span id="xx-key" style="color:var(--c)">v</span></div>' ...
 *   wrap.appendChild(statRow);
 *
 * Replacement keeps the old span ids as value keys so update sites become
 * pure find/replace:
 *
 *   q("#xx-key").textContent = expr;  ->  statVals["xx-key"] = expr; renderStats();
 *
 * Everything it cannot prove safe is left untouched and REPORTED as MANUAL.
 * Usage: node r36_statrow_codemod.js <gameId> [gameId2 ...]
 */
const fs = require("fs");
const path = require("path");
const GAMES_DIR = "/home/z/my-project/strip/js/games";

function convert(id){
  const file = path.join(GAMES_DIR, id + ".js");
  let src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");

  // ---- 1. locate the statRow block --------------------------------------
  const startIdx = lines.findIndex(l => /const\s+statRow\s*=\s*document\.createElement\("div"\)/.test(l));
  if(startIdx === -1){
    return { id, ok: false, reason: "no statRow creation found (convert manually)" };
  }
  let endIdx = -1;
  for(let i = startIdx + 1; i < Math.min(lines.length, startIdx + 40); i++){
    const l = lines[i];
    if(/^\s*\w+\.appendChild\(statRow\);\s*$/.test(l)){ endIdx = i; break; }
    if(/^\s*statRow\.style\.cssText/.test(l)) continue;
    if(/^\s*statRow\.innerHTML\s*=/.test(l)){
      while(i < lines.length && !/;\s*$/.test(lines[i])) i++;
      continue;
    }
    if(/^\s*\/\/.*$/.test(l) || /^\s*$/.test(l)) continue;
    return { id, ok: false, reason: "unexpected line in statRow block: " + l.trim().slice(0, 80) };
  }
  if(endIdx === -1) return { id, ok: false, reason: "no appendChild(statRow) found" };

  // ---- 2. extract the innerHTML statement text ---------------------------
  const block = lines.slice(startIdx, endIdx + 1).join("\n");
  const innerMatch = block.match(/statRow\.innerHTML\s*=([\s\S]*?);\s*\n/);
  if(!innerMatch) return { id, ok: false, reason: "no statRow.innerHTML statement" };
  const innerTpl = innerMatch[1];

  // ---- 3. parse stats out of the template --------------------------------
  const statRe = /<div>\s*([^<>]*?)\s*<span(?:\s+id="([\w-]+)")?\s+style="([^"]*)"\s*>([^<]*)<\/span><\/div>/g;
  const stats = [];
  let m;
  while((m = statRe.exec(innerTpl)) !== null){
    const label = m[1].trim();
    const sid = m[2] || null;
    const colorM = m[3].match(/color:\s*([^;"]+)/);
    const color = colorM ? colorM[1].trim() : "";
    let init = m[4];
    let initExpr;
    const tpl = init.match(/^\$\{([\s\S]+)\}$/);
    if(tpl) initExpr = "String(" + tpl[1].trim() + ")";
    else initExpr = JSON.stringify(init);
    stats.push({ label, sid, color, initExpr });
  }
  if(!stats.length) return { id, ok: false, reason: "no stat spans parsed from innerHTML" };
  const residue = innerTpl.replace(statRe, "").replace(/[\s'"+`]/g, "");
  if(residue.length) return { id, ok: false, reason: "unparsed template residue: " + residue.slice(0, 90) };

  // ---- 4. collision check -------------------------------------------------
  for(const n of ["statVals", "STAT_KEYS", "renderStats"]){
    const re = new RegExp("\\b" + n + "\\b");
    if(re.test(src.replace(block, ""))) return { id, ok: false, reason: "identifier collision: " + n };
  }

  // ---- 5. build the replacement ------------------------------------------
  const valKeys = stats.filter(s => s.sid);
  const rep = [];
  rep.push("    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between");
  rep.push("    // title and playfield, one type scale, tabular nums, <=4 stats. The old");
  rep.push("    // header's span ids live on as value keys so update sites stay one-liners.");
  rep.push("    const statVals = {");
  valKeys.forEach(s => rep.push("      " + JSON.stringify(s.sid) + ": " + s.initExpr + ","));
  rep.push("    };");
  rep.push("    const STAT_KEYS = [");
  stats.forEach(s => {
    rep.push("      [" + JSON.stringify(s.sid) + ", " + JSON.stringify(s.label) + ", " + JSON.stringify(s.color) + ", " + (s.sid ? "null" : s.initExpr) + "],");
  });
  rep.push("    ];");
  rep.push("    function renderStats(){");
  rep.push("      api.setStats(STAT_KEYS.map(([k, label, color, fixed]) => ({");
  rep.push("        label,");
  rep.push("        value: k ? statVals[k] : fixed,");
  rep.push("        color,");
  rep.push("      })));");
  rep.push("    }");
  rep.push("    renderStats();");

  // ---- 6. splice + rewrite update sites ----------------------------------
  lines.splice(startIdx, endIdx - startIdx + 1, rep.join("\n"));
  let out = lines.join("\n");

  let rewritten = 0;
  const manual = [];
  for(const s of valKeys){
    const rid = s.sid;
    const re = new RegExp("(\\w+)\\(\"#" + rid + "\"\\)\\.textContent\\s*=\\s*([^;\\n]+);", "g");
    out = out.replace(re, (full, helper, expr) => {
      rewritten++;
      return 'statVals[' + JSON.stringify(rid) + '] = ' + expr + '; renderStats();';
    });
    const leftRe = new RegExp('["\']#' + rid + '["\']', "g");
    let lm;
    while((lm = leftRe.exec(out)) !== null){
      const lineNo = out.slice(0, lm.index).split("\n").length;
      const line = out.split("\n")[lineNo - 1].trim();
      if(!/statVals/.test(line)) manual.push(lineNo + "  " + line.slice(0, 110));
    }
  }

  fs.writeFileSync(file, out, "utf8");
  return { id, ok: true, stats: stats.length, rewritten, manual };
}

const ids = process.argv.slice(2);
const results = ids.map(convert);
for(const r of results){
  if(r.ok){
    console.log("OK     " + r.id + "  stats:" + r.stats + "  rewritten:" + r.rewritten);
    r.manual.forEach(x => console.log("       MANUAL " + x));
  } else {
    console.log("SKIP   " + r.id + "  -- " + r.reason);
  }
}
