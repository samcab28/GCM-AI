import { z } from 'zod';

export const PROVIDER_DEFAULTS = {
  openai: {
    model: 'gpt-4o-mini',
  },
  anthropic: {
    model: 'claude-sonnet-4-20250514',
  },
} as const;

export const GcmConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  language: z.enum(['en', 'es', 'auto']).default('en'),
  maxDiffLines: z.number().int().positive().default(500),
});

export type GcmConfig = z.infer<typeof GcmConfigSchema>;

/**
 * Returns the default model for the given provider.
 */
export function defaultModel(provider: GcmConfig['provider']): string {
  return PROVIDER_DEFAULTS[provider].model;
}

/**
 * Validates and parses a plain object into a GcmConfig.
 * Throws a ZodError if the input is invalid.
 */
export function parseConfig(raw: unknown): GcmConfig {
  return GcmConfigSchema.parse(raw);
}
