// @jarls/shared - Shared types and utilities

// Re-export all types from types.ts
export type {
  AxialCoord,
  CubeCoord,
  HexDirection,
  PieceType,
  Piece,
  Player,
  GameConfig,
  PlayerScaling,
  GamePhase,
  GameState,
  MoveCommand,
  CombatBreakdown,
  CombatResult,
  ValidMove,
  MoveResult,
  GameEvent,
  MoveEvent,
  PushEvent,
  EliminatedEvent,
  TurnEndedEvent,
  GameEndedEvent,
  StarvationTriggeredEvent,
  StarvationResolvedEvent,
  JarlStarvedEvent,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  TurnSkippedEvent,
  MoveValidationError,
  MoveValidation,
  InlineSupportResult,
  BracingResult,
  SimplePushResult,
  ChainTerminator,
  ChainResult,
  EdgePushResult,
  CompressionResult,
  PushResult,
  ThroneVictoryResult,
  EliminatePlayerResult,
  LastStandingResult,
  WinCondition,
  WinConditionsResult,
  ReachableHex,
  PlayerStarvationCandidates,
  StarvationCandidates,
  StarvationChoice,
  StarvationResult,
  // Move History Types
  MoveHistoryEntry,
  // AI Configuration Types
  GroqModel,
  GroqDifficulty,
  AIConfig,
} from './types.js';

// Re-export AI configuration constants
export { GROQ_MODEL_NAMES, DEFAULT_GROQ_MODEL, DEFAULT_AI_CONFIG } from './types.js';

export const VERSION = '0.2.0';

// Re-export all hex coordinate functions from hex.ts
export {
  DIRECTIONS,
  axialToCube,
  cubeToAxial,
  hexDistance,
  hexDistanceAxial,
  getNeighbor,
  getAllNeighbors,
  getNeighborAxial,
  getAllNeighborsAxial,
  getOppositeDirection,
  cubeRound,
  hexLine,
  hexLineAxial,
  isOnBoard,
  isOnBoardAxial,
  isOnEdge,
  isOnEdgeAxial,
  hexToKey,
  keyToHex,
  keyToHexCube,
} from './hex.js';

// Re-export all board functions from board.ts
export {
  getConfigForPlayerCount,
  getBoardHexCount,
  generateAllBoardHexes,
  generateAllBoardHexesAxial,
  hexToPixel,
  hexToAngle,
  calculateStartingPositions,
  rotateHex,
  generateSymmetricalShields,
  hasPathToThrone,
  validateShieldPlacement,
  getDirectionTowardThrone,
  placeWarriors,
  generateId,
  createInitialState,
} from './board.js';

// Re-export all combat functions from combat.ts
export {
  getPieceAt,
  getPieceById,
  getPieceStrength,
  findInlineSupport,
  findBracing,
  calculateAttack,
  calculateDefense,
  calculateCombat,
  resolveSimplePush,
  detectChain,
  resolveEdgePush,
  resolveCompression,
  resolvePush,
} from './combat.js';

// Re-export all move functions from move.ts
export {
  isPathClear,
  hasDraftFormationInDirection,
  hasDraftFormation,
  getDirectionBetweenAdjacent,
  getLineDirection,
  pathCrossesThrone,
  validateMove,
  checkThroneVictory,
  eliminatePlayer,
  checkLastStanding,
  checkWinConditions,
  getReachableHexes,
  getValidMoves,
  hasLegalMoves,
  applyMove,
} from './move.js';

// Re-export starvation functions and types
export type { StarvationTriggerResult } from './starvation.js';
export {
  checkStarvationTrigger,
  calculateStarvationCandidates,
  resolveStarvation,
  incrementJarlGracePeriods,
} from './starvation.js';

// Re-export AI prompts
export {
  GAME_RULES,
  BEGINNER_PROMPT,
  INTERMEDIATE_PROMPT,
  HARD_PROMPT,
  DIFFICULTY_PROMPTS,
  getSystemPromptForDifficulty,
} from './prompts.js';
