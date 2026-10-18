"use strict";

/* =============================================
   Constants  (module-level: immutable, no pollution risk)
   ============================================= */
const STORAGE_KEY = "expense_tracker_v1";
const THEME_STORAGE_KEY = "expense_tracker_theme";
const BUDGET_STORAGE_KEY = "expense_budget";
const CURRENCY_STORAGE_KEY = "peralog_currency";
const BACKUP_STORAGE_KEY = "peralog_last_backup";
const SNOOZE_STORAGE_KEY = "peralog_backup_snooze";

/** Currency code -> human-readable name for the picker dialog. */
const CURRENCY_LABELS = {
  PHP: "Philippine Peso",
  USD: "US Dollar",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  SGD: "Singapore Dollar",
  HKD: "Hong Kong Dollar",
  AED: "UAE Dirham",
  SAR: "Saudi Riyal",
  QAR: "Qatari Riyal",
  JPY: "Japanese Yen",
  KRW: "South Korean Won",
  GBP: "British Pound",
  EUR: "Euro",
};

/** Currency code -> emoji flag for the UI picker and header button. */
const CURRENCY_FLAGS = {
  PHP: "\u{1F1F5}\u{1F1ED}", // 🇵🇭
  USD: "\u{1F1FA}\u{1F1F8}", // 🇺🇸
  CAD: "\u{1F1E8}\u{1F1E6}", // 🇨🇦
  AUD: "\u{1F1E6}\u{1F1FA}", // 🇦🇺
  SGD: "\u{1F1F8}\u{1F1EC}", // 🇸🇬
  HKD: "\u{1F1ED}\u{1F1F0}", // 🇭🇰
  AED: "\u{1F1E6}\u{1F1EA}", // 🇦🇪
  SAR: "\u{1F1F8}\u{1F1E6}", // 🇸🇦
  QAR: "\u{1F1F6}\u{1F1E6}", // 🇶🇦
  JPY: "\u{1F1EF}\u{1F1F5}", // 🇯🇵
  KRW: "\u{1F1F0}\u{1F1F7}", // 🇰🇷
  GBP: "\u{1F1EC}\u{1F1E7}", // 🇬🇧
  EUR: "\u{1F1EA}\u{1F1FA}", // 🇪🇺
};

/** Currently selected currency code (ISO 4217). Defaults to PHP. */
let currentCurrencyCode = "PHP";

/** Intl.NumberFormat instance for the current currency. */
let currencyFormatter = null;

/** Initialize or re-initialize the currency formatter for the given code. */
function setCurrencyFormatter(code) {
  currentCurrencyCode = code;
  currencyFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: code,
  });
}

/** Format a numeric amount for display without changing its stored value. */
function formatCurrency(amount) {
  return currencyFormatter.format(amount);
}

/** Return just the currency symbol for the current code (e.g. "₱", "$", "¥"). */
function getCurrencySymbol() {
  return currencyFormatter.formatToParts(0).find((p) => p.type === "currency")?.symbol || "";
}

const CATEGORY_ICONS = {
  Food:          "\u{1F354}",
  Transport:     "\u{1F68C}",
  "Load & Data": "\u{1F4F1}",
  School:        "\u{1F393}",
  Bills:         "\u{1F9FE}",
  Shopping:      "\u{1F6CD}\uFE0F",
  Health:        "\u{1F3E5}",
  Fun:           "\u{1F389}",
  Other:         "\u{1F4E6}",
};

const CATEGORY_COLORS = {
  Food:          "var(--chart-1)",
  Transport:     "var(--chart-2)",
  "Load & Data": "var(--chart-3)",
  School:        "var(--chart-4)",
  Bills:         "var(--chart-5)",
  Shopping:      "var(--chart-6)",
  Health:        "var(--chart-7)",
  Fun:           "var(--chart-8)",
  Other:         "var(--chart-9)",
};

/** Fallback color for any category not in the map above. */
const CATEGORY_COLOR_FALLBACK = "var(--color-text)";

/* Quick Add is fully dynamic — derived from expense history (see renderQuickAdd). */


/* =============================================
   Storage Helpers
   ============================================= */

/** Load the saved expense array from localStorage. */
function loadExpenses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

/** Persist the expense array to localStorage. */
function saveExpenses(expenses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

/** Return a valid saved budget, or null when none has been set. */
function loadBudget() {
  const budget = parseFloat(localStorage.getItem(BUDGET_STORAGE_KEY));
  return Number.isFinite(budget) && budget > 0 ? budget : null;
}

/* =============================================
   Date Boundary Helpers
   ============================================= */

/**
 * Returns today's local date in YYYY-MM-DD format.
 * @returns {string}
 */
function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const parseLocalDate = (str) => { const [y, m, d] = str.substring(0,10).split('-'); return new Date(y, m - 1, d); };

/**
 * Returns a Date set to midnight (00:00:00.000) of the given date
 * in local time — used for clean day-boundary comparisons.
 * @param {Date} d
 * @returns {Date}
 */
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Returns the Date of the most recent Monday at midnight local time.
 * If today is Monday, returns today's midnight.
 * @returns {Date}
 */
function startOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();                         // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = (day === 0) ? 6 : day - 1;  // days since last Monday
  const monday = startOfDay(now);
  monday.setDate(monday.getDate() - diffToMonday);
  return monday;
}

/**
 * Returns the first day of the current calendar month at midnight local time.
 * @returns {Date}
 */
function startOfCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/* =============================================
   Summary Calculation  (single O(N) pass)
   ============================================= */

/**
 * Computes weekly and monthly spending totals in one array traversal.
 *
 * Bounds applied to every expense date (d):
 *   lower: weekStart  <= d  (for week bucket)
 *   lower: monthStart <= d  (for month bucket)
 *   upper: d < tomorrow     (excludes future-dated expenses from both buckets)
 *
 * @param {Array<{amount: number, date: string}>} expenses
 * @returns {{ weekTotal: number, monthTotal: number }}
 */
