import { getStagedDiff } from '../utils/git.js';
import { parseDiff, truncateDiff } from './diff-parser.js';
import { getProvider } from '../providers/registry.js';
import type { GcmConfig } from '../config/schema.js';

export interface GenerateResult {
  /** The Conventional Commits formatted message returned by the LLM. */
  message: string;
  /** Parsed metadata from the diff (files changed, inferred scope). */
  scope: string | undefined;
  /** Number of files changed in the staged diff. */
  fileCount: number;
  /** Whether the diff was truncated before being sent to the provider. */
  truncated: boolean;
  /** The exact diff string that was sent to the LLM (possibly truncated). */
  sentDiff: string;
}

/**
 * Orchestrates the full commit message generation flow:
 * 1. Reads the staged diff via `git diff --staged`.
 * 2. Parses changed files and infers the scope.
 * 3. Truncates the diff if it exceeds `config.maxDiffLines`.
 * 4. Calls the configured LLM provider to generate the message.
 *
 * Throws NoStagedChangesError / NotGitRepoError (from getStagedDiff)
 * or ProviderError / NetworkError (from the provider) — all are meant
 * to be caught and rendered at the CLI layer.
 *
 * @param config - The user's GcmConfig loaded from ~/.gcm/config.json
 */
export async function generateCommitMessage(config: GcmConfig): Promise<GenerateResult> {
  const rawDiff = getStagedDiff();
  const { files, scope } = parseDiff(rawDiff);

  const rawLines = rawDiff.split('\n').length;
  const truncated = rawLines > config.maxDiffLines;
  const diff = truncated ? truncateDiff(rawDiff, config.maxDiffLines) : rawDiff;

  const provider = getProvider(config);
  const message = await provider.generateCommitMessage(diff, config.language);

  return {
    message,
    scope,
    fileCount: files.length,
    truncated,
    sentDiff: diff,
  };
}
