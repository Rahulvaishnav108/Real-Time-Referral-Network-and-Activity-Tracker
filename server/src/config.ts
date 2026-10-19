import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/referral_network'),
  JWT_ACCESS_SECRET: z.string().min(32).default('local-access-secret-change-this-32chars'),
  JWT_REFRESH_SECRET: z.string().min(32).default('local-refresh-secret-change-this-32chars'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false')
});

export const config = envSchema.parse(process.env);
