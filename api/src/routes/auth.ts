import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireUser, type AuthedRequest } from "../middleware/auth.js";
import { signSession } from "../lib/auth.js";

export const authRouter = Router();

const authSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

function safeUser(user: { id: string; name: string; email: string }) {
  return { id: user.id, name: user.name, email: user.email };
}

authRouter.post("/register", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid payload" });
    return;
  }

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: name ?? email.split("@")[0] ?? "User",
      email,
      passwordHash,
    },
  });

  const token = signSession({ userId: user.id, email: user.email });
  res.status(201).json({ token, user: safeUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid payload" });
    return;
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const token = signSession({ userId: user.id, email: user.email });
  res.json({ token, user: safeUser(user) });
});

authRouter.get("/me", requireUser, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ user });
});
