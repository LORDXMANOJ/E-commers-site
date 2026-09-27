import { z } from "zod";

/** Client-side mirrors of the API's Zod schemas. The server validates again; these are for fast feedback. */

export const emailField = z.string().trim().min(1, "Enter your email").pipe(z.email("Enter a valid email address"));

export const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const nameField = z.string().trim().min(2, "Enter your name").max(80);

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
  line1: z.string().trim().min(3, "Enter the street address").max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().min(2, "Choose the state").max(60),
  postalCode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code"),
});
export type AddressForm = z.infer<typeof addressSchema>;

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export const cardSchema = z.object({
  name: z.string().trim().min(2, "Enter the name on the card"),
  number: z
    .string()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{13,19}$/, "Enter a valid card number").refine(luhn, "Check the card number")),
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY")
    .refine((v) => {
      const [mm, yy] = v.split("/").map(Number);
      return new Date(2000 + yy, mm, 1) > new Date();
    }, "This card has expired"),
  cvc: z.string().trim().regex(/^\d{3,4}$/, "3 or 4 digits"),
});
export type CardForm = z.input<typeof cardSchema>;
