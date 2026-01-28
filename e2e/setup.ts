/**
 * Global setup for Playwright E2E tests.
 *
 * The webServer configuration in playwright.config.ts handles starting
 * the dev server and client automatically. This file is available for
 * any additional global setup needed (e.g., seeding test data).
 */
import { FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  // The webServer config in playwright.config.ts starts:
  //   - Server on port 3000
  //   - Client on port 5173
  // No additional setup needed at this time.
  console.log('[e2e] Global setup complete');
}

export default globalSetup;
