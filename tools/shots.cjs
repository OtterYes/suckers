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
  S.welcomed = true; S.seenV3 = true; S.evo.seen = S.evo.stage;
  S.lastSeen = S.lastInteract = Date.now();
  if (edit) edit(S);
  return JSON.stringify(S);
}
const click = (sel) => async (page) => { await page.click(sel); await page.waitForTimeout(500); };

const SCENES = [
  ["day02-network", 2, null, null],
  ["day06-reactor", 6, (S) => { S.form = "reactor"; }, null],
  ["day14-universe", 14, (S) => { S.form = "universe"; }, null],
  ["day14-network", 14, (S) => { S.form = "network"; }, null],
  ["panel-evolution", 6, null, click('[data-act="tab"][data-v="evolution"]')],
  ["panel-reviews", 6, null, click('[data-act="tab"][data-v="reviews"]')],
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
  ["mobile-network", 6, null, null, 390, 844],
  ["mobile-evolution", 6, null, click('[data-act="tab"][data-v="evolution"]'), 390, 844],
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
