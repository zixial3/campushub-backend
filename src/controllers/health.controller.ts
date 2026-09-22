import type { NextFunction, Request, Response } from 'express';
import { getHealthReport } from '../services/health.service';
import type { HealthReport } from '../types/health';

export function getHealth(_req: Request, res: Response, _next: NextFunction): void {
  const report: HealthReport = getHealthReport();
  res.status(200).json(report);
}
