import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/ui-report', open: 'never' }],
    ['json', { outputFile: 'test-results/ui-results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'on',
    trace: 'on-first-retry',
    video: 'off',
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        headless: true,
      },
    },
  ],
  outputDir: 'test-results/ui-screenshots',
});
