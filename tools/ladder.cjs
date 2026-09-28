// Engine checks for the Lessons layer: the pass rule, what counts, serving shares, the skill pick, the bank index and
// imports, the v10 to v11 migration with ladder seeding, and pay. Runs in plain Node, no browser.
//
//   node tools/ladder.cjs
//
// The ladder itself (SK_LESSONS) is authored in bank/; skills it does not cover yet get a synthetic one here, so the
// rules are tested even before the syllabus lands.
process.env.TZ = "UTC";
const { simulate } = require("./sim.cjs");
const T0 = Date.UTC(2026, 9, 5, 16);
let fail = 0, pass = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL " + m); } }
function section(name, fn) { try { fn(); } catch (e) { fail++; console.log("FAIL " + name + ": " + (e.stack || e)); } }
const clone = (o) => JSON.parse(JSON.stringify(o));

const SIM = simulate({ days: 6, perDay: 60, learn: 0.25, seed: 3, ascend: 3 });
const E = SIM.E;
const rnd = E.mulberry32(11);

/* A synthetic ladder for every skill the authored one (bank/) does not cover yet: 5 lessons per R&W skill (3 for
   Cross-Text), 3 per math skill. Authored skills keep their real ladder and tags. */
const missing = [];
E.DKEYS.forEach((d) => E.DOMAINS[d].skills.forEach((sk) => { if (!(E.SK_LESSONS[d + "|" + sk] || []).length) missing.push(d + "|" + sk); }));
if (missing.length) {
  missing.forEach((key) => {
    const sk = key.split("|")[1], d = key.split("|")[0];
    const k = E.DOMAINS[d].sec === "m" ? 3 : sk === "Cross-Text Connections" ? 3 : 5;
    E.SK_LESSONS[key] = Array.from({ length: k }, (_, i) => ({ name: "Lesson " + (i + 1), rule: "r", steps: ["a", "b"], cues: ["c", "d", "e"], example: {}, trap: { why: "w" } }));
  });
  // Tag the untagged bank round-robin so every synthetic skill has questions at every lesson.
  const n = {};
  E.RW_BANK.forEach((it) => { const k = it.d + "|" + it.sk; if (!missing.includes(k) || it.lesson > 0) return; n[k] = (n[k] || 0) + 1; it.lesson = 1 + ((n[k] - 1) % E.SK_LESSONS[k].length); });
  E.BANK_IX = null;
  Object.keys(E.MGEN).forEach((id, i) => { const T = E.MGEN[id]; if (T.d !== "sec" && !E.MGEN_LESSON[id] && missing.includes(T.d + "|" + T.sk)) E.MGEN_LESSON[id] = 1 + (i % 3); });
}
const fresh = () => E.migrate(E.newState(T0), T0);
const mid = () => E.migrate(clone(SIM.S), T0);
function ask(S, q, right, now, mode, extra) { return E.applyAnswer(S, q, right, Object.assign({ now, ms: 40000, rnd, mode: mode || "train" }, extra || {})); }
/* A question in a skill, forced to a difficulty and lesson (the bank is small; the ladder logs what the question says it is). */
function qAt(S, d, sk, lv, lesson, opts) {
  let q = null;
  for (let t = 0; t < 40 && !q; t++) q = E.buildForSkill(S, d, sk, lv, rnd, [], lesson);
  if (!q) throw new Error("no question for " + d + " " + sk);
  q.lv = lv; q.lesson = lesson; q.fresh = true; q.review = false;
  if (opts) Object.assign(q, opts);
  return q;
}

