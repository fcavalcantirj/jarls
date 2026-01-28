import { test, expect } from '@playwright/test';

/**
 * Helper: Create a game with 2 players and start it.
 * Returns both pages positioned on the /game/:gameId route.
 */
async function setupTwoPlayerGame(browser: import('@playwright/test').Browser) {
  // === Player 1: Create a game ===
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();

  await page1.goto('/');
  await page1.click('text=Create Game');
  await page1.fill('input[placeholder="Enter your name"]', 'Alice');
  await page1.click('button:has-text("Create Game")');

  // Wait for waiting room
  await expect(page1).toHaveURL(/\/lobby\/[a-z0-9-]+/, { timeout: 10_000 });
  await expect(page1.locator('text=Waiting Room')).toBeVisible();

  // === Player 2: Join the game ===
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

test.describe('Game Completion', () => {
  test('play to victory shows end modal with victory condition', async ({ browser }) => {
    const { page1, page2, context1, context2 } = await setupTwoPlayerGame(browser);

    // Wait for the board to render on both pages
    await expect(page1.locator('canvas')).toBeVisible({ timeout: 10_000 });
    await expect(page2.locator('canvas')).toBeVisible({ timeout: 10_000 });
    await expect(page1.locator('text=Players')).toBeVisible({ timeout: 5_000 });

    // Simulate a throne victory by directly setting the game state to 'ended'
    // via the Zustand store. This is the most reliable way to test the end modal
    // without playing through a full game.
    await page1.evaluate(async () => {
      const storeModule = await import('/src/store/gameStore');
      const store = storeModule.useGameStore.getState();

      if (!store.gameState) throw new Error('No game state');

      // Set the game as ended with player 1 (Alice) winning via throne conquest
      const winnerId = store.playerId!;
      storeModule.useGameStore.setState({
        gameState: {
          ...store.gameState,
          phase: 'ended' as const,
          winnerId,
          winCondition: 'throne' as const,
        },
      });
    });

    // The winner (page1 / Alice) should see "Victory!" modal
    await expect(page1.locator('text=Victory!')).toBeVisible({ timeout: 5_000 });
    await expect(page1.locator('text=Throne Conquest')).toBeVisible();
    await expect(page1.locator('text=Alice wins')).toBeVisible();

    // Verify both action buttons are present for the winner
    await expect(page1.locator('button:has-text("Play Again")')).toBeVisible();
    await expect(page1.locator('button:has-text("Leave")')).toBeVisible();

    // Now simulate the same on page2 (Bob) — he should see "Defeat"
    await page2.evaluate(async () => {
      const storeModule = await import('/src/store/gameStore');
      const store = storeModule.useGameStore.getState();

      if (!store.gameState) throw new Error('No game state');

      // Find Alice's player ID (the winner — not Bob's own ID)
      const alicePlayer = store.gameState.players.find((p) => p.id !== store.playerId);
      if (!alicePlayer) throw new Error('Cannot find other player');

      storeModule.useGameStore.setState({
        gameState: {
          ...store.gameState,
          phase: 'ended' as const,
          winnerId: alicePlayer.id,
          winCondition: 'throne' as const,
        },
      });
    });

    // The loser (page2 / Bob) should see "Defeat" modal
    await expect(page2.locator('text=Defeat')).toBeVisible({ timeout: 5_000 });
    await expect(page2.locator('text=Throne Conquest')).toBeVisible();
    await expect(page2.locator('text=Alice wins')).toBeVisible();

    // Verify both action buttons are present for the loser
    await expect(page2.locator('button:has-text("Play Again")')).toBeVisible();
    await expect(page2.locator('button:has-text("Leave")')).toBeVisible();

    // Cleanup
    await context1.close();
    await context2.close();
  });

  test('victory condition displays correctly for Last Standing', async ({ browser }) => {
    const { page1, page2, context1, context2 } = await setupTwoPlayerGame(browser);

    // Wait for the board
    await expect(page1.locator('canvas')).toBeVisible({ timeout: 10_000 });
    await expect(page1.locator('text=Players')).toBeVisible({ timeout: 5_000 });

    // Simulate a Last Standing victory for player 1 (Alice)
    await page1.evaluate(async () => {
      const storeModule = await import('/src/store/gameStore');
      const store = storeModule.useGameStore.getState();

      if (!store.gameState) throw new Error('No game state');

      storeModule.useGameStore.setState({
        gameState: {
          ...store.gameState,
          phase: 'ended' as const,
          winnerId: store.playerId!,
          winCondition: 'lastStanding' as const,
        },
      });
    });

    // Verify "Last Standing" condition label is shown
    await expect(page1.locator('text=Victory!')).toBeVisible({ timeout: 5_000 });
    await expect(page1.locator('text=Last Standing')).toBeVisible();
    await expect(page1.locator('text=Alice wins')).toBeVisible();

    // Test "Play Again" navigation
    await page1.click('button:has-text("Play Again")');
    await expect(page1).toHaveURL(/\/lobby\/create/, { timeout: 5_000 });

    // Test "Leave" navigation on page2
    await page2.evaluate(async () => {
      const storeModule = await import('/src/store/gameStore');
      const store = storeModule.useGameStore.getState();

      if (!store.gameState) throw new Error('No game state');

      const alicePlayer = store.gameState.players.find((p) => p.id !== store.playerId);
      if (!alicePlayer) throw new Error('Cannot find other player');

      storeModule.useGameStore.setState({
        gameState: {
          ...store.gameState,
          phase: 'ended' as const,
          winnerId: alicePlayer.id,
          winCondition: 'lastStanding' as const,
        },
      });
    });

    await expect(page2.locator('text=Defeat')).toBeVisible({ timeout: 5_000 });
    await page2.click('button:has-text("Leave")');
    await expect(page2).toHaveURL('/', { timeout: 5_000 });

    // Cleanup
    await context1.close();
    await context2.close();
  });
});
