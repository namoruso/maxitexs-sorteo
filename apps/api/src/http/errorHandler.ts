import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { zodToCampos } from '@maxitexs/shared';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(422).json({ campos: zodToCampos(err) });
    return;
  }

  if (err instanceof AppError) {
    if (err.code === 'DUPLICATE') {
      res.status(409).json({
        mensaje: err.message,
        campo: err.campo ?? 'cedula',
      });
      return;
    }
    if (err.code === 'VALIDATION' && err.campos) {
      res.status(422).json({ campos: err.campos });
      return;
    }
    res.status(err.status).json({ mensaje: err.message });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({
    mensaje: env.isProd ? 'Error interno' : String(err instanceof Error ? err.message : err),
  });
}
