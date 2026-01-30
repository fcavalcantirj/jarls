import { create } from 'zustand';
import type { GameState, ValidMove, CombatResult, GameEvent, AIConfig } from '@jarls/shared';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** A queued turn update waiting for animation before being applied. */
export interface PendingTurnUpdate {
  newState: GameState;
  events: GameEvent[];
}

export interface GameStore {
  // State
  gameState: GameState | null;
  playerId: string | null;
  sessionToken: string | null;
  connectionStatus: ConnectionStatus;
  selectedPieceId: string | null;
  validMoves: ValidMove[];
  errorMessage: string | null;
  hoveredCombat: CombatResult | null;
  hoverPosition: { x: number; y: number } | null;
  /** Queued turn update waiting for animation playback before state is applied. */
  pendingTurnUpdate: PendingTurnUpdate | null;
  /** Queue of turn updates waiting to be processed (for rapid AI moves). */
  turnUpdateQueue: PendingTurnUpdate[];
  /** Whether an animation is currently playing (blocks interaction). */
  isAnimating: boolean;
  /** Whether a move has been sent to the server and we're awaiting the response. */
  movePending: boolean;
  /** AI opponent configuration (if playing against AI) */
  aiConfig: AIConfig | null;

  // Actions
  setGameState: (state: GameState) => void;
  setPlayer: (playerId: string) => void;
  setSession: (sessionToken: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  selectPiece: (pieceId: string, moves: ValidMove[]) => void;
  clearSelection: () => void;
  clearGame: () => void;
  setError: (message: string) => void;
  clearError: () => void;
  setHoveredCombat: (combat: CombatResult, x: number, y: number) => void;
  clearHoveredCombat: () => void;
  setPendingTurnUpdate: (update: PendingTurnUpdate) => void;
  queueTurnUpdate: (update: PendingTurnUpdate) => void;
  shiftTurnUpdateQueue: () => void;
  clearPendingTurnUpdate: () => void;
  setIsAnimating: (animating: boolean) => void;
  setMovePending: (pending: boolean) => void;
  setAIConfig: (config: AIConfig | null) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  gameState: null,
  playerId: null,
  sessionToken: null,
  connectionStatus: 'disconnected',
  selectedPieceId: null,
  validMoves: [],
  errorMessage: null,
  hoveredCombat: null,
  hoverPosition: null,
  pendingTurnUpdate: null,
  turnUpdateQueue: [],
  isAnimating: false,
  movePending: false,
  aiConfig: null,

  // Actions
  setGameState: (gameState) => set({ gameState }),
  setPlayer: (playerId) => set({ playerId }),
  setSession: (sessionToken) => set({ sessionToken }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  selectPiece: (pieceId, moves) => set({ selectedPieceId: pieceId, validMoves: moves }),
  clearSelection: () =>
    set({ selectedPieceId: null, validMoves: [], hoveredCombat: null, hoverPosition: null }),
  clearGame: () =>
    set({
      gameState: null,
      playerId: null,
      sessionToken: null,
      connectionStatus: 'disconnected',
      selectedPieceId: null,
      validMoves: [],
      errorMessage: null,
      hoveredCombat: null,
      hoverPosition: null,
      pendingTurnUpdate: null,
      turnUpdateQueue: [],
      isAnimating: false,
      movePending: false,
      aiConfig: null,
    }),
  setError: (message) => set({ errorMessage: message }),
  clearError: () => set({ errorMessage: null }),
  setHoveredCombat: (combat, x, y) => set({ hoveredCombat: combat, hoverPosition: { x, y } }),
  clearHoveredCombat: () => set({ hoveredCombat: null, hoverPosition: null }),
  setPendingTurnUpdate: (update) =>
    set({ pendingTurnUpdate: update, isAnimating: true, movePending: false }),
  queueTurnUpdate: (update) =>
    set((state) => ({ turnUpdateQueue: [...state.turnUpdateQueue, update] })),
  shiftTurnUpdateQueue: () => {
    const { turnUpdateQueue } = get();
    if (turnUpdateQueue.length === 0) {
      set({ pendingTurnUpdate: null });
      return;
    }
    const [next, ...rest] = turnUpdateQueue;
    set({ pendingTurnUpdate: next, turnUpdateQueue: rest });
  },
  clearPendingTurnUpdate: () => set({ pendingTurnUpdate: null }),
  setIsAnimating: (isAnimating) => set({ isAnimating }),
  setMovePending: (movePending) => set({ movePending }),
  setAIConfig: (aiConfig) => set({ aiConfig }),
}));

// Computed selectors
export const selectIsMyTurn = (state: GameStore): boolean => {
  if (!state.gameState || !state.playerId) return false;
  if (state.movePending) return false;
  return state.gameState.currentPlayerId === state.playerId;
};

export const selectMyPieces = (state: GameStore) => {
  if (!state.gameState || !state.playerId) return [];
  return state.gameState.pieces.filter((p) => p.playerId === state.playerId);
};

export const selectCurrentPlayer = (state: GameStore) => {
  if (!state.gameState) return null;
  return state.gameState.players.find((p) => p.id === state.gameState!.currentPlayerId) ?? null;
};
