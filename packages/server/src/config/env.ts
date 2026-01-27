import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgresql://jarls:jarls@localhost:5432/jarls'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required').default('redis://localhost:6379'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.format();
  console.error('Invalid environment variables:');
  for (const [key, value] of Object.entries(formatted)) {
    if (key === '_errors') continue;
    const errors = (value as { _errors: string[] })._errors;
    if (errors.length > 0) {
      console.error(`  ${key}: ${errors.join(', ')}`);
    }
  }
  throw new Error('Invalid environment variables. See errors above.');
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
