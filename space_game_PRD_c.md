# Product Requirements Document — *(Working Title: NULL PUNKT)*
### 2D Top-Down Space Exploration & Fleet-Combat Game

**Status:** Draft v1 · Derived from raw design notes
**Document owner:** _TBD_
**Last updated:** June 5, 2026

---

## 1. Overview

A 2D top-down space-exploration and combat game built around **modular ship construction**, **fleet command**, **faction warfare/conquest**, and a character layer that lets the player leave the cockpit and walk around (a 2D side-scroller "in-person" mode). The world is navigated through a zoomable scale of views — local spaceflight → sector hex map → galaxy map — and is populated by NPC ships with distinct captains, personalities, and voice-synthesized comms.

The fantasy: start in a junky trainer ship, build up a fleet, master ability-based combat, and grow from lone pilot into a faction warlord who can flip planets and entire sectors.

### Design Pillars
1. **Build it yourself.** Ships are grids of modules. Layout, power, weight, and crew all matter.
2. **Command a fleet.** Combat scales from a single ship to RTS-style fleet orders.
3. **A living, talkative galaxy.** Captains have personalities and speak (animalese + robot TTS). Events make systems feel alive.
4. **Conquer and rule.** Trade, smuggle, raid, conquer planets, and run your own faction.
5. **Feel-first combat.** Punchy weapons, fast time-to-kill, missiles + countermeasures, abilities on cooldown.

### Reference Inspirations (from notes)
RimWorld (and its mods) for systems depth, *Dave the Diver* for the on-foot restaurant/management loop, *Barotrauma* for the "space submarine" concept, *Crusader Kings* for the optional dynasty/feudal layer, and a **vaporwave** visual identity (palm trees, checkerboard, statues, neon).

---

## 2. Priority Legend

| Tag | Meaning |
|-----|---------|
| **P0** | Core / Must-have. Game doesn't work as intended without it. |
| **P1** | Should-have. Strongly desired for the target experience. |
| **P2** | Nice-to-have. Adds depth/polish. |
| **P3** | Concept / Exploratory. Needs design work before it's a real requirement. |

> Note: items that appeared **repeatedly** in the source notes (e.g. the hyperspace-destruction bug, comms/TTS, character creation) were bumped in priority accordingly.

---

## 3. Functional Requirements

### 3.1 Ship Building (Modular Construction)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-BUILD-01 | Ships are built on a **9×9 grid**, resized to fit the display. The ship-class **core is permanently fixed in the center**. | P0 |
| FR-BUILD-02 | Modules are placed adjacent to and connected from the core; in on-foot mode each module becomes a walkable **"room."** | P0 |
| FR-BUILD-03 | Every ship **must contain a cockpit module.** | P0 |
| FR-BUILD-04 | Each module has a **power cost**; the ship needs enough generator modules to power all modules. | P0 |
| FR-BUILD-05 | Crew can be **assigned to a module to boost its stats.** | P1 |
| FR-BUILD-06 | **Hull modules must surround** the functional modules. Clicking a hull module cycles its style: round, concave, diagonal, square. | P1 |
| FR-BUILD-07 | In the builder, **Q/E rotate** the selected module. | P1 |
| FR-BUILD-08 | **Save/load ship loadouts.** | P1 |
| FR-BUILD-09 | Expansion tiles add **weight**; bigger ships require bigger reactors and engines (gating progression). | P1 |
| FR-BUILD-10 | **Core modules cap module count** to enforce ship classes; larger ships have more hull cores. Largest ships use a **"+"-shaped core.** | P1 |
| FR-BUILD-11 | Each ship ships with a **default starting module placement** following these rules: symmetric, core-centered, modules attached from the core, engines have **≥2 rear-facing + 1 forward-facing** thruster, weapons face forward. | P1 |
| FR-BUILD-12 | Procedural / auto module generation must follow **symmetric design.** | P2 |
| FR-BUILD-13 | Support **irregular-shaped modules** as a placement puzzle. | P3 |
| FR-BUILD-14 | Decorative-only modules; **splitter** module (placed in front of a directed weapon); **silencer** module. | P2 |

**Rendering rules (Build/Flight):**
- Draw the grid with the **core centered over the ship's pivot point.**
- **Do not draw a baked ship sprite** — render from modules only. Never draw a ship sprite behind the health bars.
- **Turret modules** render a second sprite on top that **rotates toward the firing direction.**

---

