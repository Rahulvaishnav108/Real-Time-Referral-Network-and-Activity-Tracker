import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export const validate = (schema: ZodType, source: 'body' | 'query' | 'params' = 'body'): RequestHandler => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', details: result.error.flatten() });
    return;
  }
  if (source !== 'query') (req as unknown as Record<string, unknown>)[source] = result.data;
  next();
};
