import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type JwtPayload = { sub: string; tv: number; jti: string; exp: number };

/** The token carries identity + tokenVersion only. Role is always read from the database. */
export function signAccessToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ tv: tokenVersion }, env.JWT_SECRET, {
    subject: userId,
    jwtid: crypto.randomUUID(),
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const p = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof p === "string" || !p.sub || !p.jti || typeof p.tv !== "number" || !p.exp) return null;
    return { sub: p.sub, tv: p.tv, jti: p.jti, exp: p.exp };
  } catch {
    return null;
  }
}

export const randomToken = () => crypto.randomBytes(32).toString("hex");
export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

const ORDER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I look-alikes

const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "2-digit", month: "2-digit", day: "2-digit" });

/** e.g. AUR-260928-7K3QZ9: the order date (India time) for humans plus 30 random bits for uniqueness. */
export function generateOrderNumber(date = new Date()): string {
  const d = istDate.format(date).replace(/-/g, "");
  let suffix = "";
  for (const b of crypto.randomBytes(6)) suffix += ORDER_ALPHABET[b % ORDER_ALPHABET.length];
  return `AUR-${d}-${suffix}`;
}
