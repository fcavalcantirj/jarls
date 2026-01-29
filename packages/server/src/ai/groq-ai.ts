import type {
  GameState,
  MoveCommand,
  StarvationCandidates,
  StarvationChoice,
  AxialCoord,
} from '@jarls/shared';
import { getValidMoves } from '@jarls/shared';
import type { AIPlayer } from './types.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Available Groq models optimized for game AI */
export type GroqModel =
  | 'llama-3.1-8b-instant' // Fast, cheap - default
  | 'openai/gpt-oss-20b' // Fastest (1000 t/s)
  | 'meta-llama/llama-4-scout-17b-16e-instruct' // Smart, preview
  | 'llama-3.3-70b-versatile'; // Most capable

/**
 * AI player powered by Groq's fast LLM inference.
 * Falls back to random moves if API fails or rate limited.
 */
export class GroqAI implements AIPlayer {
  readonly difficulty = 'groq' as const;
  readonly model: GroqModel;

  private readonly apiKey: string;
  maxRetries = 3;
  private retryDelayMs = 1000;

  constructor(apiKey: string, model: GroqModel = 'llama-3.1-8b-instant') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateMove(state: GameState, playerId: string): Promise<MoveCommand> {
    // Get all valid moves for context
    const validMoves = this.getAllValidMoves(state, playerId);

    if (validMoves.length === 0) {
      throw new Error(`GroqAI: no valid moves available for player ${playerId}`);
    }

    // If only one valid move, just return it
    if (validMoves.length === 1) {
      return validMoves[0];
    }

    try {
      const response = await this.callGroqAPI(this.buildMovePrompt(state, playerId, validMoves));

      const move = this.parseMoveResponse(response);
      if (move && this.isValidMove(move, validMoves)) {
        return move;
      }

      // Fallback to random if response is invalid
      console.warn('GroqAI: Invalid move response, falling back to random');
      return this.randomMove(validMoves);
    } catch (error) {
      console.error('GroqAI generateMove error:', error);
      return this.randomMove(validMoves);
    }
  }

  async makeStarvationChoice(
    candidates: StarvationCandidates,
    playerId: string
  ): Promise<StarvationChoice> {
    const playerCandidates = candidates.find((c) => c.playerId === playerId);
    if (!playerCandidates || playerCandidates.candidates.length === 0) {
      throw new Error(`GroqAI: no starvation candidates for player ${playerId}`);
    }

    // If only one candidate, just return it
    if (playerCandidates.candidates.length === 1) {
      return { playerId, pieceId: playerCandidates.candidates[0].id };
    }

    try {
      const response = await this.callGroqAPI(
        this.buildStarvationPrompt(playerCandidates.candidates)
      );

      const parsed = this.parseJSON(response);
      if (parsed?.pieceId && typeof parsed.pieceId === 'string') {
        const valid = playerCandidates.candidates.find((c) => c.id === parsed.pieceId);
        if (valid) {
          return { playerId, pieceId: parsed.pieceId as string };
        }
      }

      // Fallback to random
      return this.randomStarvationChoice(playerCandidates.candidates, playerId);
    } catch (error) {
      console.error('GroqAI makeStarvationChoice error:', error);
      return this.randomStarvationChoice(playerCandidates.candidates, playerId);
    }
  }