section("pass rule: eight units of fresh evidence pass, eight easy repeats never do", () => {
  // A miss first, so the fast track can't fire; then medium right answers. Units reach 8 on the eighth answer.
  const S = fresh(); let now = T0; let r = null;
  r = ask(S, qAt(S, "eoi", "Transitions", 2, 1), false, now += 1000);
  for (let i = 0; i < 6; i++) r = ask(S, qAt(S, "eoi", "Transitions", 2, 1), true, now += 1000);
  ok(!r.lesson, "seven answers (7 units) are not enough");
  r = ask(S, qAt(S, "eoi", "Transitions", 2, 1), true, now += 1000);
  ok(r.lesson && r.lesson.l === 1 && !r.lesson.last && r.lesson.sparks > 0, "the eighth passes lesson 1 and pays sparks: " + JSON.stringify(r.lesson));
  ok(E.lesOf(S, "eoi", "Transitions").cur === 2 && S.les["eoi|Transitions"].done.join() === "1", "lesson 2 is current");
  const S2 = fresh(); now = T0;
  for (let i = 0; i < 8; i++) r = ask(S2, qAt(S2, "eoi", "Transitions", 1, 1, { fresh: false }), true, now += 1000);
  ok(!r.lesson && E.lesOf(S2, "eoi", "Transitions").cur === 1, "8 easy repeats right do not pass (2 units)");
  // Hard answers weigh 1.5: a miss then five hard right is 8.5 units at 88%.
  const S3 = fresh(); now = T0;
  r = ask(S3, qAt(S3, "eoi", "Transitions", 3, 1), false, now += 1000);
  for (let i = 0; i < 4; i++) r = ask(S3, qAt(S3, "eoi", "Transitions", 3, 1), true, now += 1000);
  ok(!r.lesson, "a miss and four hard right (7 units) are not enough");
  r = ask(S3, qAt(S3, "eoi", "Transitions", 3, 1), true, now += 1000);
  ok(r.lesson && r.lesson.l === 1, "the fifth hard right passes (8.5 units)");
});

section("pass rule: accuracy, fresh count, and the last lesson's hard answers", () => {
  const S = fresh(); let now = T0, r;
  // A coin-flip record for sixteen answers, then a hot streak. The window is strong from answer 21, but the lesson's
  // whole record (the cumulative gate) only reaches 65% on answer 23.
  const pat = "1010101010101010";
  for (const c of pat) r = ask(S, qAt(S, "cs", "Words in Context", 2, 1), c === "1", now += 1000);
  ok(!r.lesson, "50% accuracy does not pass");
  const passedAt = [];
  for (let i = 17; i <= 23; i++) { r = ask(S, qAt(S, "cs", "Words in Context", 2, 1), true, now += 1000); if (r.lesson) passedAt.push(i); }
  ok(passedAt.join() === "23", "a hot streak passes only once the whole record is decent: passed at " + passedAt.join());
  // Fresh-count floor: 10 medium repeats right = 5 units... use hard repeats: 12 hard repeats right = 9 units, 0 fresh.
  const S2 = fresh(); now = T0;
  for (let i = 0; i < 12; i++) r = ask(S2, qAt(S2, "cs", "Words in Context", 3, 1, { fresh: false }), true, now += 1000);
  ok(!r.lesson, "twelve hard repeats right (9 units, 0 fresh) do not pass");
  // Last lesson of a 3-lesson skill needs 3 hard right in the window.
  const S3 = fresh(); now = T0; const key = "cs|Cross-Text Connections";
  S3.les[key] = { w: {}, n: {}, done: [1, 2], at: { 1: T0, 2: T0 }, t: {} };
  for (let i = 0; i < 9; i++) r = ask(S3, qAt(S3, "cs", "Cross-Text Connections", 2, 3), true, now += 1000);
  ok(!r.lesson, "nine medium right on the last lesson do not pass without hard answers");
  for (let i = 0; i < 3; i++) r = ask(S3, qAt(S3, "cs", "Cross-Text Connections", 3, 3), true, now += 1000);
  ok(r.lesson && r.lesson.last && r.lesson.chest === "e" && r.lesson.all, "three hard right finish the skill: an Epic chest and all lessons passed");
  ok(E.lesAll(S3, "cs", "Cross-Text Connections") && E.lesComplete(S3) === 1, "lesAll and lesComplete see it");
  ok(S3.ach.ls1, "trophy Lesson Learned");
  ok(S3.lrn.ev.some((e) => e[1] === "lesson" && e[3] === "Cross-Text Connections" && e[4] === 3), "learning log notes the pass");
  ok(E.lrnSummary(S3, now, 7).ev.lesson === 1 && E.lrnSummary(S3, now, 7).skills.includes(key), "lrnSummary counts it as a skill improved");
});

