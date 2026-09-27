import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError, type FieldError } from "../lib/http";
import { isTest } from "../config/env";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `Route ${req.method} ${req.path} not found`));
}

/** Central error handler: maps known errors to clean responses and never leaks internals. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let message = "Something went wrong on our side. Please try again.";
  let errors: FieldError[] | undefined;

  if (err instanceof AppError) {
    status = err.status;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof ZodError) {
    status = 400;
    message = "Some fields are invalid";
    errors = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      status = 409;
      message = "A record with these details already exists";
    } else if (err.code === "P2025") {
      status = 404;
      message = "Resource not found";
    } else if (err.code === "P2003") {
      status = 409;
      message = "This record is still in use and cannot be removed";
    }
  } else if (isClientHttpError(err)) {
    status = err.status;
    message = err.type === "entity.too.large" ? "Request body is too large" : "Malformed request body";
  }

  if (status >= 500 && !isTest) console.error(err);
  res.status(status).json({ success: false, message, ...(errors ? { errors } : {}) });
}

/** body-parser errors carry a 4xx status and a `type`. */
function isClientHttpError(err: unknown): err is { status: number; type: string } {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { status?: unknown; type?: unknown };
  return typeof e.status === "number" && e.status >= 400 && e.status < 500 && typeof e.type === "string";
}
