import { useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { BoardRenderer } from './BoardRenderer';
import type { RenderHighlights } from './BoardRenderer';

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

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
      }}
    />
  );
}
