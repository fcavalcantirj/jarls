import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { GameManager } from '../game/manager.js';
import { GameNotFoundError, UnauthorizedError, ValidationError } from '../errors/index.js';
import { getConfigForPlayerCount, getValidMoves } from '@jarls/shared';
import { authenticateSession } from '../middleware/auth.js';
import { createSession } from '../services/session.js';
import type { GameMachineContext } from '../game/types.js';

const joinGameSchema = z.object({
  playerName: z.string().min(1).max(30),
});

const addAISchema = z.object({
  difficulty: z.enum(['random', 'heuristic', 'groq']),
});

// Schema for the new AI configuration endpoints
const addAIWithConfigSchema = z.object({
  type: z.enum(['local', 'groq']),
  model: z.enum(['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemma2-9b-it']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'hard']),
  customPrompt: z.string().max(5000).optional(),
});

const updateAIConfigSchema = z.object({
  model: z.enum(['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'gemma2-9b-it']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'hard']).optional(),
  customPrompt: z.string().max(5000).optional(),
});

const createGameSchema = z.object({
  playerCount: z.number().int().min(2).max(6).optional().default(2),
  turnTimerMs: z
    .union([z.literal(null), z.number().int().positive()])
    .optional()
    .default(null),
  boardRadius: z.number().int().min(3).max(10).optional(),
});

/**
 * Create game routes.
 * Receives a GameManager instance for dependency injection (testability).
 */
export function createGameRoutes(manager: GameManager): Router {
  const router = Router();

  /**
   * POST /api/games
   * Create a new game. Returns the gameId.
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createGameSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
      }

      const { playerCount, turnTimerMs, boardRadius } = parsed.data;
      const config = getConfigForPlayerCount(playerCount, turnTimerMs);
      if (boardRadius) {
        config.boardRadius = boardRadius;
      }

      const gameId = await manager.create({ config });

      res.status(201).json({ gameId });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/games
   * List games, optionally filtered by status query param.
   */
  router.get('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const games = manager.listGames(status ? { status } : undefined);
      res.json({ games });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/games/stats
   * Get dashboard stats.
   */
  router.get('/stats', (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = manager.getStats();
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/games/:id
   * Get game state. Requires authentication.
   */
  router.get('/:id', authenticateSession, (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const snapshot = manager.getState(id);
      if (!snapshot) {
        throw new GameNotFoundError(id);
      }
      res.json({ state: snapshot.context });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/games/:id/join
   * Join a game. Validates playerName, creates session, returns token and playerId.
   */
  router.post('/:id/join', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const parsed = joinGameSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
      }

      const { playerName } = parsed.data;

      const snapshot = manager.getState(id);
      if (!snapshot) {
        throw new GameNotFoundError(id);
      }

      const playerId = manager.join(id, playerName);
      const sessionToken = await createSession(id, playerId, playerName);

      res.status(200).json({ sessionToken, playerId });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/games/:id/start
   * Start a game. Requires auth. Only the host (first player) can start.
   */
  router.post(
    '/:id/start',
    authenticateSession,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id as string;
        const session = req.session!;

        const snapshot = manager.getState(id);
        if (!snapshot) {
          throw new GameNotFoundError(id);
        }

        const context = snapshot.context as GameMachineContext;
        if (context.players.length === 0 || context.players[0].id !== session.playerId) {
          throw new UnauthorizedError('Only the host can start the game');
        }

        manager.start(id, session.playerId);

        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /api/games/:id/ai
   * Add an AI player to the game. Requires auth.
   * Supports both legacy format (difficulty only) and new format (full config).
   */
  router.post('/:id/ai', authenticateSession, (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const snapshot = manager.getState(id);
      if (!snapshot) {
        throw new GameNotFoundError(id);
      }

      // Try new config format first
      const configParsed = addAIWithConfigSchema.safeParse(req.body);
      if (configParsed.success) {
        const aiPlayerId = manager.addAIPlayerWithConfig(id, configParsed.data);
        const aiConfig = manager.getAIConfig(id, aiPlayerId);
        res.json({ aiPlayerId, aiConfig });
        return;
      }

      // Fall back to legacy format
      const legacyParsed = addAISchema.safeParse(req.body);
      if (!legacyParsed.success) {
        throw new ValidationError(legacyParsed.error.issues.map((i) => i.message).join(', '));
      }

      const { difficulty } = legacyParsed.data;
      const aiPlayerId = manager.addAIPlayer(id, difficulty);

      res.json({ aiPlayerId });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PATCH /api/games/:id/ai
   * Update AI configuration mid-game. Requires auth.
   */
  router.patch(
    '/:id/ai',
    authenticateSession,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id as string;

        const parsed = updateAIConfigSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
        }

        const snapshot = manager.getState(id);
        if (!snapshot) {
          throw new GameNotFoundError(id);
        }

        // Find the AI player in the game
        const aiPlayerId = manager.getAIPlayerId(id);
        if (!aiPlayerId) {
          throw new ValidationError('No AI player in this game');
        }

        // Update the AI configuration
        const config = manager.updateAIConfig(id, aiPlayerId, parsed.data);

        res.json({ config });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /api/games/:id/ai
   * Get current AI configuration. Requires auth.
   */
  router.get('/:id/ai', authenticateSession, (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const snapshot = manager.getState(id);
      if (!snapshot) {
        throw new GameNotFoundError(id);
      }

      // Find the AI player in the game
      const aiPlayerId = manager.getAIPlayerId(id);
      if (!aiPlayerId) {
        throw new ValidationError('No AI player in this game');
      }

      const config = manager.getAIConfig(id, aiPlayerId);

      res.json({ aiPlayerId, config });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/games/:id/valid-moves/:pieceId
   * Get valid moves for a specific piece. Requires auth.
   */
  router.get(
    '/:id/valid-moves/:pieceId',
    authenticateSession,
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id as string;
        const pieceId = req.params.pieceId as string;

        const snapshot = manager.getState(id);
        if (!snapshot) {
          throw new GameNotFoundError(id);
        }

        const context = snapshot.context as GameMachineContext;
        const moves = getValidMoves(context, pieceId);

        res.json({ moves });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
