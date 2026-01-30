import { useEffect, useRef } from 'react';
import { connect, disconnect } from '@/socket/client';
import { useGameStore } from '@/store/gameStore';
import type { GameSocket } from '@/socket/client';

/**
 * Hook that manages Socket.IO connection lifecycle and event listeners.
 * Connects on mount (if sessionToken is provided), disconnects on unmount.
 * Updates the Zustand store in response to server events.
 */
export function useSocket(gameId: string | null): GameSocket | null {
  const socketRef = useRef<GameSocket | null>(null);
  const sessionToken = useGameStore((s) => s.sessionToken);
  const setGameState = useGameStore((s) => s.setGameState);
  const setConnectionStatus = useGameStore((s) => s.setConnectionStatus);
  const clearSelection = useGameStore((s) => s.clearSelection);

  // Connect / disconnect based on sessionToken
  useEffect(() => {
    if (!sessionToken) {
      socketRef.current = null;
      return;
    }

    const socket = connect(sessionToken);
    socketRef.current = socket;

    // ── Connection state events ────────────────────────────────────
    const onConnect = () => {
      setConnectionStatus('connected');
    };

    const onDisconnect = () => {
      setConnectionStatus('disconnected');
    };

    const onConnectError = () => {
      setConnectionStatus('error');
    };

    const onReconnectAttempt = () => {
      setConnectionStatus('connecting');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect', onConnect);

    // Set initial status
    if (socket.connected) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('connecting');
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect', onConnect);
      disconnect();
      setConnectionStatus('disconnected');
      socketRef.current = null;
    };
  }, [sessionToken, setConnectionStatus]);

  // ── Server event listeners ─────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !gameId) return;

    const onGameState = (state: Parameters<typeof setGameState>[0]) => {
      setGameState(state);
      clearSelection();
    };

    const onTurnPlayed = (data: {
      newState: Parameters<typeof setGameState>[0];
      events?: import('@jarls/shared').GameEvent[];
    }) => {
      const events = data.events ?? [];
      console.log(
        `[TURN PLAYED] newTurn=${data.newState.turnNumber} currentPlayer=${data.newState.currentPlayerId} events=${events.length}`
      );
      // Log all piece positions to detect corruption
      console.log(
        '[TURN PLAYED] pieces:',
        data.newState.pieces.map((p) => `${p.id}@(${p.position.q},${p.position.r})`).join(', ')
      );
      // Log events for debugging
      events.forEach((e, i) => console.log(`[TURN PLAYED] event[${i}]:`, JSON.stringify(e)));
      if (events.length > 0) {
        const store = useGameStore.getState();
        // If already animating, queue this update instead of overwriting
        if (store.isAnimating) {
          console.log(
            `[TURN PLAYED] Animation in progress, queuing turn ${data.newState.turnNumber}`
          );
          store.queueTurnUpdate({ newState: data.newState, events });
        } else {
          // Queue the update for animation playback — Board will apply state after animating
          store.setPendingTurnUpdate({ newState: data.newState, events });
        }
        clearSelection();
      } else {
        // No events to animate — apply immediately
        useGameStore.getState().setMovePending(false);
        setGameState(data.newState);
        clearSelection();
      }
    };

    const onGameEnded = (data: { finalState: Parameters<typeof setGameState>[0] }) => {
      setGameState(data.finalState);
      clearSelection();
    };

    const onPlayerJoined = (data: { gameState: Parameters<typeof setGameState>[0] }) => {
      setGameState(data.gameState);
    };

    const onPlayerLeft = (data: { gameState: Parameters<typeof setGameState>[0] }) => {
      setGameState(data.gameState);
    };

    const onPlayerReconnected = (data: { gameState: Parameters<typeof setGameState>[0] }) => {
      setGameState(data.gameState);
    };

    socket.on('gameState', onGameState);
    socket.on('turnPlayed', onTurnPlayed);
    socket.on('gameEnded', onGameEnded);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft', onPlayerLeft);
    socket.on('playerReconnected', onPlayerReconnected);

    return () => {
      socket.off('gameState', onGameState);
      socket.off('turnPlayed', onTurnPlayed);
      socket.off('gameEnded', onGameEnded);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('playerLeft', onPlayerLeft);
      socket.off('playerReconnected', onPlayerReconnected);
    };
  }, [gameId, setGameState, clearSelection]);

  return socketRef.current;
}
