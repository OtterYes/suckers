extends PanelContainer
## Right side panel: details of whatever is selected (a task or an agent).
## It's rebuilt only when what it shows actually changes, so typing in the
## deliverable editor is never interrupted.

var _body: VBoxContainer
var _shown_key := ""
var _editor: TextEdit
var _editor_deliverable := ""
var _change_note: LineEdit


func _ready() -> void:
	custom_minimum_size = Vector2(440, 0)
	var sb := StyleBoxFlat.new()
	sb.bg_color = UiUtil.PANEL
	sb.set_content_margin_all(14)
	add_theme_stylebox_override("panel", sb)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_body = UiUtil.vbox(10)
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.add_child(_body)
	add_child(scroll)
	App.selection_changed.connect(func(_k, _i): _refresh())
	App.ws.changed.connect(func(_k, _i): _refresh.call_deferred())
	_refresh()


func _key() -> String:
	var sel := App.selected
	var ws := App.ws
	match sel.kind:
		"task":
			var t := ws.get_task(sel.id)
			if t == null:
				return "none"
			return "task|%s|%s|%s|%d" % [t.id, t.status, t.deliverable_id, t.log.size()]
		"agent":
			var last := ""
			for a in ws.activity:
				if a.agent_id == sel.id:
					last = a.id
			return "agent|%s|%s|%s|%d" % [sel.id, ws.agent_state(sel.id), last, ws.memory.size()]
	return "none"


func _refresh() -> void:
	var key := _key()
	if key == _shown_key:
		return
	_shown_key = key
	_flush_edits()
	UiUtil.clear(_body)
	_editor = null
	match App.selected.kind:
		"task":
			if App.ws.get_task(App.selected.id):
				_show_task(App.ws.get_task(App.selected.id))
				return
		"agent":
			_show_agent(AgentDefs.find(App.selected.id))
			return
	_body.add_child(UiUtil.heading("Details"))
	_body.add_child(UiUtil.muted("Click a task or an agent to see it here.\n\nThe flow: type a goal → review the plan → approve → agents work → open results here to read, edit, and mark done.\n\nEverything saves automatically on this PC."))


## Keeps anything I typed but didn't save, before the editor is rebuilt.
func _flush_edits() -> void:
	if _editor != null and App.ws.deliverables.has(_editor_deliverable):
		if _editor.text != App.ws.deliverables[_editor_deliverable].body:
			App.save_deliverable(_editor_deliverable, _editor.text)


# --- Task ---------------------------------------------------------------------

