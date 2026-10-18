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

## UI & Layout
- Spending List: Modern compact layout with thin dividers instead of card borders.
- Header: Brand logo and title on left, 44px ghost icon buttons for Import/Export/Select on right.
- Row Layout: 
  - Left: Category icon in a circle.
  - Middle: Bold item name (truncated) over a muted "Category · Date · Qty" meta line.
  - Right: Total amount and a muted delete trash icon.
- Filter: Slim standalone dropdown above the list.

## Other Features

- Weekly & monthly summary cards with a two-line monthly-budget status: a large remaining/over-budget amount and a muted "of [budget]" line, alongside a 44px pencil edit button that stays fixed on narrow screens.
- Form validation with inline error messages
- Dark/light theme toggle (persisted in localStorage)
- Service Worker: `peralog-v14` cache for offline support

## Row Layout Fix

Meta line ("Category · Date · Qty") in Spending List rows now wraps gracefully on narrow screens:
- `.expense-meta` no longer forces `white-space: nowrap` — it wraps to a second line when the info block is too narrow.
- `.meta-date` span keeps the date together with `white-space: nowrap` so "Category · 2024-01-15" never breaks mid-date.
- `.long-amount` CSS class reduces font size (0.85rem) for amounts wider than 9 characters (e.g. "₱10,000,000") to prevent right-edge overflow.
- Amount column (`.expense-amount`) and delete icon column (`.expense-right`) keep `flex-shrink: 0` so the full amount is always visible.

## Colors
- Gold is the primary accent: `#C9A227` with `#E0B93A` for emphasis. Gold text on light surfaces uses `#8A6D00`, while text on gold uses `#1a1a1d`.
- Light mode uses white cards and neutral greys; dark mode uses neutral charcoal and grey surfaces. Green is reserved for the Add Expense button and under-budget progress, while orange/red communicate budget warnings and errors.


## Collapsible Add Expense Accordion
- The add expense form is now a collapsible accordion on mobile.
- Wrapper uses CSS grid animation: `grid-template-rows: 0fr` (collapsed) → `1fr` (open) with `overflow: hidden` and `min-height: 0` on the form.
- Toggle button (`#expense-toggle`) is full-width, 48px min tap target, with `aria-expanded` and `aria-controls` pointing to the form wrapper.
- Form container (`#expense-form-collapsible`) starts with `inert` attribute — fields are not reachable by Tab until opened.
- Always starts collapsed on load; no state remembered between visits.
- On open, focuses `#item-name` with `{ preventScroll: true }` after a 400ms timeout (or immediately if `prefers-reduced-motion` is on).
- On successful save: collapses accordion, shows `#info-toast` ("Expense added" / "Expense updated" for edits).
- Validation errors keep the form open; error messages and Save button are not clipped.
- Edit mode: tapping a row uses the shared accordion opener, pre-fills item name, price, quantity, date, and category, scrolls the toggle bar into view, and changes its label to "Edit expense" without focusing an input or opening the mobile keyboard.
- Cancel button collapses accordion and resets the form/labels.
- Tapping the toggle while editing cancels the edit and returns to add mode.

### Mobile Tap & Focus Fixes
- Root cause: `.expense-toggle` and `.btn-primary` had `transition: background` but no `:active` background rule. On mobile, browser default `:active` styling (white background) appeared "stuck" after tap.
- Fixed by adding explicit `:active` background colors to all buttons (theme toggle, currency, accordion toggle, primary, secondary, bulk, delete, cancel).
- All `:hover` rules moved inside `@media (hover: hover)` so touch devices never get a stuck hover state.
- All `:focus-visible` rules use outline only (no background change).
- Text color contrast verified in light and dark themes.
- Added `-webkit-tap-highlight-color: transparent` to all buttons so no native tap highlight flash on mobile.
- Accordion state is centralized in `openAccordion()` / `closeAccordion()`: both update the wrapper's `open` class, both `aria-expanded` values, `inert`, and the `accordionOpen` flag together.
- Tapping an expense row now auto-opens the accordion if closed, updates the toggle label to "Edit expense", and scrolls the toggle bar into view without focusing the Item Name field.
- Selection mode hides the toggle bar entirely; if selection starts while editing, the edit is cancelled and the form collapsed first.
## Files
- `index.html` — HTML structure
- `app.js` — Application logic (~1195 lines)
- `style.css` — Styling (light/dark themes)
- `manifest.json` — PWA manifest
- `sw.js` — Service worker (offline cache)
