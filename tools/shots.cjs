// Screenshots of the game at points along a simulated climb, plus its main screens.
//   NODE_PATH=$(npm root -g) node tools/shots.cjs <outdir> [name-filter]
// Saves come from tools/sim.cjs, so each shot shows a realistic engine for that day.
const path = require("path");
const { chromium } = require("playwright");
const { simulate } = require("./sim.cjs");

const out = process.argv[2] || ".";
const only = process.argv[3] || "";
const file = "file://" + path.resolve(__dirname, "..", "index.html");
const cache = {};

function stateAfter(days, edit) {
  if (!days) return null;
  if (!cache[days]) cache[days] = JSON.stringify(simulate({ days, perDay: 60, learn: 0.25, seed: 3, ascend: 3 }).S);
  const S = JSON.parse(cache[days]);
  S.welcomed = true; S.seenV3 = true; S.seenV4 = true; S.evo.seen = S.evo.stage;
  if (S.unit && S.unit.cleared.length) S.unit.at = {};
  S.lastSeen = S.lastInteract = Date.now();
  if (edit) edit(S);
  return JSON.stringify(S);
}
const click = (sel) => async (page) => { await page.click(sel); await page.waitForTimeout(500); };

const SCENES = [
  ["day02-network", 2, (S) => { S.season.date = new Date(Date.now() + 19 * 864e5).toISOString().slice(0, 10); }, null],
  ["day06-reactor", 6, (S) => { S.form = "reactor"; }, null],
  ["day14-universe", 14, (S) => { S.form = "universe"; }, null],
  ["day14-network", 14, (S) => { S.form = "network"; }, null],
  ["panel-evolution", 6, null, click('[data-act="tab"][data-v="evolution"]')],
  ["panel-plan", 6, (S) => { S.season.date = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10); S.season.target = 1300; S.miss = [[Date.now() - 1e6, "cs", "Words in Context", "trap"], [Date.now() - 2e6, "alg", "Linear functions", "read"], [Date.now() - 3e6, "cs", "Words in Context", "trap"]]; }, click('[data-act="tab"][data-v="reviews"]')],
  ["panel-plan-skills", 6, null, async (page) => { await page.click('[data-act="tab"][data-v="reviews"]'); await page.click('[data-act="scrollTo"][data-v="plSkills"]'); await page.waitForTimeout(600); }],
  ["missed-why", 6, null, async (page) => {
    for (let k = 0; k < 10; k++) {
      const ch = page.locator('#conBody [data-act="pick"]');
      if (await ch.count()) await ch.nth(k % 4).click(); else await page.locator("#sprIn").fill("-4321");
      await page.click("#checkBtn"); await page.waitForTimeout(300);
      for (let j = 0; j < 3; j++) { const m = page.locator('#modal:not([hidden]) [data-act="modalClose"]'); if (await m.count()) await m.first().click(); }
      if (await page.locator("#whyBox").count()) { await page.locator("#whyBox").scrollIntoViewIfNeeded(); break; }
      await page.click("#nextBtn"); await page.waitForTimeout(300);
    }
  }],
  ["whats-new", 6, (S) => { S.seenV4 = false; }, null],
  ["import", 6, null, click("#impBtn")],
  ["panel-arena", 6, null, click('[data-act="tab"][data-v="arena"]')],
  ["panel-ascend", 6, null, click('[data-act="tab"][data-v="ascend"]')],
  ["profile", 6, null, click("#rankBtn")],
  ["welcome", 0, null, null],
  ["evolve-modal", 6, (S) => { S.evo.seen = S.evo.stage - 1; }, null],
  ["catchup-modal", 14, (S) => { S.evo.seen = 0; S.form = "network"; }, null],
  ["set-summary", 6, (S) => { S.set = { n: 9, c: 8, sp: 5200, run: 3, best: 5, log: "111011101", conn0: 30, p0: 1100, r0: [470, 590, 460, 585, 610, 580, 540, 545], t0: Date.now() - 6e5 }; }, async (page) => {
    for (let k = 0; k < 2; k++) {
      const ch = page.locator('#conBody [data-act="pick"]');
      if (await ch.count()) await ch.first().click(); else { const i = page.locator("#sprIn"); if (await i.count()) await i.fill("7"); }
      await page.click("#checkBtn"); await page.waitForTimeout(300);
      for (let j = 0; j < 3; j++) { const m = page.locator('#modal:not([hidden]) [data-act="modalClose"]'); if (await m.count()) await m.first().click(); }
      await page.click("#nextBtn"); await page.waitForTimeout(400);
      if (await page.locator(".setsum").count()) break;
    }
  }],
  ["answered", 6, null, async (page) => {
    const ch = page.locator('#conBody [data-act="pick"]');
    if (await ch.count()) await ch.nth(1).click(); else await page.locator("#sprIn").fill("12");
    await page.click("#checkBtn"); await page.waitForTimeout(1200);
    const m = page.locator('#modal:not([hidden]) [data-act="modalClose"]'); if (await m.count()) await m.first().click();
  }],
  ["gauntlet", 6, null, async (page) => { await page.click('[data-act="tab"][data-v="arena"]'); await page.waitForTimeout(300); await page.click('[data-act="gstart"][data-v="m"]'); await page.waitForTimeout(500); }],
  ["tooltip-hub", 6, null, async (page) => {
    const pos = await page.evaluate(() => { const c = document.getElementById("engineCv").getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height }; });
    // Sweep the Algebra column until a tooltip appears.
    for (let y = pos.y + 90; y < pos.y + pos.h - 100; y += 5) {
      await page.mouse.move(pos.x + pos.w * 0.665, y);
      if (await page.locator("#etip:not([hidden])").count()) break;
    }
    await page.waitForTimeout(300);
  }],
  ["arcade-lobby", 6, null, click('[data-act="tab"][data-v="arena"]')],
  ["arc-comma", 6, null, async (page) => { await page.click('[data-act="tab"][data-v="arena"]'); await page.click('[data-act="arcPlay"][data-v="comma"]'); await page.waitForTimeout(300);
    const it = await page.evaluate(() => window.__g1520.arc().item.gap); await page.click(`#conBody [data-act="arcWord"][data-i="${it}"]`); await page.waitForTimeout(200); }],
  ["arc-rush", 6, null, async (page) => { await page.click('[data-act="tab"][data-v="arena"]'); await page.click('[data-act="arcPlay"][data-v="rush"]'); await page.waitForTimeout(300); }],
  ["arc-line", 6, null, async (page) => { await page.click('[data-act="tab"][data-v="arena"]'); await page.click('[data-act="arcPlay"][data-v="line"]'); await page.waitForTimeout(300); await page.click('[data-act="arcLock"]'); await page.waitForTimeout(300); }],
  ["arc-balance", 6, null, async (page) => { await page.click('[data-act="tab"][data-v="arena"]'); await page.click('[data-act="arcPlay"][data-v="balance"]'); await page.waitForTimeout(300); await page.click('[data-act="arcLock"]'); await page.waitForTimeout(1000); }],
  ["arc-results", 6, null, async (page) => { await page.click('[data-act="tab"][data-v="arena"]'); await page.click('[data-act="arcPlay"][data-v="rush"]'); await page.waitForTimeout(200);
    for (let k = 0; k < 4; k++) { const a = await page.evaluate(() => window.__g1520.arc().item.a); await page.keyboard.press(String(((a + (k === 2 ? 1 : 0)) % 4) + 1)); await page.waitForTimeout(k === 2 ? 2000 : 520); }
    await page.evaluate(() => window.__g1520.arcEnd()); await page.waitForTimeout(400); }],
  ["callit", 6, (S) => { S.focus = "cs"; S.rev = { date: "x", n: 0, p: 0, done: true }; S.ai = []; }, async (page) => { await page.click('#callIt [data-act="conf"][data-v="sure"]'); await page.locator("#callIt").scrollIntoViewIfNeeded(); }],
  ["cards", 6, (S) => { S.set = { n: 9, c: 9, sp: 900, run: 9, best: 9, log: "111111111", conn0: 20, p0: 1080, r0: Object.values(S.r), t0: Date.now() - 6e5 }; S.pick = null; }, async (page) => {
    const c = await page.evaluate(() => { const q = window.__g1520.cur(); return { spr: q.spr ? q.spr.vals[0] : null, correct: q.correct }; });
    if (c.spr != null) await page.fill("#sprIn", String(c.spr)); else await page.click(`#conBody [data-act="pick"][data-i="${c.correct}"]`);
    await page.click("#checkBtn"); await page.waitForTimeout(300);
    for (let j = 0; j < 4; j++) { const m = page.locator('#modal:not([hidden]) [data-act="modalClose"]'); if (await m.count()) await m.first().click(); }
    await page.click("#nextBtn"); await page.waitForTimeout(300); await page.keyboard.press("1"); await page.waitForTimeout(900); await page.locator("#cardsBox").scrollIntoViewIfNeeded(); }],
  ["surge-orb", 6, null, async (page) => { await page.evaluate(() => window.__g1520.spawnSurge()); await page.waitForTimeout(700); }],
  ["tools-draw", 6, (S) => { S.focus = "cs"; S.rev = { date: "x", n: 0, p: 0, done: true }; S.ai = []; }, async (page) => {
    await page.evaluate(() => { const p = document.querySelector("#sheet .passage p"), w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let t = w.nextNode(); while (t && t.length < 30) t = w.nextNode();
      const r = document.createRange(); r.setStart(t, 4); r.setEnd(t, 28); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new MouseEvent("mouseup")); });
    await page.click('[data-act="drawToggle"]'); const b = await page.locator("#drawCv").boundingBox();
    await page.mouse.move(b.x + 60, b.y + 150); await page.mouse.down(); for (let k = 0; k <= 12; k++) await page.mouse.move(b.x + 60 + k * 18, b.y + 150 + Math.sin(k / 2) * 14); await page.mouse.up(); }],
  ["reference", 6, (S) => { S.focus = "geo"; S.rev = { date: "x", n: 0, p: 0, done: true }; S.ai = []; }, click('[data-act="refSheet"]')],
  ["boss-finisher", 6, (S) => { S.boss = { d: "sec", tier: 3, hp: 22, max: 140, hearts: 2, t0: Date.now(), hits: 5 }; }, null],
  ["tour-1", 6, (S) => { S.seenV5 = false; }, null],
  ["tour-2", 6, (S) => { S.seenV5 = false; }, async (page) => { await page.keyboard.press("ArrowRight"); await page.click('#wnDemo [data-act="wnCall"][data-v="sure"]'); await page.waitForTimeout(300); }],
  ["tour-3", 6, (S) => { S.seenV5 = false; }, async (page) => { for (let k = 0; k < 2; k++) await page.keyboard.press("ArrowRight"); await page.click('#wnDemo [data-act="wnCard"][data-i="1"]'); await page.waitForTimeout(700); }],
  ["tour-6", 6, (S) => { S.seenV5 = false; }, async (page) => { for (let k = 0; k < 5; k++) await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400); }],
  ["tour-7", 6, (S) => { S.seenV5 = false; }, async (page) => { for (let k = 0; k < 6; k++) await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400); }],
  ["mobile-tour", 6, (S) => { S.seenV5 = false; }, null, 390, 844],
  ["mobile-arc-line", 6, null, async (page) => { await page.click('#decknav [data-v="arena"]'); await page.click('[data-act="arcPlay"][data-v="line"]'); await page.waitForTimeout(300); }, 390, 844],
  ["mobile-arc-comma", 6, null, async (page) => { await page.click('#decknav [data-v="arena"]'); await page.click('[data-act="arcPlay"][data-v="comma"]'); await page.waitForTimeout(300); }, 390, 844],
  ["mobile-network", 6, null, null, 390, 844],
  ["mobile-evolution", 6, null, click('[data-act="tab"][data-v="evolution"]'), 390, 844],
  ["mobile-plan", 6, null, click('[data-act="tab"][data-v="reviews"]'), 390, 844],
  ["city-day", 21, (S) => { S.settings.view = "city"; S.settings.tod = "day"; }, null],
  ["city-dusk", 21, (S) => { S.settings.view = "city"; S.settings.tod = "dusk"; }, null],
  ["city-night", 21, (S) => { S.settings.view = "city"; S.settings.tod = "night"; }, null],
  ["city-early", 3, (S) => { S.settings.view = "city"; S.settings.tod = "day"; }, null],
  ["city-tab", 21, (S) => { S.settings.tod = "night"; }, click('[data-act="tab"][data-v="city"]')],
  ["city-tab-wonders", 21, (S) => { S.settings.tod = "night"; }, async (page) => { await page.click('[data-act="tab"][data-v="city"]'); await page.click('[data-act="scrollTo"][data-v="cwWonders"]'); await page.waitForTimeout(600); }],
  ["city-tooltip", 21, (S) => { S.settings.view = "city"; S.settings.tod = "dusk"; }, async (page) => {
    const p = await page.evaluate(() => { const C = window.__g1520.city(), S = window.__g1520.S(); const L = C.hitLots.find((h) => S.city.b[h.id] > 0 && h.x0 > 250 && h.x1 < C.w - 250) || C.hitLots[0]; return { x: (L.x0 + L.x1) / 2, y: C.gy - 14 }; });
    const b = await page.locator("#cityCv").boundingBox(); await page.mouse.click(b.x + p.x, b.y + p.y); }],
  ["city-blimp", 21, (S) => { S.settings.view = "city"; S.settings.tod = "day"; }, async (page) => { await page.evaluate(() => window.__g1520.spawnBlimp(performance.now() - 5000)); await page.waitForTimeout(300); }],
  ["city-found", 6, (S) => { S.city = { founded: 0, asked: false, name: "Sparkton", coins: 0, life: 0, b: {}, up: {}, w: {}, pol: "", polAt: 0, buffs: [], blimps: 0, buyN: 1, answers: 0, built: 0, bestRate: 0 }; }, null],
  ["city-tour-1", 6, (S) => { S.seenV6 = false; }, null],
  ["city-tour-2", 6, (S) => { S.seenV6 = false; }, async (page) => { await page.keyboard.press("ArrowRight"); await page.click("#wnLot"); await page.click("#wnLot"); await page.waitForTimeout(1000); }],
  ["city-tour-3", 6, (S) => { S.seenV6 = false; }, async (page) => { for (let k = 0; k < 2; k++) await page.keyboard.press("ArrowRight"); for (let k = 0; k < 3; k++) await page.click("#wnDemo .wn-coin"); }],
  ["city-tour-4", 6, (S) => { S.seenV6 = false; }, async (page) => { for (let k = 0; k < 3; k++) await page.keyboard.press("ArrowRight"); await page.waitForTimeout(1500); }],
  ["city-tour-5", 6, (S) => { S.seenV6 = false; }, async (page) => { for (let k = 0; k < 4; k++) await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400); }],
  ["mobile-city", 21, (S) => { S.settings.view = "city"; S.settings.tod = "night"; }, null, 390, 844],
  ["mobile-city-tab", 21, (S) => { S.settings.tod = "dusk"; }, click('#decknav [data-v="city"]'), 390, 844],
  ["mobile-city-tour", 6, (S) => { S.seenV6 = false; }, null, 390, 844],
  ["laptop-city", 21, (S) => { S.settings.view = "city"; S.settings.tod = "night"; }, null, 1280, 760],
  ["unit-card", 10, null, click('[data-act="tab"][data-v="city"]')],
  ["unit-advance", 24, (S) => { S.unit.st = 5; S.unit.ready = true; S.unit.cleared = ["1.1", "1.2", "1.3", "1.4", "1.5"]; }, async (page) => { await page.click("#stageBtn"); await page.waitForTimeout(300); await page.click('#panel [data-act="advance"]'); }],
  ["unit-ladder", 36, null, async (page) => { await page.click("#stageBtn"); await page.waitForTimeout(300); await page.click('#panel [data-act="ladder"]'); }],
  ["exp-map", 36, (S) => { S.settings.view = "map"; }, null],
  ["exp-panel", 36, null, click('[data-act="tab"][data-v="city"]')],
  ["exp-crew", 36, null, async (page) => { await page.click('[data-act="tab"][data-v="city"]'); await page.click('[data-act="scrollTo"][data-v="xwCrew"]'); await page.waitForTimeout(600); }],
  ["exp-wheel", 36, null, async (page) => { await page.click('[data-act="tab"][data-v="city"]'); await page.click('[data-act="scrollTo"][data-v="xwLuck"]'); await page.waitForTimeout(600); }],
  ["exp-crate", 36, (S) => { S.settings.view = "map"; }, async (page) => { await page.evaluate(() => { const H = window.__g1520, S = H.S(); S.exp.sup = 1e9; const E = S.exp; for (let i = 0; i < E.ex.length; i++) if (E.ex[i] === "0" && E.ty[i] === "c" && [i - 1, i + 1, i - 13, i + 13].some((j) => E.ex[j] === "1")) { H.expExploreA(i); return; } }); await page.waitForTimeout(400); const b = page.locator("#crateBox"); if (await b.count()) { await b.click({ force: true }); await page.waitForTimeout(500); } }],
  ["mobile-exp", 36, (S) => { S.settings.view = "map"; }, null, 390, 844],
  ["mobile-world", 36, null, click('#decknav [data-v="city"]'), 390, 844],
  ["units-tour-1", 6, (S) => { S.seenV7 = false; }, null],
  ["units-tour-3", 6, (S) => { S.seenV7 = false; }, async (page) => { for (let k = 0; k < 2; k++) await page.keyboard.press("ArrowRight"); await page.click('#wnFog [data-i="8"]'); await page.click('#wnFog [data-i="9"]'); await page.waitForTimeout(300); }],
  ["new-game-locked", 0, null, click('[data-act="welcomeGo"]')],
  ["tablet", 6, null, null, 900, 1100],
  ["laptop-1280", 6, null, null, 1280, 760],
];

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const [name, days, edit, act, w, h] of SCENES) {
    if (only && !name.includes(only)) continue;
    const json = stateAfter(days, edit);
    const page = await browser.newPage({ viewport: { width: w || 1440, height: h || 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(/^https?:\/\//, (r) => r.abort());
    if (json) await page.addInitScript((j) => { try { localStorage.setItem("grind1520.save.v1", j); } catch (e) {} }, json);
    await page.goto(file);
    await page.waitForTimeout(1300);
    if (act) await act(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, name + ".png") });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (errors.length || overflow) bad++;
    console.log(name.padEnd(18), errors.length ? "ERRORS: " + errors.join(" | ") : "ok", overflow ? "· HORIZONTAL OVERFLOW" : "");
    await page.close();
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
