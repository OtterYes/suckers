## The station: modules on a 3D grid that can grow in any of six directions,
## and residents who run their own lives in it. No drawing here, so the tests can run it headless.
class_name StationSim
extends RefCounted

const DAY := 240.0          # real seconds in one station day
const REACH := 8            # how far from the core the station may grow, in cells
const DIRS: Array[Vector3i] = [Vector3i(1,0,0), Vector3i(-1,0,0), Vector3i(0,1,0), Vector3i(0,-1,0), Vector3i(0,0,1), Vector3i(0,0,-1)]
const STATS := ["S", "P", "A", "C", "I"]
const STAT_NAMES := {"S": "Strength", "P": "Perception", "A": "Agility", "C": "Charisma", "I": "Intellect"}

## stat: the stat a worker uses there. makes: what the room produces. cap: jobs. beds: sleeping places.
const TYPES := {
	"core":    {"name": "Command Core",   "cost": 0,   "cap": 0, "stat": "",  "makes": "",        "beds": 2, "col": Color("#7FE3FF")},
	"hall":    {"name": "Junction",       "cost": 40,  "cap": 0, "stat": "",  "makes": "",        "beds": 0, "col": Color("#8FA0B8")},
	"reactor": {"name": "Reactor",        "cost": 120, "cap": 2, "stat": "S", "makes": "power",   "beds": 0, "col": Color("#FFC933")},
	"farm":    {"name": "Hydroponics",    "cost": 120, "cap": 2, "stat": "A", "makes": "food",    "beds": 0, "col": Color("#6BCB77")},
	"water":   {"name": "Water Recycler", "cost": 120, "cap": 2, "stat": "P", "makes": "water",   "beds": 0, "col": Color("#5C9DFF")},
	"habitat": {"name": "Habitat",        "cost": 150, "cap": 0, "stat": "",  "makes": "",        "beds": 4, "col": Color("#E85D75")},
	"lab":     {"name": "Research Lab",   "cost": 220, "cap": 2, "stat": "I", "makes": "credits", "beds": 0, "col": Color("#9D7CFF")},
	"lounge":  {"name": "Lounge",         "cost": 180, "cap": 2, "stat": "C", "makes": "mood",    "beds": 0, "col": Color("#FF9A3D")},
}
const BUILDABLE := ["hall", "reactor", "farm", "water", "habitat", "lab", "lounge"]

const FIRST := ["Ada","Bo","Cleo","Dev","Eli","Fay","Gus","Hana","Ike","June","Kai","Lou","Mia","Ned","Ona","Pip","Quin","Rae","Sol","Tess","Uma","Vic","Wren","Yuri","Zed"]
const LAST := ["Otter","Reyes","Kim","Novak","Patel","Brook","Hale","Moss","Quill","Stone","Vance","Wilde","Orion","Vega"]

var t := 0.0
var day := 0
var credits := 400.0
var res := {"power": 60.0, "food": 60.0, "water": 60.0}
var mood_boost := 0.0
var modules := {}      # Vector3i -> module
var by_id := {}        # module id -> module
var people: Array = []
var log_lines: Array = []
var next_mod := 1
var next_person := 1
var arrive_in := 20.0
var fire_in := 160.0
var rng := RandomNumberGenerator.new()

func _init(seed_value: int = 7) -> void:
	rng.seed = seed_value

## A fresh station: the core with a starter ring of rooms around it and five residents.
static func create(seed_value: int = 7) -> StationSim:
	var s := StationSim.new(seed_value)
	s.add_module("core", Vector3i.ZERO, true)
	s.add_module("reactor", Vector3i(1, 0, 0), true)
	s.add_module("farm", Vector3i(-1, 0, 0), true)
	s.add_module("water", Vector3i(0, 0, 1), true)
	s.add_module("habitat", Vector3i(0, 1, 0), true)
	for i in 5:
		s.spawn()
	s.auto_assign()
	return s

# ---------- modules ----------

func can_build(kind: String, cell: Vector3i) -> String:
	if not TYPES.has(kind) or kind == "core":
		return "That can't be built."
	if modules.has(cell):
		return "Something is already there."
	if max(abs(cell.x), max(abs(cell.y), abs(cell.z))) > REACH:
		return "Too far from the core."
	var touches := false
	for d in DIRS:
		if modules.has(cell + d):
			touches = true
	if not touches:
		return "New modules must attach to the station."
	if credits < TYPES[kind]["cost"]:
		return "Not enough credits."
	return ""

