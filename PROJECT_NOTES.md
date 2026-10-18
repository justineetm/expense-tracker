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
- Header: Typographic "PeraLog" wordmark on left, 44px ghost icon buttons for theme/currency on right.
- Row Layout: 
  - Left: Category icon in a circle.
  - Middle: Bold item name (truncated) over a muted "Category · Date · Qty" meta line.
  - Right: Total amount and a muted delete trash icon.
- Filter: Slim standalone dropdown above the list.

## Other Features

- Weekly & monthly summary stats in a minimalist flex row with a 1px vertical divider. Labels are muted and all-caps; amounts are bold gold at a reduced size so they don't compete with the Monthly Budget block.
- Form validation with inline error messages
- Dark/light theme toggle (persisted in localStorage)
- Service Worker: `peralog-v21` cache for offline support

## Header & Dashboard Redesign (v18)

- Removed the `` logo from the header; "PeraLog" is now a clean typographic wordmark (`font-weight: 800`, `letter-spacing: -0.5px`).
- Summary cards converted to a minimalist flex row (`#total-week`, `#total-month`) with a 1px vertical divider instead of separate boxes.
- Summary labels reduced to `0.7rem`, muted color, all-caps.
- Summary amounts reduced to `1.25rem`, bold gold, slightly smaller to avoid competing with the Monthly Budget block.
- On screens below 320px, stats stack vertically and the divider hides.

## Item Count in List Header (v19)

- Added a dynamic item count (`#expense-count`) next to the "Spending List" title.
- Renders as `(${count})` (e.g., `(4)`) and updates whenever the list is re-rendered or filtered.
- Styled at `0.85rem` with muted color so it doesn't compete with the title.

## Donut Chart — Spending by Category (v20)

- Added a vanilla JS SVG donut chart card between the Monthly Budget and Spending List sections.
- Uses the `r="15.9155"` trick (circumference = 100) so `stroke-dasharray` maps directly to percentages.
- `renderChart(expenses, categoryFilter)` groups filtered expenses by category, sums amounts (including quantity), sorts by amount descending, and renders `<circle>` slices with `stroke-dasharray` and `stroke-dashoffset`.
- Called from `renderCurrentList()` so it updates on add, delete, edit, import, and category filter changes.
- Falls back to a "No data yet" message when there are no visible expenses.
- 5 CSS chart color variables (`--chart-1` through `--chart-5`) in `:root` and `[data-theme="dark"]`.

## Search Feature (v21)

- Added a real-time text search bar (`#search-input`) inside the Spending List controls, alongside the category filter dropdown.
- Search matches expenses by item name (case-insensitive substring match).
- Search and category filter work together with AND logic — both must match for an expense to appear.
- The item count, donut chart, and list all update automatically as you type.
- Styled consistently with modern form inputs: `var(--color-surface)` background, `1px` border, `12px` border-radius, `12px 16px` padding, gold focus outline.
- Styled at `0.85rem` with muted color so it doesn't compete with the title.

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

## UI Modernization (v15)

Added a sleek, modern, "app-like" feel to the Add Expense form while preserving the gold/dark theme:

- **Toggle Bar (`#expense-toggle`)**: Replaced the solid gold background with a neutral `var(--color-surface)` surface, gold text, a 4px gold left-border accent, 1px border on all sides, 12px border-radius, and a 48px min-height. Hover/active states use subtle `var(--color-badge-bg)` with gold border on hover.
- **Input Fields**: Modernized with a soft `var(--color-surface)` filled background, 1px subtle border, 12px border-radius, and 12px 16px padding. Removed the harsh 1.5px default border. Focus state uses a crisp 2px solid gold `outline` with 2px offset.
- **Input Labels**: Reduced to 0.85rem, muted gray color, with 6px bottom margin for clean alignment above inputs.
- **Button Layout**: Premium upgrade for "Add Expense" (green) and "Cancel" buttons — 12px border-radius, bold font-weight, and 48px min-height.
- **Form Spacing**: The form container now uses `display: flex; flex-direction: column; gap: 16px` for breathing room. Collapsible wrapper (`#expense-form-collapsible`) has 1.5rem padding so inputs don't touch screen edges.
- **Animation Preserved**: The `0fr` → `1fr` CSS grid animation on the form wrapper is unchanged.
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