### 3.2 Ship Classes & Playstyles

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CLASS-01 | Each class has a **focused, unique playstyle.** | P0 |
| FR-CLASS-02 | **Shuttle:** cargo hauler that runs away; rear turret shoots pursuers; chaff vs missiles; possible cloak. | P1 |
| FR-CLASS-03 | **Missile boat** class (and/or split "frigate" into frigate + gunboat). | P1 |
| FR-CLASS-04 | **Battlecruiser / capital:** large **rotating super-turrets**, very long range, huge splash damage. | P1 |
| FR-CLASS-05 | **Melee ship:** no booster but has a **sprint**; directional, **non-Newtonian** movement (no momentum conservation); ramming. | P2 |
| FR-CLASS-06 | **Drone craft:** can vector in any direction with **no turning** (W=up, A=left, etc.); non-Newtonian. | P2 |
| FR-CLASS-07 | **Stealth ship:** radar-absorbing hull, slower/quieter engines. | P2 |
| FR-CLASS-08 | **Fighters cannot hyperspace jump** and must **dock into a mothership.** | P1 |
| FR-CLASS-09 | First ship is a **trainer ship**; the player then earns one of **3 starter ships.** | P1 |
| FR-OPEN-01 | **Capital-ship combat needs to be designed/mocked up.** (Open question — see §7) | P0 |

---

### 3.3 Combat

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CMB-01 | **Drastically reduce time-to-kill.** | P0 |
| FR-CMB-02 | **Energy weapons damage shields; physical weapons damage armor.** | P0 |
| FR-CMB-03 | Armor has **resistance**: high armor causes bullets to bounce, making capital ships hard to kill and requiring **armor-piercing rounds.** Railgun deals **piercing** damage through all ships hit. | P1 |
| FR-CMB-04 | Ships carry **varied weapons**; larger ships mount **multiple weapons.** | P1 |
| FR-CMB-05 | **Projectiles spawn from the weapon module**, not the ship nose. | P0 |
| FR-CMB-06 | Play **weapon sound by projectile type** (laser, kinetic, rail, etc.). | P1 |
| FR-CMB-07 | **Railgun:** sniper-range; counterable (chaff for radar, flare for IR). | P1 |
| FR-CMB-08 | **Bullet-hell patterns** for enemies when the player ship can dodge well. | P2 |
| FR-CMB-09 | Independent turret firing (auto-aim). | P2 |
| FR-CMB-10 | Event-spawned ships from **different factions can attack each other.** | P1 |

**Missiles**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-MSL-01 | Missiles have a **cooldown**; more simultaneous missiles require more missile modules. | P0 |
| FR-MSL-02 | Missiles **launch 0.5s after detaching** from the ship. | P1 |
| FR-MSL-03 | Missiles emit a **high-pitched hiss** in flight; play an **explosion sound** on detonation. | P1 |
| FR-MSL-04 | Missiles **run out of fuel** and drift to a stop. | P1 |
| FR-MSL-05 | **Increase missile speed and turn rate.** | P1 |
| FR-MSL-06 | Missiles **lose lock near a chaff cloud.** | P1 |
| FR-MSL-07 | **Multiple-target lock** — select targets on the radar-lock screen, up to the **fleet's total radar-missile count.** | P1 |
| FR-MSL-08 | Missile launch via **countdown** with an **autofire** option. | P2 |
| FR-MSL-09 | **Missile types:** dumb/rocket, IR, radar, radiation, optical, laser-targeted (player-steered), **fly-by-wire** (jammer-proof), **fly-by-TV**, **cruise** (programmable route). | P2 |
| FR-MSL-10 | All missiles support different **payloads, including nukes.** | P3 |

**Countermeasures & Detection**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CM-01 | Countermeasure keys: **chaff** (defeats radar), **flare** (defeats IR); chaff is left behind in a cloud. | P1 |
| FR-CM-02 | NPC ships equipped with chaff **use it automatically** when a missile is locked and about to hit. | P1 |
| FR-CM-03 | **Lock-on noises**, a **radar-lock warning tone**, and a **lock-warning** indicator. | P1 |
| FR-CM-04 | **RWR module:** on being painted by a radar ping, play a chirp and show a general direction of the ping. | P2 |
| FR-CM-05 | **Radar module:** simulates radar; the **radar ping is an ability.** | P2 |
| FR-CM-06 | **Targeting pod** module. | P2 |
| FR-CM-07 | Drone weapons: **kamikaze**, **shooting**, and **missile** drones. | P2 |

---

