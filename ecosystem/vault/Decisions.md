# Decisions

A log of important choices. Each has the reason and what would make us change it. Newest at the bottom.

| # | Decision | Why | Revisit if |
|---|---|---|---|
| D1 | **Desktop app for my Windows PC only**, no browser or mobile | My choice; private, local, and it feels like a real app | I want to use it on my phone |
| D2 | **Godot 4.7 + GDScript** | Free, real 3D + UI, Python-like language ([[Tech Stack]]) | We hit a Godot limit we can't work around |
| D3 | **Compatibility renderer** for now | Runs anywhere, and Claude can screenshot it in the cloud to check its work | Art pass (M3+): switch to Forward+ for my RTX 5060 |
| D4 | **Local JSON saves** + 5 backups | Simple, readable, no server, $0 | Data gets large or I want sync between devices |
| D5 | **Demo mode first**, clearly labeled | Proves the workflow at $0 before paying for AI | — |
| D6 | **Rule-based coordinator** | Predictable, free, explainable. AI only where it clearly helps. | Templates keep missing what I need |
| D7 | **Scheduling + Roblox Lab first** | My priority | — |
| D8 | **Balance, leaning living simulation**; dashboard one key away | My choice; the world must never slow routine work | — |
| D9 | New app lives in `ecosystem/`, separate from the To 1520 game | Keeps both projects safe | I want its own repo (easy to move) |
| D10 | **This Obsidian vault is the design source of truth** | I can read and edit it, and Claude reads it every session | — |
| D11 | **One real AI provider at M4**, $20/month hard cap | Keeps cost low. Provider chosen at M4 with me. | — |
| D12 | A dependent task may start once the earlier task's deliverable is **ready for review** (not only done) | Keeps work flowing. If I edit the earlier deliverable, I can re-run the later task. | It causes confusing results |
| D13 | Agent state is **calculated from tasks**, never stored | The world can't show fake activity | — |
| D14 | UI built mostly in code, not the visual editor | Easier for Claude to write, review, and test. I can still inspect it in the editor. | I want to design screens visually |
