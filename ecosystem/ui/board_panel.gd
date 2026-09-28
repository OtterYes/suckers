extends TabContainer
## Center tabs: Today, Board, and Activity.

const COLUMNS := [
	["Queued", ["queued", "proposed"]],
	["Working", ["working"]],
	["Needs you", ["review", "blocked", "failed"]],
	["Done", ["done", "cancelled"]],
]

var _today: VBoxContainer
var _board_columns: Array = []
var _project_filter: OptionButton
var _activity: RichTextLabel
var _pending := false


func _ready() -> void:
	_today = _scroll_tab("Today")
	var board := UiUtil.vbox()
	board.name = "Board"
	add_child(board)
	var filter_row := UiUtil.hbox()
	filter_row.add_child(UiUtil.label("Project:", 0, Color(0, 0, 0, 0), false))
	_project_filter = OptionButton.new()
	_project_filter.item_selected.connect(func(_i): _refresh())
	filter_row.add_child(UiUtil.expand(_project_filter))
	board.add_child(filter_row)
	var cols := UiUtil.hbox(10)
	cols.size_flags_vertical = Control.SIZE_EXPAND_FILL
	board.add_child(cols)
	for c in COLUMNS:
		var p := UiUtil.panel(8, UiUtil.PANEL)
		p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var scroll := ScrollContainer.new()
		scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		var v := UiUtil.vbox(6)
		v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		scroll.add_child(v)
		p.add_child(scroll)
		cols.add_child(p)
		_board_columns.append(v)
	_activity = RichTextLabel.new()
	_activity.name = "Activity"
	_activity.bbcode_enabled = true
	_activity.scroll_following = true
	add_child(_activity)
	App.ws.changed.connect(_on_changed)
	_refresh()


func _scroll_tab(title: String) -> VBoxContainer:
	var scroll := ScrollContainer.new()
	scroll.name = title
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var v := UiUtil.vbox(10)
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(v)
	add_child(scroll)
	return v


func _on_changed(_kind: String, _id: String) -> void:
	if not _pending:
		_pending = true
		_refresh.call_deferred()


func _refresh() -> void:
	_pending = false
	_refresh_today()
	_refresh_board()
	_refresh_activity()


func _task_card(t: Task) -> Button:
	var b := Button.new()
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var due := (" · due " + t.due) if t.due != "" else ""
	b.text = "%s\n%s · %s%s\n[%s]" % [t.title, UiUtil.agent_name(t.owner), t.priority, due, UiUtil.STATUS_TEXT[t.status]]
	var sb := StyleBoxFlat.new()
	sb.bg_color = UiUtil.PANEL_LIGHT
	sb.set_corner_radius_all(6)
	sb.set_content_margin_all(8)
	sb.border_width_left = 4
	sb.border_color = UiUtil.STATUS_COLOR[t.status]
	b.add_theme_stylebox_override("normal", sb)
	b.pressed.connect(func(): App.select("task", t.id))
	return b


func _refresh_today() -> void:
	UiUtil.clear(_today)
	var ws := App.ws
	_today.add_child(UiUtil.heading("Today · " + ws.today()))
	var needs: Array = ws.tasks.values().filter(func(t): return t.status in ["review", "blocked", "failed"])
	_today.add_child(UiUtil.label("Needs you (%d)" % needs.size(), 16, UiUtil.STATUS_COLOR.review))
	if needs.is_empty():
		_today.add_child(UiUtil.muted("Nothing is waiting for you."))
	for t in needs:
		_today.add_child(_task_card(t))
	var upcoming: Array = App.runner._queue_in_order()
	upcoming = ws.tasks.values().filter(func(t): return t.status == "working") + upcoming
	_today.add_child(UiUtil.label("Top priorities", 16))
	if upcoming.is_empty():
		_today.add_child(UiUtil.muted("No work queued. Give the Coordinator a goal on the left."))
	for t in upcoming.slice(0, 5):
		_today.add_child(_task_card(t))
	_today.add_child(UiUtil.muted("A full day-by-day schedule that fits around school arrives in Milestone 2."))


func _refresh_board() -> void:
	var ws := App.ws
	var keep: String = _project_filter.get_item_metadata(_project_filter.selected) if _project_filter.selected >= 0 else ""
	_project_filter.clear()
	_project_filter.add_item("All projects")
	_project_filter.set_item_metadata(0, "")
	var i := 1
	for p in ws.projects.values():
		_project_filter.add_item("%s (%s)" % [p.name, AgentDefs.area_name(p.area)])
		_project_filter.set_item_metadata(i, p.id)
		if p.id == keep:
			_project_filter.select(i)
		i += 1
	if _project_filter.selected < 0:
		_project_filter.select(0)
	var project: String = _project_filter.get_item_metadata(_project_filter.selected)
	for c in COLUMNS.size():
		var col: VBoxContainer = _board_columns[c]
		UiUtil.clear(col)
		var tasks: Array = ws.tasks.values().filter(func(t):
			return t.status in COLUMNS[c][1] and (project == "" or t.project_id == project))
		col.add_child(UiUtil.label("%s (%d)" % [COLUMNS[c][0], tasks.size()], 15))
		for t in tasks:
			col.add_child(_task_card(t))


func _refresh_activity() -> void:
	var lines: Array = []
	for a in App.ws.activity.slice(-150):
		var who := UiUtil.agent_name(a.agent_id)
		lines.append("[color=#a3a9b4]%s[/color]  [b]%s[/b]  %s" % [a.t.substr(11, 8), who, _escape(a.message)])
	if lines.is_empty():
		lines.append("[color=#a3a9b4]Nothing has happened yet. Every real event (plans, handoffs, results) shows up here, and the 3D world animates only these events.[/color]")
	_activity.text = "\n".join(lines)


func _escape(s: String) -> String:
	return s.replace("[", "[lb]")
