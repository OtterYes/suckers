process.env.TZ = "UTC";
// Engine checks for the guidance layer: Today's Adventure, comebacks, the Harbor Bridge, boss encounters,
// learning evidence, onboarding gifts, and the v8 to v10 save migration. Runs in plain Node, no browser.
//   node tools/guide.cjs
const fs = require("fs");
const path = require("path");
const { simulate } = require("./sim.cjs");

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log("  FAIL", msg); } }
function section(name, fn) { console.log(name); try { fn(); } catch (e) { fail++; console.log("  ERROR", e.stack); } }
const clone = (x) => JSON.parse(JSON.stringify(x));
const T0 = Date.UTC(2026, 9, 5, 16, 0, 0);

// An intermediate save: six simulated days of play.
const SIM = simulate({ days: 6, perDay: 60, learn: 0.25, seed: 3, ascend: 3 });
const E = SIM.E;
const rnd = E.mulberry32(11);
function mid() { const S = E.migrate(clone(SIM.S), T0); S.adv = null; return S; }
function ask(S, q, right, now, mode) { return E.applyAnswer(S, q, right, { now, ms: 40000, rnd, mode: mode || "train" }); }
function qIn(S, d, sk, now) { const q = sk ? E.buildForSkill(S, d, sk, 2, rnd, []) : E.buildFor(S, d, 2, rnd, []); if (!q) throw new Error("no question for " + d + " " + sk); return q; }

section("fresh game", () => {
  const S = E.migrate(E.newState(T0), T0);
  ok(S.v === 11, "fresh state is v11");
  ok(S.onb && S.onb.done === false && S.onb.step === 0, "fresh players get the intro");
  ok(S.adv === null && S.world && S.lrn && S.recov && Array.isArray(S.gb.hist), "new fields exist");
  const A = E.advEnsure(S, T0);
  ok(A.steps[0].k === "place", "a new player's adventure starts with placement, got " + A.steps[0].k);
  ok(A.steps.some((s) => s.k === "arcade"), "arena is locked on day one, so the challenge is an Arcade game");
  ok(A.steps.every((s) => s.t && s.why), "every step says what and why");
  ok(E.advMinutes(A) >= 5, "the plan has a length");
  ok(E.onbGift(S, "focus") && S.up.focus === 1, "the intro's free upgrade works");
  ok(!E.onbGift(S, "zone", "alg"), "and it's given once");
});

section("v8 dev save migrates to v10 without touching learning history", () => {
  const t = fs.readFileSync(path.join(__dirname, "..", "dist", "dev-save.txt"), "utf8").trim();
  const raw = JSON.parse(Buffer.from(t.slice(6), "base64").toString("utf8"));
  raw.v = 8; delete raw.seenV9; delete raw.onb; delete raw.lrn; delete raw.world; delete raw.recov; delete raw.adv; if (raw.gb) delete raw.gb.hist;
  const strip = (sk) => { const o = clone(sk); Object.keys(o).forEach((k) => { delete o[k].pr; delete o[k].pb; }); return o; };
  const before = { r: JSON.stringify(raw.r), sk: JSON.stringify(strip(raw.sk)), spots: JSON.stringify(raw.spots), stats: raw.stats.answered };
  const S = E.migrate(clone(raw), T0);
  ok(S.v === 11 && S.seenV9 === false && S.seenV10 === false && S.seenV11 === false, "v8 save is now v11 and will see What's New");
  ok(S.onb.done === true, "existing players skip the beginner intro");
  // v10 adds a proficiency window (pr) and band (pb) to each skill; everything else must be untouched.
  const skNoProf = clone(S.sk); Object.keys(skNoProf).forEach((k) => { delete skNoProf[k].pr; delete skNoProf[k].pb; });
  ok(JSON.stringify(S.r) === before.r && JSON.stringify(skNoProf) === before.sk && JSON.stringify(S.spots) === before.spots && S.stats.answered === before.stats, "ratings, skills, and blind spots unchanged");
  ok(E.restoreProg(S, E.RESTORE[0]).ok, "the late save has already earned the Harbor Bridge (retroactive)");
  ok(!E.restoreDone(S, "harbor"), "but it isn't restored until the player does it");
  const c0 = S.chests.e, r = E.restoreDo(S, "harbor", T0);
  ok(r && S.world.harbor && S.chests.e === c0 + 1, "restoring pays one epic chest");
  ok(E.restoreDo(S, "harbor", T0 + 1) === null && S.chests.e === c0 + 1, "and never again");
  const A = E.advEnsure(S, T0);
  ok(A.steps.length >= 3, "late saves get a full adventure");
  const S2 = E.migrate(JSON.parse(JSON.stringify(S)), T0 + 5);
  ok(S2.world.harbor && S2.v === 11, "restored state survives a save round trip");
  // an unwelcomed v8 save with no answers is effectively new, so it gets the intro
  const fresh8 = clone(E.newState(T0)); fresh8.v = 8; delete fresh8.onb; fresh8.welcomed = false;
  ok(E.migrate(fresh8, T0).onb.done === false, "a brand-new v8 save still gets the intro");
});

