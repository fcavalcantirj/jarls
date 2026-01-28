import { test, expect } from '@playwright/test';

test.describe('Sample E2E test', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Jarls/i);
  });
});
