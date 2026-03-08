import { buildSystemPrompt, buildUserMessage } from '../core/prompt.js';
import { ProviderError, NetworkError } from '../utils/errors.js';
import type { LLMProvider } from './base.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface MessagesResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

interface AnthropicErrorResponse {
  error: {
    message: string;
    type: string;
  };
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'Anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  /**
   * Calls POST /v1/messages and returns the generated commit message.
   */
  async generateCommitMessage(diff: string, language: string): Promise<string> {
    const body = {
      model: this.model,
      system: buildSystemPrompt(language),
      messages: [{ role: 'user', content: buildUserMessage(diff) }],
      temperature: 0.2,
      max_tokens: 256,
    };

    const response = await this.post(API_URL, body);
    const data = (await response.json()) as MessagesResponse;
    const block = data.content.find((b) => b.type === 'text');

    if (!block) {
      throw new ProviderError(this.name, 500, 'Empty response from model');
    }

    return block.text.trim();
  }

  /**
   * Sends a minimal request to verify the API key is valid.
   */
  async testConnection(): Promise<boolean> {
    const body = {
      model: this.model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    };

    await this.post(API_URL, body);
    return true;
  }

  private async post(url: string, body: unknown): Promise<Response> {
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new NetworkError(this.name, err instanceof Error ? err : undefined);
    }

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({
        error: { message: response.statusText },
      }))) as AnthropicErrorResponse;
      throw new ProviderError(
        this.name,
        response.status,
        errorData.error?.message ?? response.statusText,
      );
    }

    return response;
  }
}
