import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { config } from '../config.js';
import type { AccessClaims } from '../middleware/auth.js';

export type SessionUser = { id: string; organizationId: string; role: 'user' | 'admin'; name: string; email: string };

export const createAccessToken = (user: SessionUser): string => jwt.sign(
  { org: user.organizationId, role: user.role, name: user.name, email: user.email, type: 'access' } satisfies Omit<AccessClaims, 'sub'>,
  config.JWT_ACCESS_SECRET,
  { subject: user.id, expiresIn: '15m' }
);

export const createRefreshToken = (user: SessionUser): string => jwt.sign(
  { org: user.organizationId, type: 'refresh' }, config.JWT_REFRESH_SECRET,
  { subject: user.id, expiresIn: '7d' }
);

export const hashToken = (token: string): Promise<string> => bcrypt.hash(token, 10);
export const compareToken = (token: string, hash: string): Promise<boolean> => bcrypt.compare(token, hash);

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie('refreshToken', token, {
    httpOnly: true, secure: config.COOKIE_SECURE === 'true', sameSite: 'strict', path: '/api/auth', maxAge: 7 * 24 * 60 * 60 * 1000
  });
};
