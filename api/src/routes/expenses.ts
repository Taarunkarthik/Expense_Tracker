import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireUser, type AuthedRequest } from "../middleware/auth.js";

export const expensesRouter = Router();

const expenseSchema = z.object({
  title: z.string().min(2),
  amount: z.union([z.number(), z.string()]).transform((value) => Number(value)),
  spentAt: z.string().datetime(),
  categoryId: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

function monthRange(month?: string) {
  const value = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const [year, monthIndex] = value.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 1));
  return { month: value, start, end };
}

function serializeExpense(expense: {
  id: string;
  title: string;
  amount: { toString(): string };
  spentAt: Date;
  note: string | null;
  categoryId: string | null;
  category: { id: string; name: string; color: string } | null;
}) {
  return {
    id: expense.id,
    title: expense.title,
    amount: expense.amount.toString(),
    spentAt: expense.spentAt.toISOString(),
    note: expense.note,
    categoryId: expense.categoryId,
    category: expense.category,
  };
}

expensesRouter.get("/", requireUser, async (req: AuthedRequest, res) => {
  const requestedMonth = typeof req.query.month === "string" ? req.query.month : undefined;
  const { month, start, end } = monthRange(requestedMonth);

  const expenses = await prisma.expense.findMany({
    where: {
      userId: req.user!.userId,
      spentAt: { gte: start, lt: end },
    },
    include: { category: true },
    orderBy: { spentAt: "desc" },
  });

  res.json({ month, expenses: expenses.map(serializeExpense) });
});

expensesRouter.post("/", requireUser, async (req: AuthedRequest, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid payload" });
    return;
  }

  const expense = await prisma.expense.create({
    data: {
      userId: req.user!.userId,
      title: parsed.data.title,
      amount: parsed.data.amount,
      spentAt: new Date(parsed.data.spentAt),
      categoryId: parsed.data.categoryId ?? null,
      note: parsed.data.note ?? null,
    },
    include: { category: true },
  });

  res.status(201).json({ expense: serializeExpense(expense) });
});

expensesRouter.put("/:id", requireUser, async (req: AuthedRequest, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid payload" });
    return;
  }

  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });

  if (!existing) {
    res.status(404).json({ message: "Expense not found" });
    return;
  }

  const expense = await prisma.expense.update({
    where: { id: req.params.id },
    data: {
      title: parsed.data.title,
      amount: parsed.data.amount,
      spentAt: new Date(parsed.data.spentAt),
      categoryId: parsed.data.categoryId ?? null,
      note: parsed.data.note ?? null,
    },
    include: { category: true },
  });

  res.json({ expense: serializeExpense(expense) });
});

expensesRouter.delete("/:id", requireUser, async (req: AuthedRequest, res) => {
  const existing = await prisma.expense.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
  });

  if (!existing) {
    res.status(404).json({ message: "Expense not found" });
    return;
  }

  await prisma.expense.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
