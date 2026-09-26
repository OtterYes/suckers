// Functional checks: drives the real UI from simulated saves and asserts on the saved state.
//   NODE_PATH=$(npm root -g) node tools/flows.cjs
const path = require("path");
const { chromium } = require("playwright");
const { simulate } = require("./sim.cjs");

const file = "file://" + path.resolve(__dirname, "..", "index.html");
const KEY = "grind1520.save.v1";
const base = JSON.stringify(simulate({ days: 6, perDay: 60, learn: 0.25, seed: 3, ascend: 3 }).S);

function save(edit) {
  const S = JSON.parse(base);
  S.welcomed = true; S.seenV3 = true; S.seenV4 = true; S.evo.seen = S.evo.stage; S.lastSeen = S.lastInteract = Date.now();
  if (edit) edit(S);
  return JSON.stringify(S);
}
async function open(browser, json, w, h) {
  const page = await browser.newPage({ viewport: { width: w || 1440, height: h || 900 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.route(/^https?:\/\//, (r) => r.abort());
  if (json) await page.addInitScript((j) => { try { localStorage.setItem("grind1520.save.v1", j); } catch (e) {} }, json);
  await page.goto(file);
  await page.waitForTimeout(900);
  return page;
}
const state = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
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
  for (const [name, fn] of Object.entries(TESTS)) {
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
