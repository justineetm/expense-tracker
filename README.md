# PeraLog

> Lightning-fast, offline-first expense tracking for bulk logging.

**Live App:** https://justineetm.github.io/expense-tracker/

PeraLog is a mobile-first Progressive Web App built for zero-friction daily logging. Log a whole grocery receipt as one total, tap a repeat purchase in one tap, and see where your money goes — even with no connection.

## Core Philosophy

* **Speed first:** One-tap Quick-Add for repeats, collapsible Add form, instant list + chart + totals re-render on every action.
* **Offline-first:** All data lives in `localStorage`. Service Worker precaches the app shell (`index.html`, `style.css`, `app.js`, icons) with `skipWaiting` + `clients.claim` so updates activate immediately and the app works fully offline.
* **Bulk-logging:** The amount field is a total `Amount`, not unit pricing. Quantity is tracked separately for reference, and totals always use `amount × quantity`.

## Features

* **Dynamic Quick-Add carousel** — horizontal scroll pill row above the form. Auto-learns your top 3 most frequent `name + amount + category` combos (requires 2+ logs), hides for new users, and logs with today's date in one tap bypassing the form.
* **Real-time filtering** — combined category dropdown + text search that instantly filters the Spending List and donut chart together.
* **Spending by Category donut** — vanilla SVG chart grouped by category, sorted descending, with smart legend (`<1%` instead of `0%` for tiny slices).
* **Monthly Budget tracker** — set/edit budget with progress bar, remaining/over states, and live currency-aware labels.
* **Multi-currency (13 codes)** — PHP default plus USD, CAD, AUD, SGD, HKD, AED, SAR, QAR, JPY, KRW, GBP, EUR via `Intl.NumberFormat`. Display-only, values are never converted.
* **Spending List** — newest-first rows with category icon, name, `Category · Date · Qty` meta line (wraps gracefully), ellipsis for large amounts, tap-to-edit in shared accordion, swipe-safe layout.
* **Bulk selection** — long-press to enter selection mode, checkbox multi-select, batch delete with confirm dialog showing count + total.
* **Undo delete** — single/bulk deletes show toast with timed Undo restore at original index.
* **CSV export / import** — UTF-8 BOM export for Excel emoji support, strict import validation with dedup against existing expenses.
* **Dark / light theme** — CSS-variable theming persisted in `localStorage`, toggle in header.
* **Installable PWA** — `manifest.json` with 192/512 icons, `theme-color`, standalone display, favicon tab icon.

## Tech Stack

* **Vanilla JS + HTML + CSS** — no frameworks, no build step, single `DOMContentLoaded` bootstrap.
* **localStorage persistence** — separate keys for expenses, theme, budget, and currency.
* **PWA Service Worker** — cache-first fetch, versioned `peralog-vXX` cache, precached shell + icons, auto-activation.
* **CSS variables + Flexbox** — gold-accent design system, 440px mobile container, responsive down to 480px.

### File Structure

* `index.html` — app shell: header, summary, budget card, quick-add section, collapsible expense form, chart card, spending list, toasts/dialogs.
* `app.js` — all logic: currency, storage helpers, validation, list/chart/summary rendering, dynamic quick-add, budget, import/export, selection mode, boot.
* `style.css` — theming, layout, cards, form, carousel chips, list rows, chart legend, dialogs, responsive rules.
* `sw.js` — install/activate/fetch handlers for offline support.
* `manifest.json` — PWA metadata and icons (`img/icon-192.png`, `img/icon-512.png`).

## Local Setup

No build tools required — just serve the folder over HTTP (Service Workers require a secure context / localhost).

1. Clone the repo:
   `git clone https://github.com/justineetm/expense-tracker.git`
2. Enter the folder:
   `cd expense-tracker`
3. Serve locally — any static server works:
   `npx serve .`
   or with Python:
   `python -m http.server 8000`
4. Open `http://localhost:8000` (or the port shown) in your browser.
5. To test installability / offline mode, use Chrome DevTools > Application > Service Workers + Manifest.

Data stays in your browser's `localStorage` — clearing site data will remove expenses, budget, theme, and currency preferences.
