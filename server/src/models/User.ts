import { Schema, model } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  refreshTokenHash: { type: String, select: false, default: null }
}, { timestamps: true });

userSchema.index({ organizationId: 1, email: 1 }, { unique: true });
export const User = model('User', userSchema);
