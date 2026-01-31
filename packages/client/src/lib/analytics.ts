import ReactGA from 'react-ga4';

const GA_TRACKING_ID = 'G-RYX9VE08XM';
const IS_PRODUCTION = import.meta.env.PROD;

let isInitialized = false;

/**
 * Initialize Google Analytics 4
 * Only initializes in production mode to avoid polluting dev data
 */
export function initGA(): void {
  if (isInitialized) return;

  if (IS_PRODUCTION) {
    ReactGA.initialize(GA_TRACKING_ID);
    isInitialized = true;
  } else {
    console.debug('[Analytics] Skipping GA init in development mode');
  }
}

/**
 * Track custom event
 */
export function trackEvent(category: string, action: string, label?: string, value?: number): void {
  if (!IS_PRODUCTION) {
    console.debug('[Analytics] Event:', { category, action, label, value });
    return;
  }

  ReactGA.event({
    category,
    action,
    label,
    value,
  });
}

// Game-specific tracking events
export const GameEvents = {
  gameStart: (mode: 'local' | 'multiplayer', aiDifficulty?: string) => {
    trackEvent('Game', 'game_start', mode, aiDifficulty ? 1 : 0);
    if (aiDifficulty) {
      trackEvent('Game', 'ai_difficulty_selected', aiDifficulty);
    }
  },

  gameComplete: (winner: 'player' | 'ai' | 'opponent', durationSeconds: number) => {
    trackEvent('Game', 'game_complete', winner, Math.round(durationSeconds));
  },

  multiplayerJoined: (gameId: string) => {
    trackEvent('Multiplayer', 'game_joined', gameId);
  },

  multiplayerCreated: (gameId: string) => {
    trackEvent('Multiplayer', 'game_created', gameId);
  },
};
