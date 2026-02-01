# Phase 4: AI Opponent

## Overview

Implement AI opponent with multiple difficulty levels for single-player and fill-in functionality.

**Prerequisites:** Phase 3 complete
**Estimated Effort:** 3-4 days
**Package:** `@jarls/server`

---

## Task 4.1: AI Move Generation

### Description

Implement AI that can evaluate positions and generate valid moves.

### Work Items

- [ ] Implement `AIPlayer` interface
- [ ] Implement `RandomAI` (baseline - picks random valid move)
- [ ] Implement `HeuristicAI` (evaluates positions)
- [ ] Implement position evaluation function
- [ ] Implement move scoring
- [ ] Implement `GroqAI` (LLM-powered) - hard difficulty
- [ ] Add configurable thinking time

### AI Interface

```typescript
interface AIPlayer {
  difficulty: 'easy' | 'medium' | 'hard';
  generateMove(state: GameState, playerId: string): Promise<MoveCommand>;
}

interface MoveScore {
  command: MoveCommand;
  score: number;
  reasoning?: string;
}
```

### Random AI (Easy)

```typescript
export class RandomAI implements AIPlayer {
  difficulty = 'easy' as const;

  async generateMove(state: GameState, playerId: string): Promise<MoveCommand> {
    const myPieces = state.pieces.filter((p) => p.owner === playerId);

    // Collect all valid moves for all pieces
    const allMoves: { pieceId: string; move: ValidMove }[] = [];

    for (const piece of myPieces) {
      const moves = getValidMoves(state, playerId, piece.id);
      moves.forEach((m) => allMoves.push({ pieceId: piece.id, move: m }));
    }

    if (allMoves.length === 0) {
      throw new Error('No valid moves available');
    }

    // Pick random
    const chosen = allMoves[Math.floor(Math.random() * allMoves.length)];

    return {
      pieceId: chosen.pieceId,
      to: chosen.move.to,
    };
  }
}
```

### Heuristic AI (Medium)

```typescript
export class HeuristicAI implements AIPlayer {
  difficulty = 'medium' as const;

  async generateMove(state: GameState, playerId: string): Promise<MoveCommand> {
    const myPieces = state.pieces.filter((p) => p.owner === playerId);
    const scoredMoves: MoveScore[] = [];

    for (const piece of myPieces) {
      const moves = getValidMoves(state, playerId, piece.id);

      for (const move of moves) {
        const score = this.scoreMove(state, playerId, piece, move);
        scoredMoves.push({
          command: { pieceId: piece.id, to: move.to },
          score,
        });
      }
    }

    // Sort by score descending
    scoredMoves.sort((a, b) => b.score - a.score);

    // Add some randomness to top moves (avoid predictability)
    const topMoves = scoredMoves.filter((m) => m.score >= scoredMoves[0].score - 1);
    const chosen = topMoves[Math.floor(Math.random() * topMoves.length)];

    return chosen.command;
  }

  private scoreMove(state: GameState, playerId: string, piece: Piece, move: ValidMove): number {
    let score = 0;

    // Base scores by move type
    if (move.type === 'attack' && move.combat?.outcome === 'push') {
      score += 10; // Successful attack

      // Bonus for pushing toward edge
      const targetPiece = getPieceAt(state, move.to);
      if (targetPiece) {
        const distanceToEdge = state.config.boardRadius - hexDistance(move.to, ORIGIN);
        score += (3 - distanceToEdge) * 2; // Closer to edge = more points

        // Huge bonus for eliminating
        if (this.wouldEliminate(state, move)) {
          score += 50;

          // Even more for eliminating Jarl
          if (targetPiece.type === 'jarl') {
            score += 100;
          }
        }
      }
    }

    // Throne proximity for Jarl
    if (piece.type === 'jarl') {
      const currentDistance = hexDistance(piece.position, THRONE);
      const newDistance = hexDistance(move.to, THRONE);

      if (newDistance < currentDistance) {
        score += (currentDistance - newDistance) * 5;
      }

      // Winning move!
      if (hexToKey(move.to) === hexToKey(THRONE)) {
        score += 1000;
      }
    }

    // Avoid moving Jarl to edge
    if (piece.type === 'jarl' && isOnEdge(move.to, state.config.boardRadius)) {
      score -= 30;
    }

    // Prefer keeping pieces together (bracing potential)
    const friendlyNeighbors = getAllNeighbors(move.to).filter((n) => {
      const p = getPieceAt(state, n);
      return p && p.owner === playerId;
    }).length;
    score += friendlyNeighbors * 2;

    // Prefer gaining momentum
    if (move.hasMomentum) {
      score += 3;
    }

    return score;
  }

  private wouldEliminate(state: GameState, move: ValidMove): boolean {
    // Simulate the move to see if it eliminates
    const result = simulateMove(state, move);
    return result.eliminations.length > 0;
  }
}
```

