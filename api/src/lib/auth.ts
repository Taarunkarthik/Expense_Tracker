import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET ?? "dev-secret";

export type JwtUser = {
  userId: string;
  email: string;
};

export function signSession(user: JwtUser) {
  return jwt.sign(user, jwtSecret, { expiresIn: "7d" });
}

export function verifySession(token: string) {
  return jwt.verify(token, jwtSecret) as JwtUser;
}