### 3.4 Abilities / Spells

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AB-01 | Abilities are triggered by the **1234567890 keys**, assigned in the character window, and shown in a **numbered grid UI along the bottom** of the screen. | P0 |
| FR-AB-02 | Each ability has a **cooldown.** | P0 |
| FR-AB-03 | Abilities are **tied to characters** → any ship with a captain can have abilities; **NPCs use their abilities.** | P0 |
| FR-AB-04 | At character creation the player **picks a starting spell.** | P1 |
| FR-AB-05 | **Frost Nova:** ring of frost; anything touched freezes/stops instantly with a **2-second thaw timer.** | P1 |
| FR-AB-06 | **Healing Nova:** ring that grants a heal-over-time buff to friendly ships it touches (incl. the player). | P1 |
| FR-AB-07 | **Chaff:** emit an expanding chaff cloud that breaks all locks; missiles entering it explode. | P1 |
| FR-AB-08 | **Quantum Brake:** instantly set the player's velocity to 0. | P1 |
| FR-AB-09 | Additional abilities: grappling hook, tractor beam, super shield, invuln, pushback/shockwave, **EMP** (disables own shields), lifesteal, swap, jammer, hacker, **seeking fireball**, AoE damage, AoE heal, AoE lock-in-place. | P2 |

---

### 3.5 Characters

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CHR-01 | New game → create a **main character**: name, sex, avatar, and **starting spell.** | P0 |
| FR-CHR-02 | For now, generate **1 male + 1 female avatar per faction**, with clothing in the **faction color** (placeholder art). | P1 |
| FR-CHR-03 | Every ship has an internal **captain** with their own avatar, name, sex, and faction. | P0 |
| FR-CHR-04 | **Classes:** hacker, tech priest, space marine, monk, medic, sniper, tank, berserker, knight. | P1 |
| FR-CHR-05 | **Captain personality types:** timid, aggressive, crazy, aloof, friendly. Tone variants: cuss, nice, salty, tired-sounding, angry, authoritarian, rebel. | P1 |
| FR-CHR-06 | **Cross-ship banter:** nervous hello when flying close; "nice to meet you, $PLAYER_NAME" if friendly; a bark if unfriendly. | P2 |
| FR-CHR-07 | Small chance of **NPC chatter** announcing their intentions. | P2 |
| FR-CHR-08 | **Voice picker** in character creation; the player's avatar also speaks. | P2 |

---

### 3.6 Comms & Text-to-Speech

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-COM-01 | Comms messages appear **letter-by-letter**; each letter plays an **Animal Crossing–style "animalese"** sound for a simple TTS effect. | P0 |
| FR-COM-02 | **Male voices are deeper than female voices.** | P1 |
| FR-COM-03 | The speaking captain's **avatar appears beside the message.** | P0 |
| FR-COM-04 | After it finishes spelling out, the message **holds a few seconds then fades.** | P1 |
| FR-COM-05 | **Voice on/off (and voice select) option** in the options menu. | P1 |
| FR-COM-06 | When the player sends comms, **open the comms menu, draw that ship's avatar, and have it speak the responses.** | P0 |
| FR-COM-07 | While the comms menu is open, the player can **still steer with WASD/arrow keys.** | P1 |
| FR-COM-08 | TTS templates use **$PLAYER_NAME** and/or the ship's name. | P1 |
| FR-COM-09 | **Space Traffic Control** sends a welcome comm when the player lands. | P1 |
| FR-COM-10 | Each port menu has a **one-time** shop-owner welcome comm. | P2 |
| FR-COM-11 | TTS uses **NATO phonetic alphabet** and **aviation lingo.** | P2 |
| FR-COM-12 | Provide **animalese TTS alongside a robot-voice TTS** option. | P2 |
| FR-COM-13 | **Distant/jammed comms** are distorted / breaking up. | P2 |
| FR-COM-14 | Disabled ships can use a comms option to **beg for help**; friendly/allied ships **always respond.** | P1 |
| FR-COM-15 | **Fleet commanders can negotiate surrender** over comms. | P2 |

---

