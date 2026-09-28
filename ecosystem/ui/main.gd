extends Control
## The app window: top bar, goal column, center (dashboard tabs or 3D world),
## and the side panel. F1 shows the dashboard, F2 the world.
## (Tab is left for moving between buttons with the keyboard.)

const GoalPanel := preload("res://ui/goal_panel.gd")
const AgentStrip := preload("res://ui/agent_strip.gd")
const BoardPanel := preload("res://ui/board_panel.gd")
const SidePanel := preload("res://ui/side_panel.gd")
const WorldView := preload("res://world/world_view.gd")

var _center_dashboard: Control
var _center_world: Control
var _view_buttons := {}
var _usage_label: Label
var _status_label: Label


func _ready() -> void:
	theme = UiUtil.make_theme(float(App.ws.settings.ui_scale))
	var bg := ColorRect.new()
	bg.color = UiUtil.BG
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 12)
	add_child(margin)
	var root := UiUtil.vbox(10)
	margin.add_child(root)
	root.add_child(_top_bar())

	var body := UiUtil.hbox(12)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(body)
	body.add_child(GoalPanel.new())
	var center := UiUtil.vbox(10)
	center.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_child(center)
	center.add_child(AgentStrip.new())
	_center_dashboard = BoardPanel.new()
	_center_dashboard.size_flags_vertical = Control.SIZE_EXPAND_FILL
	center.add_child(_center_dashboard)
	_center_world = _make_world_view()
	_center_world.size_flags_vertical = Control.SIZE_EXPAND_FILL
	center.add_child(_center_world)
	body.add_child(SidePanel.new())

	App.notice.connect(_on_notice)
	App.ws.changed.connect(func(kind, _id): if kind == "usage": _refresh_usage())
	_refresh_usage()
	show_view("dashboard")


func _top_bar() -> Control:
	var bar := UiUtil.panel(10)
	var h := UiUtil.hbox(12)
	bar.add_child(h)
	h.add_child(UiUtil.label("Agent Ecosystem", 20, UiUtil.TEXT, false))
	if App.ws.settings.demo_mode:
		var demo := UiUtil.badge("DEMO MODE: templates only, no AI calls, $0", UiUtil.STATUS_COLOR.review)
		demo.tooltip_text = "Agents fill in prewritten templates. Nothing is sent anywhere. Real AI arrives in Milestone 4, after you approve it."
		h.add_child(demo)
	_usage_label = UiUtil.label("", 13, UiUtil.MUTED, false)
	h.add_child(_usage_label)
	_status_label = UiUtil.label("", 13, UiUtil.MUTED, false)
	_status_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_status_label.clip_text = true
	_status_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	h.add_child(_status_label)
	for v in [["dashboard", "Dashboard (F1)"], ["world", "World (F2)"]]:
		var b := UiUtil.button(v[1], show_view.bind(v[0]))
		b.toggle_mode = true
		_view_buttons[v[0]] = b
		h.add_child(b)
	h.add_child(UiUtil.button("Save", func(): App.save_now(), "Saving also happens automatically a few seconds after any change."))
	return bar


func _make_world_view() -> Control:
	var view: Control = WorldView.new()
	view.open_board.connect(func():
		show_view("dashboard")
		_center_dashboard.current_tab = 1)
	return view


func show_view(view_name: String) -> void:
	_center_dashboard.visible = view_name == "dashboard"
	_center_world.visible = view_name == "world"
	for k in _view_buttons:
		_view_buttons[k].button_pressed = k == view_name


func _unhandled_key_input(event: InputEvent) -> void:
	if event.is_pressed() and not event.is_echo():
		if event.keycode == KEY_F1:
			show_view("dashboard")
		elif event.keycode == KEY_F2:
			show_view("world")


func _refresh_usage() -> void:
	var u := App.ws.usage
	_usage_label.text = "AI calls: %d · Today $%.2f · Month $%.2f of $%.0f" % [
		u.calls, App.ws.spent_today(), App.ws.spent_this_month(), App.ws.settings.monthly_budget_usd]


func _on_notice(text: String, is_error: bool) -> void:
	_status_label.text = text
	_status_label.tooltip_text = text
	_status_label.add_theme_color_override("font_color", UiUtil.STATUS_COLOR.failed if is_error else UiUtil.MUTED)
