import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { requireAuth } from './auth.js';

const userId = '65a1b2c3d4e5f67890123456';
const organizationId = '65a1b2c3d4e5f67890123457';

const signAccessToken = (overrides: Record<string, unknown> = {}, secret = config.JWT_ACCESS_SECRET) => jwt.sign({
  org: organizationId,
  role: 'user',
  name: 'Jordan Lee',
  email: 'jordan@example.com',
  type: 'access',
  ...overrides
}, secret, { subject: userId, expiresIn: '5m' });

const invokeMiddleware = (authorization?: string) => {
  const req = { headers: authorization ? { authorization } : {} } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
  const next = vi.fn() as NextFunction;
  requireAuth(req, res, next);
  return { req, res, next };
};

describe('requireAuth', () => {
  it('rejects requests without a bearer token', () => {
    const { res, next } = invokeMiddleware();

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid and expired tokens', () => {
    const invalid = invokeMiddleware('Bearer not-a-jwt');
    const expiredToken = jwt.sign({ org: organizationId, role: 'user', name: 'Jordan Lee', email: 'jordan@example.com', type: 'access' }, config.JWT_ACCESS_SECRET, { subject: userId, expiresIn: -1 });
    const expired = invokeMiddleware(`Bearer ${expiredToken}`);

    expect(invalid.res.status).toHaveBeenCalledWith(401);
    expect(expired.res.status).toHaveBeenCalledWith(401);
    expect(invalid.next).not.toHaveBeenCalled();
    expect(expired.next).not.toHaveBeenCalled();
  });

  it('rejects tokens signed with a different secret', () => {
    const token = signAccessToken({}, 'another-secret-that-is-not-the-access-secret');
    const { res, next } = invokeMiddleware(`Bearer ${token}`);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired access token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects refresh tokens and malformed organization claims', () => {
    const refreshToken = signAccessToken({ type: 'refresh' });
    const malformedOrgToken = signAccessToken({ org: 'not-an-object-id' });
    const refreshResult = invokeMiddleware(`Bearer ${refreshToken}`);
    const malformedResult = invokeMiddleware(`Bearer ${malformedOrgToken}`);

    expect(refreshResult.res.status).toHaveBeenCalledWith(401);
    expect(malformedResult.res.status).toHaveBeenCalledWith(401);
    expect(refreshResult.next).not.toHaveBeenCalled();
    expect(malformedResult.next).not.toHaveBeenCalled();
  });

  it('attaches the signed user and organization claims to the request', () => {
    const token = signAccessToken();
    const { req, next, res } = invokeMiddleware(`Bearer ${token}`);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.auth).toBeDefined();
    expect(req.auth?.role).toBe('user');
    expect(req.auth?.name).toBe('Jordan Lee');
    expect(req.auth?.email).toBe('jordan@example.com');
    expect(req.auth?.userId.toString()).toBe(userId);
    expect(req.auth?.organizationId.toString()).toBe(organizationId);
  });
});