func add_module(kind: String, cell: Vector3i, free := false) -> String:
	var why := "" if free else can_build(kind, cell)
	if why != "":
		return why
	if not free:
		credits -= TYPES[kind]["cost"]
	var m := {"id": next_mod, "k": kind, "cell": cell, "fire": 0.0, "out": 0.0}
	next_mod += 1
	modules[cell] = m
	by_id[m["id"]] = m
	if not free:
		note(TYPES[kind]["name"] + " attached.")
	return ""

## Every empty cell next to the station: where the next module could go.
func open_cells() -> Array:
	var seen := {}
	for c in modules:
		for d in DIRS:
			var n: Vector3i = c + d
			if not modules.has(n) and not seen.has(n) and max(abs(n.x), max(abs(n.y), abs(n.z))) <= REACH:
				seen[n] = true
	return seen.keys()

func beds() -> int:
	var b := 0
	for c in modules:
		b += TYPES[modules[c]["k"]]["beds"]
	return b

func workers(m: Dictionary) -> Array:
	return people.filter(func(p): return p["job"] == m["id"])

func residents_of(m: Dictionary) -> Array:
	return people.filter(func(p): return p["home"] == m["id"])

# ---------- residents ----------

func spawn() -> Dictionary:
	var st := {}
	for s in STATS:
		st[s] = rng.randi_range(1, 5)
	st[STATS[rng.randi() % STATS.size()]] += 3
	var p := {
		"id": next_person, "name": FIRST[rng.randi() % FIRST.size()] + " " + LAST[rng.randi() % LAST.size()], "st": st,
		"need": {"hunger": rng.randf() * 0.3, "thirst": rng.randf() * 0.3, "tired": rng.randf() * 0.3},
		"happy": 0.7, "hp": 1.0, "job": 0, "home": 0, "pos": Vector3.ZERO, "act": "idle", "goal": {}, "path": [],
		"wait": 0.0, "hurry": 0.9 + rng.randf() * 0.3, "suit": rng.randi() % 8, "slot": Vector3.ZERO, "face": Vector3.FORWARD,
	}
	next_person += 1
	people.append(p)
	note(p["name"] + " came aboard.")
	return p

func job_score(p: Dictionary, m: Dictionary) -> int:
	var s: String = TYPES[m["k"]]["stat"]
	return p["st"][s] if s != "" else 0

func assign(p: Dictionary, m) -> String:
	if m == null or TYPES[m["k"]]["stat"] == "":
		p["job"] = 0
		return ""
	if p["job"] != m["id"] and workers(m).size() >= TYPES[m["k"]]["cap"]:
		return TYPES[m["k"]]["name"] + " is full."
	p["job"] = m["id"]
	if p["act"] == "work":
		p["act"] = "idle"
	note("%s now works in the %s." % [p["name"], TYPES[m["k"]]["name"]])
	return ""

## Anyone without a job takes the open one where they are most useful; anyone without a bed gets one.
func auto_assign() -> void:
	for p in people:
		if p["job"] != 0 and by_id.has(p["job"]):
			continue
		var best = null
		var bs := -1.0
		for c in modules:
			var m: Dictionary = modules[c]
			var D: Dictionary = TYPES[m["k"]]
			if D["stat"] == "" or workers(m).size() >= D["cap"]:
				continue
			var short := 0.0
			if res.has(D["makes"]):
				short = (1.0 - res[D["makes"]] / 100.0) * 6.0
			var s := job_score(p, m) + short
			if s > bs:
				bs = s
				best = m
		if best != null:
			p["job"] = best["id"]
	for p in people:
		if p["home"] != 0 and by_id.has(p["home"]):
			continue
		for c in modules:
			var m: Dictionary = modules[c]
			if TYPES[m["k"]]["beds"] > residents_of(m).size():
				p["home"] = m["id"]
				break

# ---------- moving through the station: breadth-first over connected modules ----------

func cell_of(p: Dictionary) -> Vector3i:
	var v: Vector3 = p["pos"]
	return Vector3i(roundi(v.x), roundi(v.y), roundi(v.z))