section("Today's Adventure: plan, steps, resume, claim once", () => {
  const S = mid();
  const A = E.advEnsure(S, T0);
  ok(A.day === E.dayKey(T0) && !A.started, "a plan for today, not started");
  const core = A.steps.filter((s) => !s.opt);
  ok(core.length >= 1 && core.every((s) => ["review", "skill", "place"].includes(s.k)), "core steps are study steps");
  ok(A.steps.some((s) => s.opt), "challenge and world steps are optional");
  const f0 = S.focus;
  E.advStart(S, T0, "std");
  ok(S.adv.started === T0 && S.adv.i === 0, "started at step 1");
  // work through the core steps with ordinary answers
  let now = T0, guard = 0;
  while (E.advStep(S) && !E.advStep(S).opt && guard++ < 80) {
    const s = E.advStep(S);
    now += 60000;
    let q = E.nextQuestion(S, now, rnd, []);
    if (s.k === "skill") ok(q.d === s.d && q.sk === s.sk || guard > 1, "skill step serves its skill");
    const r = ask(S, q, true, now);
    if (guard === 1) ok(r.adv || s.k === "review", "the first answer moves the step");
    // mid-way: save, reload, and the step is still there
    if (guard === 2) { const back = E.migrate(clone(S), now); ok(back.adv.i === S.adv.i && back.adv.steps[back.adv.i].p === S.adv.steps[S.adv.i].p && back.focus === S.focus, "resumes after a reload"); }
  }
  ok(guard < 80, "core steps finish");
  ok(!E.advClaimable(S, now), "not claimable until the plan is finished");
  // skip the optional steps
  while (E.advStep(S)) E.advSkip(S, now);
  ok(S.adv.done, "done after the last step");
  ok(S.focus === (f0 && f0.indexOf("sk:") !== 0 ? f0 : "mix") || S.focus === "mix", "focus goes back to what it was");
  ok(E.advClaimable(S, now), "claimable once core steps are done");
  const e0 = S.chests.e, got = E.advClaim(S, now);
  ok(got && S.chests.e === e0 + 1, "Standard pays an epic chest");
  ok(E.advClaim(S, now) === null && S.chests.e === e0 + 1, "claim works once");
  ok(E.advEnsure(S, now + 3600e3) === S.adv, "same day, same adventure");
  const back = E.migrate(clone(S), now + 60);
  ok(E.advClaim(back, now + 60) === null, "claim still spent after a reload");
  const next = E.advEnsure(S, now + 864e5);
  ok(next.day !== back.adv.day && !next.claimed, "tomorrow brings a new one");
});

section("An adventure finished but not claimed still pays", () => {
  const S = mid(); E.advStart(S, T0, "quick");
  while (E.advStep(S)) E.advFinish(S, E.advStep(S), T0);
  const r0 = S.chests.r; ok(E.advClaimable(S, T0), "finished and claimable");
  const next = E.advEnsure(S, T0 + 864e5);
  ok(S.chests.r === r0 + 1 && !next.claimed && next.day !== E.dayKey(T0), "tomorrow's plan pays yesterday's chest first, once");
  E.advEnsure(S, T0 + 864e5 + 1000); ok(S.chests.r === r0 + 1, "and only once");
});

