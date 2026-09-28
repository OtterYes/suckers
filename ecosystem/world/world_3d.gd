extends Node3D
## The 3D world: a small floating island with HQ in the middle and four work
## areas around it. It never changes data. It shows agent states (worked out
## from real tasks) and plays motions for real events from the activity log.
## Everything is built from simple shapes. Astra models replace them when the
## files exist in assets/models/ (vault/Astra Model Specs.md).

signal agent_clicked(agent_id: String)
signal board_clicked

const AgentAvatar := preload("res://world/agent_avatar.gd")

const AREA_POS := {
	"hq": Vector3(0, 0, 0),
	"roblox": Vector3(0, 0, -13),
	"student": Vector3(13, 0, 0),
	"business": Vector3(0, 0, 13),
	"tiktok": Vector3(-13, 0, 0),
}
const FOCUS_ORDER := ["hq", "roblox", "student", "business", "tiktok"]
const BOARD_SPOT := Vector3(0, 0, -2.2)

var avatars := {}  # agent_id -> AgentAvatar
var camera: Camera3D
var _board_label: Label3D
var _today_label: Label3D
var _yaw := 0.6
var _pitch := 0.72
var _distance := 44.0
var _target := Vector3.ZERO
var _dragging := false
var _pending_refresh := false
## False while the dashboard is showing, so WASD doesn't move a hidden camera.
var active := true


func _ready() -> void:
	_build_environment()
	_build_island()
	for area in AREA_POS:
		_build_area(area)
	_build_hq_boards()
	for def in AgentDefs.ALL:
		_add_avatar(def)
	camera = Camera3D.new()
	camera.fov = 50
	add_child(camera)
	_update_camera()
	App.ws.changed.connect(_on_changed)
	_refresh_states()


# --- Reacting to real changes ---------------------------------------------------

func _on_changed(kind: String, id: String) -> void:
	if kind == "activity":
		var entry: Dictionary = App.ws.activity.back() if not App.ws.activity.is_empty() else {}
		if entry.get("id", "") == id:
			_play_event(entry)
	if not _pending_refresh:
		_pending_refresh = true
		_refresh_states.call_deferred()


func _refresh_states() -> void:
	_pending_refresh = false
	for id in avatars:
		avatars[id].set_state(App.ws.agent_state(id), App.runner.provider_for(id).is_demo())
	var counts := {"queued": 0, "working": 0, "needs": 0, "done": 0}
	for t in App.ws.tasks.values():
		match t.status:
			"queued":
				counts.queued += 1
			"working":
				counts.working += 1
			"review", "blocked", "failed":
				counts.needs += 1
			"done":
				counts.done += 1
	_board_label.text = "PROJECT BOARD\nQueued %d · Working %d\nNeeds you %d · Done %d\n(click to open)" % [
		counts.queued, counts.working, counts.needs, counts.done]
	var top: Array = App.runner._queue_in_order()
	_today_label.text = "TODAY\n" + (top[0].title.left(34) if not top.is_empty() else "Nothing queued")


## Each motion here is triggered by one real activity-log event (see the legend).
func _play_event(entry: Dictionary) -> void:
	var avatar = avatars.get(entry.get("agent_id", ""))
	match entry.kind:
		"assigned":
			if avatar and avatar.agent_id != "coordinator":
				avatar.visit(BOARD_SPOT)
		"handoff":
			var from = avatars.get(entry.get("from_agent", ""))
			if from and avatar:
				_fly_packet(from.home, avatar.home)
		"done":
			if avatar:
				avatar.celebrate()


func _fly_packet(from: Vector3, to: Vector3) -> void:
	var packet := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.35
	sphere.height = 0.7
	packet.mesh = sphere
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color("f5c451")
	mat.emission_enabled = true
	mat.emission = Color("f5c451")
	mat.emission_energy_multiplier = 2.0
	packet.material_override = mat
	add_child(packet)
	var a := from + Vector3.UP * 2.0
	var b := to + Vector3.UP * 2.0
	var arc := func(t: float):
		packet.position = a.lerp(b, t) + Vector3.UP * sin(t * PI) * 5.0
	var tween := create_tween()
	tween.tween_method(arc, 0.0, 1.0, 1.6).set_trans(Tween.TRANS_SINE)
	tween.tween_callback(packet.queue_free)


# --- Camera -------------------------------------------------------------------

func focus_area(area: String) -> void:
	var t := create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	t.tween_property(self, "_target", AREA_POS[area], 0.6)
	t.parallel().tween_property(self, "_distance", 44.0 if area == "hq" else 20.0, 0.6)


