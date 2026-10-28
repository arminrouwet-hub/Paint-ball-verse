# Paintball Verse

A first-person paintball shooter in the browser. Pick an agent, drop into a best-of-five against bots, and stay inside the shrinking paint mist. Getting tagged eliminates you — no blood, just splatter. First team to wipe the other takes the round.

## Play

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:8734](http://127.0.0.1:8734).

```bash
npm run build
npm run preview
```

Progress, rank, and settings are stored in this browser (`localStorage`). No account and no server.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| Shift | Sprint |
| Space | Jump |
| Left click | Fire |
| Right click | Focus / 4× scope on the Sniper Pump |
| R | Reload (about 2–3 seconds) |
| Q | Signature ability |
| X | Ultimate |
| Middle click | Ping a spot for your squad |
| T | Victory spray |
| Tab | Scoreboard |
| Esc | Pause |

Click the game to capture the mouse. Paintballs have travel time and a little drop. Body tags from the Rapid Marker land around 26–36 damage. Headshots hit twice as hard. The Sniper Pump removes a full health bar. The Splash Blaster throws an eight-ball spread.

## Agents

- **Blitz** — Paint Dash, Trigger Storm (fire rate)
- **Guardian** — Splatter Shield, Fortify
- **Scout** — Recon Dart that sticks to walls and marks through cover, Full Scan
- **Splatter** — Paint Grenade, Paint Cannon
- **Medic** — Revive Pack. While a Medic is standing, a fatal tag drops that team into a short crawl instead of an instant burst. A second hit pops them.

## Modes

**Quick match** is 5v5, best of five, storm on. Rookie bots rush and miss. Veterans take cover. Champions flank, focus fire, and use their kits.

**Custom lobby** builds a shareable code (`PV-...`) for the map, bot difficulty, team size, round length, storm, low gravity, and one-gun rounds. Enter a friend's code to play that same ruleset. The match runs locally: bots fill every other slot. There is no live network session.

**Ranked** is the same 5v5 best-of-five on a random standard map. SR climbs from Bronze through Silver, Gold, Platinum, and Diamond to Champion. Bot difficulty follows your rank. Leaving a ranked match counts as a loss.

## Progression

Matches pay XP. Levels open paint colors, weapon wraps, outfits, victory sprays, and two bonus arenas:

- **Zero-G Yard** (level 3) — low gravity, slow paint
- **Hopper Pit** (level 5) — everyone shares one marker

Speed gel, extra hoppers, and impact vests spawn on the maps. An impact vest soaks one tag.

## Maps

Warehouse, Canyon, City Block, Pine Forest, Skate Park, and Paint Stadium, plus the two bonus arenas above.

# Paint-ball-verse
