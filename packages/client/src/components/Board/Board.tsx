import { useRef, useEffect, useCallback, type MouseEvent, type TouchEvent } from 'react';
import { isOnBoardAxial, getValidMoves } from '@jarls/shared';
import type { AxialCoord } from '@jarls/shared';
import { useGameStore, selectIsMyTurn } from '../../store/gameStore';
import { BoardRenderer } from './BoardRenderer';
import type { RenderHighlights } from './BoardRenderer';
import { AnimationSystem } from './AnimationSystem';
import { CombatPreview } from './CombatPreview';
import { hexToPixel, pixelToHex } from '../../utils/hexMath';
import { getSocket } from '../../socket/client';

const ERROR_TOAST_DURATION_MS = 3000;

export function Board() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const animationSystemRef = useRef(new AnimationSystem());
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gameState = useGameStore((s) => s.gameState);
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const validMoves = useGameStore((s) => s.validMoves);
  const playerId = useGameStore((s) => s.playerId);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const hoveredCombat = useGameStore((s) => s.hoveredCombat);
  const hoverPosition = useGameStore((s) => s.hoverPosition);
  const pendingTurnUpdate = useGameStore((s) => s.pendingTurnUpdate);
  const isAnimating = useGameStore((s) => s.isAnimating);
  const movePending = useGameStore((s) => s.movePending);

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

  // Re-render on state changes (only when not animating)
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !gameState || isAnimating) return;

    const highlights = getHighlights();
    renderer.render(gameState, highlights);
  }, [gameState, selectedPieceId, validMoves, playerId, getHighlights, isAnimating]);

  // Handle pending turn updates — play animation, then apply new state
  useEffect(() => {
    if (!pendingTurnUpdate || !gameState) return;

    const renderer = rendererRef.current;
    if (!renderer) return;

    const animSystem = animationSystemRef.current;
    const { newState, events } = pendingTurnUpdate;
    const store = useGameStore.getState();

    // Parse events into animations
    const animations = animSystem.parseEvents(events);

    if (animations.length === 0) {
      // No animations to play — apply state immediately
      store.clearPendingTurnUpdate();
      store.setGameState(newState);
      return;
    }

    // Mark as animating (blocks interaction)
    store.setIsAnimating(true);
    store.clearPendingTurnUpdate();

    // Build set of piece IDs involved in animations
    const animatingPieceIds = new Set(animations.map((a) => a.pieceId));

    // Create hexToPixel function bound to current dimensions
    const dims = renderer.getDimensions();
    if (!dims) {
      // No dimensions yet — skip animation, apply state
      store.setIsAnimating(false);
      store.setGameState(newState);
      return;
    }

    const hexToPixelFn = (hex: AxialCoord) =>
      hexToPixel(hex, dims.hexSize, dims.centerX, dims.centerY);

    // Run animation loop
    animSystem
      .animate(animations, hexToPixelFn, (animatedPieces) => {
        // Each frame: re-render board with animated piece overrides
        renderer.renderAnimatedFrame(gameState, animatedPieces, animatingPieceIds);
      })
      .then(() => {
        // Animation complete — apply the new state
        store.setGameState(newState);
        // Check for queued updates (rapid AI moves)
        const { turnUpdateQueue } = useGameStore.getState();
        if (turnUpdateQueue.length > 0) {
          console.log(`[ANIMATION] Complete, processing ${turnUpdateQueue.length} queued updates`);
          store.shiftTurnUpdateQueue();
        } else {
          store.setIsAnimating(false);
        }
      });
  }, [pendingTurnUpdate, gameState]);

  // Handle window resize and container resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const handleResize = () => {
      const width = parent.clientWidth;
      const height = parent.clientHeight;

      // Skip if dimensions are zero (layout not yet computed)
      if (width === 0 || height === 0) return;

      canvas.width = width;
      canvas.height = height;

      renderer.handleResize(width, height);

      if (gameState && !isAnimating) {
        const highlights = getHighlights();
        renderer.render(gameState, highlights);
      }
    };

    // Initial sizing
    handleResize();

    // Use ResizeObserver for reliable container size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(parent);

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [gameState, getHighlights, isAnimating]);

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

  // Core interaction logic shared by mouse and touch handlers
  const handleInteraction = useCallback(
    (canvasX: number, canvasY: number) => {
      // IMPORTANT: Read ALL state directly from store to avoid React stale closure issues.
      // React's useCallback captures values at render time, but rapid clicks can happen
      // before React re-renders, causing the captured values to be stale.
      const store = useGameStore.getState();
      const freshGameState = store.gameState;
      const freshPlayerId = store.playerId;
      const freshSelectedPieceId = store.selectedPieceId;
      const freshValidMoves = store.validMoves;

      console.log(
        `[CLICK] isAnimating=${store.isAnimating} movePending=${store.movePending} turn=${freshGameState?.turnNumber} currentPlayer=${freshGameState?.currentPlayerId}`
      );
      if (store.isAnimating || store.movePending) {
        console.log('[CLICK] BLOCKED');
        return;
      }

      const renderer = rendererRef.current;
      if (!renderer || !freshGameState) return;

      const dims = renderer.getDimensions();
      if (!dims) return;

      // Convert pixel coordinates to hex
      const clickedHex = pixelToHex(canvasX, canvasY, dims.hexSize, dims.centerX, dims.centerY);

      // Ignore clicks outside the board
      if (!isOnBoardAxial(clickedHex, freshGameState.config.boardRadius)) return;

      // If a piece is selected and we click a valid move destination, execute the move
      if (freshSelectedPieceId && freshValidMoves.length > 0) {
        const targetMove = freshValidMoves.find(
          (m) => m.destination.q === clickedHex.q && m.destination.r === clickedHex.r
        );
        if (targetMove) {
          // Save selection info for potential restore on error
          const prevPieceId = freshSelectedPieceId;
          const prevMoves = freshValidMoves;

          // Block further interaction immediately while waiting for server response
          store.clearSelection();
          store.setMovePending(true);
          console.log(`[SEND MOVE] pieceId=${prevPieceId} turnNumber=${freshGameState.turnNumber}`);

          const socket = getSocket();
          socket.emit(
            'playTurn',
            {
              gameId: freshGameState.id,
              command: { pieceId: prevPieceId, destination: targetMove.destination },
              turnNumber: freshGameState.turnNumber,
            },
            (response) => {
              if (!response.success) {
                // Restore selection so the player can try again
                store.setMovePending(false);
                store.selectPiece(prevPieceId, prevMoves);
                store.setError(response.error ?? 'Move failed');
              }
            }
          );
          return;
        }
      }

      // Check if hex contains a piece owned by the current player (use FRESH state)
      const piece = freshGameState.pieces.find(
        (p) => p.position.q === clickedHex.q && p.position.r === clickedHex.r
      );

      const isOwnPiece = piece != null && piece.playerId === freshPlayerId;

      // Check turn status fresh from store
      const isMyTurnNow = selectIsMyTurn(store);

      if (isOwnPiece && isMyTurnNow) {
        // Own piece clicked on player's turn: select and compute valid moves using FRESH state
        const moves = getValidMoves(freshGameState, piece.id);
        store.selectPiece(piece.id, moves);
      } else {
        // Clicked elsewhere or not player's turn: clear selection
        store.clearSelection();
      }
    },
    [] // No dependencies - we read everything fresh from store
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

      // No tooltip during animations
      if (isAnimating) return;

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
    [gameState, selectedPieceId, validMoves, hoveredCombat, isAnimating]
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
          cursor: isAnimating || movePending ? 'wait' : 'pointer',
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
