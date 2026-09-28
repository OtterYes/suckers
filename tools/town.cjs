process.env.TZ = "UTC";
// Engine checks for the town layer: proficiency bands, tools and their opportunities, the Town Square project,
// practice rounds, and the v10 save migration. Runs in plain Node, no browser.
//   node tools/town.cjs
const fs = require("fs");
const path = require("path");
const { simulate } = require("./sim.cjs");

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log("  FAIL", msg); } }
function section(name, fn) { console.log(name); try { fn(); } catch (e) { fail++; console.log("  ERROR", e.stack); } }
const clone = (x) => JSON.parse(JSON.stringify(x));
const T0 = Date.UTC(2026, 9, 5, 16, 0, 0);

const SIM = simulate({ days: 6, perDay: 60, learn: 0.25, seed: 3, ascend: 3 });
const E = SIM.E;
const rnd = E.mulberry32(21);
const D = "psda", SK = "Percentages", BID = "bank";
function fresh() { return E.migrate(E.newState(T0), T0); }
function mid() { const S = E.migrate(clone(SIM.S), T0); S.adv = null; return S; }
// One answer in a skill at a difficulty. `rep` marks it as a question seen before.
function ask(S, d, sk, right, lv, rep, now) {
  let q = null;
  for (let t = 0; t < 30 && !q; t++) { const c = E.buildForSkill(S, d, sk, lv || 2, rnd, []); if (c && c.lv === (lv || 2)) q = c; }
  if (!q) throw new Error("no level-" + lv + " question for " + d + " " + sk);
  if (rep) q.fresh = false;
  return E.applyAnswer(S, q, right, { now: now || T0, ms: 40000, rnd, mode: "train" });
}
function drill(S, d, sk, pattern, lv, rep) { let r = null; pattern.split("").forEach((c) => { r = ask(S, d, sk, c === "1", lv, rep); }); return r; }
const band = (S, d, sk) => E.profOf(S, d, sk).name;

section("fresh game: a town from the first minute, v10 fields, repeatable migration", () => {
  const S = fresh();
  ok(S.v === 11 && S.seenV11 === true, "fresh save is v11 and won't see What's New");
  ok(E.cityBuilt(S) && S.city.coins >= 200 && S.city.name, "the town exists with a starting treasury (" + S.city.coins + " coins)");
  ok(S.settings.view === "city", "the main screen shows the town");
  ok(S.tools && S.opps && S.intro && S.round === null, "tools, opportunities, intros, and round fields exist");
  ok(Object.keys(S.opps).length === 0, "no tool opportunities before any answers");
  ok(S.onb && S.onb.done === false, "new players still get the intro");
  const a = JSON.stringify(E.migrate(clone(S), T0)), b = JSON.stringify(E.migrate(E.migrate(clone(S), T0), T0));
  ok(a === b, "migrating twice changes nothing more");
  ok(E.UNLOCK.city === 0 && E.isOpen(S, "city"), "the Town Hall is open at stage 0");
});

section("proficiency: sparse history stays Learning; evidence and hard questions gate the bands", () => {
  const S = fresh();
  drill(S, D, SK, "11", 2);
  let P = E.profOf(S, D, SK);
  ok(P.band === 0 && P.e === 2, "two right answers are not enough evidence: " + P.name + " (weight " + P.e + ")");
  ok(/For Working/.test(E.profHow(S, D, SK)) && /more question/.test(E.profHow(S, D, SK)), "the route says what Working takes: " + E.profHow(S, D, SK));
  drill(S, D, SK, "1111", 2);
  P = E.profOf(S, D, SK);
  ok(P.band === 1, "six medium right answers reach Working, got " + P.name);
  ok(!!S.opps[BID] && S.opps[BID].lv === 1, "Working reveals the first tool for the Bank");
  drill(S, D, SK, "11", 2);
  P = E.profOf(S, D, SK);
  ok(P.band === 1 && /hard question/.test(E.profHow(S, D, SK)), "medium-only practice stops at Working; Skilled asks for hard questions: " + E.profHow(S, D, SK));
  drill(S, D, SK, "111", 3);
  P = E.profOf(S, D, SK);
  ok(P.band === 2 && P.hard >= 3, "three hard right answers on top reach Skilled, got " + P.name);
  ok(S.opps[BID] && S.opps[BID].lv === 1, "the first tool is still the one on offer until it is bought");
});

