#!/usr/bin/env node
'use strict';
/*
 * DOM smoke test for Tiny Merchant Profit.
 * Runs the inline app script from index.html against a minimal fake DOM
 * (no dependencies) and simulates a vendor's shift end to end:
 * add sales, a refund, switch day, delete, export CSV.
 *
 * Run:  node tests/smoke-dom.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const match = html.match(/<script id="app">([\s\S]*?)<\/script>/);
if (!match) { console.error('FAIL: no <script id="app"> block'); process.exit(1); }

let failed = 0;
let totalChecks = 0;
function check(name, cond, detail) {
  totalChecks += 1;
  if (cond) console.log('ok   ' + name);
  else { failed += 1; console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : '')); }
}
function eq(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), 'got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
}

function makeEl(id) {
  const listeners = {};
  const attrs = {};
  const el = {
    id: id || '', children: [],
    value: '', textContent: '', title: '',
    className: '', type: '', disabled: false, href: '', download: '',
    style: {},
    classList: {
      add: function (c) { attrs['__cl__' + c] = true; },
      remove: function (c) { delete attrs['__cl__' + c]; },
      toggle: function (c, force) { if (force === true || (force === undefined && !attrs['__cl__' + c])) { attrs['__cl__' + c] = true; } else { delete attrs['__cl__' + c]; } },
      contains: function (c) { return !!attrs['__cl__' + c]; }
    },
    setAttribute: function (k, v) { attrs[k] = String(v); },
    getAttribute: function (k) { return attrs[k] === undefined ? null : attrs[k]; },
    appendChild: function (c) { el.children.push(c); return c; },
    removeChild: function (c) { const i = el.children.indexOf(c); if (i !== -1) el.children.splice(i, 1); return c; },
    addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    focus: function () {},
    fire: function (t, ev) { (listeners[t] || []).forEach(function (fn) { fn(ev); }); }
  };
  Object.defineProperty(el, 'click', { value: function () { (listeners.click || []).forEach(function (fn) { fn({}); }); } });
  let inner = '';
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return inner; },
    set: function (v) { inner = String(v); el.children.length = 0; }
  });
  return el;
}

const elements = {};
const byId = function (id) {
  if (!elements[id]) elements[id] = makeEl(id);
  return elements[id];
};

const storage = {};
const fakeDoc = {
  getElementById: byId,
  createElement: function (tag) { return makeEl(''); },
  body: makeEl('body'),
  addEventListener: function () {}
};

let lastBlob = null;
const sandbox = {
  window: {},
  document: fakeDoc,
  setTimeout: function (fn) { if (typeof fn === 'function') fn(); },
  Blob: function (parts, opts) { lastBlob = { parts: parts, opts: opts }; return { size: (parts[0] || '').length }; },
  URL: { createObjectURL: function () { return 'blob:fake'; }, revokeObjectURL: function () {} },
  console: console
};
sandbox.window.confirm = function () { return true; };
sandbox.window.localStorage = {
  getItem: function (k) { return storage[k] === undefined ? null : storage[k]; },
  setItem: function (k, v) { storage[k] = String(v); },
  removeItem: function (k) { delete storage[k]; }
};
sandbox.window.App = undefined;
vm.createContext(sandbox);

try {
  vm.runInContext(match[1], sandbox, { filename: 'index.html#app' });
  check('smoke: app script runs against the fake DOM without throwing', true);
} catch (err) {
  check('smoke: app script runs against the fake DOM without throwing', false, err.stack);
}

const App = sandbox.window.App;
check('smoke: pure logic still exposed on window.App', !!App && typeof App.computeTotals === 'function');

const amounts = {
  gross: byId('gross'), cash: byId('cash'), card: byId('card'),
  refunds: byId('refunds'), cogs: byId('cogs'), net: byId('netProfit')
};

check('smoke: renders empty totals on load', amounts.gross.textContent === '$0.00' && amounts.net.textContent === '$0.00',
  'gross=' + amounts.gross.textContent + ' net=' + amounts.net.textContent);
check('smoke: pace buckets render for default 9a-5p shift', byId('pace').children.length === 8, String(byId('pace').children.length));

function submitEntry(desc, amount, cogs, method) {
  byId('desc').value = desc;
  byId('amount').value = amount;
  byId('cogs').value = cogs;
  byId('time').value = '10:0' + (byId('ledgerBody').children.length % 10);
  if (method) byId('btn' + (method === 'card' ? 'Card' : 'Cash')).fire('click', {});
  byId('entryForm').fire('submit', { preventDefault: function () {} });
}

submitEntry('Cutting board', '12.50', '4.00', 'cash');
check('smoke: sale added — running net shows $8.50', amounts.net.textContent === '$8.50', amounts.net.textContent);
check('smoke: form must actually add entries to the ledger table', byId('ledgerBody').children.length === 1);

eq('smoke: settings + ledger persisted to localStorage', JSON.parse(storage['tmp.ledger.v1'])['2026-11-03'].length, 1);

byId('btnCard').fire('click', {});
submitEntry('Mug, large', '6.25', '2.00', 'card');
check('smoke: card sale tracks card total', amounts.card.textContent === '$6.25', amounts.card.textContent);

byId('btnRefund').fire('click', {});
check('smoke: refund mode relabels form', byId('formTitle').textContent === 'Record a refund', byId('formTitle').textContent);
byId('btnCash').fire('click', {});
submitEntry('Wrong size sweater', '9.00', '', 'cash');
check('smoke: refund subtracts from net ($8.50+$4.25-$9.00 = $3.75)', amounts.net.textContent === '$3.75', amounts.net.textContent);
check('smoke: refund row appears in ledger', byId('ledgerBody').children.length === 3);

let downloads = 0;
const origBlob = sandbox.Blob;
byId('btnCsvAll').fire('click', {});
check('smoke: export-every-day builds CSV download', lastBlob && lastBlob.parts.length > 0 && lastBlob.parts[0].length > 200, lastBlob ? String(lastBlob.parts[0].length) : 'no blob');
check('smoke: CSV covers all three entries', (lastBlob.parts[0] || '').includes('Cutting board') && (lastBlob.parts[0] || '').includes('Wrong size sweater'));

byId('btnRefund').fire('click', {});
byId('day').value = '2026-11-01';
byId('day').fire('change', {});
check('smoke: switching day shows empty ledger', byId('ledgerBody').children.length === 0 && amounts.net.textContent === '$0.00', amounts.net.textContent);

byId('day').value = '2026-11-03';
byId('day').fire('change', {});
check('smoke: switching back restores entries', byId('ledgerBody').children.length === 3, String(byId('ledgerBody').children.length));

const firstRowDel = byId('ledgerBody').children[0].children[6].children[0];
check('smoke: ledger row has a delete button', !!firstRowDel && typeof firstRowDel.click === 'function');
firstRowDel.click();
check('smoke: delete removes the entry and re-renders totals (4.25 - 9.00)', byId('ledgerBody').children.length === 2 && amounts.net.textContent === '-$4.75', amounts.net.textContent);

byId('btnClear').fire('click', {});
eq('smoke: clear-day empties the day in storage', JSON.parse(storage['tmp.ledger.v1'])['2026-11-03'].length, 0);

console.log('\n' + totalChecks + ' checks run, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
