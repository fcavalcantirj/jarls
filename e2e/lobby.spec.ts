import { test, expect } from '@playwright/test';

test.describe('Lobby - Game Creation and Joining', () => {
  test('create game from home page', async ({ page }) => {
    // Navigate to home
    await page.goto('/');
    await expect(page).toHaveTitle(/Jarls/i);

    // Click "Create Game"
    await page.click('text=Create Game');
    await expect(page).toHaveURL(/\/lobby\/create/);

    // Fill in player name
    await page.fill('input[placeholder="Enter your name"]', 'Player1');

    // Leave defaults (Human opponent, No Timer)
    // Submit form
    await page.click('button:has-text("Create Game")');

    // Should navigate to waiting room
    await expect(page).toHaveURL(/\/lobby\/[a-z0-9-]+/, { timeout: 10_000 });

    // Waiting room should display
    await expect(page.locator('text=Waiting Room')).toBeVisible();
    await expect(page.locator('text=Player1')).toBeVisible();
    await expect(page.locator('text=HOST')).toBeVisible();
    await expect(page.locator('text=(you)')).toBeVisible();
    await expect(page.locator('text=Waiting for player...')).toBeVisible();
  });

  test('second player joins game from game list', async ({ browser }) => {
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

    // Game is created and host is in waiting room

    // === Player 2: Join the game from game list ===
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    await page2.goto('/');
    await page2.click('text=Join Game');
    await expect(page2).toHaveURL(/\/lobby\/games/);

    // Enter player name
    await page2.fill('input[placeholder="Enter your name"]', 'JoinerPlayer');

    // Wait for the game list to load and show the game
    await expect(page2.locator(`text=Host: HostPlayer`)).toBeVisible({ timeout: 10_000 });

    // Click Join on the game
    await page2.click('button:has-text("Join")');

    // Should navigate to waiting room
    await expect(page2).toHaveURL(/\/lobby\//, { timeout: 10_000 });
    await expect(page2.locator('text=Waiting Room')).toBeVisible();

    // Player 2 should see both players
    await expect(page2.locator('text=HostPlayer')).toBeVisible({ timeout: 5_000 });
    await expect(page2.locator('text=JoinerPlayer')).toBeVisible();

    // Player 2 should see the "Waiting for host" message (not the start button)
    await expect(page2.locator('text=Waiting for host to start the game...')).toBeVisible();

    // Cleanup
    await context1.close();
    await context2.close();
  });

  test('waiting room shows both players', async ({ browser }) => {
    // === Player 1: Create a game ===
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto('/');
    await page1.click('text=Create Game');
    await page1.fill('input[placeholder="Enter your name"]', 'Alice');
    await page1.click('button:has-text("Create Game")');

    await expect(page1).toHaveURL(/\/lobby\/[a-z0-9-]+/, { timeout: 10_000 });
    await expect(page1.locator('text=Waiting Room')).toBeVisible();

    // Host should see 1/2 players initially
    await expect(page1.locator('text=Players (1/2)')).toBeVisible({ timeout: 5_000 });
    await expect(page1.locator('text=Alice')).toBeVisible();
    await expect(page1.locator('text=HOST')).toBeVisible();

    // Host start button should be disabled (not enough players)
    const startButton = page1.locator('button:has-text("Waiting for players...")');
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeDisabled();

    // === Player 2: Join via API to avoid UI complexity, then go to waiting room ===
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    await page2.goto('/');
    await page2.click('text=Join Game');
    await page2.fill('input[placeholder="Enter your name"]', 'Bob');

    // Wait for game to appear in list
    await expect(page2.locator('text=Host: Alice')).toBeVisible({ timeout: 10_000 });
    await page2.click('button:has-text("Join")');

    // Player 2 in waiting room
    await expect(page2).toHaveURL(/\/lobby\//, { timeout: 10_000 });
    await expect(page2.locator('text=Waiting Room')).toBeVisible();
    await expect(page2.locator('text=Players (2/2)')).toBeVisible({ timeout: 5_000 });

    // Player 2 sees both players
    await expect(page2.locator('text=Alice')).toBeVisible();
    await expect(page2.locator('text=Bob')).toBeVisible();

    // Player 1's waiting room should update to show both players via socket
    await expect(page1.locator('text=Players (2/2)')).toBeVisible({ timeout: 10_000 });
    await expect(page1.locator('text=Bob')).toBeVisible();

    // Host should now see the "Start Game" button enabled
    const startGameButton = page1.locator('button:has-text("Start Game")');
    await expect(startGameButton).toBeVisible({ timeout: 5_000 });
    await expect(startGameButton).toBeEnabled();

    // Cleanup
    await context1.close();
    await context2.close();
  });
});
