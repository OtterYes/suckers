## Draws the station: see-through modules with their equipment, the residents inside, and the ghosts
## of modules you could build. It reads the sim every frame and never changes it.
class_name StationView
extends Node3D

const CELL := 4.0
const SUITS := [Color("#5C9DFF"), Color("#E85D75"), Color("#FFD166"), Color("#6BCB77"), Color("#9D7CFF"), Color("#FF9A3D"), Color("#2FDDB9"), Color("#E9EDF3")]
const SKIN := [Color("#F1C8A5"), Color("#C98E62"), Color("#8D5A3B"), Color("#F5D6B8")]

var sim: StationSim
var slice := 99                 # levels above this are hidden, so you can look inside a tall station
var selected := 0               # resident id
var selected_mod := 0           # module id
var hover_cell = null
var build_kind := ""

var _mods := {}                 # module id -> {node, sig, light, fire, fire_light, spin}
var _people := {}               # resident id -> {node, body, ring}
var _ghosts := Node3D.new()
var _mat_cache := {}
var _t := 0.0

func _ready() -> void:
	add_child(_ghosts)

static func cell_pos(c) -> Vector3:
	return Vector3(c) * CELL

# ---------- materials and shapes ----------

func mat(col: Color, glow := 0.0, alpha := 1.0) -> StandardMaterial3D:
	var key := "%s|%s|%s" % [col.to_html(), glow, alpha]
	if _mat_cache.has(key):
		return _mat_cache[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(col, alpha)
	m.roughness = 0.55
	m.metallic = 0.25
	if glow > 0.0:
		m.emission_enabled = true
		m.emission = col
		m.emission_energy_multiplier = glow
	if alpha < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
		m.metallic = 0.6
		m.roughness = 0.1
	_mat_cache[key] = m
	return m

func box(parent: Node3D, size: Vector3, pos: Vector3, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = m
	mi.position = pos
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi

func cyl(parent: Node3D, r: float, h: float, pos: Vector3, m: Material, segs := 16) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = h
	cm.radial_segments = segs
	mi.mesh = cm
	mi.material_override = m
	mi.position = pos
	parent.add_child(mi)
	return mi

func ball(parent: Node3D, r: float, pos: Vector3, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = r
	sm.height = r * 2.0
	sm.radial_segments = 16
	sm.rings = 8
	mi.mesh = sm
	mi.material_override = m
	mi.position = pos
	parent.add_child(mi)
	return mi

# ---------- modules ----------

func _neighbors_sig(c: Vector3i) -> String:
	var s := ""
	for d in StationSim.DIRS:
		s += "1" if sim.modules.has(c + d) else "0"
	return s

func _build_module(m: Dictionary) -> Dictionary:
	var c: Vector3i = m["cell"]
	var D: Dictionary = StationSim.TYPES[m["k"]]
	var col: Color = D["col"]
	var root := Node3D.new()
	root.position = cell_pos(c)
	add_child(root)
	var h := CELL / 2.0
	var hull := mat(Color("#AAB4C3"))
	var dark := mat(Color("#2A3140"))
	var glass := mat(Color("#8FD3FF"), 0.0, 0.10)
	var strip := mat(col, 2.5)

	# floor, with a hatch when there's a module below
	box(root, Vector3(CELL - 0.1, 0.2, CELL - 0.1), Vector3(0, -h + 0.1, 0), mat(Color("#4A5364")))
	if sim.modules.has(c + Vector3i(0, -1, 0)):
		cyl(root, 0.75, 0.05, Vector3(0, -h + 0.22, 0), dark, 20)
		cyl(root, 0.85, 0.03, Vector3(0, -h + 0.21, 0), strip, 20)
	if not sim.modules.has(c + Vector3i(0, 1, 0)):
		box(root, Vector3(CELL - 0.1, 0.05, CELL - 0.1), Vector3(0, h - 0.03, 0), glass)
	# the frame: twelve edges
	for a in [-1, 1]:
		for b in [-1, 1]:
			box(root, Vector3(0.14, CELL, 0.14), Vector3(a * (h - 0.07), 0, b * (h - 0.07)), hull)
			box(root, Vector3(CELL, 0.14, 0.14), Vector3(0, a * (h - 0.07), b * (h - 0.07)), hull)
			box(root, Vector3(0.14, 0.14, CELL), Vector3(a * (h - 0.07), b * (h - 0.07), 0), hull)
	# walls: glass where the station ends, a lit doorway where it continues
	for d in [Vector3i(1,0,0), Vector3i(-1,0,0), Vector3i(0,0,1), Vector3i(0,0,-1)]:
		var dv := Vector3(d)
		var across := Vector3(abs(dv.z), 0, abs(dv.x))
		var at := dv * (h - 0.05)
		if sim.modules.has(c + d):
			box(root, across * 1.6 + Vector3(0, 0.12, 0) + dv.abs() * 0.12, at + Vector3(0, 0.9, 0), strip)
		else:
			box(root, across * (CELL - 0.2) + Vector3(0, CELL - 0.2, 0) + dv.abs() * 0.04, at, glass)
			box(root, across * (CELL - 0.2) + Vector3(0, 0.7, 0) + dv.abs() * 0.08, at + Vector3(0, -h + 0.45, 0), dark)
	# a colored light strip around the floor says what the module is
	for s in [-1, 1]:
		box(root, Vector3(CELL - 0.4, 0.05, 0.08), Vector3(0, -h + 0.23, s * (h - 0.3)), strip)
		box(root, Vector3(0.08, 0.05, CELL - 0.4), Vector3(s * (h - 0.3), -h + 0.23, 0), strip)
	var light := OmniLight3D.new()
	light.light_color = col.lerp(Color.WHITE, 0.6)
	light.omni_range = CELL * 1.1
	light.light_energy = 1.4
	light.position = Vector3(0, h - 0.6, 0)
	root.add_child(light)

	var spin: Node3D = null
	var y0 := -h + 0.2
	match m["k"]:
		"core":
			cyl(root, 0.9, 0.5, Vector3(0, y0 + 0.25, 0), dark)
			spin = ball(root, 0.6, Vector3(0, y0 + 1.6, 0), mat(col, 3.0, 0.55))
			for i in 3:
				var a := TAU * i / 3.0
				box(root, Vector3(0.6, 0.5, 0.3), Vector3(cos(a) * 1.3, y0 + 0.5, sin(a) * 1.3), mat(Color("#394355")))
		"reactor":
			cyl(root, 0.55, 2.4, Vector3(0, y0 + 1.2, 0), mat(col, 1.6))
			spin = Node3D.new()
			spin.position = Vector3(0, y0 + 1.2, 0)
			root.add_child(spin)
			var tm := TorusMesh.new()
			tm.inner_radius = 0.85
			tm.outer_radius = 1.0
			var tr := MeshInstance3D.new()
			tr.mesh = tm
			tr.material_override = hull
			tr.rotation.x = PI / 2
			spin.add_child(tr)
		"farm":
			for i in 3:
				var z := -1.1 + i * 1.1
				box(root, Vector3(2.6, 0.4, 0.5), Vector3(0, y0 + 0.2, z), mat(Color("#6B4A2E")))
				for j in 5:
					ball(root, 0.2, Vector3(-1.0 + j * 0.5, y0 + 0.55, z), mat(Color("#4FB35E").lerp(Color("#A6E36B"), fmod(j * 0.37 + i * 0.21, 1.0))))
			box(root, Vector3(2.8, 0.06, 2.8), Vector3(0, h - 0.35, 0), mat(Color("#FF77E1"), 2.0))
		"water":
			for i in 3:
				cyl(root, 0.4, 2.0, Vector3(-1.1 + i * 1.1, y0 + 1.0, -0.9), mat(Color("#3E7CC4"), 0.0, 0.8))
				cyl(root, 0.3, 1.6, Vector3(-1.1 + i * 1.1, y0 + 0.9, -0.9), mat(col, 1.2, 0.6))
		"habitat":
			for i in 2:
				var x := -0.9 + i * 1.8
				box(root, Vector3(1.0, 0.35, 2.0), Vector3(x, y0 + 0.2, -0.6), mat(Color("#6E4A5A")))
				box(root, Vector3(0.9, 0.12, 0.45), Vector3(x, y0 + 0.43, -1.35), mat(Color("#EDE2D6")))
				box(root, Vector3(1.0, 0.35, 2.0), Vector3(x, y0 + 1.6, -0.6), mat(Color("#5A3D4A")))
		"lab":
			for i in 3:
				var a2 := -0.7 + i * 0.7
				box(root, Vector3(0.9, 0.8, 0.5), Vector3(sin(a2) * 1.3, y0 + 0.4, -cos(a2) * 1.3), mat(Color("#394355")))
				box(root, Vector3(0.8, 0.5, 0.05), Vector3(sin(a2) * 1.3, y0 + 1.1, -cos(a2) * 1.3 - 0.1), mat(col, 2.5))
			spin = box(root, Vector3(0.5, 0.5, 0.5), Vector3(0, y0 + 1.5, 0), mat(Color("#C8B6FF"), 2.0, 0.6))
		"lounge":
			box(root, Vector3(2.4, 0.4, 0.8), Vector3(0, y0 + 0.2, -1.1), mat(Color("#A0522D")))
			box(root, Vector3(2.4, 0.6, 0.25), Vector3(0, y0 + 0.5, -1.45), mat(Color("#A0522D")))
			cyl(root, 0.5, 0.45, Vector3(0, y0 + 0.22, 0.3), mat(Color("#394355")))
			ball(root, 0.12, Vector3(0.1, y0 + 0.55, 0.3), mat(col, 2.0))
		"hall":
			pass

	var fire := box(root, Vector3(CELL - 0.5, CELL - 0.5, CELL - 0.5), Vector3.ZERO, mat(Color("#FF6A1A"), 3.0, 0.3))
	fire.visible = false
	var fl := OmniLight3D.new()
	fl.light_color = Color("#FF5A1A")
	fl.omni_range = CELL * 1.4
	fl.visible = false
	root.add_child(fl)
	var sel := box(root, Vector3(CELL + 0.05, CELL + 0.05, CELL + 0.05), Vector3.ZERO, mat(Color("#FFC933"), 1.0, 0.07))
	sel.visible = false
	return {"node": root, "sig": _neighbors_sig(c), "light": light, "fire": fire, "fire_light": fl, "spin": spin, "sel": sel, "k": m["k"]}

func _sync_modules() -> void:
	var night := sim.is_night()
	var lit: bool = sim.res["power"] > 0.0
	for id in _mods.keys():
		var e: Dictionary = _mods[id]
		var m = sim.by_id.get(id)
		if m == null or e["sig"] != _neighbors_sig(m["cell"]):
			e["node"].queue_free()
			_mods.erase(id)
	for c in sim.modules:
		var m: Dictionary = sim.modules[c]
		if not _mods.has(m["id"]):
			_mods[m["id"]] = _build_module(m)
		var e: Dictionary = _mods[m["id"]]
		var on: bool = lit or m["k"] == "reactor" or m["k"] == "core"
		e["node"].visible = c.y <= slice
		e["light"].light_energy = (0.8 if night else 1.4) if on else 0.25
		e["light"].light_color = StationSim.TYPES[m["k"]]["col"].lerp(Color.WHITE, 0.6) if on else Color("#FF3030")
		var burning: bool = m["fire"] > 0.0
		e["fire"].visible = burning
		e["fire_light"].visible = burning
		if burning:
			var f := 0.5 + 0.5 * sin(_t * 17.0 + c.x) * sin(_t * 11.0 + c.z)
			e["fire"].scale = Vector3.ONE * (0.9 + f * 0.08)
			e["fire_light"].light_energy = 2.0 + f * 3.0
		if e["spin"] != null:
			e["spin"].rotation.y = _t * (1.5 if on else 0.2)
		e["sel"].visible = m["id"] == selected_mod

# ---------- residents ----------

func _build_person(p: Dictionary) -> Dictionary:
	var root := Node3D.new()
	root.scale = Vector3.ONE * 1.25
	add_child(root)
	var body := Node3D.new()
	root.add_child(body)
	var suit := mat(Color("#2F5DAA"))
	var cap := MeshInstance3D.new()
	var cm := CapsuleMesh.new()
	cm.radius = 0.2
	cm.height = 0.95
	cap.mesh = cm
	cap.material_override = suit
	cap.position.y = 0.5
	body.add_child(cap)
	box(body, Vector3(0.42, 0.1, 0.42), Vector3(0, 0.72, 0), mat(SUITS[p["suit"] % SUITS.size()], 0.6))
	ball(body, 0.17, Vector3(0, 1.15, 0), mat(SKIN[p["id"] % SKIN.size()]))
	box(body, Vector3(0.22, 0.07, 0.05), Vector3(0, 1.18, -0.15), mat(Color("#9FE7FF"), 1.5, 0.8))
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.35
	tm.outer_radius = 0.45
	ring.mesh = tm
	ring.material_override = mat(Color("#FFC933"), 3.0)
	ring.position.y = 0.03
	root.add_child(ring)
	return {"node": root, "body": body, "ring": ring}

func person_world(p: Dictionary) -> Vector3:
	return (p["pos"] as Vector3) * CELL + Vector3(0, -CELL / 2.0 + 0.22, 0)

func _sync_people() -> void:
	var seen := {}
	for p in sim.people:
		seen[p["id"]] = true
		if not _people.has(p["id"]):
			_people[p["id"]] = _build_person(p)
		var e: Dictionary = _people[p["id"]]
		var n: Node3D = e["node"]
		n.position = person_world(p)
		var act: String = p["act"]
		var walking := act == "walk" or act == "fire"
		var body: Node3D = e["body"]
		body.position.y = abs(sin(_t * 8.0 + p["id"])) * 0.08 if walking else (0.3 if act == "sleep" else 0.0)
		body.rotation.z = PI / 2 if act == "sleep" else 0.0
		var f: Vector3 = p["face"]
		if walking and Vector2(f.x, f.z).length() > 0.1:
			n.rotation.y = atan2(-f.x, -f.z)
		elif act == "work" or act == "eat" or act == "drink":
			n.rotation.y = 0.0
		if act == "work":
			body.position.y = abs(sin(_t * 5.0 + p["id"])) * 0.04
		n.visible = roundi(p["pos"].y) <= slice
		e["ring"].visible = p["id"] == selected
	for id in _people.keys():
		if not seen.has(id):
			_people[id]["node"].queue_free()
			_people.erase(id)

# ---------- build ghosts ----------

func _sync_ghosts() -> void:
	for g in _ghosts.get_children():
		g.queue_free()
	if build_kind == "":
		return
	var ok: bool = sim.credits >= StationSim.TYPES[build_kind]["cost"]
	for c in sim.open_cells():
		if c.y > slice:
			continue
		var hot = hover_cell != null and hover_cell == c
		box(_ghosts, Vector3.ONE * (CELL - 0.4), cell_pos(c), mat(Color("#FFC933") if ok else Color("#FF5C5C"), 1.5 if hot else 0.3, 0.35 if hot else 0.08))

var _ghost_sig := ""
func _process(dt: float) -> void:
	if sim == null:
		return
	_t += dt
	_sync_modules()
	_sync_people()
	var gs := "%s|%s|%d|%s|%d" % [build_kind, str(hover_cell), sim.modules.size(), slice, int(sim.credits >= StationSim.TYPES.get(build_kind, {"cost": 0})["cost"])]
	if gs != _ghost_sig:
		_ghost_sig = gs
		_sync_ghosts()

func reset() -> void:
	for id in _mods:
		_mods[id]["node"].queue_free()
	for id in _people:
		_people[id]["node"].queue_free()
	_mods.clear()
	_people.clear()
	_ghost_sig = ""
