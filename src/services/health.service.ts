import { appConfig } from '../config/env';
import type { HealthReport } from '../types/health';

const startedAt: number = Date.now();

export function getHealthReport(): HealthReport {
  return {
    status: 'ok',
    service: appConfig.serviceName,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
}
