import "dotenv/config";
import { z } from "zod";

const csv = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // Browsers send origins without a trailing slash, so "https://site.app/" is normalised to "https://site.app".
  CLIENT_URL: csv
    .transform((list) => list.map((u) => u.replace(/\/+$/, "")))
    .pipe(z.array(z.url()).min(1, "CLIENT_URL must list at least one origin")),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ADMIN_EMAILS: csv.transform((list) => list.map((e) => e.toLowerCase())),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Aurelle <onboarding@resend.dev>"),

  // Razorpay. Optional: without keys the Razorpay option is hidden and the simulated card is offered instead.
  RAZORPAY_KEY_ID: z.string().trim().optional(),
  RAZORPAY_KEY_SECRET: z.string().trim().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().trim().optional(),
  /** Live keys are refused unless this is explicitly "true". The demo must only ever use test keys. */
  RAZORPAY_ALLOW_LIVE: z.enum(["true", "false"]).default("false"),
  /** Minutes an unpaid Razorpay order holds its stock before it is cancelled automatically. */
  PAYMENT_HOLD_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),

  // Cloudinary (admin image uploads). Optional: without it admins paste image URLs.
  CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
  CLOUDINARY_API_KEY: z.string().trim().optional(),
  CLOUDINARY_API_SECRET: z.string().trim().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;

const blank = (v?: string) => !v || /^(paste|your-|rzp_test_x+$|change-me)/i.test(v);

/** Razorpay is enabled only when both API keys are present. */
export const razorpayEnabled = !blank(env.RAZORPAY_KEY_ID) && !blank(env.RAZORPAY_KEY_SECRET);
export const razorpayMode: "test" | "live" | "off" = !razorpayEnabled
  ? "off"
  : env.RAZORPAY_KEY_ID!.startsWith("rzp_live_")
    ? "live"
    : "test";
if (razorpayMode === "live" && env.RAZORPAY_ALLOW_LIVE !== "true") {
  console.error("Refusing to start: RAZORPAY_KEY_ID is a LIVE key. This build is a demo; use rzp_test_ keys.");
  process.exit(1);
}
if (razorpayEnabled && !env.RAZORPAY_KEY_ID!.startsWith("rzp_")) {
  console.error("RAZORPAY_KEY_ID should start with rzp_test_ (copy the Key ID, not the secret).");
  process.exit(1);
}
export const razorpayWebhookEnabled = razorpayEnabled && !blank(env.RAZORPAY_WEBHOOK_SECRET);

export const cloudinaryEnabled =
  !blank(env.CLOUDINARY_CLOUD_NAME) && !blank(env.CLOUDINARY_API_KEY) && !blank(env.CLOUDINARY_API_SECRET);
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
