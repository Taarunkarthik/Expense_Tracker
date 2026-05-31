import type { NextFunction, Request, Response } from "express";
import { verifySession } from "../lib/auth.js";

export type AuthedRequest = Request & {
  user?: {
    userId: string;
    email: string;
  };
};

export function getOptionalUser(req: Request) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return null;
  }

  try {
    return verifySession(token);
  } catch {
    return null;
  }
}

export function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = getOptionalUser(req);

  if (!user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  req.user = user;
  next();
}
