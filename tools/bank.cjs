#!/usr/bin/env node
// The question bank lives in bank/ and is compiled into index.html by this tool.
//
//   node tools/bank.cjs                  validate bank/, print coverage, splice the generated blocks into index.html
//   node tools/bank.cjs --check          same validation, then fail if index.html's generated blocks are out of date
//   node tools/bank.cjs --strict-lessons also require lessons.json for all 29 skills, a lesson on every item, and the
//                                        per-cell minimums (on once the authored bank has landed)
//
// Layout:
//   bank/rw/<slug>/lessons.json   the skill's lessons (name, rule, steps, cues, example, trap, stems, words, traps)
//   bank/rw/<slug>/*.json         item arrays (legacy.json holds the original 134; l<N>-<batch>.json the authored ones)
//   bank/math/<slug>/lessons.json math lessons (no item files; math questions are generated)
//   bank/math/gens/*.js           new generator templates (DEF calls), emitted verbatim after the built-in ones
//   bank/arc/words.json           Clue Hunter tuples
//   bank/legacy.json              id -> {h: content hash, i: original index}; legacy items must never change
//
// Two blocks in index.html are generated, one item per line, in a fixed order, so diffs stay readable:
//   /* ===== RW bank ... ===== */ ... /* ===== end RW bank ===== */         RW_BANK, SK_LESSONS, ARC_WORDS
//   /* ===== math generators ... ===== */ ... /* ===== end math generators ===== */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const BANK = path.join(ROOT, "bank");

const DKEYS = ["ii", "cs", "eoi", "sec", "alg", "adv", "psda", "geo"];
// Mirrors DOMAINS in index.html. code: id prefix for authored items; slug: directory name; n: lessons.
const SKILLS = [
  { d: "ii", sk: "Central Ideas and Details", code: "cid", slug: "central-ideas", n: 5, min: 24 },
  { d: "ii", sk: "Command of Evidence: Textual", code: "cet", slug: "evidence-textual", n: 5, min: 24 },
  { d: "ii", sk: "Command of Evidence: Quantitative", code: "ceq", slug: "evidence-quantitative", n: 5, min: 20, needs: "tb" },
  { d: "ii", sk: "Inferences", code: "inf", slug: "inferences", n: 5, min: 24 },
  { d: "cs", sk: "Words in Context", code: "wic", slug: "words-in-context", n: 5, min: 24 },
  { d: "cs", sk: "Text Structure and Purpose", code: "tsp", slug: "text-structure", n: 5, min: 20, needs: "u" },
  { d: "cs", sk: "Cross-Text Connections", code: "ctc", slug: "cross-text", n: 3, min: 15, needs: "p2" },
  { d: "eoi", sk: "Transitions", code: "tr", slug: "transitions", n: 5, min: 24 },
  { d: "eoi", sk: "Rhetorical Synthesis", code: "rs", slug: "rhetorical-synthesis", n: 5, min: 20, needs: "n" },
  { d: "sec", sk: "Boundaries", code: "bnd", slug: "boundaries", n: 5, min: 24 },
  { d: "sec", sk: "Form, Structure, and Sense", code: "fss", slug: "form-structure-sense", n: 5, min: 24 },
  { d: "alg", sk: "Linear equations in one variable", code: "lin1", slug: "lin-one-var", n: 3 },
  { d: "alg", sk: "Linear functions", code: "lfn", slug: "linear-functions", n: 3 },
  { d: "alg", sk: "Linear equations in two variables", code: "lin2", slug: "lin-two-var", n: 3 },
  { d: "alg", sk: "Systems of two linear equations", code: "sys", slug: "systems", n: 3 },
  { d: "alg", sk: "Linear inequalities", code: "ineq", slug: "inequalities", n: 3 },
  { d: "adv", sk: "Nonlinear functions", code: "nlf", slug: "nonlinear-functions", n: 3 },
  { d: "adv", sk: "Nonlinear equations", code: "nle", slug: "nonlinear-equations", n: 3 },
  { d: "adv", sk: "Equivalent expressions", code: "eqx", slug: "equivalent-expressions", n: 3 },
  { d: "psda", sk: "Ratios, rates, proportions, and units", code: "rat", slug: "ratios-rates", n: 3 },
  { d: "psda", sk: "Percentages", code: "pct", slug: "percentages", n: 3 },
  { d: "psda", sk: "One-variable data", code: "ovd", slug: "one-var-data", n: 3 },
  { d: "psda", sk: "Two-variable data", code: "tvd", slug: "two-var-data", n: 3 },
  { d: "psda", sk: "Probability", code: "prb", slug: "probability", n: 3 },
  { d: "psda", sk: "Inference from sample statistics", code: "ist", slug: "inference-stats", n: 3 },
  { d: "geo", sk: "Area and volume", code: "avol", slug: "area-volume", n: 3 },
  { d: "geo", sk: "Lines, angles, and triangles", code: "lat", slug: "lines-angles", n: 3 },
  { d: "geo", sk: "Right triangles and trigonometry", code: "rtt", slug: "right-triangles-trig", n: 3 },
  { d: "geo", sk: "Circles", code: "cir", slug: "circles", n: 3 },
];
const RW = SKILLS.filter(s => ["ii", "cs", "eoi", "sec"].includes(s.d));
const RESERVED = ["cb", "im", "ai", "ms", "ii", "cs", "eo", "se"];
const ID_RE = /^[a-z]{2,4}-l[1-5][a-z]-\d{2}$/;
const ITEM_KEYS = ["id", "d", "sk", "lv", "lesson", "tags", "p", "p2", "tb", "n", "goal", "q", "c", "a", "x", "t"];
const HASH_KEYS = ["d", "sk", "lv", "p", "p2", "q", "tb", "n", "goal", "c", "a", "x", "t"];
const M_START = "/* ===== RW bank (generated by tools/bank.cjs from bank/; edit bank/, not this block) ===== */";
const M_END = "/* ===== end RW bank ===== */";
const G_START = "/* ===== math generators (generated by tools/bank.cjs from bank/math/gens; edit bank/, not this block) ===== */";
const G_END = "/* ===== end math generators ===== */";
const UI_MARK = "/* ===== UI ===== */";
const BLOCK_BUDGET = 1.0e6, FILE_BUDGET = 2.2e6;
// Question wordings the game supplies when an item has no q. Items for these skills may omit q.
const DEFAULT_Q = ["Central Ideas and Details", "Inferences", "Words in Context", "Transitions", "Boundaries", "Form, Structure, and Sense"];

