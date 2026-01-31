import type { GameState, ValidMove, MoveCommand, AxialCoord, HexDirection } from '@jarls/shared';
import {
  applyMove,
  hexDistanceAxial,
  isOnEdgeAxial,
  getPieceById,
  hexToKey,
  getNeighborAxial,
} from '@jarls/shared';

/**
 * Check if a position is adjacent to any hole.
 */
function isAdjacentToHole(pos: AxialCoord, holes: AxialCoord[]): boolean {
  if (!holes || holes.length === 0) return false;
  const holeSet = new Set(holes.map(hexToKey));
  for (let d = 0; d < 6; d++) {
    const neighbor = getNeighborAxial(pos, d as HexDirection);
    if (holeSet.has(hexToKey(neighbor))) return true;
  }
  return false;
}

/**
 * Score a move for a given player based on heuristic evaluation.
 *
 * Positive factors:
 * - +100: throne victory
 * - +50: enemy Jarl elimination
 * - +20: enemy piece elimination
 * - +10: successful push
 * - +8: enemy piece pushed adjacent to hole
 * - +5: momentum attack
 *
 * Negative factors:
 * - -30: own Jarl ends up on edge
 * - -15: own piece ends up adjacent to hole
 * - -10: own piece ends up on edge after move
 * - +3 per hex closer to throne for Jarl
 *
 * A small random factor is added to avoid predictability.
 */
export function scoreMove(
  state: GameState,
  move: ValidMove,
  pieceId: string,
  playerId: string
): number {
  let score = 0;

  const piece = getPieceById(state, pieceId);
  if (!piece) return 0;

  // Simulate the move to see its outcome
  const command: MoveCommand = { pieceId, destination: move.destination };
  const result = applyMove(state, playerId, command);

  if (!result.success) return -1000;

  const newState = result.newState;

  // +100: throne victory
  if (newState.winnerId === playerId) {
    return 100;
  }

  // Check for eliminations by comparing pieces before and after
  const piecesBefore = state.pieces.filter((p) => p.playerId !== playerId && p.playerId !== null);
  const piecesAfter = newState.pieces.filter((p) => p.playerId !== playerId && p.playerId !== null);

  const eliminatedPieces = piecesBefore.filter(
    (before) => !piecesAfter.some((after) => after.id === before.id)
  );

  for (const eliminated of eliminatedPieces) {
    if (eliminated.type === 'jarl') {
      // +50: enemy Jarl elimination
      score += 50;
    } else {
      // +20: enemy piece elimination
      score += 20;
    }
  }

  // +10: successful push (attack that results in push outcome)
  if (move.moveType === 'attack' && move.combatPreview?.outcome === 'push') {
    score += 10;

    // +8: enemy piece pushed adjacent to a hole (sets up elimination)
    const enemyPiecesAfter = newState.pieces.filter(
      (p) => p.playerId !== playerId && p.playerId !== null
    );
    for (const enemy of enemyPiecesAfter) {
      if (isAdjacentToHole(enemy.position, newState.holes)) {
        score += 8;
      }
    }
  }

  // +5: momentum attack (moved 2 hexes to attack)
  if (move.hasMomentum && move.moveType === 'attack') {
    score += 5;
  }

  // Find the moved piece in the new state
  const movedPiece = getPieceById(newState, pieceId);
  if (movedPiece) {
    const boardRadius = newState.config.boardRadius;

    // -30: own Jarl on edge after move
    if (movedPiece.type === 'jarl' && isOnEdgeAxial(movedPiece.position, boardRadius)) {
      score -= 30;
    }

    // -10: own piece on edge after move (non-Jarl)
    if (movedPiece.type !== 'jarl' && isOnEdgeAxial(movedPiece.position, boardRadius)) {
      score -= 10;
    }

    // -15: own piece ends up adjacent to a hole (danger zone)
    if (isAdjacentToHole(movedPiece.position, newState.holes)) {
      score -= 15;
    }

    // +3 per hex closer to throne for Jarl
    if (piece.type === 'jarl') {
      const throne = { q: 0, r: 0 };
      const distBefore = hexDistanceAxial(piece.position, throne);
      const distAfter = hexDistanceAxial(movedPiece.position, throne);
      const closerBy = distBefore - distAfter;
      score += closerBy * 3;
    }
  }

  // Small random factor to avoid predictability (0 to 2)
  score += Math.random() * 2;

  return score;
}
