import { defineConfig, devices } from '@playwright/test';
import { E2E_TIME_ZONE } from './e2e/support/time';

// E2E runs boot their own isolated stack: an API on 3100 backed by an
// in-memory MongoDB on 27027, and the Vite dev server on 5173 proxying /api to
// it. Stop a running `npm run dev` first; reusing it would point the browser at
// your development database.
const WEB_PORT = 5173;
const API_PORT = 3100;
const MONGO_PORT = 27027;

// Playwright requires a default export here; application code uses named exports.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // Every test shares one API and database, so tests run one at a time; each
  // starts by clearing the previous test's bookings through the public API.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Fixed so "tomorrow at 10:00 AM" and the formatted slots are deterministic
    // on any machine, whatever its own locale and time zone.
    locale: 'en-US',
    timezoneId: E2E_TIME_ZONE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'npx ts-node --transpile-only e2e/support/api-server.ts',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      env: {
        PORT: String(API_PORT),
        MONGODB_URI: `mongodb://127.0.0.1:${MONGO_PORT}/campushub-e2e`,
        NODE_ENV: 'test',
      },
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      cwd: 'client',
      url: `http://localhost:${WEB_PORT}`,
      env: { CAMPUSHUB_API_ORIGIN: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
