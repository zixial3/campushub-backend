import type { Request, Response } from 'express';
import type { ErrorResponseBody } from '../types/api';

export function notFoundHandler(req: Request, res: Response): void {
  const body: ErrorResponseBody = {
    status: 'error',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  };
  res.status(404).json(body);
}
