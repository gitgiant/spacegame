# Product Requirements Document — *Starfarer* (working title)

**Genre:** 2D top-down space exploration / combat / trading sandbox
**Platform:** Browser (vanilla ES6+, no build step; `<script>` tags in `index.html`)
**Status date:** 2026-06-06

---

## 1. Purpose & Scope

This PRD consolidates an unstructured design brain-dump (`buglist.md` and inline
notes) into an organized, **deduplicated** specification. The raw notes contained
many repeats — character creation, letter-by-letter comms, the "don't destroy
ships on hyperjump" bug, and the port/traffic-control welcome messages each
appeared multiple times. Each requirement below is stated **once**.

Every item is tagged with its current implementation status, derived from a code
survey:

- ✅ **Done** — implemented and working
- 🟡 **Partial** — foundation exists, incomplete
- ⬜ **Planned** — not found in code

Priority tags: **P0** (core / next up), **P1** (important), **P2** (nice-to-have),
**P3** (speculative / experimental).

---

## 2. Current State Summary

The game already has: a global-namespace module architecture (`window.G`), seeded
market & mission generation, a galaxy map with BFS routing, modular ships with
installable modules and crew slots, ~10 weapon types with missile lock-on,
hyperspace travel, derelict looting/commandeering, an adaptive procedural sound
engine, faction relations, and localStorage save/load. Faction avatars
(male/female per faction) and ship-image assets exist on disk.

The biggest **missing pillars** are: the character-creation flow, the
abilities/spells system, the comms TTS/animalese presentation, fleet tactical
orders, dynamic events, the planet-conquest/player-faction metagame, the
on-foot/landing "character mode", and any mobile/controller input.

---

## 3. Requirements (Core)

### 3.1 Character & Identity

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| CH-1 | **New-game character creation flow**: choose name, sex, and avatar. Generate 1 male + 1 female avatar per faction; clothing tinted to the faction color. | P0 | 🟡 avatars + player fields exist; no creation wizard |
| CH-2 | At creation, player picks a **starting class** and a **starting ability/spell**. | P0 | ⬜ |
| CH-3 | At creation, player picks a **voice** (voice picker); the player's own avatar can talk. | P1 | ⬜ |
| CH-4 | **Every ship has an internal captain character** with avatar, name, sex, and faction. | P0 | 🟡 NPCs have named captains; no avatar binding |
| CH-5 | Each ship has a **unique ship name + captain name**; the ship reflects the captain's personality. | P1 | 🟡 names exist |
| CH-6 | **Captain personality types** drive dialog tone: timid, aggressive, crazy, aloof, friendly; speech styles include cussing, nice, salty, tired, angry, authoritarian, rebel. | P1 | ⬜ |
| CH-7 | **Classes**: hacker, tech priest, space marine, monk, medic, sniper, tank, berserker, knight. | P1 | ⬜ |

### 3.2 Comms & Text-to-Speech

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| CM-1 | Comms messages reveal **letter-by-letter**; each letter plays an Animal-Crossing-style **"animalese"** sound for a simple TTS effect. | P0 | ⬜ |
| CM-2 | **Male voices deeper than female.** Optional **robot TTS alongside animalese.** | P1 | ⬜ |
| CM-3 | The captain's **avatar appears next to the message**. | P0 | ⬜ |
| CM-4 | After fully typed, the message **holds a few seconds then fades**. | P1 | ⬜ |
| CM-5 | **Voice on/off (and style) option** in the options menu. | P1 | ⬜ |
| CM-6 | When the player **opens comms to a ship**, draw that ship's avatar and have it speak its responses. | P0 | 🟡 comms overlay exists, no avatar/voice |
| CM-7 | While the comms menu is open, the player can **still steer with WASD / arrow keys**. | P1 | ⬜ |
| CM-8 | TTS substitutes **`$PLAYER_NAME`** or the ship name into lines. | P1 | ⬜ |
| CM-9 | TTS uses the **NATO phonetic alphabet and aviation lingo** where appropriate. | P2 | ⬜ |
| CM-10 | **Cross-ship banter**: nervous "hello" when flying close, "nice to meet you `$player_name`" if friendly, a bark if unfriendly; driven by captain personality. | P1 | ⬜ |
| CM-11 | **Small chance NPCs chatter their intentions.** | P2 | ⬜ |
| CM-12 | **Far-off / jammed comms are distorted / breaking up.** | P2 | ⬜ |
| CM-13 | On landing, a **comms welcome from space traffic control**. | P1 | ⬜ |
| CM-14 | Each port shop menu shows a **one-time comms welcome from the shop owner** (shown only once). | P2 | ⬜ |