function calcSummaryTotals(expenses) {
  const weekStart  = startOfCurrentWeek();
  const monthStart = startOfCurrentMonth();

  // Upper bound: start of tomorrow in local time — any date >= this is "future"
  const now       = new Date();
  const tomorrow  = startOfDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return expenses.reduce(
    (acc, exp) => {
      const d = parseLocalDate(exp.date);

      // Skip future-dated entries entirely
      if (d >= tomorrow) return acc;

      const quantity = exp.quantity || 1;
      if (d >= weekStart)  acc.weekTotal  += exp.amount * quantity;
      if (d >= monthStart) acc.monthTotal += exp.amount * quantity;

      return acc;
    },
    { weekTotal: 0, monthTotal: 0 }
  );
}

/**
 * Recalculates week and month totals and updates the summary card text.
 * Delegates to calcSummaryTotals() — single array pass.
 * @param {Array} expenses
 */
function updateSummary(expenses, budgetUi) {
  const { weekTotal, monthTotal } = calcSummaryTotals(expenses);
  document.getElementById("total-week").textContent = formatCurrency(weekTotal);
  document.getElementById("total-month").textContent = formatCurrency(monthTotal);

  if (budgetUi) renderBudget(monthTotal, budgetUi);
}

/** Render the appropriate budget state from the current monthly total. */
function renderBudget(monthTotal, budgetUi) {
  const budget = loadBudget();
  const { emptyState, formState, activeState, statusPrimary, statusSecondary, progressFill, progressBar } = budgetUi;

  emptyState.classList.toggle("hidden", Boolean(budget));
  formState.classList.add("hidden");
  activeState.classList.toggle("hidden", !budget);

  if (!budget) return;

  const remaining = budget - monthTotal;
  const percentage = (monthTotal / budget) * 100;
  const cappedPercentage = Math.min(percentage, 100);
  const colorClass = percentage >= 100
    ? "progress-red"
    : percentage >= 70
      ? "progress-orange"
      : "progress-green";

  statusPrimary.textContent = remaining < 0
    ? `Over budget by ${formatCurrency(Math.abs(remaining))}`
    : `${formatCurrency(remaining)} left`;
  statusPrimary.classList.toggle("budget-status-warning", remaining < 0);
  statusSecondary.textContent = `of ${formatCurrency(budget)}`;
  progressFill.style.width = `${cappedPercentage}%`;
  progressFill.className = `progress-fill ${colorClass}`;
  progressBar.setAttribute("aria-valuenow", String(Math.min(Math.round(percentage), 100)));
}

/* =============================================
   Validation
   ============================================= */

/**
 * Validates the form fields and populates inline error messages.
 * @param {HTMLElement} nameInput
 * @param {HTMLElement} amountInput
 * @param {HTMLElement} quantityInput
 * @param {HTMLElement} categorySel
 * @returns {boolean} true when all fields pass
 */
function validateForm(nameInput, amountInput, quantityInput, dateInput, categorySel) {
  let valid = true;

  const errorName     = document.getElementById("error-name");
  const errorAmount   = document.getElementById("error-amount");
  const errorQuantity = document.getElementById("error-quantity");
  const errorDate     = document.getElementById("error-date");
  const errorCategory = document.getElementById("error-category");

  [nameInput, amountInput, quantityInput, dateInput, categorySel].forEach(el => el.classList.remove("invalid"));
  [errorName, errorAmount, errorQuantity, errorDate, errorCategory].forEach(el => (el.textContent = ""));

  if (!nameInput.value.trim()) {
    nameInput.classList.add("invalid");
    errorName.textContent = "Please tell us what you bought.";
    valid = false;
  }

  const amt = parseFloat(amountInput.value);
  if (!amountInput.value || isNaN(amt) || amt <= 0) {
    amountInput.classList.add("invalid");
    errorAmount.textContent = `Please enter an amount greater than ${getCurrencySymbol()}0.`;
    valid = false;
  }

  const qty = parseInt(quantityInput.value, 10);
  if (!quantityInput.value || isNaN(qty) || qty < 1) {
    quantityInput.classList.add("invalid");
    errorQuantity.textContent = "Please tell us how many you bought.";
    valid = false;
  }

  if (!dateInput.value) {
    dateInput.classList.add("invalid");
    errorDate.textContent = "Please select a date.";
    valid = false;
  } else if (dateInput.value > getTodayISO()) {
    dateInput.classList.add("invalid");
    errorDate.textContent = "Future dates are not allowed.";
    valid = false;
  }

  if (!categorySel.value) {
    categorySel.classList.add("invalid");
    errorCategory.textContent = "Please choose a category so we can keep things organized.";
    valid = false;
  }

  return valid;
}

/* =============================================
   Rendering
   ============================================= */