  private async callGroqAPI(messages: { role: string; content: string }[]): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature: 0.3,
            max_tokens: 150,
          }),
        });

        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = response.headers.get('retry-after');
          const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : this.retryDelayMs;
          console.warn(`GroqAI: Rate limited, waiting ${waitMs}ms before retry`);
          await this.sleep(Math.min(waitMs, 5000)); // Cap at 5 seconds
          continue;
        }

        if (!response.ok) {
          throw new Error(`Groq API error: ${response.status}`);
        }

        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        return data.choices?.[0]?.message?.content ?? '';
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.maxRetries - 1) {
          await this.sleep(this.retryDelayMs * (attempt + 1));
        }
      }
    }

    throw lastError ?? new Error('Rate limit exceeded after max retries');
  }

  private buildMovePrompt(
    state: GameState,
    playerId: string,
    validMoves: MoveCommand[]
  ): { role: string; content: string }[] {
    const player = state.players.find((p) => p.id === playerId);

    const myPieces = state.pieces.filter((p) => p.playerId === playerId);
    const enemyPieces = state.pieces.filter((p) => p.playerId && p.playerId !== playerId);
    const throne = { q: 0, r: 0 };

    const systemPrompt = `You are a tactical AI for Jarls, a Viking board game.
Your goal: Get your Jarl to the throne (0,0) OR eliminate the enemy Jarl.
Rules:
- Jarls are kings, Warriors are soldiers
- Moving into an enemy pushes them (can push off board edge = elimination)
- Reaching throne with Jarl = instant win
- Protect your Jarl, hunt the enemy Jarl

Respond ONLY with JSON: {"pieceId": "...", "destination": {"q": N, "r": N}}`;

    const userPrompt = `Turn ${state.turnNumber}. You are ${player?.name}.

Your pieces:
${myPieces.map((p) => `- ${p.id} (${p.type}) at (${p.position.q},${p.position.r})`).join('\n')}

Enemy pieces:
${enemyPieces.map((p) => `- ${p.id} (${p.type}) at (${p.position.q},${p.position.r})`).join('\n')}

Throne at: (${throne.q},${throne.r})

Valid moves:
${validMoves.map((m) => `${m.pieceId} -> (${m.destination.q},${m.destination.r})`).join('\n')}

Choose the best tactical move. JSON only:`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  private buildStarvationPrompt(
    candidates: { id: string; type: string; position: AxialCoord }[]
  ): { role: string; content: string }[] {
    const systemPrompt = `You must sacrifice one warrior due to starvation.
Choose the least valuable piece (furthest from battle, least strategic).
Respond ONLY with JSON: {"pieceId": "..."}`;

    const userPrompt = `Warriors that can be sacrificed:
${candidates.map((c) => `- ${c.id} at (${c.position.q},${c.position.r})`).join('\n')}

Choose which to sacrifice. JSON only:`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  private parseMoveResponse(response: string): MoveCommand | null {
    const parsed = this.parseJSON(response);
    if (!parsed?.pieceId || !parsed?.destination) {
      return null;
    }

    const pieceId = parsed.pieceId;
    const destination = parsed.destination as Record<string, unknown>;
    if (
      typeof pieceId !== 'string' ||
      typeof destination?.q !== 'number' ||
      typeof destination?.r !== 'number'
    ) {
      return null;
    }

    return { pieceId, destination: { q: destination.q as number, r: destination.r as number } };
  }

  private parseJSON(response: string): Record<string, unknown> | null {
    try {
      // Try direct parse first
      return JSON.parse(response);
    } catch {
      // Extract from markdown code block
      const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        try {
          return JSON.parse(codeBlockMatch[1].trim());
        } catch {
          return null;
        }
      }

      // Try to find JSON object in response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          return null;
        }
      }

      return null;
    }
  }

  private isValidMove(move: MoveCommand, validMoves: MoveCommand[]): boolean {
    return validMoves.some(
      (v) =>
        v.pieceId === move.pieceId &&
        v.destination.q === move.destination.q &&
        v.destination.r === move.destination.r
    );
  }

  private getAllValidMoves(state: GameState, playerId: string): MoveCommand[] {
    const moves: MoveCommand[] = [];
    for (const piece of state.pieces) {
      if (piece.playerId !== playerId) continue;
      const pieceMoves = getValidMoves(state, piece.id);
      for (const move of pieceMoves) {
        moves.push({ pieceId: piece.id, destination: move.destination });
      }
    }
    return moves;
  }

  private randomMove(validMoves: MoveCommand[]): MoveCommand {
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  private randomStarvationChoice(candidates: { id: string }[], playerId: string): StarvationChoice {
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return { playerId, pieceId: chosen.id };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