### 3.3 Fleets & Squad Command

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FL-1 | **Shared fleet cargo space**; all cargo indicators show fleet-wide totals. | P0 | ✅ |
| FL-2 | Disabled/destroyed fleet ships **drop their cargo** like NPC ships. | P1 | 🟡 NPC drops exist; verify for fleet |
| FL-3 | When a **capital ship flees/hyperjumps**, its escorts either **stay and defend** or **flee/jump** too. | P1 | ⬜ |
| FL-4 | **Release a ship from the fleet** → it becomes an independent faction ship and flies away. | P1 | 🟡 "Release from Fleet" button exists |
| FL-5 | **Escort orders via comms**: hold position, loiter, attack, defend, lock in formation. | P0 | 🟡 "release" only |
| FL-6 | **Friendly fire** to fleet ships allowed at **50% damage**; the ship messages the player when attacked. | P1 | ⬜ |
| FL-7 | When disabled, a comms option to **beg for help**; friendly/allied ships always respond. | P2 | ⬜ |
| FL-8 | NPC fleets **fly in formation and use tactics**. | P1 | ⬜ |
| FL-9 | **Fleet command / RTS view**: order ships around on the hex map. | P2 | ⬜ |
| FL-10 | **Autopilot** also fires weapons, controls throttle, and uses abilities. | P2 | ⬜ |
| FL-11 | Fleet commanders can **negotiate surrender** over comms. | P3 | ⬜ |

### 3.4 Abilities, Spells & Status Effects

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AB-1 | Abilities are triggered by keys **1–0**, assigned in the character window, and shown in a **numbered ability-bar UI** along the bottom. | P0 | ⬜ |
| AB-2 | Each ability has a **cooldown**. | P0 | ⬜ |
| AB-3 | Abilities are **tied to characters**, so any ship can have them; **NPCs use their abilities** too. | P0 | ⬜ |
| AB-4 | **Frost nova** — ring of frost; anything touched freezes instantly with a 2s thaw timer. | P1 | ⬜ |
| AB-5 | **Healing nova** — ring grants a heal-over-time buff to friendly ships (and self). | P1 | ⬜ |
| AB-6 | **Chaff** — expanding cloud that breaks all locks; missiles entering it explode. | P1 | ⬜ |
| AB-7 | **Quantum brake** — instantly set the player's velocity to 0. | P1 | ⬜ |
| AB-8 | **Seeking fireball**, an **AoE damage** spell, an **AoE heal** spell, and a **lock-in-place** spell. | P2 | ⬜ |
| AB-9 | Additional effects/tools: grappling hook, tractor beam, super shield, invulnerability, pushback/shockwave, EMP (disables own shields), lifesteal, swap, jammer, hacker. | P2 | 🟡 EMP weapon exists |

### 3.5 Modular Ship Building

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| SB-1 | Ships are composed of **modules**; purchased ships are prebuilt module configs. | P0 | ✅ |
| SB-2 | All ships must have a **cockpit/core module**; the class core is permanently fixed in the **center of a 9×9 grid**; grid resizes to fit the display. | P0 | 🟡 slot system exists; not 9×9 fixed-core grid |
| SB-3 | **Power model**: each module has a power cost; enough **generator modules** are required to power the ship. | P1 | 🟡 some stat recompute |
| SB-4 | **Assign crew to a module** to boost that module's stats. | P1 | 🟡 crew slots exist |
| SB-5 | **Symmetric design rules** for every ship's starting layout: core centered, all modules attach off the core, engines have ≥2 backward + 1 forward, weapons point forward, larger ships have more hull cores and a **"+"-shaped core**. | P1 | ⬜ |
| SB-6 | **Save/load ship loadouts.** | P1 | ⬜ |
| SB-7 | **Expansion tiles add increasing weight**; bigger ships need bigger reactors and engines. | P1 | ⬜ |
| SB-8 | **Hull modules must surround** the functional modules; clicking a hull tile cycles its style (round / concave / diagonal / square). | P2 | ⬜ |
| SB-9 | In the builder, **Q/E rotate** the selected module. | P1 | ⬜ |
| SB-10 | **Core modules enforce max module counts** to define/enforce ship classes. | P1 | ⬜ |
| SB-11 | **Turret modules** draw a second sprite on top of the module that aims toward the firing direction; support **independent turret firing**. | P2 | 🟡 turrets exist on some ships |
| SB-12 | **Irregular-shaped modules** make layout a puzzle. | P3 | ⬜ |
| SB-13 | **Decorative modules**, **splitter** (placed in front of a directed weapon), and **silencer** modules. | P3 | ⬜ |

