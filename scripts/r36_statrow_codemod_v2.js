#!/usr/bin/env node
/**
 * R36 codemod v2 — handles the patterns v1 SKIPped:
 *  (a) statRow created empty, innerHTML assigned LATER (statUpdate-style)
 *  (b) other DOM lines interleaved between statRow creation and appendChild
 *  (c) templates without span ids (breakout-style full rebuilds) — keyed by label
 *
 * The later innerHTML statement becomes a syncStats36() call IN PLACE (control
 * flow preserved); the machinery lands at the creation point. Everything
 * unprovable is left untouched and reported MANUAL.
 */
const fs = require("fs");
const path = require("path");
const GAMES_DIR = "/home/z/my-project/strip/js/games";

function convert(id){
  const file = path.join(GAMES_DIR, id + ".js");
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");

  const startIdx = lines.findIndex(l => /const\s+statRow\s*=\s*document\.createElement\("div"\)/.test(l));
  if(startIdx === -1) return { id, ok: false, reason: "no statRow creation" };

  for(const n of ["statVals", "STAT_KEYS", "renderStats", "syncStats36"]){
    if(new RegExp("\\b" + n + "\\b").test(src)) return { id, ok: false, reason: "already converted / collision: " + n };
  }

  // ---- collect statRow-related edits (original line indices) -------------
  const edits = []; // { start, end, kind }  kind: create | css | inner | append
  for(let i = 0; i < lines.length; i++){
    const l = lines[i];
    if(/^\s*const\s+statRow\s*=\s*document\.createElement\("div"\);\s*$/.test(l)){
      edits.push({ start: i, end: i + 1, kind: "create" });
    } else if(/^\s*statRow\.style\.cssText\s*=/.test(l)){
      edits.push({ start: i, end: i + 1, kind: "css" });
    } else if(/^\s*statRow\.innerHTML\s*=/.test(l)){
      let j = i;
      while(j < lines.length && !/;\s*$/.test(lines[j])) j++;
      edits.push({ start: i, end: j + 1, kind: "inner", tpl: lines.slice(i, j + 1).join("\n").replace(/^\s*statRow\.innerHTML\s*=/, "").replace(/;\s*$/, "") });
      i = j;
    } else if(/^\s*\w+\.appendChild\(statRow\);\s*$/.test(l)){
      edits.push({ start: i, end: i + 1, kind: "append" });
    }
  }
  const stmt = edits.find(e => e.kind === "inner");
  if(!stmt) return { id, ok: false, reason: "no statRow.innerHTML statements found" };

  // ---- parse spans --------------------------------------------------------
  const statRe = /<div>\s*([^<>]*?)\s*<span(?:\s+id="([\w-]+)")?\s+style="([^"]*)"\s*>([^<]*)<\/span><\/div>/g;
  const stats = [];
  let m;
  const tpl = stmt.tpl;
  while((m = statRe.exec(tpl)) !== null){
    const label = m[1].trim();
    const sid = m[2] || null;
    const colorM = m[3].match(/color:\s*([^;"]+)/);
    const color = colorM ? colorM[1].trim() : "";
    const initRaw = m[4];
    const tplExpr = initRaw.match(/^\$\{([\s\S]+)\}$/);
    stats.push({ label, sid, color, initRaw, tplExpr: tplExpr ? tplExpr[1].trim() : null });
  }
  if(!stats.length) return { id, ok: false, reason: "no stat spans parsed" };
  const residue = tpl.replace(statRe, "").replace(/[\s'"+`]/g, "");
  if(residue.length) return { id, ok: false, reason: "residue: " + residue.slice(0, 90) };

  const keyOf = s => s.sid || s.label;

  // ---- machinery ----------------------------------------------------------
  const indent = (lines[startIdx].match(/^\s*/) || [""])[0];
  const rep = [];
  rep.push(indent + "// R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between");
  rep.push(indent + "// title and playfield, one type scale, tabular nums, <=4 stats. The old");
  rep.push(indent + "// header's keys live on so update sites stay one-liners.");
  rep.push(indent + "const statVals = {");
  stats.forEach(s => {
    rep.push(indent + "  " + JSON.stringify(keyOf(s)) + ": " + (s.tplExpr ? '""' : JSON.stringify(s.initRaw)) + ",");
  });
  rep.push(indent + "};");
  rep.push(indent + "const STAT_KEYS = [");
  stats.forEach(s => {
    rep.push(indent + "  [" + JSON.stringify(keyOf(s)) + ", " + JSON.stringify(s.label) + ", " + JSON.stringify(s.color) + "],");
  });
  rep.push(indent + "];");
  rep.push(indent + "function renderStats(){");
  rep.push(indent + "  api.setStats(STAT_KEYS.map(([k, label, color]) => ({ label, value: statVals[k], color })));");
  rep.push(indent + "}");
  const assignParts = stats.filter(s => s.tplExpr).map(s => "statVals[" + JSON.stringify(keyOf(s)) + "] = " + s.tplExpr + ";");
  rep.push(indent + "function syncStats36(){ " + assignParts.join(" ") + "renderStats(); }");
  rep.push(indent + "renderStats();");
  const syncCall = indent + "  syncStats36();";

  // ---- apply edits bottom-up (indices stay valid) --------------------------
  for(const e of edits.slice().sort((a, b) => b.start - a.start)){
    if(e.kind === "create"){
      lines.splice(e.start, 1, ...rep);
    } else if(e.kind === "inner"){
      lines.splice(e.start, e.end - e.start, syncCall); // the old write becomes the sync call, in place
    } else {
      lines.splice(e.start, e.end - e.start);           // css/append lines vanish
    }
  }
  let out = lines.join("\n");

  // ---- rewrite textContent update sites -----------------------------------
  let rewritten = 0;
  const manual = [];
  for(const s of stats){
    if(!s.sid) continue;
    const rid = s.sid;
    const re = new RegExp("(\\w+)\\(\"#" + rid + "\"\\)\\.textContent\\s*=\\s*([^;\\n]+);", "g");
    out = out.replace(re, (full, helper, expr) => {
      rewritten++;
      return "statVals[" + JSON.stringify(rid) + "] = " + expr + "; renderStats();";
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
