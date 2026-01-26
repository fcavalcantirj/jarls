/** @type {import('jest').Config} */
const config = {
  projects: [
    {
      displayName: 'shared',
      rootDir: './packages/shared',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            useESM: true,
            tsconfig: '<rootDir>/tsconfig.json',
          },
        ],
      },
      extensionsToTreatAsEsm: ['.ts'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
    },
    {
      displayName: 'server',
      rootDir: './packages/server',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            useESM: true,
            tsconfig: '<rootDir>/tsconfig.json',
          },
        ],
      },
      extensionsToTreatAsEsm: ['.ts'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@jarls/shared$': '<rootDir>/../shared/src/index.ts',
      },
    },
    {
      displayName: 'client',
      rootDir: './packages/client',
      testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
      testEnvironment: 'jsdom',
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            useESM: true,
            tsconfig: '<rootDir>/tsconfig.json',
          },
        ],
      },
      extensionsToTreatAsEsm: ['.ts', '.tsx'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@jarls/shared$': '<rootDir>/../shared/src/index.ts',
      },
    },
  ],
  collectCoverageFrom: ['packages/*/src/**/*.{ts,tsx}', '!packages/*/src/**/*.test.{ts,tsx}'],
};

export default config;