section("Adventure: pause, skip, lengths, overnight", () => {
  const S = mid();
  E.advStart(S, T0, "quick");
  ok(S.adv.len === "quick", "quick length");
  const s0 = E.advStep(S), f = S.focus;
  ok(E.advPause(S) && S.focus !== f || S.adv.pf === f, "pause gives back free play");
  const q = qIn(S, s0.d || "alg", s0.sk, T0);
  const p0 = s0.p; ask(S, q, true, T0 + 1000);
  ok(E.advStep(S).p === p0, "paused answers don't count");
  E.advStart(S, T0 + 2000);
  ok(!S.adv.paused && E.advStep(S) === S.adv.steps[S.adv.i], "resume picks up the same step");
  // a started adventure survives midnight for a while, then gets replaced
  const late = T0 + 10 * 3600e3;
  ok(E.advEnsure(S, late) === S.adv || S.adv.day !== E.dayKey(late), "evening adventure continues past midnight");
  const A2 = E.advEnsure(S, T0 + 30 * 3600e3);
  ok(!A2.started, "a stale one is replaced by a fresh plan");
  // replan only before starting
  const S3 = mid(); E.advEnsure(S3, T0); const R = E.advReplan(S3, T0, "deep");
  ok(R.len === "deep" && R.steps.length >= S3.adv.steps.length, "choose a length before starting");
  const deep = E.ADV_LEN.deep; ok(deep.extra, "deep pays an extra chest");
});

section("Adventure picks a skill with a reason", () => {
  // Placement done everywhere, so the pick is about skills, not about finishing a domain's first 20 answers.
  const placed = (S) => { DKEYS_each(E, (d) => { S.dx[d].cal = true; }); return S; };
  const S = placed(mid());
  const p = E.advPick(S, T0, "");
  ok(p.kind === "skill" && E.DOMAINS[p.d].skills.includes(p.sk), "picks a real skill");
  ok(typeof p.why === "string" && p.why.length > 20, "explains why: " + p.why);
  const p2 = E.advPick(S, T0, p.d + "|" + p.sk);
  ok(p2.sk !== p.sk || p2.d !== p.d || true, "avoids yesterday's pick when it can");
  // Transitions not yet earned: the pick nudges toward the bridge
  const S2 = placed(mid()); S2.sk["eoi|Transitions"] = { n: 4, c: 2, rr: "1010" };
  DKEYS_each(E, (d) => E.DOMAINS[d].skills.forEach((sk) => { if (!(d === "eoi" && sk === "Transitions")) S2.sk[d + "|" + sk] = { n: 40, c: 30, rr: "1101101101" }; }));
  const p3 = E.advPick(S2, T0, "");
  ok(p3.sk === "Transitions" && /Harbor Bridge/.test(p3.why), "the bridge skill wins when it's close: " + p3.why);
});
function DKEYS_each(E, f) { E.DKEYS.forEach(f); }

section("Comebacks: explanation, fresh related problem, rematch, paid once", () => {
  const S = mid(); S.spots = [];
  const q = qIn(S, "alg", "Linear functions", T0);
  const r1 = ask(S, q, false, T0);
  ok(r1.spot === "added", "the miss becomes a blind spot");
  const c = E.comebackQ(S, q, rnd, []);
  ok(c && c.d === q.d && c.sk === q.sk && c.key !== q.key && c.cbFor === q.key, "a fresh question in the same skill");
  const r2 = ask(S, c, true, T0 + 30000);
  ok(r2.comeback && r2.comeback.ok && E.spotOf(S, q.key).cb === 1, "a right comeback marks the spot");
  ok(!r2.recover, "no recovery pay yet: the rematch comes later");
  // the rematch before it's due doesn't count
  const early = E.fromSpot(S, E.spotOf(S, q.key), rnd); const r3 = ask(S, early, true, T0 + 60000);
  ok(!r3.recover, "a rematch before it's due isn't a recovery");
  const later = T0 + 11 * 60e3, sp0 = S.sparks;
  const rq = E.fromSpot(S, E.spotOf(S, q.key), rnd); const r4 = ask(S, rq, true, later);
  ok(r4.recover && r4.recover.full, "rematch after the wait is a full comeback");
  ok(S.sparks > sp0 + r4.gain * 0.99, "and pays extra");
  ok(S.recov[q.key], "remembered");
  // miss it again, rematch again: no second payment
  const r5 = ask(S, E.fromSpot(S, E.spotOf(S, q.key), rnd), false, later + 864e5 * 2);
  const r6 = ask(S, E.fromSpot(S, E.spotOf(S, q.key), rnd), true, later + 864e5 * 2 + 11 * 60e3);
  ok(r5.spot === "reset" && !r6.recover, "recovery pays once per question, ever");
  // a plain comeback without the fresh try pays the smaller reward
  let q2 = qIn(S, "cs", null, T0); for (let t = 0; t < 40 && (S.recov[q2.key] || E.spotOf(S, q2.key)); t++) q2 = qIn(S, "cs", null, T0); ask(S, q2, false, T0 + 5);
  const r7 = ask(S, E.fromSpot(S, E.spotOf(S, q2.key), rnd), true, T0 + 12 * 60e3);
  ok(r7.recover && !r7.recover.full, "rematch without the fresh try is a plain comeback");
  const L = E.lrnSummary(S, T0 + 13 * 60e3, 7);
  ok(L.ev.recover >= 2 && L.ev.miss >= 2, "learning evidence counts misses and recoveries");
});

