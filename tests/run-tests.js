#!/usr/bin/env node
'use strict';
/*
 * Tests for Tiny Merchant Profit.
 * Zero dependencies: reads index.html, extracts the inline app script,
 * evaluates it in a sandbox, and unit-tests the pure vendor math
 * (shift totals, hourly pace, CSV export).
 *
 * Run:  node tests/run-tests.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const match = html.match(/<script id="app">([\s\S]*?)<\/script>/);
if (!match) {
  console.error('FAIL: could not find <script id="app"> in index.html');
  process.exit(1);
}

const sandbox = { window: {}, localStorage: undefined };
vm.createContext(sandbox);
vm.runInContext(match[1], sandbox, { filename: 'index.html#app' });

const App = sandbox.window.App;
if (!App || typeof App.computeTotals !== 'function') {
  console.error('FAIL: window.App with pure logic was not exposed by the script');
  process.exit(1);
}

let passed = 0;
let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log('ok   ' + name);
  } else {
    failed += 1;
    console.log('FAIL ' + name + (detail !== undefined ? ' — ' + detail : ''));
  }
}

function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, 'got ' + a + ', expected ' + e);
}

// --- Shift totals -----------------------------------------------------------

const t0 = App.computeTotals([]);
eq('totals: empty shift', t0, { grossSales: 0, cash: 0, card: 0, refunds: 0, cogs: 0, netProfit: 0, saleCount: 0, refundCount: 0 });

const shift = [
  { ts: '2026-11-03T10:05', desc: 'Cutting board', method: 'cash', kind: 'sale', amount: 4500, cogs: 1500 },
  { ts: '2026-11-03T10:40', desc: 'Mug + coaster', method: 'card', kind: 'sale', amount: 2400, cogs: 800 },
  { ts: '2026-11-03T11:15', desc: 'Card change fee mixup', method: 'card', kind: 'refund', amount: 1200, cogs: 0 },
  { ts: '2026-11-03T11:30', desc: 'Quilt', method: 'cash', kind: 'sale', amount: 12000, cogs: 4000 },
  { ts: '2026-11-03T11:45', desc: 'Quilt refund', method: 'cash', kind: 'refund', amount: 12000, cogs: 0 }
];
const ts0 = App.computeTotals(shift);
check('totals: all returned together', ts0 && typeof ts0 === 'object' && 'netProfit' in ts0);
eq('totals: gross sales (refunds excluded)', ts0.grossSales, 18900);
eq('totals: cash = sales minus cash refunds', ts0.cash, 4500);
eq('totals: card = sales minus card refunds', ts0.card, 1200);
eq('totals: refunds sum', ts0.refunds, 13200);
eq('totals: COGS from sales only', ts0.cogs, 6300);
eq('totals: net profit = gross - COGS - refunds', ts0.netProfit, 18900 - 6300 - 13200);
eq('totals: sale/refund counts', [ts0.saleCount, ts0.refundCount], [3, 2]);

const floats = App.computeTotals([
  { ts: '2026-11-03T10:00', method: 'cash', kind: 'sale', amount: 1999, cogs: 333 },
  { ts: '2026-11-03T10:01', method: 'cash', kind: 'sale', amount: 501, cogs: 167 }
]);
eq('totals: integer cents avoid float drift', [floats.cogs, floats.netProfit], [500, 2000]);

const neg = App.computeTotals([{ ts: '2026-11-03T10:00', method: 'card', kind: 'refund', amount: 500, cogs: 0 }]);
eq('totals: refund-only shift can go negative', neg.netProfit, -500);
eq('totals: refund pulls card below zero', neg.card, -500);

// --- Hourly pace ------------------------------------------------------------

const pace = App.hourlyPace(shift, 9, 12);
eq('pace: one bucket per open hour', pace.map(function (b) { return b.hour; }), [9, 10, 11]);
eq('pace: net per bucket (11a is sale minus both refunds)', pace.map(function (b) { return b.net; }), [0, 6900, -1200]);
eq('pace: entry counts', pace.map(function (b) { return b.count; }), [0, 2, 3]);
eq('pace: refund-only bucket net', pace[2].refunds, 13200);

const outside = App.hourlyPace([
  { ts: '2026-11-03T07:30', desc: 'early hug', method: 'cash', kind: 'sale', amount: 1000, cogs: 0 },
  { ts: '2026-11-03T09:15', desc: 'In range', method: 'cash', kind: 'sale', amount: 2000, cogs: 0 }
], 9, 11);
eq('pace: entries outside open hours are not bucketed', outside.map(function (b) { return b.net; }), [2000, 0]);

const order = App.hourlyPace(shift.slice().reverse(), 9, 12);
eq('pace: bucket order unaffected by entry order', order.map(function (b) { return b.hour; }), [9, 10, 11]);

// --- CSV --------------------------------------------------------------------

eq('csvEscape: plain field untouched', App.csvEscape('Cutting board'), 'Cutting board');
eq('csvEscape: comma gets quoted', App.csvEscape('Mug, large'), '"Mug, large"');
eq('csvEscape: quote doubles inside quotes', App.csvEscape('4" bowl'), '"4"" bowl"');
eq('csvEscape: newline gets quoted', App.csvEscape('two\nlines'), '"two\nlines"');
eq('csvEscape: null/undefined become empty', [App.csvEscape(null), App.csvEscape(undefined)], ['', '']);
eq('csvRow: joins with commas', App.csvRow(['a', 'b,c', 'd']), 'a,"b,c",d');

const csvOne = App.buildCSV(
  [{ date: '2026-11-03', entries: shift }],
  'Birch & Twine Co.',
  '2026-11-03 21:04:11'
);
const lines = csvOne.split('\r\n');
check('csv: CRLF line endings with blank-line separators', csvOne.endsWith('\r\n') && csvOne.includes('\r\n\r\n'));

check('csv: header line present', lines[0] === 'Tiny Merchant Profit - Vendor Math CSV', lines[0]);
check('csv: vendor credited', lines.some(function (l) { return l === 'Vendor,Birch & Twine Co.'; }));
check('csv: column header present', lines.includes('Date,Time,Description,Method,Type,Gross Amount,Cost Of Goods,Net Contribution,Running Profit'));
check('csv: sale row values', lines.includes('2026-11-03,10:05,Cutting board,cash,SALE,45.00,15.00,30.00,30.00'), lines.join('|'));
check('csv: card sale row', lines.includes('2026-11-03,10:40,Mug + coaster,card,SALE,24.00,8.00,16.00,46.00'));
check('csv: refund row is negative contribution', lines.includes('2026-11-03,11:15,Card change fee mixup,card,REFUND,-12.00,0.00,-12.00,34.00'));
check('csv: final refund row lands running profit at -6.00', lines.includes('2026-11-03,11:45,Quilt refund,cash,REFUND,-120.00,0.00,-120.00,-6.00'));
check('csv: peak running profit at fourth sale', lines.includes('2026-11-03,11:30,Quilt,cash,SALE,120.00,40.00,80.00,114.00'));
check('csv: summary net profit for the day', lines.includes('Net Profit,2026-11-03,-6.00'), lines.filter(function (l) { return l.startsWith('Net Profit'); }).join('|'));
check('csv: day cash summary', lines.includes('Cash Sales,2026-11-03,45.00'));
check('csv: day card summary', lines.includes('Card Sales,2026-11-03,12.00'));
check('csv: refund summary', lines.includes('Refunds,2026-11-03,132.00'));
check('csv: revenue line uses gross minus refunds', lines.includes('"Revenue (gross sales minus refunds), all days",57.00'));
check('csv: net profit grand total', lines.includes('"Net Profit (after cost of goods), all days",-6.00'));
check('csv: days-with-entries counted', lines.includes('Shift Days With Entries,1'));
check('csv: not-tax-advice note present', lines.some(function (l) { return l.startsWith('Note,') && l.includes('not tax advice'); }));

const csvTwo = App.buildCSV([
  { date: '2026-11-01', entries: [{ ts: '2026-11-01T09:30', desc: 'Candle', method: 'cash', kind: 'sale', amount: 1800, cogs: 600 }] },
  { date: '2026-11-03', entries: shift }
], 'Birch & Twine Co.', '2026-11-03 21:04:11');
const rows2 = csvTwo.split('\r\n');
check('csv multi-day: both dates present', rows2.filter(function (l) { return l.startsWith('2026-11-'); }).length >= 6);
check('csv multi-day: running profit carries across days', rows2.includes('2026-11-01,09:30,Candle,cash,SALE,18.00,6.00,12.00,12.00'));
eq('csv multi-day: days with entries', rows2.filter(function (l) { return l === 'Shift Days With Entries,2'; }).length, 1);
eq('csv multi-day: grand revenue', rows2.filter(function (l) { return l === '"Revenue (gross sales minus refunds), all days",75.00'; }).length, 1);

const csvInline = App.buildCSV([
  { date: '2026-11-03', entries: [{ ts: '2026-11-03T10:00', desc: 'Bowl, 5" wide, "seconds"', method: 'cash', kind: 'sale', amount: 1000, cogs: 0 }] }
], '', '2026-11-03 09:00:00');
check('csv escaping: quoted description round-trips', csvInline.includes('"Bowl, 5"" wide, ""seconds"""'), csvInline.split('\r\n').find(function (l) { return l.indexOf('Bowl') !== -1; }));

const csvEmpty = App.buildCSV([{ date: '2026-11-03', entries: [] }], 'x', 't');
check('csv: empty day yields headers and zero summaries', csvEmpty.includes('Net Profit,2026-11-03,0.00') && csvEmpty.endsWith('\r\n'));

// --- Money helpers ----------------------------------------------------------

eq('moneyToCents: dollars to cents', [App.moneyToCents('12.5'), App.moneyToCents('$1,240.99'), App.moneyToCents(3)], [1250, 124099, 300]);
eq('moneyToCents: garbage is null', [App.moneyToCents('abc'), App.moneyToCents(''), App.moneyToCents(null)], [null, null, null]);
eq('centsToMoney: formatting and sign', [App.centsToMoney(124099, '$'), App.centsToMoney(-105, '$'), App.centsToMoney(5, '$')], ['$1240.99', '-$1.05', '$0.05']);

// ----------------------------------------------------------------------------

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