func _show_task(t: Task) -> void:
	var ws := App.ws
	_body.add_child(UiUtil.heading(t.title))
	var badges := UiUtil.hbox(6)
	badges.add_child(UiUtil.badge(UiUtil.STATUS_TEXT[t.status], UiUtil.STATUS_COLOR[t.status]))
	badges.add_child(UiUtil.badge(AgentDefs.area_name(t.area), AgentDefs.AREAS[t.area].color))
	_body.add_child(badges)
	var deps: Array = t.depends_on.map(func(d): return ws.get_task(d).title if ws.get_task(d) else d)
	var info := "Owner: %s\nPriority: %s · Estimate: %s%s\nProject: %s" % [
		UiUtil.agent_name(t.owner), t.priority, UiUtil.duration(t.estimate_min),
		(" · Due: " + t.due) if t.due != "" else "",
		ws.projects.get(t.project_id, {}).get("name", "")]
	if not deps.is_empty():
		info += "\nUses results from: " + "; ".join(deps)
	_body.add_child(UiUtil.label(info, 14, UiUtil.MUTED))
	if t.goal != "":
		_body.add_child(UiUtil.label("Why: " + t.goal, 14))
	if t.blocker != "":
		_body.add_child(UiUtil.label("Problem: " + t.blocker, 14, UiUtil.STATUS_COLOR.failed))

	var actions := HFlowContainer.new()
	actions.add_theme_constant_override("h_separation", 6)
	actions.add_theme_constant_override("v_separation", 6)
	if t.status == Task.REVIEW:
		actions.add_child(UiUtil.button("Mark done", func():
			_flush_edits()
			App.mark_done(t.id)))
	if t.status in [Task.FAILED, Task.BLOCKED, Task.CANCELLED]:
		actions.add_child(UiUtil.button("Try again", func(): App.retry_task(t.id)))
	if t.status in [Task.QUEUED, Task.WORKING, Task.REVIEW, Task.BLOCKED, Task.FAILED]:
		actions.add_child(UiUtil.button("Cancel task", func(): App.cancel_task(t.id)))
	if actions.get_child_count() > 0:
		_body.add_child(actions)
	if t.status == Task.WORKING:
		var how := "Filling in a demo template. The short wait is simulated." if App.runner.provider_for(t.owner).is_demo() else "Waiting for the AI."
		_body.add_child(UiUtil.label("Working now. " + how, 14, UiUtil.STATUS_COLOR.working))

	var d: Deliverable = ws.deliverables.get(t.deliverable_id)
	if d != null:
		_body.add_child(HSeparator.new())
		_body.add_child(UiUtil.label("Deliverable", 16))
		var tags := HFlowContainer.new()
		tags.add_theme_constant_override("h_separation", 6)
		for l in d.labels():
			var warn := l.begins_with("Demo") or l.begins_with("Not tested")
			tags.add_child(UiUtil.badge(l, UiUtil.STATUS_COLOR.review if warn else UiUtil.STATUS_COLOR.done))
		_body.add_child(tags)
		_editor = TextEdit.new()
		_editor.text = d.body
		_editor_deliverable = d.id
		_editor.custom_minimum_size = Vector2(0, 420)
		_editor.size_flags_vertical = Control.SIZE_EXPAND_FILL
		_editor.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
		if d.kind == "luau":
			_editor.wrap_mode = TextEdit.LINE_WRAPPING_NONE  # code reads better unwrapped
			_editor.add_theme_font_override("font", UiUtil.mono_font())
			_editor.add_theme_font_size_override("font_size", 13)
		_body.add_child(_editor)
		var row := HFlowContainer.new()
		row.add_theme_constant_override("h_separation", 6)
		row.add_child(UiUtil.button("Save edits", func(): App.save_deliverable(d.id, _editor.text)))
		row.add_child(UiUtil.button("Copy", func(): DisplayServer.clipboard_set(_editor.text), "Copy the text to paste into Studio, Docs, or TikTok"))
		if d.kind == "luau":
			var tested := CheckBox.new()
			tested.text = "I ran this in Roblox Studio and it worked"
			tested.button_pressed = d.tested
			tested.toggled.connect(func(on): App.set_luau_tested(d.id, on))
			row.add_child(tested)
		_body.add_child(row)
		if t.status == Task.REVIEW:
			var change_row := UiUtil.hbox(6)
			_change_note = LineEdit.new()
			_change_note.placeholder_text = "What should change?"
			change_row.add_child(UiUtil.expand(_change_note))
			change_row.add_child(UiUtil.button("Ask for changes", func(): App.request_changes(t.id, _change_note.text)))
			_body.add_child(change_row)

	_body.add_child(HSeparator.new())
	_body.add_child(UiUtil.label("History", 15))
	for entry in t.log.slice(-6):
		_body.add_child(UiUtil.muted("%s  %s" % [str(entry.t).substr(11, 5), entry.msg]))


# --- Agent --------------------------------------------------------------------