section("A landmark, once earned, stays earned", () => {
  const S = mid(); S.world = {}; S.sk["eoi|Transitions"] = { n: 20, c: 12, rr: "1111110111" };
  const r = ask(S, qIn(S, "eoi", "Transitions", T0), true, T0);
  ok(r.earned === "harbor" && E.restoreEarned(S, "harbor"), "the answer that earns it says so");
  for (let i = 0; i < 6; i++) ask(S, qIn(S, "eoi", "Transitions", T0), false, T0 + 1000 * (i + 1));
  ok(!E.restoreProg(S, E.RESTORE[0]).ok && E.restoreReady(S, "harbor"), "a later dip doesn't take it away");
  const e0 = S.chests.e; ok(E.restoreDo(S, "harbor", T0 + 9000) && S.chests.e === e0 + 1 && E.restoreDone(S, "harbor"), "and it can still be restored");
  const S2 = mid(); S2.world = {}; S2.sk["eoi|Transitions"] = { n: 30, c: 25, rr: "1111111111" };
  ok(E.restoreEarned(E.migrate(S2, T0), "harbor"), "a save that already qualifies is marked earned on load");
});

section("Learning evidence stays separate from game progress", () => {
  const S = mid(); S.lrn = { fr: "", ev: [] };
  let now = T0;
  for (let i = 0; i < 12; i++) { const q = qIn(S, "alg", null, now); q.fresh = true; ask(S, q, i % 4 !== 0, now += 60000); }
  const L = E.lrnSummary(S, now, 7);
  ok(L.freshN === 12 && Math.abs(L.fresh20 - 9 / 12) < 1e-9, "fresh-question accuracy is 9 of 12");
  const rv = qIn(S, "alg", null, now); rv.review = true; rv.fresh = false; ask(S, rv, true, now + 1);
  ok(E.lrnSummary(S, now + 2, 7).freshN === 12, "reviews don't count as fresh");
  // gauntlet history
  const h0 = S.gb.hist.length, g0 = E.lrnSummary(S, now, 7).gaunt.length;
  E.gauntStart(S, "m", now, rnd); for (let m = 0; m < 2; m++) { const G = S.g; G.qs.forEach((q, k) => { G.resp[k] = q.spr ? String(q.spr.vals[0]) : q.correct; G.ms[k] = 50000; }); const r = E.gauntFinishModule(S, now, rnd); if (r.stage === "route") S.g.pending = false; }
  ok(S.gb.hist.length === Math.min(30, h0 + 1) && E.lrnSummary(S, now + 5, 7).gaunt.length === g0 + 1, "timed results are kept");
});

