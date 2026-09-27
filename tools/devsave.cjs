// A maxed-out save for exploring: every building at level 6, every wonder finished, a 1520
// projected score, every skill lit with Gold mastery, the final evolution, Unit 2 cleared,
// all 16 artifacts, every zone at tier 5, level 120, and more coins, sparks, supplies, and
// gems than you can spend. Today's Adventure is planned fresh, the Harbor Bridge is ready to
// restore, the Town Square's evidence is complete, and every building has a tool on offer.
//   node tools/devsave.cjs [out.txt]      (default: dist/dev-save.txt)
// Paste the code into Settings → Backup code → Restore. It replaces the save in that browser.
const fs = require("fs");
const path = require("path");
const { simulate } = require("./sim.cjs");
const ENG = require("./engine.cjs").loadEngine();

const DAY = 864e5;
const now = Date.now();
// A realistic 90-day player, ending today, as the starting point.
const S = simulate({ days: 90, perDay: 60, learn: 0.25, seed: 3, ascend: 3, start: now - 90 * DAY }).S;

// Scores at the top of the scale.
ENG.DKEYS.forEach((d) => { S.r[d] = 760; const x = S.dx[d]; x.cal = true; x.n = Math.max(x.n || 0, 80); x.c = Math.max(x.c || 0, 70); x.rec = "1".repeat(20); });
S.peak = 1520;

// Every skill: five nodes and Gold mastery.
ENG.DKEYS.forEach((d) => ENG.DOMAINS[d].skills.forEach((sk) => {
  const s = S.sk[d + "|" + sk] || (S.sk[d + "|" + sk] = { n: 0, c: 0 });
  s.n = Math.max(s.n, 140); s.c = Math.max(s.c, 120); s.hn = Math.max(s.hn || 0, 25); s.h = Math.max(s.h || 0, 20);
  s.hp = Math.max(s.hp || 0, 15); s.hr = "1".repeat(10); s.m = 3;
}));

// The engine: final evolution, the Universe form, maxed upgrades, pathways, and hubs.
S.evo.stage = S.evo.seen = ENG.EVO.length - 1;
S.form = "universe";
S.sparks = 1e21; S.runSparks = Math.max(S.runSparks || 0, 1e21); S.lifeSparks = Math.max(S.lifeSparks || 0, 1e22);
Object.keys(ENG.UPG).forEach((k) => { S.up[k] = Math.min(ENG.UPG[k].max, 200); });
ENG.GENS.forEach((g) => { S.gen[g.id] = Math.max(S.gen[g.id] || 0, 250); });
ENG.DKEYS.forEach((d) => { S.hub[d] = Math.max(S.hub[d] || 0, 60); });
S.pl.lv = Math.max(S.pl.lv || 1, 80);
S.chests = { c: 5, r: 5, e: 5, l: 5 };
S.boosts = { dbl: 3, crit: 3, xp: 3, shield: 3 };

// The city: all 29 buildings at level 6, every upgrade, every wonder complete.
const C = S.city;
C.founded = C.founded || now - 80 * DAY; C.asked = true; C.name = C.name || "Sparkton";
ENG.CITY_B.forEach((B) => { C.b[B.id] = 250; });
C.built = Math.max(C.built || 0, 250 * ENG.CITY_B.length);
ENG.CITY_UP.forEach((u) => { C.up[u.id] = 1; });
ENG.WONDERS.forEach((W) => { C.w[W.id] = W.stages.length; });
C.coins = 1e21; C.life = Math.max(C.life || 0, 1e22); C.blimps = Math.max(C.blimps || 0, 30);
C.pol = "study"; C.polAt = 0; C.buffs = [];

// Units: Unit 2 finished, with the Expedition open, every artifact, and supplies to burn.
S.unit = { u: 2, st: 5, ready: true, cleared: ["1.1", "1.2", "1.3", "1.4", "1.5", "2.1", "2.2", "2.3", "2.4", "2.5"], legacy: Math.max(1, (S.unit && S.unit.legacy) || 1), at: {} };
if (!S.exp) S.exp = ENG.expFresh(4242, 3);
S.exp.sup = 1e12; S.exp.gems = 1e9;
ENG.ARTS.forEach((A) => { S.arts[A.id] = now; });

// Zones: every zone at tier 5 with its tree maxed and both keystones, talents, and level 120
// (100 and five prestige stars) with the Level Road left to claim.
S.pl.lv = 120; S.pl.xp = 0;
ENG.DKEYS.forEach((d) => {
  S.zone[d].t = 5;
  ENG.ZNODES.forEach((N) => { if (ENG.zNodeOn(d, N.id)) S.zone[d].up[N.id] = ENG.zNode(d, N.id).max; });
  S.tal.k[d + "1"] = 1; S.tal.k[d + "2"] = 1;
});
// Talents: buy what the points allow, one playstyle group at a time.
ENG.TALENTS.forEach((T) => { while (ENG.talBuy(S, T.id)); });
S.road = { c: {} }; S.title = "legend";
S.zone.adv.fuel = 6; S.zone.psda.vault = 1e20; S.zone.geo.gems = 20; S.zone.alg.mach = 40;

// Open straight into the 3D town, in daylight. Older tours are marked seen; the short v10 list of what
// changed shows once. The Harbor Bridge is earned but not yet restored, so the restoration can be tried,
// and no tools are installed yet, so every offer can be. The engine seeds proficiency windows and offers on load.
Object.assign(S.settings, { view: "3d", tod: "day", w3new: true, w3seen: false });
S.welcomed = true; S.seenV3 = S.seenV4 = S.seenV5 = S.seenV6 = S.seenV7 = S.seenV8 = S.seenV9 = true; S.seenV10 = false;
S.onb = { step: 9, done: true }; S.adv = null; S.world = {}; S.tools = {}; S.opps = {}; S.intro = { town: 1, hall: 1 }; S.round = null;
ENG.townFix(S, now);
S.streak = 0; S.lastSeen = S.lastInteract = now;
// Trim history the game doesn't need, to keep the code short.
S.seen = {}; S.hist = (S.hist || []).slice(-60); S.ai = []; S.miss = (S.miss || []).slice(-20);

const code = "G1520:" + Buffer.from(JSON.stringify(S), "utf8").toString("base64");
const out = process.argv[2] || path.join(__dirname, "..", "dist", "dev-save.txt");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, code);
console.log("wrote", path.relative(process.cwd(), out), "(" + Math.round(code.length / 1024) + " KB); projected", ENG.proj(S).total, "· residents", Math.round(ENG.cityPop(S)));