### 3.7 Fleet System

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-FLT-01 | When a fleet's **capital ship flees and jumps**, its escorts either **stay & defend** or **also flee.** | P1 |
| FR-FLT-02 | All ships in a fleet **share cargo space**; all cargo indicators show **fleet-wide** capacity. | P0 |
| FR-FLT-03 | Disabled/destroyed fleet ships **drop their cargo** like NPC ships. | P1 |
| FR-FLT-04 | **Escort comms orders:** hold position, attack, defend; **lock in formation.** | P1 |
| FR-FLT-05 | **Release a ship from duty** from the fleet menu → it becomes an **independent faction ship** and flies away. | P1 |
| FR-FLT-06 | **Friendly fire** to player-fleet ships is allowed at **50% damage**; the ship **messages the player** when attacked. | P1 |
| FR-FLT-07 | NPC fleets **fly in formation** and use **tactics.** | P2 |
| FR-FLT-08 | **Fleet command (RTS) view** — order ships around on the hex map. | P2 |
| FR-FLT-09 | **Set crew to man ships** from a ship inventory. | P1 |
| FR-FLT-10 | Autopilot also **fires, controls throttle, and uses abilities.** | P2 |

---

### 3.8 World, Map & Navigation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-MAP-01 | **Mousewheel zoom-out** transitions spaceflight → **sector hex map** → **galaxy map.** | P0 |
| FR-MAP-02 | The **hex map** is a blown-up minimap: visible minimap objects render as the same icon/color. Current sector ≈ **one hex**; planets/ports/stars spread across **different hexes** to enlarge systems. | P1 |
| FR-MAP-03 | Hostile warp-ins must arrive in an **empty hex away from the system core.** | P1 |
| FR-MAP-04 | Galaxy map transition **animates the camera zooming out** from the player's current system node. | P1 |
| FR-MAP-05 | **Circular minimap** that simulates **radar + jamming**; **IR vision can see cloaked ships.** | P0 |
| FR-MAP-06 | **Cloaking:** a module, plus a **passive "cloak while stopped."** | P1 |
| FR-MAP-07 | **Sensor module:** see one hex away; more powerful versions see further. | P2 |
| FR-MAP-08 | **Nebulas / space clouds** block vision. | P2 |
| FR-MAP-09 | **Procedurally generated planets / landing zones.** | P1 |
| FR-MAP-10 | **"Dungeons"** — giant structures the player flies into. | P2 |
| FR-MAP-11 | **Voxel asteroids** that can be **mined / chipped away.** | P2 |
| FR-MAP-12 | Flight near a planet causes **atmospheric drag**; **solar wind** as an environmental force. | P2 |
| FR-MAP-13 | **NPC satellite spawns** — loot; may or may not be defended. | P2 |
| FR-MAP-14 | **Meteors** (on fire, hurt player on impact) and **comets** (damaging trail). | P2 |
| FR-MAP-15 | **Radar steering** and a **sensor sweep** action. | P2 |
| FR-MAP-16 | Ambient scenery: space windchimes, fountains, statues, palm trees (vaporwave). | P3 |

---

### 3.9 Events

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-EVT-01 | Small chance an **event spawns** on arrival in a system or during the stay. | P1 |
| FR-EVT-02 | Event examples: small/med/large fleet arriving; **multiple fleets arriving and fighting** (unequal sizes OK); merchant fleet arriving; **merchant fleet pursued by pirates.** | P1 |
| FR-EVT-03 | **SOS ping in a far-off hex** as a mission with a reward. | P2 |
| FR-EVT-04 | **Trapped chests / derelicts / SOS pings** can trigger **pirate jump-ins.** | P2 |
| FR-EVT-05 | **Loot chests.** | P2 |

---

### 3.10 Economy, Trade & Salvage

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ECO-01 | **Smuggling, scanning, NPC scanner ships, black markets at cantinas.** | P1 |
| FR-ECO-02 | **Marketplace item icons**; loot uses the **same icons.** | P1 |
| FR-ECO-03 | Make **fuel and jumping expensive** (core economic pressure). | P1 |
| FR-ECO-04 | **Commandeer derelict vessels:** chance they're damaged and need repairs — a cheap path to a new ship. | P1 |
| FR-ECO-05 | **Caravans.** | P2 |
| FR-ECO-06 | **Wildlife and hunting**, with pacifist/aggressive behavior states. | P3 |

---

### 3.11 Faction & Conquest

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-FAC-01 | Factions are currently **color names** (placeholder). | P0 |
| FR-FAC-02 | **Planet takeover** paths: kill the defending fleet, **bombard**, **ground invasion**, **give tribute**, **raze**, then **flip sector/planet faction control.** | P1 |
| FR-FAC-03 | Different planets in a system can be **controlled by different factions.** | P1 |
| FR-FAC-04 | On taking a planet the player can **declare a new faction and assign it a color.** | P1 |
| FR-FAC-05 | A player who controls a faction can **design custom faction ships.** | P2 |
| FR-FAC-06 | **Faction Power Points** earned via conquest; **Faction Influence Points** earned via friendly actions, spent on favors. | P2 |
| FR-FAC-07 | **Small faction kill-rep gain everywhere** in space. | P1 |
| FR-FAC-08 | **Demand tribute** from planets; **faction war**; **planet faction flipping.** | P1 |

