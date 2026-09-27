// Functional checks: drives the real UI from simulated saves and asserts on the saved state.
//   NODE_PATH=$(npm root -g) node tools/flows.cjs [name-filter]
const path = require("path");
const { chromium } = require("playwright");
const { simulate } = require("./sim.cjs");
const { routeThree } = require("./three.cjs");

// GAME=dist/To-1520/to-1520.html checks the PC edition instead.
const file = "file://" + path.resolve(__dirname, "..", process.env.GAME || "index.html");
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
  // Most checks drive the engine screen; the ones about the town set the view themselves.
  S.settings.view = "engine";
  if (edit) edit(S);
  return JSON.stringify(S);
}
async function open(browser, json, w, h, opts) {
  const page = await browser.newPage({ viewport: { width: w || 1440, height: h || 900 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.route(/^https?:\/\//, (r) => r.abort());
  if (!(opts && opts.noThree)) await routeThree(page);
  // Seed the save once per page: only while there is no save yet (or it is still the untouched seed), so a reload
  // shows what the game saved rather than the starting save. No marker is needed, so nothing can lose it.
  if (json) await page.addInitScript((j) => { try { var cur = localStorage.getItem("grind1520.save.v1"); if (cur === null || cur === j) localStorage.setItem("grind1520.save.v1", j); } catch (e) {} }, json);
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
async function answerRight(page) {
  const q = await page.evaluate(() => { const c = window.__g1520.cur(); return { spr: c.spr ? String(c.spr.vals[0]) : null, a: c.correct }; });
  if (q.spr != null) await page.locator("#sprIn").fill(q.spr); else await page.click(`#conBody [data-act="pick"][data-i="${q.a}"]`);
  await page.click("#checkBtn");
  await page.waitForTimeout(250);
  for (let j = 0; j < 4; j++) { const m = page.locator('#modal:not([hidden]) [data-act="modalClose"]'); if (await m.count()) { await m.first().click(); await page.waitForTimeout(80); } }
}
// A zone at tier 1 with nothing bought and its meters at zero.
function zoneReset(S, d) { S.zone[d].t = 1; S.zone[d].up = {}; }
async function answerWrong(page) {
  const q = await page.evaluate(() => { const c = window.__g1520.cur(); return { spr: !!c.spr, a: c.correct }; });
  if (q.spr) await page.locator("#sprIn").fill("-98765.4321"); else await page.click(`#conBody [data-act="pick"][data-i="${(q.a + 1) % 4}"]`);
  await page.click("#checkBtn");
  await page.waitForTimeout(250);
}
// The boosted late-game dev save, for checking unlocked features (not pacing).
function lateSave(edit) {
  const t = require("fs").readFileSync(path.join(__dirname, "..", "dist", "dev-save.txt"), "utf8").trim();
  const S = JSON.parse(Buffer.from(t.slice(6), "base64").toString("utf8"));
  S.lastSeen = S.lastInteract = Date.now(); S.seenV9 = true; S.settings.view = "engine";
  if (edit) edit(S);
  return JSON.stringify(S);
}
// A Transitions record that has earned the Harbor Bridge.
function harborReady(S) { S.sk["eoi|Transitions"] = { n: 14, c: 12, rr: "1111111110" }; S.world = {}; }
const pageFits = (page) => page.evaluate(() => { const r = []; if (document.documentElement.scrollWidth > innerWidth + 1) r.push("page " + document.documentElement.scrollWidth); const hud = document.querySelector(".hud-in"); if (hud.scrollWidth > hud.clientWidth + 1) r.push("top bar " + hud.scrollWidth + ">" + hud.clientWidth); if (document.getElementById("gearBtn").getBoundingClientRect().right > innerWidth) r.push("settings off-screen"); return r.join(", "); });

const TESTS = {
  async "buy a hub, a pathway, and an upgrade"(b) {
    const page = await open(b, save((S) => { S.sparks = 1e13; Object.keys(S.hub).forEach((d) => { S.hub[d] = 0; }); }));
    const s0 = await state(page);
    // Hubs live in each zone now; pathways and upgrades stay in Evolution.
    await page.click('[data-act="tab"][data-v="zones"]');
    await page.click('#panel [data-act="zoneOpen"][data-v="alg"]');
    await page.click('#panel [data-act="buyHub"].can');
    await page.click('#decknav [data-v="evolution"]');
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
  async "a new game opens its town; only the next locked place shows"(b) {
    const page = await open(b, null);
    await page.click('[data-act="welcomeGo"]');
    const s0 = await state(page);
    if (!s0.city.founded || s0.settings.view !== "city") throw new Error("no town on a new game: " + JSON.stringify([s0.city.founded, s0.settings.view]));
    if ((await page.getAttribute("body", "data-view")) !== "city") throw new Error("the main screen is not the town");
    const tabs = await page.$$eval("#decknav .dn-tab b", (els) => els.map((e) => e.textContent.trim().replace(/NEW$/, "")));
    if (tabs[0] !== "Town" || tabs[1] !== "Town Hall") throw new Error("places bar: " + tabs.join(" | "));
    if (tabs.filter((t) => t === "Ascend").length !== 1 || (await page.locator("#decknav .dn-tab.locked").count()) !== 1) throw new Error("exactly one locked place should show: " + tabs.join(" | "));
    await page.click('#decknav [data-v="city"]');
    if (!(await page.isVisible("#panelWrap")) || !/Town Hall/.test(await page.textContent("#panel .crumb"))) throw new Error("the Town Hall did not open at stage 0");
    await page.click('#decknav [data-v="ascend"]');
    if (!/locked/i.test(await page.textContent("#toasts"))) throw new Error("no lock toast for Ascend");
    // Things to do and buy are open from the first answer: the Arcade and the zones. Bosses wait for stage 1.
    await page.click('#decknav [data-v="arena"]');
    if (!(await page.isVisible("#panelWrap"))) throw new Error("the Arena is closed on a new game");
    if (!(await page.locator('#panel [data-act="arcPlay"]').count())) throw new Error("no Arcade games on a new game");
    if (await page.locator('#panel [data-act="bossGo"]').count()) throw new Error("bosses open at stage 0");
    await page.click('#decknav [data-v="zones"]');
    if ((await page.locator('#panel [data-act="zoneOpen"]').count()) < 8) throw new Error("zones closed on a new game");
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
    // Idle income keeps flowing between saves, so check the wager on the answer itself.
    const wager = await page.evaluate(() => window.__g1520.Q().res.wager || 0);
    if (!(wager > 0)) throw new Error("wrong Sure call cost nothing");
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
  async "an unfounded save gets its town; rename it and build on it"(b) {
    const page = await open(b, save((S) => { S.settings.view = "city"; S.city = { founded: 0, asked: false, name: "Sparkton", coins: 5000, life: 0, b: {}, up: {}, w: {}, pol: "", polAt: 0, buffs: [], blimps: 0, buyN: 1, answers: 0, built: 0, bestRate: 0 }; }));
    if (await page.locator("#modal:not([hidden]) #cityNameM").count()) throw new Error("the old founding prompt came back");
    const s0 = await state(page);
    if (!s0.city.founded || s0.city.name !== "Sparkton") throw new Error("the town was not founded on load: " + JSON.stringify({ f: s0.city.founded, n: s0.city.name }));
    if (!(await page.isVisible("#cityCv"))) throw new Error("town canvas hidden");
    await page.click('#decknav [data-v="city"]');
    await page.click('#panel [data-act="cityRenameOpen"]');
    await page.fill("#cityNameIn", "Testville");
    await page.click('#panel [data-act="cityRename"]');
    await page.waitForTimeout(200);
    const s1 = await state(page);
    if (s1.city.name !== "Testville") throw new Error("rename failed: " + s1.city.name);
    if ((await page.getAttribute("body", "data-tab")) !== "city") throw new Error("Town Hall not open");
    await page.click('#panel [data-act="cityPage"][data-v="build"]');
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
    // The one-time "walk your town in 3D" note sits where the blimp flies, so mark it seen.
    const page = await open(b, save((S) => { S.settings.view = "city"; S.settings.w3new = true; }));
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
    await page.click('#panel [data-act="cityPage"][data-v="build"]');
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
  async "the Library building shows its own page and card, not the wonder's"(b) {
    const page = await open(b, save((S) => { S.settings.view = "city"; S.city.b.library = S.city.b.library || 1; }));
    await page.click('[data-act="tab"][data-v="city"]');
    await page.click('#panel [data-act="cityPage"][data-v="build"]');
    await page.click('#panel .cthumb[data-v="library"]');
    await page.waitForTimeout(300);
    const h = await page.textContent("#panel .glass-h");
    if (!/Library/.test(h) || !/Central Ideas and Details/.test(h) || /Wonder|Grand/.test(h)) throw new Error("wrong page: " + h.slice(0, 100));
    await page.click('#panel [data-act="cityLook"][data-v="library"]');
    await page.waitForTimeout(400);
    const t = await page.textContent("#ctip");
    if (!/Central Ideas and Details/.test(t) || /Wonder/.test(t)) throw new Error("wrong card: " + t.slice(0, 80));
    return page;
  },
  async "move, hide, and resize the question panel"(b) {
    const page = await open(b, save());
    await page.click("#dockBtn");
    await page.click('#modal [data-act="dockSet"][data-v="dock:left"]');
    await page.click('#modal [data-act="dockSet"][data-v="qsize:l"]');
    await page.click('#modal [data-act="modalClose"]');
    await page.waitForTimeout(300);
    const con = await page.locator("#console").boundingBox(), stg = await page.locator("#stage").boundingBox();
    if (!(con.x < stg.x)) throw new Error("the panel is not on the left: " + JSON.stringify([con, stg]));
    if ((await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".stem")).fontSize))) < 22) throw new Error("large text did not apply");
    await page.keyboard.press("q");
    await page.waitForTimeout(200);
    if (await page.isVisible("#console")) throw new Error("Q did not hide the panel");
    const q0 = await page.evaluate(() => window.__g1520.Q().answered);
    await page.keyboard.press("a");
    if ((await page.evaluate(() => window.__g1520.Q().answered)) !== q0) throw new Error("a hidden panel still took an answer");
    await page.click("#qShow");
    await page.waitForTimeout(200);
    if (!(await page.isVisible("#console"))) throw new Error("the Questions button did not bring the panel back");
    const s = await state(page);
    if (s.settings.dock !== "left" || s.settings.qsize !== "l") throw new Error("layout not saved: " + JSON.stringify(s.settings));
    return page;
  },
  async "save now, download a save file, and load one"(b) {
    const page = await open(b, save());
    await page.click("#gearBtn");
    await page.click('#modal [data-act="saveNow"]');
    if (!/Saved/.test(await page.textContent(".toasts"))) throw new Error("no saved message");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click('#modal [data-act="saveFile"]')]);
    const code = require("fs").readFileSync(await dl.path(), "utf8");
    if (!/^G1520:/.test(code) || !/^to-1520-save-\d{4}-\d{2}-\d{2}\.txt$/.test(dl.suggestedFilename())) throw new Error("bad save file: " + dl.suggestedFilename());
    const S = JSON.parse(Buffer.from(code.slice(6), "base64").toString("utf8"));
    S.city.name = "Filetown";
    const f = require("path").join(require("os").tmpdir(), "g1520-load-test.txt");
    require("fs").writeFileSync(f, "G1520:" + Buffer.from(JSON.stringify(S), "utf8").toString("base64"));
    await page.setInputFiles("#loadFileIn", f);
    await page.waitForTimeout(500);
    if ((await state(page)).city.name !== "Filetown") throw new Error("the save file did not load");
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(200);
    return page;
  },
  async "expand a zone and buy from its tree"(b) {
    const page = await open(b, save((S) => { S.sparks = 1e9; zoneReset(S, "alg"); ENG.DOMAINS.alg.skills.forEach((sk) => { const k = "alg|" + sk; S.sk[k] = Object.assign(S.sk[k] || { n: 0 }, { c: Math.max(12, (S.sk[k] || {}).c || 0), n: Math.max(20, (S.sk[k] || {}).n || 0) }); }); }));
    await page.click('[data-act="tab"][data-v="zones"]');
    await page.click('#panel [data-act="zoneOpen"][data-v="alg"]');
    if (!/Engine Works/i.test(await page.textContent("#panel h2"))) throw new Error("zone page did not open");
    await page.click('#panel [data-act="zBuy"][data-v="alg:r1"]');
    await page.click('#panel [data-act="zExpand"][data-v="alg"]');
    const s = await state(page);
    if (s.zone.alg.up.r1 !== 1) throw new Error("tree node not bought: " + JSON.stringify(s.zone.alg.up));
    if (s.zone.alg.t !== 2) throw new Error("zone did not expand: tier " + s.zone.alg.t);
    if (!(await page.locator('#panel [data-act="zBuy"][data-v="alg:ans"]').count())) throw new Error("row 2 of the tree did not open");
    return page;
  },
  async "a right answer in Craft and Structure forges at full heat"(b) {
    const page = await open(b, save((S) => { S.focus = "cs"; S.spots = []; S.rev = null; S.boss = null; S.ai = []; S.zone.cs.heat = 5; S.zone.cs.up = {}; S.stats.forged = 0; }));
    if (!(await page.locator("#conBody .zstrip").count())) throw new Error("no zone strip under the question");
    if (!/Word Forge/i.test(await page.textContent("#conBody .zstrip"))) throw new Error("strip is not the Word Forge: " + (await page.textContent("#conBody .zstrip")));
    await answerRight(page);
    const s = await state(page);
    if (s.zone.cs.heat !== 0 || s.stats.forged !== 1) throw new Error("not forged: heat " + s.zone.cs.heat + ", forged " + s.stats.forged);
    if (!/Forged/.test(await page.textContent("#conBody .fb-parts"))) throw new Error("no Forged line in the payout");
    return page;
  },
  async "launch rocket fuel and withdraw the vault"(b) {
    const page = await open(b, save((S) => { S.zone.adv.fuel = 4; S.zone.psda.vault = 5000; }));
    await page.click('[data-act="tab"][data-v="zones"]');
    await page.click('#panel [data-act="zoneOpen"][data-v="adv"]');
    const s0 = await state(page);
    await page.click('#panel [data-act="zLaunch"]');
    const s1 = await state(page);
    if (s1.zone.adv.fuel !== 1 || !(s1.sparks > s0.sparks)) throw new Error("launch did not pay: fuel " + s1.zone.adv.fuel);
    await page.click('#panel [data-act="zoneOpen"][data-v=""]');
    await page.click('#panel [data-act="zoneOpen"][data-v="psda"]');
    await page.click('#panel [data-act="zWithdraw"]');
    const s2 = await state(page);
    if (s2.zone.psda.vault !== 0 || !(s2.sparks >= s1.sparks + 4999)) throw new Error("withdraw did not pay");
    return page;
  },
  async "claim the Level Road, spend a talent point, and wear a title"(b) {
    const page = await open(b, save((S) => { S.road = { c: {} }; S.tal = { g: {}, k: {} }; S.title = "new"; }));
    const s0 = await state(page);
    await page.click("#lvlChip");
    await page.click('#modal [data-act="roadAll"]');
    const s1 = await state(page);
    const chests = (S) => S.chests.c + S.chests.r + S.chests.e + S.chests.l;
    if (!Object.keys(s1.road.c).length || !(chests(s1) > chests(s0))) throw new Error("road rewards not claimed");
    await page.click('#modal [data-act="talBuy"][data-v="xp"]');
    await page.click('#modal [data-act="titleSet"][data-v="apprentice"]');
    const s2 = await state(page);
    if (s2.tal.g.xp !== 1) throw new Error("talent not bought");
    if (s2.title !== "apprentice") throw new Error("title is " + s2.title);
    return page;
  },
  async "zones tour for returning players"(b) {
    const page = await open(b, save((S) => { S.seenV8 = false; }));
    if (!(await page.locator("#modal:not([hidden]) .wn").count())) throw new Error("tour did not open");
    if (!/Zones/.test(await page.textContent(".wn h2"))) throw new Error("tour did not start on Zones");
    await page.click('#wnDemo [data-act="wnZone"][data-v="adv"]');
    if (!/Rocket Fuel/.test(await page.textContent("#wnZoneTxt"))) throw new Error("zone demo silent");
    await page.keyboard.press("ArrowRight");
    for (let k = 0; k < 6; k++) await page.click('#wnDemo [data-act="wnHeat"]');
    if (!/Forged/.test(await page.textContent("#wnHeatTxt"))) throw new Error("forge demo did not forge");
    await page.click('#modal [data-act="wnTry"][data-v="rules"]');
    if (await page.isVisible("#modal")) throw new Error("tour stayed open");
    const s = await state(page);
    if (s.seenV8 !== true) throw new Error("tour will show again");
    return page;
  },
  async "phone zones fit"(b) {
    const page = await open(b, save(), 390, 844);
    await page.click('#decknav [data-v="zones"]');
    await page.click('#panel [data-act="zoneOpen"][data-v="geo"]');
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (over) throw new Error("horizontal overflow on a zone page");
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
    // E opens the place as a page: the Town Hall's own page here.
    await page.waitForFunction(() => document.body.dataset.tab === "city" && /Town Hall/.test((document.querySelector("#panel .crumb") || {}).textContent || ""), null, { timeout: 8000 });
    if (!(await page.isVisible("#w3Cv"))) throw new Error("the 3D town disappeared behind the page");
    return page;
  },
  async "build from a 3D building card"(b) {
    const page = await open(b, save((S) => { S.settings.view = "3d"; S.settings.w3new = true; S.city.coins = 1e15; }));
    await w3Ready(page);
    await page.click('[data-act="tab"][data-v="city"]');
    await page.waitForTimeout(500);
    if (!(await page.locator('#panel [data-act="wv"][data-v="3d"][aria-pressed="true"]').count())) throw new Error("the World tab is not on 3D");
    await page.click('#panel [data-act="cityPage"][data-v="build"]');
    const id = await page.getAttribute('#panel .cbrow [data-act="cityBuy"]', "data-v");
    const n0 = (await state(page)).city.b[id] || 0;
    await page.click('#panel .cthumb[data-v="' + id + '"]');
    await page.waitForTimeout(300);
    if (!(await page.locator('#panel [data-act="roundGo"]').count())) throw new Error("the building's page did not open");
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
    // The PC edition carries its own Three.js, so with no network it should simply work.
    if (await page.locator("#three-src").count()) { await w3Ready(page); return page; }
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
  async "the intro: answer, the world responds, a free upgrade, then the next goal"(b) {
    const page = await open(b, null);
    await page.click('[data-act="welcomeGo"]');
    await page.waitForSelector("#coach", { timeout: 5000 });
    if (!/first question/i.test(await page.textContent("#coach"))) throw new Error("no prompt to answer");
    await answerRight(page);
    await page.waitForFunction(() => { const c = document.getElementById("coach"); return c && /engine grew|town noticed/i.test(c.textContent) && c.style.visibility !== "hidden"; }, null, { timeout: 5000 });
    await page.click('#coach [data-act="onbNext"]');
    await answerAny(page); await page.click("#nextBtn");
    await answerAny(page);
    await page.waitForSelector('#modal:not([hidden]) [data-act="onbGift"]', { timeout: 5000 });
    await page.click('#modal [data-act="onbGift"][data-v="focus"]');
    await page.waitForFunction(() => { const c = document.getElementById("coach"); return c && /Adventure/.test(c.textContent) && c.style.visibility !== "hidden"; }, null, { timeout: 5000 });
    const s1 = await state(page);
    if (s1.up.focus !== 1 || s1.onb.gift !== "focus") throw new Error("the free upgrade was not installed");
    await page.click('#coach [data-act="onbAdv"]');
    await page.waitForFunction(() => { const c = document.getElementById("coach"); return c && /places live|Everything else/.test(c.textContent); }, null, { timeout: 5000 });
    await page.click('#coach [data-act="onbDone"]');
    const s2 = await state(page);
    if (!s2.onb.done) throw new Error("the intro did not finish");
    if (!s2.adv || !s2.adv.started) throw new Error("the adventure did not start from the intro");
    // Replaying the intro walks through it again, but the free upgrade is paid only once.
    await page.click("#gearBtn"); await page.click('#modal [data-act="onbReplay"]');
    await page.waitForSelector("#coach", { timeout: 5000 });
    await answerAny(page); await page.waitForTimeout(800);
    await page.click('#coach [data-act="onbNext"]');
    await answerAny(page); await page.click("#nextBtn"); await answerAny(page);
    await page.waitForFunction(() => { const c = document.getElementById("coach"); return c && /Adventure/.test(c.textContent); }, null, { timeout: 5000 });
    if (await page.locator('#modal:not([hidden]) [data-act="onbGift"]').count()) throw new Error("the gift was offered twice");
    if ((await state(page)).up.focus !== 1) throw new Error("the gift was paid twice");
    return page;
  },
  async "skip the intro; existing players get what's new, not the intro"(b) {
    const p1 = await open(b, null);
    await p1.click('[data-act="welcomeSkip"]');
    await p1.waitForTimeout(300);
    if (await p1.locator("#coach").count()) throw new Error("coach marks after skipping");
    if (!(await p1.locator('#conAdv [data-act="advStart"]').count())) throw new Error("no adventure bar after skipping");
    if (!(await state(p1)).onb.done) throw new Error("the skip was not saved");
    if (p1.errors.length) throw new Error("page errors: " + p1.errors.join(" | "));
    await p1.close();
    const page = await open(b, save((S) => { S.v = 8; delete S.seenV9; delete S.seenV10; delete S.onb; delete S.adv; delete S.lrn; delete S.world; delete S.recov; delete S.gb.hist; delete S.tools; delete S.opps; delete S.intro; }));
    if (!(await page.locator('#modal:not([hidden]) [data-act="new10Go"]').count())) throw new Error("no what's new for a v8 save");
    if (await page.locator("#coach").count()) throw new Error("an existing player got the beginner intro");
    await page.click('#modal [data-act="new10Go"]');
    await page.waitForTimeout(400);
    if ((await page.getAttribute("body", "data-view")) !== "city") throw new Error("Show me the town did not show the town");
    const s = await state(page);
    if (s.v !== 10 || !s.seenV9 || !s.seenV10 || !s.onb.done) throw new Error("migration flags: " + JSON.stringify([s.v, s.seenV9, s.seenV10, s.onb]));
    if (!Array.isArray(s.gb.hist) || !s.lrn || !s.world || !s.tools || !s.opps || !s.intro) throw new Error("new fields missing after migration");
    if (!s.intro.town || s.intro.place) throw new Error("intro flags for an existing player: " + JSON.stringify(s.intro));
    return page;
  },
  async "today's adventure: follow a step, resume after a reload, claim once"(b) {
    const page = await open(b, save((S) => { S.adv = null; S.spots = []; S.onb = { step: 9, done: true }; }));
    await page.click('#conAdv [data-act="advOpen"]');
    await page.waitForSelector("#modal:not([hidden]) .advlen");
    await page.click('#modal [data-act="advLen"][data-v="quick"]');
    await page.click('#modal [data-act="advStart"]');
    let s = await state(page);
    if (!s.adv.started || s.adv.len !== "quick") throw new Error("did not start a quick adventure");
    const st0 = s.adv.steps[s.adv.i];
    const q = await page.evaluate(() => { const c = window.__g1520.cur(); return { d: c.d, sk: c.sk }; });
    if (q.d !== st0.d || (st0.k === "skill" && q.sk !== st0.sk)) throw new Error("the question is off the plan: " + JSON.stringify([q, st0]));
    for (let i = 0; i < 14; i++) { s = await state(page); if (s.adv.i > 0) break; await answerRight(page); await page.click("#nextBtn"); await page.waitForTimeout(120); }
    if (s.adv.i < 1) throw new Error("the first step never finished");
    await page.reload(); await page.waitForTimeout(900);
    const s2 = await state(page);
    const advSum = (S) => S.adv ? { i: S.adv.i, started: !!S.adv.started, day: S.adv.day, steps: S.adv.steps.map((x) => x.k + ":" + x.st + ":" + x.p) } : null;
    if (!s2.adv || s2.adv.i !== s.adv.i || !s2.adv.started || s2.adv.day !== s.adv.day) throw new Error("the adventure did not survive a reload: " + JSON.stringify({ before: advSum(s), after: advSum(s2) }));
    if (!/Step 2/.test(await page.textContent("#conAdv"))) throw new Error("the bar lost its place: " + (await page.textContent("#conAdv")));
    for (let k = 0; k < 4 && !(await state(page)).adv.done; k++) { await page.click('#conAdv [data-act="advOpen"]'); await page.click('#modal [data-act="advSkip"]'); await page.waitForTimeout(150); }
    const c0 = (await state(page)).chests.r;
    await page.click('#conAdv [data-act="advClaim"]');
    await page.waitForTimeout(300);
    const s3 = await state(page);
    if (!s3.adv.claimed || s3.chests.r !== c0 + 1) throw new Error("claiming did not pay one Rare chest");
    if (await page.evaluate(() => advClaim(window.__g1520.S(), Date.now())) !== null) throw new Error("the reward could be claimed twice");
    await page.reload(); await page.waitForTimeout(900);
    if (await page.locator('#conAdv [data-act="advClaim"]').count()) throw new Error("a claim button came back after a reload");
    return page;
  },
  async "a miss offers a fresh try, and the rematch pays a comeback once"(b) {
    const page = await open(b, save((S) => { S.spots = []; S.onb = { step: 9, done: true }; S.adv = null; }));
    await answerWrong(page);
    await page.waitForSelector('#conBody [data-act="cbTry"]');
    const missed = await page.evaluate(() => window.__g1520.cur().key);
    await page.click('#conBody [data-act="cbTry"]');
    const c = await page.evaluate(() => { const q = window.__g1520.cur(); return { key: q.key, cb: q.cbFor, sk: q.sk }; });
    if (c.cb !== missed || c.key === missed) throw new Error("the fresh try is not linked to the miss: " + JSON.stringify(c));
    await answerRight(page);
    if (!/Comeback in progress/.test(await page.textContent("#conBody"))) throw new Error("no follow-up after the fresh try");
    await page.evaluate((k) => { const S = window.__g1520.S(); S.spots.find((x) => x.k === k).due = Date.now() - 1000; S.focus = "spots"; }, missed);
    await page.click("#nextBtn"); await page.waitForTimeout(200);
    if ((await page.evaluate(() => window.__g1520.cur().key)) !== missed) throw new Error("the rematch was not served");
    const r0 = (await state(page)).stats.recovered || 0;
    await answerRight(page);
    if (!/Full comeback/.test(await page.textContent("#conBody"))) throw new Error("no full comeback");
    const s1 = await state(page);
    if ((s1.stats.recovered || 0) !== r0 + 1 || !s1.recov[missed]) throw new Error("the comeback was not recorded");
    return page;
  },
  async "the Algebra machine: pick a part, shut it down"(b) {
    const page = await open(b, save((S) => { S.bossT = {}; S.onb = { step: 9, done: true }; S.adv = null; }));
    await page.click('#decknav [data-v="arena"]');
    await page.click('#panel [data-act="bossGo"][data-v="alg"]');
    await page.waitForSelector("#conBody .mparts");
    await page.click('#conBody [data-act="bossTgt"][data-i="1"]');
    if ((await page.evaluate(() => window.__g1520.cur().sk)) !== "Linear functions") throw new Error("targeting did not change the question");
    await answerRight(page);
    const s = await state(page);
    if (s.boss.parts[1].hp !== 0) throw new Error("the Slope Drive is still running");
    if (!/3 of 4 parts running/.test(await page.textContent("#bossBox"))) throw new Error("the banner does not count parts");
    return page;
  },
  async "the Inference Hydra: claim first, then evidence"(b) {
    const page = await open(b, save((S) => { S.bossT = {}; S.onb = { step: 9, done: true }; S.adv = null; }));
    await page.click('#decknav [data-v="arena"]');
    await page.click('#panel [data-act="bossGo"][data-v="ii"]');
    await page.waitForSelector("#conBody .hheads");
    const sk1 = await page.evaluate(() => window.__g1520.cur().sk);
    if (!/Central Ideas|Inferences/.test(sk1)) throw new Error("the first question is not a claim question: " + sk1);
    await answerRight(page); await page.click("#nextBtn"); await page.waitForTimeout(200);
    const sk2 = await page.evaluate(() => window.__g1520.cur().sk);
    if (!/Command of Evidence/.test(sk2)) throw new Error("the second question is not an evidence question: " + sk2);
    await answerRight(page);
    const s = await state(page);
    if (s.boss.heads[0] !== 2) throw new Error("the head was not cut: " + JSON.stringify(s.boss.heads));
    return page;
  },
  async "the Comma Splicer's manuscript mends joint by joint"(b) {
    const page = await open(b, save((S) => { S.bossT = {}; S.onb = { step: 9, done: true }; S.adv = null; }));
    await page.click('#decknav [data-v="arena"]');
    await page.click('#panel [data-act="bossGo"][data-v="sec"]');
    await page.waitForSelector("#conBody .mss");
    if ((await page.locator("#conBody .mss .gap").count()) !== 4) throw new Error("the manuscript should start with 4 broken joints");
    await answerRight(page);
    const s = await state(page);
    if (s.boss.joints.filter((j) => j.ok).length < 1) throw new Error("no joint was repaired");
    await page.click("#nextBtn"); await page.waitForTimeout(200);
    if ((await page.locator("#conBody .mss .fix").count()) < 1) throw new Error("the repaired joint does not show its mark");
    return page;
  },
  async "restore the Harbor Bridge once, from the City"(b) {
    const page = await open(b, save((S) => { harborReady(S); S.settings.view = "city"; S.onb = { step: 9, done: true }; }));
    await page.click('#decknav [data-v="city"]');
    await page.waitForSelector('#panel [data-act="restore"][data-v="harbor"]');
    const e0 = (await state(page)).chests.e;
    await page.click('#panel [data-act="restore"][data-v="harbor"]');
    await page.waitForTimeout(600);
    const s = await state(page);
    if (!s.world.harbor || s.chests.e !== e0 + 1) throw new Error("restoring did not stick or did not pay");
    if (await page.locator('[data-act="restore"][data-v="harbor"]').count()) throw new Error("restore is still offered");
    if (await page.evaluate(() => restoreDo(window.__g1520.S(), "harbor", Date.now())) !== null) throw new Error("the bridge could be restored twice");
    await page.reload(); await page.waitForTimeout(900);
    const s2 = await state(page);
    if (!s2.world.harbor || s2.chests.e !== e0 + 1) throw new Error("the restored bridge did not survive a reload");
    return page;
  },
  async "the water stops you in 3D until the bridge is restored, then you can cross"(b) {
    const page = await open(b, save((S) => { harborReady(S); S.settings.view = "3d"; S.settings.w3new = true; S.settings.w3seen = true; S.onb = { step: 9, done: true }; }));
    await w3Ready(page);
    const place = () => page.evaluate(() => { const W = window.__g1520.w3(), L = W.lots.harbor, c = Math.cos(L.ry), s = Math.sin(L.ry); W.pos.set(L.x + 17 * s, 0, L.z + 17 * c); W.vel.set(0, 0, 0); W.yaw = L.ry; W.yawTo = null; W.goal = null; });
    const localZ = () => page.evaluate(() => { const W = window.__g1520.w3(), L = W.lots.harbor, dx = W.pos.x - L.x, dz = W.pos.z - L.z; return dx * Math.sin(L.ry) + dz * Math.cos(L.ry); });
    await place();
    await page.focus("#w3Cv");
    await page.keyboard.down("w"); await page.waitForTimeout(2500); await page.keyboard.up("w");
    const z0 = await localZ();
    if (z0 < 14.5) throw new Error("walked onto the water before the bridge was restored: z=" + z0.toFixed(2));
    await page.click('#decknav [data-v="city"]');
    await page.waitForSelector('#panel [data-act="restore"][data-v="harbor"]');
    await page.click('#panel [data-act="restore"][data-v="harbor"]');
    await page.waitForTimeout(700);
    await page.click('#decknav [data-v="city"]');
    await page.waitForTimeout(300);
    await place();
    await page.focus("#w3Cv");
    let top = 0;
    await page.keyboard.down("w");
    for (let i = 0; i < 12; i++) { await page.waitForTimeout(300); top = Math.max(top, await page.evaluate(() => window.__g1520.w3().pos.y)); }
    await page.keyboard.up("w");
    const z1 = await localZ();
    if (z1 > -2) throw new Error("did not reach Lantern Isle: z=" + z1.toFixed(2));
    if (top < 0.8) throw new Error("the walk did not go over the arch: top y=" + top.toFixed(2));
    return page;
  },
  async "Progress shows learning evidence apart from game rewards"(b) {
    const page = await open(b, save((S) => { S.onb = { step: 9, done: true }; S.adv = null; }));
    for (let i = 0; i < 6; i++) { if (i % 3) await answerRight(page); else await answerWrong(page); await page.click("#nextBtn"); await page.waitForTimeout(120); }
    await page.click('#decknav [data-v="reviews"]');
    await page.waitForSelector("#panel #plLearn");
    const t = await page.textContent("#plLearn");
    if (!/fresh questions right/.test(t) || !/comebacks/.test(t) || !/best timed section/.test(t)) throw new Error("learning evidence is incomplete");
    if (!/Progress/.test(await page.textContent("#panel .glass-h"))) throw new Error("the tab is not called Progress");
    return page;
  },
  async "the top bar and page fit at common desktop sizes"(b) {
    let last = null;
    for (const [nm, json] of [["fresh", null], ["day 6", save((S) => { S.onb = { step: 9, done: true }; })], ["late", lateSave()]]) {
      for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
        if (last) await last.close();
        last = await open(b, json, w, h);
        if (!json) { await last.click('[data-act="welcomeSkip"]'); await last.waitForTimeout(200); }
        const bad = await pageFits(last);
        if (bad) throw new Error(nm + " at " + w + ": " + bad);
        if (last.errors.length) throw new Error(nm + " at " + w + ": " + last.errors.join(" | "));
      }
    }
    return last;
  },
  async "fresh game starts at 320 and climbs"(b) {
    const page = await open(b, null);
    await page.click('[data-act="welcomeSkip"]');
    const s0 = await state(page);
    if (Object.values(s0.r).some((r) => r !== 160)) throw new Error("fresh ratings are not all 160");
    for (let i = 0; i < 6; i++) { await answerAny(page); await page.click("#nextBtn"); await page.waitForTimeout(120); }
    const s1 = await state(page);
    if (s1.stats.answered !== 6) throw new Error("answered " + s1.stats.answered);
    return page;
  },
  /* ---- v10: the title card, safe loading, places, rounds, tools, and the Town Square ---- */
  async "the title card goes away by itself, and a broken save shows a recovery screen, untouched"(b) {
    const page = await open(b, save());
    const t = await page.evaluate(() => ({ ready: !!(window.__title && window.__title.ready), card: !!document.getElementById("title"), shown: !!(window.__title && window.__title.t0) }));
    if (!t.shown || !t.ready || t.card) throw new Error("title card state after boot: " + JSON.stringify(t));
    await page.close();
    const p2 = await b.newPage({ viewport: { width: 1440, height: 900 } });
    p2.errors = [];
    p2.on("pageerror", (e) => p2.errors.push(e.message));
    await p2.route(/^https?:\/\//, (r) => r.abort());
    await p2.addInitScript(() => localStorage.setItem("grind1520.save.v1", "{not json at all"));
    await p2.goto(file); await p2.waitForTimeout(900);
    const r = await p2.evaluate(() => ({ failed: document.getElementById("title").classList.contains("failed"), retry: !!document.getElementById("tlRetry"), dl: !!document.getElementById("tlSave"), raw: localStorage.getItem("grind1520.save.v1"), txt: document.getElementById("titleFail").textContent }));
    if (!r.failed || !r.retry || !r.dl) throw new Error("no recovery screen: " + JSON.stringify(r));
    if (r.raw !== "{not json at all") throw new Error("the broken save was changed: " + r.raw);
    if (!/couldn’t be read/.test(r.txt) || !/has not been changed/.test(r.txt)) throw new Error("recovery text: " + r.txt.slice(0, 120));
    const [dl] = await Promise.all([p2.waitForEvent("download"), p2.click("#tlSave")]);
    if (!/^to-1520-save-recovered\.txt$/.test(dl.suggestedFilename())) throw new Error("recovered file name: " + dl.suggestedFilename());
    return p2;
  },
  async "open a building from the skyline, work there for a round of five, then go back"(b) {
    const page = await open(b, save((S) => { S.settings.view = "city"; S.onb = { step: 9, done: true }; S.adv = null; S.rev = { date: "x", n: 0, p: 0, done: true }; S.round = null; }));
    const lot = await page.evaluate(() => { const C = window.__g1520.city(), L = C.lots.find((l) => l.id === "bank"); C.camTo = null; C.cam = Math.max(C.camMin, Math.min(C.camMax, L.x + L.w / 2 - (C.vis[0] + C.vis[1]) / 2)); window.__g1520.cityFrame(performance.now()); const r = document.getElementById("cityCv").getBoundingClientRect(); return { x: r.left + L.x + L.w / 2 - C.cam, y: r.top + C.gy - 20 }; });
    await page.mouse.click(lot.x, lot.y); await page.waitForTimeout(250);
    if (!(await page.locator('#ctip [data-act="place"]').count())) throw new Error("the skyline card has no Open button");
    await page.click('#ctip [data-act="place"]'); await page.waitForTimeout(300);
    if ((await page.getAttribute("body", "data-tab")) !== "place" || !/Bank/.test(await page.textContent("#panel h2"))) throw new Error("the Bank's page did not open");
    if (!/Percentages/.test(await page.textContent("#panel")) || !/Proficiency/.test(await page.textContent("#panel"))) throw new Error("the page is missing its skill or proficiency");
    if (!(await page.isVisible("#cityCv"))) throw new Error("the town vanished behind the page");
    await page.click('#panel [data-act="roundGo"]:not([data-hard])'); await page.waitForTimeout(400);
    let s = await state(page);
    if (!s.round || s.round.id !== "bank" || s.focus !== "sk:psda|Percentages") throw new Error("the round did not start: " + JSON.stringify([s.round, s.focus]));
    if (!/Round · Bank/.test(await page.textContent("#conHead"))) throw new Error("the console head does not show the round");
    for (let i = 0; i < 5; i++) { if (i % 2) await answerWrong(page); else await answerRight(page); if (i < 4) { await page.click("#nextBtn"); await page.waitForTimeout(150); } }
    s = await state(page);
    if (!s.round.done || s.round.a !== 5 || s.round.c !== 3 || s.focus !== "mix") throw new Error("round tally: " + JSON.stringify(s.round) + " focus " + s.focus);
    if (!/Round results/.test(await page.textContent("#nextBtn"))) throw new Error("no results button");
    await page.click("#nextBtn"); await page.waitForTimeout(300);
    if (!(await page.locator("#conBody .roundsum").count()) || !/3\/5/.test(await page.textContent("#conBody .roundsum"))) throw new Error("no round summary");
    await page.click('#conFoot [data-act="roundBack"]'); await page.waitForTimeout(400);
    if ((await page.getAttribute("body", "data-tab")) !== "place" || (await state(page)).round !== null) throw new Error("Back to the Bank failed");
    await page.click('#panel [data-act="back"]'); await page.waitForTimeout(200);
    if ((await page.getAttribute("body", "data-tab")) !== "network") throw new Error("Back did not return to the town");
    return page;
  },
  async "a round survives a reload and ends when you pick another focus"(b) {
    const page = await open(b, save((S) => { S.settings.view = "city"; S.onb = { step: 9, done: true }; S.adv = null; S.rev = { date: "x", n: 0, p: 0, done: true }; S.round = null; S.city.b.market = S.city.b.market || 1; }));
    await page.click('#decknav [data-v="city"]'); await page.click('#panel [data-act="cityPage"][data-v="build"]');
    await page.click('#panel .cthumb[data-v="market"]'); await page.waitForTimeout(300);
    await page.click('#panel [data-act="roundGo"]:not([data-hard])'); await page.waitForTimeout(300);
    await answerRight(page); await page.click("#nextBtn"); await page.waitForTimeout(150); await answerRight(page);
    let s = await state(page);
    if (!s.round || s.round.a !== 2) throw new Error("two answers expected: " + JSON.stringify(s.round));
    await page.reload(); await page.waitForTimeout(900);
    s = await state(page);
    if (!s.round || s.round.a !== 2 || s.round.done) throw new Error("the round did not survive the reload: " + JSON.stringify(s.round));
    if (!/Round · Market/.test(await page.textContent("#conHead"))) throw new Error("the console forgot the round after a reload");
    if (!/Round at the Market/.test(await page.textContent("#decknav"))) throw new Error("the places bar does not mention the round");
    await page.selectOption("#focusSel", "alg"); await page.waitForTimeout(200);
    s = await state(page);
    if (s.round !== null || s.focus !== "alg") throw new Error("picking a focus should end the round: " + JSON.stringify([s.round, s.focus]));
    return page;
  },
  async "tools: Working proficiency reveals an offer whose price holds; it is bought once"(b) {
    const page = await open(b, save((S) => { S.settings.view = "city"; S.onb = { step: 9, done: true }; S.adv = null; S.city.coins = 1e12; S.tools = {}; S.opps = {}; S.sk["psda|Percentages"] = { n: 8, c: 7, pr: "bbbbbb", pb: 0 }; }));
    let s = await state(page);
    if (!s.opps.bank || s.opps.bank.lv !== 1) throw new Error("no offer for the Bank on load: " + JSON.stringify(s.opps.bank));
    const cost = s.opps.bank.cost;
    await answerRight(page); await page.click("#nextBtn"); await page.waitForTimeout(150);
    await page.reload(); await page.waitForTimeout(900);
    s = await state(page);
    if (s.opps.bank.cost !== cost) throw new Error("the price changed: " + cost + " to " + s.opps.bank.cost);
    await page.click('#decknav [data-v="city"]'); await page.click('#panel [data-act="cityPage"][data-v="build"]');
    await page.click('#panel .cthumb[data-v="bank"]'); await page.waitForTimeout(300);
    const opp = await page.textContent("#panel .opp");
    if (!/Better tools/.test(opp)) throw new Error("the page does not show the offer: " + opp);
    const c0 = (await state(page)).city.coins;
    await page.click('#panel [data-act="toolBuy"]'); await page.waitForTimeout(300);
    s = await state(page);
    // The town keeps earning while the check runs, so allow a moment's income around the price.
    if (s.tools.bank !== 1 || s.opps.bank || Math.abs((c0 - s.city.coins) - cost) > Math.max(2e6, cost * 0.05)) throw new Error("buying: " + JSON.stringify({ tools: s.tools, opp: s.opps.bank, coins: [c0, s.city.coins], cost }));
    if (await page.locator('#panel [data-act="toolBuy"]').count()) throw new Error("a second buy button is showing");
    if (!(await page.locator("#panel .tool.on").count())) throw new Error("the installed tool is not marked");
    if (await page.evaluate(() => toolBuy(window.__g1520.S(), "bank", Date.now())) !== null) throw new Error("the tool could be bought twice");
    await page.reload(); await page.waitForTimeout(900);
    s = await state(page);
    if (s.tools.bank !== 1 || s.opps.bank) throw new Error("the tool did not survive a reload");
    return page;
  },
  async "the Town Square: evidence across subjects, funded once, changed in 2D and 3D"(b) {
    const page = await open(b, save((S) => { S.settings.view = "3d"; S.settings.w3new = true; S.onb = { step: 9, done: true }; S.adv = null; S.world = {}; S.city.coins = 3000; S.city.b = {}; S.city.up = {}; S.city.buffs = []; Object.keys(S.sk).forEach((k) => { S.sk[k].pr = ""; S.sk[k].pb = 0; }); ["ii|Inferences", "sec|Boundaries", "alg|Linear functions"].forEach((k) => { S.sk[k] = { n: 8, c: 7, pr: "bbbbbb", pb: 0 }; }); }));
    let s = await state(page);
    if (s.world.square) throw new Error("the project should not be earned with only one Math subject: " + JSON.stringify(s.world.square));
    await page.click('#decknav [data-v="city"]'); await page.waitForTimeout(400);
    const card = await page.textContent("#lmk-square");
    if (!/1 \/ 2/.test(card) || (await page.locator('#lmk-square [data-act="projectGo"]').count())) throw new Error("the card should show one Math subject missing and no fund button: " + card.slice(0, 200));
    await page.evaluate(() => { const S = window.__g1520.S(); S.sk["geo|Circles"] = { n: 8, c: 7, pr: "bbbbbb", pb: 0 }; townAfter(S, Date.now()); });
    await page.keyboard.press("Control+s"); await page.waitForTimeout(200);
    await page.click('#decknav [data-v="network"]'); await page.click('#decknav [data-v="city"]'); await page.waitForTimeout(400);
    s = await state(page);
    if (!s.world.square || !s.world.square.earned) throw new Error("the evidence was not kept: " + JSON.stringify(s.world.square));
    const e0 = s.chests.e, c0 = s.city.coins;
    await w3Ready(page);
    const sig0 = await page.evaluate(() => window.__g1520.w3().lots.square.sig);
    if (!/ready/.test(sig0)) throw new Error("the 3D square does not show it is ready: " + sig0);
    await page.click('#lmk-square [data-act="projectGo"]'); await page.waitForTimeout(1500);
    s = await state(page);
    if (!s.world.square || !s.world.square.at || s.chests.e !== e0 + 1 || Math.abs(c0 - s.city.coins - 1500) > 1) throw new Error("funding: " + JSON.stringify({ sq: s.world.square, e: [e0, s.chests.e], coins: [c0, s.city.coins] }));
    if (await page.evaluate(() => projDo(window.__g1520.S(), "square", Date.now())) !== null) throw new Error("the project could be paid twice");
    if (!/restored/i.test(await page.textContent("#lmk-square .lmk-h")) || (await page.locator('#lmk-square [data-act="projectGo"]').count())) throw new Error("the card does not show it restored");
    const sig1 = await page.evaluate(() => window.__g1520.w3().lots.square.sig);
    if (!/^on/.test(sig1)) throw new Error("the 3D square did not rebuild: " + sig1);
    await page.click('#panel [data-act="wv"][data-v="city"]'); await page.waitForTimeout(400);
    const mm = await page.evaluate(() => { const C = window.__g1520.city(); const L = C.lots.find((l) => l.id === "square"); return { lot: !!L, sig: C.mapSig }; });
    if (!mm.lot || !/s/.test(mm.sig)) throw new Error("the skyline has no restored square: " + JSON.stringify(mm));
    await page.reload(); await page.waitForTimeout(900);
    s = await state(page);
    if (!s.world.square || !s.world.square.at || s.chests.e !== e0 + 1) throw new Error("the restoration did not survive a reload: " + JSON.stringify({ sq: s.world.square, e: [e0, s.chests.e] }));
    return page;
  },
  async "back paths: a page opened from a page returns to it; the places bar starts fresh"(b) {
    const page = await open(b, save((S) => { S.settings.view = "city"; S.onb = { step: 9, done: true }; S.adv = null; S.city.b.bank = S.city.b.bank || 1; }));
    await page.click('#decknav [data-v="city"]'); await page.click('#panel [data-act="cityPage"][data-v="build"]');
    await page.click('#panel .cthumb[data-v="bank"]'); await page.waitForTimeout(300);
    if (!/Back to Town Hall/.test(await page.getAttribute("#panel .xbtn.back", "aria-label"))) throw new Error("the Bank's back button should lead to the Town Hall: " + (await page.getAttribute("#panel .xbtn.back", "aria-label")));
    await page.click('#panel .pl-zone [data-act="zoneGo"]'); await page.waitForTimeout(300);
    if ((await page.getAttribute("body", "data-tab")) !== "zones" || !/Exchange/.test(await page.textContent("#panel h2"))) throw new Error("the zone did not open from the page");
    if (!/Back to the Bank/.test(await page.getAttribute("#panel .xbtn.back", "aria-label"))) throw new Error("the zone's back button should lead to the Bank");
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    if ((await page.getAttribute("body", "data-tab")) !== "place" || !/Bank/.test(await page.textContent("#panel h2"))) throw new Error("Escape did not go back to the Bank");
    await page.click('#panel [data-act="back"]'); await page.waitForTimeout(300);
    if ((await page.getAttribute("body", "data-tab")) !== "city" || !/Build/.test(await page.textContent("#panel .wsw.pages [aria-pressed=\"true\"]"))) throw new Error("Back did not return to the Town Hall's Build page");
    await page.click('#decknav [data-v="zones"]'); await page.waitForTimeout(200);
    if (!/Back to the town/.test(await page.getAttribute("#panel .xbtn.back", "aria-label"))) throw new Error("a places-bar tap should start fresh");
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    if ((await page.getAttribute("body", "data-tab")) !== "network") throw new Error("Escape from a top-level page should show the town");
    return page;
  },
  async "the late dev save loads into v10 with what's new, tools on offer, and the square's evidence kept"(b) {
    const page = await open(b, lateSave((S) => { S.seenV10 = false; S.settings.view = "city"; }));
    if (!(await page.locator('#modal:not([hidden]) [data-act="new10Go"]').count())) throw new Error("no what's new for the late save");
    await page.click('#modal [data-act="modalClose"]'); await page.waitForTimeout(200);
    const s = await state(page);
    if (s.v !== 10 || !s.seenV10) throw new Error("migration: " + JSON.stringify([s.v, s.seenV10]));
    if (Object.keys(s.opps).length < 10) throw new Error("expected offers across the town, got " + Object.keys(s.opps).length);
    if (!s.world.square || !s.world.square.earned) throw new Error("the square's evidence should already be kept");
    if (!Object.keys(s.sk).every((k) => typeof s.sk[k].pr === "string")) throw new Error("skills without a proficiency window");
    await page.click('#decknav [data-v="city"]'); await page.waitForTimeout(400);
    if (!(await page.locator('#lmk-square [data-act="projectGo"]').count())) throw new Error("the late save cannot fund the square");
    if (!/Tools installed/.test((await page.click('#panel [data-act="cityPage"][data-v="stats"]'), await page.textContent("#panel")))) throw new Error("no tools stat");
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
