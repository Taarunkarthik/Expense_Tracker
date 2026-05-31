import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AuthUser, Budget, Category, DashboardSummary, Expense, RecurringExpense } from "../../shared/types";
import { api } from "./lib/api";

type AuthMode = "login" | "register";

type AuthState = {
  name: string;
  email: string;
  password: string;
};

type ExpenseFormState = {
  title: string;
  amount: string;
  spentAt: string;
  categoryId: string;
  note: string;
};

type BudgetFormState = {
  categoryId: string;
  amount: string;
  month: string;
};

type RecurringFormState = {
  title: string;
  amount: string;
  categoryId: string;
  interval: RecurringExpense["interval"];
  nextRunAt: string;
};

const currentMonth = new Date().toISOString().slice(0, 7);
const today = new Date().toISOString().slice(0, 10);
const guestUser: AuthUser = {
  id: "guest",
  name: "Guest",
  email: "guest@example.com",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function toFormDate(value: string) {
  return value.slice(0, 10);
}

function toIsoFromDateInput(value: string) {
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [auth, setAuth] = useState<AuthState>({ name: "", email: "", password: "" });
  const [token, setToken] = useState<string | null>(localStorage.getItem("expense-tracker-token"));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>({
    title: "",
    amount: "",
    spentAt: today,
    categoryId: "",
    note: "",
  });
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>({
    categoryId: "",
    amount: "",
    month: currentMonth,
  });
  const [recurringForm, setRecurringForm] = useState<RecurringFormState>({
    title: "",
    amount: "",
    categoryId: "",
    interval: "MONTHLY",
    nextRunAt: today,
  });

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!token) {
        setBootstrapping(false);
        return;
      }

      try {
        const response = await api.get<{ user: AuthUser }>("/auth/me", token);
        if (!active) return;
        setGuestMode(false);
        setUser(response.user);
        await loadDashboard(token, month);
      } catch (error) {
        if (!active) return;
        setToken(null);
        localStorage.removeItem("expense-tracker-token");
        setMessage(error instanceof Error ? error.message : "Session expired");
      } finally {
        if (active) setBootstrapping(false);
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user && token) {
      void loadDashboard(token, month);
    } else if (guestMode && user) {
      void loadDashboard(null, month);
    }
  }, [month, token, user, guestMode]);

  async function loadDashboard(sessionToken: string | null, selectedMonth: string) {
    setLoading(true);
    try {
      const categoriesResponse = await api.get<{ categories: Category[] }>("/categories");

      if (!sessionToken) {
        setSummary({
          month: selectedMonth,
          totalSpent: 0,
          totalBudget: 0,
          remainingBudget: 0,
          categoryBreakdown: [],
          recurringCount: 0,
        });
        setCategories(categoriesResponse.categories);
        setExpenses([]);
        setBudgets([]);
        setRecurring([]);
        if (!budgetForm.categoryId && categoriesResponse.categories[0]) {
          setBudgetForm((current) => ({ ...current, categoryId: categoriesResponse.categories[0].id }));
        }
        if (!expenseForm.categoryId && categoriesResponse.categories[0]) {
          setExpenseForm((current) => ({ ...current, categoryId: categoriesResponse.categories[0].id }));
        }
        if (!recurringForm.categoryId && categoriesResponse.categories[0]) {
          setRecurringForm((current) => ({ ...current, categoryId: categoriesResponse.categories[0].id }));
        }
        return;
      }

      const [summaryResponse, expensesResponse, budgetsResponse, recurringResponse] = await Promise.all([
        api.get<{ summary: DashboardSummary }>(`/dashboard/summary?month=${selectedMonth}`, sessionToken),
        api.get<{ expenses: Expense[] }>(`/expenses?month=${selectedMonth}`, sessionToken),
        api.get<{ budgets: Budget[] }>(`/budgets?month=${selectedMonth}`, sessionToken),
        api.get<{ recurring: RecurringExpense[] }>("/recurring", sessionToken),
      ]);

      setSummary(summaryResponse.summary);
      setCategories(categoriesResponse.categories);
      setExpenses(expensesResponse.expenses);
      setBudgets(budgetsResponse.budgets);
      setRecurring(recurringResponse.recurring);
      if (!budgetForm.categoryId && categoriesResponse.categories[0]) {
        setBudgetForm((current) => ({ ...current, categoryId: categoriesResponse.categories[0].id }));
      }
      if (!expenseForm.categoryId && categoriesResponse.categories[0]) {
        setExpenseForm((current) => ({ ...current, categoryId: categoriesResponse.categories[0].id }));
      }
      if (!recurringForm.categoryId && categoriesResponse.categories[0]) {
        setRecurringForm((current) => ({ ...current, categoryId: categoriesResponse.categories[0].id }));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleAuthSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    try {
      const response = authMode === "register"
        ? await api.post<{ token: string; user: AuthUser }>("/auth/register", auth)
        : await api.post<{ token: string; user: AuthUser }>("/auth/login", {
            email: auth.email,
            password: auth.password,
          });

      setGuestMode(false);
      localStorage.setItem("expense-tracker-token", response.token);
      setToken(response.token);
      setUser(response.user);
      await loadDashboard(response.token, month);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    }
  }

  async function continueAsGuest() {
    setMessage("Browsing as a guest. Sign in to save data.");
    setGuestMode(true);
    setToken(null);
    localStorage.removeItem("expense-tracker-token");
    setUser(guestUser);
    await loadDashboard(null, month);
  }

  async function handleExpenseSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    setMessage(null);

    const payload = {
      title: expenseForm.title,
      amount: Number(expenseForm.amount),
      spentAt: toIsoFromDateInput(expenseForm.spentAt),
      categoryId: expenseForm.categoryId || null,
      note: expenseForm.note.trim() ? expenseForm.note : null,
    };

    try {
      if (editingExpenseId) {
        await api.put(`/expenses/${editingExpenseId}`, payload, token);
      } else {
        await api.post("/expenses", payload, token);
      }

      setExpenseForm({ title: "", amount: "", spentAt: today, categoryId: categories[0]?.id ?? "", note: "" });
      setEditingExpenseId(null);
      await loadDashboard(token, month);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save expense");
    }
  }

  async function handleBudgetSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    setMessage(null);
    try {
      await api.post("/budgets", {
        categoryId: budgetForm.categoryId,
        month: budgetForm.month,
        amount: Number(budgetForm.amount),
      }, token);
      setBudgetForm((current) => ({ ...current, amount: "" }));
      await loadDashboard(token, month);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save budget");
    }
  }

  async function handleRecurringSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    setMessage(null);
    try {
      await api.post("/recurring", {
        title: recurringForm.title,
        amount: Number(recurringForm.amount),
        interval: recurringForm.interval,
        nextRunAt: toIsoFromDateInput(recurringForm.nextRunAt),
        categoryId: recurringForm.categoryId || null,
        active: true,
      }, token);
      setRecurringForm((current) => ({ ...current, title: "", amount: "", nextRunAt: today }));
      await loadDashboard(token, month);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save recurring expense");
    }
  }

  async function deleteExpense(expenseId: string) {
    if (!token) return;
    await api.delete(`/expenses/${expenseId}`, token);
    await loadDashboard(token, month);
  }

  async function deleteBudget(budgetId: string) {
    if (!token) return;
    await api.delete(`/budgets/${budgetId}`, token);
    await loadDashboard(token, month);
  }

  async function toggleRecurring(item: RecurringExpense) {
    if (!token) return;
    await api.patch(`/recurring/${item.id}`, { active: !item.active }, token);
    await loadDashboard(token, month);
  }

  async function deleteRecurring(itemId: string) {
    if (!token) return;
    await api.delete(`/recurring/${itemId}`, token);
    await loadDashboard(token, month);
  }

  function startEditExpense(expense: Expense) {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      title: expense.title,
      amount: expense.amount,
      spentAt: toFormDate(expense.spentAt),
      categoryId: expense.categoryId ?? "",
      note: expense.note ?? "",
    });
  }

  function clearExpenseForm() {
    setEditingExpenseId(null);
    setExpenseForm({
      title: "",
      amount: "",
      spentAt: today,
      categoryId: categories[0]?.id ?? "",
      note: "",
    });
  }

  function exportCsv() {
    const header = ["Title", "Amount", "Date", "Category", "Note"];
    const rows = expenses.map((expense) => [
      expense.title,
      expense.amount,
      expense.spentAt.slice(0, 10),
      expense.category?.name ?? "Uncategorized",
      expense.note ?? "",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `expenses-${month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function signOut() {
    localStorage.removeItem("expense-tracker-token");
    setToken(null);
    setUser(null);
    setGuestMode(false);
    setSummary(null);
    setExpenses([]);
    setBudgets([]);
    setRecurring([]);
    setCategories([]);
  }

  if (bootstrapping) {
    return <div className="screen center"><div className="card">Loading your tracker...</div></div>;
  }

  if (!user) {
    return (
      <div className="auth-shell">
        <div className="auth-hero">
          <p className="eyebrow">Monthly expense control</p>
          <h1>Track spending with one clear dashboard.</h1>
          <p>
            Log monthly expenses, set budgets, follow recurring bills, and export data whenever you need it.
          </p>
        </div>

        <form className="card auth-card" onSubmit={handleAuthSubmit}>
          <button type="button" className="primary" onClick={() => void continueAsGuest()}>
            Continue as guest
          </button>

          <p className="message">
            Guest mode opens the app without an account. You can browse the dashboard, then sign in when you want to save changes.
          </p>

          <div className="toggle-row">
            <button type="button" className={authMode === "login" ? "toggle active" : "toggle"} onClick={() => setAuthMode("login")}>Login</button>
            <button type="button" className={authMode === "register" ? "toggle active" : "toggle"} onClick={() => setAuthMode("register")}>Register</button>
          </div>

          <label>
            Email
            <input type="email" value={auth.email} onChange={(event) => setAuth({ ...auth, email: event.target.value })} required />
          </label>

          {authMode === "register" && (
            <label>
              Name
              <input type="text" value={auth.name} onChange={(event) => setAuth({ ...auth, name: event.target.value })} required />
            </label>
          )}

          <label>
            Password
            <input type="password" value={auth.password} onChange={(event) => setAuth({ ...auth, password: event.target.value })} required minLength={8} />
          </label>

          <button className="primary" type="submit">
            {authMode === "register" ? "Create account" : "Sign in"}
          </button>

          {message && <p className="message">{message}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar card">
        <div>
          <p className="eyebrow">Expense Tracker</p>
          <h1>Hello, {guestMode ? "Guest" : user.name}</h1>
          <p>{guestMode ? "Browse the dashboard first, then sign in to save your own data." : "Keep every month organized from one workspace."}</p>
        </div>

        <div className="topbar-actions">
          <label>
            Month
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          {guestMode
            ? <button className="ghost" type="button" onClick={signOut}>Back to login</button>
            : <button className="ghost" type="button" onClick={signOut}>Sign out</button>}
          <button className="ghost" type="button" onClick={exportCsv}>Export CSV</button>
        </div>
      </header>

      {message && <div className="card message-banner">{message}</div>}

      <section className="stats-grid">
        <article className="stat card accent-a">
          <span>Total spent</span>
          <strong>{summary ? formatMoney(summary.totalSpent) : "-"}</strong>
        </article>
        <article className="stat card accent-b">
          <span>Total budget</span>
          <strong>{summary ? formatMoney(summary.totalBudget) : "-"}</strong>
        </article>
        <article className="stat card accent-c">
          <span>Remaining</span>
          <strong>{summary ? formatMoney(summary.remainingBudget) : "-"}</strong>
        </article>
        <article className="stat card accent-d">
          <span>Recurring items</span>
          <strong>{summary?.recurringCount ?? 0}</strong>
        </article>
      </section>

      <main className="dashboard-grid">
        <section className="column">
          <div className="card panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Add expense</p>
                <h2>{editingExpenseId ? "Edit transaction" : "New transaction"}</h2>
              </div>
              {editingExpenseId && (
                <button className="ghost" type="button" onClick={clearExpenseForm}>Cancel edit</button>
              )}
            </div>

            <form className="form-grid" onSubmit={handleExpenseSubmit}>
              <label>
                Title
                <input value={expenseForm.title} onChange={(event) => setExpenseForm({ ...expenseForm, title: event.target.value })} required />
              </label>
              <label>
                Amount
                <input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} required />
              </label>
              <label>
                Date
                <input type="date" value={expenseForm.spentAt} onChange={(event) => setExpenseForm({ ...expenseForm, spentAt: event.target.value })} required />
              </label>
              <label>
                Category
                <select value={expenseForm.categoryId} onChange={(event) => setExpenseForm({ ...expenseForm, categoryId: event.target.value })}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="span-2">
                Note
                <textarea rows={3} value={expenseForm.note} onChange={(event) => setExpenseForm({ ...expenseForm, note: event.target.value })} />
              </label>
              <button className="primary span-2" type="submit">{editingExpenseId ? "Save changes" : "Add expense"}</button>
            </form>
          </div>

          <div className="card panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Expenses</p>
                <h2>{month}</h2>
              </div>
            </div>

            <div className="list">
              {expenses.length === 0 && <p className="empty">No expenses for this month yet.</p>}
              {expenses.map((expense) => (
                <article className="list-row" key={expense.id}>
                  <div>
                    <strong>{expense.title}</strong>
                    <p>{expense.category?.name ?? "Uncategorized"} · {expense.spentAt.slice(0, 10)}</p>
                    {expense.note && <small>{expense.note}</small>}
                  </div>
                  <div className="row-actions">
                    <strong>{formatMoney(Number(expense.amount))}</strong>
                    <button type="button" className="ghost" onClick={() => startEditExpense(expense)}>Edit</button>
                    <button type="button" className="ghost danger" onClick={() => deleteExpense(expense.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="column">
          <div className="card panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Monthly budget</p>
                <h2>Budget targets</h2>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleBudgetSubmit}>
              <label>
                Category
                <select value={budgetForm.categoryId} onChange={(event) => setBudgetForm({ ...budgetForm, categoryId: event.target.value })}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>
                Month
                <input type="month" value={budgetForm.month} onChange={(event) => setBudgetForm({ ...budgetForm, month: event.target.value })} />
              </label>
              <label>
                Amount
                <input type="number" min="0" step="0.01" value={budgetForm.amount} onChange={(event) => setBudgetForm({ ...budgetForm, amount: event.target.value })} required />
              </label>
              <button className="primary" type="submit">Save budget</button>
            </form>

            <div className="mini-list">
              {budgets.length === 0 && <p className="empty">No budgets set for this month.</p>}
              {budgets.map((budget) => (
                <div className="mini-row" key={budget.id}>
                  <div>
                    <strong>{budget.category.name}</strong>
                    <p>{budget.month}</p>
                  </div>
                  <div className="row-actions">
                    <strong>{formatMoney(Number(budget.amount))}</strong>
                    <button type="button" className="ghost danger" onClick={() => deleteBudget(budget.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Recurring expenses</p>
                <h2>Scheduled items</h2>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleRecurringSubmit}>
              <label>
                Title
                <input value={recurringForm.title} onChange={(event) => setRecurringForm({ ...recurringForm, title: event.target.value })} required />
              </label>
              <label>
                Amount
                <input type="number" min="0" step="0.01" value={recurringForm.amount} onChange={(event) => setRecurringForm({ ...recurringForm, amount: event.target.value })} required />
              </label>
              <label>
                Category
                <select value={recurringForm.categoryId} onChange={(event) => setRecurringForm({ ...recurringForm, categoryId: event.target.value })}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>
                Interval
                <select value={recurringForm.interval} onChange={(event) => setRecurringForm({ ...recurringForm, interval: event.target.value as RecurringExpense["interval"] })}>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </label>
              <label>
                Next run
                <input type="date" value={recurringForm.nextRunAt} onChange={(event) => setRecurringForm({ ...recurringForm, nextRunAt: event.target.value })} required />
              </label>
              <button className="primary" type="submit">Save recurring item</button>
            </form>

            <div className="mini-list">
              {recurring.length === 0 && <p className="empty">No recurring expenses yet.</p>}
              {recurring.map((item) => (
                <div className="mini-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.category?.name ?? "Uncategorized"} · {item.interval.toLowerCase()}</p>
                    <small>Next run: {item.nextRunAt.slice(0, 10)}</small>
                  </div>
                  <div className="row-actions">
                    <strong>{formatMoney(Number(item.amount))}</strong>
                    <button type="button" className="ghost" onClick={() => toggleRecurring(item)}>{item.active ? "Pause" : "Resume"}</button>
                    <button type="button" className="ghost danger" onClick={() => deleteRecurring(item.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="column wide">
          <div className="card panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Monthly summary</p>
                <h2>Budget progress by category</h2>
              </div>
            </div>

            <div className="summary-list">
              {(summary?.categoryBreakdown ?? []).map((entry) => {
                const progress = entry.budget > 0 ? Math.min(100, (entry.spent / entry.budget) * 100) : 0;
                return (
                  <article className="summary-row" key={`${entry.categoryName}-${entry.categoryId ?? "none"}`}>
                    <div className="summary-label">
                      <span className="color-dot" style={{ backgroundColor: entry.categoryColor }} />
                      <strong>{entry.categoryName}</strong>
                    </div>
                    <div className="summary-values">
                      <span>{formatMoney(entry.spent)} spent</span>
                      <span>{entry.budget > 0 ? formatMoney(entry.budget) : "No budget"}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                  </article>
                );
              })}
              {summary?.categoryBreakdown.length === 0 && <p className="empty">Set a budget or spend in a category to see its progress here.</p>}
            </div>
          </div>
        </section>
      </main>

      {loading && <div className="loading-indicator">Refreshing data...</div>}
    </div>
  );
}
