import type { GameState, MoveCommand, StarvationCandidates, StarvationChoice } from '@jarls/shared';

/** AI difficulty levels for basic AI types */
export type AIDifficulty = 'random' | 'heuristic' | 'groq';

/** Groq models available on the free tier */
export type GroqModel =
  | 'llama-3.1-8b-instant' // Fast, free tier default
  | 'llama-3.3-70b-versatile' // Most capable
  | 'gemma2-9b-it'; // Good balance

/** Human-readable names for Groq models */
export const GROQ_MODEL_NAMES: Record<GroqModel, string> = {
  'llama-3.1-8b-instant': 'Llama 3.1 8B (Fast)',
  'llama-3.3-70b-versatile': 'Llama 3.3 70B (Smart)',
  'gemma2-9b-it': 'Gemma 2 9B (Balanced)',
};

/** Default model for Groq AI */
export const DEFAULT_GROQ_MODEL: GroqModel = 'llama-3.1-8b-instant';

/** Groq AI difficulty levels (affects prompt) */
export type GroqDifficulty = 'beginner' | 'intermediate' | 'hard';

/** Configuration for AI opponent */
export interface AIConfig {
  /** Type of AI: local heuristic or Groq LLM */
  type: 'local' | 'groq';
  /** Groq model to use (only for type='groq') */
  model?: GroqModel;
  /** Difficulty level (affects prompt for Groq, strategy for local) */
  difficulty: GroqDifficulty;
  /** Custom prompt override (only for type='groq') */
  customPrompt?: string;
}

/** Default AI configuration */
export const DEFAULT_AI_CONFIG: AIConfig = {
  type: 'local',
  difficulty: 'intermediate',
};

/** Interface that all AI player implementations must satisfy */
export interface AIPlayer {
  /** The difficulty level of this AI */
  readonly difficulty: AIDifficulty;

  /** Generate a move for the given player in the current game state */
  generateMove(state: GameState, playerId: string): Promise<MoveCommand>;

  /** Choose which warrior to sacrifice during starvation */
  makeStarvationChoice(
    candidates: StarvationCandidates,
    playerId: string
  ): Promise<StarvationChoice>;
}

/** Extended AI player interface with config support */
export interface ConfigurableAIPlayer extends AIPlayer {
  /** Get the current AI configuration */
  getConfig(): AIConfig;
  /** Update the AI configuration */
  updateConfig(config: Partial<AIConfig>): void;
}
