import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getOptionalUser, requireUser, type AuthedRequest } from "../middleware/auth.js";

export const budgetsRouter = Router();

const budgetSchema = z.object({
  categoryId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.union([z.number(), z.string()]).transform((value) => Number(value)),
});

budgetsRouter.get("/", async (req: AuthedRequest, res) => {
  const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month)
    ? req.query.month
    : new Date().toISOString().slice(0, 7);

  const user = getOptionalUser(req);

  if (!user) {
    res.json({ budgets: [] });
    return;
  }

  const budgets = await prisma.budget.findMany({
    where: { userId: user.userId, month },
    include: { category: true },
    orderBy: { updatedAt: "desc" },
  });

  res.json({ budgets: budgets.map((budget: {
    id: string;
    categoryId: string;
    month: string;
    amount: { toString(): string };
    category: { id: string; name: string; color: string };
  }) => ({
    id: budget.id,
    categoryId: budget.categoryId,
    month: budget.month,
    amount: budget.amount.toString(),
    category: budget.category,
  })) });
});

budgetsRouter.post("/", requireUser, async (req: AuthedRequest, res) => {
  const parsed = budgetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid payload" });
    return;
  }

  const budget = await prisma.budget.upsert({
    where: {
      userId_categoryId_month: {
        userId: req.user!.userId,
        categoryId: parsed.data.categoryId,
        month: parsed.data.month,
      },
    },
    create: {
      userId: req.user!.userId,
      categoryId: parsed.data.categoryId,
      month: parsed.data.month,
      amount: parsed.data.amount,
    },
    update: {
      amount: parsed.data.amount,
    },
    include: { category: true },
  });

  res.status(201).json({ budget: {
    id: budget.id,
    categoryId: budget.categoryId,
    month: budget.month,
    amount: budget.amount.toString(),
    category: budget.category,
  } });
});

budgetsRouter.delete("/:id", requireUser, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await prisma.budget.findFirst({
    where: { id, userId: req.user!.userId },
  });

  if (!existing) {
    res.status(404).json({ message: "Budget not found" });
    return;
  }

  await prisma.budget.delete({ where: { id } });
  res.status(204).send();
});