func _process(_delta: float) -> void:
	var pan := Vector3.ZERO
	if Input.is_physical_key_pressed(KEY_W): pan.z -= 1
	if Input.is_physical_key_pressed(KEY_S): pan.z += 1
	if Input.is_physical_key_pressed(KEY_A): pan.x -= 1
	if Input.is_physical_key_pressed(KEY_D): pan.x += 1
	if pan != Vector3.ZERO and active and get_tree().root.gui_get_focus_owner() == null:
		_target += pan.rotated(Vector3.UP, _yaw).normalized() * 0.4
	_update_camera()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		match event.button_index:
			MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE:
				_dragging = event.pressed
			MOUSE_BUTTON_WHEEL_UP:
				_distance = maxf(8.0, _distance * 0.9)
			MOUSE_BUTTON_WHEEL_DOWN:
				_distance = minf(60.0, _distance * 1.1)
	elif event is InputEventMouseMotion and _dragging:
		_yaw -= event.relative.x * 0.008
		_pitch = clampf(_pitch + event.relative.y * 0.006, 0.2, 1.35)


func _update_camera() -> void:
	if camera == null:
		return
	var offset := Vector3(sin(_yaw) * cos(_pitch), sin(_pitch), cos(_yaw) * cos(_pitch)) * _distance
	camera.position = _target + offset
	camera.look_at(_target + Vector3.UP, Vector3.UP)


# --- Building the world (simple shapes) ----------------------------------------

func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color("6fa8dc")
	sky_mat.sky_horizon_color = Color("d9e8f5")
	sky_mat.ground_horizon_color = Color("d9e8f5")
	sky_mat.ground_bottom_color = Color("9fb8cf")
	sky.sky_material = sky_mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("b8c7d9")
	env.ambient_light_energy = 0.35
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, 35, 0)
	sun.light_energy = 0.8
	sun.shadow_enabled = true
	add_child(sun)


func _build_island() -> void:
	_cylinder(22.0, 1.0, Color("7fb069"), Vector3(0, -0.5, 0))
	_cylinder(20.0, 5.0, Color("8a6b4f"), Vector3(0, -3.5, 0), 14.0)
	# Paths from HQ to each area.
	for area in ["roblox", "student", "business", "tiktok"]:
		var p: Vector3 = AREA_POS[area]
		var path := _box(Vector3(2.2, 0.06, 9.0), Color("d8cfb8"), p * 0.5 + Vector3.UP * 0.02)
		path.look_at(p + Vector3.UP * 0.02, Vector3.UP)


func _build_area(area: String) -> void:
	var p: Vector3 = AREA_POS[area]
	var color: Color = AgentDefs.AREAS[area].color
	var model_path := "res://assets/models/area_%s.glb" % ("hq" if area == "hq" else _area_file(area))
	if ResourceLoader.exists(model_path):
		var m: Node3D = load(model_path).instantiate()
		m.position = p
		add_child(m)
	else:
		_cylinder(5.2 if area == "hq" else 4.6, 0.3, color.lerp(Color.WHITE, 0.25), p + Vector3.UP * 0.15)
		if area != "hq":
			_build_workspace(area, p, color)
	var label := Label3D.new()
	label.text = AgentDefs.area_name(area)
	label.font_size = 72
	label.pixel_size = 0.012
	label.outline_size = 16
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.position = p + (Vector3.UP * 7.0 if area == "hq" else Vector3.UP * 5.2 + p.normalized() * 2.0)
	add_child(label)


func _area_file(area: String) -> String:
	return {"roblox": "roblox_lab", "student": "student_hub", "business": "business_studio",
		"tiktok": "tiktok_studio"}[area]