---

### 3.12 Character Mode (On-Foot)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-FOOT-01 | When landing, switch to a **2D side-scroller** mode. | P1 |
| FR-FOOT-02 | A ship's modules become the **walkable rooms** in on-foot mode. | P1 |
| FR-FOOT-03 | **Pickpocketing** (stealth + close range). | P2 |
| FR-FOOT-04 | **Restaurant / management** mini-loop (*Dave the Diver* style). | P3 |
| FR-FOOT-05 | **Land battles:** isometric view with a tilt-shift effect (prototype only for now). | P3 |
| FR-FOOT-06 | Broad systems-depth inspiration drawn from RimWorld + mods. | P3 |

---

### 3.13 Audio & Music

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUD-01 | Distinct tracks for **main menu, game over, and faction-sector** music. | P1 |
| FR-AUD-02 | **Per-ship engine sounds / personality**; rework engine noise to vary and sound epic with **echo/reverb.** | P1 |
| FR-AUD-03 | **Pan all sounds** around the player ship into the correct **stereo channels.** | P1 |
| FR-AUD-04 | **Boost** renders as a **rainbow-colored** flame + exhaust. | P2 |
| FR-AUD-05 | **Rising white-noise** sound on the title screen. | P2 |
| FR-AUD-06 | **MIDI-driven music engine:** bass = sine wave, drums = sampler, perc/crash/ride = white noise + filter, a **side-chained white-noise "elevator"** that releases on escalation, snare/perc hits triggered by **in-game big hits.** | P3 |
| FR-AUD-07 | Generate a **"NULL PUNKT"** voice clip with the same intonation/pitch as the classic "SEGA" startup sound. | P2 |
| FR-AUD-08 | Missile-related SFX: in-flight hiss, explosion, **chaff-ball launch** sound. | P1 |
| FR-AUD-09 | Combat SFX vocabulary: pitbull, fox 2, fox 3, magnum, rifle, guns (aviation call-outs). | P2 |

---

### 3.14 Visuals & Aesthetic

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-VIS-01 | **Vaporwave identity:** palm trees, checkerboard, statues, neon. | P2 |
| FR-VIS-02 | Initial menu screen is **artwork depicting the location.** | P2 |
| FR-VIS-03 | Title text **zooms past the camera**, then **slowly zooms back into the horizon.** | P2 |
| FR-VIS-04 | Engine **flame/plume + exhaust** only render from thrust modules, **only in the direction each thruster points.** Remove all other engine VFX. | P0 |
| FR-VIS-05 | **Contrails.** | P2 |
| FR-VIS-06 | **Ship names in multiple languages** (German, etc.). | P3 |

---

### 3.15 Controls, Platforms & Accessibility

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CTL-01 | **Keybindings / key-mapping config.** | P0 |
| FR-CTL-02 | **Mobile (phone) controls support.** *(Flagged emphatically multiple times in notes.)* | P0 |
| FR-CTL-03 | **Controller support.** | P1 |
| FR-CTL-04 | **Localization support.** | P1 |
| FR-CTL-05 | **Remember the player's set options** between sessions. | P0 |
| FR-CTL-06 | **Lock-strafe mode** (Zelda-style); strafing must be **snappy with no momentum conservation.** | P2 |
| FR-CTL-07 | **Log menu** with a **show/hide button** on the main screen. | P1 |
| FR-CTL-08 | **Ship menu:** name the ship, view stats and status. | P1 |
| FR-CTL-09 | **Debug mode:** all balance parameters have defaults but can be **double-clicked and edited** when debug mode is on. | P1 |

---

### 3.16 Progression & Tiers

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-TIER-01 | Organize difficulty so player **power ramps** sensibly with better loot. | P1 |
| FR-TIER-02 | Establish a **pecking order across Tiers 1–5** for ships, characters, items, crafting, and tech (the "wood→copper→iron→steel→diamond, but in space" ladder). | P1 |
| FR-TIER-03 | Tier feel: **T1 generally sucks / is limited**; T2 = a solid hauler or killing ship; T3 = ships/abilities **synergize**, small fleet required; T4 = **specialization**, big fleet; T5 = **insane mode** (Death Star–scale). | P2 |
| FR-TIER-04 | **Tiered zones** that spawn tier-appropriate enemies. | P2 |

