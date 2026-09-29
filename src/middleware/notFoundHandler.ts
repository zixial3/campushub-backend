import type { Request, Response } from 'express';
import type { ErrorResponse } from '../types/api';
import { HttpStatus } from '../types/http';

export function notFoundHandler(req: Request, res: Response<ErrorResponse>): void {
  res.status(HttpStatus.NOT_FOUND).json({
    code: 'ROUTE_NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}