func distances(from: Vector3i) -> Dictionary:
	var dist := {from: 0}
	var q := [from]
	while q.size() > 0:
		var c: Vector3i = q.pop_front()
		for d in DIRS:
			var n: Vector3i = c + d
			if modules.has(n) and not dist.has(n):
				dist[n] = dist[c] + 1
				q.append(n)
	return dist

func route(from: Vector3i, to: Vector3i) -> Array:
	var prev := {from: from}
	var q := [from]
	while q.size() > 0:
		var c: Vector3i = q.pop_front()
		if c == to:
			break
		for d in DIRS:
			var n: Vector3i = c + d
			if modules.has(n) and not prev.has(n):
				prev[n] = c
				q.append(n)
	if not prev.has(to):
		return []
	var path := []
	var c2 := to
	while c2 != from:
		path.push_front(Vector3(c2))
		c2 = prev[c2]
	return path

func go_to(p: Dictionary, m: Dictionary, act: String) -> bool:
	var here := cell_of(p)
	var path := route(here, m["cell"])
	if path.is_empty() and here != m["cell"]:
		return false
	# everyone gets their own spot in the room so they don't stand inside each other
	var n := people.filter(func(o): return o != p and o["goal"].get("mod", 0) == m["id"]).size()
	var a := float(n) * 2.4 + float(p["id"])
	var slot := Vector3(cos(a) * 0.28, 0.0, sin(a) * 0.28)
	if path.is_empty():
		path = [Vector3(m["cell"])]
	path[path.size() - 1] = Vector3(m["cell"]) + slot
	p["path"] = path
	p["goal"] = {"mod": m["id"], "act": act}
	p["act"] = "walk"
	return true

func step(p: Dictionary, dt: float) -> bool:
	if p["path"].is_empty():
		return true
	var q: Vector3 = p["path"][0]
	var sp: float = 0.45 * p["hurry"] * (1.6 if p["goal"].get("act", "") == "fire" else 1.0)
	var d: Vector3 = q - p["pos"]
	if d.length() <= sp * dt:
		p["pos"] = q
		p["path"].pop_front()
		return p["path"].is_empty()
	p["face"] = d.normalized()
	p["pos"] += d.normalized() * sp * dt
	return false

# ---------- deciding: the most urgent need first, then work by day, then free time ----------

func hour() -> float:
	return fmod(t, DAY) / DAY * 24.0

func is_night() -> bool:
	var h := hour()
	return h >= 22.0 or h < 6.0

func nearest(p: Dictionary, kind: String, pred := Callable()):
	var dist := distances(cell_of(p))
	var best = null
	var bd := 1 << 30
	for c in dist:
		var m: Dictionary = modules[c]
		if m["k"] != kind or (pred.is_valid() and not pred.call(m)):
			continue
		if dist[c] < bd:
			bd = dist[c]
			best = m
	return best

func decide(p: Dictionary) -> void:
	var dist := distances(cell_of(p))
	for c in dist:
		if modules[c]["fire"] > 0.0 and dist[c] <= 2:
			go_to(p, modules[c], "fire")
			return
	var n: Dictionary = p["need"]
	var hi: float = max(n["hunger"], max(n["thirst"], n["tired"]))
	if hi > 0.7 or (is_night() and n["tired"] > 0.35):
		if n["tired"] >= hi or is_night():
			var home = by_id.get(p["home"])
			if home == null:
				home = nearest(p, "habitat")
			if home == null:
				home = nearest(p, "core")
			if home != null and go_to(p, home, "sleep"):
				return
		if n["hunger"] >= n["thirst"] and res["food"] > 1.0:
			var f = nearest(p, "farm")
			if f != null and go_to(p, f, "eat"):
				return
		if res["water"] > 1.0:
			var w = nearest(p, "water")
			if w != null and go_to(p, w, "drink"):
				return
	var job = by_id.get(p["job"])
	if job != null and not is_night() and go_to(p, job, "work"):
		return
	var hang = nearest(p, "lounge")
	if hang == null or rng.randf() < 0.4:
		hang = by_id.get(p["home"], nearest(p, "core"))
	if hang != null:
		go_to(p, hang, "rest")

# ---------- one step of time ----------

