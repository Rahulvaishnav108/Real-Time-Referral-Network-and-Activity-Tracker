import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { config } from '../config.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { compareToken, createAccessToken, createRefreshToken, hashToken, setRefreshCookie, type SessionUser } from '../services/tokenService.js';

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(254), password: z.string().min(8).max(72),
  organizationName: z.string().trim().min(2).max(100), organizationSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60)
}).strict();
export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(72) }).strict();

const sessionFor = (user: { _id: mongoose.Types.ObjectId; organizationId: mongoose.Types.ObjectId; role: 'user' | 'admin'; name: string; email: string }): SessionUser => ({
  id: user._id.toString(), organizationId: user.organizationId.toString(), role: user.role, name: user.name, email: user.email
});
const sendSession = async (res: Response, user: SessionUser) => {
  const refreshToken = createRefreshToken(user);
  await User.updateOne({ _id: user.id }, { $set: { refreshTokenHash: await hashToken(refreshToken) } });
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken: createAccessToken(user), user });
};

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const input = signupSchema.parse(req.body);
  const email = input.email.toLowerCase();
  if (await User.exists({ email })) { res.status(409).json({ error: 'An account with this email already exists' }); return; }
  const org = await Organization.create({ name: input.organizationName, slug: input.organizationSlug });
  try {
    const user = await User.create({ name: input.name, email, passwordHash: await bcrypt.hash(input.password, 12), role: 'admin', organizationId: org._id });
    res.status(201);
    await sendSession(res, sessionFor(user));
  } catch (error) {
    await Organization.deleteOne({ _id: org._id });
    throw error;
  }
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) { res.status(401).json({ error: 'Email or password is incorrect' }); return; }
  await sendSession(res, sessionFor(user));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (!token) { res.status(401).json({ error: 'Refresh token required' }); return; }
  try {
    const claims = jwt.verify(token, config.JWT_REFRESH_SECRET) as jwt.JwtPayload & { type?: string; org?: string };
    if (claims.type !== 'refresh' || !claims.sub || !mongoose.isValidObjectId(String(claims.sub))) throw new Error('Invalid token');
    const user = await User.findById(claims.sub).select('+refreshTokenHash');
    if (!user?.refreshTokenHash || !(await compareToken(token, user.refreshTokenHash))) throw new Error('Revoked token');
    if (user.organizationId.toString() !== claims.org) throw new Error('Organization mismatch');
    await sendSession(res, sessionFor(user));
  } catch {
    res.clearCookie('refreshToken', { httpOnly: true, secure: config.COOKIE_SECURE === 'true', sameSite: 'strict', path: '/api/auth' });
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (token) {
    try {
      const claims = jwt.verify(token, config.JWT_REFRESH_SECRET) as jwt.JwtPayload;
      if (claims.sub && mongoose.isValidObjectId(String(claims.sub))) await User.updateOne({ _id: claims.sub }, { $set: { refreshTokenHash: null } });
    } catch { /* An expired cookie can still be cleared. */ }
  }
  res.clearCookie('refreshToken', { httpOnly: true, secure: config.COOKIE_SECURE === 'true', sameSite: 'strict', path: '/api/auth' });
  res.status(204).end();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const auth = req.auth!;
  res.json({ user: { id: auth.userId.toString(), organizationId: auth.organizationId.toString(), role: auth.role, name: auth.name, email: auth.email } });
});
