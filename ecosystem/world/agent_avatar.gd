extends Node3D
## One agent in the 3D world. It *looks* like its state (from real tasks) and
## *moves* only when World3D tells it about a real event from the activity log.
## If an Astra model exists at assets/models/agent_<id>.glb, it's used instead
## of the simple shapes (vault/Astra Model Specs.md).

signal clicked(agent_id: String)

var agent_id := ""
var home := Vector3.ZERO      # where it stands at its desk
var state := "idle"
var demo := true

var _ring: MeshInstance3D
var _ring_mat: StandardMaterial3D
var _name_label: Label3D
var _state_label: Label3D
var _alert: Label3D
var _body_root: Node3D
var _busy_tween: Tween
var _time := 0.0


func setup(def: Dictionary, color: Color, home_pos: Vector3, face: Vector3) -> void:
	agent_id = def.id
	home = home_pos
	position = home_pos
	_body_root = Node3D.new()
	add_child(_body_root)
	var model_path := "res://assets/models/agent_%s.glb" % agent_id
	if ResourceLoader.exists(model_path):
		_body_root.add_child(load(model_path).instantiate())
	else:
		_build_placeholder(color)
	look_at_flat(face)

	# Click target.
	var body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.6
	capsule.height = 2.2
	shape.shape = capsule
	shape.position.y = 1.1
	body.add_child(shape)
	body.input_event.connect(_on_input_event)
	add_child(body)

	_ring = MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.32
	torus.outer_radius = 0.42
	_ring.mesh = torus
	_ring_mat = StandardMaterial3D.new()
	_ring_mat.emission_enabled = true
	_ring.material_override = _ring_mat
	_ring.position.y = 2.25
	add_child(_ring)

	_name_label = _label(def.name, 3.25, 64, Color.WHITE)
	_state_label = _label("", 2.75, 44, Color("e8e6e1"))
	_alert = _label("!", 4.1, 120, Color("f5c451"))
	# Names and states only show up close, so the overview stays readable.
	# The ring color and "!" still show state from far away.
	for l in [_name_label, _state_label]:
		l.visibility_range_end = 32.0
	_alert.visible = false


func _build_placeholder(color: Color) -> void:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.8
	var body := MeshInstance3D.new()
	var capsule := CapsuleMesh.new()
	capsule.radius = 0.38
	capsule.height = 1.3
	body.mesh = capsule
	body.material_override = mat
	body.position.y = 0.65
	_body_root.add_child(body)
	var head := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.32
	sphere.height = 0.64
	head.mesh = sphere
	var head_mat := StandardMaterial3D.new()
	head_mat.albedo_color = Color("f2ead8")
	head.material_override = head_mat
	head.position.y = 1.6
	_body_root.add_child(head)
	# A "visor" so you can tell which way it faces.
	var visor := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.42, 0.14, 0.1)
	visor.mesh = box
	var visor_mat := StandardMaterial3D.new()
	visor_mat.albedo_color = Color("1d2027")
	visor.material_override = visor_mat
	visor.position = Vector3(0, 1.64, 0.28)  # models face +Z, like Astra/glTF models
	_body_root.add_child(visor)


func _label(text: String, y: float, size: int, color: Color) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.position.y = y
	l.font_size = size
	l.pixel_size = 0.01
	l.outline_size = 10
	l.modulate = color
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	add_child(l)
	return l


## Shows a state. Called whenever tasks change; state comes from Workspace.agent_state().
func set_state(new_state: String, is_demo: bool) -> void:
	var entering := new_state != state
	state = new_state
	demo = is_demo
	var text: String = UiUtil.AGENT_STATE_TEXT.get(state, state)
	if state == "working" and demo:
		text += " (demo template)"
	_state_label.text = text + ("  · DEMO" if demo and state != "working" else "")
	var c: Color = UiUtil.AGENT_STATE_COLOR.get(state, Color.GRAY)
	_ring_mat.albedo_color = c
	_ring_mat.emission = c
	_ring_mat.emission_energy_multiplier = 1.4 if state in ["working", "blocked", "waiting_for_you"] else 0.2
	_alert.visible = state == "waiting_for_you"
	if entering and state == "blocked":
		shake()


func _process(delta: float) -> void:
	_time += delta
	# The ring stands up and spins ONLY while a job is really running.
	# Otherwise it lies flat like a halo.
	if state == "working":
		_ring.rotation.x = PI / 2
		_ring.rotation.y += delta * 4.0
		_body_root.position.y = absf(sin(_time * 6.0)) * 0.06
	else:
		_ring.rotation = Vector3.ZERO
		_body_root.position.y = 0.0
	if _alert.visible:
		_alert.position.y = 4.1 + sin(_time * 3.0) * 0.1


# --- Motions for real events -----------------------------------------------------

## Walk to a spot and back (e.g. to the HQ board when a plan is approved).
func visit(spot: Vector3) -> void:
	if _busy_tween and _busy_tween.is_running():
		return
	var start := home
	_busy_tween = create_tween()
	var there := spot + (start - spot).normalized() * 1.2
	_busy_tween.tween_callback(look_at_flat.bind(there))
	_busy_tween.tween_property(self, "position", there, start.distance_to(there) / 8.0)
	_busy_tween.tween_interval(0.4)
	_busy_tween.tween_callback(look_at_flat.bind(start))
	_busy_tween.tween_property(self, "position", start, start.distance_to(there) / 8.0)
	_busy_tween.tween_callback(look_at_flat.bind(start + (start - spot)))


func celebrate() -> void:
	var t := create_tween()
	t.tween_property(_body_root, "scale", Vector3(1.15, 0.85, 1.15), 0.1)
	t.tween_property(_body_root, "scale", Vector3.ONE, 0.15)
	t.tween_property(self, "position:y", 0.8, 0.18).set_ease(Tween.EASE_OUT)
	t.tween_property(self, "position:y", 0.0, 0.22).set_ease(Tween.EASE_IN)


func shake() -> void:
	var t := create_tween()
	for i in 4:
		t.tween_property(_body_root, "position:x", 0.12 if i % 2 == 0 else -0.12, 0.05)
	t.tween_property(_body_root, "position:x", 0.0, 0.05)


func look_at_flat(target: Vector3) -> void:
	var flat := Vector3(target.x, position.y, target.z)
	if flat.distance_to(position) > 0.01:
		look_at(flat, Vector3.UP, true)  # true: the model's front is +Z


func _on_input_event(_camera: Node, event: InputEvent, _pos: Vector3, _normal: Vector3, _shape: int) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		clicked.emit(agent_id)
