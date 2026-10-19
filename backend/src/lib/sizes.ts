import type { Size } from "@prisma/client";

/** Display order for sizes. Matches the order of the Size enum in the schema. */
export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "FREE_SIZE"] as const satisfies readonly Size[];

export const sizeLabel = (s: Size) => (s === "FREE_SIZE" ? "Free Size" : s);
