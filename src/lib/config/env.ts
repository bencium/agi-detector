import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
}).refine(data => data.API_KEY || data.OPENAI_API_KEY, {
  message: "Either API_KEY or OPENAI_API_KEY must be provided"
});

const env = envSchema.parse(process.env);

export default env;
