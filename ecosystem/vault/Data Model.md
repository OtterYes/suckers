# Data Model

Everything lives in one **Workspace**, saved as JSON with a `schema_version`. Later versions can then upgrade old saves instead of breaking them.

## Task (the shared structure)
| Field | Example | Notes |
|---|---|---|
| `id` | `t_8f2a` | unique |
| `title` | "Draft Luau for checkpoints" | |
| `goal` | "Players respawn at the last checkpoint" | why it matters |
| `project_id` | `p_obby` | |
| `area` | `roblox` | `student`, `business`, `tiktok`, `roblox`, `hq` |
| `owner` | `roblox_builder` | agent id |
| `priority` | `high` | `high`, `medium`, `low` |
| `due` | `2026-10-05` | optional |
| `estimate_min` | `45` | used by [[Scheduling]] |
| `depends_on` | `[t_11c0]` | |
| `status` | `queued` | see below |
| `deliverable_id` | `d_3b9e` | once produced |
| `attempts` | `0` | counts retries |
| `blocker` | "" | a plain sentence saying why it's stuck |
| `log` | `[{t, msg}]` | what happened |
| `kind` | `roblox_luau` | which template or prompt to use |
| `plan_id`, `created_at`, `updated_at` | | |

**Statuses:** `proposed` → `queued` → `working` → `review` → `done`
Side exits: `blocked` (needs me or something missing), `failed` (out of retries), `cancelled`.

## Agent (fixed definitions in code, readable in the app)
`id`, `name`, `area`, `role`, `capabilities[]`, `tools[]`, `reads_areas[]`, `limits { max_runtime_sec, max_retries, max_delegations, max_cost_usd_per_task }`, `provider` (`mock` or `real`).
The **state** (`idle`, `queued`, `working`, `waiting_for_you`, `blocked`) is *calculated* from its tasks, never stored.

## The other records
- **Project:** `id`, `name`, `area`, `description`, `shares_with[]` (empty by default)
- **Plan:** `id`, `goal`, `project_id`, `status` (`proposed`, `approved`, `discarded`), `task_ids[]`, `notes` (what the coordinator assumed)
- **Deliverable:** `id`, `task_id`, `title`, `kind` (`doc`, `luau`, `checklist`, `script`), `body` (Markdown or code), `source` (`demo-template` or `ai:<model>`), `edited_by_me`, `tested` (always `false` for Luau until I say it ran in Studio), timestamps
- **Commitment:** a fixed time I'm busy (e.g. school Mon–Fri 08:00–15:00, sleep 22:30–07:00). It can repeat.
- **TimeBlock:** a scheduled work session: `task_id`, `start`, `end`, `pinned` (the scheduler won't move pinned blocks)
- **Memory note:** `id`, `agent_id`, `project_id`, `text`, `created_at`. I can view, edit, and delete these.
- **Activity:** `t`, `agent_id`, `task_id`, `kind`, `message`. The newest 500 are kept.
- **Usage:** calls, input and output tokens, estimated cost, per agent and per day
- **Approval:** `id`, `action` ("export to Studio folder", "spend", "delete project"…), `details`, `status` (`pending`, `approved`, `denied`)
- **Settings:** demo mode on/off, daily and monthly AI budget, working hours, UI scale

## Where it's saved
`%APPDATA%\Godot\app_userdata\Agent Ecosystem\workspace.json`, plus the 5 most recent backups in `backups/`. Saves are written to a temporary file first and then swapped in, so a crash can't leave a half-written file.
