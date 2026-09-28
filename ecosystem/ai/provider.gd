class_name AIProvider
extends RefCounted
## What every provider looks like. The demo templates and a real AI (Milestone 4)
## both follow this, so switching between them changes no other code.


## Short name shown in the app, e.g. "demo" or "ai:model-name".
func source_name() -> String:
	return "unknown"


## True when this provider never calls a paid service.
func is_demo() -> bool:
	return false


## Starts work. Must call job.finish(result) later, and should stop early if job.cancelled.
func start(_job: Job) -> void:
	push_error("AIProvider.start() must be implemented")