func _show_agent(a: Dictionary) -> void:
	var ws := App.ws
	var state := ws.agent_state(a.id)
	_body.add_child(UiUtil.heading(a.name))
	var badges := UiUtil.hbox(6)
	badges.add_child(UiUtil.badge(UiUtil.AGENT_STATE_TEXT[state], UiUtil.AGENT_STATE_COLOR[state]))
	badges.add_child(UiUtil.badge(AgentDefs.area_name(a.area), AgentDefs.AREAS[a.area].color))
	var provider := App.runner.provider_for(a.id)
	badges.add_child(UiUtil.badge("DEMO templates" if provider.is_demo() else provider.source_name(), UiUtil.STATUS_COLOR.review))
	_body.add_child(badges)
	_body.add_child(UiUtil.label(a.role, 14))
	_body.add_child(UiUtil.label("Can do", 15))
	for c in a.capabilities:
		_body.add_child(UiUtil.muted("• " + c))
	_body.add_child(UiUtil.label("Tools and access", 15))
	for c in a.tools:
		_body.add_child(UiUtil.muted("• " + c))
	var lim := AgentDefs.limits(a.id)
	_body.add_child(UiUtil.muted("Limits: %ss per job · %d retry · $%.2f max per task" % [
		str(lim.max_runtime_sec), lim.max_retries, lim.max_cost_usd_per_task]))

	_body.add_child(HSeparator.new())
	var tasks: Array = ws.tasks_for_agent(a.id).filter(func(t): return not t.is_closed())
	_body.add_child(UiUtil.label("Open tasks (%d)" % tasks.size(), 15))
	for t in tasks:
		var b := UiUtil.button("%s  [%s]" % [t.title, UiUtil.STATUS_TEXT[t.status]], func(): App.select("task", t.id))
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_body.add_child(b)
	if a.id != "coordinator":
		_add_give_task_form(a)

	_body.add_child(HSeparator.new())
	_body.add_child(UiUtil.label("Recent activity", 15))
	var mine: Array = ws.activity.filter(func(e): return e.agent_id == a.id)
	if mine.is_empty():
		_body.add_child(UiUtil.muted("Nothing yet."))
	for e in mine.slice(-6):
		_body.add_child(UiUtil.muted("%s  %s" % [str(e.t).substr(11, 5), e.message]))

	_body.add_child(HSeparator.new())
	_body.add_child(UiUtil.label("Memory (you can delete any note)", 15))
	var notes: Array = ws.memory.filter(func(m): return m.agent_id == a.id)
	if notes.is_empty():
		_body.add_child(UiUtil.muted("No notes. Notes are kept per project, and agents only see notes for the project they're working on."))
	for m in notes:
		var row := UiUtil.hbox(6)
		var project_name: String = ws.projects.get(m.project_id, {}).get("name", "any project")
		row.add_child(UiUtil.expand(UiUtil.label("%s  (%s)" % [m.text, project_name], 13)))
		row.add_child(UiUtil.button("Delete", func(): App.delete_memory(m.id)))
		_body.add_child(row)


func _add_give_task_form(a: Dictionary) -> void:
	var box := UiUtil.panel(10, UiUtil.PANEL_LIGHT)
	var v := UiUtil.vbox(6)
	box.add_child(v)
	v.add_child(UiUtil.label("Give %s a task" % a.name, 14))
	var title := LineEdit.new()
	title.placeholder_text = "What should they do?"
	v.add_child(title)
	var row := UiUtil.hbox(6)
	var prio := OptionButton.new()
	for p in Task.PRIORITIES:
		prio.add_item(p.capitalize() + " priority")
	prio.select(1)
	row.add_child(prio)
	var due := LineEdit.new()
	due.placeholder_text = "Due YYYY-MM-DD"
	row.add_child(UiUtil.expand(due))
	v.add_child(row)
	var msg := UiUtil.label("", 13, UiUtil.STATUS_COLOR.failed)
	v.add_child(UiUtil.button("Assign", func():
		var r := App.assign_task(a.id, title.text, Task.PRIORITIES[prio.selected], due.text.strip_edges())
		msg.text = "" if r.ok else r.error))
	v.add_child(msg)
	_body.add_child(box)
