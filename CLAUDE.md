# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step. Open `index.html` directly in a browser, or serve the directory with any static file server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

There are no tests, no linting, and no package manager. All JS is vanilla ES6+ loaded via `<script>` tags in `index.html`.

## Architecture

### Global namespace

`data.js` creates `window.G = {}` and is loaded first. Every module attaches its class or data to `G`. Script load order in `index.html` is the dependency order and must be preserved:

```
data.js → utils.js → sprites.js → planets.js → npc.js → input.js →
particles.js → ship.js → enemies.js → space.js → economy.js →
galaxy.js → ui.js → sound.js → main.js
```

### Module responsibilities

| File | Class/Data | Purpose |
|---|---|---|
| `data.js` | `G`, static tables | All game data: `G.FACTIONS`, `G.ITEMS`, `G.SHIPS`, `G.WEAPONS`, `G.MODULES`, `G.SYSTEMS`, `G.SHAPES`, `G.MISSION_TYPES`, `G.RECIPES` |
| `utils.js` | helpers | `G.lerp`, `G.clamp`, `G.wrapAngle`, `G.v2`, `G.randInt`, `G.seededRng`, `G.fmtCredits`, `G.generateLocalSystem`, `G.buildHyperspaceRoutes`, `G.genEnemyShips` |
| `sprites.js` | `G.Sprites` | Pixel-art ship sprites cached as offscreen canvases; `G.PlanetSprites` for planets |
| `input.js` | `G.Input` | Keyboard state via `KeyboardEvent.code`; `.is(code)` = held, `.pressed(code)` = just-down this frame, `.flush()` clears pressed state |
| `particles.js` | `G.Particles` | Particle system: `engine_trail`, `explosion`, `warp_effect`, `emit` |
| `ship.js` | `G.Ship` | Player and NPC ship physics, module slots, weapons, stat recomputation via `_recompute()` |
| `enemies.js` | `G.EnemyAI` | Enemy AI state machine: `patrol` → `engage` → `flee`; extends the same data shape as `G.Ship` |
| `npc.js` | `G.NPC` | Friendly/neutral NPC ships with docking, trade, and comms behaviors |
| `space.js` | `G.Space` | Current system scene: bodies, asteroids, derelicts, NPCs, enemies, projectiles, floating loot; `loadSystem(sysId)` rebuilds everything |
| `economy.js` | `G.Economy` | Market generation (seeded per system/time window), mission generation and completion checks, crafting |
| `galaxy.js` | `G.Galaxy` | Galaxy map canvas, BFS route planning, hyperspace route graph |
| `ui.js` | `G.UI` | All DOM overlays: HUD bars, spaceport tabs (trade/missions/outfitter/shipyard/crew/repair/craft), comms, minimap, messages |
| `sound.js` | `G.SoundEngine` | Web Audio API synth — all sound generated procedurally, no audio files |
| `main.js` | `G.Renderer`, `G.Game` | Renderer draws all canvas layers; `G.Game` is the top-level game object and runs the `requestAnimationFrame` loop |

### Game states

`G.game.state` drives both the update and render paths:

- `menu` — main menu shown, no update
- `space` — normal flight; `_updateSpace(dt)` runs
- `galaxy` — galaxy map overlay open; space still renders behind it
- `landing` / `launching` — fade+zoom transition animations
- `landed` — spaceport overlay visible; `[L]` to launch
- `dead` — game over overlay; space still renders

### Key cross-cutting patterns

**Ship stats** are stored as base values on the template (`G.SHIPS[id]`) then recomputed from installed modules by `ship._recompute()`. Always call `_recompute()` after installing or removing a module.

**Save/load** uses `localStorage` key `starfarer_save_v2`. `G.game.saveGame()` / `G.game.loadGame(data)`.

**Camera** lives on `G.game` (`camX`, `camY`, `camZoom`). World coordinates are centered; the renderer translates to `(CANVAS_W/2, CANVAS_H/2)` then offsets by `-(camX + CANVAS_W/2)`.

**Market and mission generation** is seeded (`G.seededRng`) so the same system produces the same stock at the same 5-minute time window — deterministic per session.

**Faction relations** are on `G.game.relations` (`{earth, rebellion, pirate, alien, contested, neutral}`, range −100–100). `getRel(faction)` / `setRel(faction, val)` are the accessors. Hostility between factions is in the static `G.HOSTILE` table in `data.js`.