### 3.6 Ship Rendering & Visuals

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| RV-1 | Draw the **module grid with the core centered over the ship's pivot**. **Do not** draw a ship sprite/image, and do not draw the grid behind the health bars. | P1 | ⬜ |
| RV-2 | Draw engine **flame/plume/exhaust only from thrust modules**, in each thruster's pointed direction; remove all other engine flame. **Boost = rainbow** flame & exhaust. | P1 | 🟡 generic engine trail exists |
| RV-3 | **Contrails** behind ships. | P2 | ⬜ |
| RV-4 | **Per-ship engine sound/personality.** | P2 | ⬜ |

### 3.7 Weapons & Combat

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| WP-1 | Ships have **varied equipment**; **bigger ships carry multiple weapons**. | P0 | 🟡 multiple weapon types exist |
| WP-2 | **Projectiles exit from the weapon modules, not the nose.** | P0 | ⬜ |
| WP-3 | **Drastically decrease time-to-kill** (combat tuning pass). | P0 | ⬜ |
| WP-4 | **Damage model**: energy weapons damage shields; physical weapons damage armor. Armor has **resistance** (bullets bounce off high armor → capital ships are hard to kill → need **armor-piercing**). **Railgun pierces all ships in its line.** | P1 | ⬜ |
| WP-5 | **Missile economy**: missiles have a cooldown; more simultaneous missiles require more missile modules. Increase missile speed & turn rate. | P1 | 🟡 lock-on exists |
| WP-6 | **Missile lifecycle**: launch 0.5s after detaching; emit high-pitched hiss in flight; play explosion sound on impact; run out of fuel and drift to a stop; lose lock near a chaff cloud. | P1 | ⬜ |
| WP-7 | **Multi-target missile lock**: countdown trigger + autofire option; select targets on the radar-lock screen up to the number of radar missiles the **fleet** has equipped. | P2 | ⬜ |
| WP-8 | **Missile guidance types**: dumb rocket, IR, radar, radiation, optical, laser-targeted (player-steered), fly-by-wire (jammer-proof), fly-by-TV, programmable-route cruise. **Swappable payloads incl. nukes.** | P2 | ⬜ |
| WP-9 | **Countermeasures**: chaff (vs radar) and flare (vs IR), left behind via a dedicated key/module. **NPCs deploy chaff** when a missile is about to hit. Distinct chaff-launch sound. | P1 | ⬜ |
| WP-10 | **Audio cues**: lock-on tones, lock/radar-lock **warning tone**; weapon sound chosen by projectile type (laser / kinetic / rail); voice callouts (fox 2, fox 3, magnum, rifle, guns, pitbull). | P2 | 🟡 procedural weapon sounds exist |
| WP-11 | **Battlecruisers** have a big **rotating super-turret**: very long range, huge splash damage. | P2 | ⬜ |
| WP-12 | **Capital-ship combat** design — prototype/mock it up. | P2 | ⬜ |
| WP-13 | **Drones**: kamikaze, shooting, and missile drones. Drone-style craft vector in any direction with **no turning** (W = up, A = left, etc.). | P2 | ⬜ |
| WP-14 | **Melee ships / ramming**: no booster but a sprint; directional, non-Newtonian movement. | P3 | ⬜ |
| WP-15 | **Bullet-hell**: ships that dodge well face crazier bullet patterns. | P3 | ⬜ |

