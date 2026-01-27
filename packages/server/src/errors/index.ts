export class GameError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export class GameNotFoundError extends GameError {
  constructor(gameId: string) {
    super('GAME_NOT_FOUND', `Game not found: ${gameId}`, 404);
    this.name = 'GameNotFoundError';
  }
}

export class InvalidMoveError extends GameError {
  constructor(reason: string) {
    super('INVALID_MOVE', `Invalid move: ${reason}`, 400);
    this.name = 'InvalidMoveError';
  }
}
