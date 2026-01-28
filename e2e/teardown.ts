/**
 * Global teardown for Playwright E2E tests.
 *
 * The webServer processes are automatically terminated by Playwright
 * after tests complete. This file is available for any additional
 * cleanup (e.g., clearing test data from the database).
 */
import { FullConfig } from '@playwright/test';

async function globalTeardown(_config: FullConfig) {
  console.log('[e2e] Global teardown complete');
}

export default globalTeardown;
