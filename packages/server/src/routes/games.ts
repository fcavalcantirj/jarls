import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { GameManager } from '../game/manager.js';
import { ValidationError } from '../errors/index.js';
import { getConfigForPlayerCount } from '@jarls/shared';

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

  return router;
}
