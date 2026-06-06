'use strict';
// Test entry point.  Run: node tests/run.js  [--unit | --perf]
const { loadGame } = require('./harness');
const { report } = require('./tlib');

const G = loadGame();

const onlyUnit = process.argv.includes('--unit');
const onlyPerf = process.argv.includes('--perf');
const runAll = !onlyUnit && !onlyPerf;

process.stdout.write('\x1b[1mSPACEGAME test suite\x1b[0m\n');

if (runAll || onlyUnit) require('./unit.test')(G);
if (runAll || onlyPerf) require('./perf.test')(G);

const failed = report();
process.exit(failed ? 1 : 0);
