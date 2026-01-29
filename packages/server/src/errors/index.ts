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

export class NotYourTurnError extends GameError {
  constructor() {
    super('NOT_YOUR_TURN', 'It is not your turn', 400);
    this.name = 'NotYourTurnError';
  }
}

export class UnauthorizedError extends GameError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends GameError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends GameError {
  constructor(message: string) {
    super('CONFIGURATION_ERROR', message, 503);
    this.name = 'ConfigurationError';
  }
}

export class DatabaseUnavailableError extends GameError {
  constructor(message = 'Database is temporarily unavailable') {
    super('DATABASE_UNAVAILABLE', message, 503);
    this.name = 'DatabaseUnavailableError';
  }
}