section("proficiency: one miss never drops a band, a bad run does; a lucky streak is not a band", () => {
  const S = fresh();
  drill(S, D, SK, "111111", 2); drill(S, D, SK, "111", 3);
  ok(band(S, D, SK) === "Skilled", "start at Skilled");
  drill(S, D, SK, "0", 2);
  ok(band(S, D, SK) === "Skilled", "one miss keeps Skilled (hysteresis), p=" + E.profOf(S, D, SK).p.toFixed(2));
  drill(S, D, SK, "0000", 2);
  ok(band(S, D, SK) !== "Skilled", "five misses in a row do drop it: " + band(S, D, SK));
  const S2 = fresh();
  drill(S2, D, SK, "111", 3);
  ok(E.profOf(S2, D, SK).band <= 1, "three hard right in a row is at most Working (evidence " + E.profOf(S2, D, SK).e.toFixed(1) + "): " + band(S2, D, SK));
});

section("proficiency: easy repeats cannot stand in for mastery", () => {
  const S = fresh();
  drill(S, "alg", "Linear equations in one variable", "111111111111", 1, true);
  const P = E.profOf(S, "alg", "Linear equations in one variable");
  ok(P.band === 0, "twelve easy repeats right: still " + P.name + " (weight " + P.e + ")");
  const S2 = fresh();
  drill(S2, "alg", "Linear equations in one variable", "111111111111", 1, false);
  const P2 = E.profOf(S2, "alg", "Linear equations in one variable");
  ok(P2.band === 1, "twelve easy fresh ones right reach Working but no further: " + P2.name);
  ok(!/Expert/.test(P2.name) && P2.hard === 0, "no hard questions, so Skilled and Expert stay out of reach");
});

section("proficiency: Expert needs hard questions, high weighted accuracy, and a Bronze medal", () => {
  const S = fresh();
  drill(S, D, SK, "1111111", 2); drill(S, D, SK, "11111", 3);
  const s = S.sk[D + "|" + SK], P = E.profOf(S, D, SK);
  ok(s.m >= 1, "five hard right earn the Bronze medal the old way");
  ok(P.band === 3, "and the window is strong enough for Expert: " + P.name + " p=" + P.p.toFixed(2) + " e=" + P.e + " hard=" + P.hard);
  ok(/Expert is the top band/.test(E.profHow(S, D, SK)), "the route says there's nothing above Expert");
});

section("tools: an opportunity keeps its price, is bought once, and the next one waits for the next band", () => {
  const S = fresh();
  drill(S, D, SK, "111111", 2);
  const o = S.opps[BID];
  ok(o && o.lv === 1 && o.cost > 0 && isFinite(o.cost), "Working reveals Better tools at " + (o && o.cost) + " coins");
  const cost = o.cost;
  S.city.coins += 5e6; drill(S, D, SK, "11", 2); drill(S, "alg", "Linear functions", "111", 2);
  ok(S.opps[BID].cost === cost && S.opps[BID].at === o.at, "more coins and more answers leave the price alone");
  const c0 = S.city.coins, r = E.toolBuy(S, BID, T0);
  ok(r && r.lv === 1 && S.tools[BID] === 1 && S.city.coins === c0 - cost, "buying installs level 1 and takes exactly the price");
  ok(E.toolBuy(S, BID, T0) === null && S.tools[BID] === 1 && S.city.coins === c0 - cost, "buying again does nothing");
  ok(!S.opps[BID], "no second opportunity yet: Skilled hasn't been reached");
  drill(S, D, SK, "111", 3);
  ok(S.opps[BID] && S.opps[BID].lv === 2 && S.opps[BID].cost > cost, "Skilled reveals Skilled hands, dearer than the first tool");
  const poor = fresh(); drill(poor, D, SK, "111111", 2); poor.city.coins = 0;
  ok(E.toolBuy(poor, BID, T0) === null && !poor.tools[BID], "no coins, no tool");
  ok(E.oppCount(S) >= 1 && E.oppAfford(S) >= 1, "counts see the open offer");
});

