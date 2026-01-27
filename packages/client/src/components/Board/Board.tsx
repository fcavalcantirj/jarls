import { useRef, useEffect, useCallback, type MouseEvent, type TouchEvent } from 'react';
import { isOnBoardAxial, getValidMoves } from '@jarls/shared';
import { useGameStore, selectIsMyTurn } from '../../store/gameStore';
import { BoardRenderer } from './BoardRenderer';
import type { RenderHighlights } from './BoardRenderer';
import { CombatPreview } from './CombatPreview';
import { pixelToHex } from '../../utils/hexMath';
import { getSocket } from '../../socket/client';

const ERROR_TOAST_DURATION_MS = 3000;

export function Board() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gameState = useGameStore((s) => s.gameState);
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const validMoves = useGameStore((s) => s.validMoves);
  const playerId = useGameStore((s) => s.playerId);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const hoveredCombat = useGameStore((s) => s.hoveredCombat);
  const hoverPosition = useGameStore((s) => s.hoverPosition);

  // Initialize renderer on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    rendererRef.current = new BoardRenderer(ctx);
  }, []);

  // Build highlights from store state
  const getHighlights = useCallback((): RenderHighlights | undefined => {
    if (!gameState || !selectedPieceId) return undefined;

    const selectedPiece = gameState.pieces.find((p) => p.id === selectedPieceId);
    if (!selectedPiece) return undefined;

    return {
      selectedHex: selectedPiece.position,
      validMoves,
      currentPlayerId: playerId ?? undefined,
    };
  }, [gameState, selectedPieceId, validMoves, playerId]);

  // Re-render on state changes
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !gameState) return;

    const highlights = getHighlights();
    renderer.render(gameState, highlights);
  }, [gameState, selectedPieceId, validMoves, playerId, getHighlights]);

  // Handle window resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;

      renderer.handleResize(canvas.width, canvas.height);

      if (gameState) {
        const highlights = getHighlights();
        renderer.render(gameState, highlights);
      }
    };

    // Initial sizing
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gameState, getHighlights]);

  // Auto-clear error toast after duration
  useEffect(() => {
    if (!errorMessage) return;

    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      useGameStore.getState().clearError();
    }, ERROR_TOAST_DURATION_MS);

    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [errorMessage]);

  const isMyTurn = useGameStore(selectIsMyTurn);

  // Core interaction logic shared by mouse and touch handlers
  const handleInteraction = useCallback(
    (canvasX: number, canvasY: number) => {
      const renderer = rendererRef.current;
      if (!renderer || !gameState) return;

      const dims = renderer.getDimensions();
      if (!dims) return;

      // Convert pixel coordinates to hex
      const clickedHex = pixelToHex(canvasX, canvasY, dims.hexSize, dims.centerX, dims.centerY);

      // Ignore clicks outside the board
      if (!isOnBoardAxial(clickedHex, gameState.config.boardRadius)) return;

      const store = useGameStore.getState();

      // If a piece is selected and we click a valid move destination, execute the move
      if (selectedPieceId && validMoves.length > 0) {
        const targetMove = validMoves.find(
          (m) => m.destination.q === clickedHex.q && m.destination.r === clickedHex.r
        );
        if (targetMove) {
          // Save selection info for potential restore on error
          const prevPieceId = selectedPieceId;
          const prevMoves = validMoves;

          // Clear selection immediately while waiting for server response
          store.clearSelection();

          const socket = getSocket();
          socket.emit(
            'playTurn',
            {
              gameId: gameState.id,
              command: { pieceId: prevPieceId, destination: targetMove.destination },
            },
            (response) => {
              if (!response.success) {
                // Restore selection so the player can try again
                store.selectPiece(prevPieceId, prevMoves);
                store.setError(response.error ?? 'Move failed');
              }
            }
          );
          return;
        }
      }

      // Check if hex contains a piece owned by the current player
      const piece = gameState.pieces.find(
        (p) => p.position.q === clickedHex.q && p.position.r === clickedHex.r
      );

      const isOwnPiece = piece != null && piece.playerId === playerId;

      if (isOwnPiece && isMyTurn) {
        // Own piece clicked on player's turn: select and compute valid moves
        const moves = getValidMoves(gameState, piece.id);
        store.selectPiece(piece.id, moves);
      } else {
        // Clicked elsewhere or not player's turn: clear selection
        store.clearSelection();
      }
    },
    [gameState, playerId, isMyTurn, selectedPieceId, validMoves]
  );

  // Mouse click handler
  const handleClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      handleInteraction(event.clientX - rect.left, event.clientY - rect.top);
    },
    [handleInteraction]
  );

  // Touch handler for mobile
  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const touch = event.changedTouches[0];
      if (!touch) return;

      // Prevent default to avoid mouse event firing after touch
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      handleInteraction(touch.clientX - rect.left, touch.clientY - rect.top);
    },
    [handleInteraction]
  );

  // Mouse move handler for combat preview tooltip
  const handleMouseMove = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer || !gameState) return;

      // Only show tooltip when a piece is selected with valid attack moves
      if (!selectedPieceId || validMoves.length === 0) {
        if (hoveredCombat) useGameStore.getState().clearHoveredCombat();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;

      const dims = renderer.getDimensions();
      if (!dims) return;

      const hex = pixelToHex(canvasX, canvasY, dims.hexSize, dims.centerX, dims.centerY);

      // Check if hovering over an attack destination
      const attackMove = validMoves.find(
        (m) => m.moveType === 'attack' && m.destination.q === hex.q && m.destination.r === hex.r
      );

      if (attackMove?.combatPreview) {
        useGameStore
          .getState()
          .setHoveredCombat(
            attackMove.combatPreview,
            event.clientX - rect.left,
            event.clientY - rect.top
          );
      } else {
        if (hoveredCombat) useGameStore.getState().clearHoveredCombat();
      }
    },
    [gameState, selectedPieceId, validMoves, hoveredCombat]
  );

  const handleMouseLeave = useCallback(() => {
    if (hoveredCombat) useGameStore.getState().clearHoveredCombat();
  }, [hoveredCombat]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          touchAction: 'none',
        }}
      />
      {errorMessage && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#dc3545',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 14,
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          {errorMessage}
        </div>
      )}
      {hoveredCombat && hoverPosition && (
        <CombatPreview
          combat={hoveredCombat}
          x={hoverPosition.x}
          y={hoverPosition.y}
          viewportWidth={canvasRef.current?.clientWidth ?? 800}
          viewportHeight={canvasRef.current?.clientHeight ?? 600}
        />
      )}
    </div>
  );
}
