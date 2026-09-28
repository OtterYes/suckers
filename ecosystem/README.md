# Agent Ecosystem

A desktop app for Windows: a small 3D world where a Coordinator and four specialist agents turn your goals into tasks and produce plans, scripts, and Luau code you can edit. The design lives in the Obsidian vault in [`vault/`](vault/Home.md).

**Status: Milestone 1 (demo loop).** Every agent runs in **demo mode**: it fills in prewritten templates. No AI is called and nothing costs money.

## Run it on your PC (about 5 minutes)
1. Download **Godot 4.7.2** (the standard version, not .NET) from <https://godotengine.org/download/windows/>. Unzip it anywhere. There's no installer.
2. Get this branch: `git pull`, then check out `claude/determined-brown-uqabil`.
3. Open `Godot_v4.7.2-stable_win64.exe` → **Import** → pick `ecosystem/project.godot` → **Import & Edit**.
   The first import takes a few seconds.
4. Press **F5** (or the ▶ button at the top right) to run the app.

Your data is saved automatically to `%APPDATA%\Godot\app_userdata\Agent Ecosystem\workspace.json`, with backups in the `backups` folder next to it.

## Try the full workflow
1. Type a goal on the left, e.g. *Prototype a Roblox obstacle game and plan three TikToks about building it.* Add a deadline if you like (`2026-10-05`). Press **Plan it**.
2. Read the Coordinator's plan. Uncheck anything you don't want, then press **Approve plan**.
3. Press **F2** to watch the world. Agents walk to the HQ board, work at their desks, and pass results to each other (the glowing ball). A yellow **!** means something is ready for you. Press **L** to see what every motion means.
4. Press **F1** for the dashboard. Open a task in **Today** or **Board**, read and edit the result on the right, then press **Mark done**.
5. Close the app and open it again. Everything is still there.

## What's real and what's simulated
| Part | Status |
|---|---|
| Plans, tasks, dependencies, queues, limits, cancel, retries | Real |
| Saving, backups, and recovering from a damaged save | Real |
| Agent states in the world and dashboard | Real (calculated from the tasks) |
| Motions in the world | Real events from the Activity log |
| What the agents write | **Demo templates**, labeled on every deliverable |
| The few seconds an agent spends "working" | **Simulated delay**, labeled in the legend |
| Luau code | **Not tested in Roblox Studio.** Tick the box only after you've run it. |
| AI usage meter | Real, and shows $0 (no AI yet) |

## Automated checks
Unit tests plus a two-run end-to-end check (do the whole workflow, close, reopen, and check the save).
- **Windows:** `set GODOT=C:\path\to\Godot_v4.7.2-stable_win64_console.exe` then `run_tests.bat`
- **Mac/Linux:** `GODOT=/path/to/godot ./run_tests.sh`

Use the `_console` exe on Windows so the results print in the terminal.

## Where things are
| Folder | What |
|---|---|
| `core/` | Data: tasks, deliverables, workspace, saving. No UI, no 3D. |
| `orchestration/` | Coordinator (plans with rules) and Runner (runs jobs with limits) |
| `ai/` | Provider interface, demo provider, demo templates. A real AI provider goes here in M4. |
| `ui/` | The 2D dashboard, built in code |
| `world/` | The 3D world |
| `assets/models/` | Put Astra `.glb` models here (see `vault/Astra Model Specs.md`) |
| `tests/`, `tools/` | Automated checks |
| `vault/` | The Obsidian design vault |
