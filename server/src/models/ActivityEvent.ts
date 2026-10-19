import { Schema, model } from 'mongoose';

const activityEventSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  referralId: { type: Schema.Types.ObjectId, ref: 'Referral', required: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actorName: { type: String, required: true },
  action: { type: String, enum: ['created', 'status_changed'], required: true },
  candidateEmail: { type: String, required: true },
  previousStatus: { type: String, enum: ['pending', 'contacted', 'accepted', 'rejected'] },
  status: { type: String, enum: ['pending', 'contacted', 'accepted', 'rejected'], required: true },
  createdAt: { type: Date, default: Date.now, immutable: true, required: true }
}, { versionKey: false });

activityEventSchema.index({ organizationId: 1, createdAt: -1 });
activityEventSchema.index({ organizationId: 1, referralId: 1, createdAt: -1 });
export const ActivityEvent = model('ActivityEvent', activityEventSchema);
