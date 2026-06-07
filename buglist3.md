render down assets to files

## fleets
npc fleets when the capital ship decides to flee and hyperspace jump away have the escort ships either stay and defend or attempt to flee as well.

all ships in a fleet share cargo space, and update all cargo space indicators to show fleet cargo space. disabled and destroyed fleet ships drop their cargo just like npc ships.

npc fleets fly in formation - have them use tactics
allow player a fleet command view, order ships around like RTS in the hex map
have ship autopilot also fire and control throttle, use abilities
comms on escort ship order to hold position, attack, defend
lock in formation
when disabled comms option beg for help, if friendly/allied will always come.
allow friendly fire to ships in the players fleet but reduce damage to 50% and have the ship message the player when the player attacks them.
from the fleet menu allow the player to release a ship from duty.  the ship will become an independent faction ship and will fly away.
fleet commanders: on comms can negotiate surrender

add drones - do they need pilot?
daughter ship - any vessel that docks at a 'mothership' - carriers, drones, fighters
carriers have launch/target/recall fighters ability, 1 bay module per ship, have cooldown inbetween launching again (must get fighters out ahead of time)
kamakazee drones, shooting drones, missile drones


## bugs / fixes
sometimes when ships hyperjump away they are destroyed, and it says destroyed by unknown, fix it, ships that hyperspace away should just leave the system
npc hyperspace noises are always the same volume, regardless of camera distance or player distance, fix it
fix nearby ship hyperspace buildup noise
fix explosion knockback
get rid of triangles - fix later
remove reverse ability if there is no forward facing thruster.
better hp and shield indicator: indicate heavy armor, tons of HP, etc


## environment / world
meteors, flying with fire around them and hurt the player on impact. comets, damaging trail.
have nebulas/space clouds to block vision
solar wind
ship flight close to planet, have atmosphere cause drag.
voxel asteroids, have mining chip away
"dungeons" giant structures to fly into
NPC satellites spawns - loot, may or may not be defenseless
caravans
space windchimes, space fountains, pleasant scenery


## character creation
when player creates new game have them create a new main character, with name, sex, and avatar. For now generate 1 male and 1 female avatar for each faction, and make their clothes the color of that faction. all ships have an internal character captain with their own avatar (name, sex, faction, etc).  When a ship is communicating on comms show their avatar.

classes:
hacker - chaff (name it hackery)
tech priest - turret (drone) - make necro-ey
space marine - stim
monk - frost nova
medic - healing nova
sniper - mark
tank - brake (add shield effect)
beserker - boost
knight -

recover disable ability
stun disable ability

have first ship be a trainer ship, but have the player earn one of the 3 'starter' ships
setup voices, setup voice picker in character creation.  have the players own avatar talk.


## comms / TTS
when a comms message is being displayed, have the message appear letter by letter, and when a letter appears have the animal crossing style animalese effect play the letter sound to do a simple text to speech effect.  Have the ships captains avatar appear next to the message.  have male voices deeper than female ones. once the message is spelt out have it remain on screen for a few seconds then fade away.  Have voice sound option in options menu.  when player sends comms to other ship and the comms menu opens, draw that ships avatar and have them speak the responses.
have animalese TTS along side robot TTS
TTS make nato alphabet, use aviation lingo.
when TTS is comms with player use $PLAYER_NAME, or have ship name
far away / jammed comms is distorted /breaking up/
cross ship banter, trigger a nervous hello when flying close, nice to meet you $player_name if friendly, or a bark if unfriendly.  have chars have personalities.
npc chatter of their intention ... have a small chance
when the player lands somewhere, have a comms message from space traffic control welcoming the player.
when the comms menu is open allow the player to steer the ship with wasd and arrow keys


## UI
log menu show, hide button on main screen
ship menu, name ship, see stats, status
marketplace item icons, and make the loot have same icons
for parameter tuning for balance, make all parameters have default but allow player to double click and edit them if debug mode is on
song player with controls
camera controls.  lock camera.  free camera


## menus / art
Have the initial screen on the menu be artwork depicting the place.  Have each menu in the port have a comms pop up and welcome message from the shopowner that is placed only once.
main menu music, game over music, faction sector music
after main title text zooms past the camera, have it zoom slow back into the horizon
generate an audio clip of the words NULL PUNKT with same intonation and pitch like the "sega" sound before sonic the hedgehog
rising white noise sound on titlescreen.