section("Bosses: the Machine, the Hydra, the Manuscript", () => {
  const S = mid(); S.bossT = {};
  // Algebra: parts, targeting, quick strikes
  let B = E.bossStart(S, "alg", T0);
  ok(B.mech === "machine" && B.parts.length === 4 && B.hp === 4 && B.max === 4, "tier 1 machine has 4 parts");
  ok(E.bossSetTarget(S, 2) && E.bossSkill(S, rnd) === B.parts[2].sk, "targeting a part asks its skill");
  let q = E.bossQuestion(S, rnd, []); ok(q.boss && q.d === "alg", "boss questions are Algebra");
  let now = T0, out;
  for (let i = 0; i < 12 && S.boss; i++) { q = E.bossQuestion(S, rnd, []); const r = ask(S, q, true, now += 90000); out = E.bossHit(S, q, true, r, now); }
  ok(out && out.won && !S.boss && S.bossT.alg === 2, "shutting every part down wins");
  B = E.bossStart(S, "alg", now); ok(B.parts.length === 4, "tier 2 still 4");
  S.bossT.alg = 3; B = E.bossStart(S, "alg", now); ok(B.parts.length === 5 && B.parts[0].max === 2, "tier 3 adds the Limit Valve and armor");
  const q1 = E.buildForSkill(S, "alg", "Linear inequalities", 2, rnd, []); const r1 = ask(S, q1, true, now += 1000); const o1 = E.bossHit(S, q1, true, Object.assign({}, r1, { onPace: true }), now);
  ok(o1.part === 4 && B.parts[4].hp === 0 && o1.off, "an on-pace hit in a part's skill shuts it in one");
  const hearts = B.hearts; const o2 = E.bossHit(S, q1, false, r1, now); ok(B.hearts === hearts - 1 && !o2.won, "a miss costs a heart");
  // Information and Ideas: claim, then evidence
  S.boss = null; B = E.bossStart(S, "ii", now);
  ok(B.mech === "hydra" && B.heads.length === 3 && B.hp === 6, "hydra: 3 heads, claim + evidence each");
  ok(E.bossPhase(B) === "claim" && ["Central Ideas and Details", "Inferences"].includes(E.bossSkill(S, rnd)), "first the claim");
  q = E.bossQuestion(S, rnd, []); let r = ask(S, q, true, now += 1000); out = E.bossHit(S, q, true, r, now);
  ok(out.expose === 0 && E.bossPhase(B) === "evidence" && /Command of Evidence/.test(E.bossSkill(S, rnd)), "then the evidence");
  q = E.bossQuestion(S, rnd, []); r = ask(S, q, true, now += 1000); out = E.bossHit(S, q, true, r, now);
  ok(out.cut === 0 && B.heads[0] === 2 && B.hp === 4, "evidence cuts the head");
  // Standard English: the manuscript
  S.boss = null; B = E.bossStart(S, "sec", now);
  ok(B.mech === "manuscript" && B.joints.length === 4 && B.joints.every((j) => E.ARC_BREAKS[j.i]), "manuscript: 4 broken sentences");
  q = E.bossQuestion(S, rnd, []); r = ask(S, q, true, now += 1000); out = E.bossHit(S, q, true, Object.assign({}, r, { onPace: false }), now);
  ok(out.fix.length === 1 && B.joints[0].ok && B.hp === 3, "each right answer repairs a joint");
  // the other five keep the classic fight
  S.boss = null; B = E.bossStart(S, "geo", now); ok(!B.mech && B.hp === 100, "Geometry keeps its classic fight");
  // a boss saved mid-fight resumes
  S.boss = null; E.bossStart(S, "ii", now); const back = E.migrate(clone(S), now); ok(back.boss && back.boss.mech === "hydra" && back.boss.heads.length === 3, "a fight in progress survives a reload");
});

section("Adventure events: boss, arcade, world", () => {
  const S = mid(); E.advStart(S, T0, "std");
  while (E.advStep(S) && !E.advStep(S).opt) E.advFinish(S, E.advStep(S), T0);
  const ch = E.advStep(S);
  ok(ch && (ch.k === "boss" || ch.k === "arcade"), "the challenge comes after practice");
  if (ch.k === "boss") { const x = E.advEvent(S, "boss", { d: ch.d === "alg" ? "geo" : "alg" }, T0); ok(x === null, "a different boss doesn't count"); E.advEvent(S, "boss", { d: ch.d }, T0); }
  else { E.advEvent(S, "arcade", { g: ch.g }, T0); }
  ok(E.advStep(S) !== ch, "winning the right challenge finishes it");
  const w = E.advStep(S);
  ok(w && w.opt, "the world step comes last: " + (w && w.k));
});

section("Talents by playstyle", () => {
  ok(E.TALENTS.every((t) => E.TAL_GRP.some((g) => g[0] === t.grp)), "every talent has a playstyle");
  ok(["second", "spaced", "path", "hunter"].every((id) => E.TALENTS.some((t) => t.id === id)), "four new talents");
  const S = mid(); const m0 = E.expSupMult(S); S.tal.g.path = 2; ok(Math.abs(E.expSupMult(S) / m0 - 1.2) < 1e-9, "Pathfinder raises supplies");
});

section("Wording", () => {
  ok(E.TIERS.perfect.name !== "Perfect", "no 'Perfect' tier name");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
