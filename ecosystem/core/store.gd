class_name Store
extends RefCounted
## Saves and loads the Workspace as JSON on this PC.
## On Windows, "user://" is %APPDATA%\Godot\app_userdata\Agent Ecosystem\.
##
## Safety steps:
## - Write to a temporary file first, then swap it in, so a crash can't leave a
##   half-written save.
## - Keep up to 5 backups, at most one every 10 minutes.
## - If the save file is damaged, load the newest backup that works.

const FILE_NAME := "workspace.json"
const BACKUP_DIR := "backups"
const MAX_BACKUPS := 5
const BACKUP_EVERY_SEC := 600

var dir := "user://"
var last_error := ""     # plain-language reason when save or load goes wrong
var last_warning := ""   # e.g. "Loaded a backup because the save was damaged"


func _init(base_dir := "user://") -> void:
	dir = base_dir if base_dir.ends_with("/") else base_dir + "/"


func save_path() -> String:
	return dir + FILE_NAME


func save(ws: Workspace) -> bool:
	last_error = ""
	if DirAccess.make_dir_recursive_absolute(dir + BACKUP_DIR) != OK:
		last_error = "Couldn't create the save folder: " + dir
		return false
	var data := ws.to_dict()
	data.meta["saved_at"] = ws.now()
	var tmp_path := save_path() + ".tmp"
	var f := FileAccess.open(tmp_path, FileAccess.WRITE)
	if f == null:
		last_error = "Couldn't write the save file (%s)" % error_string(FileAccess.get_open_error())
		return false
	f.store_string(JSON.stringify(data, "\t"))
	f.close()
	if FileAccess.file_exists(save_path()):
		_maybe_backup()
		DirAccess.remove_absolute(save_path())
	var err := DirAccess.rename_absolute(tmp_path, save_path())
	if err != OK:
		last_error = "Couldn't finish saving (%s). Your data is in %s" % [error_string(err), tmp_path]
		return false
	return true


## Returns the saved Workspace, a new empty one if there is no save yet,
## or null if nothing could be read (see last_error).
func load_workspace() -> Workspace:
	last_error = ""
	last_warning = ""
	var candidates: Array = [save_path(), save_path() + ".tmp"]
	candidates.append_array(list_backups())  # newest first
	var any_file := false
	for path in candidates:
		if not FileAccess.file_exists(path):
			continue
		any_file = true
		var ws := _read(path)
		if ws != null:
			if path != save_path():
				last_warning = "The main save couldn't be read, so a backup was loaded: " + path.get_file()
			return ws
	if any_file:
		last_error = "None of the save files could be read. They were left untouched in " + dir
		return null
	return Workspace.new()


## Backup file paths, newest first.
func list_backups() -> Array:
	var out: Array = []
	var d := DirAccess.open(dir + BACKUP_DIR)
	if d == null:
		return out
	for f in d.get_files():
		if f.begins_with("workspace-") and f.ends_with(".json"):
			out.append(dir + BACKUP_DIR + "/" + f)
	out.sort()
	out.reverse()
	return out


func _read(path: String) -> Workspace:
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(path)) != OK:
		return null
	if typeof(json.data) != TYPE_DICTIONARY:
		return null
	return Workspace.from_dict(json.data)


func _maybe_backup() -> void:
	var backups := list_backups()
	var now_unix := int(Time.get_unix_time_from_system())
	if backups.size() > 0:
		var newest_time := FileAccess.get_modified_time(backups[0])
		if now_unix - newest_time < BACKUP_EVERY_SEC:
			return
	var stamp := Time.get_datetime_string_from_system().replace(":", "-")
	var target := dir + BACKUP_DIR + "/workspace-%s.json" % stamp
	DirAccess.copy_absolute(save_path(), target)
	backups = list_backups()
	for i in range(MAX_BACKUPS, backups.size()):
		DirAccess.remove_absolute(backups[i])
