class_name AgentDefs
extends RefCounted
## The five agents: who they are, what they may do, and their limits.
## An agent's *state* is never stored here. Workspace.agent_state() works it
## out from real tasks, so the world can't show fake activity (Decisions D13).

const AREAS := {
	"hq": {"name": "HQ", "color": Color("f2ead8")},
	"roblox": {"name": "Roblox Lab", "color": Color("f28c38")},
	"student": {"name": "Student Hub", "color": Color("4a90d9")},
	"business": {"name": "Business Studio", "color": Color("4caf6a")},
	"tiktok": {"name": "TikTok Studio", "color": Color("e25f9b")},
}

const DEFAULT_LIMITS := {
	"max_runtime_sec": 60,       # a job that runs longer is stopped
	"max_retries": 1,            # one extra try after a failure
	"max_delegations": 1,        # may hand a result back once, never loop
	"max_cost_usd_per_task": 0.05,
}

const ALL := [
	{
		"id": "coordinator", "name": "Coordinator", "area": "hq",
		"role": "Turns goals into a small plan, fits it into the week, and keeps priorities straight.",
		"capabilities": ["Break a goal into 3-8 tasks", "Pick owners and dependencies",
			"Suggest estimates and priorities", "Build the Today list", "Flag conflicts"],
		"tools": ["read/write tasks and plans", "read task titles across all areas"],
		"reads_areas": ["hq", "roblox", "student", "business", "tiktok"],
	},
	{
		"id": "roblox_builder", "name": "Roblox Builder", "area": "roblox",
		"role": "Game designer and Luau coding partner who explains its choices.",
		"capabilities": ["Game concepts and core loops", "Prototype milestones",
			"Playtest plans", "Luau drafts (server/client labeled)",
			"Exploit, performance, and DataStore reviews", "Bug and feedback triage"],
		"tools": ["write deliverables", "read Roblox Lab projects"],
		"reads_areas": ["roblox"],
	},
	{
		"id": "tutor", "name": "Tutor", "area": "student",
		"role": "Study coach who helps me understand, not do the work for me.",
		"capabilities": ["Break assignments into steps", "Plan study sessions",
			"Practice questions", "Test-prep checklists"],
		"tools": ["write deliverables", "read Student Hub projects"],
		"reads_areas": ["student"],
	},
	{
		"id": "strategist", "name": "Strategist", "area": "business",
		"role": "Helps test business ideas cheaply. Marks every claim Verified or Assumption.",
		"capabilities": ["Idea cards", "Assumption lists", "Cheap validation experiments"],
		"tools": ["write deliverables", "read Business Studio projects"],
		"reads_areas": ["business"],
	},
	{
		"id": "producer", "name": "Producer", "area": "tiktok",
		"role": "Turns real progress into TikTok content. Never invents trends or analytics.",
		"capabilities": ["Series angles and pillars", "Hooks, scripts, shot lists, captions",
			"Posting calendars"],
		"tools": ["write deliverables", "read TikTok Studio projects"],
		"reads_areas": ["tiktok"],
	},
]


static func ids() -> Array:
	return ALL.map(func(a): return a.id)


## Returns the agent's definition, or an empty Dictionary if the id is unknown.
static func find(agent_id: String) -> Dictionary:
	for a in ALL:
		if a.id == agent_id:
			return a
	return {}


static func owner_for_area(area: String) -> String:
	for a in ALL:
		if a.area == area:
			return a.id
	return "coordinator"


static func limits(agent_id: String) -> Dictionary:
	var out := DEFAULT_LIMITS.duplicate()
	out.merge(find(agent_id).get("limits", {}), true)
	return out


static func area_name(area: String) -> String:
	return AREAS.get(area, {}).get("name", area)