## sound
rework all engine noise, make it vary and sound epic, have echo and reverb effects
per ship engine sounds / personality
pan all sounds happening around the players ship in their proper stereo channel.
play weapon sound based on projectile type: laser, kinetic, rail, etc
have various lock on noises as well as lock on warning.
have radar lock warning tone
chaff ball launching sound
have missiles emit a high pitched hissing noise when flying.  play explosion sound when missile explodes.
integrate midi into music engine
bass - sine wave
drums - sampler?
perc/crash/ride - white noise + filter
white noise elevator and then sidechained release that is triggered by escalation
snare hits + perc hits based on in-game big hits
pitbull noise
fox 2
fox 3
magnum
rifle
guns


## map / navigation
mousewheel zoom out during spaceflight zooms into a new intermediate map state called hex map which is hex grid of the sector.  in this view, draw any objects that are visible in the minimap as the same icon and color (basically make it a blown up minimap). make the current sector size about the size of one hex.  move planets, spaceports, and stars in the system into different hexes to make systems larger.  fleets that warp in that are hostile to the sector must warp in an empty hex away from the core of the system.

increasing mousewheel zoom out zooms out to the galaxy map.  when transitioning to the galaxy map, animate the camera zooming out from the system node the player currently resides in.

sensor module allows to see one hex away, but more powerful can see further.
sensor sweep
have minimap circular and simulate radar + jamming.
sos ping in a far off hex - mission reward
trapped chests and derelict craft or sos ping - trigger pirate jumps


## ship building / modules
modular ship building
have the ship be composed of modules.  bought ships are a prebuilt configuration of modules.  modules are rooms in the ship that connect to each other and crew can walk around in.  use modules to construct the ship.  all ships must have a cockpit module.  each module have a power cost, need enough power generator modules to power the ship. assign crew to a module to increase its stats.

make the ships into 2d grids and built out of modules.  modules become "rooms" in the in person mode of the game.
make the ship grid a 9x9 grid.  resize the ship grid to fit in display.  permanently place the ship class core in the center of the 9x9 grid. Design each ship have a starting module placement. design all ships module placement to follow these design principles: follow a symmetric design, the core is in the center, all other modules are attached from the core.  engine modules have at least 2 backwards pointing and one forward.  weapons point forward.  larger ships have more hull cores.

draw the ship grid with the ship core centered directly over the center pivot point of the ship.  do not draw the ship image or sprite of all ships.  do not draw the ship image or sprite behind the health bars.

for the engine flame/plume and exhaust cloud animations for player ship and all other ships when moving, only draw engine flame/plume and exhaust cloud from thrust modules pointed in the direction the thrust module is pointed.  remove all other engine flame/plume and exhaust cloud.  draw boost as rainbow colored flame and exhaust.

require hull modules to surround around the modules. click on hull modules to change their style from round, concave, diagonal, square.
when module is selected in ship builder, q and e rotate it
place splitter module in front of directed weapon module > splitter
silencer
have irregular shaped modules. make a puzzle out of it.
larger ships have "+" shaped core
make bigger ships have 2+ layers of hull panel
ship collision - ramming module
core modules have max module count limitations - enforce ship classes.
decorative modules
cloaking module
cloaking while stopped passive
when generating ship modules use symmetrical design
force player to build expansion tiles which increasingly add weight.  if you want bigger ship you need bigger reactor and bigger engines.
save and load ship loadouts.

for turret modules draw a second sprite over the module which has the turret, and have it aim towards firing direction.
turret independent firing?
figure out capital ship combat...mock it up.


## ship abilities
abilities are triggered by pressing 1234567890 keys and are assigned in the character window.  show all assigned abilities in a numbered grid UI along the bottom.
when a player creates a character have them pick a starting spell.  have cooldowns for each ability.  abilities are tied to characters, therefore all ships can have abilities.  have the NPC ships use abilities if they have them.

frost nova: a ring of frost shoots out around player ship, anything it touches freezes and stops moving instantly.  have a 2 second thaw timer.
healing nova: a ring of healing shoots out around player ship, anything friendly ships it touches gives a healing over time buff, including the players ship.
Chaff: emit a cloud of chaff behind the player that expands into an area effect, breaking all locks and any missiles that hit the chaff explode.
Quantum brake: instantly stop the players ship to 0 velocity.
seeking fireball
aoe spells: damaging one, healing one, lock in place
shockwave/pushback/defensive tools

status effects, cooldown spells, abilities: grappling hook, tractor beam, super shield, invuln, pushback, emp (disable own shields), lifesteal, swap, jammer, hacker, IR vision can see cloaking


## weapons / combat
have energy weapons damage shields, physical weapons damage armor.  have armor have 'resistance' where high armor can have bullets bounce off, making capital ships hard to kill, requiring armor piercing bullets.  have railgun do piercing damage to all hit ships.
railgun long range like a sniper weapon, but have countermeasures (chaff - radar, flare - IR)
drastically decrease time to kill
melee ships, ramming?
melee ship - no booster but sprint, have move directionally and not conserve momentum, not newtonian physics
have ships have somewhat varied equipment (different weapons) bigger ships have multiple weapons.
have projectiles of bigger ships come out of their weapons, not the front nose
battlecruisers have big super turret guns that rotate, super long range, huge splash damage
loot chests


