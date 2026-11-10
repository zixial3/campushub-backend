import type { Config } from 'jest';

// Jest loads this file through ts-node and requires a default export.
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  // One in-memory mongod for the whole run; each worker gets its own database.
  globalSetup: '<rootDir>/src/test/globalSetup.ts',
  globalTeardown: '<rootDir>/src/test/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  // The lock-timeout test waits out the real 3-second lock deadline.
  testTimeout: 20000,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/test/**',
    // Process entry points: they only wire config to listen/exit.
    '!src/server.ts',
    '!src/scripts/**',
  ],
  coverageThreshold: {
    './src/services/': { statements: 80, branches: 80, functions: 80, lines: 80 },
    './src/controllers/': { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
  coverageReporters: ['text', 'text-summary', 'lcov'],
};

export default config;
