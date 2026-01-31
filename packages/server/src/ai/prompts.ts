import type { GameState, MoveHistoryEntry } from '@jarls/shared';

// Re-export prompts from shared package
export {
  GAME_RULES,
  BEGINNER_PROMPT,
  INTERMEDIATE_PROMPT,
  HARD_PROMPT,
  DIFFICULTY_PROMPTS,
  getSystemPromptForDifficulty,
} from '@jarls/shared';

/**
 * Format a single move history entry for the AI prompt.
 */
function formatMoveEntry(entry: MoveHistoryEntry): string {
  const captured = entry.captured ? `, CAPTURED ${entry.captured}` : '';
  return `Turn ${entry.turnNumber}: ${entry.playerName} moved ${entry.pieceType} from (${entry.from.q},${entry.from.r}) to (${entry.to.q},${entry.to.r})${captured}`;
}

/**
 * Build the recent moves section for the AI prompt.
 * Shows the last 6 moves to give AI context about game evolution.
 */
function buildRecentMovesSection(state: GameState): string {
  const recentMoves = (state.moveHistory ?? []).slice(-6);
  if (recentMoves.length === 0) {
    return '';
  }
  return `=== RECENT MOVES ===
${recentMoves.map(formatMoveEntry).join('\n')}

`;
}

/**
 * Build the user prompt with current game state.
 * Uses a rules-based approach - sends game state, not pre-computed valid moves.
 * @param state - Current game state
 * @param playerId - The AI player's ID
 * @returns The user prompt describing the current position
 */
export function buildUserPrompt(state: GameState, playerId: string): string {
  const player = state.players.find((p) => p.id === playerId);
  const myPieces = state.pieces.filter((p) => p.playerId === playerId);
  const enemyPieces = state.pieces.filter((p) => p.playerId && p.playerId !== playerId);
  const holes = state.holes;

  // Separate Jarl from warriors for clarity
  const myJarl = myPieces.find((p) => p.type === 'jarl');
  const myWarriors = myPieces.filter((p) => p.type === 'warrior');
  const enemyJarl = enemyPieces.find((p) => p.type === 'jarl');
  const enemyWarriors = enemyPieces.filter((p) => p.type === 'warrior');

  const formatPiece = (p: { id: string; type: string; position: { q: number; r: number } }) =>
    `  - ${p.id} at (${p.position.q},${p.position.r})`;

  // Calculate distance from throne for Jarls
  const jarlDist = myJarl
    ? Math.max(
        Math.abs(myJarl.position.q),
        Math.abs(myJarl.position.r),
        Math.abs(-myJarl.position.q - myJarl.position.r)
      )
    : 0;
  const enemyJarlDist = enemyJarl
    ? Math.max(
        Math.abs(enemyJarl.position.q),
        Math.abs(enemyJarl.position.r),
        Math.abs(-enemyJarl.position.q - enemyJarl.position.r)
      )
    : 0;

  // Build recent moves section
  const recentMovesSection = buildRecentMovesSection(state);

  return `Turn ${state.turnNumber}. You are "${player?.name || playerId}".

Board radius: ${state.config.boardRadius}
Throne (win condition): (0,0)

${recentMovesSection}=== YOUR PIECES ===
**YOUR JARL** (MOVE THIS TO THRONE TO WIN):
  ${myJarl ? `${myJarl.id} at (${myJarl.position.q},${myJarl.position.r}) - ${jarlDist} hexes from throne` : 'ELIMINATED'}

Your Warriors:
${myWarriors.map(formatPiece).join('\n')}

=== ENEMY PIECES ===
Enemy Jarl:
  ${enemyJarl ? `${enemyJarl.id} at (${enemyJarl.position.q},${enemyJarl.position.r}) - ${enemyJarlDist} hexes from throne` : 'ELIMINATED'}

Enemy Warriors:
${enemyWarriors.map(formatPiece).join('\n')}

${holes.length > 0 ? `=== HOLES (deadly pits) ===\n${holes.map((h) => `  - Hole at (${h.q},${h.r})`).join('\n')}` : ''}

**GOAL: Move YOUR JARL to (0,0) to win instantly!**

Your move (JSON only):`;
}
