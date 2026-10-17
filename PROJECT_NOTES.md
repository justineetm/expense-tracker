# PeraLog — Expense Tracker Project Notes

## Overview
PeraLog is a client-side expense tracker PWA. All data is stored in localStorage (no backend). It supports add/edit/delete expenses, weekly and monthly spending summaries, monthly budget tracking with progress bar, currency selection (display-only), dark mode, CSV import/export, bulk selection/deletion, undo delete, and offline caching via service worker.

## Currency Selector (Display-Only)

### Storage & State
- Key: `peralog_currency` — stores a 3-letter ISO 4217 code (e.g., "PHP", "USD")
- Default: "PHP" when no saved value exists
- Auto-open: On first load, if `peralog_currency` is null AND `expenses` array is empty, the currency picker dialog opens once

### Emoji Flag Mapping
- PHP 🇵🇭 Philippine Peso
- USD 🇺🇸 US Dollar
- CAD 🇨🇦 Canadian Dollar
- AUD 🇦🇺 Australian Dollar
- SGD 🇸🇬 Singapore Dollar
- HKD 🇭🇰 Hong Kong Dollar
- AED 🇦🇪 UAE Dirham
- SAR 🇸🇦 Saudi Riyal
- QAR 🇶🇦 Qatari Riyal
- JPY 🇯🇵 Japanese Yen
- KRW 🇰🇷 South Korean Won
- GBP 🇬🇧 British Pound
- EUR 🇪🇺 Euro

### UI
- Header button (`btn-currency`): pill-shaped button showing flag + code (e.g., "🇵🇭 PHP"), 44px min tap target
- Currency dialog (`currency-dialog`): confirm-dialog-styled modal with disclaimer text "This only changes the symbol. Your numbers are not converted." and a grid of buttons (44px tap areas) each showing flag, code, and name
- Styling: `.btn-currency` in style.css — pill-shaped (`border-radius: 999px`), not a squished circle

### Display Formatting
- `Intl.NumberFormat(undefined, { style: 'currency', currency: code })` used for all display strings (summary cards, budget text, list rows)
- Automatically handles 0-decimal currencies like JPY
- HTML labels updated dynamically (e.g., "Price each (PHP)", "Monthly budget (USD)")

### Data Protection (CRITICAL — DISPLAY-ONLY RULE)
- Raw number data in `localStorage`, `<input type="number">` fields, and CSV Import/Export logic remain strictly as unformatted raw numbers
- `Intl.NumberFormat` is NEVER applied to form inputs or CSV data
- CSV exports contain raw numbers without commas or currency symbols
- No currency conversion is performed — only the display symbol/format changes

## Other Features
- Weekly & monthly summary cards with budget progress bar (green/orange/red thresholds)
- Form validation with inline error messages
- Dark/light theme toggle (persisted in localStorage)
- Service Worker: `peralog-v9` cache for offline support


## Collapsible Add Expense Accordion
- The add expense form is now a collapsible accordion on mobile.
- Wrapper uses CSS grid animation: `grid-template-rows: 0fr` (collapsed) → `1fr` (open) with `overflow: hidden` and `min-height: 0` on the form.
- Toggle button (`#expense-toggle`) is full-width, 48px min tap target, with `aria-expanded` and `aria-controls` pointing to the form wrapper.
- Form container (`#expense-form-collapsible`) starts with `inert` attribute — fields are not reachable by Tab until opened.
- Always starts collapsed on load; no state remembered between visits.
- On open, focuses `#item-name` with `{ preventScroll: true }` after a 400ms timeout (or immediately if `prefers-reduced-motion` is on).
- On successful save: collapses accordion, shows `#info-toast` ("Expense added" / "Expense updated" for edits).
- Validation errors keep the form open; error messages and Save button are not clipped.
- Edit mode: tapping a row expands the form, pre-fills fields, scrolls into view, and changes toggle label to "Edit expense".
- Cancel button collapses accordion and resets the form/labels.
- Tapping the toggle while editing cancels the edit and returns to add mode.
- Selection mode hides the toggle bar entirely; if selection starts while editing, the edit is cancelled and the form collapsed first.
## Files
- `index.html` — HTML structure
- `app.js` — Application logic (~1195 lines)
- `style.css` — Styling (light/dark themes)
- `manifest.json` — PWA manifest
- `sw.js` — Service worker (offline cache)