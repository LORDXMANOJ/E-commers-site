import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";

type Schemas = { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType };

/**
 * Validates and parses request parts. Express 5 makes req.query read-only, so parsed values are
 * stored on res.locals.{body,query,params}. Handlers read them through the typed helpers below.
 */
export const validate = (schemas: Schemas) => (req: Request, res: Response, next: NextFunction) => {
  for (const key of ["params", "query", "body"] as const) {
    const schema = schemas[key];
    if (!schema) continue;
    const result = schema.safeParse(req[key] ?? {});
    if (!result.success) return next(result.error);
    res.locals[key] = result.data;
  }
  next();
};

export const getBody = <S extends z.ZodType>(res: Response, _schema: S) => res.locals.body as z.output<S>;
export const getQuery = <S extends z.ZodType>(res: Response, _schema: S) => res.locals.query as z.output<S>;
export const getParams = <S extends z.ZodType>(res: Response, _schema: S) => res.locals.params as z.output<S>;