### 3.8 Sensors, Radar & Stealth

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| SN-1 | **Circular minimap** simulating **radar + jamming**. | P1 | 🟡 minimap exists |
| SN-2 | **Cloaking**; **IR vision can see cloaked ships**; passive cloak while stopped; cloaking module. | P1 | 🟡 `detectCloaked` stat referenced |
| SN-3 | **Radar module** (radar ping ability) and **RWR module** (chirp + general direction on incoming ping). **Targeting pod.** | P2 | ⬜ |
| SN-4 | **Stealth ships**: radar-absorbing hull, slower/quieter engines. | P2 | ⬜ |
| SN-5 | **Sensor module** reveals one hex away; more powerful versions see further. **Sensor sweep** action. | P2 | ⬜ |
| SN-6 | **Nebulas / space clouds block vision.** | P2 | 🟡 nebula visuals exist |

### 3.9 Hazards & Environment

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| HZ-1 | **Meteors** wreathed in fire that **damage the player on impact**. | P1 | ⬜ |
| HZ-2 | **Comets** with a **damaging trail**. | P1 | ⬜ |
| HZ-3 | **Solar wind.** | P3 | ⬜ |
| HZ-4 | **Atmospheric drag** when flying close to a planet. | P2 | ⬜ |
| HZ-5 | **Voxel asteroids** that chip away as you mine. | P2 | 🟡 mining asteroids exist |

### 3.10 Dynamic Events

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| EV-1 | **Small chance of events** on system arrival or during a stay: a small/medium/large fleet arriving; multiple (unequal) fleets arriving and fighting; a merchant fleet arriving; a merchant fleet pursued by pirates. | P0 | ⬜ |
| EV-2 | Fleets **hostile to the sector warp into an empty hex** away from the system core. | P1 | ⬜ |
| EV-3 | Event ships from **different factions can attack each other**. | P1 | 🟡 hostility table exists |
| EV-4 | **NPC satellites** spawn (loot; may or may not be defended). | P2 | ⬜ |
| EV-5 | **SOS ping in a far-off hex** as a mission reward. | P2 | ⬜ |
| EV-6 | **Trapped chests / derelicts / SOS pings trigger pirate jumps.** | P2 | ⬜ |
| EV-7 | **Loot chests** and **caravans.** | P2 | ⬜ |

### 3.11 Economy & Trade

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| EC-1 | **Trade, missions, crafting** loop. | P0 | ✅ |
| EC-2 | **Smuggling**, cargo **scanning**, **NPC scanner ships**, and **black markets at cantinas**. | P1 | ⬜ |
| EC-3 | **Marketplace item icons**, with **loot using the same icons**. | P1 | ⬜ |

### 3.12 Navigation & Map Zoom

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| NV-1 | **Mousewheel zoom-out → hex map**: a hex grid of the sector. Visible objects render as their minimap icons/colors. The current sector ≈ one hex; spread planets/spaceports/stars across multiple hexes to enlarge systems. | P1 | ⬜ |
| NV-2 | **Further zoom-out → galaxy map**, animating the camera zooming out from the player's current system node. | P1 | 🟡 galaxy map exists |
| NV-3 | **Radar steering.** | P3 | ⬜ |

### 3.13 World, Faction & Strategy Metagame

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| WF-1 | **Faction names are placeholder color-names** for now. | P1 | 🟡 fixed faction set |
| WF-2 | **Demand tribute from planets; take over planets**; planet faction flipping; different planets in one system can be held by different factions. | P1 | 🟡 tribute hooks exist |
| WF-3 | **Planet-takeover methods**: kill the defending fleet, bombard, ground invasion, give tribute, raze, or flip sector faction control. | P2 | ⬜ |
| WF-4 | **Player-run faction**: declare a new faction + assign a color; create custom faction ships. Conquer via force/diplomacy → **faction power points**; friendly actions → **faction influence points** spent on favors. | P2 | ⬜ |
| WF-5 | **Small faction kill-rep gain everywhere** (all space). | P2 | 🟡 relations system exists |

### 3.14 Character Mode & Landing

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| LD-1 | On landing, switch to a **2D side-scroller "character mode."** | P1 | ⬜ |
| LD-2 | **Pickpocketing** (stealth + close range). | P2 | ⬜ |
| LD-3 | **Land battles**: isometric view with tilt-shift effect (prototype). | P3 | ⬜ |
| LD-4 | The initial menu screen shows **artwork depicting the place**. | P2 | ⬜ |

