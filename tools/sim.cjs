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
      incomeEMA = incomeEMA ? incomeEMA * 0.9 + 0.1 * (res.gain / dt) : res.gain / dt;
      t += ms + 14000;
      answered++;
      T[q.d] = Math.min(760, T[q.d] + (opts.learn || 0));
      if (E.claimQuest) S.quests.list.forEach((qq, k) => { if (qq.done && !qq.claimed) E.claimQuest(S, k); });
      if (E.claimWeekly) E.claimWeekly(S);
      ["l", "e", "r", "c"].forEach((r) => { while (S.chests[r] > 0) E.openChest(S, r, rnd); });
      if (E.evoCheck) E.evoCheck(S, t);
      shop();
      const p = E.proj(S).total, rk = E.rankOf(p);
      mark("rank:" + rk.label, `day ${day + 1} q${answered} (${p})`);
      E.GENS.forEach((G) => { if (E.genUnlocked(S, G)) mark("unlock:" + G.id, `day ${day + 1} q${answered}`); });
      if (E.conn) { const st = S.evo ? S.evo.stage : 0; mark("evo:" + st, `day ${day + 1} q${answered} (${E.conn(S)} conn)`); }
      if (opts.ascend && E.insightGain(S) >= Math.max(opts.ascend, Math.ceil(S.insight * 0.5))) {
        mark("ascend:" + (ascends + 1), `day ${day + 1} q${answered} (+${E.insightGain(S)} insight)`);
        E.doSleep(S); ascends++;
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
