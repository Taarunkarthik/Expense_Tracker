import type { NextFunction, Request, Response } from "express";
import { verifySession } from "../lib/auth.js";

export type AuthedRequest = Request & {
  user?: {
    userId: string;
    email: string;
  };
};

export function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    req.user = verifySession(token);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired session" });
  }
}
