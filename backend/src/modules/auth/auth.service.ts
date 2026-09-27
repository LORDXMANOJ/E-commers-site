import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http";
import { randomToken, sha256, signAccessToken } from "../../lib/tokens";
import { env, isProd } from "../../config/env";
import { sendPasswordResetEmail } from "../../lib/email";

const BCRYPT_ROUNDS = 12;
const RESET_TTL_MS = 30 * 60 * 1000;

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_ROUNDS);

/** Public shape of a user. Never includes the password hash or token version. */
export function toPublicUser(u: Pick<User, "id" | "email" | "name" | "role" | "address" | "createdAt">) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, address: u.address, createdAt: u.createdAt };
}

const isAdminEmail = (email: string) => env.ADMIN_EMAILS.includes(email.toLowerCase());

function session(user: User) {
  return { token: signAccessToken(user.id, user.tokenVersion), user: toPublicUser(user) };
}

/** Registration always creates a CUSTOMER unless the email is allow-listed in ADMIN_EMAILS. */
export async function register(input: { name: string; email: string; password: string }) {
  const exists = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw new AppError(409, "An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: isAdminEmail(input.email) ? "ADMIN" : "CUSTOMER",
    },
  });
  return session(user);
}

// A real hash to compare against when the email is unknown, so response time does not reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-0", BCRYPT_ROUNDS);

export async function login(input: { email: string; password: string }) {
  let user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new AppError(401, "Email or password is incorrect");

  if (user.role === "CUSTOMER" && isAdminEmail(user.email)) {
    user = await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  }
  return session(user);
}

export async function logout(jti: string, expSeconds: number) {
  await prisma.revokedToken.upsert({
    where: { jti },
    create: { jti, expiresAt: new Date(expSeconds * 1000) },
    update: {},
  });
  // Opportunistic cleanup of revocations that can no longer matter.
  await prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

/**
 * Always resolves the same way whether or not the email exists (no account enumeration).
 * Without an email provider, the link is returned to the caller outside production.
 */
export async function requestPasswordReset(email: string, clientUrl: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { devResetUrl: undefined };

  const token = randomToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    }),
  ]);

  const resetUrl = `${clientUrl}/reset-password?token=${token}`;
  const sent = await sendPasswordResetEmail(user.email, user.name, resetUrl).catch(() => false);
  return { devResetUrl: !sent && !isProd ? resetUrl : undefined };
}

export async function resetPassword(token: string, password: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError(400, "This reset link is invalid or has expired. Request a new one.");
  }
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      // Bumping tokenVersion signs out every existing session.
      data: { passwordHash, tokenVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
}

/** Changes the password, signs out all other sessions, and returns a fresh token for this one. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, "Current password is incorrect", [
      { path: "currentPassword", message: "Current password is incorrect" },
    ]);
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
  });
  return session(updated);
}
