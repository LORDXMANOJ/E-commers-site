import { env } from "../config/env";

/**
 * Sends the password-reset email through Resend when RESEND_API_KEY is set.
 * Returns false when no provider is configured (the caller then decides what to do).
 */
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to,
      subject: "Reset your Aurelle password",
      text: `Hi ${name},\n\nUse this link to choose a new password. It expires in 30 minutes.\n\n${resetUrl}\n\nIf you did not ask for this, you can ignore this email.`,
    }),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text().catch(() => ""));
  return res.ok;
}
