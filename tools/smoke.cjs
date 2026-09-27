// Boots index.html in headless Chromium, plays a few questions, and fails on any page error.
//   NODE_PATH=$(npm root -g) node tools/smoke.cjs [--answers 12] [--shots dir]
const path = require("path");
const { chromium } = require("playwright");

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1] : def;
}

(async () => {
  // GAME=dist/To-1520/to-1520.html checks the PC edition instead.
  const file = "file://" + path.resolve(__dirname, "..", process.env.GAME || "index.html");
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  // Keep the test offline: web fonts fall back to the local stacks.
  await page.route(/^https?:\/\//, (route) => route.abort());
  await page.goto(file);
  await page.waitForTimeout(600);
  // Dismiss the welcome dialog if it is showing.
  // Skip the playable intro: this check is about answering, not the tour.
  let go = page.locator('[data-act="welcomeSkip"]');
  if (!(await go.count())) go = page.locator('[data-act="welcomeGo"]');
  if (await go.count()) await go.first().click();
  const n = Number(arg("answers", 12));
  for (let i = 0; i < n; i++) {
    const choice = page.locator('#sheet [data-act="pick"]');
    if (await choice.count()) await choice.nth(i % 4).click();
    else {
      const inp = page.locator("#sprIn");
      if (await inp.count()) await inp.fill(String(i + 1));
    }
    const check = page.locator("#checkBtn");
    if (await check.count()) await check.click();
    await page.waitForTimeout(120);
    // Close any dialog that popped up (level-ups, promotions, evolutions).
    for (let k = 0; k < 3; k++) {
      const modal = page.locator('#modal:not([hidden]) [data-act="modalClose"]');
      if (await modal.count()) { await modal.first().click(); await page.waitForTimeout(80); } else break;
    }
    const next = page.locator("#nextBtn");
    if (await next.count()) await next.click();
    await page.waitForTimeout(120);
  }
  const state = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("grind1520.save.v1") || "null"); } catch (e) { return null; }
  });
  const shots = arg("shots", "");
  if (shots) await page.screenshot({ path: path.join(shots, "smoke.png") });
  await browser.close();
  console.log(JSON.stringify({ answered: state && state.stats.answered, total: state && state.r ? Object.values(state.r).length : 0, errors }, null, 1));
  process.exit(errors.length ? 1 : 0);
})();
