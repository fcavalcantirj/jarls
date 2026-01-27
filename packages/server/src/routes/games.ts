import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { GameManager } from '../game/manager.js';
import { GameNotFoundError, ValidationError } from '../errors/index.js';
import { getConfigForPlayerCount } from '@jarls/shared';
import { authenticateSession } from '../middleware/auth.js';
import { createSession } from '../services/session.js';

const joinGameSchema = z.object({
  playerName: z.string().min(1).max(30),
});

const createGameSchema = z.object({
  playerCount: z.number().int().min(2).max(6).optional().default(2),
  turnTimerMs: z
    .union([z.literal(null), z.number().int().positive()])
    .optional()
    .default(null),
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

      const { playerCount, turnTimerMs } = parsed.data;
      const config = getConfigForPlayerCount(playerCount, turnTimerMs);

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

  return router;
}