section("fast track: five fresh right with three past easy pass on the fifth answer", () => {
  const S = fresh(); let now = T0, r;
  for (const lv of [2, 3, 2, 1, 2]) r = ask(S, qAt(S, "ii", "Inferences", lv, 1), true, now += 1000);
  ok(r.lesson && r.lesson.l === 1 && S.les["ii|Inferences"].n[1] === 5, "passed on the fifth answer");
  const S2 = fresh(); now = T0;
  for (let i = 0; i < 5; i++) r = ask(S2, qAt(S2, "ii", "Inferences", 1, 1), true, now += 1000);
  ok(!r.lesson, "five easy right do not fast-track");
  const S3 = fresh(); now = T0;
  for (const c of "11011") r = ask(S3, qAt(S3, "ii", "Inferences", 2, 1), c === "1", now += 1000);
  ok(!r.lesson, "a miss inside the first five cancels the fast track");
});

section("what counts: reviews, boss fights, untagged questions, and the Gauntlet", () => {
  const S = fresh(); let now = T0, r;
  const st = () => JSON.stringify(S.les["alg|Linear functions"] || null);
  r = ask(S, qAt(S, "alg", "Linear functions", 2, 1, { review: true, fresh: false }), true, now += 1000);
  ok(!S.les["alg|Linear functions"] || !S.les["alg|Linear functions"].n[1], "a review answer logs nothing");
  r = ask(S, qAt(S, "alg", "Linear functions", 2, 1, { boss: true }), true, now += 1000, "train", { boss: true });
  ok(!S.les["alg|Linear functions"] || !S.les["alg|Linear functions"].n[1], "a boss answer logs nothing");
  r = ask(S, qAt(S, "alg", "Linear functions", 2, 0), true, now += 1000);
  ok(!S.les["alg|Linear functions"] || !S.les["alg|Linear functions"].n[1], "an untagged question logs nothing");
  r = ask(S, qAt(S, "alg", "Linear functions", 2, 1), true, now += 1000, "gaunt");
  ok(S.les["alg|Linear functions"].n[1] === 1, "a Gauntlet answer counts");
  r = ask(S, qAt(S, "alg", "Linear functions", 2, 3), true, now += 1000);
  ok(S.les["alg|Linear functions"].n[3] === 1 && E.lesOf(S, "alg", "Linear functions").cur === 1, "an answer on a later lesson is logged there and the current lesson stays");
});

section("math: new numbers on the same template are not fresh evidence", () => {
  const S = fresh(); let now = T0, r;
  const id = Object.keys(E.MGEN).find((k) => E.MGEN[k].d === "alg" && E.MGEN[k].sk === "Linear functions");
  const gq = (seed) => { const q = E.fromGen(id, 2, seed); q.lesson = 1; q.lv = 2; return q; };
  for (let s = 1; s <= 8; s++) r = ask(S, gq(s * 7 + 1), true, now += 1000);
  const L = S.les["alg|Linear functions"];
  const stat = E.lesStat(L.w[1]);
  ok(stat.fresh === 1 && !r.lesson, "eight seeds of one template count one fresh answer: " + JSON.stringify(stat));
});

section("serving: the current lesson gets most questions, passed ones a fifth, the next a tenth; hard drills never preview", () => {
  const S = fresh(); const key = "eoi|Transitions";
  S.les[key] = { w: {}, n: {}, done: [1, 2], at: { 1: T0 - 5000, 2: T0 }, t: {} };
  const r2 = E.mulberry32(5); const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (let i = 0; i < 2000; i++) c[E.lesTarget(S, "eoi", "Transitions", r2)]++;
  ok(c[3] > 1300 && c[3] < 1500, "about 70% current: " + JSON.stringify(c));
  ok(c[1] > 330 && c[1] < 470 && c[2] === 0, "review always picks the oldest passed lesson: " + JSON.stringify(c));
  ok(c[4] > 140 && c[4] < 260, "about 10% preview");
  const h = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (let i = 0; i < 1000; i++) h[E.lesTarget(S, "eoi", "Transitions", r2, true)]++;
  ok(h[4] === 0 && h[3] > 500, "no preview in a hard drill: " + JSON.stringify(h));
  const S2 = fresh(); S2.les[key] = { w: {}, n: {}, done: [1, 2, 3, 4, 5], at: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }, t: {} };
  const a = {}; for (let i = 0; i < 300; i++) { const l = E.lesTarget(S2, "eoi", "Transitions", r2); a[l] = (a[l] || 0) + 1; }
  ok(!a[6] && a[5] > 150, "a finished skill keeps serving its last lesson with review of the oldest: " + JSON.stringify(a));
  let q = null; for (let t = 0; t < 30 && !q; t++) q = E.buildForSkill(S, "eoi", "Transitions", 2, r2, []);
  ok(q && q.lesson >= 1, "a served question carries its lesson");
});

