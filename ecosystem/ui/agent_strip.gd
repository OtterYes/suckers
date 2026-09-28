extends HBoxContainer
## A row with one button per agent, showing its real state in words.

var _buttons := {}


func _ready() -> void:
	add_theme_constant_override("separation", 8)
	for a in AgentDefs.ALL:
		var b := Button.new()
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.clip_text = true  # never let long text widen the window
		b.custom_minimum_size = Vector2(90, 0)
		b.pressed.connect(func(): App.select("agent", a.id))
		_buttons[a.id] = b
		add_child(b)
	App.ws.changed.connect(func(kind, _id): if kind == "task": _refresh.call_deferred())
	_refresh()


func _refresh() -> void:
	for a in AgentDefs.ALL:
		var state := App.ws.agent_state(a.id)
		var b: Button = _buttons[a.id]
		b.text = "%s\n%s" % [a.name, UiUtil.AGENT_STATE_TEXT[state]]
		b.tooltip_text = "%s (%s). Click to see its tasks, limits, and memory." % [a.name, AgentDefs.area_name(a.area)]
		var sb := StyleBoxFlat.new()
		sb.bg_color = UiUtil.PANEL_LIGHT
		sb.set_corner_radius_all(6)
		sb.set_content_margin_all(8)
		sb.border_width_left = 5
		sb.border_color = UiUtil.AGENT_STATE_COLOR[state]
		b.add_theme_stylebox_override("normal", sb)
