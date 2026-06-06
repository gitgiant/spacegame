'use strict';
// Performance / regression benchmarks for the hot paths that run every frame:
// collision, RNG, angle math, particle simulation, target collection, and the
// (heavy, once-per-jump) local-system generator.
//
// Budgets are SOFT floors — they print "SLOW" but don't fail the suite, since
// ops/sec is hardware-dependent. They exist to flag gross regressions (e.g.
// someone reintroducing Math.hypot or per-frame allocations in a hot loop).
const { group, bench, timeAvg } = require('./tlib');

module.exports = function runPerf(G) {
  group('perf — per-frame primitives');

  // circleHit is THE collision primitive: called O(projectiles × entities)/frame.
  let acc = 0;
  bench('circleHit', (i) => {
    if (G.circleHit(i & 1023, i & 511, 4, (i * 7) & 1023, (i * 3) & 511, 16)) acc++;
  }, 5_000_000, 30_000_000);

  const rng = G.seededRng('perf');
  bench('seededRng()', () => { acc += rng(); }, 5_000_000, 10_000_000);

  // Realistic in-game range: turn diffs land within a few radians of 0.
  // (wrapAngle is a while-subtraction loop — O(input magnitude) — so feeding it
  //  huge angles would loop forever. In-game inputs stay small, which is the
  //  case worth measuring.)
  bench('wrapAngle (in-range)', (i) => { acc += G.wrapAngle(((i & 31) - 16) * 0.4); }, 2_000_000, 5_000_000);

  bench('v2.dist', (i) => {
    acc += G.v2.dist({ x: i & 1023, y: i & 511 }, { x: (i * 3) & 1023, y: (i * 7) & 511 });
  }, 3_000_000, 10_000_000);

  group('perf — particle system (1000 particles)');

  // Simulate a heavy combat frame: maintain ~1000 live particles and step them.
  const P = new G.Particles();
  for (let i = 0; i < 1000; i++) P.emit({ x: i, y: i, life: 100, minSpd: 10, maxSpd: 60 });
  timeAvg('Particles.update × 1000', () => {
    // re-top-up so count stays ~constant across calls
    while (P.active.length < 1000) P.emit({ x: 0, y: 0, life: 100 });
    P.update(1 / 60);
  }, 300, 0.5);

  group('perf — target collection');

  // allTargets runs every frame (player update + minimap + targeting UI).
  // Watch this number: spreading filtered arrays here was ~6 allocs/call.
  const bigSpace = {
    enemies: Array.from({ length: 120 }, (_, i) => ({ x: i, y: i, dead: i % 9 === 0 })),
    npcs: Array.from({ length: 80 }, (_, i) => ({ x: i, y: i })),
    fleetShips: Array.from({ length: 6 }, (_, i) => ({ x: i, y: i })),
    derelicts: Array.from({ length: 20 }, (_, i) => ({ x: i, y: i, looted: i % 4 === 0 })),
    turrets: Array.from({ length: 12 }, (_, i) => ({ x: i, y: i })),
  };
  const allTargets = G.Space.prototype.allTargets;
  bench('allTargets (238 entities)', () => { acc += allTargets.call(bigSpace).length; }, 500_000, 200_000);

  group('perf — world generation (per jump)');

  // generateLocalSystem rebuilds a whole system on each hyperspace jump.
  // It's not per-frame, but a spike here = a hitch on every jump.
  const sys = G.SYSTEMS[0];
  try {
    timeAvg('generateLocalSystem', () => { G.generateLocalSystem(sys); }, 200, 8);
  } catch (e) {
    process.stdout.write(`  generateLocalSystem skipped (needs more browser shims): ${e.message}\n`);
  }

  // keep `acc` observable so the JIT can't dead-code-eliminate the loops
  if (acc === Math.PI) process.stdout.write('');
};
