import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import type { LLMProvider } from './base.js';
import type { GcmConfig } from '../config/schema.js';

/**
 * Returns the LLMProvider instance for the given config.
 * Throws if an unknown provider name is encountered (should not happen
 * because Zod validates the config, but keeps TypeScript exhaustive).
 */
export function getProvider(config: GcmConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config.apiKey, config.model);
    case 'anthropic':
      return new AnthropicProvider(config.apiKey, config.model);
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}