### 3.15 Audio & Music

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AU-1 | **Main-menu music, game-over music, and faction-sector music.** | P1 | 🟡 adaptive procedural music exists |
| AU-2 | **Rework engine noise** — varied, epic, with echo/reverb. | P1 | ⬜ |
| AU-3 | **Pan all sounds** to their correct stereo channel relative to the player ship. | P1 | ⬜ |
| AU-4 | **Rising white-noise** sweep on the title screen. | P2 | ⬜ |
| AU-5 | **MIDI integration**: bass = sine; drums = sampler; perc/crash/ride = white noise + filter; white-noise "elevator" with a sidechained release triggered by escalation; snare/perc hits tied to big in-game hits. | P3 | 🟡 synth engine exists |
| AU-6 | Generate a **"NULL PUNKT"** voice clip with Sega-intro intonation/pitch. | P3 | ⬜ |

### 3.16 Controls & Accessibility

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| CT-1 | **Configurable keybindings / key mapping.** | P1 | ⬜ |
| CT-2 | **Mobile / phone touch controls.** | P1 | ⬜ |
| CT-3 | **Controller / gamepad support.** | P2 | ⬜ |
| CT-4 | **Localization support** (e.g., ship names in German, etc.); **remember player-set options.** | P2 | 🟡 some options persisted |
| CT-5 | **Lock-strafe mode** (Zelda-style): snappy strafe with **no momentum conservation**. | P2 | ⬜ |
| CT-6 | **Remove the reverse action** when a ship has no forward-facing thruster. | P1 | ⬜ |

### 3.17 UI / UX

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| UI-1 | **Log menu** with a show/hide button on the main screen. | P1 | ⬜ |
| UI-2 | **Ship menu**: name the ship, view stats and status. | P1 | 🟡 partial ship info |
| UI-3 | **Target screen** lists ship name first, then faction (in faction color), then hostility status. | P1 | 🟡 comms/target shows faction + name |
| UI-4 | After the **main title text zooms past the camera**, it slowly **zooms back into the horizon**. | P2 | ⬜ |
| UI-5 | **Title-screen hyperspace animation.** | P2 | ⬜ |
| UI-6 | **Debug-mode parameter tuning**: every balance parameter has a default but can be **double-clicked to edit** when debug mode is on. | P2 | ⬜ |

### 3.18 Tiers, Progression & Balance

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| TR-1 | **Tier 1–5 pecking order** across ships / characters / items / crafting / tech (the "wood → copper → iron → steel → diamond, in space" ladder). | P1 | ⬜ |
| TR-2 | **Progression feel**: tier 1 generally sucks / is limited; tier 2 hauler to make money; full features synergize (small fleet); specialization (big fleet); "insane mode" (death-star tier). | P2 | ⬜ |
| TR-3 | **Tiered zones** spawn tier-appropriate enemies. | P2 | ⬜ |
| TR-4 | **Starter progression**: first ship is a trainer ship; the player earns one of **3 starter ships**. | P1 | ⬜ |
| TR-5 | **Fighters cannot hyperjump** and must **dock into a mothership**. | P1 | ⬜ |
| TR-6 | **Make fuel and jumping very expensive.** | P1 | 🟡 fuel/jump cost exist |
| TR-7 | Give each ship a **focused, unique playstyle** (e.g., shuttle: haul cargo, run away, rear turret on pursuers, chaff vs missiles, optional cloak). | P1 | 🟡 distinct ship stats |

### 3.19 Wildlife

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| WL-1 | **Wildlife** with **hunting**, and pacifist/aggro behaviors. | P3 | ⬜ |

---

## 4. Nice-to-Haves (Speculative / P3)

These are aspirational notes kept for vision, not committed scope:

