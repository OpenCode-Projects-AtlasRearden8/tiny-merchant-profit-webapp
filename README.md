# Tiny Merchant Profit 🧾

A one-page, offline point-of-day ledger for craft-fair and market vendors. Open it, sell things, watch your running profit line grow, and export a clean "vendor math" CSV when tax season rolls around.

Made by [Asdale Dynamics, LLC](https://dylanasdale.github.io) — Dylan Asdale's beginner-friendly AI and small-business tool shop. Like everything from the LLC, it is plain-English, local-first, and tested. It is deliberately distinct from the [craft-fair handbook](https://github.com/dylanasdale) side of things: the handbook helps you *plan* a season; this app is the ledger you keep **at the table, on the day itself**.

## Why this exists

At a market you don't want software. You want four numbers:

1. How much did I sell today?
2. How much came in cash vs. card?
3. What did those goods cost me to make?
4. Am I actually ahead — right now, not next week?

Tiny Merchant Profit answers all four on one page, with hourly pace bars so you can see if the afternoon slump is real or imagined.

## Quick start

No install, no build, no account, no internet needed.

1. Download or clone this folder.
2. Double-click **`index.html`** — it opens straight from `file://` in any modern browser.
3. Set your vendor name, currency symbol, and shift hours (top card).
4. Log each sale as it happens: pick cash or card, type the amount, and (optionally) what the item cost you. Take a return? Hit **↩ Refund instead**.

Everything is saved in your browser's `localStorage` on your device only. Close the tab, lose the Wi-Fi, restart the laptop — your day is still there.

## What it tracks

- **Running shift P&L** — a big net-profit line that updates with every entry.
- **Today's sales** split into **cash** and **card**, with **refunds** shown separately and subtracted.
- **Cost of goods** — the amount you type per item (materials, packaging, sourcing cost).
- **Hourly pace bars** — one bar per open hour; taller = better hour. Hover a bar for the cash/card/refund breakdown of that hour.
- **A per-entry ledger** — timestamps (editable, for back-filling a rush), running profit per row, one-tap delete for fat-finger entries.
- **Multiple days** — each calendar day keeps its own ledger; the date picker revisits previous days.

## The math (in plain English)

- `Net profit = gross sales − cost of goods − refunds`
- Refunds are subtracted from the payment method they were refunded to, so your cash box and card totals stay honest.
- All money is stored in integer cents internally, so totals never drift by a stray penny.
- Refunded items don't count toward cost of goods — you got the stock back.

## Exporting for tax season

Two buttons at the bottom of the page:

- **Export this day** — `vendor-math-YYYY-MM-DD.csv`
- **Export every day** — `vendor-math-all-days.csv`, every stored day in one file

The CSV ("vendor math") contains:

- One row per entry: date, time, description, method, sale/refund, gross amount, cost of goods, net contribution, running profit.
- Per-day summaries: gross sales, cash sales, card sales, refunds, cost of goods, net profit.
- Grand totals across all days, including *revenue (gross sales minus refunds)* — the number most vendors report.
- A plain-English note that these are vendor-entered records, not tax advice.

The file opens cleanly in Excel, Google Sheets, or Numbers (proper comma/quote escaping, CRLF line endings).

## Privacy

There is none to worry about: no servers, no accounts, no analytics, no network requests after the file loads. Your numbers live in `localStorage` on that one device. Clearing browser data clears the ledger, so export before you clear.

## Testing

Zero dependencies. Plain Node, no install required:

```sh
npm test          # or:
node tests/run-tests.js    # 50 unit checks: shift totals, hourly pace, CSV escaping and content
node tests/smoke-dom.js    # 18 checks: simulates a full shift against a fake DOM (add, refund, switch day, delete, export)
```

All 68 checks pass on Node 20.

## Project layout

```
index.html          The whole app — HTML, CSS, and JS in one file
tests/run-tests.js  Unit tests for the pure vendor-math logic
tests/smoke-dom.js  End-to-end-style smoke test with a minimal fake DOM
STATUS.md           What is verified, and known gaps
LICENSE             MIT — Copyright (c) 2026 Asdale Dynamics, LLC
```

The app exposes its pure logic on `window.App` (`computeTotals`, `hourlyPace`, `buildCSV`, `csvEscape`, money helpers), which is exactly what the tests exercise.

## Compat & limits

- Works from `file://` in current Chrome, Edge, Firefox, and Safari. No build step, no CDN, no dependency anywhere.
- `localStorage` is per browser per device: data does not sync between laptop and phone (export the CSV to move numbers across).
- Very long shifts past midnight: log them as two separate days.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Asdale Dynamics, LLC.
