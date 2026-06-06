# Tests

Headless test + benchmark suite for the DOM-free game logic. No framework, no
deps — plain Node. The game is browser JS attached to `window.G`; the harness
shims the few browser globals and `vm`-evals the relevant scripts so `G` is
available in Node.

## Run

```bash
node tests/run.js          # everything
node tests/run.js --unit   # correctness only
node tests/run.js --perf   # benchmarks only
```

Exit code is non-zero if any unit test fails (CI-friendly). Benchmark budgets
are **soft** — they print `SLOW` but never fail the suite (ops/sec is
hardware-dependent); they exist to catch gross regressions.

## Files

| File | Purpose |
|---|---|
| `harness.js` | Browser-global shims + script loader. `loadGame()` returns `G`. |
| `tlib.js` | Tiny assertion lib (`eq`/`ok`/`approx`/`inRange`) + `bench`/`timeAvg`. |
| `unit.test.js` | Correctness: math utils, **static-data integrity**, particle lifecycle, targeting. |
| `perf.test.js` | Benchmarks for per-frame hot paths + per-jump world gen. |
| `run.js` | Entry point. |

## Coverage

Only modules that load without a real DOM/canvas/audio are exercised:
`data.js`, `utils.js`, `particles.js`, `space.js`, `economy.js`. Classes that
need the DOM at construction time (`Input`, `UI`, `Renderer`, `Game`,
`SoundEngine`) are out of scope here — for those, drive the game in a browser.

`space.js` methods are tested by invoking them via `G.Space.prototype.<m>.call(fake)`
so we skip the heavy constructor.

## Notes found while writing these

- **Data bug fixed:** recipe `ra2` crafted a non-existent `grenades` item; the
  `shotgun_shells` ammo (scatter cannon) had no recipe. `ra2` now crafts
  `shotgun_shells`. The `RECIPES reference real items/modules` test guards this.
- `wrapAngle` is a `while`-subtraction loop, so it's O(input magnitude). Fine
  for in-game angles (always small); don't feed it huge values.
