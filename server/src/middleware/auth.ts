import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config.js';

export type AccessClaims = { sub: string; org: string; role: 'user' | 'admin'; name: string; email: string; type: 'access' };
const TypesObjectIdFromHex = (value: string): mongoose.Types.ObjectId =>
  new (mongoose.Types.ObjectId as unknown as { new (hex: string): mongoose.Types.ObjectId })(value);

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }
  try {
    const claims = jwt.verify(token, config.JWT_ACCESS_SECRET) as jwt.JwtPayload & AccessClaims;
    if (claims.type !== 'access' || !/^[a-f\d]{24}$/i.test(claims.sub) || !/^[a-f\d]{24}$/i.test(claims.org)) {
      res.status(401).json({ error: 'Invalid access token' }); return;
    }
    const objectId = TypesObjectIdFromHex(claims.sub);
    const organizationId = TypesObjectIdFromHex(claims.org);
    req.auth = { userId: objectId, organizationId, role: claims.role, name: claims.name, email: claims.email };
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired access token' }); }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.auth?.role !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return; }
  next();
};
