## The game: space around the station, the camera, the mouse and keys, and saving.
extends Node3D

const SAVE := "user://station.json"

var sim: StationSim
var view: StationView
var hud: Hud
var cam: Camera3D
var speed := 1
var paused := false

# the camera orbits a target point
var target := Vector3(0, 0, 0)
var yaw := 0.7
var pitch := -0.45
var dist := 26.0
var follow := false
var _drag := ""
var _press_at := Vector2.ZERO
var _save_in := 10.0

func _ready() -> void:
	_space()
	sim = _load()
	view = StationView.new()
	view.sim = sim
	add_child(view)
	cam = Camera3D.new()
	cam.fov = 50
	cam.far = 3000
	add_child(cam)
	hud = Hud.new()
	hud.game = self
	add_child(hud)
	_args()

# ---------- for screenshots and checks: -- --demo grows a bigger station, -- --shot=path.png saves a frame and quits ----------

var _shot := ""
var _demo := false
var _shot_in := 0.0

func _args() -> void:
	for a in OS.get_cmdline_user_args():
		if a == "--demo":
			_demo = true
			sim = StationSim.create(11)
			sim.credits = 99999
			for c in [[Vector3i(2, 0, 0), "hall"], [Vector3i(3, 0, 0), "lab"], [Vector3i(2, 1, 0), "habitat"], [Vector3i(2, -1, 0), "hall"],
					[Vector3i(2, -2, 0), "reactor"], [Vector3i(0, -1, 0), "hall"], [Vector3i(0, -2, 0), "farm"], [Vector3i(-1, -1, 0), "water"],
					[Vector3i(0, 0, -1), "lounge"], [Vector3i(0, 0, -2), "hall"], [Vector3i(0, 1, -2), "habitat"], [Vector3i(-1, 0, -2), "lab"],
					[Vector3i(0, 2, 0), "habitat"], [Vector3i(-1, 1, 0), "hall"], [Vector3i(0, 0, 2), "farm"]]:
				sim.add_module(c[1], c[0])
			sim.credits = 900
			for i in 7:
				sim.spawn()
			sim.auto_assign()
			for i in 900:
				sim.tick(0.1)
			view.reset()
			view.sim = sim
			view.selected = sim.people[0]["id"]
			yaw = 0.75
			pitch = -0.38
			dist = 34.0
		elif a.begins_with("--shot="):
			_shot = a.substr(7)
			_shot_in = 2.5

func _load() -> StationSim:
	if FileAccess.file_exists(SAVE):
		var o = JSON.parse_string(FileAccess.get_file_as_string(SAVE))
		if o is Dictionary:
			return StationSim.from_dict(o)
	return StationSim.create(randi())

func save_now() -> void:
	if _demo:
		return
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(sim.to_dict()))

func new_station() -> void:
	sim = StationSim.create(randi())
	view.reset()
	view.sim = sim
	view.selected = 0
	view.selected_mod = 0
	target = Vector3.ZERO
	save_now()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		save_now()

# ---------- space: stars, a planet, and a sun ----------

func _space() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#02030A")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#7F9CFF")
	env.ambient_light_energy = 0.35
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.1
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var sun := DirectionalLight3D.new()
	sun.light_color = Color("#FFF1DC")
	sun.light_energy = 1.1
	sun.rotation = Vector3(-0.6, 0.8, 0)
	add_child(sun)

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var sm := SphereMesh.new()
	sm.radius = 1.0
	sm.height = 2.0
	sm.radial_segments = 4
	sm.rings = 2
	mm.mesh = sm
	mm.instance_count = 2000
	var r := RandomNumberGenerator.new()
	r.seed = 1520
	for i in mm.instance_count:
		var d := Vector3(r.randfn(), r.randfn(), r.randfn()).normalized()
		var s := r.randf_range(0.6, 2.2)
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ONE * s), d * r.randf_range(1400, 2200)))
		mm.set_instance_color(i, Color(1, 1, 1).lerp(Color("#9FC3FF") if r.randf() < 0.5 else Color("#FFD9A0"), r.randf() * 0.6))
	var stars := MultiMeshInstance3D.new()
	stars.multimesh = mm
	var smat := StandardMaterial3D.new()
	smat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	smat.vertex_color_use_as_albedo = true
	stars.material_override = smat
	add_child(stars)

	var planet := MeshInstance3D.new()
	var pm := SphereMesh.new()
	pm.radius = 260
	pm.height = 520
	pm.radial_segments = 64
	pm.rings = 32
	planet.mesh = pm
	var noise := FastNoiseLite.new()
	noise.frequency = 0.004
	noise.fractal_octaves = 5
	var tex := NoiseTexture2D.new()
	tex.width = 1024
	tex.height = 512
	tex.seamless = true
	tex.noise = noise
	var grad := Gradient.new()
	grad.set_color(0, Color("#0E3A7A"))
	grad.set_color(1, Color("#E9EDF3"))
	grad.add_point(0.45, Color("#1D5FAF"))
	grad.add_point(0.5, Color("#3C8C4A"))
	grad.add_point(0.62, Color("#8A7A4E"))
	tex.color_ramp = grad
	var pmat := StandardMaterial3D.new()
	pmat.albedo_texture = tex
	pmat.roughness = 0.9
	planet.material_override = pmat
	planet.position = Vector3(-420, -320, -700)
	add_child(planet)
	var halo := MeshInstance3D.new()
	var hm := SphereMesh.new()
	hm.radius = 272
	hm.height = 544
	halo.mesh = hm
	var hmat := StandardMaterial3D.new()
	hmat.albedo_color = Color(0.4, 0.7, 1.0, 0.12)
	hmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	hmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	halo.material_override = hmat
	halo.position = planet.position
	add_child(halo)

