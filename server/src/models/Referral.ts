import { Schema, model } from 'mongoose';

const referralSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  candidateEmail: { type: String, required: true, lowercase: true, trim: true },
  note: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['pending', 'contacted', 'accepted', 'rejected'], default: 'pending', required: true },
  statusUpdatedAt: { type: Date, default: Date.now, required: true }
}, { timestamps: true });

referralSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
referralSchema.index({ organizationId: 1, candidateEmail: 1, createdAt: -1 });
export const Referral = model('Referral', referralSchema);
