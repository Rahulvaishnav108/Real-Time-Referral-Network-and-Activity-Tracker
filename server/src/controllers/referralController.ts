import mongoose from 'mongoose';
import { z } from 'zod';
import type { Request } from 'express';
import type { Server } from 'socket.io';
import { Referral } from '../models/Referral.js';
import { ActivityEvent } from '../models/ActivityEvent.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { recordActivity } from '../services/activityService.js';

const statuses = ['pending', 'contacted', 'accepted', 'rejected'] as const;
export const createReferralSchema = z.object({ candidateEmail: z.string().trim().email().max(254), note: z.string().trim().max(1000).optional().default('') }).strict();
export const updateStatusSchema = z.object({ status: z.enum(statuses) }).strict();
export const listReferralQuerySchema = z.object({
  status: z.enum(statuses).optional(), email: z.string().trim().email().optional(),
  from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict();
export const activityQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).strict();
export const idParamSchema = z.object({ id: z.string().refine((value) => mongoose.isValidObjectId(String(value)), 'Invalid ID') }).strict();

const canManage = (req: Request, createdBy: mongoose.Types.ObjectId): boolean => req.auth!.role === 'admin' || createdBy.toString() === req.auth!.userId.toString();

export const createReferral = (io: Server) => asyncHandler(async (req, res) => {
  const { candidateEmail, note } = createReferralSchema.parse(req.body);
  const auth = req.auth!;
  const referral = await Referral.create({ organizationId: auth.organizationId, createdBy: auth.userId, candidateEmail: candidateEmail.toLowerCase(), note, status: 'pending' });
  const activity = await recordActivity(io, { organizationId: auth.organizationId, referralId: referral._id, actorId: auth.userId, actorName: auth.name, action: 'created', candidateEmail: referral.candidateEmail, status: referral.status });
  io.to(`org:${auth.organizationId.toString()}`).emit('referral:created', { id: referral.id, candidateEmail: referral.candidateEmail, note: referral.note, status: referral.status, createdAt: referral.createdAt, statusUpdatedAt: referral.statusUpdatedAt, createdBy: { id: auth.userId.toString(), name: auth.name, email: auth.email } });
  res.status(201).json({ referral: { id: referral.id, candidateEmail: referral.candidateEmail, note: referral.note, status: referral.status, createdAt: referral.createdAt, statusUpdatedAt: referral.statusUpdatedAt, createdBy: { id: auth.userId.toString(), name: auth.name, email: auth.email } }, activity });
});

export const listReferrals = asyncHandler(async (req, res) => {
  const { status, email, from, to, page, limit } = listReferralQuerySchema.parse(req.query);
  const auth = req.auth!;
  const filter: Record<string, unknown> = { organizationId: auth.organizationId };
  if (auth.role !== 'admin') filter.createdBy = auth.userId;
  if (status) filter.status = status;
  if (email) filter.candidateEmail = email.toLowerCase();
  if (from || to) filter.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  const [items, total] = await Promise.all([
    Referral.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('createdBy', 'name email').lean(),
    Referral.countDocuments(filter)
  ]);
  res.json({ referrals: items.map((item) => ({ id: item._id.toString(), candidateEmail: item.candidateEmail, note: item.note, status: item.status, createdAt: item.createdAt, statusUpdatedAt: item.statusUpdatedAt, createdBy: item.createdBy })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const updateReferralStatus = (io: Server) => asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { status } = updateStatusSchema.parse(req.body);
  const auth = req.auth!;
  const referral = await Referral.findOne({ _id: id, organizationId: auth.organizationId });
  if (!referral) { res.status(404).json({ error: 'Referral not found' }); return; }
  if (!canManage(req, referral.createdBy)) { res.status(403).json({ error: 'You can only update referrals you created' }); return; }
  if (referral.status === status) { res.json({ referral: { id: referral.id, candidateEmail: referral.candidateEmail, note: referral.note, status: referral.status, createdAt: referral.createdAt, statusUpdatedAt: referral.statusUpdatedAt } }); return; }
  const previousStatus = referral.status;
  referral.status = status;
  referral.statusUpdatedAt = new Date();
  await referral.save();
  const activity = await recordActivity(io, { organizationId: auth.organizationId, referralId: referral._id, actorId: auth.userId, actorName: auth.name, action: 'status_changed', candidateEmail: referral.candidateEmail, previousStatus, status });
  const updated = { id: referral.id, candidateEmail: referral.candidateEmail, note: referral.note, status: referral.status, createdAt: referral.createdAt, statusUpdatedAt: referral.statusUpdatedAt };
  io.to(`org:${auth.organizationId.toString()}`).emit('referral:updated', updated);
  res.json({ referral: updated, activity });
});

export const listActivity = asyncHandler(async (req, res) => {
  const { page, limit } = activityQuerySchema.parse(req.query);
  const organizationId = req.auth!.organizationId;
  const filter = { organizationId };
  const [events, total] = await Promise.all([
    ActivityEvent.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ActivityEvent.countDocuments(filter)
  ]);
  res.json({ events: events.map((event) => ({ id: event._id.toString(), referralId: event.referralId.toString(), actorId: event.actorId.toString(), actorName: event.actorName, action: event.action, candidateEmail: event.candidateEmail, previousStatus: event.previousStatus, status: event.status, createdAt: event.createdAt })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});
