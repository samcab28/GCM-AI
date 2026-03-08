import { buildSystemPrompt, buildUserMessage } from '../core/prompt.js';
import { ProviderError, NetworkError } from '../utils/errors.js';
import type { LLMProvider } from './base.js';

const API_URL = 'https://api.openai.com/v1/chat/completions';

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
  };
}

export class OpenAIProvider implements LLMProvider {
  readonly name = 'OpenAI';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  /**
   * Calls POST /v1/chat/completions and returns the generated commit message.
   */
  async generateCommitMessage(diff: string, language: string): Promise<string> {
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: buildSystemPrompt(language) },
        { role: 'user', content: buildUserMessage(diff) },
      ],
      temperature: 0.2,
      max_tokens: 256,
    };

    const response = await this.post(API_URL, body);
    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices[0]?.message.content;

    if (!content) {
      throw new ProviderError(this.name, 500, 'Empty response from model');
    }

    return content.trim();
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
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new NetworkError(this.name, err instanceof Error ? err : undefined);
    }

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({
        error: { message: response.statusText },
      }))) as OpenAIErrorResponse;
      throw new ProviderError(
        this.name,
        response.status,
        errorData.error?.message ?? response.statusText,
      );
    }

    return response;
  }
}
