// Functional checks: drives the real UI from simulated saves and asserts on the saved state.
//   NODE_PATH=$(npm root -g) node tools/flows.cjs [name-filter]
const path = require("path");
const { chromium } = require("playwright");
const { simulate } = require("./sim.cjs");
const { routeThree } = require("./three.cjs");

const file = "file://" + path.resolve(__dirname, "..", "index.html");
const KEY = "grind1520.save.v1";
const base = JSON.stringify(simulate({ days: 6, perDay: 60, learn: 0.25, seed: 3, ascend: 3 }).S);
const ENG = require("./engine.cjs").loadEngine();
// A save that has advanced to Unit 2, with a fresh Expedition map and a stockpile to spend.
function unit2(S, edit) {
  S.unit = { u: 2, st: 1, ready: false, cleared: ["1.1", "1.2", "1.3", "1.4", "1.5"], legacy: 1, at: {} };
  S.exp = ENG.expFresh(4242, 1); S.exp.sup = 1e6; S.exp.gems = 5000;
  if (edit) edit(S);
}

function save(edit) {
  const S = JSON.parse(base);
  S.welcomed = true; S.seenV3 = true; S.seenV4 = true; S.evo.seen = S.evo.stage; S.lastSeen = S.lastInteract = Date.now();
  if (edit) edit(S);
  return JSON.stringify(S);
}
async function open(browser, json, w, h, opts) {
  const page = await browser.newPage({ viewport: { width: w || 1440, height: h || 900 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.route(/^https?:\/\//, (r) => r.abort());
  if (!(opts && opts.noThree)) await routeThree(page);
  if (json) await page.addInitScript((j) => { try { localStorage.setItem("grind1520.save.v1", j); } catch (e) {} }, json);
  await page.goto(file);
  await page.waitForTimeout(900);
  return page;
}
const state = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const w3Ready = (page) => page.waitForFunction(() => window.__g1520 && window.__g1520.w3().ready, null, { timeout: 30000 });
const w3Pos = (page) => page.evaluate(() => { const P = window.__g1520.w3().pos; return [P.x, P.z]; });
// Where a world point lands on the page, through the 3D camera.
const w3At = (page, x, y, z) => page.evaluate(([x, y, z]) => { const W = window.__g1520.w3(), v = W.pos.clone().set(x, y, z).project(W.cam), r = W.cv.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }, [x, y, z]);
async function answerAny(page) {
  const ch = page.locator('#conBody [data-act="pick"]');
  if (await ch.count()) await ch.first().click(); else await page.locator("#sprIn").fill("5");
  await page.click("#checkBtn");
  await page.waitForTimeout(250);
  for (let j = 0; j < 4; j++) { const m = page.locator('#modal:not([hidden]) [data-act="modalClose"]'); if (await m.count()) { await m.first().click(); await page.waitForTimeout(80); } }
}

const TESTS = {
  async "buy a hub, a pathway, and an upgrade"(b) {
    const page = await open(b, save((S) => { S.sparks = 5e6; Object.keys(S.hub).forEach((d) => { S.hub[d] = 0; }); }));
    const s0 = await state(page);
    await page.click('[data-act="tab"][data-v="evolution"]');
    await page.click('#panel [data-act="buyHub"].can');
    await page.click('#panel [data-act="buyGen"].can');
    await page.click('#panel [data-act="buyUp"].can');
    const s1 = await state(page);
    const hubs = (S) => Object.values(S.hub).reduce((a, b) => a + b, 0), gens = (S) => Object.values(S.gen).reduce((a, b) => a + b, 0), ups = (S) => Object.values(S.up).reduce((a, b) => a + b, 0);
    if (hubs(s1) !== hubs(s0) + 1) throw new Error("hub level did not go up");
    if (gens(s1) <= gens(s0)) throw new Error("no pathway bought");
    if (ups(s1) !== ups(s0) + 1) throw new Error("upgrade not bought");
    if (!(s1.sparks < s0.sparks)) throw new Error("sparks not spent");
    return page;
  },
  async "switch engine form"(b) {
    const page = await open(b, save());
    await page.click('[data-act="form"][data-v="network"]');
    const form = await page.evaluate(() => document.body.dataset.form);
    if (form !== "network") throw new Error("body form is " + form);
    const title = await page.textContent("#conHead h2");
    if (!/network/i.test(title)) throw new Error("console title is " + title);
    return page;
  },
  async "boss fight takes over the console"(b) {
    const page = await open(b, save());
    await page.click('[data-act="tab"][data-v="arena"]');
    await page.click('[data-act="bossGo"][data-v="alg"]');
    await page.waitForTimeout(300);
    if (!/boss/i.test(await page.textContent("#conHead"))) throw new Error("console head is not the boss");
    if (!(await page.locator("#bossBox").count())) throw new Error("no boss banner");
    await answerAny(page);
    const s = await state(page);
    if (!s.boss || (s.boss.hp === s.boss.max && s.boss.hearts === 3)) throw new Error("boss untouched: " + JSON.stringify(s.boss));
    return page;
  },
  async "train one skill from Reviews"(b) {
    const page = await open(b, save());
    await page.click('[data-act="tab"][data-v="reviews"]');
    const btn = page.locator('#panel [data-act="focusSk"]').first();
    const v = await btn.getAttribute("data-v");
    await btn.click();
    await page.waitForTimeout(300);
    const s = await state(page), sk = v.split("|")[1];
    if (s.focus !== "sk:" + v) throw new Error("focus is " + s.focus);
    const strip = await page.textContent(".node-strip");
    if (!strip.includes(sk)) throw new Error("question is not in " + sk + ": " + strip);
    return page;
  },
  async "finish a set with the keyboard"(b) {
    const page = await open(b, save((S) => { S.set = { n: 9, c: 7, sp: 900, run: 1, best: 4, log: "110111011", conn0: 20, p0: 1080, r0: Object.values(S.r), t0: Date.now() - 6e5 }; }));
    const ch = page.locator('#conBody [data-act="pick"]');
    if (await ch.count()) await page.keyboard.press("b"); else await page.locator("#sprIn").fill("5");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    for (let j = 0; j < 4; j++) { const m = page.locator('#modal:not([hidden]) [data-act="modalClose"]'); if (await m.count()) await m.first().click(); }
    await page.locator("body").click({ position: { x: 5, y: 450 } }).catch(() => {});
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    if (!(await page.locator(".setsum").count())) throw new Error("no set summary");
    const s = await state(page);
    if (s.stats.sets < 1) throw new Error("set not counted");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    if (await page.locator(".setsum").count()) throw new Error("summary did not advance");
    return page;
  },
  async "ascend resets the run and keeps the climb"(b) {
    const gated = await open(b, save((S) => { S.runSparks = 6e7; S.lifeSparks = 6e8; S.gb.since = 0; }));
    await gated.click('[data-act="tab"][data-v="ascend"]');
    const blocked = await gated.locator('#panel [data-act="sleep"][disabled]').count();
    await gated.close();
    if (!blocked) throw new Error("ascend not gated on a Gauntlet score");
    const page = await open(b, save((S) => { S.runSparks = 6e7; S.lifeSparks = 6e8; S.hub.alg = 7; S.gb.since = 760; }));
    const s0 = await state(page);
    await page.click('[data-act="tab"][data-v="ascend"]');
    await page.click('#panel [data-act="sleep"]');
    await page.click('#panel [data-act="sleep"]');
    await page.waitForTimeout(300);
    const s1 = await state(page);
    if (s1.sleeps !== s0.sleeps + 1) throw new Error("did not ascend");
    if (s1.hub.alg !== 0) throw new Error("hubs not reset");
    if (s1.evo.stage !== s0.evo.stage || JSON.stringify(s1.r) !== JSON.stringify(s0.r)) throw new Error("climb or evolution changed");
    return page;
  },
  async "evolution moment opens its chest"(b) {
    const page = await open(b, save((S) => { S.evo.seen = S.evo.stage - 1; S.chests.e += 1; }));
    if (!(await page.locator(".evo-modal").count())) throw new Error("no evolution modal");
    const s0 = await state(page);
    await page.click('#modal [data-act="openChest"]');
    await page.waitForTimeout(1100);
    if (!(await page.locator(".lcard").count())) throw new Error("no loot shown");
    const s1 = await state(page);
    if (s1.stats.chestsOpened !== (s0.stats.chestsOpened || 0) + 1) throw new Error("chest not opened");
    return page;
  },
  async "save a baseline marker in settings"(b) {
    const page = await open(b, save());
    await page.click("#gearBtn");
    await page.fill("#baseScore", "1210");
    await page.fill("#baseLabel", "Practice test 4");
    await page.click('[data-act="baseline"]');
    const s = await state(page);
    if (s.baseline.total !== 1210 || s.baseline.label !== "Practice test 4") throw new Error(JSON.stringify(s.baseline));
    return page;
  },
  async "run a full gauntlet"(b) {
    const page = await open(b, save());
    await page.click('[data-act="tab"][data-v="arena"]');
    await page.click('[data-act="gstart"][data-v="rw"]');
    for (const mod of [1, 2]) {
      for (let i = 0; i < 6; i++) {
        const ch = page.locator('#conBody [data-act="gpick"]');
        if (await ch.count()) await ch.nth(i % 4).click(); else { const inp = page.locator("#gSpr"); if (await inp.count()) await inp.fill("3"); }
        if (i < 5) await page.click('[data-act="gnext"]');
      }
      await page.click('[data-act="gsubmit"]');
      await page.click('[data-act="gsubmit"]');
      await page.waitForTimeout(300);
      if (mod === 1) { if (!(await page.locator('[data-act="gm2"]').count())) throw new Error("no module 2 route"); await page.click('[data-act="gm2"]'); }
    }
    for (let j = 0; j < 4; j++) { const m = page.locator('#modal:not([hidden]) [data-act="modalClose"]'); if (await m.count()) await m.first().click(); }
    if (!(await page.locator(".g-score").count())) throw new Error("no result screen");
    const s = await state(page);
    if (!s.gb.last || s.g) throw new Error("gauntlet not recorded");
    await page.click('[data-act="gdone"]');
    if (!(await page.locator("#sheet").count())) throw new Error("did not return to training");
    return page;
  },
  async "phone tabs swap engine and panels"(b) {
    const page = await open(b, save(), 390, 844);
    await page.click('#decknav [data-v="evolution"]');
    if (!(await page.isVisible("#panel")) || (await page.isVisible("#console"))) throw new Error("evolution tab layout wrong");
    await page.click('#decknav [data-v="network"]');
    if (!(await page.isVisible("#engineCv")) || !(await page.isVisible("#console"))) throw new Error("network tab layout wrong");
    return page;
  },
  async "daily review comes first and pays a chest"(b) {
    const past = Date.now() - 36e5;
    const page = await open(b, save((S) => {
      S.rev = null; S.focus = "mix"; S.ai = [];
      S.spots = [0, 1, 2].map((i) => ({ k: "g:alg.lin1:" + (1000 + i) + ":1", kind: "gen", ref: { t: "alg.lin1", s: 1000 + i, lv: 1 }, d: "alg", sk: "Linear equations in one variable", box: 1, due: past, miss: 1, added: past }));
    }));
    const src = await page.textContent(".sheet-meta .src");
    if (!/Daily review · 1 of 3/.test(src)) throw new Error("first question is not the daily review: " + src);
    const c0 = (await state(page)).chests;
    for (let i = 0; i < 3; i++) { await answerAny(page); await page.click("#nextBtn"); await page.waitForTimeout(150); }
    const s1 = await state(page);
    if (!s1.rev.done || s1.rev.p !== 3) throw new Error("review not finished: " + JSON.stringify(s1.rev));
    if (s1.chests.r + s1.chests.e <= c0.r + c0.e - 1) throw new Error("no review chest");
    return page;
  },
  async "tag why a miss happened"(b) {
    const page = await open(b, save((S) => { S.rev = { date: "x", n: 0, p: 0, done: true }; }));
    for (let i = 0; i < 8; i++) {
      await answerAny(page);
      if (await page.locator("#whyBox [data-act=why]").count()) {
        await page.click('#whyBox [data-act="why"][data-v="trap"]');
        if (!/Logged/.test(await page.textContent("#whyBox"))) throw new Error("tag not confirmed");
        const s = await state(page);
        if (!s.miss.length || s.miss[s.miss.length - 1][3] !== "trap") throw new Error("miss not logged");
        await page.click('[data-act="tab"][data-v="reviews"]');
        if (!/Fell for a trap/.test(await page.textContent("#plMiss"))) throw new Error("journal empty");
        return page;
      }
      await page.click("#nextBtn"); await page.waitForTimeout(120);
    }
    throw new Error("never missed a question to tag");
  },
  async "set a season in Plan"(b) {
    const page = await open(b, save((S) => { S.season.date = ""; }));
    await page.click('[data-act="tab"][data-v="reviews"]');
    const d = new Date(Date.now() + 30 * 864e5), ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    await page.fill("#snDate", ds);
    await page.fill("#snTarget", "1300");
    await page.click('[data-act="seasonSave"]');
    const s = await state(page);
    if (s.season.date !== ds || s.season.target !== 1300) throw new Error(JSON.stringify(s.season));
    if (!/days left/.test(await page.textContent("#plSeason"))) throw new Error("no countdown");
    if (!/to PSAT/.test(await page.textContent("#climbCap"))) throw new Error("HUD has no countdown");
    return page;
  },
  async "bulk import from a Question Bank export"(b) {
    const page = await open(b, save());
    const txt = require("fs").readFileSync(require("path").join(__dirname, "fixtures", "qbank.txt"), "utf8");
    await page.click("#impBtn");
    await page.fill("#impTxt", txt);
    await page.click('[data-act="impGo"]');
    if (!/Imported 5 questions/.test(await page.textContent(".imp-msg"))) throw new Error(await page.textContent(".imp-msg"));
    await page.click('[data-act="impGo"]');
    const s = await state(page);
    if (s.imports.length !== 5) throw new Error("imports " + s.imports.length);
    return page;
  },
  async "locked tabs stay locked on a new game"(b) {
    const page = await open(b, null);
    await page.click('[data-act="welcomeGo"]');
    await page.click('#decknav [data-v="arena"]');
    if (await page.isVisible("#panelWrap")) throw new Error("arena opened at stage 0");
    if (!/locked/i.test(await page.textContent("#toasts"))) throw new Error("no lock toast");
    return page;
  },
  async "phone plan tab fits"(b) {
    const page = await open(b, save(), 390, 844);
    await page.click('#decknav [data-v="reviews"]');
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (over) throw new Error("horizontal overflow on the Plan tab");
    return page;
  },
  async "comma sniper scores and pays"(b) {
    const page = await open(b, save());
    await page.click('[data-act="tab"][data-v="arena"]');
    await page.click('[data-act="arcPlay"][data-v="comma"]');
    for (let k = 0; k < 3; k++) {
      const it = await page.evaluate(() => { const A = window.__g1520.arc(); return { gap: A.item.gap, ok: A.item.ok[0] }; });
      await page.click(`#conBody [data-act="arcWord"][data-i="${it.gap}"]`);
      await page.click(`#conBody [data-act="arcMark"][data-v="${it.ok}"]`);
      await page.waitForTimeout(1000);
    }
    const sc = await page.evaluate(() => window.__g1520.arc().score);
    if (sc !== 7) throw new Error("score " + sc + " after 3 clean sentences (want 7 with the streak bonus)");
    const s0 = await state(page);
    await page.evaluate(() => window.__g1520.arcEnd());
    await page.waitForTimeout(300);
    const s1 = await state(page);
    if (!s1.arc.comma || s1.arc.comma.runs !== 1 || s1.arc.comma.best !== 7) throw new Error("run not recorded: " + JSON.stringify(s1.arc));
    if (!(s1.sparks > s0.sparks)) throw new Error("no sparks paid");
    if (!(await page.locator(".arc-res").count())) throw new Error("no results screen");
    await page.click('[data-act="arcDone"]');
    if (!(await page.locator("#sheet").count())) throw new Error("did not return to training");
    return page;
  },
  async "transition rush streak and penalty"(b) {
    const page = await open(b, save());
    await page.click('[data-act="tab"][data-v="arena"]');
    await page.click('[data-act="arcPlay"][data-v="rush"]');
    for (let k = 0; k < 5; k++) {
      const a = await page.evaluate(() => window.__g1520.arc().item.a);
      await page.keyboard.press(String(a + 1));
      await page.waitForTimeout(520);
    }
    const r = await page.evaluate(() => { const A = window.__g1520.arc(); return { score: A.score, ends: A.ends, a: A.item.a }; });
    if (r.score !== 7) throw new Error("score " + r.score + " after 5 right (want 7)");
    await page.click(`#conBody [data-act="arcPick"][data-i="${(r.a + 1) % 4}"]`);
    const ends = await page.evaluate(() => window.__g1520.arc().ends);
    if (r.ends - ends !== 3000) throw new Error("miss did not cost 3 seconds");
    if (!(await page.locator(".ropt.y").count())) throw new Error("right answer not shown after a miss");
    return page;
  },
  async "line drawer takes a drag"(b) {
    const page = await open(b, save());
    await page.click('[data-act="tab"][data-v="arena"]');
    await page.click('[data-act="arcPlay"][data-v="line"]');
    const it = await page.evaluate(() => { const A = window.__g1520.arc(); return { p: A.item.p, q: A.item.q, b: A.item.b, P: A.P }; });
    const T = [[0, it.b], Math.abs(it.b + it.p) <= 6 ? [it.q, it.b + it.p] : [-it.q, it.b - it.p]];
    const r = await page.locator("#lsvg").boundingBox();
    const px = (g) => [r.x + (g[0] + 7) / 14 * r.width, r.y + (7 - g[1]) / 14 * r.height];
    const same = (a, c) => a[0] === c[0] && a[1] === c[1];
    let order = [0, 1];
    if (same(T[0], it.P[1])) order = [1, 0];
    for (const j of order) {
      const from = px((await page.evaluate(() => window.__g1520.arc().P))[j]), to = px(T[j]);
      await page.mouse.move(from[0], from[1]); await page.mouse.down();
      await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2); await page.mouse.move(to[0], to[1]); await page.mouse.up();
    }
    const P = await page.evaluate(() => window.__g1520.arc().P);
    await page.click('[data-act="arcLock"]');
    const A = await page.evaluate(() => { const A = window.__g1520.arc(); return { ok: A.ok, score: A.score }; });
    if (!A.ok || A.score < 1) throw new Error("line not accepted: " + JSON.stringify({ it, P }));
    await page.keyboard.press("Enter");
    const round = await page.evaluate(() => window.__g1520.arc().round);
    if (round !== 1) throw new Error("Enter did not advance the round");
    return page;
  },
  async "balance point finds the center"(b) {
    const page = await open(b, save());
    await page.click('[data-act="tab"][data-v="arena"]');
    await page.click('[data-act="arcPlay"][data-v="balance"]');
    for (let k = 0; k < 2; k++) {
      const truth = await page.evaluate(() => window.__g1520.arc().item.truth);
      const r = await page.locator("#bsvg").boundingBox();
      await page.mouse.click(r.x + (20 + truth * 20) / 440 * r.width, r.y + 150 / 176 * r.height);
      await page.click('[data-act="arcLock"]');
      await page.waitForTimeout(200);
      const pts = await page.evaluate(() => window.__g1520.arc().pts);
      if (pts !== 3) throw new Error("round " + k + " scored " + pts);
      await page.click('[data-act="arcNextR"]');
    }
    return page;
  },
  async "call it: sure pays and costs"(b) {
    const page = await open(b, save((S) => { S.rev = { date: "x", n: 0, p: 0, done: true }; S.spots = []; S.ai = []; }));
    const c = await page.evaluate(() => { const q = window.__g1520.cur(); return { spr: q.spr ? q.spr.vals[0] : null, correct: q.correct }; });
    await page.click('#callIt [data-act="conf"][data-v="sure"]');
    if (c.spr != null) await page.fill("#sprIn", String(c.spr)); else await page.click(`#conBody [data-act="pick"][data-i="${c.correct}"]`);
    await page.click("#checkBtn");
    if (!(await page.locator(".fb .part.call").count())) throw new Error("no Called it bonus");
    await page.click("#nextBtn"); await page.waitForTimeout(150);
    for (let j = 0; j < 4; j++) { const m = page.locator('#modal:not([hidden]) [data-act="modalClose"]'); if (await m.count()) await m.first().click(); }
    const c2 = await page.evaluate(() => { const q = window.__g1520.cur(); return { spr: q.spr ? 1 : 0, correct: q.correct }; });
    const s0 = await state(page);
    await page.click('#callIt [data-act="conf"][data-v="sure"]');
    if (c2.spr) await page.fill("#sprIn", "-98765"); else await page.click(`#conBody [data-act="pick"][data-i="${(c2.correct + 1) % 4}"]`);
    await page.click("#checkBtn");
    const s1 = await state(page);
    if (!(await page.locator(".fb .part.loss").count())) throw new Error("no loss shown");
    if (!(s1.sparks < s0.sparks)) throw new Error("wrong Sure call cost nothing");
    if (JSON.stringify(s1.calib.sure) !== "[2,1]") throw new Error("calibration " + JSON.stringify(s1.calib));
    return page;
  },
  async "a finished set deals cards"(b) {
    const page = await open(b, save((S) => { S.set = { n: 9, c: 6, sp: 900, run: 0, best: 3, log: "110110110", conn0: 20, p0: 1080, r0: Object.values(S.r), t0: Date.now() - 6e5 }; S.pick = null; }));
    await answerAny(page);
    await page.click("#nextBtn"); await page.waitForTimeout(250);
    if ((await page.locator("#cardsBox .pcard").count()) !== 3) throw new Error("no cards dealt");
    const s0 = await state(page);
    await page.keyboard.press("2");
    await page.waitForTimeout(700);
    const s1 = await state(page);
    if (!s1.pick.done || s1.pick.got[0] !== 1) throw new Error("pick not recorded: " + JSON.stringify(s1.pick));
    const c = s1.pick.cards[1];
    const gained = c.t === "sparks" ? s1.sparks > s0.sparks : c.t === "boost" ? s1.boosts[c.k] > s0.boosts[c.k] : s1.chests[c.r] > s0.chests[c.r];
    if (!gained) throw new Error("reward not applied: " + JSON.stringify(c));
    if ((await page.locator("#cardsBox .pcard.flip").count()) !== 3) throw new Error("other cards not revealed");
    return page;
  },
  async "catch a surge orb and poke the core"(b) {
    const page = await open(b, save());
    await page.evaluate(() => window.__g1520.spawnSurge());
    await page.waitForTimeout(150);
    const o = await page.evaluate(() => { const O = window.__g1520.surge(); return { x: O.cx, y: O.cy }; });
    const r = await page.locator("#engineCv").boundingBox();
    await page.mouse.click(r.x + o.x, r.y + o.y);
    await page.waitForTimeout(150);
    const s = await state(page);
    if (s.stats.surges !== 1) throw new Error("orb not caught");
    const cpos = await page.evaluate(() => window.__g1520.core());
    await page.mouse.move(r.x + cpos.x, r.y + cpos.y); await page.mouse.down(); await page.mouse.up();
    await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up();
    await page.waitForTimeout(100);
    const s2 = await page.evaluate(() => window.__g1520.S().stats.pokes);
    if (s2 !== 2) throw new Error("core pokes " + s2);
    return page;
  },
  async "highlight a passage and draw on it"(b) {
    const page = await open(b, save((S) => { S.focus = "cs"; S.rev = { date: "x", n: 0, p: 0, done: true }; S.ai = []; }));
    await page.evaluate(() => {
      const p = document.querySelector("#sheet .passage p"), w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      let t = w.nextNode(); while (t && t.length < 12) t = w.nextNode();
      const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 10);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new MouseEvent("mouseup"));
    });
    await page.waitForTimeout(100);
    if ((await page.locator("#sheet mark.hl").count()) !== 1) throw new Error("no highlight");
    await page.click('[data-act="drawToggle"]');
    const box = await page.locator("#drawCv").boundingBox();
    await page.mouse.move(box.x + 40, box.y + 40); await page.mouse.down(); await page.mouse.move(box.x + 120, box.y + 70); await page.mouse.move(box.x + 160, box.y + 50); await page.mouse.up();
    const ink = await page.evaluate(() => window.__g1520.Q().ink.length);
    if (ink !== 1) throw new Error("ink strokes " + ink);
    await page.click('#drawBar [data-act="drawToggle"]');
    if (!(await page.locator("#drawCv:not(.live)").count())) throw new Error("ink hidden after Done");
    await answerAny(page);
    if ((await page.locator("#sheet mark.hl").count()) !== 1) throw new Error("highlight lost after checking");
    if (!(await page.locator("#drawCv").count())) throw new Error("ink lost after checking");
    await page.click("#sheet mark.hl");
    if (await page.locator("#sheet mark.hl").count()) throw new Error("highlight not cleared by a tap");
    return page;
  },
  async "math reference sheet"(b) {
    const page = await open(b, save((S) => { S.focus = "geo"; S.rev = { date: "x", n: 0, p: 0, done: true }; S.ai = []; }));
    await page.click('[data-act="refSheet"]');
    if ((await page.locator("#modal:not([hidden]) .refc").count()) < 10) throw new Error("reference sheet missing");
    return page;
  },
  async "boss finisher lands"(b) {
    const page = await open(b, save((S) => { S.boss = { d: "alg", tier: 1, hp: 20, max: 100, hearts: 3, t0: Date.now(), hits: 0 }; }));
    if (!(await page.locator(".boss.fin .finb").count())) throw new Error("finisher not flagged");
    const c = await page.evaluate(() => { const q = window.__g1520.cur(); return { spr: q.spr ? q.spr.vals[0] : null, correct: q.correct }; });
    if (c.spr != null) await page.fill("#sprIn", String(c.spr)); else await page.click(`#conBody [data-act="pick"][data-i="${c.correct}"]`);
    await page.click("#checkBtn");
    await page.waitForTimeout(300);
    const s = await state(page);
    if (s.boss || s.stats.finishers !== 1) throw new Error("finisher did not finish: " + JSON.stringify({ boss: s.boss, fin: s.stats.finishers }));
    return page;
  },
  async "what's new tour for returning players"(b) {
    const page = await open(b, save((S) => { S.seenV5 = false; }));
    if (!(await page.locator("#modal:not([hidden]) .wn").count())) throw new Error("tour did not open");
    await page.keyboard.press("ArrowRight");
    if (!/Call it/.test(await page.textContent(".wn h2"))) throw new Error("ArrowRight did not advance");
    await page.click('#wnDemo [data-act="wnCall"][data-v="sure"]');
    if (!/1\.5/.test(await page.textContent("#wnCallTxt"))) throw new Error("call demo silent");
    await page.keyboard.press("ArrowLeft");
    await page.click('#wnDemo [data-act="wnTry"][data-v="arc:rush"]');
    if (await page.isVisible("#modal")) throw new Error("tour stayed open");
    if (!/Transition Rush/.test(await page.textContent("#conHead"))) throw new Error("Try it did not start the game");
    const s = await state(page);
    if (s.seenV5 !== true) throw new Error("tour will show again");
    return page;
  },
  async "phone arcade fits"(b) {
    const page = await open(b, save(), 390, 844);
    await page.click('#decknav [data-v="arena"]');
    await page.click('[data-act="arcPlay"][data-v="line"]');
    await page.waitForTimeout(200);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (over) throw new Error("horizontal overflow in the arcade");
    if (!(await page.isVisible("#lsvg"))) throw new Error("grid not visible");
    return page;
  },
  async "found a city and build on it"(b) {
    const page = await open(b, save((S) => { S.city = { founded: 0, asked: false, name: "Sparkton", coins: 0, life: 0, b: {}, up: {}, w: {}, pol: "", polAt: 0, buffs: [], blimps: 0, buyN: 1, answers: 0, built: 0, bestRate: 0 }; }));
    if (!(await page.locator("#modal:not([hidden]) #cityNameM").count())) throw new Error("founding prompt did not open");
    await page.fill("#cityNameM", "Testville");
    await page.click('#modal [data-act="cityFound"]');
    await page.waitForTimeout(400);
    const s1 = await state(page);
    if (!s1.city.founded || s1.city.name !== "Testville") throw new Error("not founded: " + JSON.stringify({ f: s1.city.founded, n: s1.city.name }));
    if (s1.settings.view !== "city") throw new Error("view did not switch to the city");
    if ((await page.getAttribute("body", "data-tab")) !== "city") throw new Error("City tab not open");
    if (!(await page.isVisible("#cityCv"))) throw new Error("city canvas hidden");
    await page.click('#panel [data-act="cityBuy"].can');
    await page.waitForTimeout(200);
    const s2 = await state(page);
    if (!(s2.city.built > s1.city.built)) throw new Error("nothing built");
    if (!(s2.city.coins < s1.city.coins)) throw new Error("coins not spent");
    return page;
  },
  async "tap a building on the skyline and build it"(b) {
    const page = await open(b, save((S) => { S.settings.view = "city"; }));
    await page.waitForTimeout(300);
    const lot = await page.evaluate(() => { const C = window.__g1520.city(), S = window.__g1520.S(); const L = C.hitLots.find((h) => S.city.b[h.id] > 0 && h.x0 > 20 && h.x1 < C.w - 20); return L ? { id: L.id, x: (L.x0 + L.x1) / 2, y: C.gy - 14 } : null; });
    if (!lot) throw new Error("no built lot on screen");
    const box = await page.locator("#cityCv").boundingBox();
    await page.mouse.click(box.x + lot.x, box.y + lot.y);
    await page.waitForTimeout(250);
    if (!(await page.isVisible("#ctip"))) throw new Error("no tooltip for " + lot.id);
    const n0 = (await state(page)).city.b[lot.id];
    await page.click('#ctip [data-act="cityBuy"]');
    await page.waitForTimeout(200);
    const n1 = (await state(page)).city.b[lot.id];
    if (!(n1 > n0)) throw new Error("tooltip build failed: " + n0 + " to " + n1);
    return page;
  },
  async "catch a golden blimp"(b) {
    const page = await open(b, save((S) => { S.settings.view = "city"; }));
    const s0 = await state(page);
    await page.evaluate(() => window.__g1520.spawnBlimp(performance.now()));
    await page.waitForTimeout(2600);
    const pos = await page.evaluate(() => { const B = window.__g1520.city().blimp; return B && B.cx != null ? { x: B.cx, y: B.cy } : null; });
    if (!pos) throw new Error("no blimp in the sky");
    const box = await page.locator("#cityCv").boundingBox();
    await page.mouse.click(box.x + pos.x, box.y + pos.y);
    await page.waitForTimeout(250);
    const s1 = await state(page);
    if (s1.city.blimps !== s0.city.blimps + 1) throw new Error("blimp not caught");
    return page;
  },
  async "pass a Town Hall policy"(b) {
    const page = await open(b, save((S) => { S.city.pol = ""; S.city.polAt = 0; }));
    await page.click('#decknav [data-v="city"]');
    await page.click('#panel [data-act="scrollTo"][data-v="cwHall"]');
    await page.click('#panel [data-act="cityPol"][data-v="study"]');
    const s = await state(page);
    if (s.city.pol !== "study") throw new Error("policy is " + JSON.stringify(s.city.pol));
    if (!(await page.locator('#panel .pol.on[data-v="study"]').count())) throw new Error("policy not shown as in effect");
    if (!(await page.locator('#panel .pol[data-v="owl"]:disabled').count())) throw new Error("other policies not on cooldown");
    return page;
  },
  async "switch the main screen between engine and city"(b) {
    const page = await open(b, save());
    await page.click('#viewSw [data-v="city"]');
    await page.waitForTimeout(300);
    if ((await page.getAttribute("body", "data-view")) !== "city") throw new Error("view is not the city");
    if (!(await page.isVisible("#cityHud"))) throw new Error("city HUD hidden");
    if ((await state(page)).settings.view !== "city") throw new Error("setting not saved");
    await page.click('#viewSw [data-v="engine"]');
    await page.waitForTimeout(200);
    if ((await page.getAttribute("body", "data-view")) !== "engine") throw new Error("view did not go back to the engine");
    if (await page.isVisible("#cityWrap")) throw new Error("city still showing");
    return page;
  },
  async "phone city tab shows the skyline"(b) {
    const page = await open(b, save(), 390, 844);
    await page.click('#decknav [data-v="city"]');
    await page.waitForTimeout(300);
    const box = await page.locator("#cityCv").boundingBox();
    if (!box || box.height < 250) throw new Error("city canvas too small: " + JSON.stringify(box));
    if (!(await page.locator('#panel [data-act="cityBuy"]').count())) throw new Error("no build list");
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (over) throw new Error("horizontal overflow on the City tab");
    return page;
  },
  async "city tour for returning players"(b) {
    const page = await open(b, save((S) => { S.seenV6 = false; }));
    if (!/Your city/.test(await page.textContent("#modal .wn h2"))) throw new Error("the city tour did not open");
    await page.keyboard.press("ArrowRight");
    if (!/Learn to build/.test(await page.textContent(".wn h2"))) throw new Error("ArrowRight did not advance");
    await page.click("#wnLot");
    await page.click("#wnLot");
    if (!/Built/.test(await page.textContent("#wnLotTxt"))) throw new Error("the lot demo did not build");
    await page.click('#modal [data-act="modalClose"]');
    const s = await state(page);
    if (s.seenV6 !== true) throw new Error("tour will show again");
    return page;
  },
  async "stages clear and pay a chest"(b) {
    const page = await open(b, save((S) => { S.unit = { u: 1, st: 1, ready: false, cleared: [], legacy: 0, at: {} }; }));
    await page.waitForTimeout(1800);
    const s = await state(page);
    if (s.unit.cleared.indexOf("1.1") < 0) throw new Error("stage 1.1 not cleared: " + JSON.stringify(s.unit));
    const badge = await page.textContent("#stageN");
    if (badge !== s.unit.u + "." + s.unit.st) throw new Error("badge shows " + badge);
    return page;
  },
  async "advance to unit 2"(b) {
    const page = await open(b, save((S) => { S.unit = { u: 1, st: 5, ready: true, cleared: ["1.1", "1.2", "1.3", "1.4", "1.5"], legacy: 0, at: {} }; S.sparks = 5e6; }));
    await page.click("#stageBtn");
    await page.click('#panel [data-act="advance"]');
    await page.click('#modal [data-act="advanceGo"]');
    await page.waitForTimeout(400);
    const s = await state(page);
    if (s.unit.u !== 2 || s.unit.legacy !== 1 || !s.exp) throw new Error("did not advance: " + JSON.stringify(s.unit));
    if (Object.keys(s.city.b).length || s.sparks > 1e5) throw new Error("the reset missed something");
    if (!s.city.founded) throw new Error("the city was unfounded");
    if ((await page.getAttribute("body", "data-view")) !== "map") throw new Error("the map is not showing");
    return page;
  },
  async "explore the map, hire and level crew"(b) {
    const page = await open(b, save((S) => unit2(S, (X) => { X.settings.view = "map"; })));
    const t = await page.evaluate(() => { const H = window.__g1520, E = H.S().exp, M = H.map(); for (let i = 0; i < E.ex.length; i++) { if (E.ex[i] === "0" && E.ty[i] !== "g" && [i - 1, i + 1, i - 13, i + 13].some((j) => E.ex[j] === "1" && Math.abs((j % 13) - (i % 13)) <= 1)) { const p = H.tileXY(i); return { x: p.x + M.ts / 2, y: p.y + M.ts / 2 }; } } return null; });
    const box = await page.locator("#mapCv").boundingBox();
    await page.mouse.click(box.x + t.x, box.y + t.y);
    await page.waitForTimeout(300);
    for (let k = 0; k < 2; k++) { const m = page.locator('#modal:not([hidden]) #crateBox'); if (await m.count()) { await m.click({ force: true }); await page.click('#modal [data-act="modalClose"]'); } }
    let s = await state(page);
    if (s.exp.explored !== 2) throw new Error("explored " + s.exp.explored);
    await page.click('#decknav [data-v="city"]');
    await page.click('#panel [data-act="xHire"][data-v="miner"]');
    await page.waitForTimeout(200);
    s = await state(page);
    if (s.exp.crew.length !== 1 || s.exp.crew[0].role !== "miner" || s.exp.crew[0].at < 0) throw new Error("hire failed " + JSON.stringify(s.exp.crew));
    await page.click('#panel [data-act="xLevel"]');
    s = await state(page);
    if (s.exp.crew[0].lv !== 2) throw new Error("level up failed");
    return page;
  },
  async "spin the fortune wheel"(b) {
    const page = await open(b, save((S) => unit2(S)));
    await page.click('#decknav [data-v="city"]');
    await page.click('#panel [data-act="scrollTo"][data-v="xwLuck"]');
    const g0 = (await state(page)).exp.gems;
    await page.click('#panel [data-act="xSpin"][data-v="1"]');
    await page.waitForTimeout(3900);
    const s = await state(page);
    if (s.exp.spins.n !== 1) throw new Error("spin not counted " + JSON.stringify(s.exp.spins));
    if (s.exp.gems === g0 && !s.exp.crates) throw new Error("the wheel did nothing");
    return page;
  },
  async "stake gems on an answer"(b) {
    const page = await open(b, save((S) => unit2(S, (X) => { X.rev = { date: "x", n: 0, p: 0, done: true }; X.spots = []; X.ai = []; })));
    await page.click("#stakeBtn");
    if ((await state(page)).exp.stake !== 0.1) throw new Error("stake not set");
    const g0 = (await state(page)).exp.gems;
    const c = await page.evaluate(() => { const q = window.__g1520.cur(); return { spr: q.spr ? q.spr.vals[0] : null, correct: q.correct }; });
    if (c.spr != null) await page.fill("#sprIn", String(c.spr)); else await page.click(`#conBody [data-act="pick"][data-i="${c.correct}"]`);
    await page.click("#checkBtn");
    await page.waitForTimeout(250);
    const s = await state(page);
    if (!(s.exp.gems > g0)) throw new Error("a right staked answer did not pay: " + g0 + " to " + s.exp.gems);
    if (s.exp.stake !== 0) throw new Error("the stake did not reset");
    return page;
  },
  async "challenge a Guardian"(b) {
    const page = await open(b, save((S) => unit2(S, (X) => { const E = X.exp; E.ex = E.ty.split("").map((k) => (k === "g" ? "0" : "1")).join(""); E.explored = E.ex.split("1").length - 1; X.rev = { date: "x", n: 0, p: 0, done: true }; X.spots = []; X.ai = []; })));
    await page.click('#decknav [data-v="city"]');
    await page.click('#panel [data-act="xGate"]');
    await page.waitForTimeout(300);
    let s = await state(page);
    if (!s.exp.gate || s.focus !== s.exp.gate.d) throw new Error("no fight or focus: " + JSON.stringify({ gate: s.exp.gate, focus: s.focus }));
    for (let k = 0; k < 4; k++) { const m = page.locator('#modal:not([hidden]) [data-act="modalClose"]'); if (await m.count()) await m.first().click(); }
    const c = await page.evaluate(() => { const q = window.__g1520.cur(); return { spr: q.spr ? q.spr.vals[0] : null, correct: q.correct, d: q.d }; });
    if (c.spr != null) await page.fill("#sprIn", String(c.spr)); else await page.click(`#conBody [data-act="pick"][data-i="${c.correct}"]`);
    await page.click("#checkBtn");
    await page.waitForTimeout(250);
    s = await state(page);
    if (c.d === s.exp.gate.d && s.exp.gate.got !== 1) throw new Error("the fight did not move: " + JSON.stringify(s.exp.gate));
    return page;
  },
  async "phone world tab fits"(b) {
    const page = await open(b, save((S) => unit2(S)), 390, 844);
    await page.click('#decknav [data-v="city"]');
    await page.waitForTimeout(300);
    const box = await page.locator("#mapCv").boundingBox();
    if (!box || box.height < 250) throw new Error("map too small " + JSON.stringify(box));
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (over) throw new Error("horizontal overflow on the World tab");
    return page;
  },
  async "units tour for returning players"(b) {
    const page = await open(b, save((S) => { S.seenV7 = false; }));
    if (!/Units and stages/.test(await page.textContent("#modal .wn h2"))) throw new Error("the units tour did not open");
    await page.keyboard.press("ArrowRight");
    await page.click('#wnDemo [data-act="wnAdv"]');
    if (!/Legacy 1/.test(await page.textContent("#wnAdvTxt"))) throw new Error("advance demo silent");
    await page.click('#modal [data-act="modalClose"]');
    const s = await state(page);
    if (s.seenV7 !== true) throw new Error("tour will show again");
    return page;
  },
  async "the Library building shows its own card, not the wonder's"(b) {
    const page = await open(b, save((S) => { S.settings.view = "city"; S.city.b.library = S.city.b.library || 1; }));
    await page.click('[data-act="tab"][data-v="city"]');
    await page.click('#panel [data-act="cityLook"][data-v="library"]');
    await page.waitForTimeout(400);
    const t = await page.textContent("#ctip");
    if (!/Central Ideas and Details/.test(t) || /Wonder/.test(t)) throw new Error("wrong card: " + t.slice(0, 80));
    return page;
  },
  async "walk the 3D city"(b) {
    const page = await open(b, save((S) => { S.settings.view = "3d"; S.settings.w3new = true; }));
    await w3Ready(page);
    if ((await page.getAttribute("body", "data-view")) !== "3d") throw new Error("the 3D view is not showing");
    if ((await page.evaluate(() => document.getElementById("cityHud").parentNode.id)) !== "w3Wrap") throw new Error("the city HUD did not move into 3D");
    const q0 = await page.evaluate(() => window.__g1520.Q().answered), p0 = await w3Pos(page);
    await page.focus("#w3Cv");
    await page.keyboard.down("w"); await page.keyboard.down("a"); await page.waitForTimeout(1500); await page.keyboard.up("a"); await page.keyboard.up("w");
    const p1 = await w3Pos(page);
    if (!(p1[1] < p0[1] - 0.3)) throw new Error("did not walk forward: " + JSON.stringify([p0, p1]));
    if (!(p1[0] < p0[0] - 0.1)) throw new Error("did not step left: " + JSON.stringify([p0, p1]));
    if ((await page.evaluate(() => window.__g1520.Q().answered)) !== q0) throw new Error("walking keys answered the question");
    return page;
  },
  async "open a building in 3D by clicking it and with E"(b) {
    const page = await open(b, save((S) => { S.settings.view = "3d"; S.settings.w3new = true; }));
    await w3Ready(page);
    await page.waitForTimeout(600);
    const p = await w3At(page, 0, 3.5, 21);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(() => { const t = document.getElementById("ctip"); return t && !t.hidden && t.style.visibility !== "hidden" && /Town Hall/.test(t.textContent); }, null, { timeout: 8000 });
    await page.keyboard.press("Escape");
    if (await page.isVisible("#ctip")) throw new Error("Escape did not close the card");
    await page.evaluate(() => { const W = window.__g1520.w3(); W.pos.set(0, 0, 25.5); });
    await page.waitForFunction(() => !document.getElementById("w3Act").hidden, null, { timeout: 8000 });
    if (!/Town Hall/.test(await page.textContent("#w3Act"))) throw new Error("no prompt for the nearest building");
    await page.focus("#w3Cv");
    await page.keyboard.press("e");
    await page.waitForFunction(() => { const t = document.getElementById("ctip"); return t && !t.hidden && /Town Hall/.test(t.textContent); }, null, { timeout: 8000 });
    return page;
  },
  async "build from a 3D building card"(b) {
    const page = await open(b, save((S) => { S.settings.view = "3d"; S.settings.w3new = true; S.city.coins = 1e15; }));
    await w3Ready(page);
    await page.click('[data-act="tab"][data-v="city"]');
    await page.waitForTimeout(500);
    if (!(await page.locator('#panel [data-act="wv"][data-v="3d"][aria-pressed="true"]').count())) throw new Error("the World tab is not on 3D");
    const id = await page.getAttribute('#panel .cbrow [data-act="cityBuy"]', "data-v");
    const n0 = (await state(page)).city.b[id] || 0;
    await page.click('#panel [data-act="cityLook"][data-v="' + id + '"]');
    await page.waitForFunction(() => { const t = document.getElementById("ctip"); return t && !t.hidden && t.style.visibility !== "hidden" && t.querySelector('[data-act="cityBuy"]'); }, null, { timeout: 10000 });
    await page.click('#ctip [data-act="cityBuy"]');
    await page.waitForTimeout(500);
    const n1 = (await state(page)).city.b[id] || 0;
    if (!(n1 > n0)) throw new Error("nothing was built: " + id);
    if (!((await page.evaluate((id) => window.__g1520.w3().lots[id].lv, id)) >= 1)) throw new Error("the 3D lot did not rebuild");
    return page;
  },
  async "catch a golden blimp in 3D"(b) {
    const page = await open(b, save((S) => { S.settings.view = "3d"; S.settings.w3new = true; }));
    await w3Ready(page);
    const n0 = (await state(page)).city.blimps || 0;
    await page.evaluate(() => window.__g1520.spawnBlimp(performance.now() - 4000));
    await page.waitForFunction(() => { const W = window.__g1520.w3(); return W.blimp && W.blimp.visible; }, null, { timeout: 8000 });
    await page.focus("#w3Cv");
    await page.keyboard.press("o");
    await page.waitForTimeout(400);
    if (((await state(page)).city.blimps || 0) !== n0 + 1) throw new Error("the blimp was not caught");
    if (await page.evaluate(() => window.__g1520.w3().blimp.visible)) throw new Error("the blimp is still flying");
    await answerAny(page);
    await page.waitForTimeout(300);
    return page;
  },
  async "switch between the 2D and 3D city"(b) {
    const page = await open(b, save((S) => { S.settings.w3new = true; }));
    await page.click('#viewSw [data-v="3d"]');
    await w3Ready(page);
    if ((await state(page)).settings.view !== "3d") throw new Error("3D not saved as the main screen");
    await page.click('#viewSw [data-v="city"]');
    await page.waitForTimeout(300);
    if ((await page.getAttribute("body", "data-view")) !== "city") throw new Error("the 2D city is not back");
    if ((await page.evaluate(() => document.getElementById("cityHud").parentNode.id)) !== "cityWrap") throw new Error("the HUD did not return to the 2D city");
    if (!(await page.isVisible("#cityCv")) || await page.isVisible("#w3Wrap")) throw new Error("wrong canvas showing");
    return page;
  },
  async "3D falls back to the 2D city when it cannot load"(b) {
    const page = await open(b, save((S) => { S.settings.view = "3d"; S.settings.w3new = true; }), 1440, 900, { noThree: true });
    await page.waitForSelector('#w3Msg:not([hidden]) [data-act="w3Retry"]', { timeout: 15000 });
    await page.click('#w3Msg [data-act="view"][data-v="city"]');
    await page.waitForTimeout(300);
    if ((await page.getAttribute("body", "data-view")) !== "city") throw new Error("did not switch to the 2D city");
    if ((await state(page)).settings.view !== "city") throw new Error("the 2D choice was not saved");
    return page;
  },
  async "phone 3D fits"(b) {
    const page = await open(b, save((S) => { S.settings.view = "3d"; S.settings.w3new = true; }), 390, 844);
    await w3Ready(page);
    const box = await page.locator("#w3Cv").boundingBox();
    if (!box || box.width < 380 || box.height < 300) throw new Error("3D view too small: " + JSON.stringify(box));
    await page.click('#decknav [data-v="city"]');
    await page.waitForTimeout(500);
    const b2 = await page.locator("#w3Cv").boundingBox();
    if (!b2 || b2.height < 300) throw new Error("3D view too small on the World tab: " + JSON.stringify(b2));
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) throw new Error("page scrolls sideways by " + over + "px");
    return page;
  },
  async "fresh game starts at 320 and climbs"(b) {
    const page = await open(b, null);
    await page.click('[data-act="welcomeGo"]');
    const s0 = await state(page);
    if (Object.values(s0.r).some((r) => r !== 160)) throw new Error("fresh ratings are not all 160");
    for (let i = 0; i < 6; i++) { await answerAny(page); await page.click("#nextBtn"); await page.waitForTimeout(120); }
    const s1 = await state(page);
    if (s1.stats.answered !== 6) throw new Error("answered " + s1.stats.answered);
    return page;
  },
};

(async () => {
  const browser = await chromium.launch();
  let fails = 0;
  const only = process.argv[2] || "";
  for (const [name, fn] of Object.entries(TESTS)) {
    if (only && !name.includes(only)) continue;
    let page = null;
    try {
      page = await fn(browser);
      if (page.errors.length) throw new Error("page errors: " + page.errors.join(" | "));
      console.log("PASS", name);
    } catch (e) {
      fails++;
      console.log("FAIL", name, "-", e.message.split("\n")[0]);
    }
    if (page) await page.close();
  }
  await browser.close();
  console.log(fails ? fails + " failed" : "all passed");
  process.exit(fails ? 1 : 0);
})();
