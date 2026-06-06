'use strict';
// Headless loader for the game's DOM-free modules.
// The game is vanilla browser JS (no build, no modules) that attaches everything
// to window.G. We shim the few browser globals the load path touches, then eval
// each script into this Node context so bareword `G` resolves to global.G.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// A canvas/ctx that swallows every call — nothing under test draws, but some
// modules may grab a context at class-def time on other branches.
function canvasStub() {
  const ctx = new Proxy({}, { get: () => () => {} });
  return {
    width: 0, height: 0,
    getContext: () => ctx,
    addEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  };
}

global.window = global;
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => canvasStub(),
  addEventListener() {},
  body: { appendChild() {} },
};
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.addEventListener = () => {};
if (!global.performance) {
  global.performance = { now: () => Number(process.hrtime.bigint()) / 1e6 };
}
global.localStorage = {
  _d: {},
  getItem(k) { return k in this._d ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = '' + v; },
  removeItem(k) { delete this._d[k]; },
};

const JS_DIR = path.resolve(__dirname, '../js');

function load(file) {
  const code = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
  vm.runInThisContext(code, { filename: file });
}

// Subset of index.html load order that runs without a real DOM/canvas/audio.
// data.js MUST be first (creates window.G); utils.js depends on data (galaxy IIFE).
const DEFAULT_FILES = ['data.js', 'utils.js', 'particles.js', 'ship.js', 'space.js', 'economy.js'];

function loadGame(files = DEFAULT_FILES) {
  for (const f of files) load(f);
  return global.G;
}

module.exports = { loadGame, load, DEFAULT_FILES };