# ---------- the loop ----------

func _process(dt: float) -> void:
	dt = min(dt, 0.1)
	if not paused:
		for i in speed:
			sim.tick(dt)
	if _shot != "":
		_shot_in -= dt
		if _shot_in <= 0.0:
			get_viewport().get_texture().get_image().save_png(_shot)
			get_tree().quit()
			_shot = ""
		_update_cam()
		return
	_save_in -= dt
	if _save_in <= 0.0:
		_save_in = 10.0
		save_now()
	_keys(dt)
	_update_cam()

func _update_cam() -> void:
	var dt := get_process_delta_time()
	if follow and view.selected != 0:
		var p = _person(view.selected)
		if p != null:
			target = target.lerp(view.person_world(p) + Vector3(0, 1, 0), min(1.0, dt * 4.0))
		else:
			follow = false
	pitch = clamp(pitch, -1.45, 1.2)
	dist = clamp(dist, 6.0, 120.0)
	var off := Vector3(0, 0, dist).rotated(Vector3.RIGHT, pitch).rotated(Vector3.UP, yaw)
	cam.position = target + off
	cam.look_at(target)

func _keys(dt: float) -> void:
	if hud.typing():
		return
	var mv := Vector3.ZERO
	if Input.is_physical_key_pressed(KEY_W): mv.z -= 1
	if Input.is_physical_key_pressed(KEY_S): mv.z += 1
	if Input.is_physical_key_pressed(KEY_A): mv.x -= 1
	if Input.is_physical_key_pressed(KEY_D): mv.x += 1
	if Input.is_physical_key_pressed(KEY_E): mv.y += 1
	if Input.is_physical_key_pressed(KEY_Q): mv.y -= 1
	if mv != Vector3.ZERO:
		follow = false
		var fast := 2.5 if Input.is_physical_key_pressed(KEY_SHIFT) else 1.0
		target += Vector3(mv.x, 0, mv.z).rotated(Vector3.UP, yaw) * dt * dist * 0.8 * fast + Vector3(0, mv.y, 0) * dt * 12.0 * fast

func _person(id: int) -> Variant:
	for p in sim.people:
		if p["id"] == id:
			return p
	return null

# ---------- mouse ----------

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton:
		var mb := e as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			dist *= 0.9
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			dist *= 1.1
		elif mb.button_index in [MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE]:
			_drag = ("orbit" if mb.button_index == MOUSE_BUTTON_RIGHT and not mb.shift_pressed else "pan") if mb.pressed else ""
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_press_at = mb.position
				_drag = "orbit_l"
			else:
				if _drag == "orbit_l" and mb.position.distance_to(_press_at) < 6:
					_click(mb.position)
				_drag = ""
	elif e is InputEventMouseMotion:
		var mm := e as InputEventMouseMotion
		if _drag == "orbit" or (_drag == "orbit_l" and mm.position.distance_to(_press_at) >= 6):
			yaw -= mm.relative.x * 0.006
			pitch -= mm.relative.y * 0.006
		elif _drag == "pan":
			follow = false
			var right := cam.global_transform.basis.x
			var up := cam.global_transform.basis.y
			target += (-right * mm.relative.x + up * mm.relative.y) * dist * 0.0016
		if view.build_kind != "":
			var hit = _pick(mm.position, true)
			view.hover_cell = hit["cell"] if hit.get("kind", "") == "ghost" else null
	elif e is InputEventKey and e.pressed and not e.echo:
		match e.physical_keycode:
			KEY_ESCAPE:
				view.build_kind = ""
				view.selected = 0
				view.selected_mod = 0
				follow = false
			KEY_SPACE:
				paused = not paused
			KEY_1: speed = 1
			KEY_2: speed = 3
			KEY_3: speed = 10
			KEY_F:
				follow = view.selected != 0
			KEY_PAGEUP:
				view.slice = min(99, view.slice + 1) if view.slice < StationSim.REACH else 99
			KEY_PAGEDOWN:
				view.slice = max(-StationSim.REACH, min(view.slice, _top()) - 1)
			KEY_HOME:
				target = Vector3.ZERO
				follow = false
		hud.refresh()

