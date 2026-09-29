import type { NextFunction, Request, Response } from 'express';
import { getHealthReport } from '../services/health.service';
import type { HealthReport } from '../types/health';
import { HttpStatus } from '../types/http';

export function getHealth(
  _req: Request,
  res: Response<HealthReport>,
  _next: NextFunction,
): void {
  const report: HealthReport = getHealthReport();
  res.status(HttpStatus.OK).json(report);
}
