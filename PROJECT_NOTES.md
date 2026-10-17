# PeraLog - Project Context & Rules

## Project Overview
PeraLog is a mobile-first, offline-capable expense tracker. 

## Tech Stack & Constraints
- **Core:** HTML5, CSS3, Vanilla JS only.
- **No Libraries:** Strictly no external libraries or frameworks (no React, Tailwind, Moment.js, etc.).
- **Storage:** Data is persisted exclusively via `localStorage`.
- **Hosting:** Hosted on GitHub Pages in a subfolder. **ALL paths must be relative** (e.g., `./img/icon.png`, `./sw.js`).
- **PWA:** Fully offline capable using a service worker with versioned caching.

## Design System & UI Rules
- **Layout:** Strictly mobile-first. Container must be `max-width: 440px` with `16px` side padding. No horizontal scrolling or overflow.
- **Accessibility:** Minimum tap target size for all interactive elements (buttons, toggles) is `44px`.
- **Theme:** Supports Light and Dark modes via `data-theme="dark"` on the `<body>`.
- **Colors:** 
  - Dark mode colors: page: `#0e0e10`, cards: `#1a1a1d`, inputs: `#121214`.
  - Summary cards: Charcoal background with Gold (`#C9A227`) text.
  - Green is strictly reserved **only** for the `.progress-green` budget bar and the `.btn-primary` (Add Expense) button.
- **Inputs:** Number inputs must have mouse-wheel scrolling disabled to prevent accidental value changes. Default spinner arrows must be hidden.

## Data & Logic Rules
- **IDs:** UUIDs (`crypto.randomUUID()`) are used for expense IDs.
- **Sorting:** The expense list is actively sorted chronologically (newest date first) comparing `YYYY-MM-DD`. If dates match exactly, it sorts by array index (newest added first).
- **Dates:** Legacy expenses use ISO strings; new expenses use `YYYY-MM-DD`. Logic must handle both without crashing.
- **Undo Deletion:** Single and multi-item deleted expenses are held in memory for 6 seconds via a toast notification. Undoing restores items to their **exact original array indices** by sorting the deleted items ascending by `originalIndex` and splicing them back into the main array (`array.splice(item.originalIndex, 0, item.expense)`).

## Features Already Built (do not break)

Add expense: item, price each, quantity, date, category
Categories: Food, Transport, Load & Data, School, Bills, Shopping, Health, Fun, Other
Weekly and monthly totals, monthly budget with progress bar
Edit by tapping a row, delete with Undo
Bulk delete with multi-item selection and Undo
Category filter, CSV export (all expenses, ignores filter)
Light/dark toggle, installable PWA


## Legacy Data Rules

Old expenses may have no quantity: treat as 1
Old expenses with removed categories: show as "Other"


## Agent Workflow Rules

Read this file and the relevant source files before changing anything
Change as few lines as possible. Never rewrite or reorganize working code
Never remove existing IDs, classes, or aria attributes
Never change how data is saved unless the task says so
Bump the CACHE_NAME in sw.js (peralog-vN) on every change
Report: files changed, what was done, how to test, anything skipped