/** Escape user-supplied strings before injecting into innerHTML (XSS guard). */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format an ISO date string into a short human-readable label. */
function formatDate(iso) {
  return parseLocalDate(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

/**
 * Build a single <li> element for one expense, including a delete button.
 * @param {{id: string, name: string, amount: number, quantity?: number, category: string, date: string}} expense
 * @returns {HTMLLIElement}
 */
function createExpenseItem(expense) {
  const li = document.createElement("li");
  li.className = "expense-item";
  li.dataset.id = expense.id;

  const isKnownCategory = Object.hasOwn(CATEGORY_ICONS, expense.category);
  const displayCategory = isKnownCategory ? expense.category : "Other";
  const icon = CATEGORY_ICONS[displayCategory];
  const qty = expense.quantity || 1;
  const totalAmount = expense.amount * qty;
  const formattedTotal = formatCurrency(totalAmount);
  const isLongAmount = formattedTotal.length > 9;
  const qtyText = qty > 1 ? ` \u00B7 ${qty} \u00D7 ${formatCurrency(expense.amount)}` : "";

  li.innerHTML = `
    <input
      type="checkbox"
      class="expense-checkbox"
      data-id="${escapeHTML(expense.id)}"
      aria-label="Select ${escapeHTML(expense.name)}"
    />
    <div class="expense-category-circle" aria-hidden="true">${icon}</div>
    <div class="expense-info">
      <span class="expense-name">${escapeHTML(expense.name)}</span>
      <div class="expense-meta">
        <span>${escapeHTML(displayCategory)} \u00B7 <span class="meta-date">${formatDate(expense.date)}</span>${qtyText}</span>
      </div>
    </div>
    <div class="expense-right">
      <span class="expense-amount ${isLongAmount ? 'long-amount' : ''}">${formattedTotal}</span>
      <button
        class="btn-delete"
        aria-label="Delete ${escapeHTML(expense.name)}"
        data-id="${escapeHTML(expense.id)}"
        title="Delete expense"
      >&#x1F5D1;</button>
    </div>
  `;

  return li;
}

/**
 * Clear and re-render the full expense list (newest first).
 * @param {Array} expenses
 * @param {HTMLElement} listEl
 * @param {HTMLElement} emptyEl
 */
function renderList(expenses, listEl, emptyEl, categoryFilter = "", searchTerm = "") {
  listEl.innerHTML = "";

  const term = searchTerm.toLowerCase();
  const visibleExpenses = expenses.filter(exp => {
    // Category filter
    if (!categoryFilter) {
      // no category filter
    } else if (categoryFilter === "Other") {
      if (!(exp.category === "Other" || !Object.hasOwn(CATEGORY_ICONS, exp.category))) {
        return false;
      }
    } else if (exp.category !== categoryFilter) {
      return false;
    }

    // Search text filter (AND logic with category)
    if (term && !exp.name.toLowerCase().includes(term)) {
      return false;
    }

    return true;
  });

  if (visibleExpenses.length === 0) {
    emptyEl.classList.remove("hidden");
    const countEl = document.getElementById("expense-count");
    if (countEl) countEl.textContent = "(0)";
    return;
  }

  emptyEl.classList.add("hidden");
  const countEl = document.getElementById("expense-count");
  if (countEl) countEl.textContent = `(${visibleExpenses.length})`;
  [...visibleExpenses]
    .sort((a, b) => {
      const dateA = a.date.substring(0, 10);
      const dateB = b.date.substring(0, 10);
      const dateDiff = dateB.localeCompare(dateA);

      if (dateDiff !== 0) {
        return dateDiff;
      }

      // Tie-breaker: use the original index in the full expenses array
      // so the most recently added item (higher index) comes first.
      return expenses.indexOf(b) - expenses.indexOf(a);
    })
    .forEach(exp => listEl.appendChild(createExpenseItem(exp)));
}

/* =============================================
   Spending by Category Donut Chart
   ============================================= */

/**
 * Render a donut chart showing spending breakdown by category.
 * Uses the r="15.9155" trick (circumference = 100) so stroke-dasharray
 * maps directly to percentages.
 * @param {Array} expenses
 * @param {string} categoryFilter
 */
function renderChart(expenses, categoryFilter = "", searchTerm = "") {
  const svg = document.querySelector(".donut-chart");
  const legend = document.getElementById("chart-legend");
  if (!svg || !legend) return;

  // Clear existing slices and legend
  svg.querySelectorAll(".donut-slice").forEach(el => el.remove());
  legend.innerHTML = "";

  const term = searchTerm.toLowerCase();

  // Filter visible expenses by category AND search term
  const visible = expenses.filter(exp => {
    // Category filter
    if (!categoryFilter) {
      // no category filter
    } else if (categoryFilter === "Other") {
      if (!(exp.category === "Other" || !Object.hasOwn(CATEGORY_ICONS, exp.category))) {
        return false;
      }
    } else if (exp.category !== categoryFilter) {
      return false;
    }

    // Search text filter (AND logic with category)
    if (term && !exp.name.toLowerCase().includes(term)) {
      return false;
    }

    return true;
  });

  if (visible.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "chart-empty";
    emptyMsg.textContent = "No data yet";
    legend.appendChild(emptyMsg);
    return;
  }

  // Group by category and sum amounts (including quantity)
  const totals = {};
  visible.forEach(exp => {
    const qty = exp.quantity || 1;
    totals[exp.category] = (totals[exp.category] || 0) + exp.amount * qty;
  });

  // Sort categories by amount descending
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  const grandTotal = sorted.reduce((sum, [, amt]) => sum + amt, 0);
  let cumulativePercent = 0;

  sorted.forEach(([category, amount], index) => {
    const percent = (amount / grandTotal) * 100;
    const color = CATEGORY_COLORS[category] || CATEGORY_COLOR_FALLBACK;

    const slice = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    slice.setAttribute("class", "donut-slice");
    slice.setAttribute("r", "15.9155");
    slice.setAttribute("cx", "16");
    slice.setAttribute("cy", "16");
    slice.setAttribute("stroke", color);
    slice.setAttribute("stroke-dasharray", `${percent} 100`);
    slice.setAttribute("stroke-dashoffset", `${cumulativePercent}`);
    svg.appendChild(slice);

    cumulativePercent += percent;

    // Legend item
    const item = document.createElement("div");
    item.className = "legend-item";

    const dot = document.createElement("div");
    dot.className = "legend-dot";
    dot.style.backgroundColor = color;
    item.appendChild(dot);

    const label = document.createElement("span");
    label.className = "legend-label";
    label.textContent = category;
    item.appendChild(label);

    const value = document.createElement("span");
    value.className = "legend-value";
    const rounded = Math.round(percent);
    value.textContent = (rounded === 0 && amount > 0) ? "<1%" : `${rounded}%`;
    item.appendChild(value);

    legend.appendChild(item);
  });
}

/* =============================================
   CSV Import Helpers (vanilla JS, no libraries)
   ============================================= */

/**
 * Parses a CSV string into an array of rows (each row is an array of fields).
 * Handles: UTF-8 BOM (removed by caller), quoted fields with embedded commas,
 * doubled quotes for escaping, \r\n and \n line endings, and blank lines (skipped).
 * @param {string} text */
/** @type {HTMLInputElement} */
const searchInput = document.getElementById("search-input");
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(field);
        field = "";
        i++;
      } else if (ch === "\r") {
        row.push(field);
        field = "";
        if (i + 1 < len && text[i + 1] === "\n") i++;
        if (row.some((f) => f !== "")) rows.push(row);
        row = [];
        i++;
      } else if (ch === "\n") {
        row.push(field);
        field = "";
        if (row.some((f) => f !== "")) rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }

  return rows;
}