## A back wall, a desk with a screen, and one landmark per area.
func _build_workspace(area: String, p: Vector3, color: Color) -> void:
	var out := p.normalized()          # direction away from HQ
	var side := out.cross(Vector3.UP)  # sideways
	var wall := _box(Vector3(7.5, 3.2, 0.4), color, p + out * 3.4 + Vector3.UP * 1.9)
	wall.look_at(wall.position - out, Vector3.UP)
	var desk := _box(Vector3(2.4, 0.9, 1.1), Color("c9b79c"), p + out * 1.2 + Vector3.UP * 0.75)
	desk.look_at(desk.position - out, Vector3.UP)
	var screen := _box(Vector3(1.4, 0.8, 0.08), Color("1d2027"), p + out * 1.45 + Vector3.UP * 1.65)
	screen.look_at(screen.position - out, Vector3.UP)
	match area:
		"roblox":  # a tiny obby: steps of colored blocks
			for i in 5:
				_box(Vector3(0.9, 0.4 + i * 0.35, 0.9), [Color("ef6b6b"), Color("f5c451"), Color("6fcf8a"), Color("5fb3f9"), Color("b28dff")][i],
					p + side * (-3.0 + i * 0.0) + out * (-1.8 + i * 0.9) + Vector3.UP * (0.5 + i * 0.17))
		"student":  # a bookshelf
			var shelf := _box(Vector3(2.0, 2.4, 0.6), Color("8a6b4f"), p + side * 2.7 + out * 1.5 + Vector3.UP * 1.5)
			shelf.look_at(shelf.position - out, Vector3.UP)
			for i in 3:
				var books := _box(Vector3(1.7, 0.45, 0.5), [Color("4a90d9"), Color("ef6b6b"), Color("f5c451")][i],
					shelf.position + Vector3.UP * (-0.7 + i * 0.7) - out * 0.08)
				books.look_at(books.position - out, Vector3.UP)
		"business":  # a whiteboard
			var board := _box(Vector3(2.6, 1.6, 0.1), Color("f7f7f2"), p + side * -2.6 + out * 1.8 + Vector3.UP * 1.9)
			board.look_at(board.position - out, Vector3.UP)
		"tiktok":  # a ring light on a stand
			var stand := _box(Vector3(0.1, 1.8, 0.1), Color("3a3f4b"), p + side * 2.6 + out * 0.5 + Vector3.UP * 1.2)
			var ring := MeshInstance3D.new()
			var torus := TorusMesh.new()
			torus.inner_radius = 0.45
			torus.outer_radius = 0.6
			ring.mesh = torus
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color.WHITE
			mat.emission_enabled = true
			mat.emission = Color("ffe9f3")
			ring.material_override = mat
			ring.position = stand.position + Vector3.UP * 1.1
			ring.rotation.x = PI / 2
			add_child(ring)
			ring.look_at(ring.position - out, Vector3.UP)
			ring.rotate_object_local(Vector3.RIGHT, PI / 2)


func _build_hq_boards() -> void:
	var board := _box(Vector3(4.5, 2.8, 0.25), Color("3a3f4b"), BOARD_SPOT + Vector3(0, 1.9, -0.6))
	var click := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box_shape := BoxShape3D.new()
	box_shape.size = Vector3(4.5, 2.8, 0.6)
	shape.shape = box_shape
	click.add_child(shape)
	click.position = board.position
	click.input_event.connect(func(_c, event, _p, _n, _s):
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
			board_clicked.emit())
	add_child(click)
	_board_label = _board_text(BOARD_SPOT + Vector3(0, 1.9, -0.45))
	var today := _box(Vector3(3.2, 2.0, 0.25), Color("3a3f4b"), Vector3(3.8, 1.5, 1.0))
	today.rotation.y = 0.6  # turned toward the starting camera
	_today_label = _board_text(today.position + today.basis.z * 0.15)
	_today_label.rotation.y = 0.6
	_today_label.font_size = 36


func _board_text(pos: Vector3) -> Label3D:
	var l := Label3D.new()
	l.font_size = 44
	l.pixel_size = 0.01
	l.position = pos
	l.modulate = Color("f2ead8")
	add_child(l)
	return l


func _add_avatar(def: Dictionary) -> void:
	var area: String = def.area
	var p: Vector3 = AREA_POS[area]
	var home: Vector3
	var face: Vector3
	if area == "hq":
		home = BOARD_SPOT + Vector3(-2.8, 0.3, 0.8)
		face = Vector3(0, 0, 8)
	else:
		home = p + Vector3.UP * 0.3
		face = p + p.normalized() * 3.0  # facing the desk
	var avatar := AgentAvatar.new()
	add_child(avatar)
	avatar.setup(def, AgentDefs.AREAS[area].color, home, face)
	avatar.clicked.connect(func(id): agent_clicked.emit(id))
	avatars[def.id] = avatar


func _box(size: Vector3, color: Color, pos: Vector3) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	m.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.9
	m.material_override = mat
	m.position = pos
	add_child(m)
	return m


func _cylinder(radius: float, height: float, color: Color, pos: Vector3, bottom_radius := -1.0) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius if bottom_radius < 0 else bottom_radius
	mesh.height = height
	mesh.radial_segments = 48
	m.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 1.0
	m.material_override = mat
	m.position = pos
	add_child(m)
	return m
