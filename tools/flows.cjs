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