func tick(dt: float) -> void:
	t += dt
	var d_now := int(t / DAY)
	if d_now != day:
		day = d_now
		note("Day %d begins." % (day + 1))
	var n := people.size()
	var lit: bool = res["power"] > 0.0
	var busy := 0
	for c in modules:
		if TYPES[modules[c]["k"]]["stat"] != "":
			busy += 1
		modules[c]["out"] = 0.0
	res["food"] = clampf(res["food"] - n * 0.003 * dt, 0, 100)
	res["water"] = clampf(res["water"] - n * 0.003 * dt, 0, 100)
	res["power"] = clampf(res["power"] - busy * 0.015 * dt, 0, 100)

	for p in people:
		var nd: Dictionary = p["need"]
		nd["hunger"] = clampf(nd["hunger"] + dt / 150.0, 0, 1)
		nd["thirst"] = clampf(nd["thirst"] + dt / 130.0, 0, 1)
		if p["act"] != "sleep":
			nd["tired"] = clampf(nd["tired"] + dt / (90.0 if is_night() else 200.0), 0, 1)
		match p["act"]:
			"walk":
				if step(p, dt):
					p["act"] = p["goal"].get("act", "idle")
					p["wait"] = 20.0 + rng.randf() * 20.0 if p["act"] == "work" else 6.0 + rng.randf() * 6.0
			"eat":
				var e: float = min(res["food"], dt * 2.0)
				res["food"] -= e
				nd["hunger"] = clampf(nd["hunger"] - e * 0.5, 0, 1)
				if nd["hunger"] < 0.05 or res["food"] <= 0.0:
					p["act"] = "idle"
			"drink":
				var w: float = min(res["water"], dt * 2.0)
				res["water"] -= w
				nd["thirst"] = clampf(nd["thirst"] - w * 0.5, 0, 1)
				if nd["thirst"] < 0.05 or res["water"] <= 0.0:
					p["act"] = "idle"
			"sleep":
				nd["tired"] = clampf(nd["tired"] - dt / 40.0, 0, 1)
				if nd["tired"] < 0.05 and not is_night():
					p["act"] = "idle"
			"work":
				var m = by_id.get(p["job"])
				if m == null or m["id"] != p["goal"].get("mod", 0) or is_night():
					p["act"] = "idle"
				else:
					m["out"] += job_score(p, m)
					p["wait"] -= dt
					if p["wait"] <= 0.0 or max(nd["hunger"], max(nd["thirst"], nd["tired"])) > 0.75:
						p["act"] = "idle"
			"fire":
				var fm = by_id.get(p["goal"].get("mod", 0))
				if fm == null or fm["fire"] <= 0.0:
					p["act"] = "idle"
				else:
					fm["fire"] = max(0.0, fm["fire"] - dt * (0.04 + p["st"]["S"] * 0.01))
			"rest":
				p["wait"] -= dt
				if p["wait"] <= 0.0:
					p["act"] = "idle"
		if p["act"] == "idle":
			decide(p)
		# happiness drifts toward how well the station treats them
		var want: float = 1.0 - (nd["hunger"] + nd["thirst"] + nd["tired"]) / 3.0 * 0.8 - (0.0 if p["job"] != 0 else 0.2) - (0.0 if lit else 0.2) + mood_boost
		var jm = by_id.get(p["job"])
		if jm != null and job_score(p, jm) >= 6:
			want += 0.1
		p["happy"] = clampf(p["happy"] + (want - p["happy"]) * dt * 0.02, 0, 1)
		if nd["hunger"] >= 1.0 or nd["thirst"] >= 1.0:
			p["hp"] = clampf(p["hp"] - dt * 0.004, 0, 1)
		else:
			p["hp"] = clampf(p["hp"] + dt * 0.002, 0, 1)

	# rooms turn their workers' stats into what they make: slower without power, faster when workers are happy
	var mood_out := 0.0
	for c in modules:
		var m: Dictionary = modules[c]
		var D: Dictionary = TYPES[m["k"]]
		if D["makes"] == "" or m["out"] <= 0.0:
			continue
		var ws := workers(m)
		var mood := 0.0
		for w in ws:
			mood += w["happy"]
		mood /= max(1, ws.size())
		var eff := (1.0 if lit or m["k"] == "reactor" else 0.2) * (0.0 if m["fire"] > 0.0 else 1.0)
		var g: float = m["out"] * 0.03 * eff * (0.6 + mood * 0.6) * dt
		match D["makes"]:
			"credits": credits += g * 1.5
			"mood": mood_out += m["out"]
			_: res[D["makes"]] = clampf(res[D["makes"]] + g, 0, 100)
	mood_boost = move_toward(mood_boost, min(0.2, mood_out * 0.01), dt * 0.01)
	credits += n * 0.02 * dt

	# now and then a working module catches fire; people nearby drop everything to put it out
	fire_in -= dt
	if fire_in <= 0.0:
		fire_in = 160.0 + rng.randf() * 160.0
		var cand := modules.values().filter(func(m): return TYPES[m["k"]]["stat"] != "")
		if cand.size() > 0:
			var fm: Dictionary = cand[rng.randi() % cand.size()]
			fm["fire"] = 1.0
			note("Fire in the %s!" % TYPES[fm["k"]]["name"])
	for c in modules:
		var m: Dictionary = modules[c]
		if m["fire"] > 0.0:
			m["fire"] = min(1.5, m["fire"] + dt * 0.01)
			for p in people:
				if cell_of(p) == c:
					p["hp"] = clampf(p["hp"] - dt * 0.01, 0, 1)

	# a shuttle brings someone new while there are free beds, spare supplies, and people are happy enough
	arrive_in -= dt
	if arrive_in <= 0.0:
		arrive_in = 45.0 + rng.randf() * 30.0
		if people.size() < beds() and avg_happy() > 0.45 and res["food"] > 30.0 and res["water"] > 30.0:
			spawn()
			auto_assign()

	# nobody dies aboard: at zero health they take the next shuttle home
	var keep: Array = []
	for p in people:
		if p["hp"] > 0.0:
			keep.append(p)
		else:
			note(p["name"] + " was too weak and took a shuttle home.")
	people = keep

