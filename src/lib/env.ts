import { z } from 'zod';

const envSchema = z.object({
  N8N_BASE_URL: z
    .string()
    .url('N8N_BASE_URL must be a valid URL')
    .transform((v) => v.replace(/\/$/, '')),
  N8N_API_KEY: z.string().min(1, 'N8N_API_KEY is required'),
  N8N_VERIFY_TLS: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v !== 'false' && v !== '0'),
  N8N_TIMEOUT_MS: z
    .string()
    .optional()
    .default('30000')
    .transform((v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return 30000;
      return n;
    }),
  NEXT_PUBLIC_APP_NAME: z.string().optional().default('n8n Dashboard'),
  NEXT_PUBLIC_ENTERPRISE_ENABLED: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  // Service-account credentials for the internal REST API (/rest/...).
  // Optional: when absent, internal-API features are disabled and the UI
  // gracefully falls back to the public API.
  N8N_INTERNAL_EMAIL: z.string().email().optional().or(z.literal('')).transform((v) => v || undefined),
  N8N_INTERNAL_PASSWORD: z.string().min(1).optional().or(z.literal('')).transform((v) => v || undefined),
  // File path for the cached internal-API session cookie (plaintext, server-side only).
  N8N_INTERNAL_SESSION_FILE: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse({
    N8N_BASE_URL: process.env.N8N_BASE_URL,
    N8N_API_KEY: process.env.N8N_API_KEY,
    N8N_VERIFY_TLS: process.env.N8N_VERIFY_TLS,
    N8N_TIMEOUT_MS: process.env.N8N_TIMEOUT_MS,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_ENTERPRISE_ENABLED: process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED,
    N8N_INTERNAL_EMAIL: process.env.N8N_INTERNAL_EMAIL,
    N8N_INTERNAL_PASSWORD: process.env.N8N_INTERNAL_PASSWORD,
    N8N_INTERNAL_SESSION_FILE: process.env.N8N_INTERNAL_SESSION_FILE,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration. Check your .env file:\n${issues}\n\nSee .env.example for the expected format.`,
    );
  }
  cached = parsed.data;
  return cached;
}

export function isHttpBaseUrl(): boolean {
  return getEnv().N8N_BASE_URL.startsWith('http://');
}
