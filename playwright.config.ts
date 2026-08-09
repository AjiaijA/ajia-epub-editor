import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173'
const usesExternalServer = process.env.PLAYWRIGHT_BASE_URL !== undefined

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  testDir: 'tests/e2e',
  timeout: 45_000,
  use: {
    baseURL,
    locale: 'zh-CN',
    trace: 'retain-on-failure',
  },
  ...(usesExternalServer
    ? {}
    : {
        webServer: {
          command: 'npm run dev -- --host 127.0.0.1 --port 4173',
          reuseExistingServer: false,
          timeout: 30_000,
          url: baseURL,
        },
      }),
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === '1'
          ? { channel: 'chrome' as const }
          : {}),
      },
    },
  ],
})
