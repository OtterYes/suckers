// Deeper checks for orbit1520.html: keyboard answering, typed-answer parsing, procedural drills,
// hints, publish and star perks, low graphics, import round-trip, hard reset, and the 2D fallback.
//   NODE_PATH=$(npm root -g) node tools/orbit-flows.cjs
const path = require("path");
const assert = require("assert");
const { chromium } = require("playwright");
const { routeThree } = require("./three.cjs");

const file = "file://" + path.resolve(__dirname, "..", "orbit1520.html");
const booted = (page) => page.waitForFunction(() => window.ORBIT && document.getElementById("boot").classList.contains("gone"), null, { timeout: 30000 });

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.route(/^https?:\/\//, (r) => r.abort());
  await routeThree(page);
  await page.goto(file);
  await booted(page);
  await page.click('#modal [data-modal="go"]');
  const passed = [];
  const check = (name, ok, extra) => { assert.ok(ok, name + (extra ? " " + JSON.stringify(extra) : "")); passed.push(name); };

  // 1. keyboard answering
  await page.waitForSelector(".choices button, #sprIn");
  let q = await page.evaluate(() => { const c = window.ORBIT.cur; return { spr: !!c.q.spr, a: c.q.a, pos: c.order ? c.order.indexOf(c.q.a) : -1 }; });
  if (q.spr) { await page.fill("#sprIn", String(Array.isArray(q.a) ? q.a[0] : q.a)); await page.keyboard.press("Enter"); }
  else await page.keyboard.press(String(q.pos + 1));
  await page.waitForTimeout(80);
  check("keyboard answers", await page.evaluate(() => window.ORBIT.cur.done && window.ORBIT.cur.correct === true));
  await page.keyboard.press("Enter"); await page.waitForTimeout(60);
  check("enter advances", await page.evaluate(() => !window.ORBIT.cur.done));

  // 2. typed-answer parsing
  const parse = await page.evaluate(() => {
    const { parseNum, sprMatch } = window.ORBIT._;
    const q1213 = { a: [12 / 13] }, half = { a: 0.5 }, negOne = { a: -1 }, tenHalf = { a: 10.5 };
    return {
      half: [sprMatch(half, parseNum("1/2")), sprMatch(half, parseNum(".5")), sprMatch(half, parseNum("0.50")), sprMatch(half, parseNum(" 2/4 "))],
      frac: [sprMatch(q1213, parseNum("12/13")), sprMatch(q1213, parseNum(".923")), sprMatch(q1213, parseNum("0.9231")), sprMatch(q1213, parseNum("0.92"))],
      neg: [sprMatch(negOne, parseNum("-1")), sprMatch(negOne, parseNum("−1")), sprMatch(negOne, parseNum("-2/2"))],
      dec: [sprMatch(tenHalf, parseNum("10.5")), sprMatch(tenHalf, parseNum("21/2")), sprMatch(tenHalf, parseNum("10,5"))],
      bad: [parseNum("3/0"), parseNum("abc"), parseNum(""), parseNum("1/2/3")],
    };
  });
  check("parse half", parse.half.every(Boolean), parse.half);
  check("parse fraction tolerance", parse.frac[0] && parse.frac[1] && parse.frac[2] && !parse.frac[3], parse.frac);
  check("parse negatives", parse.neg.every(Boolean), parse.neg);
  check("parse decimals", parse.dec[0] && parse.dec[1] && !parse.dec[2], parse.dec);
  check("parse rejects junk", parse.bad.every((v) => v === null), parse.bad);

  // 3. procedural drills are well formed
  const gen = await page.evaluate(() => {
    const { genQuestion, GEN } = window.ORBIT._; const bad = []; let count = 0;
    for (const d of Object.keys(GEN)) for (const t of [1, 2]) for (let i = 0; i < 300; i++) {
      const g = genQuestion(d, t); if (!g) continue; count++;
      const text = g.q + " " + g.e;
      if (!Number.isFinite(g.a)) bad.push([g.id, "answer", g.a]);
      if (/undefined|NaN|\+ −|− −|\+ \+|− \+|\(\)|  /.test(text)) bad.push([g.id, text]);
      if (g.d !== d || g.t !== t || !g.spr || !g.gen || !g.tid) bad.push([g.id, "meta"]);
    }
    return { count, bad: bad.slice(0, 5), badCount: bad.length };
  });
  check("drills well formed", gen.badCount === 0 && gen.count > 2000, gen);

  // 4. bank integrity
  const bank = await page.evaluate(() => {
    const B = window.ORBIT.BANK; const ids = new Set(); const bad = []; const per = {};
    for (const q of B) {
      if (ids.has(q.id)) bad.push(["dup", q.id]); ids.add(q.id);
      per[q.d] = per[q.d] || [0, 0, 0]; per[q.d][q.t - 1]++;
      if (q.spr) { if (!Number.isFinite(Array.isArray(q.a) ? q.a[0] : q.a)) bad.push(["spr", q.id]); }
      else { if (!Array.isArray(q.c) || q.c.length !== 4 || !(q.a >= 0 && q.a < 4)) bad.push(["mc", q.id]); if (new Set(q.c).size !== 4) bad.push(["dupchoice", q.id]); }
      if (!q.e || q.e.length < 20 || q.e.length > 320) bad.push(["expl", q.id, (q.e || "").length]);
      if (![1, 2, 3].includes(q.t)) bad.push(["tier", q.id]);
    }
    const answerPositions = B.filter((q) => !q.spr).reduce((m, q) => (m[q.a] = (m[q.a] || 0) + 1, m), {});
    return { n: B.length, bad, per, answerPositions };
  });
  check("bank ≥120 valid", bank.n >= 120 && bank.bad.length === 0, bank);
  const spread = await page.evaluate(() => { const seen = new Set(); window.ORBIT.state.focus = "cs"; for (let i = 0; i < 40; i++) { window.ORBIT.nextQuestion(); const c = window.ORBIT.cur; if (c.order) seen.add(c.order.indexOf(c.q.a)); } window.ORBIT.state.focus = "mix"; return [...seen].sort(); });
  check("answer position is shuffled", spread.length === 4, spread);
  check("bank balanced", Object.values(bank.per).every((t) => t[0] >= 4 && t[1] >= 4 && t[2] >= 4) && Object.keys(bank.per).length === 8, bank.per);

  // 5. hint (eliminate one)
  await page.evaluate(() => { const s = window.ORBIT.state; s.data += 5000; s.res.hint = true; s.focus = "cs"; window.ORBIT.nextQuestion(); window.ORBIT.openPanel("practice"); });
  await page.waitForTimeout(100);
  await page.keyboard.press("h"); await page.waitForTimeout(60);
  const hint = await page.evaluate(() => { const c = window.ORBIT.cur; return { gone: c.gone, a: c.q.a, hinted: c.hinted, goneCount: document.querySelectorAll(".choices button.gone").length }; });
  check("hint removes a wrong choice", hint.hinted && hint.gone >= 0 && hint.gone !== hint.a && hint.goneCount === 1, hint);

  // 6. wrong answer → review queue → returns
  await page.evaluate(() => { const c = window.ORBIT.cur; window.ORBIT.answerCurrent((c.q.a + 1) % 4); });
  const rev = await page.evaluate(() => ({ n: window.ORBIT.state.review.length, combo: window.ORBIT.state.combo }));
  check("miss queues a review and resets combo", rev.n >= 1 && rev.combo === 0, rev);
  const missedId = await page.evaluate(() => window.ORBIT.state.review[0].id);
  const seenAgain = await page.evaluate((id) => { const S = window.ORBIT.state; S.focus = "mix"; let found = false; for (let i = 0; i < 20 && !found; i++) { window.ORBIT.nextQuestion(); const c = window.ORBIT.cur; if (c.q.id === id && c.review) found = true; else window.ORBIT.answerCurrent(c.q.spr ? (Array.isArray(c.q.a) ? c.q.a[0] : c.q.a) : c.q.a); } return found; }, missedId);
  check("missed question returns as review", seenAgain);

  // 7. publish and star perks
  await page.evaluate(() => { const s = window.ORBIT.state; s.runEarned = 100000; s.data = 999; s.b.sat = 3; s.dom.alg.lvl = 4; });
  await page.click('#dock [data-view="station"]'); await page.waitForTimeout(150);
  check("publish button enabled", await page.evaluate(() => !document.getElementById("pubBtn").disabled && window.ORBIT._.starsForPublish() === 2));
  await page.click("#pubBtn"); await page.waitForTimeout(100);
  await page.click('#modal [data-modal="doPublish"]'); await page.waitForTimeout(150);
  const pub = await page.evaluate(() => { const s = window.ORBIT.state; return { stars: s.stars, data: s.data, sat: s.b.sat, lvl: s.dom.alg.lvl, hint: !!s.res.hint, runEarned: s.runEarned, modal: document.getElementById("modal").textContent.includes("published"), mastery: s.dom.cs.r }; });
  check("publish resets run and grants stars", pub.stars === 2 && pub.data < 100 && pub.sat === 0 && pub.lvl === 0 && pub.hint && pub.runEarned < 100 && pub.modal && pub.mastery > 0, pub);
  await page.click('#modal [data-modal="close"]'); await page.waitForTimeout(80);
  await page.click('#pbody [data-act="buyP"][data-id="head"]'); await page.waitForTimeout(80);
  const perk = await page.evaluate(() => ({ head: !!window.ORBIT.state.perks.head, spent: window.ORBIT.state.starsSpent }));
  check("star perk purchase", perk.head && perk.spent === 1, perk);

  // 8. low graphics + labels toggles
  await page.click('#dock [data-view="settings"]'); await page.waitForTimeout(100);
  await page.click('#pbody [data-act="setting"][data-k="low"]'); await page.waitForTimeout(300);
  await page.click('#pbody [data-act="setting"][data-k="labels"]'); await page.waitForTimeout(100);
  const st = await page.evaluate(() => ({ low: window.ORBIT.state.settings.low, labels: window.ORBIT.state.settings.labels, hidden: document.getElementById("labels").style.display === "none" }));
  check("settings toggles", st.low && !st.labels && st.hidden, st);
  await page.click('#pbody [data-act="setting"][data-k="labels"]');

  // 9. export / import round trip
  const code = await page.evaluate(() => { window.ORBIT.state.data = 4242; window.ORBIT.save(); return btoa(unescape(encodeURIComponent(JSON.stringify(window.ORBIT.state)))); });
  await page.evaluate(() => { window.ORBIT.state.data = 1; window.ORBIT.save(); });
  await page.click('#pbody [data-act="import"]'); await page.fill("#impTa", code); await page.click('#modal [data-modal="doImport"]');
  await page.waitForTimeout(300); await booted(page); await page.waitForTimeout(200);
  const imported = await page.evaluate(() => Math.round(window.ORBIT.state.data));
  check("import restores state", imported >= 4242 && imported < 5000, imported);
  const badImport = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("orbit1520.save.v1")).stars; } catch (e) { return null; } });
  check("stars survive import", badImport === 2, badImport);

  // 10. hard reset
  await page.click('#dock [data-view="settings"]'); await page.waitForTimeout(100);
  await page.click('#pbody [data-act="reset"]'); await page.click('#modal [data-modal="doReset"]');
  await page.waitForTimeout(300); await booted(page); await page.waitForTimeout(200);
  const fresh = await page.evaluate(() => ({ answered: window.ORBIT.state.stats.answered, stars: window.ORBIT.state.stars, welcome: document.getElementById("modal").textContent.includes("Welcome"), stored: localStorage.getItem("orbit1520.save.v1") === null || JSON.parse(localStorage.getItem("orbit1520.save.v1")).stats.answered === 0 }));
  check("hard reset wipes save", fresh.answered === 0 && fresh.stars === 0 && fresh.welcome && fresh.stored, fresh);

  // 11. 2D fallback when three.js cannot load
  const page2 = await ctx.newPage();
  const errors2 = [];
  page2.on("pageerror", (e) => errors2.push(e.message));
  await page2.route(/^https?:\/\//, (r) => r.abort());
  await page2.goto(file);
  await booted(page2); await page2.waitForTimeout(300);
  const fb = await page2.evaluate(() => ({ labels: document.querySelectorAll("#labels .lbl").length, msg: document.getElementById("bootMsg").textContent, canAnswer: !!document.querySelector("#modal") }));
  await page2.click('#modal [data-modal="go"]'); await page2.waitForTimeout(100);
  const fbq = await page2.evaluate(() => !!window.ORBIT.cur);
  check("2D fallback boots", fb.labels === 8 && /2D/.test(fb.msg) && fbq && errors2.length === 0, { fb, errors2 });

  await browser.close();
  console.log(JSON.stringify({ passed, errors }, null, 1));
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
