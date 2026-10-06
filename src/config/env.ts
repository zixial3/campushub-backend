import { config } from 'dotenv';

config();

export interface AppConfig {
  readonly nodeEnv: string;
  readonly port: number;
  readonly apiPrefix: string;
  readonly serviceName: string;
  readonly mongodbUri: string;
}

function readString(name: string, fallback: string): string {
  const raw: string | undefined = process.env[name];
  return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

function readRequiredString(name: string): string {
  const raw: string | undefined = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    throw new Error(`Environment variable ${name} is required; see .env-example.`);
  }
  return raw.trim();
}

function readPort(name: string, fallback: number): number {
  const raw: string | undefined = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed: number = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(
      `Environment variable ${name} must be a valid port, received "${raw}"`,
    );
  }
  return parsed;
}

export const appConfig: AppConfig = {
  nodeEnv: readString('NODE_ENV', 'development'),
  port: readPort('PORT', 3000),
  apiPrefix: readString('API_PREFIX', '/api/v1'),
  serviceName: readString('SERVICE_NAME', 'campushub-backend'),
  // No fallback: a default URI would silently point production at localhost.
  mongodbUri: readRequiredString('MONGODB_URI'),
};
