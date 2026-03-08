import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '../../src/providers/openai.js';
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
  choices: [{ message: { content: 'feat(auth): add login function' } }],
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------- generateCommitMessage ----------

describe('OpenAIProvider.generateCommitMessage', () => {
  it('returns trimmed commit message on 200', async () => {
    mockFetch(200, SUCCESS_RESPONSE);
    const provider = new OpenAIProvider('sk-test', 'gpt-4o-mini');

    const result = await provider.generateCommitMessage(DIFF, 'en');

    expect(result).toBe('feat(auth): add login function');
  });

  it('sends POST to the correct URL with Authorization header', async () => {
    mockFetch(200, SUCCESS_RESPONSE);
    const provider = new OpenAIProvider('sk-mykey', 'gpt-4o-mini');

    await provider.generateCommitMessage(DIFF, 'en');

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-mykey');
  });

  it('includes the diff in the user message body', async () => {
    mockFetch(200, SUCCESS_RESPONSE);
    const provider = new OpenAIProvider('sk-test', 'gpt-4o-mini');

    await provider.generateCommitMessage(DIFF, 'en');

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { messages: Array<{ role: string; content: string }> };
    const userMsg = body.messages.find((m) => m.role === 'user');
    expect(userMsg?.content).toContain(DIFF);
  });

  it('throws ProviderError with 401 on authentication failure', async () => {
    mockFetch(401, { error: { message: 'Incorrect API key' } });
    const provider = new OpenAIProvider('bad-key', 'gpt-4o-mini');

    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(ProviderError);
    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(
      'Authentication failed',
    );
  });

  it('throws ProviderError with 429 on rate limit', async () => {
    mockFetch(429, { error: { message: 'Rate limit exceeded' } });
    const provider = new OpenAIProvider('sk-test', 'gpt-4o-mini');

    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(ProviderError);
    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(
      'Rate limited by OpenAI',
    );
  });

  it('throws ProviderError with 500 on server error', async () => {
    mockFetch(500, { error: { message: 'Internal Server Error' } });
    const provider = new OpenAIProvider('sk-test', 'gpt-4o-mini');

    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(ProviderError);
  });

  it('throws NetworkError when fetch rejects (no connection)', async () => {
    mockFetchNetworkError();
    const provider = new OpenAIProvider('sk-test', 'gpt-4o-mini');

    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(NetworkError);
    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(
      'Could not reach OpenAI',
    );
  });

  it('throws ProviderError when response has no choices content', async () => {
    mockFetch(200, { choices: [{ message: { content: null } }] });
    const provider = new OpenAIProvider('sk-test', 'gpt-4o-mini');

    await expect(provider.generateCommitMessage(DIFF, 'en')).rejects.toThrow(ProviderError);
  });
});

// ---------- testConnection ----------

describe('OpenAIProvider.testConnection', () => {
  it('returns true on 200', async () => {
    mockFetch(200, { choices: [{ message: { content: 'ok' } }] });
    const provider = new OpenAIProvider('sk-test', 'gpt-4o-mini');

    expect(await provider.testConnection()).toBe(true);
  });

  it('throws ProviderError on 401', async () => {
    mockFetch(401, { error: { message: 'Unauthorized' } });
    const provider = new OpenAIProvider('bad-key', 'gpt-4o-mini');

    await expect(provider.testConnection()).rejects.toThrow(ProviderError);
  });

  it('throws NetworkError when fetch rejects', async () => {
    mockFetchNetworkError('Network failure');
    const provider = new OpenAIProvider('sk-test', 'gpt-4o-mini');

    await expect(provider.testConnection()).rejects.toThrow(NetworkError);
  });
});
