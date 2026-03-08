import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicProvider } from '../../src/providers/anthropic.js';
import { ProviderError, NetworkError } from '../../src/utils/errors.js';

// ---------- fetch mock helpers ----------

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: String(status),
      json: () => Promise.resolve(body),
    }),
  );
}

function mockFetchNetworkError(message = 'Failed to fetch'): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error(message)),
  );
}

const DIFF = 'diff --git a/src/auth.ts b/src/auth.ts\n+export function login() {}\n';

const SUCCESS_RESPONSE = {
  content: [{ type: 'text', text: 'feat(auth): add login function' }],
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------- generateCommitMessage ----------

describe('AnthropicProvider.generateCommitMessage', () => {
  it('returns trimmed commit message on 200', async () => {
    mockFetch(200, SUCCESS_RESPONSE);
    const provider = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');

    const result = await provider.generateCommitMessage(DIFF, 'en');

    expect(result).toBe('feat(auth): add login function');
  });

  it('sends POST to the correct URL', async () => {
    mockFetch(200, SUCCESS_RESPONSE);
    const provider = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');

    await provider.generateCommitMessage(DIFF, 'en');

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('sends x-api-key and anthropic-version headers', async () => {
    mockFetch(200, SUCCESS_RESPONSE);
    const provider = new AnthropicProvider('sk-ant-mykey', 'claude-sonnet-4-20250514');

    await provider.generateCommitMessage(DIFF, 'en');

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-mykey');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('does NOT send Authorization header', async () => {
    mockFetch(200, SUCCESS_RESPONSE);
    const provider = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');

    await provider.generateCommitMessage(DIFF, 'en');

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('includes system prompt and diff in the request body', async () => {
    mockFetch(200, SUCCESS_RESPONSE);
    const provider = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');

    await provider.generateCommitMessage(DIFF, 'en');

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      system: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.system).toContain('Conventional Commits');
    expect(body.messages[0]?.content).toContain(DIFF);
  });

  it('throws ProviderError with 401 on authentication failure', async () => {
    mockFetch(401, { error: { message: 'Invalid API key' } });
    const provider = new AnthropicProvider('bad-key', 'claude-sonnet-4-20250514');

    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(ProviderError);
    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(
      'Authentication failed',
    );
  });

  it('throws ProviderError with 429 on rate limit', async () => {
    mockFetch(429, { error: { message: 'Too many requests' } });
    const provider = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');

    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(ProviderError);
    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(
      'Rate limited by Anthropic',
    );
  });

  it('throws ProviderError with 500 on server error', async () => {
    mockFetch(500, { error: { message: 'Internal Server Error' } });
    const provider = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');

    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(ProviderError);
  });

  it('throws NetworkError when fetch rejects (no connection)', async () => {
    mockFetchNetworkError();
    const provider = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');

    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(NetworkError);
    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(
      'Could not reach Anthropic',
    );
  });

  it('throws ProviderError when response has no text content block', async () => {
    mockFetch(200, { content: [{ type: 'tool_use', text: '' }] });
    const provider = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');

    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(ProviderError);
  });
});

// ---------- testConnection ----------

describe('AnthropicProvider.testConnection', () => {
  it('returns true on 200', async () => {
    mockFetch(200, SUCCESS_RESPONSE);
    const provider = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');

    expect(await provider.testConnection()).toBe(true);
  });

  it('throws ProviderError on 401', async () => {
    mockFetch(401, { error: { message: 'Unauthorized' } });
    const provider = new AnthropicProvider('bad-key', 'claude-sonnet-4-20250514');

    await expect(provider.testConnection()).rejects.toThrow(ProviderError);
  });

  it('throws NetworkError when fetch rejects', async () => {
    mockFetchNetworkError('Network failure');
    const provider = new AnthropicProvider('sk-ant-test', 'claude-sonnet-4-20250514');

    await expect(provider.testConnection()).rejects.toThrow(NetworkError);
  });
});