/**
 * Strict YYYY-MM-DD validation.
 * Rejects overflow dates like 2026-02-31 by verifying round-trip components.
 * @param {string} dateStr
 * @returns {boolean}
 */
function isValidISODate(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * Match a raw category string (with or without emoji) to a known category.
 * Defaults to "Other" when no match is found.
 * @param {string} raw
 * @returns {string}
 */
function resolveCategory(raw) {
  const trimmed = raw.trim();
  if (Object.hasOwn(CATEGORY_ICONS, trimmed)) return trimmed;
  const stripped = trimmed.replace(/[\u{1F300}-\u{1F9FF}\uFE0F]/gu, "").trim();
  if (Object.hasOwn(CATEGORY_ICONS, stripped)) return stripped;
  return "Other";
}

/* =============================================
   Initialisation  (no global mutable state)
   ============================================= */

/**
 * Wires up all DOM event listeners and performs the initial render.
 * Called once DOMContentLoaded fires — keeps every mutable reference
 * local to this function, away from the global scope.
 */
function init() {
  // ── DOM refs (local to init) ──────────────────────────────────────────
  const form        = document.getElementById("expense-form");
  const nameInput   = document.getElementById("item-name");
  const amountInput = document.getElementById("amount");
  const quantityInput = document.getElementById("quantity");
  const dateInput   = document.getElementById("expense-date");
  const categorySel = document.getElementById("category");
  const expenseList = document.getElementById("expense-list");
  const emptyState  = document.getElementById("empty-state");
  const filterSel   = document.getElementById("filter-category");
  const exportButton = document.getElementById("btn-export");
  const themeToggle = document.getElementById("theme-toggle");
  const submitButton = form.querySelector('button[type="submit"]');
  const cancelButton = document.getElementById("btn-cancel");
  const expenseToggle = document.getElementById("expense-toggle");
  const expenseCollapsible = document.getElementById("expense-form-collapsible");
  const selectButton = document.getElementById("btn-select");

  // Accordion state
  let accordionOpen = false;

  // ── Accordion: one source of truth for every open/close path ──────────
  const openAccordion = () => {
    accordionOpen = true;
    expenseToggle.classList.add("open");
    expenseCollapsible.classList.add("open");
    expenseToggle.setAttribute("aria-expanded", "true");
    expenseCollapsible.setAttribute("aria-expanded", "true");
    expenseCollapsible.removeAttribute("inert");
  };

  const closeAccordion = () => {
    accordionOpen = false;
    expenseToggle.classList.remove("open");
    expenseCollapsible.classList.remove("open");
    expenseToggle.setAttribute("aria-expanded", "false");
    expenseCollapsible.setAttribute("aria-expanded", "false");
    expenseCollapsible.setAttribute("inert", "");
  };

  const toggleAccordion = () => {
    if (accordionOpen) {
      resetExpenseForm();
      return;
    }

    editId = null;
    submitButton.textContent = "Add Expense";
    cancelButton.classList.add("hidden");
    const toggleLabel = expenseToggle.querySelector(".toggle-label");
    if (toggleLabel) toggleLabel.textContent = "+ Add expense";
    openAccordion();

    const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => {
      if (accordionOpen && !editId) nameInput.focus({ preventScroll: true });
    }, isReducedMotion ? 0 : 400);
  };

  closeAccordion();

  if (expenseToggle) {
    expenseToggle.addEventListener("click", toggleAccordion);
  }
  const bulkActionBar = document.getElementById("bulk-action-bar");
  const selectAllButton = document.getElementById("btn-select-all");
  const cancelSelectButton = document.getElementById("btn-cancel-select");
  const deleteSelectedButton = document.getElementById("btn-delete-selected");
  const confirmDialog = document.getElementById("confirm-dialog");
  const confirmDialogTitle = document.getElementById("confirm-dialog-title");
  const dialogCancelButton = document.getElementById("btn-dialog-cancel");
  const dialogConfirmButton = document.getElementById("btn-dialog-confirm");
  const deletePreviewItems = document.getElementById("delete-preview-items");
  const deletePreviewTotal = document.getElementById("delete-preview-total");
  const infoToast = document.getElementById("info-toast");
  const infoToastMessage = document.getElementById("info-toast-message");
  const toast = document.getElementById("toast");
  const undoButton = document.getElementById("btn-undo");
  const currencyButton = document.getElementById("btn-currency");
  const currencyDialog = document.getElementById("currency-dialog");
  const toastMessage = toast ? toast.querySelector("span") : null;
  const budgetUi = {
    emptyState: document.getElementById("budget-empty-state"),
    formState: document.getElementById("budget-form-state"),
    activeState: document.getElementById("budget-active-state"),
    input: document.getElementById("budget-input"),
    error: document.getElementById("budget-error"),
    statusPrimary: document.getElementById("budget-status-primary"),
    statusSecondary: document.getElementById("budget-status-secondary"),
    progressFill: document.getElementById("progress-fill"),
    progressBar: document.querySelector(".progress-bar"),
  };
  const budgetSetButton = document.getElementById("budget-set");
  const budgetEditButton = document.getElementById("budget-edit");
  const budgetSaveButton = document.getElementById("budget-save");
  let editId = null;
  let isSelectionMode = false;
  let pendingDeletion = null;
  let toastTimer = null;
  let infoToastTimer = null;
  let longPressTimer = null;
  let longPressTarget = null;
  let startX = 0;
  let startY = 0;
  let suppressClick = false;

  const applyTheme = (theme) => {
    const isDark = theme === "dark";

    if (isDark) {
      document.body.dataset.theme = "dark";
    } else {
      delete document.body.dataset.theme;
    }

    themeToggle.textContent = isDark ? "\u2600\uFE0F" : "\u{1F319}";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    themeToggle.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  };

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(savedTheme === "dark" ? "dark" : "light");

  themeToggle.addEventListener("click", () => {
    const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  });

  // ── Currency ─────────────────────────────────────────────────────────
  const savedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY);
  if (savedCurrency && CURRENCY_LABELS[savedCurrency]) {
    setCurrencyFormatter(savedCurrency);
  } else {
    setCurrencyFormatter("PHP");
  }

  const updateCurrencyButton = () => {
    if (currencyButton) {
      const flag = CURRENCY_FLAGS[currentCurrencyCode] || "";
      currencyButton.textContent = `${flag} ${currentCurrencyCode}`;
      currencyButton.setAttribute("aria-label", `Currency: ${currentCurrencyCode} (${CURRENCY_LABELS[currentCurrencyCode]})`);
      currencyButton.title = `${currentCurrencyCode} - ${CURRENCY_LABELS[currentCurrencyCode]}`;
    }
  };
  updateCurrencyButton();

  if (currencyButton && currencyDialog) {
    currencyButton.addEventListener("click", () => {
      currencyDialog.showModal();
    });

    currencyDialog.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-currency]");
      if (!btn) return;
      const code = btn.dataset.currency;
      if (CURRENCY_LABELS[code]) {
        setCurrencyFormatter(code);
        localStorage.setItem(CURRENCY_STORAGE_KEY, code);
        updateCurrencyButton();
        currencyDialog.close();
        // Re-render everything with the new currency
        const expenses = loadExpenses();
        renderCurrentList(expenses);
        updateCurrentSummary(expenses);
        // Update HTML labels that reference currency
        updateCurrencyLabels();
      }
    });

    // Close dialog when clicking backdrop
    currencyDialog.addEventListener("click", (e) => {
      if (e.target === currencyDialog) currencyDialog.close();
    });
  }

  // Update HTML labels that show the currency symbol/code
  function updateCurrencyLabels() {
    const symbol = getCurrencySymbol();
    const amountLabel = document.querySelector('label[for="amount"]');
    if (amountLabel) {
      amountLabel.textContent = `Amount (${currentCurrencyCode})`;
    }
    const budgetLabel = document.querySelector('label[for="budget-input"]');
    if (budgetLabel) {
      budgetLabel.textContent = `Monthly budget (${currentCurrencyCode})`;
    }
  }

  const renderCurrentList = (expenses) => {
    const searchTerm = searchInput.value;
    renderList(expenses, expenseList, emptyState, filterSel.value, searchTerm);
    renderChart(expenses, filterSel.value, searchTerm);
    renderQuickAdd(expenses);
    renderBackupBanner();
  }

  const updateCurrentSummary = (expenses) => {
    updateSummary(expenses, budgetUi);
  };

  /* =============================================
   Quick Add Chips (dynamic — top frequent purchases)
   ============================================= */
  function getQuickAddTemplates(expenses) {
    if (!Array.isArray(expenses) || expenses.length === 0) return [];
    const freq = new Map();
    for (const exp of expenses) {
      const name = (exp.name || "").trim();
      if (!name) continue;
      const amount = Number(exp.amount) || 0;
      const category = exp.category || "Other";
      const key = `${name.toLowerCase()}|${amount.toFixed(2)}|${category}`;
      if (!freq.has(key)) {
        freq.set(key, { name, amount, category, count: 0 });
      }
      freq.get(key).count += 1;
    }
    return [...freq.values()]
      .filter(t => t.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  function extractLeadingEmoji(text) {
    if (!text) return "";
    const match = String(text).match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u);
    return match ? match[1] : "";
  }

  function renderQuickAdd(expenses) {
    const carousel = document.getElementById("quick-add-carousel");
    if (!carousel) return;
    const section = document.querySelector(".quick-add-section");

    const list = Array.isArray(expenses) ? expenses : loadExpenses();

    // Clear any previous chips
    carousel.innerHTML = "";

    const templates = getQuickAddTemplates(list);

    if (templates.length === 0) {
      if (section) section.style.display = "none";
      return;
    }

    if (section) section.style.display = "block";

    templates.forEach(template => {
      const emoji = extractLeadingEmoji(template.name)
        || CATEGORY_ICONS[template.category]
        || "";
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "quick-add-chip";
      chip.setAttribute("data-name", template.name);
      chip.setAttribute("aria-label", `Quick add ${template.name} for ${template.amount}`);
      const nameSpan = document.createElement("span");
      nameSpan.textContent = emoji ? `${emoji} ${template.name}` : template.name;
      const amtSpan = document.createElement("span");
      amtSpan.style.color = "var(--color-muted)";
      amtSpan.style.fontSize = "0.8rem";
      amtSpan.textContent = `${getCurrencySymbol()}${template.amount}`;
      chip.append(nameSpan, amtSpan);
      chip.addEventListener("click", () => {
        const expense = {
          id: crypto.randomUUID(),
          name: template.name,
          amount: template.amount,
          quantity: 1,
          date: getTodayISO(),
          category: template.category,
        };
        const current = loadExpenses();
        current.push(expense);
        saveExpenses(current);
        renderCurrentList(current);
        updateCurrentSummary(current);
        showInfoToast(`${emoji ? emoji + " " : ""}${template.name} added`);
      });
      carousel.appendChild(chip);
    });
  }

  const resetExpenseForm = () => {
    editId = null;
    form.reset();
    const today = getTodayISO();
    dateInput.value = today;
    dateInput.max = today;
    [nameInput, amountInput, quantityInput, dateInput, categorySel].forEach(el => el.classList.remove("invalid"));
    form.querySelectorAll(".field-error").forEach(el => (el.textContent = ""));
    submitButton.textContent = "Add Expense";
    cancelButton.classList.add("hidden");

    // Collapse accordion and reset toggle label
    closeAccordion();
    const toggleLabel = expenseToggle.querySelector(".toggle-label");
    if (toggleLabel) {
      toggleLabel.textContent = "+ Add expense";
    }
  };

  const hideToast = () => {
    toast.classList.add("hidden");
    pendingDeletion = null;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
  };

  const showToast = (items, message = "Expense deleted.") => {
    if (toastTimer) clearTimeout(toastTimer);
    pendingDeletion = items;
    if (toastMessage) toastMessage.textContent = message;
    toast.classList.remove("hidden");
    toastTimer = setTimeout(hideToast, 6000);
  };

  const showInfoToast = (msg) => {
    if (infoToastTimer) clearTimeout(infoToastTimer);
    if (infoToastMessage) infoToastMessage.textContent = msg;
    if (infoToast) infoToast.classList.remove("hidden");
    infoToastTimer = setTimeout(() => {
      if (infoToast) infoToast.classList.add("hidden");
      infoToastTimer = null;
    }, 3000);
  };

  const startEdit = (id) => {
    const expense = loadExpenses().find(exp => exp.id === id);
    if (!expense) return;

    editId = expense.id;
    nameInput.value = expense.name;
    amountInput.value = expense.amount;
    quantityInput.value = expense.quantity || 1;
    // Extract YYYY-MM-DD from date string (ISO or YYYY-MM-DD)
    dateInput.value = expense.date.includes("T") ? expense.date.split("T")[0] : expense.date;
    categorySel.value = Object.hasOwn(CATEGORY_ICONS, expense.category)
      ? expense.category
      : "Other";
    submitButton.textContent = "Save changes";
    cancelButton.classList.remove("hidden");

    openAccordion();

    // Update toggle label to "Edit expense"
    const toggleLabel = expenseToggle.querySelector(".toggle-label");
    if (toggleLabel) {
      toggleLabel.textContent = "Edit expense";
    }

    // Scroll toggle bar into view (not the collapsible panel)
    expenseToggle.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showBudgetForm = () => {
    budgetUi.emptyState.classList.add("hidden");
    budgetUi.activeState.classList.add("hidden");
    budgetUi.formState.classList.remove("hidden");
    budgetUi.input.value = loadBudget() || "";
    budgetUi.error.textContent = "";
    budgetUi.input.focus();
  };

  budgetSetButton.addEventListener("click", showBudgetForm);
  budgetEditButton.addEventListener("click", showBudgetForm);
  budgetSaveButton.addEventListener("click", () => {
    const budget = parseFloat(budgetUi.input.value);

    if (!Number.isFinite(budget) || budget <= 0) {
      budgetUi.error.textContent = `Please enter a monthly budget greater than ${getCurrencySymbol()}0.`;
      budgetUi.input.classList.add("invalid");
      return;
    }

    budgetUi.input.classList.remove("invalid");
    localStorage.setItem(BUDGET_STORAGE_KEY, String(budget));
    updateCurrentSummary(loadExpenses());
  });

  budgetUi.input.addEventListener("input", () => {
    budgetUi.input.classList.remove("invalid");
    budgetUi.error.textContent = "";
  });

  filterSel.addEventListener("change", () => {
    renderCurrentList(loadExpenses());
  });

  searchInput.addEventListener("input", () => {
    renderCurrentList(loadExpenses());
  });

  exportButton.addEventListener("click", () => exportBackup());

  /**
   * Build CSV (BOM, headers, raw numbers) and attempt one-tap share;
   * falls back to download link when sharing is unavailable or fails.
   * Saves backup timestamp on success or fallback; does nothing on AbortError.
   */
  async function exportBackup() {
    const expenses = loadExpenses();
    if (expenses.length === 0) {
      showInfoToast("No expenses to export yet!");
      return;
    }

    // CSV Headers & BOM for Excel emoji support
    let csvContent = "\uFEFFDate,Item,Category,Price Each,Quantity,Total\n";

    expenses.forEach(exp => {
      const date = exp.date.substring(0, 10);
      const name = `"${exp.name.replace(/"/g, '""')}"`;
      const isKnownCategory = Object.hasOwn(CATEGORY_ICONS, exp.category);
      const catText = isKnownCategory ? exp.category : "Other";
      const icon = CATEGORY_ICONS[catText];
      const category = `"${icon} ${catText}"`;
      const price = exp.amount.toFixed(2);
      const qty = exp.quantity || 1;
      const total = (exp.amount * qty).toFixed(2);

      csvContent += `${date},${name},${category},${price},${qty},${total}\n`;
    });

    const file = new File([csvContent], `peralog-backup-${getTodayISO()}.csv`, { type: "text/csv" });
    const now = Date.now();

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        localStorage.setItem(BACKUP_STORAGE_KEY, String(now));
        renderBackupBanner();
        return;
      } catch (err) {
        if (err.name === "AbortError") {
          return; // User closed share menu — do nothing
        }
        // Any other error falls through to download fallback
      }
    }

    // Fallback: download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `peralog-backup-${getTodayISO()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    localStorage.setItem(BACKUP_STORAGE_KEY, String(now));
    renderBackupBanner();
  }

  /**
   * Show the backup reminder banner when:
   * - expenses.length >= 5
   * - no last backup OR last backup older than 7 days
   * - no snooze OR snooze older than 1 day
   */
  function shouldShowBackupBanner(expenses) {
    if (!Array.isArray(expenses) || expenses.length < 5) return false;

    const lastBackup = localStorage.getItem(BACKUP_STORAGE_KEY);
    const lastSnooze = localStorage.getItem(SNOOZE_STORAGE_KEY);
    const now = Date.now();
    const MS_DAY = 86400000;

    if (lastBackup) {
      const age = now - parseInt(lastBackup, 10);
      if (age < 7 * MS_DAY) return false;
    }

    if (lastSnooze) {
      const age = now - parseInt(lastSnooze, 10);
      if (age < MS_DAY) return false;
    }

    return true;
  }

  function renderBackupBanner() {
    const banner = document.getElementById("backup-banner");
    if (!banner) return;
    const expenses = loadExpenses();
    if (shouldShowBackupBanner(expenses)) {
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  // Backup banner buttons
  const btnBackupNow = document.getElementById("btn-backup-now");
  const btnBackupLater = document.getElementById("btn-backup-later");

  if (btnBackupNow) {
    btnBackupNow.addEventListener("click", () => {
      exportBackup();
      renderBackupBanner();
    });
  }

  if (btnBackupLater) {
    btnBackupLater.addEventListener("click", () => {
      localStorage.setItem(SNOOZE_STORAGE_KEY, String(Date.now()));
      renderBackupBanner();
    });
  }

  // ========== CSV Import ==========
  const importButton = document.getElementById("btn-import");
  const fileInput = document.getElementById("file-import");

  importButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let text = e.target.result;

        // Strip UTF-8 BOM if present
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }

        const rows = parseCSV(text);
        if (rows.length === 0) throw new Error("Empty CSV");

        // Validate header row against expected export columns
        const EXPECTED = ["Date", "Item", "Category", "Price Each", "Quantity", "Total"];
        const headers = rows[0].map((h) => h.trim());
        if (headers.join(",") !== EXPECTED.join(",")) {
          showInfoToast("This doesn't look like a PeraLog file.");
          fileInput.value = "";
          return;
        }

        // Build frequency map of EXISTING expenses for dedup
        const existing = loadExpenses();
        const freqMap = new Map();
        for (const exp of existing) {
          const key =
            exp.date.substring(0, 10) +
            "|" +
            exp.name.trim().toLowerCase() +
            "|" +
            Number(exp.amount).toFixed(2) +
            "|" +
            (exp.quantity || 1);
          freqMap.set(key, (freqMap.get(key) || 0) + 1);
        }

        let imported = 0;
        let skipped = 0;
        const newExpenses = [];

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const dateStr = (row[0] || "").trim();
          const name = (row[1] || "").trim();
          const rawCategory = (row[2] || "").trim();
          const amountStr = (row[3] || "").trim();
          const qtyStr = (row[4] || "").trim();

          // Skip missing name
          if (!name) {
            skipped++;
            continue;
          }

          // Skip invalid amount (must be number > 0)
          const amount = parseFloat(amountStr);
          if (!Number.isFinite(amount) || amount <= 0) {
            skipped++;
            continue;
          }

          // Strict date validation (YYYY-MM-DD, no overflow dates)
          if (!isValidISODate(dateStr)) {
            skipped++;
            continue;
          }

          // Quantity defaults to 1
          const qty = parseInt(qtyStr, 10);
          const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;

          // Category defaults to Other
          const category = resolveCategory(rawCategory);

          // Dedup: compare against existing expenses only (never against other imported rows)
          const key =
            dateStr.substring(0, 10) +
            "|" +
            name.toLowerCase() +
            "|" +
            amount.toFixed(2) +
            "|" +
            quantity;
          const count = freqMap.get(key) || 0;
          if (count > 0) {
            freqMap.set(key, count - 1);
            skipped++;
          } else {
            newExpenses.push({
              id: crypto.randomUUID(),
              name,
              amount,
              quantity,
              date: dateStr,
              category,
            });
            imported++;
          }
        }

        if (imported > 0) {
          const merged = [...existing, ...newExpenses];
          saveExpenses(merged);
          renderCurrentList(merged);
          updateCurrentSummary(merged);
        }

        showInfoToast(`Imported ${imported}, skipped ${skipped}`);
        fileInput.value = "";
      } catch {
        showInfoToast("Failed to import CSV.");
        fileInput.value = "";
      }
    };
    reader.readAsText(file);
  });

  // ── Selection Mode & Bulk Actions ─────────────────────────────────────
  const getSelectedCheckboxes = () => {
    return Array.from(expenseList.querySelectorAll(".expense-checkbox:checked"));
  };

  const updateBulkDeleteButton = () => {
    const count = getSelectedCheckboxes().length;
    if (deleteSelectedButton) {
      deleteSelectedButton.textContent = `Delete (${count})`;
      deleteSelectedButton.disabled = count === 0;
    }
  };

  const enterSelectionMode = () => {
    isSelectionMode = true;
    document.body.classList.add("selection-mode");
    expenseList.classList.add("selection-mode");
    if (bulkActionBar) bulkActionBar.classList.remove("hidden");

    // Hide toggle bar entirely in selection mode
    expenseToggle.classList.add("hidden");
    expenseCollapsible.classList.add("hidden");

    if (selectButton) selectButton.setAttribute("aria-pressed", "true");
    if (accordionOpen || editId) {
      // Cancel any open add/edit form when selection mode starts
      resetExpenseForm();
    }
    updateBulkDeleteButton();
  };

  const exitSelectionMode = () => {
    isSelectionMode = false;
    document.body.classList.remove("selection-mode");
    expenseList.classList.remove("selection-mode");
    if (bulkActionBar) bulkActionBar.classList.add("hidden");

    // Restore toggle bar
    expenseToggle.classList.remove("hidden");
    expenseCollapsible.classList.remove("hidden");

    if (selectButton) selectButton.setAttribute("aria-pressed", "false");
    updateBulkDeleteButton();
  };

  if (selectButton) {
    selectButton.addEventListener("click", () => {
      if (isSelectionMode) {
        exitSelectionMode();
      } else {
        enterSelectionMode();
      }
    });
  }

  if (cancelSelectButton) {
    cancelSelectButton.addEventListener("click", exitSelectionMode);
  }

  if (selectAllButton) {
    selectAllButton.addEventListener("click", () => {
      const checkboxes = expenseList.querySelectorAll(".expense-checkbox");
      checkboxes.forEach(cb => {
        cb.checked = true;
      });
      updateBulkDeleteButton();
    });
  }

  const executeBulkDelete = (selectedCheckboxes) => {
    const count = selectedCheckboxes.length;
    if (count === 0) return;

    const selectedIds = new Set(selectedCheckboxes.map(cb => cb.dataset.id));
    const expenses = loadExpenses();

    // Compute and store originalIndex based on the item's position in the MAIN expenses array, NOT the displayed list order.
    // Do this before removing anything.
    const itemsToDelete = [];
    expenses.forEach((expense, index) => {
      if (selectedIds.has(expense.id)) {
        itemsToDelete.push({ expense, originalIndex: index });
      }
    });

    const updatedExpenses = expenses.filter(exp => !selectedIds.has(exp.id));
    saveExpenses(updatedExpenses);
    renderCurrentList(updatedExpenses);
    updateCurrentSummary(updatedExpenses);
    exitSelectionMode();

    showToast(itemsToDelete, `${count} expenses deleted.`);
  };

  if (deleteSelectedButton) {
    deleteSelectedButton.addEventListener("click", () => {
      const selectedCheckboxes = getSelectedCheckboxes();
      const count = selectedCheckboxes.length;
      if (count === 0) return;

      if (confirmDialog && confirmDialogTitle) {
        confirmDialogTitle.textContent = `Delete ${count} expenses?`;

        // Populate the preview card with the count and combined total.
        const selectedIds = new Set(selectedCheckboxes.map(cb => cb.dataset.id));
        const expenses = loadExpenses();
        let total = 0;
        expenses.forEach(exp => {
          if (selectedIds.has(exp.id)) {
            total += exp.amount * (exp.quantity || 1);
          }
        });
        if (deletePreviewItems) {
          deletePreviewItems.textContent = `${count} item${count === 1 ? "" : "s"} selected`;
        }
        if (deletePreviewTotal) {
          deletePreviewTotal.textContent = `Total: ${formatCurrency(total)}`;
        }

        confirmDialog.showModal();
        if (dialogCancelButton) dialogCancelButton.focus();
      }
    });
  }

  if (dialogCancelButton) {
    dialogCancelButton.addEventListener("click", () => {
      if (confirmDialog) confirmDialog.close();
    });
  }

  if (dialogConfirmButton) {
    dialogConfirmButton.addEventListener("click", () => {
      if (confirmDialog) confirmDialog.close();
      executeBulkDelete(getSelectedCheckboxes());
    });
  }

  // ── Long-Press Selection Logic (Pointer Events) ───────────────────────
  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressTarget = null;
  };

  expenseList.addEventListener("pointerdown", (e) => {
    if (isSelectionMode) return;
    if (e.target.closest("button, input[type='checkbox']")) return;

    const item = e.target.closest(".expense-item");
    if (!item) return;

    cancelLongPress();
    longPressTarget = item;
    startX = e.clientX;
    startY = e.clientY;

    longPressTimer = setTimeout(() => {
      if (longPressTarget) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 400);
        enterSelectionMode();
        const checkbox = longPressTarget.querySelector(".expense-checkbox");
        if (checkbox) {
          checkbox.checked = true;
          updateBulkDeleteButton();
        }
      }
      cancelLongPress();
    }, 500);
  });

  expenseList.addEventListener("pointermove", (e) => {
    if (!longPressTimer) return;
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (dist > 10) {
      cancelLongPress();
    }
  });

  expenseList.addEventListener("pointerup", cancelLongPress);
  expenseList.addEventListener("pointercancel", cancelLongPress);

  expenseList.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".expense-item")) {
      e.preventDefault();
    }
  });

  // ── Delete handler (event delegation on the list) ─────────────────────
  expenseList.addEventListener("click", (e) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }

    if (isSelectionMode) {
      const item = e.target.closest(".expense-item");
      if (!item) return;

      const checkbox = item.querySelector(".expense-checkbox");
      if (!checkbox) return;

      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }
      updateBulkDeleteButton();
      return;
    }

    const btn = e.target.closest(".btn-delete");
    if (btn) {
      const expenses = loadExpenses();
      const index = expenses.findIndex(exp => exp.id === btn.dataset.id);
      if (index === -1) return;

      const [deletedExpense] = expenses.splice(index, 1);
      saveExpenses(expenses);
      renderCurrentList(expenses);
      updateCurrentSummary(expenses);
      showToast([{ expense: deletedExpense, originalIndex: index }], "Expense deleted.");
      return;
    }

    const item = e.target.closest(".expense-item");
    if (!item) return;

    startEdit(item.dataset.id);
  });

  undoButton.addEventListener("click", () => {
    if (!pendingDeletion || pendingDeletion.length === 0) return;

    const expenses = loadExpenses();
    // Sort the saved array by originalIndex ASCENDING
    const itemsToRestore = [...pendingDeletion].sort((a, b) => a.originalIndex - b.originalIndex);
    for (const item of itemsToRestore) {
      expenses.splice(Math.min(item.originalIndex, expenses.length), 0, item.expense);
    }
    saveExpenses(expenses);
    renderCurrentList(expenses);
    updateCurrentSummary(expenses);
    hideToast();
  });

  cancelButton.addEventListener("click", resetExpenseForm);

  // ── Form submit handler ───────────────────────────────────────────────
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!validateForm(nameInput, amountInput, quantityInput, dateInput, categorySel)) return;

    const expenseData = {
      name:     nameInput.value.trim(),
      amount:   parseFloat(parseFloat(amountInput.value).toFixed(2)),
      quantity: parseInt(quantityInput.value, 10),
      date:     dateInput.value,
      category: categorySel.value,
    };

    const expenses = loadExpenses();
    const wasEditing = Boolean(editId);
    if (editId) {
      const index = expenses.findIndex(exp => exp.id === editId);
      if (index !== -1) expenses[index] = { ...expenses[index], ...expenseData };
    } else {
      expenses.push({
        id: crypto.randomUUID(),
        ...expenseData,
      });
    }

    saveExpenses(expenses);
    renderCurrentList(expenses);
    updateCurrentSummary(expenses);

    // Collapse accordion and show toast
    if (wasEditing) {
      showInfoToast("Expense updated");
    } else {
      showInfoToast("Expense added");
    }

    // Reset form state
    resetExpenseForm();
  });

  // ── Clear invalid styling as user corrects each field ─────────────────
  [nameInput, amountInput, quantityInput, dateInput, categorySel].forEach(el => {
    el.addEventListener("input", () => el.classList.remove("invalid"));
  });

  // ── Boot: restore list + summary from localStorage ────────────────────
  const today = getTodayISO();
  dateInput.value = today;
  dateInput.max = today;
  const saved = loadExpenses();
  renderCurrentList(saved);
  updateCurrentSummary(saved);
  updateCurrencyLabels();
  renderBackupBanner();

  // Auto-open currency picker on first launch (no saved currency and no expenses)
  const savedCurrencyForAuto = localStorage.getItem(CURRENCY_STORAGE_KEY);
  if (!savedCurrencyForAuto && saved.length === 0 && currencyDialog) {
    currencyDialog.showModal();
  }

  // Prevent scroll wheel from changing number inputs
  document.addEventListener("wheel", (e) => {
    if (document.activeElement.type === "number") {
      document.activeElement.blur();
    }
  });

  // Escape key exits selection mode
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isSelectionMode) {
      exitSelectionMode();
    }
  });
}

// Entry point — safe to call even if the script loads before some elements
document.addEventListener("DOMContentLoaded", init);