- **Big structures / "dungeons"** — giant explorable structures to fly into.
- **Space submarine + nukes** — a "Barotrauma, but top-down" mode.
- **Multiplayer** — deathmatch, team deathmatch, uneven teams, co-op; or MMO-style "safe zones" and "PvP zones".
- **Vaporwave aesthetic** — palm trees, checkerboard floors, statues, neon.
- **Pleasant scenery audio** — space windchimes, space fountains.
- **Restaurant minigame** — Dave-the-Diver-style play.
- **Deep colony/dynasty systems** — "steal everything from RimWorld and its mods"; feudalist / Crusader-Kings-style dynasties.

---

## 5. Bugs (explicit fixes requested)

| ID | Bug | Status |
|----|-----|--------|
| BUG-1 | Ships that hyperjump away are sometimes **destroyed and reported "destroyed by unknown."** Ships that hyperspace away should simply **leave the system** (no destruction, no kill credit). | 🟡 hyperspace works; destruction edge-case to verify |
| BUG-2 | **NPC hyperspace sounds play at constant volume** regardless of camera/player distance. They should attenuate with distance (ties into AU-3 stereo panning). | ⬜ |
| BUG-3 | **Nearby-ship hyperspace "buildup" sound** is wrong / needs fixing. | ⬜ |
| BUG-4 | **Explosion knockback** is incorrect — fix it. | ⬜ |
| BUG-5 | **"Render down assets to files"** — bake/export procedural assets to static files (performance/loading). | ⬜ |

---

## 6. Open Issues & Questions

Items from the notes that need a design decision before they can become concrete requirements:

1. **Capital-ship combat (WP-12)** — explicitly flagged as "figure out / mock it up." Needs a combat design pass (turret arcs, armor resistance interplay, fleet roles) before implementation.
2. **Map scale model (NV-1/NV-2)** — confirm the three-tier zoom (flight → sector hex map → galaxy map) and how a "sector = one hex" maps onto existing system generation.
3. **Faction identity (WF-1)** — factions are currently a fixed set (earth, rebellion, pirate, alien, contested, neutral); the notes want placeholder color-names plus a player-created faction. Decide whether to rename existing factions or layer a player faction on top.
4. **Class ↔ ability ↔ crew-role relationship (CH-7, AB-3)** — classes (hacker, medic, …) overlap conceptually with existing crew roles (Pilot, Gunner, Engineer, Medic, Navigator, Marine). Decide whether classes replace, extend, or sit beside crew roles.
5. **Ship rendering change (RV-1)** — "do not draw the ship sprite" conflicts with existing `ship_images/` assets and the sprite cache. Confirm the grid-only visual direction before removing sprites.
6. **9×9 fixed-core grid (SB-2)** — reconciling the desired 9×9 grid + permanent center core with the current ring-based module slot UI is a non-trivial refactor.
7. **Balance philosophy (WP-3, TR-1)** — "drastically decrease time-to-kill" plus a 5-tier power ladder requires a unified balance pass and the debug-tuning tooling (UI-6) to support it.
8. **Documentation debt** — the notes ask to "find out the complete data structure, build a wiki, document, find out names of data structures to avoid confusion." Recommend an architecture/data-model doc as a precursor to the larger features.

---

## 7. Suggested Phasing

A pragmatic order that front-loads quick wins and unblocks dependent systems:

1. **Phase 0 — Bug fixes & polish:** BUG-1…BUG-5; CT-6 (reverse without forward thruster); WP-2 (projectiles from weapons).
2. **Phase 1 — Identity & comms:** CH-1…CH-6, CM-1…CM-8, CM-13 (creation flow, captains, animalese TTS, traffic-control welcome).
3. **Phase 2 — Abilities & combat feel:** AB-1…AB-7, WP-1/WP-3/WP-5/WP-6/WP-9 (ability bar, novas, chaff, missile lifecycle, TTK pass).
4. **Phase 3 — Fleets & events:** FL-3…FL-8, EV-1…EV-3 (tactical orders, dynamic fleet events).
5. **Phase 4 — Systems & ship building:** SB-2/SB-5/SB-6/SB-9/SB-10, SN-1…SN-4 (9×9 grid, loadouts, radar/stealth).
6. **Phase 5 — Metagame & modes:** WF-1…WF-4, LD-1, NV-1, TR-1…TR-5 (faction conquest, character mode, map zoom, tiers).
7. **Ongoing:** AU-1…AU-3 audio, CT-1…CT-4 controls/accessibility, UI polish.
