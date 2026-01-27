import { useRef, useEffect, useCallback, type MouseEvent } from 'react';
import { isOnBoardAxial, getValidMoves } from '@jarls/shared';
import { useGameStore, selectIsMyTurn } from '../../store/gameStore';
import { BoardRenderer } from './BoardRenderer';
import type { RenderHighlights } from './BoardRenderer';
import { pixelToHex } from '../../utils/hexMath';

export function Board() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);

  const gameState = useGameStore((s) => s.gameState);
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const validMoves = useGameStore((s) => s.validMoves);
  const playerId = useGameStore((s) => s.playerId);

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

  const isMyTurn = useGameStore(selectIsMyTurn);

  // Handle canvas click: convert to hex coordinates and detect piece
  const handleClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer || !gameState) return;

      const dims = renderer.getDimensions();
      if (!dims) return;

      // Get click position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert pixel coordinates to hex
      const clickedHex = pixelToHex(x, y, dims.hexSize, dims.centerX, dims.centerY);

      // Ignore clicks outside the board
      if (!isOnBoardAxial(clickedHex, gameState.config.boardRadius)) return;

      // Check if hex contains a piece owned by the current player
      const piece = gameState.pieces.find(
        (p) => p.position.q === clickedHex.q && p.position.r === clickedHex.r
      );

      const isOwnPiece = piece != null && piece.playerId === playerId;

      if (isOwnPiece && isMyTurn) {
        // Own piece clicked on player's turn: select and compute valid moves
        const moves = getValidMoves(gameState, piece.id);
        useGameStore.getState().selectPiece(piece.id, moves);
      } else {
        // Clicked elsewhere or not player's turn: clear selection
        useGameStore.getState().clearSelection();
      }
    },
    [gameState, playerId, isMyTurn]
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        cursor: 'pointer',
      }}
    />
  );
}
