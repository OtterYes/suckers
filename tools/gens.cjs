#!/usr/bin/env node
// Checks the procedural question generators (MGEN) without a browser.
//
//   node tools/gens.cjs            golden compare + fuzz + lesson coverage
//   node tools/gens.cjs --capture  (re)write tools/fixtures/gens-golden.json from the templates listed in it plus any new ones
//
// Golden: a saved blind spot replays a generator from its (template id, lv, seed). If a template's output for a seed ever
// changes, every saved spot on it silently turns into a different question. So the output of every template for 25
// fixed seeds is pinned here, byte for byte. New templates are added to the golden file with --capture; existing entries
// are never rewritten by --capture unless --force is given.
"use strict";
process.env.TZ = "UTC";
const fs = require("fs"), path = require("path");
const { loadEngine } = require("./engine.cjs");
const GOLD = path.join(__dirname, "fixtures", "gens-golden.json");
const SEEDS = 25, FUZZ = 200, MIN_OK = 0.9;
const E = loadEngine();
const MGEN = E.MGEN;
const args = process.argv.slice(2), capture = args.includes("--capture"), force = args.includes("--force");
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL " + m); } };

function run(id, lv, seed) {
  const it = MGEN[id].fn(E.mulberry32(seed), lv);
  if (!it) return null;
  return { lv: it.lv, stem: it.stem, passage: it.passage, tb: it.tb, c: it.c, a: it.a, spr: it.spr ? it.spr.vals : undefined, x: it.x, t: it.t, des: it.des };
}
function fixedSeeds(id) { const out = []; let s = 7; for (let i = 0; i < SEEDS; i++) { s = (s * 48271) % 2147483647; out.push(s); } return out; }

// 1. Golden.
let gold = fs.existsSync(GOLD) ? JSON.parse(fs.readFileSync(GOLD, "utf8")) : {};
if (capture) {
  Object.keys(MGEN).sort().forEach(id => {
    if (gold[id] && !force) return;
    gold[id] = {};
    MGEN[id].lvs.forEach(lv => { gold[id][lv] = fixedSeeds(id).map(seed => [seed, run(id, lv, seed)]); });
  });
  fs.writeFileSync(GOLD, JSON.stringify(gold) + "\n");
  console.log("captured " + Object.keys(gold).length + " templates into " + path.relative(process.cwd(), GOLD));
}
let drift = 0;
Object.keys(gold).forEach(id => {
  if (!MGEN[id]) { ok(false, "template " + id + " was removed (saved blind spots on it would be dropped)"); return; }
  Object.keys(gold[id]).forEach(lv => gold[id][lv].forEach(([seed, want]) => {
    const got = run(id, +lv, seed);
    if (JSON.stringify(got) !== JSON.stringify(want)) { drift++; if (drift <= 5) console.log("DRIFT " + id + " lv" + lv + " seed " + seed); }
  }));
});
ok(drift === 0, drift + " golden outputs changed; existing templates must not be edited (add new ids instead)");
Object.keys(MGEN).forEach(id => ok(gold[id], "template " + id + " has no golden entry; run: node tools/gens.cjs --capture"));

// 2. Fuzz.
Object.keys(MGEN).sort().forEach(id => {
  const T = MGEN[id];
  ok(T.lvs.length && T.lvs.every(l => [1, 2, 3].includes(l)), id + ": lvs must be within 1..3");
  ok(E.DOMAINS[T.d] && E.DOMAINS[T.d].skills.includes(T.sk), id + ": sk '" + T.sk + "' is not a skill of " + T.d);
  T.lvs.forEach(lv => {
    let n = 0, bad = 0;
    for (let seed = 1; seed <= FUZZ; seed++) {
      const it = MGEN[id].fn(E.mulberry32(seed), lv);
      if (!it) continue;
      n++;
      const again = MGEN[id].fn(E.mulberry32(seed), lv);
      const txt = JSON.stringify(it);
      const problems = [];
      if (JSON.stringify(again) !== txt) problems.push("not deterministic");
      if (![1, 2, 3].includes(it.lv)) problems.push("bad lv " + it.lv);
      if (!it.stem || typeof it.stem !== "string") problems.push("no stem");
      if (/NaN|undefined|\[object/.test(txt)) problems.push("NaN/undefined in output");
      if (it.spr) { if (!it.spr.vals || !it.spr.vals.length || !it.spr.vals.every(v => Number.isFinite(v))) problems.push("bad spr.vals"); if (it.c) problems.push("both c and spr"); }
      else {
        if (!Array.isArray(it.c) || it.c.length !== 4) problems.push("choices != 4");
        else if (new Set(it.c).size !== 4) problems.push("duplicate choices");
        if (!(Number.isInteger(it.a) && it.a >= 0 && it.a <= 3)) problems.push("bad a");
      }
      if (typeof it.x !== "string" || !it.x) problems.push("no x");
      if (problems.length) { bad++; if (bad <= 2) console.log("  " + id + " lv" + lv + " seed " + seed + ": " + problems.join(", ")); }
    }
    ok(n / FUZZ >= MIN_OK, id + " lv" + lv + ": only " + n + "/" + FUZZ + " seeds produced a question");
    ok(bad === 0, id + " lv" + lv + ": " + bad + " bad outputs");
  });
});

// 3. Lesson coverage (once MGEN_LESSON exists): every math skill x lesson needs at least two distinct sources.
if (E.MGEN_LESSON || (E.MATH_STATIC && E.MATH_STATIC.some(m => m.lesson))) {
  const src = {};
  Object.keys(MGEN).forEach(id => { const l = E.MGEN_LESSON && E.MGEN_LESSON[id]; if (l) { const k = MGEN[id].d + "|" + MGEN[id].sk + "|" + l; (src[k] = src[k] || new Set()).add(id); } });
  (E.MATH_STATIC || []).forEach(m => { if (m.lesson) { const k = m.d + "|" + m.sk + "|" + m.lesson; (src[k] = src[k] || new Set()).add(m.id); } });
  const M_KEYS = ["alg", "adv", "psda", "geo"];
  M_KEYS.forEach(d => E.DOMAINS[d].skills.forEach(sk => {
    const n = E.SK_LESSONS && E.SK_LESSONS[d + "|" + sk] ? E.SK_LESSONS[d + "|" + sk].length : 0;
    for (let l = 1; l <= n; l++) { const k = d + "|" + sk + "|" + l; ok(src[k] && src[k].size >= 2, k + ": " + (src[k] ? src[k].size : 0) + " source(s), needs 2"); }
  }));
  Object.keys(MGEN).forEach(id => ok(E.MGEN_LESSON && E.MGEN_LESSON[id], id + ": no lesson in MGEN_LESSON"));
}

console.log((fail ? fail + " failed" : "all generator checks passed") + " (" + Object.keys(MGEN).length + " templates)");
process.exit(fail ? 1 : 0);
