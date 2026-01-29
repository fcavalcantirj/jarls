import type { GameState } from '@jarls/shared';

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
  const shields = state.pieces.filter((p) => p.type === 'shield');

  const formatPiece = (p: { id: string; type: string; position: { q: number; r: number } }) =>
    `  - ${p.id} (${p.type}) at (${p.position.q},${p.position.r})`;

  return `Turn ${state.turnNumber}. You are "${player?.name || playerId}".

Board radius: ${state.config.boardRadius}
Throne at: (0,0)

Your pieces:
${myPieces.map(formatPiece).join('\n')}

Enemy pieces:
${enemyPieces.map(formatPiece).join('\n')}

${shields.length > 0 ? `Shields (neutral blockers):\n${shields.map(formatPiece).join('\n')}` : ''}

Choose your move. Remember:
- Jarl at (0,0) = instant win
- Pushing enemy Jarl off edge = win
- Don't get your Jarl pushed off edge!

Your move (JSON only):`;
}