section("the skill pick: test share times need, a 4:1 cap, and three in a row on a new lesson", () => {
  const S = mid(); const r2 = E.mulberry32(9); const c = {};
  S.blk = null;
  for (let i = 0; i < 3000; i++) { const sk = E.pickSkill(S, "cs", "train", r2); c[sk] = (c[sk] || 0) + 1; }
  const mx = Math.max(...Object.values(c)), mn = Math.min(...Object.values(c));
  ok(Object.keys(c).length === 3 && mx / mn < 4.6, "every skill is served and none more than about 4x another: " + JSON.stringify(c));
  const g = {}; for (let i = 0; i < 3000; i++) { const sk = E.pickSkill(S, "cs", "gaunt", r2); g[sk] = (g[sk] || 0) + 1; }
  ok(g["Words in Context"] > g["Cross-Text Connections"] * 2, "the Gauntlet samples by test share: " + JSON.stringify(g));
  const S3 = fresh(); S3.blk = null; const first = E.pickSkill(S3, "geo", "train", r2);
  ok(S3.blk && S3.blk.sk === first && S3.blk.n === 2, "a lesson with under four answers starts a block");
  ok(E.pickSkill(S3, "geo", "train", r2) === first && E.pickSkill(S3, "geo", "train", r2) === first, "the next two picks stay on it");
  ok(E.pickSkill(S3, "geo", "train", r2) !== undefined, "then the block is spent");
});

section("bank index: imports are served after registering and dropped after clearing", () => {
  const S = fresh();
  const imp = { id: "cbfeed01", imp: true, d: "eoi", sk: "Transitions", lv: 2, p: "Text ______ more text.", q: "Which choice completes the text with the most logical transition?", c: ["however,", "and", "so", "then"], a: 0, x: "x", t: "" };
  const before = E.unseenLeft(S, "eoi");
  E.impRegister([imp]);
  ok(E.bankItem("cbfeed01") === imp && E.unseenLeft(S, "eoi") === before + 1 && E.bankSize("eoi") === E.RW_BANK.filter((x) => x.d === "eoi").length, "registered and counted");
  let hit = false; for (let t = 0; t < 200 && !hit; t++) { const b = E.pickBank(S, "eoi", 2, rnd, [], "Transitions", 0); if (b && b.id === "cbfeed01") hit = true; }
  ok(hit, "pickBank can serve the import");
  const brute = E.RW_BANK.filter((it) => it.d === "eoi" && !S.flagged[it.id] && !(S.seen[it.id] > 0)).length;
  ok(E.unseenLeft(S, "eoi") === brute, "unseenLeft matches a brute-force count");
  S.spots.push({ k: "b:cbfeed01", kind: "bank", ref: "cbfeed01", d: "eoi", sk: "Transitions", box: 0, due: T0, miss: 1, added: T0 });
  ok(E.fromSpot(S, S.spots[S.spots.length - 1], rnd), "a spot on the import rebuilds");
  E.impUnregister(["cbfeed01"]);
  ok(!E.bankItem("cbfeed01") && E.unseenLeft(S, "eoi") === before, "unregistered");
  const sp = S.spots.find((s) => s.ref === "cbfeed01");
  ok(E.fromSpot(S, sp, rnd) === null && !S.spots.includes(sp), "its spot is dropped");
});

