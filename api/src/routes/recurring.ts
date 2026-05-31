import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getOptionalUser, requireUser, type AuthedRequest } from "../middleware/auth.js";

export const recurringRouter = Router();

const recurringSchema = z.object({
  title: z.string().min(2),
  amount: z.union([z.number(), z.string()]).transform((value) => Number(value)),
  interval: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  nextRunAt: z.string().datetime(),
  categoryId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

recurringRouter.get("/", async (req: AuthedRequest, res) => {
  const user = getOptionalUser(req);

  if (!user) {
    res.json({ recurring: [] });
    return;
  }

  const recurring = await prisma.recurringExpense.findMany({
    where: { userId: user.userId },
    include: { category: true },
    orderBy: { updatedAt: "desc" },
  });

  res.json({ recurring: recurring.map((item: {
    id: string;
    title: string;
    amount: { toString(): string };
    interval: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
    nextRunAt: Date;
    active: boolean;
    categoryId: string | null;
    category: { id: string; name: string; color: string } | null;
  }) => ({
    id: item.id,
    title: item.title,
    amount: item.amount.toString(),
    interval: item.interval,
    nextRunAt: item.nextRunAt.toISOString(),
    active: item.active,
    categoryId: item.categoryId,
    category: item.category ?? null,
  })) });
});

recurringRouter.post("/", requireUser, async (req: AuthedRequest, res) => {
  const parsed = recurringSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid payload" });
    return;
  }

  const recurring = await prisma.recurringExpense.create({
    data: {
      userId: req.user!.userId,
      title: parsed.data.title,
      amount: parsed.data.amount,
      interval: parsed.data.interval,
      nextRunAt: new Date(parsed.data.nextRunAt),
      categoryId: parsed.data.categoryId ?? null,
      active: parsed.data.active ?? true,
    },
    include: { category: true },
  });

  res.status(201).json({ recurring: {
    id: recurring.id,
    title: recurring.title,
    amount: recurring.amount.toString(),
    interval: recurring.interval,
    nextRunAt: recurring.nextRunAt.toISOString(),
    active: recurring.active,
    categoryId: recurring.categoryId,
    category: recurring.category ?? null,
  } });
});

recurringRouter.patch("/:id", requireUser, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await prisma.recurringExpense.findFirst({
    where: { id, userId: req.user!.userId },
  });

  if (!existing) {
    res.status(404).json({ message: "Recurring expense not found" });
    return;
  }

  const parsed = recurringSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid payload" });
    return;
  }

  const recurring = await prisma.recurringExpense.update({
    where: { id },
    data: {
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
      ...(parsed.data.interval ? { interval: parsed.data.interval } : {}),
      ...(parsed.data.nextRunAt ? { nextRunAt: new Date(parsed.data.nextRunAt) } : {}),
      ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    },
    include: { category: true },
  });

  res.json({ recurring: {
    id: recurring.id,
    title: recurring.title,
    amount: recurring.amount.toString(),
    interval: recurring.interval,
    nextRunAt: recurring.nextRunAt.toISOString(),
    active: recurring.active,
    categoryId: recurring.categoryId,
    category: recurring.category ?? null,
  } });
});

recurringRouter.delete("/:id", requireUser, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await prisma.recurringExpense.findFirst({
    where: { id, userId: req.user!.userId },
  });

  if (!existing) {
    res.status(404).json({ message: "Recurring expense not found" });
    return;
  }

  await prisma.recurringExpense.delete({ where: { id } });
  res.status(204).send();
});
