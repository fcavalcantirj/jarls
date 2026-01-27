import { jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../errors/index.js';

const mockValidateSession =
  jest.fn<
    (token: string) => Promise<{ gameId: string; playerId: string; playerName: string } | null>
  >();

jest.unstable_mockModule('../../services/session', () => ({
  validateSession: mockValidateSession,
}));

const { authenticateSession } = await import('../auth');

function createMockReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader !== undefined ? { authorization: authHeader } : {},
  };
}

function createMockRes(): Partial<Response> {
  return {};
}

describe('authenticateSession middleware', () => {
  let next: jest.Mock<(...args: unknown[]) => void>;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('calls next with UnauthorizedError when no Authorization header', async () => {
    const req = createMockReq() as Request;
    const res = createMockRes() as Response;

    await authenticateSession(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as unknown as UnauthorizedError;
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toContain('Missing or invalid Authorization header');
  });

  it('calls next with UnauthorizedError when Authorization header does not start with Bearer', async () => {
    const req = createMockReq('Basic abc123') as Request;
    const res = createMockRes() as Response;

    await authenticateSession(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as unknown as UnauthorizedError;
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('calls next with UnauthorizedError when token is empty after Bearer', async () => {
    const req = createMockReq('Bearer ') as Request;
    const res = createMockRes() as Response;

    await authenticateSession(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as unknown as UnauthorizedError;
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toContain('Missing session token');
  });

  it('calls next with UnauthorizedError when token is invalid/expired', async () => {
    mockValidateSession.mockResolvedValue(null);

    const req = createMockReq('Bearer invalidtoken123') as Request;
    const res = createMockRes() as Response;

    await authenticateSession(req, res, next);

    expect(mockValidateSession).toHaveBeenCalledWith('invalidtoken123');
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as unknown as UnauthorizedError;
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toContain('Invalid or expired session token');
  });

  it('attaches session data to req and calls next() on valid token', async () => {
    const sessionData = { gameId: 'game-1', playerId: 'player-1', playerName: 'Thor' };
    mockValidateSession.mockResolvedValue(sessionData);

    const req = createMockReq('Bearer validtoken456') as Request;
    const res = createMockRes() as Response;

    await authenticateSession(req, res, next);

    expect(mockValidateSession).toHaveBeenCalledWith('validtoken456');
    expect(req.session).toEqual(sessionData);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