section("migration: a v10 save becomes v11, sees what's new, keeps its learning history byte for byte, and seeds the ladder without paying", () => {
  const raw = clone(SIM.S); raw.v = 10; delete raw.les; delete raw.blk; delete raw.seenV11;
  const before = { r: JSON.stringify(raw.r), sk: JSON.stringify(raw.sk), spots: JSON.stringify(raw.spots), chests: JSON.stringify(raw.chests), stats: raw.stats.answered, lrn: JSON.stringify(raw.lrn), sparks: raw.sparks };
  const S = E.migrate(clone(raw), T0);
  ok(S.v === 11 && S.seenV11 === false && S.seenV10 === true, "v11 and will see what's new");
  ok(JSON.stringify(S.r) === before.r && JSON.stringify(S.sk) === before.sk && JSON.stringify(S.spots) === before.spots && JSON.stringify(S.chests) === before.chests && S.stats.answered === before.stats && JSON.stringify(S.lrn) === before.lrn && S.sparks === before.sparks, "ratings, skills, spots, chests, log, and sparks untouched");
  const seeded = Object.keys(S.les).filter((k) => S.les[k].done.length);
  ok(Object.keys(S.les).length === Object.keys(raw.sk).filter((k) => E.lesN(k.split("|")[0], k.split("|")[1]) > 0).length, "every skill with history has a ladder");
  ok(seeded.length > 0 && seeded.every((k) => S.les[k].done.every((l, i) => l === i + 1)), "seeded passes are the first lessons in order: " + seeded.length + " skills");
  ok(JSON.stringify(E.migrate(clone(S), T0 + 5)) === JSON.stringify(S), "migrate is idempotent");
  // Seeding rules on a hand-made history.
  const F = fresh(); F.sk["eoi|Transitions"] = { n: 40, c: 30, m: 2, pr: "" }; F.sk["cs|Words in Context"] = { n: 200, c: 150, m: 3, pr: "" }; F.sk["geo|Circles"] = { n: 12, c: 10, pr: "" };
  delete F.les["eoi|Transitions"]; delete F.les["cs|Words in Context"]; delete F.les["geo|Circles"];
  E.lesFix(F, T0);
  ok(F.les["eoi|Transitions"].done.length === 4, "Silver with 4 nodes seeds all but the last lesson: " + F.les["eoi|Transitions"].done.join());
  ok(F.les["cs|Words in Context"].done.length === 5 && E.lesAll(F, "cs", "Words in Context"), "Gold seeds every lesson");
  ok(F.les["geo|Circles"].done.length === 0, "two nodes and no proficiency window seed nothing");
  ok(F.chests.e === 0 && !F.lrn.ev.some((e) => e[1] === "lesson"), "nothing is paid for seeded lessons");
  const F2 = fresh(); F2.les["bad|x"] = {}; F2.les["eoi|Transitions"] = { done: [9, 1, 1, "x"], w: null };
  E.lesFix(F2, T0);
  ok(!F2.les["bad|x"] && F2.les["eoi|Transitions"].done.join() === "1" && F2.les["eoi|Transitions"].w && typeof F2.les["eoi|Transitions"].w === "object", "bad values are repaired");
});

section("a fresh v11 state, a comeback in the same lesson, and city output for a finished skill", () => {
  const S = fresh();
  ok(S.v === 11 && S.seenV11 === true && S.les && typeof S.les === "object" && S.blk === null, "fresh v11 state");
  let q = null; for (let t = 0; t < 30 && !q; t++) q = E.buildForSkill(S, "eoi", "Transitions", 2, rnd, [], 2);
  const c = E.comebackQ(S, q, rnd, []);
  ok(c && c.lesson === q.lesson && c.key !== q.key, "the comeback keeps the missed question's lesson");
  const B = E.CITY_B.find((b) => b.d === "eoi" && b.sk === "Transitions");
  S.sk["eoi|Transitions"] = { n: 30, c: 25, pr: "" };
  const base = E.cityLearn(S, B);
  S.les["eoi|Transitions"] = { w: {}, n: {}, done: [1, 2, 3, 4, 5], at: {}, t: {} };
  ok(Math.abs(E.cityLearn(S, B) / base - 1.25) < 1e-9, "a finished ladder makes the building produce 25% more");
});

console.log(pass + " passed, " + fail + " failed" + (missing.length ? " (synthetic ladder for " + missing.length + " skills)" : ""));
process.exit(fail ? 1 : 0);