function itemHash(it) {
  const o = {}; HASH_KEYS.forEach(k => { if (it[k] !== undefined) o[k] = it[k]; });
  return crypto.createHash("sha1").update(JSON.stringify(o)).digest("hex");
}
function words(s) { return String(s || "").trim() ? String(s).trim().split(/\s+/).length : 0; }
function shingles(s) {
  const w = String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean), out = new Set();
  for (let i = 0; i + 3 <= w.length; i++) out.add(w.slice(i, i + 3).join(" "));
  return out;
}
function jaccard(a, b) { let n = 0; a.forEach(x => { if (b.has(x)) n++; }); const u = a.size + b.size - n; return u ? n / u : 0; }
function itemText(it) { return [it.p, it.p2, (it.n || []).join(" "), it.goal, it.q].filter(Boolean).join(" "); }
function bad(s) { return /<\/script|<!--|<script/i.test(s) || /\/\* ===== (UI|RW bank|end RW bank|math generators|end math generators)/.test(s); }
function walkStrings(v, fn) { if (typeof v === "string") fn(v); else if (Array.isArray(v)) v.forEach(x => walkStrings(x, fn)); else if (v && typeof v === "object") Object.keys(v).forEach(k => walkStrings(v[k], fn)); }
function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { throw new Error(f + ": " + e.message); } }
function listDirs(d) { return fs.existsSync(d) ? fs.readdirSync(d).filter(n => fs.statSync(path.join(d, n)).isDirectory()).sort() : []; }
function emitJSON(v) { return JSON.stringify(v).replace(/<\//g, "<\\/"); }
function orderedItem(it) { const o = {}; ITEM_KEYS.forEach(k => { if (it[k] !== undefined) o[k] = it[k]; }); return o; }

function load() {
  const errors = [], warns = [];
  const err = (f, m) => errors.push(f + ": " + m);
  const legacy = fs.existsSync(path.join(BANK, "legacy.json")) ? readJSON(path.join(BANK, "legacy.json")) : {};
  const lessons = {};   // "d|Skill" -> array
  const items = [];     // {it, file}
  const seenIds = new Map();
  const gens = [];      // {name, src}
  let arcWords = [];

  // Lessons for every skill (rw and math).
  SKILLS.forEach(s => {
    const f = path.join(BANK, s.d === "alg" || s.d === "adv" || s.d === "psda" || s.d === "geo" ? "math" : "rw", s.slug, "lessons.json");
    if (!fs.existsSync(f)) return;
    const L = readJSON(f);
    if (!Array.isArray(L) || L.length !== s.n) err(f, "expected " + s.n + " lessons, got " + (Array.isArray(L) ? L.length : typeof L));
    (Array.isArray(L) ? L : []).forEach((l, i) => {
      const at = "lesson " + (i + 1);
      if (!l || typeof l.name !== "string" || !l.name.trim()) err(f, at + ": name required");
      if (typeof l.rule !== "string" || !l.rule.trim()) err(f, at + ": rule required");
      if (!Array.isArray(l.steps) || l.steps.length < 2 || l.steps.length > 3) err(f, at + ": steps must have 2-3 entries");
      if (!Array.isArray(l.cues) || l.cues.length !== 3) err(f, at + ": cues must have 3 entries");
      if (!l.example || typeof l.example !== "object") err(f, at + ": example required");
      else if (RW.includes(s) && (!Array.isArray(l.example.c) || l.example.c.length !== 4 || typeof l.example.a !== "number" || !l.example.x)) err(f, at + ": example needs c[4], a, x");
      if (!l.trap || typeof l.trap.why !== "string") err(f, at + ": trap {c, why} required");
      if (RW.includes(s)) {
        if (!Array.isArray(l.stems) || !l.stems.length) err(f, at + ": stems[] required");
        if (!Array.isArray(l.words) || l.words.length !== 2 || !(l.words[0] < l.words[1])) err(f, at + ": words [min,max] required");
        if (!Array.isArray(l.traps) || !l.traps.length) err(f, at + ": traps[] required");
      }
      walkStrings(l, str => { if (bad(str)) err(f, at + ": forbidden markup in text"); });
    });
    lessons[s.d + "|" + s.sk] = L;
  });

  // Items.
  listDirs(path.join(BANK, "rw")).forEach(slug => {
    const s = RW.find(x => x.slug === slug);
    const dir = path.join(BANK, "rw", slug);
    if (!s) { err(dir, "unknown skill directory"); return; }
    fs.readdirSync(dir).filter(n => n.endsWith(".json") && n !== "lessons.json").sort().forEach(name => {
      const f = path.join(dir, name);
      const arr = readJSON(f);
      if (!Array.isArray(arr)) { err(f, "must be an array of items"); return; }
      const batch = name.match(/^l([1-5])-([a-z])\.json$/);
      arr.forEach((it, i) => {
        const at = "item " + i + (it && it.id ? " (" + it.id + ")" : "");
        if (!it || typeof it !== "object") { err(f, at + ": not an object"); return; }
        Object.keys(it).forEach(k => { if (!ITEM_KEYS.includes(k)) err(f, at + ": unknown key " + k); });
        if (typeof it.id !== "string") { err(f, at + ": id required"); return; }
        if (seenIds.has(it.id)) err(f, at + ": duplicate id (also in " + seenIds.get(it.id) + ")");
        seenIds.set(it.id, f);
        const isLegacy = Object.prototype.hasOwnProperty.call(legacy, it.id);
        if (isLegacy) {
          if (legacy[it.id].h !== itemHash(it)) err(f, at + ": legacy item content changed (only lesson/tags may be added)");
        } else {
          if (!ID_RE.test(it.id)) err(f, at + ": id must match " + ID_RE);
          else {
            const code = it.id.split("-")[0];
            if (code !== s.code) err(f, at + ": id code '" + code + "' is not this skill's code '" + s.code + "'");
            if (RESERVED.includes(code)) err(f, at + ": id uses a reserved prefix");
            if (batch && (it.id.slice(code.length + 1, code.length + 4) !== "l" + batch[1] + batch[2])) err(f, at + ": id does not match the file's lesson/batch " + batch[1] + batch[2]);
          }
        }
        if (it.d !== s.d || it.sk !== s.sk) err(f, at + ": d/sk must be " + s.d + " / " + s.sk);
        if (![1, 2, 3].includes(it.lv)) err(f, at + ": lv must be 1, 2 or 3");
        if (it.lesson !== undefined && !(Number.isInteger(it.lesson) && it.lesson >= 1 && it.lesson <= s.n)) err(f, at + ": lesson must be 1.." + s.n);
        if (batch && it.lesson !== undefined && it.lesson !== +batch[1]) err(f, at + ": lesson " + it.lesson + " in a lesson-" + batch[1] + " file");
        if (it.tags !== undefined && (!Array.isArray(it.tags) || it.tags.some(t => typeof t !== "string"))) err(f, at + ": tags must be strings");
        if (!Array.isArray(it.c) || it.c.length !== 4 || it.c.some(c => typeof c !== "string" || !c.trim())) err(f, at + ": c must be 4 non-empty strings");
        else {
          if (new Set(it.c.map(c => c.trim().toLowerCase())).size !== 4) err(f, at + ": choices must be distinct");
          if (it.c.some(c => c.length > 420)) err(f, at + ": a choice is over 420 characters");
          if (!isLegacy) { const L = it.c.map(c => c.length), mx = Math.max(...L), mn = Math.max(1, Math.min(...L)); if (mx / mn > 1.6 && mx - mn > 12) warns.push(f + ": " + at + ": choice lengths vary more than 1.6x"); }
        }
        if (!(Number.isInteger(it.a) && it.a >= 0 && it.a <= 3)) err(f, at + ": a must be 0..3");
        ["x", "t"].forEach(k => { if (typeof it[k] !== "string") err(f, at + ": " + k + " must be a string"); });
        if (typeof it.p === "string" && it.p.length > 1500) err(f, at + ": passage over 1500 characters");
        if (it.q !== undefined && (typeof it.q !== "string" || it.q.length > 500)) err(f, at + ": q must be a string under 500 characters");
        if (it.q === undefined && !DEFAULT_Q.includes(s.sk) && s.sk !== "Rhetorical Synthesis") err(f, at + ": q is required for " + s.sk);
        // Per-skill kinds.
        if (it.tb !== undefined) { const tb = it.tb; if (s.needs !== "tb") err(f, at + ": tb only belongs on Command of Evidence: Quantitative"); else if (!tb || typeof tb.cap !== "string" || !Array.isArray(tb.h) || !Array.isArray(tb.r) || tb.h.length < 2 || tb.h.length > 6 || tb.r.length < 1 || tb.r.length > 8 || tb.r.some(r => !Array.isArray(r) || r.length !== tb.h.length)) err(f, at + ": tb must be {cap, h[2-6], r[1-8][=h]}"); }
        if (s.needs === "p2") { if (typeof it.p2 !== "string" || !it.p2.trim()) err(f, at + ": p2 (Text 2) required"); }
        else if (it.p2 !== undefined) err(f, at + ": p2 only belongs on Cross-Text Connections");
        if (s.needs === "n") { if (!Array.isArray(it.n) || it.n.length < 3 || it.n.length > 7 || typeof it.goal !== "string") err(f, at + ": n[3-7] and goal required"); if (it.p !== undefined) err(f, at + ": Rhetorical Synthesis items have notes, not a passage"); }
        else { if (it.n !== undefined || it.goal !== undefined) err(f, at + ": n/goal only belong on Rhetorical Synthesis"); if (typeof it.p !== "string" || !it.p.trim()) err(f, at + ": p (passage) required"); }
        if (s.needs === "u" && /underlined/i.test(it.q || "") && !/\{\{[^}]+\}\}/.test(it.p || "")) err(f, at + ": a question about the underlined sentence needs {{...}} in the passage");
        walkStrings(it, str => { if (bad(str)) err(f, at + ": forbidden markup in text"); });
        // Lesson-specific rules (only when the skill's lessons exist and the item is tagged).
        const L = lessons[s.d + "|" + s.sk];
        if (L && it.lesson && L[it.lesson - 1] && !isLegacy) {
          const l = L[it.lesson - 1];
          const q = it.q || "";
          if (q && Array.isArray(l.stems) && !l.stems.some(st => q.indexOf(st) >= 0)) warns.push(f + ": " + at + ": q is not one of the lesson's stems");
          const w = words(it.p) + words(it.p2);
          if (Array.isArray(l.words) && s.needs !== "n" && (w < l.words[0] || w > l.words[1])) err(f, at + ": passage is " + w + " words, outside the lesson's band " + l.words[0] + "-" + l.words[1]);
        }
        items.push({ it, file: f, skill: s, legacy: isLegacy, idx: isLegacy ? legacy[it.id].i : -1 });
      });
    });
  });
  Object.keys(legacy).forEach(id => { if (!seenIds.has(id)) err("bank/legacy.json", "legacy item " + id + " is missing from bank/rw"); });

  // Near-duplicates within a skill.
  const bySkill = {};
  items.forEach(x => (bySkill[x.skill.slug] = bySkill[x.skill.slug] || []).push(x));
  Object.keys(bySkill).forEach(slug => {
    const arr = bySkill[slug].map(x => ({ x, sh: shingles(itemText(x.it)) }));
    const variant = x => (x.it.tags || []).some(t => /^variant:/.test(t));
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      if (arr[i].sh.size < 6 || arr[j].sh.size < 6) continue;
      if (jaccard(arr[i].sh, arr[j].sh) < 0.5) continue;
      const msg = "item " + arr[j].x.it.id + " is a near-duplicate of " + arr[i].x.it.id;
      // A deliberate pair (the same sentence punctuated two ways) is tagged variant:<key> on both items.
      if (variant(arr[i].x) && variant(arr[j].x)) continue;
      if (arr[i].x.legacy && arr[j].x.legacy) warns.push(arr[j].x.file + ": " + msg); else err(arr[j].x.file, msg + " (tag both variant:<key> if the pair is deliberate)");
    }
  });

  // Generators.
  const gdir = path.join(BANK, "math", "gens");
  if (fs.existsSync(gdir)) fs.readdirSync(gdir).filter(n => n.endsWith(".js")).sort().forEach(name => {
    const src = fs.readFileSync(path.join(gdir, name), "utf8");
    if (bad(src)) err(path.join(gdir, name), "forbidden markup");
    if (!/DEF\(/.test(src)) err(path.join(gdir, name), "no DEF( call");
    gens.push({ name, src: src.replace(/\s+$/, "") });
  });

  // Clue Hunter tuples: every bank/arc/*.json, in name order.
  const adir = path.join(BANK, "arc");
  (fs.existsSync(adir) ? fs.readdirSync(adir).filter(n => n.endsWith(".json")).sort() : []).forEach(name => {
    const wf = path.join(adir, name), arr = readJSON(wf);
    if (!Array.isArray(arr)) { err(wf, "must be an array"); return; }
    arcWords = arcWords.concat(arr);
    arr.forEach((w, i) => {
      const at = "tuple " + i;
      if (typeof w.s !== "string" || !/_{4,}/.test(w.s)) err(wf, at + ": s needs a ______ blank");
      if (!Array.isArray(w.clue) || w.clue.length !== 2 || !(w.clue[0] <= w.clue[1])) err(wf, at + ": clue [start,end] token range required");
      else if (w.clue[1] >= words(w.s)) err(wf, at + ": clue range beyond the sentence");
      if (typeof w.a !== "string" || !Array.isArray(w.w) || w.w.length !== 3 || new Set([w.a].concat(w.w).map(x => String(x).toLowerCase())).size !== 4) err(wf, at + ": a and 3 distinct w required");
      if (typeof w.why !== "string") err(wf, at + ": why required");
      walkStrings(w, str => { if (bad(str)) err(wf, at + ": forbidden markup"); });
    });
  });

  return { errors, warns, legacy, lessons, items, gens, arcWords };
}

function coverage(B, strict) {
  const rows = [], errors = [];
  RW.forEach(s => {
    const its = B.items.filter(x => x.skill === s);
    const cells = [];
    for (let l = 1; l <= s.n; l++) {
      const c = its.filter(x => x.it.lesson === l), byLv = [1, 2, 3].map(lv => c.filter(x => x.it.lv === lv).length);
      cells.push("L" + l + ":" + c.length + "(" + byLv.join("/") + ")");
      if (strict) {
        if (c.length < s.min) errors.push(s.sk + " lesson " + l + ": " + c.length + " items, minimum " + s.min);
        byLv.forEach((n, i) => { if (n < 4) errors.push(s.sk + " lesson " + l + ": " + n + " at lv " + (i + 1) + ", minimum 4"); });
      }
    }
    const untagged = its.filter(x => !x.it.lesson).length;
    if (strict && untagged) errors.push(s.sk + ": " + untagged + " untagged items");
    rows.push((s.d + "|" + s.sk).padEnd(40) + String(its.length).padStart(4) + "  " + cells.join("  ") + (untagged ? "  untagged:" + untagged : ""));
  });
  return { rows, errors };
}

function build(B) {
  const legacyItems = B.items.filter(x => x.legacy).sort((a, b) => a.idx - b.idx);
  const skOrder = s => SKILLS.indexOf(s);
  const fresh = B.items.filter(x => !x.legacy).sort((a, b) =>
    skOrder(a.skill) - skOrder(b.skill) || (a.it.lesson || 0) - (b.it.lesson || 0) || a.it.lv - b.it.lv || (a.it.id < b.it.id ? -1 : 1));
  const all = legacyItems.concat(fresh);
  const lessons = {};
  SKILLS.forEach(s => { const k = s.d + "|" + s.sk; if (B.lessons[k]) lessons[k] = B.lessons[k]; });
  let out = M_START + "\n";
  out += "/* " + all.length + " items: " + legacyItems.length + " original, " + fresh.length + " authored. Fields: id, d, sk, lv, lesson, tags, p, p2, tb, n, goal, q, c, a, x, t. */\n";
  out += "var RW_BANK=[\n" + all.map(x => emitJSON(orderedItem(x.it))).join(",\n") + "\n];\n";
  out += "var SK_LESSONS={\n" + Object.keys(lessons).map(k => emitJSON(k) + ":" + emitJSON(lessons[k])).join(",\n") + "\n};\n";
  out += "var ARC_WORDS=[\n" + B.arcWords.map(w => emitJSON(w)).join(",\n") + "\n];\n";
  out += M_END;
  let g = G_START + "\n" + B.gens.map(x => "/* " + x.name + " */\n" + x.src).join("\n\n") + (B.gens.length ? "\n" : "") + G_END;
  return { rw: out, gens: g, count: all.length };
}

function splice(html, rw, gens) {
  const cut = (s, a, b, what) => {
    const i = s.indexOf(a), j = s.indexOf(b), i2 = s.indexOf(a, i + 1), j2 = s.indexOf(b, j + 1);
    if (i < 0 || j < 0) throw new Error("index.html is missing the " + what + " markers");
    if (i2 >= 0 || j2 >= 0 || j < i) throw new Error("index.html has more than one " + what + " block");
    return { i, j: j + b.length };
  };
  const ui = html.indexOf(UI_MARK), sc = html.indexOf("<script>");
  const r = cut(html, M_START, M_END, "RW bank");
  if (!(r.i > sc && r.j < ui)) throw new Error("the RW bank block must sit inside the engine script");
  let out = html.slice(0, r.i) + rw + html.slice(r.j);
  const g = cut(out, G_START, G_END, "math generators");
  if (!(g.i > out.indexOf(M_END) && g.j < out.indexOf(UI_MARK))) throw new Error("the math generators block must follow the RW bank inside the engine script");
  out = out.slice(0, g.i) + gens + out.slice(g.j);
  return out;
}

function main(argv) {
  const check = argv.includes("--check"), strict = argv.includes("--strict-lessons");
  const B = load();
  const cov = coverage(B, strict);
  const errors = B.errors.concat(cov.errors);
  if (strict) SKILLS.forEach(s => { if (!B.lessons[s.d + "|" + s.sk]) errors.push("missing lessons.json for " + s.sk); });
  console.log("Coverage (items per lesson, then per lv):\n" + cov.rows.join("\n"));
  B.warns.forEach(w => console.log("warn: " + w));
  if (errors.length) { errors.forEach(e => console.error("error: " + e)); console.error(errors.length + " error(s)"); process.exit(1); }
  const built = build(B);
  const html = fs.readFileSync(INDEX, "utf8");
  const next = splice(html, built.rw, built.gens);
  const size = Buffer.byteLength(built.rw) + Buffer.byteLength(built.gens);
  console.log(built.count + " items, " + Object.keys(B.lessons).length + " skills with lessons, " + B.arcWords.length + " Clue Hunter tuples, " + B.gens.length + " generator files; generated " + (size / 1e3).toFixed(1) + " KB; index.html " + (Buffer.byteLength(next) / 1e6).toFixed(2) + " MB");
  if (size > BLOCK_BUDGET) { console.error("error: generated blocks exceed the " + BLOCK_BUDGET / 1e6 + " MB budget"); process.exit(1); }
  if (Buffer.byteLength(next) > FILE_BUDGET) { console.error("error: index.html would exceed the " + FILE_BUDGET / 1e6 + " MB budget"); process.exit(1); }
  if (check) {
    if (next !== html) { console.error("error: index.html's generated blocks are out of date. Run: node tools/bank.cjs"); process.exit(1); }
    console.log("index.html is up to date.");
    return;
  }
  if (next !== html) { fs.writeFileSync(INDEX, next); console.log("Wrote index.html."); } else console.log("index.html already up to date.");
}

module.exports = { SKILLS, RW, DKEYS, itemHash, load, build, coverage, M_START, M_END, G_START, G_END };
if (require.main === module) main(process.argv.slice(2));
