// Balance simulator: plays the real engine from index.html with a modeled student.
//
//   node tools/sim.cjs                 default run (1160-level student, 60 questions a day, 21 days)
//   node tools/sim.cjs --days 30 --per-day 40 --learn 0.25 --seed 7
//
// The student answers correctly with the engine's own pCorrect() at their true
// ability, and the true ability rises a little with every question in a domain.
// A greedy shopper spends sparks on whatever buys the most income per spark.
const { loadEngine } = require("./engine.cjs");

function arg(name, def) {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? Number(process.argv[i + 1]) : def;
}

const TRUE_1160 = { ii: 515, cs: 575, eoi: 515, sec: 575, alg: 655, adv: 580, psda: 580, geo: 580 };

function simulate(opts) {
  const E = loadEngine(opts.file);
  if (opts.patch) opts.patch(E);
  const DAY = 864e5;
  let now = Date.UTC(2026, 8, 28, 20, 0, 0);
  const start = now;
  const S = E.newState(now);
  S.welcomed = true;
  const rnd = E.mulberry32(opts.seed || 1);
  const T = Object.assign({}, opts.truth || TRUE_1160);
  const recent = [];
  const rows = [];
  const firsts = {};
  const mark = (k, v) => { if (!(k in firsts)) firsts[k] = v; };
  let answered = 0, ascends = 0;
  let incomeEMA = 0; // sparks per active second from answers

  function answerIncomeShare(kind) {
    const L = S.up;
    return {
      focus: 8 / (10 + 8 * L.focus) * 0.75,
      combo: L.combo < E.UPG.combo.max ? 0.06 : 0,
      eureka: 0.015 * ((E.hasPerk(S, "golden") ? 12 : 7) - 1) / (1 + (0.02 + 0.015 * L.eureka) * 6),
      pace: 0.1 * 0.55 / (1.25 + 0.1 * L.pace),
      deep: 0.2 * 0.4 / (1 + 0.4 * L.deep),
      mining: 0.02,
      bounty: 0.03 * 0.25 / (1 + 0.25 * L.bounty),
    }[kind] || 0;
  }

  function shop() {
    for (let guard = 0; guard < 400; guard++) {
      const gm = E.globalMult(S), rm = 1 + E.relicSum(S, "rate");
      let best = null;
      const consider = (value, cost, buy, label) => {
        if (!(cost > 0) || !(value > 0)) return;
        const v = value / cost;
        if (!best || v > best.v) best = { v, cost, buy, label };
      };
      E.UPG_ORDER.forEach((id) => {
        if (S.up[id] >= E.UPG[id].max) return;
        consider(incomeEMA * answerIncomeShare(id), E.upCost(id, S.up[id]), () => E.buyUp(S, id), "up:" + id);
      });
      E.GENS.forEach((G) => {
        if (!E.genUnlocked(S, G)) return;
        consider(G.rate * gm * rm, E.genCost(S, G.id, 1), () => E.buyGen(S, G.id, 1), "gen:" + G.id);
      });
      if (E.hubCost) {
        E.DKEYS.forEach((d) => {
          if (!E.hubCanBuy(S, d)) return;
          consider(E.hubGainNext(S, d) * gm * rm, E.hubCost(S, d), () => E.buyHub(S, d), "hub:" + d);
        });
      }
      if (!best || best.cost > S.sparks) return;
      best.buy();
    }
  }

  // The city: found it when it unlocks, then buy whatever adds the most output per coin.
  let blimpAt = 0;
  function city(t, dt) {
    if (!E.cityBuilt) return;
    if (!E.cityBuilt(S)) { if (E.isOpen(S, "city")) { E.cityFound(S, "Simtown", t); mark("city:founded", `day ${Math.floor((t - start) / DAY) + 1} q${answered}`); } return; }
    E.cityTick(S, dt, true, t);
    // Blimps come every 4 to 8 minutes; the student has the city on screen about half the time.
    if (!blimpAt) blimpAt = t + 360e3;
    if (t >= blimpAt) { blimpAt = t + (240e3 + rnd() * 240e3) / E.blimpFreq(S); if (rnd() < 0.4) E.blimpReward(S, rnd, t); }
    for (let guard = 0; guard < 200; guard++) {
      const base = E.cityRate(S, t, true) || 1;
      let best = null;
      const consider = (gain, cost, buy) => { if (cost > 0 && gain > 0 && (!best || gain / cost > best.v)) best = { v: gain / cost, cost, buy }; };
      E.CITY_B.forEach((B) => { if (!E.cityCanBuild(S, B)) return; const one = E.CITY_CLASS[B.cls].r * E.cityLearn(S, B) * E.cityBMult(S, B, t, true) * E.cityGlobal(S, t, true); consider(one, E.cityCost(S, B.id, 1), () => E.cityBuy(S, B.id, 1)); });
      E.cityUpsOpen(S).forEach((u) => {
        let gain = 0;
        if (u.kind === "b") gain = E.cityRateOf(S, E.CITY_BY[u.b], t, true);
        else if (u.kind === "d") gain = 0.5 * E.CITY_B.filter((B) => B.d === u.d).reduce((a, B) => a + E.cityRateOf(S, B, t, true), 0);
        else gain = base * 0.05;
        consider(gain, E.cityUpCost(S, u), () => E.cityBuyUp(S, u.id));
      });
      E.WONDERS.forEach((W) => { const st = S.city.w[W.id] || 0; if (st < W.stages.length && E.cityPop(S) >= W.pop) consider(base * 0.1, W.stages[st], () => E.wonderBuild(S, W.id)); });
      if (!best || best.cost > S.city.coins) break;
      best.buy();
    }
  }
  function gauntlet(t) {
    const p = E.proj(S), sec = p.rw <= p.m ? "rw" : "m";
    E.gauntStart(S, sec, t, rnd);
    for (let mod = 0; mod < 2; mod++) {
      const G = S.g;
      G.qs.forEach((q, k) => {
        const ok = rnd() < E.pCorrect(T[q.d], q.lv, !q.spr);
        G.resp[k] = ok ? (q.spr ? String(q.spr.vals[0]) : q.correct) : (q.spr ? "-99999" : (q.correct + 1) % 4);
        G.ms[k] = 60000;
      });
      const r = E.gauntFinishModule(S, t, rnd);
      if (r.stage === "route") S.g.pending = false; else mark("gauntlet:" + E.ascendTarget(S), `score ${r.score}`);
    }
  }

  for (let day = 0; day < opts.days; day++) {
    let t = now;
    // Coming back: offline earnings, quests, chests.
    const off = E.offlineGain(S, t);
    if (off) E.addSparks(S, off.gain);
    S.lastSeen = t; S.lastInteract = t;
    E.rollDay(S, t);
    for (let i = 0; i < opts.perDay; i++) {
      const q = E.nextQuestion(S, t, rnd, recent);
      recent.push(q.key); if (recent.length > 24) recent.shift();
      const ok = rnd() < E.pCorrect(T[q.d], q.lv, !q.spr);
      const ms = (E.DOMAINS[q.d].sec === "rw" ? 62 : 84) * 1000 * (0.65 + 0.7 * rnd());
      const res = E.applyAnswer(S, q, ok, { now: t + ms, ms, rnd, mode: "train" });
      const dt = (ms + 14000) / 1000;
      E.tick(S, dt, true);
      city(t + ms, dt);
      incomeEMA = incomeEMA ? incomeEMA * 0.9 + 0.1 * (res.gain / dt) : res.gain / dt;
      t += ms + 14000;
      answered++;
      T[q.d] = Math.min(760, T[q.d] + (opts.learn || 0));
      if (E.claimQuest) S.quests.list.forEach((qq, k) => { if (qq.done && !qq.claimed) E.claimQuest(S, k); });
      if (E.claimWeekly) E.claimWeekly(S);
      if (E.pickCard && S.pick && !S.pick.done) while (!S.pick.done) E.pickCard(S, S.pick.got.length ? (S.pick.got[0] + 1) % 3 : Math.floor(rnd() * 3));
      ["l", "e", "r", "c"].forEach((r) => { while (S.chests[r] > 0) E.openChest(S, r, rnd); });
      if (E.evoCheck) E.evoCheck(S, t);
      shop();
      const p = E.proj(S).total, rk = E.rankOf(p);
      mark("rank:" + rk.label, `day ${day + 1} q${answered} (${p})`);
      E.GENS.forEach((G) => { if (E.genUnlocked(S, G)) mark("unlock:" + G.id, `day ${day + 1} q${answered}`); });
      if (E.conn) { const st = S.evo ? S.evo.stage : 0; mark("evo:" + st, `day ${day + 1} q${answered} (${E.conn(S)} conn)`); }
      // Once a day, halfway through, the student runs a Gauntlet on their weaker section.
      if (i === Math.floor(opts.perDay / 2) && E.isOpen && E.isOpen(S, "arena")) gauntlet(t);
      if (opts.ascend && E.insightGain(S) >= Math.max(opts.ascend, Math.ceil(S.insight * 0.5))) {
        const g = E.insightGain(S);
        if (E.doSleep(S)) { ascends++; mark("ascend:" + ascends, `day ${day + 1} q${answered} (+${g} insight)`); }
      }
    }
    S.lastSeen = t;
    const p = E.proj(S);
    rows.push({
      day: day + 1, q: answered, proj: p.total, rank: E.rankOf(p.total).label,
      conn: E.conn ? E.conn(S) : "-", evo: S.evo ? S.evo.stage : "-",
      sparks: E.fmt(S.sparks), rate: E.fmt(E.idleRate(S)) + "/s", life: E.fmt(S.lifeSparks),
      lv: S.pl.lv, ins: S.insight,
      gens: E.GENS.map((G) => S.gen[G.id]).join("/"),
      hubs: S.hub ? E.DKEYS.map((d) => S.hub[d]).join(",") : "-",
      city: S.city && S.city.founded ? E.fmt(S.city.coins) + " · " + E.fmt(E.cityRate(S, now, true)) + "/s · pop " + E.cityPop(S) + " · x" + E.citySparkMult(S).toFixed(2) : "-",
      r: E.DKEYS.map((d) => Math.round(S.r[d])).join(" "),
      truth: E.DKEYS.map((d) => Math.round(T[d])).join(" "),
    });
    now += DAY;
  }
  return { rows, firsts, S, E };
}

if (require.main === module) {
  const r = simulate({
    days: arg("days", 21), perDay: arg("per-day", 60), learn: arg("learn", 0.25), seed: arg("seed", 1),
    ascend: arg("ascend", 3),
  });
  console.table(r.rows);
  console.log(r.firsts);
}
module.exports = { simulate, TRUE_1160 };
