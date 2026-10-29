# Paintball Verse

A first-person paintball shooter in the browser. Suit up as Vesper, drop into a best-of-five against bots, and stay inside the shrinking paint mist. Getting tagged eliminates you — no blood, just splatter. First team to wipe the other takes the round.

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
| Q | Shade Step |
| X | Blackout |
| Middle click | Ping a spot for your squad |
| T | Victory spray |
| Tab | Scoreboard |
| Esc | Pause |

Click the game to capture the mouse. Paintballs have travel time and a little drop. Body tags from the Rapid Marker land around 26–36 damage. Headshots hit twice as hard. The Sniper Pump removes a full health bar. The Splash Blaster throws an eight-ball spread.

## Lobby

The menu is a Fortnite-style lobby with four tabs:

- **Play** shows your character on the platform. Use the mode card to switch between Quick Match, Ranked, Custom Lobby, and the bonus arenas, then hit the yellow PLAY button. The empty party slots open the custom lobby code.
- **Locker** has slots for your marker, gun skin, gun buddy, player card, spray, and paint. Agents have no skins, so Vesper always looks the same and cosmetics live on your gun and your card. Drag the character to spin it.
- **Player card** is the banner behind your name. It shows in the lobby, on the scoreboard, on the post-match screen, and in Career. Click the nameplate to change it.
- **Item Shop** sells cosmetics for Paintball Caps.
- **Career** shows your level, rank ladder, record, and recent matches.

## Agent

Every player and bot is **Vesper**, a hooded shade:

- **Q · Shade Step** — teleport up to 14 m toward the crosshair. It stops short of walls.
- **X · Blackout** — throw a violet orb that drifts through walls. Every enemy it brushes is blinded for about three seconds.
- **Passive · Echo** — landing a tag refreshes Shade Step.

## Paintball Caps (PC)

You earn 1 PC for every 3 tags, in any mode. Partial progress carries over between matches. The in-match chip under the minimap shows caps earned and progress toward the next one.

The Item Shop's featured bundle is **Evori Dream Wings** (20 PC, or 32 PC bought separately). Items you already own are taken off the bundle price.

- Evori Dreamwing gun skin with wing fins (14 PC)
- Lumi the Star Cat gun buddy (6 PC)
- Evori Dream Wings player card (5 PC)
- Evori Flutter spray (3 PC)
- Aurora Dream paint (4 PC)

The Daily offers row sells three gun buddies for 4 PC each: Pip the Pink Bear, Clover the Bunny, and Nibble the Mouse. Splat Drop and Lil Hopper unlock with levels.

## Modes

**Quick match** is 5v5, best of five, storm on. Rookie bots rush and miss. Veterans take cover and Shade Step in. Champions flank, focus fire, and Blackout you.

**Custom lobby** builds a shareable code (`PV-...`) for the map, bot difficulty, team size, round length, storm, low gravity, and one-gun rounds. Enter a friend's code to play that same ruleset. The match runs locally: bots fill every other slot. There is no live network session.

**Ranked** is the same 5v5 best-of-five on a random standard map. SR climbs from Bronze through Silver, Gold, Platinum, and Diamond to Champion. Bot difficulty follows your rank. Leaving a ranked match counts as a loss.

## Progression

Matches pay XP. Levels open paint colors, gun skins, player cards, gun buddies, victory sprays, and two bonus arenas:

- **Zero-G Yard** (level 3) — low gravity, slow paint
- **Hopper Pit** (level 5) — everyone shares one marker

Speed gel, extra hoppers, and impact vests spawn on the maps. An impact vest soaks one tag.

## Look

Models use rounded geometry (rounded boxes, capsules, and lathed shapes) with smooth physically based shading rather than flat-shaded blocks.

## Maps

Warehouse, Canyon, City Block, Pine Forest, Skate Park, and Paint Stadium, plus the two bonus arenas above.
