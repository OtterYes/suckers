# World Design

## Visual style: a "cozy low-poly diorama"
A small floating island seen from a friendly three-quarter camera. Simple shapes, soft lighting, one color per area, and big readable labels. It's cheap to build and easy to swap for [[Astra Model Specs]] models later. It looks intentional instead of unfinished.

| Area | Color | Landmark | Agent |
|---|---|---|---|
| HQ (center) | warm white | the Project Board and the Today board | [[Coordinator]] |
| Roblox Lab | orange | a workbench with a mini obby | [[Roblox Builder]] |
| Student Hub | blue | a library desk | [[Tutor]] |
| Business Studio | green | a whiteboard | [[Strategist]] |
| TikTok Studio | pink | a ring light and camera | [[Producer]] |

## Getting around
- **Keys 1–5** fly the camera to HQ and the four areas. Mouse drag orbits, the wheel zooms, and WASD moves.
- **Click an agent** to open its panel: role, tools, limits, task queue, recent activity, and memory.
- **Click a board** in HQ to open the project board or Today view in the side panel.
- **F1 / F2** swap between the 2D [[Dashboard]] and the 3D world ([[Decisions]] D17). The side panel stays open in both.
- Assigning a task: from an agent's panel, **"Give a task"** opens a small form (title, goal, priority, due).

## Motion always means something real
| What I see | The real event behind it |
|---|---|
| Agent walks to the HQ board, then back to its desk | A plan was approved and it picked up a task |
| Agent at its desk with a spinning ring and a busy screen | One of its tasks is `working` (a job is actually running) |
| Floating **!** above the agent, which faces the camera | A deliverable is in `review` and waiting for me |
| Red light and a short shake | A task is `blocked` or `failed`. Click it to read the blocker. |
| A glowing packet flies between areas | A deliverable is being passed to a dependent task (e.g. the game concept goes to the TikTok scripts) |
| Small cheer, and the board gets a check mark | I marked a task `done` |
| Agent idles at its desk | It has nothing queued |

**Honesty labels:**
- In demo mode, each agent wears a **DEMO** tag, and the working ring reads *"template (demo)"*. The short "working" time is a **simulated delay**, and the legend says so.
- Anything purely decorative (drifting clouds, a swaying plant) is listed under "Decoration" in the in-world legend (press **L**, or the "What do the motions mean?" button). M1 has no decoration.
- From far away, names hide so the overview stays readable. Ring colors and the **!** still show each agent's state.
- Agents never look busy when no job is running.

## Keeping it fast
- The dashboard is the fastest route for routine tasks. The world never blocks them.
- A target of 60 fps on basic hardware in the Compatibility renderer. The RTX 5060 leaves lots of room.
