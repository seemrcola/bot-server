import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/e2e/**/*.test.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/types/**',
        'src/**/interfaces/**'
      ]
    },
    testTimeout: 30000, // 30秒超时
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
});