## missiles / countermeasures
countermeasures, chaff, flare.
dumb missile (rocket) vs IR missile vs radar missile vs radiation missile vs optical vs laser targeted (player steered) missile
make missiles have a cooldown, more missiles require more missile modules
increase missile speed and turning speed
have missiles launch .5 seconds after detaching from ship. have missiles run out of fuel and start drifting to a stop.  if a missile flies near a chaff cloud have it lose lock.
missiles trigger from countdown and give autofire option.  have multiple missile lock.
select targets on radar lock screen, up unto how many radar missiles the FLEET has equipped.
npc ships that have chaff equipped will use it if they have a missile locked onto them and it is about to hit them.
countermeasures key - chaff module leaves behind
fly by wire missile - jammer proof
fly by TV missile
cruise missile - route programmable
all missiles can have different payloads - even nukes
SPACE SUBMARINE AND NUKES
barotrauma but top down?


## radar / stealth
Targeting pod
radar module - simulate radar, make radar ping an ability
RWR module - if hit by radar ping then play a chirp sound and show a general direction of the ping
stealth ships - hull that absorbs radar, slower quieter engines
radar steering
add cloaking.


## economy / world
smuggling, scanning, npc scanner ships, black markets at cantinas
allow pick pocketing (stealth + close range)
wildlife, hunting, pacifist, aggro
demand tribute from planets, take over planets, have player run own faction.  faction war, planet faction flipping
take over planet:
  kill fleet
  bombard
  ground invasion
  give tribute
  raze
  flip sector faction control.  different planets in system can be controlled by different faction.
if a player takes over a planet in a system, they can declare a new faction, and assign it a color.  if player controls a faction they can create their own custom faction ships.  conquer planets through force or diplomacy to earn faction power points.  player faction doing friendly actions to another faction earn faction influence points, which can be spent for favors.
dave the diver style restaurant play
steal everything from rimworld and rimworld mods
feudalist system?  crusader kings system?  dynasties?
procedurally generated planets/landing zones.


## character / RPG
ship captain personalities, have them cuss, be nice, salty, tired sounding, angry, authoritarian, rebel.
captain personality types: timid, aggressive, crazy, aloof, friendly
ship inventory, set crew to man ships.
commandeer derelict ships, have a chance to be damaged and require repairs, but can be a cheap way to get a new ship.
have small amount of faction kill rep gain in all space.


## ship classes / design
make missile boat class, or split up frigate and gunboat
make each ship have focused, unique playstyle
shuttle: carry cargo, run away, turret shoots pursuers, chaff for missiles.  cloak?
make fuel and jumping very expensive.  make fighters unable to jump.  require fighters to dock into mothership.
drone like craft which can vector in any direction, no turning. w is up, a is left, etc.
lock strafe mode - legend of zelda style movement - but need strafe to be snappy no conservation of momentum
if ship can dodge well then make things more bullet-helly with crazy patterns.
contrails
have ship names in different languages (german, etc)


## tiers / progression
organize game difficulty to manage player power ramping as they get better loot
setup pecking order between tier 1,2,3,4,5 ships / characters / items / crafting / tech
wood copper iron steel diamond but in space
tier 1 generally sucks, limited in some way
get that 'nice ass' tier 2 hauler to make more money (or get a good killing ship)
full featured ships and abilities start to synergize - small fleet required
specialization - big fleet
insane mode (death star/etc) - ridiculous
have tier areas that spawn tiered enemies.


## game modes / misc
character mode - when landing switch to 2d side scroller style.
land battles - isometric view with tilt shift effect.  just prototype for now.
moba map on hex map: 2-3 cores, 2-4 lanes, symmetrical waves of mobs spawn on each lane and auto attack on their way to core
multiplayer scenarios: deathmatch, team deathmatch, non-even team scenarios, coop, or just mmo style "safe zones" and "pvp zones"
keybindings, mobile controls support, controller support
PHONE CONTROLS!!!
localization support. remember player set options


## factions / meta
change factions to just color name - placeholder for now
have events spawn: small/medium/large fleet arriving, multiple fleets fighting, merchant fleet arriving, merchant fleet being pursued by pirates, etc.
allow ships that spawn in from events from different factions to attack each other


## misc / aesthetics
vapor wave aesthetic: palm trees, checkerboard, statues, neon
find out complete data structure, build a wiki, document, find out names of data structures to avoid confusion
select text, hold space, voice command, query this code with voice command query, save tokens
