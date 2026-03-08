import { describe, it, expect } from 'vitest';
import { parseDiff, truncateDiff } from '../../src/core/diff-parser.js';
import {
  SINGLE_FILE_DIFF,
  MULTI_FILE_SAME_DIR_DIFF,
  MULTI_DIR_DIFF,
  ROOT_FILES_DIFF,
  RENAME_DIFF,
  NO_SRC_PREFIX_DIFF,
  LARGE_DIFF,
} from '../fixtures/diffs.js';

// ── parseDiff: file extraction ────────────────────────────────────────────────

describe('parseDiff — file extraction', () => {
  it('extracts the single changed file', () => {
    const { files } = parseDiff(SINGLE_FILE_DIFF);
    expect(files).toEqual(['src/auth/login.ts']);
  });

  it('extracts both files from a two-file diff', () => {
    const { files } = parseDiff(MULTI_FILE_SAME_DIR_DIFF);
    expect(files).toEqual(['src/auth/login.ts', 'src/auth/token.ts']);
  });

  it('extracts files from different directories', () => {
    const { files } = parseDiff(MULTI_DIR_DIFF);
    expect(files).toEqual(['src/auth/login.ts', 'src/api/routes.ts']);
  });

  it('extracts root-level files (no directory)', () => {
    const { files } = parseDiff(ROOT_FILES_DIFF);
    expect(files).toEqual(['README.md', 'package.json']);
  });

  it('uses the new (b/) path for renamed files', () => {
    const { files } = parseDiff(RENAME_DIFF);
    expect(files).toEqual(['src/config/store.ts']);
  });

  it('returns an empty array for an empty diff string', () => {
    const { files } = parseDiff('');
    expect(files).toEqual([]);
  });
});

// ── parseDiff: scope inference ────────────────────────────────────────────────

describe('parseDiff — scope inference', () => {
  it('infers scope from a single file under src/<dir>/', () => {
    const { scope } = parseDiff(SINGLE_FILE_DIFF);
    expect(scope).toBe('auth');
  });

  it('infers scope when multiple files share the same directory under src/', () => {
    const { scope } = parseDiff(MULTI_FILE_SAME_DIR_DIFF);
    expect(scope).toBe('auth');
  });

  it('returns undefined when files span different directories', () => {
    const { scope } = parseDiff(MULTI_DIR_DIFF);
    expect(scope).toBeUndefined();
  });

  it('returns undefined for root-level files', () => {
    const { scope } = parseDiff(ROOT_FILES_DIFF);
    expect(scope).toBeUndefined();
  });

  it('infers scope from the new path of a renamed file', () => {
    const { scope } = parseDiff(RENAME_DIFF);
    expect(scope).toBe('config');
  });

  it('infers scope from dirs that do NOT start with src/', () => {
    const { scope } = parseDiff(NO_SRC_PREFIX_DIFF);
    expect(scope).toBe('lib');
  });

  it('returns undefined for an empty diff', () => {
    const { scope } = parseDiff('');
    expect(scope).toBeUndefined();
  });

  it('infers scope from a deeply nested file under src/', () => {
    const deepDiff = `diff --git a/src/auth/jwt/refresh.ts b/src/auth/jwt/refresh.ts
index 0000000..1111111 100644
--- /dev/null
+++ b/src/auth/jwt/refresh.ts
@@ -0,0 +1 @@
+export {};
`;
    const { scope } = parseDiff(deepDiff);
    expect(scope).toBe('auth');
  });

  it('returns undefined when one file is root-level and another is in a directory', () => {
    const mixedDiff = `diff --git a/README.md b/README.md
index 1111111..2222222 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
+# updated
diff --git a/src/auth/login.ts b/src/auth/login.ts
index 3333333..4444444 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -1 +1,2 @@
+// fix
`;
    const { scope } = parseDiff(mixedDiff);
    expect(scope).toBeUndefined();
  });
});

// ── truncateDiff ──────────────────────────────────────────────────────────────

describe('truncateDiff', () => {
  it('returns the diff unchanged when under the limit', () => {
    const result = truncateDiff(SINGLE_FILE_DIFF, 500);
    expect(result).toBe(SINGLE_FILE_DIFF);
  });

  it('truncates and appends a notice when over the limit', () => {
    const result = truncateDiff(LARGE_DIFF, 10);
    const lines = result.split('\n');
    expect(lines.length).toBeLessThanOrEqual(12); // 10 lines + notice line + possible empty
    expect(result).toContain('[... diff truncated at 10 lines ...]');
  });

  it('keeps exactly maxLines of content before the notice', () => {
    const result = truncateDiff(LARGE_DIFF, 5);
    const originalLines = LARGE_DIFF.split('\n');
    const resultLines = result.split('\n');
    for (let i = 0; i < 5; i++) {
      expect(resultLines[i]).toBe(originalLines[i]);
    }
  });

  it('returns diff unchanged when line count equals maxLines exactly', () => {
    const fiveLine = 'a\nb\nc\nd\ne';
    expect(truncateDiff(fiveLine, 5)).toBe(fiveLine);
  });

  it('truncates the LARGE_DIFF fixture to 500 lines (default maxDiffLines)', () => {
    const result = truncateDiff(LARGE_DIFF, 500);
    expect(result).toContain('[... diff truncated at 500 lines ...]');
    expect(result.split('\n').length).toBeLessThan(LARGE_DIFF.split('\n').length);
  });
});
