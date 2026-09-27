import type { Response } from "express";

export type FieldError = { path: string; message: string };

/** An error whose message is safe to show to the client. */
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: FieldError[],
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new AppError(404, `${what} not found`);

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

/** Standard pagination envelope used by every list endpoint. */
export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
