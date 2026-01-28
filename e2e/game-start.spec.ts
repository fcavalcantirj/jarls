import { test, expect } from '@playwright/test';

test.describe('Game Start', () => {
  test('host can start game when 2 players present', async ({ browser }) => {
    // === Player 1: Create a game ===
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto('/');
    await page1.click('text=Create Game');
    await page1.fill('input[placeholder="Enter your name"]', 'HostPlayer');
    await page1.click('button:has-text("Create Game")');

    // Wait for waiting room
    await expect(page1).toHaveURL(/\/lobby\/[a-z0-9-]+/, { timeout: 10_000 });
    await expect(page1.locator('text=Waiting Room')).toBeVisible();

    // Host start button should be disabled initially
    const disabledButton = page1.locator('button:has-text("Waiting for players...")');
    await expect(disabledButton).toBeVisible();
    await expect(disabledButton).toBeDisabled();

    // === Player 2: Join the game ===
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    await page2.goto('/');
    await page2.click('text=Join Game');
    await page2.fill('input[placeholder="Enter your name"]', 'JoinerPlayer');

    // Wait for game to appear in list
    await expect(page2.locator('text=Host: HostPlayer')).toBeVisible({ timeout: 10_000 });
    await page2.click('button:has-text("Join")');

    // Player 2 in waiting room
    await expect(page2).toHaveURL(/\/lobby\//, { timeout: 10_000 });
    await expect(page2.locator('text=Waiting Room')).toBeVisible();
    await expect(page2.locator('text=Players (2/2)')).toBeVisible({ timeout: 5_000 });

    // Host should now see Start Game button enabled
    const startGameButton = page1.locator('button:has-text("Start Game")');
    await expect(startGameButton).toBeVisible({ timeout: 10_000 });
    await expect(startGameButton).toBeEnabled();

    // === Host clicks Start Game ===
    await startGameButton.click();

    // Both players should navigate to the game page
    await expect(page1).toHaveURL(/\/game\/[a-z0-9-]+/, { timeout: 15_000 });
    await expect(page2).toHaveURL(/\/game\/[a-z0-9-]+/, { timeout: 15_000 });

    // Game page should display for both players
    await expect(page1.locator('text=Game')).toBeVisible({ timeout: 5_000 });
    await expect(page2.locator('text=Game')).toBeVisible({ timeout: 5_000 });

    // Cleanup
    await context1.close();
    await context2.close();
  });
});
