import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  QDRANT_URL: z.string().url(),

  // Proveedor único de IA (OpenRouter)
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  // Modelo de chat: requerido sin valor por defecto (validado en runtime, como OPENROUTER_API_KEY).
  OPENROUTER_LLM_MODEL: z.string().optional(),
  OPENROUTER_EMBEDDING_MODEL: z.string().default('openai/text-embedding-3-small'),
  OPENROUTER_OCR_MODEL: z.string().default('google/gemini-3.8-flash'),
  // Modelo opcional para convertir archivos (CSV) a Markdown vía LLM.
  OPENROUTER_FILE_MODEL: z.string().optional(),
  // Modelo opcional para re-ranking; si no se define, se usa el modelo de embeddings.
  OPENROUTER_RERANKER_MODEL: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().default('mitchbot-secret-change-in-production'),

  // Frontend
  FRONTEND_URL: z.string().optional().default('http://localhost:5173'),

  // Social Gateway (Meta)
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  INSTAGRAM_TOKEN: z.string().optional(),
  INSTAGRAM_VERIFY_TOKEN: z.string().optional(),
});

const env = envSchema.parse(process.env);

export default env;
