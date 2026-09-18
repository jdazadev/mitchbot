import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  QDRANT_URL: z.string().url(),
  OLLAMA_URL: z.string().url(),

  // Auth
  JWT_SECRET: z.string().default('mitchbot-secret-change-in-production'),

  // Frontend
  FRONTEND_URL: z.string().optional().default('http://localhost:5173'),

  // Messaging
  NATS_URL: z.string().optional(),

  // Social Gateway (Meta)
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  INSTAGRAM_TOKEN: z.string().optional(),
  INSTAGRAM_VERIFY_TOKEN: z.string().optional(),
});

const env = envSchema.parse(process.env);

export default env;
