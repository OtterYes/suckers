# Space City

A space station that grows in every direction, run by residents who live their own lives in it.
It's a Godot 4.3 game for the PC, separate from the PSAT web game in the rest of this repository.

## Playing

- **Windows:** unzip `SpaceCity-Windows.zip` and run `SpaceCity.exe`. Windows may warn about an
  unknown publisher the first time: choose More info, then Run anyway.
- **From source (any PC):** install [Godot 4.3](https://godotengine.org/download), open this folder
  as a project, and press Play (F5).

The game saves on its own every ten seconds and when you close it. **New station** starts over.

## How it works

- **Modules** snap onto a 3D grid around the Command Core: sideways, up, or down, up to 8 cells out.
  Pick one on the build bar, then click a glowing spot next to the station (hold Shift to keep building).
  Junctions just connect; every other module has a job.
- **Residents** each have a name and five stats (Strength, Perception, Agility, Charisma, Intellect).
  Anyone without a job takes the open one where they're most useful; click a resident, then click a
  module, to move them yourself.
- **They run their own lives.** Hunger, thirst, and tiredness rise all day. The most urgent need
  wins: they walk (and float through hatches between levels) to Hydroponics to eat, to a Water
  Recycler to drink, and to their bed to sleep. By day they work shifts; at night (22:00 to 06:00)
  they sleep. Free time is spent in a Lounge or at home.
- **Supplies:** Reactors make power (every working module uses it), Hydroponics makes food, Water
  Recyclers make water, Labs earn credits, and Lounges lift everyone's mood. Happy workers produce more.
- **Growth:** a shuttle brings a new resident while there are free beds, spare food and water, and
  the station is happy. Build Habitats for more beds.
- **Fires** break out now and then; residents within two modules drop what they're doing to put them out.

## Controls

Left- or right-drag turns the camera, Shift+right or middle drag pans, the wheel zooms. W A S D move,
Q and E go down and up. PgUp and PgDn hide upper levels so you can see inside. F follows the picked
resident. Space pauses; 1, 2, 3 set the speed. Esc cancels.

## For developers

```
godot --headless --path space-city --script res://tests/sim_test.gd            # sim checks (ten days)
godot --path space-city -- --demo --shot=shot.png                              # a bigger station, one screenshot
godot --headless --path space-city --export-release "Windows" build/windows/SpaceCity.exe
```

`scripts/sim.gd` is the whole simulation and draws nothing; `station_view.gd` draws it,
`main.gd` has space, the camera, and input, and `hud.gd` is the screen around it.
