import { execSync } from 'node:child_process';
import { NotGitRepoError, NoStagedChangesError } from './errors.js';

const EXEC_OPTS = { encoding: 'utf-8' as const };

/**
 * Returns true if the current working directory is inside a git repository.
 */
export function isGitRepo(): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      ...EXEC_OPTS,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the output of `git diff --staged`.
 * Throws NotGitRepoError if not in a git repo.
 * Throws NoStagedChangesError if there is nothing staged.
 */
export function getStagedDiff(): string {
  if (!isGitRepo()) {
    throw new NotGitRepoError();
  }

  const diff = execSync('git diff --staged', { ...EXEC_OPTS, stdio: 'pipe' });
  if (diff.trim().length === 0) {
    throw new NoStagedChangesError();
  }

  return diff;
}

/**
 * Returns true when there are staged changes, false otherwise.
 * Throws NotGitRepoError if not in a git repo.
 */
export function hasStagedChanges(): boolean {
  if (!isGitRepo()) {
    throw new NotGitRepoError();
  }

  const diff = execSync('git diff --staged --name-only', {
    ...EXEC_OPTS,
    stdio: 'pipe',
  });
  return diff.trim().length > 0;
}

/**
 * Runs `git commit -m <message>`.
 * Throws NotGitRepoError if not in a git repo.
 * Throws if git commit itself fails (e.g. nothing staged, hooks reject).
 */
export function commitWithMessage(message: string): void {
  if (!isGitRepo()) {
    throw new NotGitRepoError();
  }

  execSync(`git commit -m ${JSON.stringify(message)}`, {
    ...EXEC_OPTS,
    stdio: 'pipe',
  });
}
