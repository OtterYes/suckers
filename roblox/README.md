# Grind to 1520 on Roblox

A Roblox version of the game, synced into Roblox Studio with Rojo.

- `src/shared`: `Config` (prices and payouts) and `Questions` (PSAT-style questions).
- `src/server`: grading, coins, saving, and the shared world (plaza, kiosks, player plots).
- `src/client`: the HUD, question panel, upgrade shop, and builder.

Play: answer questions (Q, or a Study Station in the plaza) to earn coins, buy upgrades (U),
and build your city on your plot (B). Buildings earn coins every second.

Sync: open this folder in VS Code with the Rojo extension, start the server, then press
Connect in Studio's Rojo plugin.
