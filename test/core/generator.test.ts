import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- mocks ----------

vi.mock('../../src/utils/git.js', () => ({
  getStagedDiff: vi.fn(),
}));

vi.mock('../../src/providers/registry.js', () => ({
  getProvider: vi.fn(),
}));

import { getStagedDiff } from '../../src/utils/git.js';
import { getProvider } from '../../src/providers/registry.js';
import { generateCommitMessage } from '../../src/core/generator.js';
import type { GcmConfig } from '../../src/config/schema.js';
import {
  SINGLE_FILE_DIFF,
  MULTI_DIR_DIFF,
  LARGE_DIFF,
} from '../fixtures/diffs.js';

const BASE_CONFIG: GcmConfig = {
  provider: 'openai',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  language: 'en',
  maxDiffLines: 500,
};

const mockProvider = {
  name: 'OpenAI',
  generateCommitMessage: vi.fn(),
  testConnection: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getProvider).mockReturnValue(mockProvider);
});

// ── happy path ────────────────────────────────────────────────────────────────

describe('generateCommitMessage — happy path', () => {
  it('returns the message from the provider', async () => {
    vi.mocked(getStagedDiff).mockReturnValue(SINGLE_FILE_DIFF);
    mockProvider.generateCommitMessage.mockResolvedValue('feat(auth): add login');

    const result = await generateCommitMessage(BASE_CONFIG);

    expect(result.message).toBe('feat(auth): add login');
  });

  it('returns the correct fileCount for a single-file diff', async () => {
    vi.mocked(getStagedDiff).mockReturnValue(SINGLE_FILE_DIFF);
    mockProvider.generateCommitMessage.mockResolvedValue('fix(auth): correct password check');

    const result = await generateCommitMessage(BASE_CONFIG);

    expect(result.fileCount).toBe(1);
  });

  it('returns the inferred scope for a single-directory diff', async () => {
    vi.mocked(getStagedDiff).mockReturnValue(SINGLE_FILE_DIFF);
    mockProvider.generateCommitMessage.mockResolvedValue('fix(auth): correct password check');

    const result = await generateCommitMessage(BASE_CONFIG);

    expect(result.scope).toBe('auth');
  });

  it('returns undefined scope when files span multiple directories', async () => {
    vi.mocked(getStagedDiff).mockReturnValue(MULTI_DIR_DIFF);
    mockProvider.generateCommitMessage.mockResolvedValue('refactor: move login logic');

    const result = await generateCommitMessage(BASE_CONFIG);

    expect(result.scope).toBeUndefined();
    expect(result.fileCount).toBe(2);
  });

  it('passes config.language to the provider', async () => {
    vi.mocked(getStagedDiff).mockReturnValue(SINGLE_FILE_DIFF);
    mockProvider.generateCommitMessage.mockResolvedValue('feat(auth): agregar login');

    const esConfig = { ...BASE_CONFIG, language: 'es' as const };
    await generateCommitMessage(esConfig);

    expect(mockProvider.generateCommitMessage).toHaveBeenCalledWith(
      SINGLE_FILE_DIFF,
      'es',
    );
  });

  it('returns sentDiff equal to the full diff when not truncated', async () => {
    vi.mocked(getStagedDiff).mockReturnValue(SINGLE_FILE_DIFF);
    mockProvider.generateCommitMessage.mockResolvedValue('fix(auth): correct password check');

    const result = await generateCommitMessage(BASE_CONFIG);

    expect(result.sentDiff).toBe(SINGLE_FILE_DIFF);
  });
});

// ── diff truncation ───────────────────────────────────────────────────────────

describe('generateCommitMessage — diff truncation', () => {
  it('marks truncated=false when diff is within maxDiffLines', async () => {
    vi.mocked(getStagedDiff).mockReturnValue(SINGLE_FILE_DIFF);
    mockProvider.generateCommitMessage.mockResolvedValue('fix(auth): minor tweak');

    const result = await generateCommitMessage(BASE_CONFIG);

    expect(result.truncated).toBe(false);
  });

  it('marks truncated=true when diff exceeds maxDiffLines', async () => {
    vi.mocked(getStagedDiff).mockReturnValue(LARGE_DIFF);
    mockProvider.generateCommitMessage.mockResolvedValue('feat(core): add generated constants');

    const result = await generateCommitMessage(BASE_CONFIG); // maxDiffLines = 500, LARGE_DIFF > 500

    expect(result.truncated).toBe(true);
  });

  it('sends the truncated diff (not the full diff) to the provider', async () => {
    vi.mocked(getStagedDiff).mockReturnValue(LARGE_DIFF);
    mockProvider.generateCommitMessage.mockResolvedValue('feat(core): add generated constants');

    await generateCommitMessage(BASE_CONFIG);

    const [sentDiff] = mockProvider.generateCommitMessage.mock.calls[0] as [string, string];
    const sentLines = sentDiff.split('\n').length;
    const originalLines = LARGE_DIFF.split('\n').length;

    expect(sentLines).toBeLessThan(originalLines);
    expect(sentDiff).toContain('[... diff truncated at 500 lines ...]');
  });

  it('sentDiff contains the truncation notice when diff is truncated', async () => {
    vi.mocked(getStagedDiff).mockReturnValue(LARGE_DIFF);
    mockProvider.generateCommitMessage.mockResolvedValue('feat(core): add generated constants');

    const result = await generateCommitMessage(BASE_CONFIG);

    expect(result.sentDiff).toContain('[... diff truncated at 500 lines ...]');
    expect(result.sentDiff.split('\n').length).toBeLessThan(LARGE_DIFF.split('\n').length);
  });

  it('respects a custom maxDiffLines value', async () => {
    vi.mocked(getStagedDiff).mockReturnValue(LARGE_DIFF);
    mockProvider.generateCommitMessage.mockResolvedValue('feat(core): add constants');

    const smallConfig = { ...BASE_CONFIG, maxDiffLines: 10 };
    const result = await generateCommitMessage(smallConfig);

    expect(result.truncated).toBe(true);
    const [sentDiff] = mockProvider.generateCommitMessage.mock.calls[0] as [string, string];
    expect(sentDiff).toContain('[... diff truncated at 10 lines ...]');
  });
});

// ── error propagation ─────────────────────────────────────────────────────────

describe('generateCommitMessage — error propagation', () => {
  it('propagates NoStagedChangesError from getStagedDiff', async () => {
    const { NoStagedChangesError } = await import('../../src/utils/errors.js');
    vi.mocked(getStagedDiff).mockImplementation(() => {
      throw new NoStagedChangesError();
    });

    await expect(generateCommitMessage(BASE_CONFIG)).rejects.toThrow(NoStagedChangesError);
  });

  it('propagates NotGitRepoError from getStagedDiff', async () => {
    const { NotGitRepoError } = await import('../../src/utils/errors.js');
    vi.mocked(getStagedDiff).mockImplementation(() => {
      throw new NotGitRepoError();
    });

    await expect(generateCommitMessage(BASE_CONFIG)).rejects.toThrow(NotGitRepoError);
  });

  it('propagates ProviderError from the provider', async () => {
    const { ProviderError } = await import('../../src/utils/errors.js');
    vi.mocked(getStagedDiff).mockReturnValue(SINGLE_FILE_DIFF);
    mockProvider.generateCommitMessage.mockRejectedValue(
      new ProviderError('OpenAI', 429, 'rate limited'),
    );

    await expect(generateCommitMessage(BASE_CONFIG)).rejects.toThrow(ProviderError);
  });
});
