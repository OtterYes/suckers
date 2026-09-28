# Tech Stack

## Recommendation: Godot 4 (GDScript), desktop app for Windows
- **Godot 4.7.2**: the latest stable release (checked 2026-09-28). Free and open source, with no fees or royalties.
- **GDScript**: Godot's own language. It looks a lot like Python (indentation, `func`, `var`), so AP CSP experience carries over.
- **Renderer:** "Compatibility" (OpenGL) to start. Claude can render and screenshot it in the cloud, which lets it check its own work. My RTX 5060 can run the prettier "Forward+" renderer, and switching later is one setting ([[Decisions]] D3).
- **Saving:** plain JSON files in Godot's user folder on Windows: `%APPDATA%\Godot\app_userdata\Agent Ecosystem\`. Outside the repo, readable, and easy to back up.
- **AI (M4):** Godot's built-in `HTTPRequest` calls the AI provider directly. No server, no extra hosting cost.
- **Tests:** Godot can run without a window ("headless"). Claude runs logic tests that way on Linux, and they work the same on Windows.
- **Shipping:** Godot exports a Windows `.exe` using its free export templates.

## Options compared
| Option | Good | Bad | Verdict |
|---|---|---|---|
| **Godot 4** | Free, light, real 3D, Python-like language, UI and 3D in one tool, fast to open | Smaller community than Unity; fewer ready-made assets | **Pick** |
| Unity | Huge community and asset store, C# | Heavier install, more setup, license terms have changed before, C# is a new language | Good, but more friction |
| Unreal | Best-looking 3D | Very heavy, C++ or Blueprints, overkill for desks and dashboards | No |
| Python + Qt + a 3D library | Uses Python directly | 3D and UI don't fit together well; packaging an `.exe` is painful | No |
| Roblox experience | Matches Roblox skills | Private data and AI keys don't belong in a Roblox game; saving is limited | No (Roblox stays a *project*, not the platform) |

## Main tradeoffs
- **Everything runs locally.** That's private and free, but my data exists only on my PC, so the app keeps automatic backups.
- **The AI is called from the desktop app.** The key lives in a settings file on my PC (never in the repo). That's fine for a personal app. A shared app would need a server.
- **GDScript instead of C#** means an easier start and a faster edit loop, at the cost of slightly slower heavy math (which this app doesn't need).

See [[Architecture]].