### Minimax AI (Hard) - Optional

```typescript
export class MinimaxAI implements AIPlayer {
  difficulty = 'hard' as const;
  private maxDepth = 3;
  private evaluationCache = new Map<string, number>();

  async generateMove(state: GameState, playerId: string): Promise<MoveCommand> {
    const startTime = Date.now();
    const maxTime = 2000; // 2 second limit

    let bestMove: MoveCommand | null = null;
    let bestScore = -Infinity;

    const moves = this.getAllMoves(state, playerId);

    for (const move of moves) {
      if (Date.now() - startTime > maxTime) break;

      const newState = applyMove(state, playerId, move);
      const score = this.minimax(
        newState.newState,
        this.maxDepth - 1,
        -Infinity,
        Infinity,
        false,
        playerId
      );

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove!;
  }

  private minimax(
    state: GameState,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    aiPlayerId: string
  ): number {
    // Terminal conditions
    if (depth === 0 || state.winner) {
      return this.evaluate(state, aiPlayerId);
    }

    const currentPlayerId = state.players[state.currentPlayerIndex].id;
    const moves = this.getAllMoves(state, currentPlayerId);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const newState = applyMove(state, currentPlayerId, move);
        const eval_ = this.minimax(newState.newState, depth - 1, alpha, beta, false, aiPlayerId);
        maxEval = Math.max(maxEval, eval_);
        alpha = Math.max(alpha, eval_);
        if (beta <= alpha) break; // Prune
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const newState = applyMove(state, currentPlayerId, move);
        const eval_ = this.minimax(newState.newState, depth - 1, alpha, beta, true, aiPlayerId);
        minEval = Math.min(minEval, eval_);
        beta = Math.min(beta, eval_);
        if (beta <= alpha) break; // Prune
      }
      return minEval;
    }
  }

  private evaluate(state: GameState, playerId: string): number {
    // Win/lose
    if (state.winner === playerId) return 10000;
    if (state.winner && state.winner !== playerId) return -10000;

    let score = 0;
    const myPieces = state.pieces.filter((p) => p.owner === playerId);
    const enemyPieces = state.pieces.filter((p) => p.owner && p.owner !== playerId);

    // Material advantage
    score += myPieces.filter((p) => p.type === 'warrior').length * 10;
    score -= enemyPieces.filter((p) => p.type === 'warrior').length * 10;

    // Jarl safety (distance from edge)
    const myJarl = myPieces.find((p) => p.type === 'jarl');
    if (myJarl) {
      const edgeDistance =
        state.config.boardRadius -
        Math.max(Math.abs(myJarl.position.q), Math.abs(myJarl.position.r));
      score += edgeDistance * 5;

      // Throne proximity
      const throneDistance = hexDistance(myJarl.position, THRONE);
      score += (state.config.boardRadius - throneDistance) * 3;
    }

    return score;
  }

  private getAllMoves(state: GameState, playerId: string): MoveCommand[] {
    const moves: MoveCommand[] = [];
    const myPieces = state.pieces.filter((p) => p.owner === playerId);

    for (const piece of myPieces) {
      const validMoves = getValidMoves(state, playerId, piece.id);
      validMoves.forEach((m) => moves.push({ pieceId: piece.id, to: m.to }));
    }

    return moves;
  }
}
```

