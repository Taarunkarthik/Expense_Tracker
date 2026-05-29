export type MonthKey = `${number}-${string}`;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type Category = {
  id: string;
  name: string;
  color: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: string;
  spentAt: string;
  note: string | null;
  categoryId: string | null;
  category: Category | null;
};

export type Budget = {
  id: string;
  categoryId: string;
  month: string;
  amount: string;
  category: Category;
};

export type RecurringExpense = {
  id: string;
  title: string;
  amount: string;
  interval: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  nextRunAt: string;
  active: boolean;
  categoryId: string | null;
  category: Category | null;
};

export type DashboardSummary = {
  month: string;
  totalSpent: number;
  totalBudget: number;
  remainingBudget: number;
  categoryBreakdown: Array<{
    categoryId: string | null;
    categoryName: string;
    categoryColor: string;
    spent: number;
    budget: number;
  }>;
  recurringCount: number;
};
