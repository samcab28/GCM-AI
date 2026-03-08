import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- mock node:child_process ----------
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import {
  isGitRepo,
  getStagedDiff,
  hasStagedChanges,
  commitWithMessage,
} from '../../src/utils/git.js';
import { NotGitRepoError, NoStagedChangesError } from '../../src/utils/errors.js';

const mockedExecSync = vi.mocked(execSync);

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------- isGitRepo ----------
describe('isGitRepo', () => {
  it('returns true when inside a git repo', () => {
    mockedExecSync.mockReturnValue('true\n');

    expect(isGitRepo()).toBe(true);
    expect(mockedExecSync).toHaveBeenCalledWith(
      'git rev-parse --is-inside-work-tree',
      expect.objectContaining({ encoding: 'utf-8' }),
    );
  });

  it('returns false when execSync throws (not a git repo)', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('not a git repository');
    });

    expect(isGitRepo()).toBe(false);
  });
});

// ---------- getStagedDiff ----------
describe('getStagedDiff', () => {
  it('returns the diff when there are staged changes', () => {
    const fakeDiff = 'diff --git a/foo.ts b/foo.ts\n+added line\n';
    // first call: isGitRepo check, second call: git diff --staged
    mockedExecSync
      .mockReturnValueOnce('true\n')
      .mockReturnValueOnce(fakeDiff);

    const result = getStagedDiff();

    expect(result).toBe(fakeDiff);
  });

  it('throws NotGitRepoError when not in a git repo', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('not a git repo');
    });

    expect(() => getStagedDiff()).toThrow(NotGitRepoError);
  });

  it('throws NoStagedChangesError when diff is empty', () => {
    mockedExecSync
      .mockReturnValueOnce('true\n') // isGitRepo
      .mockReturnValueOnce('   ');   // empty diff

    expect(() => getStagedDiff()).toThrow(NoStagedChangesError);
  });
});

// ---------- hasStagedChanges ----------
describe('hasStagedChanges', () => {
  it('returns true when staged files list is non-empty', () => {
    mockedExecSync
      .mockReturnValueOnce('true\n')      // isGitRepo
      .mockReturnValueOnce('src/foo.ts\n'); // --name-only

    expect(hasStagedChanges()).toBe(true);
  });

  it('returns false when staged files list is empty', () => {
    mockedExecSync
      .mockReturnValueOnce('true\n') // isGitRepo
      .mockReturnValueOnce('');      // --name-only

    expect(hasStagedChanges()).toBe(false);
  });

  it('throws NotGitRepoError when not in a git repo', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('not a git repo');
    });

    expect(() => hasStagedChanges()).toThrow(NotGitRepoError);
  });
});

// ---------- commitWithMessage ----------
describe('commitWithMessage', () => {
  it('calls git commit with the escaped message', () => {
    mockedExecSync
      .mockReturnValueOnce('true\n') // isGitRepo
      .mockReturnValueOnce('');      // git commit

    commitWithMessage('feat(auth): add login');

    expect(mockedExecSync).toHaveBeenLastCalledWith(
      'git commit -m "feat(auth): add login"',
      expect.objectContaining({ encoding: 'utf-8' }),
    );
  });

  it('escapes double quotes inside the message via JSON.stringify', () => {
    mockedExecSync
      .mockReturnValueOnce('true\n')
      .mockReturnValueOnce('');

    commitWithMessage('fix: handle "edge" case');

    expect(mockedExecSync).toHaveBeenLastCalledWith(
      'git commit -m "fix: handle \\"edge\\" case"',
      expect.objectContaining({ encoding: 'utf-8' }),
    );
  });

  it('throws NotGitRepoError when not in a git repo', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('not a git repo');
    });

    expect(() => commitWithMessage('chore: bump version')).toThrow(NotGitRepoError);
  });

  it('propagates errors thrown by git commit itself', () => {
    mockedExecSync
      .mockReturnValueOnce('true\n') // isGitRepo
      .mockImplementationOnce(() => {
        throw new Error('pre-commit hook rejected');
      });

    expect(() => commitWithMessage('chore: test')).toThrow('pre-commit hook rejected');
  });
});