### Definition of Done

- [ ] RandomAI plays legal moves
- [ ] HeuristicAI makes sensible moves
- [ ] GroqAI provides strategic play (hard difficulty)
- [ ] All AIs respond within 2 seconds

### Test Cases

```typescript
describe('AI Move Generation', () => {
  test('RandomAI generates valid move', async () => {
    const ai = new RandomAI();
    const move = await ai.generateMove(gameState, 'ai_player');

    const validation = validateMove(gameState, 'ai_player', move);
    expect(validation.valid).toBe(true);
  });

  test('HeuristicAI prefers winning moves', async () => {
    const ai = new HeuristicAI();
    const stateNearThrone = createStateWithJarlNearThrone('ai_player');

    const move = await ai.generateMove(stateNearThrone, 'ai_player');

    // Should move to throne
    expect(hexToKey(move.to)).toBe(hexToKey(THRONE));
  });

  test('HeuristicAI avoids edge for Jarl', async () => {
    const ai = new HeuristicAI();

    // Run multiple times to check tendency
    const moves: MoveCommand[] = [];
    for (let i = 0; i < 20; i++) {
      const move = await ai.generateMove(gameState, 'ai_player');
      moves.push(move);
    }

    const jarlMoves = moves.filter((m) => m.pieceId.includes('jarl'));
    const edgeMoves = jarlMoves.filter((m) => isOnEdge(m.to, gameState.config.boardRadius));

    // Should rarely move Jarl to edge
    expect(edgeMoves.length / jarlMoves.length).toBeLessThan(0.2);
  });

  test('AI responds within 2 seconds', async () => {
    const ai = new HeuristicAI();
    const complexState = createComplexGameState();

    const start = Date.now();
    await ai.generateMove(complexState, 'ai_player');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });
});
```

---

## Task 4.2: AI Game Integration

### Description

Integrate AI as a player in games via the game manager.

### Work Items

- [ ] Add AI player type to game creation
- [ ] Implement auto-play on AI's turn
- [ ] Configure AI thinking delay (for UX)
- [ ] Handle AI in team mode
- [ ] Implement AI takeover for disconnected players (optional)

### AI Integration

```typescript
// Game creation with AI
interface CreateGameOptions {
  playerCount: number;
  aiPlayers?: {
    count: number;
    difficulty: 'easy' | 'medium' | 'hard';
  };
  // ...
}

// In GameManager
async createWithAI(options: CreateGameOptions): Promise<{ gameId: string }> {
  const { gameId } = await this.create(options);

  // Add AI players
  if (options.aiPlayers) {
    for (let i = 0; i < options.aiPlayers.count; i++) {
      await this.addAIPlayer(gameId, options.aiPlayers.difficulty);
    }
  }

  return { gameId };
}

async addAIPlayer(gameId: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<void> {
  const ai = this.createAI(difficulty);
  const playerId = `ai_${uuid()}`;
  const name = this.generateAIName();

  const actor = await this.getActor(gameId);
  actor?.send({
    type: 'PLAYER_JOINED',
    playerId,
    name,
    isAI: true,
    aiDifficulty: difficulty
  });

  this.aiPlayers.set(`${gameId}:${playerId}`, ai);
}

// Auto-play on AI turn
private setupAIAutoPlay(gameId: string, actor: ActorRef): void {
  actor.subscribe(async (snapshot) => {
    if (snapshot.value !== 'playing') return;

    const currentPlayer = snapshot.context.players[snapshot.context.currentPlayerIndex];
    if (!currentPlayer.isAI) return;

    const ai = this.aiPlayers.get(`${gameId}:${currentPlayer.id}`);
    if (!ai) return;

    // Add thinking delay for UX
    await this.delay(500 + Math.random() * 1000);

    try {
      const move = await ai.generateMove(snapshot.context, currentPlayer.id);
      actor.send({ type: 'MAKE_MOVE', playerId: currentPlayer.id, command: move });
    } catch (error) {
      console.error('AI move failed:', error);
      // Fallback to random move
      const fallback = new RandomAI();
      const move = await fallback.generateMove(snapshot.context, currentPlayer.id);
      actor.send({ type: 'MAKE_MOVE', playerId: currentPlayer.id, command: move });
    }
  });
}

// AI name generator
private generateAIName(): string {
  const names = ['Ragnar', 'Bjorn', 'Lagertha', 'Floki', 'Ivar', 'Rollo', 'Sigurd', 'Hvitserk'];
  const titles = ['the Bold', 'Ironside', 'the Wise', 'the Fearless'];
  return `${names[Math.floor(Math.random() * names.length)]} ${titles[Math.floor(Math.random() * titles.length)]}`;
}
```

