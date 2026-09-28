// Boots orbit1520.html in headless Chromium, answers questions, buys upgrades, and fails on any page error.
//   NODE_PATH=$(npm root -g) node tools/orbit-smoke.cjs [--shots dir] [--mobile]
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const { routeThree } = require("./three.cjs");

function arg(name, def) { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : def; }
const has = (name) => process.argv.includes("--" + name);

(async () => {
  const file = "file://" + path.resolve(__dirname, "..", "orbit1520.html");
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const errors = [];
  const mobile = has("mobile");
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 780 } : { width: 1440, height: 900 }, hasTouch: mobile, isMobile: mobile });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.type() + ": " + m.text()); });
  await page.route(/^https?:\/\//, (route) => route.abort());
  await routeThree(page);
  const shots = arg("shots", "");
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, n + ".png") }); };
  await page.goto(file);
  await page.waitForFunction(() => window.ORBIT && document.getElementById("boot").classList.contains("gone"), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await shot("01-welcome");
  // welcome → start practicing
  const go = page.locator('#modal [data-modal="go"]');
  if (await go.count()) await go.click();
  await page.waitForTimeout(400);
  await shot("02-practice");
  // Answer 24 questions through the real UI: alternate right and wrong so both paths run.
  const results = { right: 0, wrong: 0, spr: 0, mc: 0 };
  for (let i = 0; i < 24; i++) {
    const q = await page.evaluate(() => { const c = window.ORBIT.cur; return c && !c.done ? { spr: !!c.q.spr, a: Array.isArray(c.q.a) ? c.q.a[0] : c.q.a } : null; });
    if (!q) throw new Error("no current question at step " + i);
    const wantWrong = i % 5 === 4;
    if (q.spr) { results.spr++; await page.fill("#sprIn", String(wantWrong ? q.a + 1 : q.a)); await page.click('[data-act="submitSpr"]'); }
    else { results.mc++; const idx = wantWrong ? (q.a + 1) % 4 : q.a; await page.click(`.choices button[data-i="${idx}"]`); }
    if (wantWrong) results.wrong++; else results.right++;
    await page.waitForTimeout(60);
    if (i === 0) await shot("02b-feedback");
    const ns = page.locator('[data-act="newSession"]');
    if (await ns.count()) { await shot("02c-summary"); await ns.click(); } else await page.click("#nextBtn");
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(300);
  await shot("03-after-answers");
  // Buy things through the station view
  await page.evaluate(() => { window.ORBIT.state.data += 250000; });
  await page.click('#dock [data-view="station"]');
  await page.waitForTimeout(300);
  const buys = ["buyMod", "buyMod", "buyB", "buyB", "buyB", "buyR"];
  for (const b of buys) {
    const btn = page.locator(`#pbody [data-act="${b}"]:not([disabled])`).first();
    if (await btn.count()) await btn.click();
    await page.waitForTimeout(80);
  }
  // rings + uplink specifically
  for (const kind of ["ring", "uplink", "solar", "sat"]) {
    const btn = page.locator(`#pbody [data-act="buyB"][data-kind="${kind}"]:not([disabled])`).first();
    if (await btn.count()) await btn.click();
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(500);
  await shot("04-station");
  await page.click('[data-act="closePanel"]');
  await page.waitForTimeout(600);
  await shot("05-scene");
  // click a module label to open the domain view
  const lbl = page.locator(".lbl.on").first();
  if (await lbl.count()) { await lbl.click({ force: true }); await page.waitForTimeout(300); await shot("06-domain"); }
  const practiceBtn = await page.evaluate(() => { const b = document.querySelector('[data-act="practiceDom"]'); if (!b) return null; const cs = getComputedStyle(b); return { cls: b.className, disabled: b.disabled, opacity: cs.opacity, bg: cs.backgroundImage.slice(0, 40), color: cs.color }; });
  // missions + settings views
  await page.click('#dock [data-view="missions"]'); await page.waitForTimeout(200); await shot("07-missions");
  await page.click('#dock [data-view="settings"]'); await page.waitForTimeout(200); await shot("08-settings");
  // export/import roundtrip
  const code = await page.evaluate(() => { window.ORBIT.save(); return btoa(unescape(encodeURIComponent(JSON.stringify(window.ORBIT.state)))); });
  // offline: rewind lastSave 3h and reload
  await page.evaluate(() => { const s = window.ORBIT.state; s.lastSave = Date.now() - 3 * 3600 * 1000; localStorage.setItem("orbit1520.save.v1", JSON.stringify(s)); window.__resetting = true; });
  await page.reload();
  await page.waitForFunction(() => window.ORBIT && document.getElementById("boot").classList.contains("gone"), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  const awayShown = await page.locator("#modal .away").count();
  await shot("09-away");
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)); }; requestAnimationFrame(f); }));
  const state = await page.evaluate(() => { const s = window.ORBIT.state; return { answered: s.stats.answered, correct: s.stats.correct, data: Math.round(s.data), score: window.ORBIT.score(), b: s.b, res: Object.keys(s.res), review: s.review.length, ach: Object.keys(s.ach).length, missionsDone: s.missionsDone, prod: window.ORBIT.production() }; });
  await browser.close();
  console.log(JSON.stringify({ results, awayShown, fps, state, practiceBtn, codeLen: code.length, errors }, null, 1));
  process.exit(errors.length ? 1 : 0);
})();