section("tools: better results for that building and that skill only", () => {
  const S = fresh(); S.city.b[BID] = 3; S.city.b.market = 3; S.sk[D + "|" + SK] = { n: 6, c: 5 }; S.sk["psda|Ratios, rates, proportions, and units"] = { n: 6, c: 5 };
  const B = E.CITY_BY[BID], M = E.CITY_BY.market, r0 = E.cityRateOf(S, B, T0), m0 = E.cityRateOf(S, M, T0), est0 = E.proj(S).total;
  ok(r0 > 0 && m0 > 0, "both buildings produce once their skills have a lit node");
  S.tools[BID] = 1;
  ok(Math.abs(E.cityRateOf(S, B, T0) / r0 - 1.6) < 1e-9, "one tool: the Bank makes 60% more");
  ok(E.cityRateOf(S, M, T0) === m0, "the Market is unchanged");
  S.tools[BID] = 3;
  ok(Math.abs(E.cityRateOf(S, B, T0) / r0 - 1.6 * 1.6 * 1.6) < 1e-9, "three tools compound");
  ok(Math.abs(E.toolPay(S, D, SK) - 1.75) < 1e-9 && E.toolPay(S, D, "Probability") === 1, "right answers in Percentages pay ×1.75 coins; other skills pay as before");
  const c0 = S.city.coins; ask(S, D, SK, true, 2); const paid = S.city.coins - c0;
  S.tools[BID] = 0; const c1 = S.city.coins; ask(S, D, SK, true, 2); const paid0 = S.city.coins - c1;
  ok(paid > paid0 * 1.3, "a right answer with tools pays more coins (" + Math.round(paid) + " vs " + Math.round(paid0) + ")");
  const est1 = E.proj(S).total; S.tools[BID] = 3; S.city.coins += 1e9;
  ok(E.proj(S).total === est1 && est0 === 320, "tools and coins never touch the game estimate (answers do, as always)");
});

section("tools and projects survive a reload and an Advance", () => {
  const S = mid(); S.sk[D + "|" + SK] = { n: 12, c: 11, pr: "bbbbbbbbbbbb", pb: 0 }; E.townFix(S, T0);
  ok(S.opps[BID] && S.opps[BID].lv === 1, "an opportunity from stored history");
  S.city.coins = 1e12; E.toolBuy(S, BID, T0);
  const again = E.migrate(clone(S), T0 + 5);
  ok(again.tools[BID] === 1 && !again.opps[BID], "reload keeps the tool and doesn't bring the offer back");
  S.unit = { u: 1, st: 5, ready: true, cleared: ["1.1", "1.2", "1.3", "1.4", "1.5"], legacy: 0, at: {} };
  ok(E.unitAdvance(S, T0, 7), "advance to Unit 2");
  ok(S.tools[BID] === 1, "tools are learning, so they stay through Advance");
  ok(E.cityBuilt(S), "the town is still founded after Advance");
});