---

### 3.17 Multiplayer

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-MP-01 | Multiplayer scenarios: deathmatch, team deathmatch, **uneven teams**, co-op — **or** an MMO-style model with **safe zones and PvP zones.** | P3 |

---

## 4. Bugs to Fix

These are explicit "fix it" items pulled from the notes. The hyperspace-destruction issue appeared **several times** and should be treated as high priority.

| ID | Bug | Priority |
|----|-----|----------|
| BUG-01 | Ships that hyperspace away are sometimes **destroyed and reported "destroyed by unknown."** They should simply **leave the system.** | **P0** |
| BUG-02 | NPC **hyperspace noise plays at constant volume** regardless of camera/player distance. Should attenuate with distance. | P1 |
| BUG-03 | **Nearby-ship hyperspace build-up noise** is wrong/buggy and needs fixing. | P1 |
| BUG-04 | **Explosion knockback** is broken. | P1 |
| BUG-05 | The **reverse ability should be removed** when a ship has no forward-facing thruster. | P1 |

---

## 5. Nice-to-Haves (Consolidated)

The following are lower-priority polish/flavor items grouped for quick reference (full detail lives in their parent sections): boost rainbow VFX (FR-AUD-04), space windchimes/fountains/scenery (FR-MAP-16), multi-language ship names (FR-VIS-06), wildlife & hunting (FR-ECO-06), caravans (FR-ECO-05), cross-ship banter (FR-CHR-06), one-time shop welcome comms (FR-COM-10), and the MIDI music engine (FR-AUD-06).

---

## 6. Concept / Exploratory Ideas (P3 — need design work)

These appeared in the notes as raw ideas without enough definition to be requirements yet:

- **Space submarine + nukes** — a "*Barotrauma* but top-down" mode/subsystem.
- **Feudal / Crusader Kings–style dynasty system** layered on top of faction rule.
- **Restaurant/management loop** (*Dave the Diver* style) within on-foot mode.
- **Land battles** in isometric tilt-shift view (prototype only).
- Deep RimWorld-style colony/character simulation systems.
- Irregular module-shape placement puzzle (FR-BUILD-13).

---

## 7. Open Questions & Investigations

| ID | Question / Task |
|----|-----------------|
| OPEN-01 | **Design capital-ship combat.** How do huge, hard-to-kill ships fight and get killed? Mock it up. (Ties to FR-CMB-03 armor resistance + AP rounds.) |
| OPEN-02 | **Independent turret firing** — should turrets auto-target, and how does that interact with player aim? |
| OPEN-03 | **Multiplayer model decision** — discrete scenarios vs. persistent MMO safe/PvP zones (FR-MP-01). |
| OPEN-04 | **Should the shuttle have cloak?** (FR-CLASS-02) |
| OPEN-05 | **Documentation / data-model task:** define the complete data structures, name them to avoid confusion, and build an internal **wiki** for the project. (Foundational — recommend doing early.) |
| OPEN-06 | **Faction system depth** — confirm scope of Power vs. Influence points and how favors are spent. |

---

## 8. Suggested Phasing (Editorial — not from source notes)

A possible build order to make the above tractable. Adjust freely.

1. **Foundation:** data model + wiki (OPEN-05), module grid & core rules (FR-BUILD-01–04, 11), module-only rendering (FR-VIS-04), options persistence (FR-CTL-05).
2. **Core loop:** flight, weapons-from-modules (FR-CMB-05), fast TTK (FR-CMB-01), minimap/radar (FR-MAP-05), the hyperspace fix (BUG-01).
3. **Identity:** character creation (FR-CHR-01/03), comms + animalese TTS (FR-COM-01/03/06), abilities bar (FR-AB-01–03).
4. **Depth:** fleets + shared cargo (FR-FLT-02/04/05), missiles + countermeasures (FR-MSL-*, FR-CM-*), hex/galaxy map (FR-MAP-01–04), events (FR-EVT-01/02).
5. **World & rule:** economy/smuggling (FR-ECO-*), faction conquest (FR-FAC-*), tiers (FR-TIER-*), on-foot mode (FR-FOOT-01/02).
6. **Reach:** mobile/controller polish, multiplayer, and the P3 concepts.

---

*This PRD was assembled from raw design notes. Priorities and phasing are interpretive starting points — refine with the team.*
