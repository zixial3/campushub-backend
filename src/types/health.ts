export type HealthStatus = 'ok' | 'degraded';

export interface HealthReport {
  readonly status: HealthStatus;
  readonly service: string;
  readonly uptimeSeconds: number;
  readonly timestamp: string;
}
