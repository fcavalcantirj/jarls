import { test, expect } from '@playwright/test';

/**
 * Helper: Create a game with 2 players and start it, using mobile-sized viewports.
 * Returns both pages positioned on the /game/:gameId route.
 */
async function setupTwoPlayerGameMobile(browser: import('@playwright/test').Browser) {
  const mobileViewport = { width: 375, height: 667 }; // iPhone SE size

  // === Player 1: Create a game ===
  const context1 = await browser.newContext({
    viewport: mobileViewport,
    hasTouch: true,
    isMobile: true,
  });
  const page1 = await context1.newPage();

  await page1.goto('/');
  await page1.click('text=Create Game');
  await page1.fill('input[placeholder="Enter your name"]', 'Alice');
  await page1.click('button:has-text("Create Game")');

  // Wait for waiting room
  await expect(page1).toHaveURL(/\/lobby\/[a-z0-9-]+/, { timeout: 10_000 });
  await expect(page1.locator('text=Waiting Room')).toBeVisible();

  // === Player 2: Join the game ===
  const context2 = await browser.newContext({
    viewport: mobileViewport,
    hasTouch: true,
    isMobile: true,
  });
  const page2 = await context2.newPage();

  await page2.goto('/');
  await page2.click('text=Join Game');
  await page2.fill('input[placeholder="Enter your name"]', 'Bob');

  // Wait for game to appear in list
  await expect(page2.locator('text=Host: Alice')).toBeVisible({ timeout: 10_000 });
  await page2.click('button:has-text("Join")');

  // Player 2 in waiting room
  await expect(page2).toHaveURL(/\/lobby\//, { timeout: 10_000 });
  await expect(page2.locator('text=Players (2/2)')).toBeVisible({ timeout: 5_000 });

  // Host starts the game
  const startButton = page1.locator('button:has-text("Start Game")');
  await expect(startButton).toBeEnabled({ timeout: 10_000 });
  await startButton.click();

  // Both players navigate to the game page
  await expect(page1).toHaveURL(/\/game\/[a-z0-9-]+/, { timeout: 15_000 });
  await expect(page2).toHaveURL(/\/game\/[a-z0-9-]+/, { timeout: 15_000 });

  return { page1, page2, context1, context2 };
}

test.describe('Mobile', () => {
  test('mobile viewport touch interactions work', async ({ browser }) => {
    const { page1, page2, context1, context2 } = await setupTwoPlayerGameMobile(browser);

    // Both players should see the game board canvas on mobile
    const canvas1 = page1.locator('canvas');
    await expect(canvas1).toBeVisible({ timeout: 10_000 });

    const canvas2 = page2.locator('canvas');
    await expect(canvas2).toBeVisible({ timeout: 10_000 });

    // Determine which player has the turn
    const p1HasTurn = await page1
      .locator('text=Your Turn')
      .isVisible()
      .catch(() => false);
    const activePage = p1HasTurn ? page1 : page2;

    // Get the canvas bounding box
    const activeCanvas = activePage.locator('canvas');
    await expect(activeCanvas).toBeVisible({ timeout: 5_000 });
    const box = await activeCanvas.boundingBox();
    expect(box).not.toBeNull();

    // Simulate a touch tap on the canvas center (should not crash the app)
    if (box) {
      await activeCanvas.tap({ position: { x: box.width / 2, y: box.height / 2 } });
    }

    // The board should still be rendered and the app should not crash
    await expect(activeCanvas).toBeVisible();
    await expect(activePage.locator('text=Players')).toBeVisible();

    // Now make a programmatic move via touch-enabled context to verify
    // the game is fully functional on mobile
    const moveResult = await activePage.evaluate(async () => {
      const storeModule = await import('/src/store/gameStore');
      const store = storeModule.useGameStore.getState();

      if (!store.gameState || !store.playerId) {
        return { success: false, error: 'No game state or player ID' };
      }

      const shared = await import('@jarls/shared');
      const myPieces = store.gameState.pieces.filter((p) => p.playerId === store.playerId);

      for (const piece of myPieces) {
        const moves = shared.getValidMoves(store.gameState, piece.id);
        if (moves.length > 0) {
          const simpleMove = moves.find((m) => m.moveType === 'move') ?? moves[0];

          const socketModule = await import('/src/socket/client');
          const socket = socketModule.getSocket();

          return new Promise<{ success: boolean; error?: string }>((resolve) => {
            socket.emit(
              'playTurn',
              {
                gameId: store.gameState!.id,
                command: {
                  pieceId: piece.id,
                  destination: simpleMove.destination,
                },
              },
              (response: { success: boolean; error?: string }) => {
                resolve(response);
              }
            );
          });
        }
      }

      return { success: false, error: 'No valid moves found' };
    });

    expect(moveResult.success).toBeTruthy();

    // After move, the other player should see "Your Turn"
    const waitingPage = p1HasTurn ? page2 : page1;
    await expect(waitingPage.locator('text=Your Turn')).toBeVisible({ timeout: 10_000 });

    // Cleanup
    await context1.close();
    await context2.close();
  });

  test('responsive layout adapts correctly on mobile viewport', async ({ browser }) => {
    const mobileViewport = { width: 375, height: 667 };

    const context = await browser.newContext({
      viewport: mobileViewport,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();

    // Test home page layout
    await page.goto('/');
    await expect(page.locator('text=Create Game')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Join Game')).toBeVisible();

    // Verify no horizontal overflow (page width matches viewport)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(mobileViewport.width + 1); // +1 for rounding

    // Test create game form layout on mobile
    await page.click('text=Create Game');
    await expect(page.locator('input[placeholder="Enter your name"]')).toBeVisible({
      timeout: 5_000,
    });

    // Verify form is usable - input and button visible without scrolling
    const input = page.locator('input[placeholder="Enter your name"]');
    await expect(input).toBeVisible();
    const createBtn = page.locator('button:has-text("Create Game")');
    await expect(createBtn).toBeVisible();

    // Verify no horizontal overflow on create page
    const createPageWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(createPageWidth).toBeLessThanOrEqual(mobileViewport.width + 1);

    // Navigate to game list and verify layout
    await page.goto('/');
    await page.click('text=Join Game');
    await expect(page.locator('text=Available Games')).toBeVisible({ timeout: 5_000 });

    const listPageWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(listPageWidth).toBeLessThanOrEqual(mobileViewport.width + 1);

    // Test game page layout with a game (using store manipulation)
    // Navigate to create a game to test the game page layout
    await page.goto('/');
    await page.click('text=Create Game');
    await page.fill('input[placeholder="Enter your name"]', 'MobilePlayer');
    await page.click('button:has-text("Create Game")');
    await expect(page).toHaveURL(/\/lobby\/[a-z0-9-]+/, { timeout: 10_000 });

    // Verify waiting room layout on mobile
    await expect(page.locator('text=Waiting Room')).toBeVisible();
    const lobbyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(lobbyWidth).toBeLessThanOrEqual(mobileViewport.width + 1);

    // Cleanup
    await context.close();
  });
});