### Definition of Done

- [ ] Can create game with AI players
- [ ] AI plays automatically on its turn
- [ ] Configurable AI difficulty
- [ ] Multiple AI players work in same game
- [ ] AI works in team mode

### Test Cases

```typescript
describe('AI Game Integration', () => {
  test('create game with AI opponent', async () => {
    const { gameId } = await gameManager.createWithAI({
      playerCount: 2,
      aiPlayers: { count: 1, difficulty: 'medium' },
    });

    const state = await gameManager.getState(gameId);
    expect(state?.players.filter((p) => p.isAI)).toHaveLength(1);
  });

  test('AI plays automatically', async () => {
    const { gameId } = await gameManager.createWithAI({
      playerCount: 2,
      aiPlayers: { count: 1, difficulty: 'easy' },
    });

    await gameManager.join(gameId, 'Human');
    await gameManager.start(gameId);

    // Human makes move
    const humanMove = { pieceId: 'p1_w1', to: { q: 1, r: 0 } };
    await gameManager.makeMove(gameId, 'human_player_id', humanMove);

    // Wait for AI
    await waitFor(() => {
      const state = gameManager.getState(gameId);
      return state?.currentPlayerIndex === 0; // Back to human
    }, 3000);

    const state = await gameManager.getState(gameId);
    expect(state?.turnNumber).toBeGreaterThan(1);
  });

  test('multiple AI players', async () => {
    const { gameId } = await gameManager.createWithAI({
      playerCount: 4,
      aiPlayers: { count: 3, difficulty: 'medium' },
    });

    await gameManager.join(gameId, 'Human');
    await gameManager.start(gameId);

    // Play several rounds
    for (let i = 0; i < 5; i++) {
      const state = await gameManager.getState(gameId);
      const currentPlayer = state!.players[state!.currentPlayerIndex];

      if (!currentPlayer.isAI) {
        await makeRandomHumanMove(gameId);
      } else {
        await waitForAITurn(gameId);
      }
    }

    const finalState = await gameManager.getState(gameId);
    expect(finalState?.turnNumber).toBeGreaterThanOrEqual(5);
  });
});
```

---

## Phase 4 Checklist

### Prerequisites

- [ ] Phase 3 complete (network layer)

### Completion Criteria

- [ ] Task 4.1 complete (AI move generation)
- [ ] Task 4.2 complete (AI integration)
- [ ] Single player vs AI fully playable
- [ ] All difficulty levels working
- [ ] AI doesn't break under any game state

### Handoff to Phase 5

- AI opponent functional
- Can play complete games vs AI
- Ready to build frontend

---

_Phase 4 Status: Complete_
_Updated: 2026-02-01_