func _top() -> int:
	var t := -StationSim.REACH
	for c in sim.modules:
		t = max(t, c.y)
	return t

## What's under the mouse: a resident, an empty build spot, or a module, whichever is nearest.
func _pick(at: Vector2, ghosts_only := false) -> Dictionary:
	var o := cam.project_ray_origin(at)
	var d := cam.project_ray_normal(at)
	var best := {}
	var bt := INF
	var h := StationView.CELL / 2.0
	if view.build_kind != "":
		for c in sim.open_cells():
			if c.y > view.slice:
				continue
			var t := _ray_box(o, d, StationView.cell_pos(c) - Vector3.ONE * (h - 0.2), StationView.cell_pos(c) + Vector3.ONE * (h - 0.2))
			if t < bt:
				bt = t
				best = {"kind": "ghost", "cell": c}
	if ghosts_only:
		# a module in front of the spot hides it
		for c in sim.modules:
			if c.y > view.slice:
				continue
			var t := _ray_box(o, d, StationView.cell_pos(c) - Vector3.ONE * h, StationView.cell_pos(c) + Vector3.ONE * h)
			if t < bt - 0.01:
				return {}
		return best
	for p in sim.people:
		if roundi(p["pos"].y) > view.slice:
			continue
		var cpos: Vector3 = view.person_world(p) + Vector3(0, 0.6, 0)
		var t := _ray_sphere(o, d, cpos, 0.55)
		if t < bt:
			bt = t
			best = {"kind": "person", "id": p["id"]}
	if best.get("kind", "") != "person":
		for c in sim.modules:
			if c.y > view.slice:
				continue
			var cp := StationView.cell_pos(c)
			# the far side of a see-through module is what you're pointing at, so use the exit point
			var t := _ray_box(o, d, cp - Vector3.ONE * h, cp + Vector3.ONE * h)
			if t < bt - 0.01:
				bt = t
				best = {"kind": "module", "id": sim.modules[c]["id"]}
	return best

func _ray_box(o: Vector3, d: Vector3, lo: Vector3, hi: Vector3) -> float:
	var tmin := -INF
	var tmax := INF
	for i in 3:
		if abs(d[i]) < 1e-6:
			if o[i] < lo[i] or o[i] > hi[i]:
				return INF
		else:
			var t1 := (lo[i] - o[i]) / d[i]
			var t2 := (hi[i] - o[i]) / d[i]
			tmin = max(tmin, min(t1, t2))
			tmax = min(tmax, max(t1, t2))
	if tmax < max(tmin, 0.0):
		return INF
	return max(tmin, 0.0)

func _ray_sphere(o: Vector3, d: Vector3, c: Vector3, r: float) -> float:
	var oc := o - c
	var b := oc.dot(d)
	var disc := b * b - (oc.dot(oc) - r * r)
	if disc < 0:
		return INF
	var t := -b - sqrt(disc)
	return t if t > 0 else INF

func _click(at: Vector2) -> void:
	var hit := _pick(at)
	var kind: String = hit.get("kind", "")
	if view.build_kind != "":
		if kind == "ghost":
			var why := sim.add_module(view.build_kind, hit["cell"])
			if why != "":
				hud.toast(why)
			else:
				hud.toast(StationSim.TYPES[view.build_kind]["name"] + " attached.")
				sim.auto_assign()
				if not Input.is_physical_key_pressed(KEY_SHIFT):
					view.build_kind = ""
		else:
			view.build_kind = ""
		view.hover_cell = null
	elif kind == "person":
		view.selected = hit["id"]
		view.selected_mod = 0
	elif kind == "module":
		var m: Dictionary = sim.by_id[hit["id"]]
		var p = _person(view.selected)
		if p != null and StationSim.TYPES[m["k"]]["stat"] != "":
			var why := sim.assign(p, m)
			var st: String = StationSim.TYPES[m["k"]]["stat"]
			hud.toast(why if why != "" else "%s works in the %s now (%s %d)." % [p["name"].split(" ")[0], StationSim.TYPES[m["k"]]["name"], StationSim.STAT_NAMES[st], p["st"][st]])
		else:
			view.selected = 0
			view.selected_mod = m["id"]
	else:
		view.selected = 0
		view.selected_mod = 0
	hud.refresh()