section("project: evidence across subjects, kept once earned, paid once, and useful", () => {
  const S = fresh(); const P = E.PROJECTS[0];
  const set = (d, sk) => { S.sk[d + "|" + sk] = { n: 8, c: 7, pr: "bbbbbb", pb: 0 }; };
  set("ii", "Inferences"); set("alg", "Linear functions"); set("geo", "Circles");
  let G = E.projProg(S, P);
  ok(G.rw === 1 && G.m === 2 && !G.ok, "one Reading & Writing subject and two Math subjects is not enough");
  ok(!E.projReady(S, "square") && E.projDo(S, "square", T0) === null, "not ready, not payable");
  set("sec", "Boundaries");
  G = E.projProg(S, P);
  ok(G.ok && G.rw === 2 && G.m === 2, "a second Reading & Writing subject completes the evidence");
  E.townAfter(S, T0);
  ok(S.world.square && S.world.square.earned && !S.world.square.at, "the evidence is kept the moment it's complete");
  S.sk["sec|Boundaries"].pr = "aa0000"; S.sk["sec|Boundaries"].pb = 0;
  ok(E.projReady(S, "square"), "a bad week later, the project is still ready");
  S.city.coins = 100;
  ok(E.projDo(S, "square", T0) === null && !S.world.square.at, "without the coins it waits");
  S.city.coins = 2000; const e0 = S.chests.e, g0 = E.cityGlobal(S, T0);
  const r = E.projDo(S, "square", T0);
  ok(r && S.world.square.at && S.city.coins === 500 && S.chests.e === e0 + 1, "1,500 coins restore it and pay one Epic chest");
  ok(E.projDo(S, "square", T0 + 1) === null && S.chests.e === e0 + 1 && S.city.coins === 500, "never twice");
  ok(Math.abs(E.cityGlobal(S, T0) / g0 - 1.15) < 1e-9, "the town's output is +15%");
  S.unit = { u: 1, st: 5, ready: true, cleared: ["1.1", "1.2", "1.3", "1.4", "1.5"], legacy: 0, at: {} }; E.unitAdvance(S, T0, 3);
  ok(E.projDone(S, "square") && Math.abs(E.projMult(S) - 1.15) < 1e-9, "the square stays restored through Advance");
  ok(E.proj(S).total === 320, "and the game estimate never moved");
});

section("rounds: five questions in one skill, resumable, cancel restores the focus", () => {
  const S = fresh(); S.focus = "rw";
  const R = E.roundStart(S, BID, false, T0);
  ok(R && S.focus === "sk:psda|Percentages" && R.pf === "rw", "a round sets the skill focus and remembers the old one");
  ask(S, "alg", "Linear functions", true, 2);
  ok(S.round.a === 0, "answers in other skills don't count");
  drill(S, D, SK, "1101", 2);
  ok(S.round.a === 4 && S.round.c === 3 && !S.round.done, "four answered, three right");
  const again = E.migrate(clone(S), T0 + 1);
  ok(again.round && again.round.a === 4 && again.focus === "sk:psda|Percentages", "a reload keeps the round where it was");
  drill(S, D, SK, "1", 2);
  ok(S.round.done && S.round.a === 5 && S.focus === "rw", "the fifth answer ends it and restores the focus");
  ok(S.round.coins > 0 && S.round.sparks > 0, "the tally shows what the round paid");
  E.roundEnd(S);
  ok(S.round === null, "closing the summary clears it");
  const S2 = fresh(); E.roundStart(S2, BID, true, T0);
  ok(S2.focus === "sk:psda|Percentages|hard", "a hard drill round asks for hard questions");
  E.roundEnd(S2);
  ok(S2.focus === "mix" && S2.round === null, "cancelling restores the focus");
});

section("adventure: the world step can be a tool or the project", () => {
  const S = fresh(); drill(S, D, SK, "111111", 2); S.city.coins = 1e9;
  const pick = { kind: "skill", d: D, sk: SK };
  const w = E.advWorld(S, T0, pick);
  ok(w.k === "tool" && w.id === BID && /Bank/.test(w.t), "an affordable tool for the practiced skill becomes the world step: " + w.t);
  S.adv = E.advPlan(S, T0, "std"); E.advStart(S, T0);
  const ti = S.adv.steps.findIndex((s) => s.k === "tool");
  ok(ti >= 0, "the plan has the tool step: " + S.adv.steps.map((s) => s.k).join(","));
  if (ti >= 0) { S.adv.i = ti; S.adv.steps[ti].st = "on"; const rb = E.toolBuy(S, BID, T0); ok(rb && S.adv.steps[ti].st === "done", "buying the tool finishes the step: " + JSON.stringify({ bought: rb, step: S.adv.steps[ti], opp: S.opps[BID], coins: S.city.coins })); }
  const P = fresh(); ["ii|Inferences", "sec|Boundaries", "alg|Linear functions", "geo|Circles"].forEach((k) => { P.sk[k] = { n: 8, c: 7, pr: "bbbbbb", pb: 0 }; }); E.townAfter(P, T0); P.city.coins = 5000;
  const w2 = E.advWorld(P, T0, { kind: "skill", d: "cs", sk: "Words in Context" });
  ok(w2.k === "project" && w2.id === "square", "a fundable project comes first: " + w2.t);
});

