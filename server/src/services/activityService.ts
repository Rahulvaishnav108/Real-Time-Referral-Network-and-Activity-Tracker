import type { Server } from 'socket.io';
import type { Types } from 'mongoose';
import { ActivityEvent } from '../models/ActivityEvent.js';

export type ActivityInput = {
  organizationId: Types.ObjectId; referralId: Types.ObjectId; actorId: Types.ObjectId;
  actorName: string; action: 'created' | 'status_changed'; candidateEmail: string;
  previousStatus?: 'pending' | 'contacted' | 'accepted' | 'rejected'; status: 'pending' | 'contacted' | 'accepted' | 'rejected';
};

export const recordActivity = async (io: Server, event: ActivityInput) => {
  const saved = await ActivityEvent.create(event);
  const payload = {
    id: saved.id, referralId: saved.referralId.toString(), actorId: saved.actorId.toString(),
    actorName: saved.actorName, action: saved.action, candidateEmail: saved.candidateEmail,
    previousStatus: saved.previousStatus, status: saved.status, createdAt: saved.createdAt
  };
  io.to(`org:${event.organizationId.toString()}`).emit('activity:new', payload);
  return payload;
};
