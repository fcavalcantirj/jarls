import type { GameState, MoveCommand, GroqModel, AIConfig } from '@jarls/shared';
import { DEFAULT_GROQ_MODEL } from '@jarls/shared';
import { getValidMoves } from '@jarls/shared';
import type { AIPlayer, ConfigurableAIPlayer } from './types.js';
import { getSystemPromptForDifficulty, buildUserPrompt } from './prompts.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * AI player powered by Groq's fast LLM inference.
 * Uses rules-based prompts that vary by difficulty level.
 * Falls back to random moves if API fails or rate limited.
 */
export class GroqAI implements AIPlayer, ConfigurableAIPlayer {
  readonly difficulty = 'groq' as const;

  private readonly apiKey: string;
  private config: AIConfig;
  maxRetries = 3;
  private retryDelayMs = 1000;

  constructor(apiKey: string, config?: Partial<AIConfig>) {
    this.apiKey = apiKey;
    this.config = {
      type: 'groq',
      model: config?.model ?? DEFAULT_GROQ_MODEL,
      difficulty: config?.difficulty ?? 'intermediate',
      customPrompt: config?.customPrompt,
    };
  }

  /** Get the current model */
  get model(): GroqModel {
    return this.config.model ?? DEFAULT_GROQ_MODEL;
  }

  /** Get the current AI configuration */
  getConfig(): AIConfig {
    return { ...this.config };
  }

  /** Update the AI configuration */
  updateConfig(newConfig: Partial<AIConfig>): void {
    if (newConfig.model !== undefined) {
      this.config.model = newConfig.model;
    }
    if (newConfig.difficulty !== undefined) {
      this.config.difficulty = newConfig.difficulty;
    }
    if (newConfig.customPrompt !== undefined) {
      this.config.customPrompt = newConfig.customPrompt;
    }
  }

  async generateMove(state: GameState, playerId: string): Promise<MoveCommand> {
    // Get all valid moves for validation
    const validMoves = this.getAllValidMoves(state, playerId);

    if (validMoves.length === 0) {
      throw new Error(`GroqAI: no valid moves available for player ${playerId}`);
    }

    // If only one valid move, just return it
    if (validMoves.length === 1) {
      return validMoves[0];
    }

    try {
      const messages = this.buildMovePrompt(state, playerId);
      const response = await this.callGroqAPI(messages);

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

  private buildMovePrompt(state: GameState, playerId: string): { role: string; content: string }[] {
    // Get system prompt based on difficulty (or custom prompt)
    const systemPrompt = getSystemPromptForDifficulty(
      this.config.difficulty,
      this.config.customPrompt
    );

    // Build user prompt with game state (rules-based, no pre-computed moves)
    const userPrompt = buildUserPrompt(state, playerId);

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
