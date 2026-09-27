import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Locals {
      user?: { id: string; email: string; name: string; role: Role };
      token?: { jti: string; exp: number };
      body?: unknown;
      query?: unknown;
      params?: unknown;
    }
  }
}

export {};
