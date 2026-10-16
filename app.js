"use strict";

/* =============================================
   Constants  (module-level: immutable, no pollution risk)
   ============================================= */
const STORAGE_KEY = "expense_tracker_v1";
const THEME_STORAGE_KEY = "expense_tracker_theme";

/** Philippine Peso symbol */
const CURRENCY = "\u20B1";

/** Format a numeric amount for display without changing its stored value. */
function formatCurrency(amount) {
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const CATEGORY_ICONS = {
  Food:          "\u{1F354}",
  Transport:     "\u{1F68C}",
  Books:         "\u{1F4DA}",
  Entertainment: "\u{1F3AC}",
  Other:         "\u{1F4E6}",
};

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

/* =============================================
   Date Boundary Helpers
   ============================================= */

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
      const d = new Date(exp.date);

      // Skip future-dated entries entirely
      if (d >= tomorrow) return acc;

      if (d >= weekStart)  acc.weekTotal  += exp.amount;
      if (d >= monthStart) acc.monthTotal += exp.amount;

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
function updateSummary(expenses) {
  const { weekTotal, monthTotal } = calcSummaryTotals(expenses);
  document.getElementById("total-week").textContent  = CURRENCY + formatCurrency(weekTotal);
  document.getElementById("total-month").textContent = CURRENCY + formatCurrency(monthTotal);
}

/* =============================================
   Validation
   ============================================= */

/**
 * Validates the form fields and populates inline error messages.
 * @param {HTMLElement} nameInput
 * @param {HTMLElement} amountInput
 * @param {HTMLElement} categorySel
 * @returns {boolean} true when all fields pass
 */
function validateForm(nameInput, amountInput, categorySel) {
  let valid = true;

  const errorName     = document.getElementById("error-name");
  const errorAmount   = document.getElementById("error-amount");
  const errorCategory = document.getElementById("error-category");

  [nameInput, amountInput, categorySel].forEach(el => el.classList.remove("invalid"));
  [errorName, errorAmount, errorCategory].forEach(el => (el.textContent = ""));

  if (!nameInput.value.trim()) {
    nameInput.classList.add("invalid");
    errorName.textContent = "Please tell us what you bought.";
    valid = false;
  }

  const amt = parseFloat(amountInput.value);
  if (!amountInput.value || isNaN(amt) || amt <= 0) {
    amountInput.classList.add("invalid");
    errorAmount.textContent = "Please enter an amount greater than \u20B10.";
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
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

/**
 * Build a single <li> element for one expense, including a delete button.
 * @param {{id: string, name: string, amount: number, category: string, date: string}} expense
 * @returns {HTMLLIElement}
 */
function createExpenseItem(expense) {
  const li = document.createElement("li");
  li.className = "expense-item";
  li.dataset.id = expense.id;

  const icon = CATEGORY_ICONS[expense.category] || "\u{1F4E6}";

  li.innerHTML = `
    <div class="expense-info">
      <span class="expense-name">${escapeHTML(expense.name)}</span>
      <div class="expense-meta">
        <span class="expense-date">${formatDate(expense.date)}</span>
        <span class="expense-badge">${icon} ${escapeHTML(expense.category)}</span>
      </div>
    </div>
    <div class="expense-right">
      <span class="expense-amount">${CURRENCY}${formatCurrency(expense.amount)}</span>
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
function renderList(expenses, listEl, emptyEl, categoryFilter = "") {
  listEl.innerHTML = "";

  const visibleExpenses = categoryFilter
    ? expenses.filter(exp => exp.category === categoryFilter)
    : expenses;

  if (visibleExpenses.length === 0) {
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  [...visibleExpenses].reverse().forEach(exp => listEl.appendChild(createExpenseItem(exp)));
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
  const categorySel = document.getElementById("category");
  const expenseList = document.getElementById("expense-list");
  const emptyState  = document.getElementById("empty-state");
  const filterSel   = document.getElementById("filter-category");
  const themeToggle = document.getElementById("theme-toggle");

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

  const renderCurrentList = (expenses) => {
    renderList(expenses, expenseList, emptyState, filterSel.value);
  };

  filterSel.addEventListener("change", () => {
    renderCurrentList(loadExpenses());
  });

  // ── Delete handler (event delegation on the list) ─────────────────────
  expenseList.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-delete");
    if (!btn) return;

    const updated = loadExpenses().filter(exp => exp.id !== btn.dataset.id);
    saveExpenses(updated);
    renderCurrentList(updated);
    updateSummary(updated);
  });

  // ── Form submit handler ───────────────────────────────────────────────
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!validateForm(nameInput, amountInput, categorySel)) return;

    const expense = {
      id:       crypto.randomUUID(),
      name:     nameInput.value.trim(),
      amount:   parseFloat(parseFloat(amountInput.value).toFixed(2)),
      category: categorySel.value,
      date:     new Date().toISOString(),
    };

    const expenses = loadExpenses();
    expenses.push(expense);
    saveExpenses(expenses);
    renderCurrentList(expenses);
    updateSummary(expenses);

    form.reset();
    nameInput.focus();
  });

  // ── Clear invalid styling as user corrects each field ─────────────────
  [nameInput, amountInput, categorySel].forEach(el => {
    el.addEventListener("input", () => el.classList.remove("invalid"));
  });

  // ── Boot: restore list + summary from localStorage ────────────────────
  const saved = loadExpenses();
  renderCurrentList(saved);
  updateSummary(saved);
}

// Entry point — safe to call even if the script loads before some elements
document.addEventListener("DOMContentLoaded", init);
