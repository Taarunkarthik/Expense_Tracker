import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireUser, type AuthedRequest } from "../middleware/auth.js";

export const categoriesRouter = Router();

const categorySchema = z.object({
  name: z.string().min(2),
  color: z.string().min(4).default("#4f46e5"),
});

categoriesRouter.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  res.json({ categories });
});

categoriesRouter.post("/", requireUser, async (req: AuthedRequest, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid payload" });
    return;
  }

  const category = await prisma.category.create({ data: parsed.data });
  res.status(201).json({ category });
});
