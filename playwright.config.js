// End-to-end journeys (D3, D12): Chromium stands in for Chrome/Edge on the
// desktop, WebKit on an iPhone-sized screen stands in for Safari on iOS.
import { defineConfig, devices } from '@playwright/test';

const port = 5174;

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    // The screens follow the browser's language (D15); tests pick it, not the machine.
    locale: 'en-US',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-iphone', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: 'node tools/serve.js',
    env: { PORT: String(port) },
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
});