section("migration: a v9 save gains the town layer without touching its learning history", () => {
  const raw = clone(SIM.S); raw.v = 9; delete raw.tools; delete raw.opps; delete raw.intro; delete raw.round; delete raw.seenV10; delete raw.seenV11;
  for (const k in raw.sk) { delete raw.sk[k].pr; delete raw.sk[k].pb; }
  raw.city.founded = 0; raw.city.asked = false; raw.welcomed = true;
  const before = { r: JSON.stringify(raw.r), spots: JSON.stringify(raw.spots), n: Object.keys(raw.sk).map((k) => raw.sk[k].n + "/" + raw.sk[k].c).join(","), answered: raw.stats.answered };
  const S = E.migrate(clone(raw), T0);
  ok(S.v === 11 && S.seenV10 === false && S.seenV11 === false, "v9 becomes v11 and sees What's New");
  ok(S.intro.town === 1 && S.intro.hall === 1 && !S.intro.place, "existing players skip the town intros but meet the new pages");
  ok(JSON.stringify(S.r) === before.r && JSON.stringify(S.spots) === before.spots && S.stats.answered === before.answered, "ratings, blind spots, and counts unchanged");
  ok(Object.keys(S.sk).map((k) => S.sk[k].n + "/" + S.sk[k].c).join(",") === before.n, "every skill's tries and rights unchanged");
  ok(Object.keys(S.sk).every((k) => typeof S.sk[k].pr === "string" && typeof S.sk[k].pb === "number"), "every skill has a seeded window and band");
  const seeded = Object.keys(S.sk).filter((k) => S.sk[k].pr.length > 0).length;
  ok(seeded > 0, seeded + " skills seeded from their kept results");
  ok(E.cityBuilt(S) && S.city.name, "an unfounded town is founded with its default name");
  const S2 = E.migrate(clone(S), T0 + 9);
  ok(JSON.stringify(S2.tools) === JSON.stringify(S.tools) && JSON.stringify(S2.opps) === JSON.stringify(S.opps), "a second migration keeps tools and offers as they were");
});

section("migration: the dev save loads and repairs bad values", () => {
  const t = fs.readFileSync(path.join(__dirname, "..", "dist", "dev-save.txt"), "utf8").trim();
  const raw = JSON.parse(Buffer.from(t.slice(6), "base64").toString("utf8"));
  raw.tools = { bank: "x", nothere: 2, mint: 9, market: 2.7 }; raw.opps = { bank: { lv: 7, cost: 10 }, market: { lv: 1, cost: -5 }, census: { lv: 1, cost: 40, at: 1 }, bogus: { lv: 1, cost: 5 } };
  const S = E.migrate(clone(raw), T0);
  ok(S.v === 11, "dev save is v11");
  ok(!S.tools.bank && !S.tools.nothere && S.tools.mint === 3 && S.tools.market === 2, "tool levels are whole numbers within range: " + JSON.stringify(S.tools));
  ok(!S.opps.bogus && !(S.opps.market && (S.opps.market.cost <= 0 || S.opps.market.lv !== 3)), "impossible offers are dropped (a made-up building, a negative price): " + JSON.stringify(S.opps.market || null));
  ok(S.opps.bank && S.opps.bank.lv === 1 && S.opps.bank.cost > 0 && S.opps.bank.cost !== 10, "an out-of-range level is dropped and a fresh, fairly priced offer takes its place: " + JSON.stringify(S.opps.bank));
  ok(S.opps.census && S.opps.census.cost === 40, "a valid stored offer keeps its price");
  ok(E.cityBuilt(S) && E.proj(S).total === 1520, "the late game is intact");
  const G = E.projProg(S, E.PROJECTS[0]);
  ok(G.ok, "the late save's history already covers the Town Square's evidence");
});

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
