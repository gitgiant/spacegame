'use strict';
// Tiny zero-dependency test + benchmark library.
const C = { red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m', rst: '\x1b[0m' };

let pass = 0, fail = 0;
const fails = [];
const benches = [];

function group(name) { process.stdout.write(`\n${C.bold}${name}${C.rst}\n`); }

function test(name, fn) {
  try {
    fn();
    pass++;
    process.stdout.write(`  ${C.grn}✓${C.rst} ${name}\n`);
  } catch (e) {
    fail++;
    fails.push({ name, message: e.message });
    process.stdout.write(`  ${C.red}✗ ${name}${C.rst} — ${e.message}\n`);
  }
}

// ── Assertions ────────────────────────────────────────────
function ok(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy'); }
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg ? msg + ': ' : ''}expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function approx(a, b, eps = 1e-9, msg) {
  if (Math.abs(a - b) > eps) throw new Error(`${msg ? msg + ': ' : ''}expected ~${b}, got ${a}`);
}
function inRange(v, lo, hi, msg) {
  if (typeof v !== 'number' || Number.isNaN(v) || v < lo || v > hi)
    throw new Error(`${msg ? msg + ': ' : ''}${v} not in [${lo}, ${hi}]`);
}
function throws(fn, msg) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg || 'expected function to throw');
}

// ── Benchmark ─────────────────────────────────────────────
// Runs fn iters times (after a warmup), reports ns/op + ops/sec.
// budgetOps (optional): soft floor — prints a warning if slower, but does NOT
// fail the suite (hardware-dependent). For catching gross perf regressions.
function bench(name, fn, iters, budgetOps) {
  // warmup
  for (let i = 0; i < Math.min(iters, 10000); i++) fn(i);
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) fn(i);
  const ms = performance.now() - t0;
  const opsPerSec = iters / (ms / 1000);
  const nsPerOp = (ms * 1e6) / iters;
  const slow = budgetOps && opsPerSec < budgetOps;
  const tag = slow ? `${C.yel}SLOW${C.rst}` : `${C.dim}ok${C.rst}`;
  process.stdout.write(
    `  ${name.padEnd(34)} ${fmtNum(opsPerSec).padStart(14)} ops/s  ${nsPerOp.toFixed(1).padStart(9)} ns/op  ${tag}` +
    (budgetOps ? ` ${C.dim}(floor ${fmtNum(budgetOps)})${C.rst}` : '') + '\n'
  );
  benches.push({ name, opsPerSec, nsPerOp, ms, slow });
  return { opsPerSec, nsPerOp, ms };
}

// Measure wall time of a single (heavy) call, averaged over `runs`.
function timeAvg(name, fn, runs = 1, budgetMs) {
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) fn(i);
  const ms = (performance.now() - t0) / runs;
  const slow = budgetMs && ms > budgetMs;
  const tag = slow ? `${C.yel}SLOW${C.rst}` : `${C.dim}ok${C.rst}`;
  process.stdout.write(`  ${name.padEnd(34)} ${ms.toFixed(3).padStart(10)} ms/call  ${tag}` +
    (budgetMs ? ` ${C.dim}(budget ${budgetMs}ms)${C.rst}` : '') + '\n');
  benches.push({ name, ms, slow });
  return { ms };
}

function fmtNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function report() {
  process.stdout.write(`\n${C.bold}── Summary ──${C.rst}\n`);
  process.stdout.write(`  ${C.grn}${pass} passed${C.rst}, ${fail ? C.red : C.dim}${fail} failed${C.rst}\n`);
  const slowB = benches.filter(b => b.slow);
  if (slowB.length) {
    process.stdout.write(`  ${C.yel}${slowB.length} benchmark(s) under budget:${C.rst} ${slowB.map(b => b.name).join(', ')}\n`);
  }
  if (fails.length) {
    process.stdout.write(`\n${C.red}Failures:${C.rst}\n`);
    for (const f of fails) process.stdout.write(`  - ${f.name}: ${f.message}\n`);
  }
  return fail;
}

module.exports = { group, test, ok, eq, approx, inRange, throws, bench, timeAvg, report };
