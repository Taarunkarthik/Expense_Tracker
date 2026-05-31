import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getOptionalUser, type AuthedRequest } from "../middleware/auth.js";

export const dashboardRouter = Router();

function monthRange(month?: string) {
  const value = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const [year, monthIndex] = value.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 1));
  return { month: value, start, end };
}

dashboardRouter.get("/summary", async (req: AuthedRequest, res) => {
  const requestedMonth = typeof req.query.month === "string" ? req.query.month : undefined;
  const { month, start, end } = monthRange(requestedMonth);
  const user = getOptionalUser(req);

  if (!user) {
    res.json({
      summary: {
        month,
        totalSpent: 0,
        totalBudget: 0,
        remainingBudget: 0,
        recurringCount: 0,
        categoryBreakdown: [],
      },
    });
    return;
  }

  const [expenses, budgets, recurring] = await Promise.all([
    prisma.expense.findMany({
      where: { userId: user.userId, spentAt: { gte: start, lt: end } },
      include: { category: true },
    }),
    prisma.budget.findMany({
      where: { userId: user.userId, month },
      include: { category: true },
    }),
    prisma.recurringExpense.count({
      where: { userId: user.userId, active: true },
    }),
  ]);

  const totalSpent = expenses.reduce((sum: number, expense: { amount: { toString(): string } }) => sum + Number(expense.amount), 0);
  const totalBudget = budgets.reduce((sum: number, budget: { amount: { toString(): string } }) => sum + Number(budget.amount), 0);

  const spendingByCategory = new Map<string, { name: string; color: string; spent: number; budget: number }>();

  for (const budget of budgets) {
    spendingByCategory.set(budget.categoryId, {
      name: budget.category.name,
      color: budget.category.color,
      spent: 0,
      budget: Number(budget.amount),
    });
  }

  for (const expense of expenses) {
    const key = expense.categoryId ?? "uncategorized";
    const current = spendingByCategory.get(key) ?? {
      name: expense.category?.name ?? "Uncategorized",
      color: expense.category?.color ?? "#64748b",
      spent: 0,
      budget: 0,
    };

    current.spent += Number(expense.amount);
    spendingByCategory.set(key, current);
  }

  res.json({
    summary: {
      month,
      totalSpent,
      totalBudget,
      remainingBudget: totalBudget - totalSpent,
      recurringCount: recurring,
      categoryBreakdown: Array.from(spendingByCategory.entries()).map(([categoryId, value]) => ({
        categoryId: categoryId === "uncategorized" ? null : categoryId,
        categoryName: value.name,
        categoryColor: value.color,
        spent: value.spent,
        budget: value.budget,
      })),
    },
  });
});
