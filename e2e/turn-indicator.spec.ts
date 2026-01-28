import { test, expect } from '@playwright/test';

/**
 * Helper: Create a game with 2 players and start it.
 * Returns both pages positioned on the /game/:gameId route.
 */
async function setupTwoPlayerGame(browser: import('@playwright/test').Browser) {
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();

  await page1.goto('/');
  await page1.click('text=Create Game');
  await page1.fill('input[placeholder="Enter your name"]', 'Alice');
  await page1.click('button:has-text("Create Game")');

  await expect(page1).toHaveURL(/\/lobby\/[a-z0-9-]+/, { timeout: 10_000 });
  await expect(page1.locator('text=Waiting Room')).toBeVisible();

  const context2 = await browser.newContext();
  const page2 = await context2.newPage();

  await page2.goto('/');
  await page2.click('text=Join Game');
  await page2.fill('input[placeholder="Enter your name"]', 'Bob');

  await expect(page2.locator('text=Host: Alice')).toBeVisible({ timeout: 10_000 });
  await page2.click('button:has-text("Join")');

  await expect(page2).toHaveURL(/\/lobby\//, { timeout: 10_000 });
  await expect(page2.locator('text=Players (2/2)')).toBeVisible({ timeout: 5_000 });

  const startButton = page1.locator('button:has-text("Start Game")');
  await expect(startButton).toBeEnabled({ timeout: 10_000 });
  await startButton.click();

  await expect(page1).toHaveURL(/\/game\/[a-z0-9-]+/, { timeout: 15_000 });
  await expect(page2).toHaveURL(/\/game\/[a-z0-9-]+/, { timeout: 15_000 });

  return { page1, page2, context1, context2 };
}

test.describe('Turn Indicator', () => {
  test("opponent's turn indicator shown", async ({ browser }) => {
    const { page1, page2, context1, context2 } = await setupTwoPlayerGame(browser);

    // Wait for both boards to render
    await expect(page1.locator('canvas')).toBeVisible({ timeout: 10_000 });
    await expect(page2.locator('canvas')).toBeVisible({ timeout: 10_000 });

    // Wait for game state to load
    await expect(page1.locator('text=Players')).toBeVisible({ timeout: 5_000 });
    await expect(page2.locator('text=Players')).toBeVisible({ timeout: 5_000 });

    // Determine which player has the first turn
    const p1HasTurn = await page1
      .locator('text=Your Turn')
      .isVisible()
      .catch(() => false);

    const activePage = p1HasTurn ? page1 : page2;
    const waitingPage = p1HasTurn ? page2 : page1;
    const activePlayerName = p1HasTurn ? 'Alice' : 'Bob';
    const waitingPlayerName = p1HasTurn ? 'Bob' : 'Alice';

    // The active player should see "Your Turn" badge
    await expect(activePage.locator('text=Your Turn')).toBeVisible({ timeout: 5_000 });

    // The waiting player should NOT see "Your Turn" badge (it's the opponent's turn)
    await expect(waitingPage.locator('text=Your Turn')).not.toBeVisible();

    // Both players should see the current player's name in the turn indicator
    // The turn indicator shows the name of the player whose turn it is
    await expect(activePage.locator(`text=${activePlayerName}`)).toBeVisible();
    await expect(waitingPage.locator(`text=${activePlayerName}`)).toBeVisible();

    // Now make a move to switch turns, and verify the indicator updates
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

    // After the move, the turn should switch:
    // The previously waiting player now sees "Your Turn"
    await expect(waitingPage.locator('text=Your Turn')).toBeVisible({ timeout: 10_000 });

    // The previously active player no longer sees "Your Turn"
    await expect(activePage.locator('text=Your Turn')).not.toBeVisible({ timeout: 5_000 });

    // The turn indicator should now show the waiting player's name as current player
    await expect(waitingPage.locator(`text=${waitingPlayerName}`)).toBeVisible();
    await expect(activePage.locator(`text=${waitingPlayerName}`)).toBeVisible();

    // Cleanup
    await context1.close();
    await context2.close();
  });
});
