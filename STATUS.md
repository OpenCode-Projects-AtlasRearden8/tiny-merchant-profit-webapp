# STATUS — Tiny Merchant Profit

Last updated: 2026-11-03

## What was built

A single-file, offline point-of-day ledger for craft-fair and market vendors, per the original goal:

- `index.html` — the complete app (HTML + CSS + JS inline, zero external resources). Opens straight from `file://`; no build step, no server, no dependencies, no network access after load.
- **Running shift P&L**: one big net-profit line updated by every entry, plus stat cards for gross sales, cash, card, refunds, cost of goods, and net profit.
- **Entry form**: description, amount, cash/card toggle, cost-of-goods field, editable time (for back-filling rushes), and a "↩ Refund instead" mode. Refunds subtract from the payment method they were taken on; refunded COGS is not charged (stock came back).
- **Hourly pace bars**: one bar per open hour (vendor-configurable opens/closes), net sales per hour, hover for per-hour breakdown including refunds.
- **Per-day ledgers**: each calendar date keeps its own entries in `localStorage`; date picker to revisit prior days; per-entry delete; clear-day with confirmation.
- **Vendor-math CSV export**: export just the current day or every stored day. Entry rows plus per-day summaries (gross sales, cash, card, refunds, COGS, net profit), grand totals including "Revenue (gross sales minus refunds)", a days-with-entries count, and a not-tax-advice note. Proper CSV escaping (commas, quotes, newlines), CRLF line endings, opens in Excel/Sheets/Numbers.
- **Money math in integer cents** end to end, so totals never float-drift.

Deliberate identity: this is the **point-of-day ledger**, distinct from the craft-fair *planning* handbook — one page you keep open at the stall, not season planning.

## How to run it

- Open `index.html` by double-clicking it (or any `file://` path) in a modern browser. That's it.
- Data persists in the browser's `localStorage` on the device where you opened it. Nothing leaves the device.

## How to verify (tests)

Zero dependencies; plain Node (built and verified on Node 20.19.2):

```sh
node tests/run-tests.js    # 50 unit checks — shift totals, hourly pace, CSV escaping/content, money helpers
node tests/smoke-dom.js    # 18 checks  — full simulated shift against a fake DOM: add sale, card sale, refund,
                           #               persistence, day switch, delete, clear-day, CSV export
npm test                   # runs both
```

## Verification results (this session)

- `node tests/run-tests.js` → **50 passed, 0 failed**
- `node tests/smoke-dom.js` → **18 checks run, 0 failed**
- Inline app script passes `node --check` (syntax validated).
- The pure logic is exposed as `window.App` (`computeTotals`, `hourlyPace`, `buildCSV`, `csvEscape`, money helpers) and is exactly what the tests exercise; the script self-detects "no document" so the same block runs in Node and in the browser.
- All earlier failures found during development (wrong test expectations for a net-negative pace bucket, blank CSV separator lines, fake-DOM `innerHTML` clearing, `setTimeout` in the sandbox) were fixed; every issue listed was either an app improvement or a corrected test, and the suite is green end to end.

## Files

```
index.html          the whole app
tests/run-tests.js  unit tests (pure vendor math)
tests/smoke-dom.js  DOM-path smoke test with a minimal fake DOM
tests/              (test runner needs only Node, reads index.html directly)
package.json        convenience script: `npm test` (no dependencies)
README.md           usage, math explained in plain English, credits
LICENSE             MIT — Copyright (c) 2026 Asdale Dynamics, LLC
STATUS.md           this file
```

## Known gaps / future ideas

- **No device sync**: `localStorage` is per browser per device. Move days between devices via the CSV export. Cross-device sync (e.g., export/import JSON) is not implemented.
- **No native app / PWA install metadata**: it runs fine from `file://`, but there is no service worker (impossible from `file://`) or manifest.
- **Sites/events and multi-item carts**: one entry = one amount. No per-line-item receipts, quantities, or per-item SKU list.
- **No sales-tax splitting**: amounts are logged as charged; no tax-out math.
- **COGS is per-entry (typed)**, not drawn from an inventory price list.
- **Bar labels are visual/A11Y-lite**: pace bars use `title` tooltips; a screen-reader table view of per-hour numbers would improve accessibility.
- **Shifts after midnight**: log late-night markets as two separate days.
- Denominations/float (start-of-shift cash box) is deliberately omitted to keep the one-page focus; the math assumes you reconcile the float yourself.

## Privacy / safety

No secrets, keys, or personal data in any file. No network calls, analytics, or accounts. The app stores vendor-entered figures only, on-device.
