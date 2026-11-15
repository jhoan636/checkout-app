/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  // Same names Vite injects at build time (see vite.config.ts).
  globals: {
    __API_URL__: 'https://api.test',
    __GATEWAY_URL__: 'https://gateway.test/v1',
    __GATEWAY_PUBLIC_KEY__: 'pub_test_key',
  },
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } },
        },
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css)$': 'identity-obj-proxy',
    '\\.(png|jpg|jpeg|webp|svg|gif)$': '<rootDir>/src/test/fileMock.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/main.tsx',
    '!src/setupTests.ts',
    '!src/test/**',
    '!src/**/*.d.ts',
    '!src/api/types.ts',
    '!src/store/hooks.ts',
  ],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
  coverageReporters: ['text', 'text-summary', 'lcov'],
}