func avg_happy() -> float:
	if people.is_empty():
		return 0.0
	var s := 0.0
	for p in people:
		s += p["happy"]
	return s / people.size()

func note(s: String) -> void:
	log_lines.push_front(s)
	if log_lines.size() > 30:
		log_lines.resize(30)

# ---------- saving ----------

func to_dict() -> Dictionary:
	var ms := []
	for c in modules:
		var m: Dictionary = modules[c]
		ms.append({"id": m["id"], "k": m["k"], "cell": [c.x, c.y, c.z], "fire": m["fire"]})
	var ps := []
	for p in people:
		var q: Dictionary = p.duplicate(true)
		q["pos"] = [p["pos"].x, p["pos"].y, p["pos"].z]
		q["path"] = []
		q["act"] = "idle"
		q["goal"] = {}
		q.erase("slot")
		q.erase("face")
		ps.append(q)
	return {"v": 1, "t": t, "day": day, "credits": credits, "res": res, "modules": ms, "people": ps, "next_mod": next_mod,
		"next_person": next_person, "log": log_lines, "seed": rng.seed, "state": rng.state}

static func from_dict(o: Dictionary) -> StationSim:
	var s := StationSim.new(int(o.get("seed", 7)))
	s.rng.state = int(o.get("state", 0))
	s.t = o["t"]
	s.day = int(o["day"])
	s.credits = o["credits"]
	s.res = o["res"]
	for m in o["modules"]:
		var c := Vector3i(int(m["cell"][0]), int(m["cell"][1]), int(m["cell"][2]))
		var mm := {"id": int(m["id"]), "k": m["k"], "cell": c, "fire": float(m["fire"]), "out": 0.0}
		s.modules[c] = mm
		s.by_id[mm["id"]] = mm
	for p in o["people"]:
		p["pos"] = Vector3(p["pos"][0], p["pos"][1], p["pos"][2])
		p["id"] = int(p["id"])
		p["job"] = int(p["job"])
		p["home"] = int(p["home"])
		p["suit"] = int(p["suit"])
		p["path"] = []
		p["goal"] = {}
		p["face"] = Vector3.FORWARD
		for k in p["st"]:
			p["st"][k] = int(p["st"][k])
		s.people.append(p)
	s.next_mod = int(o["next_mod"])
	s.next_person = int(o["next_person"])
	s.log_lines = o.get("log", [])
	return s
