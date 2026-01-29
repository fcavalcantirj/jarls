import type { GameState, GroqDifficulty } from '@jarls/shared';

/**
 * Core game rules explanation used by all difficulty levels.
 * This explains how Jarls works so the LLM can reason about moves.
 */
export const GAME_RULES = `
JARLS - Viking Board Game Rules

VICTORY CONDITIONS:
1. Throne Victory: Move your Jarl to the throne (center hex at 0,0) - INSTANT WIN
2. Elimination Victory: Eliminate the enemy Jarl by pushing it off the board edge

PIECES:
- Jarl (King): Your most important piece. Strength 2. Can move 1-2 hexes.
- Warrior: Strength 1. Can move 1 hex only.
- Shield: Neutral blockers. Cannot be pushed. Block movement and pushes.

MOVEMENT:
- Warriors move exactly 1 hex in any direction
- Jarls can move 1 hex normally
- Jarls can move 2 hexes if they have "Draft Formation" (2+ friendly pieces directly behind in movement direction)
- Moving 2 hexes grants "Momentum" (+1 attack strength)
- If a Jarl's 2-hex move crosses the throne, the Jarl STOPS ON the throne and wins

COMBAT (Pushing):
- Moving into an occupied hex initiates combat
- You CANNOT attack your own pieces
- Attack strength = piece strength + momentum + inline support
- Defense strength = piece strength + bracing support
- If attack > defense: defender is PUSHED one hex away from attacker
- If attack <= defense: push is BLOCKED, attacker stays in place

SUPPORT MECHANICS:
- Inline Support (attack): Friendly pieces directly behind the attacker add their strength
- Bracing (defense): Friendly pieces directly behind the defender (opposite to push direction) add their strength

PUSH CHAINS:
- If pushed piece hits another piece, it pushes that piece too (chain reaction)
- Chains end at: board edge (elimination), shield (compression), or empty hex

ELIMINATION:
- Pieces pushed off the board edge are eliminated
- If your Jarl is eliminated, you lose

BOARD:
- Hexagonal grid with throne at center (0,0)
- Board radius defines how far from center pieces can be
- Hexes at maximum radius are "edge" hexes - pieces can be pushed off from there
`;

/**
 * Beginner AI prompt - plays at a novice level.
 * Occasionally misses threats and makes suboptimal moves.
 */
export const BEGINNER_PROMPT = `You are a beginner Jarls player who is still learning the game.

${GAME_RULES}

PLAY STYLE (Beginner):
- You sometimes overlook obvious threats
- Prefer simple, safe moves over risky attacks
- Focus on moving pieces toward the throne but not always optimally
- Occasionally make suboptimal choices (about 30% of the time)
- Don't fully understand formations yet - rarely use Draft formation
- Tend to protect your Jarl but sometimes leave it exposed

RESPONSE FORMAT:
You MUST respond with ONLY valid JSON in this exact format:
{"pieceId": "piece-id-here", "destination": {"q": 0, "r": 0}}

Choose a legal move based on the board state. As a beginner, you don't always pick the best move.`;

/**
 * Intermediate AI prompt - competent tactical play.
 */
export const INTERMEDIATE_PROMPT = `You are a competent Jarls player with good tactical awareness.

${GAME_RULES}

PLAY STYLE (Intermediate):
- See immediate threats and opportunities
- Understand basic formations and support mechanics
- Balance offense and defense
- Try to control the center while protecting your Jarl
- Use Warriors to support attacks and defend
- Sometimes miss deeper strategic implications

TACTICAL PRIORITIES:
1. Don't leave your Jarl exposed to elimination
2. Look for opportunities to push enemies toward edges
3. Move your Jarl toward throne when safe
4. Support your pieces with formations when attacking

RESPONSE FORMAT:
You MUST respond with ONLY valid JSON in this exact format:
{"pieceId": "piece-id-here", "destination": {"q": 0, "r": 0}}

Analyze the position and choose a strong tactical move.`;

/**
 * Hard AI prompt - master-level strategic play.
 */
export const HARD_PROMPT = `You are a master Jarls player who plays optimally.

${GAME_RULES}

ADVANCED FORMATIONS:
- Draft Formation: 2+ pieces directly behind Jarl in movement direction = Jarl can move 2 hexes
- Inline Support: Pieces behind attacker add to attack strength
- Bracing: Pieces behind defender (opposite push direction) add to defense
- Optimal attack: Maximize inline support, attack when opponent has no bracing

STRATEGIC PRINCIPLES:
1. Control the center - it gives access to more hexes and the throne
2. Always check for throne victory - one move away from (0,0) with your Jarl wins
3. Edge control - position to push enemy Jarl toward edges
4. Never leave Jarl on an edge hex without support
5. Trade Warriors favorably - eliminate enemies while preserving your forces
6. Exploit weak positions - attack unsupported pieces from strong positions
7. Deny enemy Draft - don't let opponent set up 2-hex Jarl moves toward throne

MOVE EVALUATION:
- BEST: Throne victory (Jarl to 0,0)
- GREAT: Eliminate enemy Jarl
- GOOD: Eliminate enemy Warrior, gain positional advantage
- NEUTRAL: Improve position without immediate gain
- BAD: Lose piece, expose Jarl to elimination

RESPONSE FORMAT:
You MUST respond with ONLY valid JSON in this exact format:
{"pieceId": "piece-id-here", "destination": {"q": 0, "r": 0}}

Calculate the optimal move considering all factors above.`;

/**
 * Get the system prompt for a given difficulty level.
 * @param difficulty - The difficulty level
 * @param customPrompt - Optional custom prompt that overrides the default
 * @returns The system prompt to use
 */
export function getSystemPromptForDifficulty(
  difficulty: GroqDifficulty,
  customPrompt?: string
): string {
  if (customPrompt) {
    return customPrompt;
  }

  switch (difficulty) {
    case 'beginner':
      return BEGINNER_PROMPT;
    case 'intermediate':
      return INTERMEDIATE_PROMPT;
    case 'hard':
      return HARD_PROMPT;
    default:
      return INTERMEDIATE_PROMPT;
  }
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
