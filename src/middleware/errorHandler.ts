import type { NextFunction, Request, Response } from 'express';
import { appConfig } from '../config/env';
import type { ErrorResponseBody } from '../types/api';

// Must keep all four parameters: Express identifies error middleware by arity.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isProduction: boolean = appConfig.nodeEnv === 'production';
  const detail: string = err instanceof Error ? err.message : 'Unknown error';

  console.error('Unhandled request error:', err);

  const body: ErrorResponseBody = {
    status: 'error',
    message: isProduction ? 'Internal server error' : detail,
  };
  res.status(500).json(body);
}
