export interface ParsedDiff {
  /** Absolute or repo-relative paths of every changed file. */
  files: string[];
  /**
   * Inferred Conventional Commits scope.
   * - Single file: the deepest directory segment that is NOT "src".
   *   e.g. src/auth/login.ts → "auth"
   * - Multiple files in the same top-level (non-src) directory: that directory.
   *   e.g. src/auth/login.ts + src/auth/token.ts → "auth"
   * - Files from different top-level directories: undefined (omit scope).
   */
  scope: string | undefined;
}

/**
 * Parses the raw output of `git diff --staged` and returns the list of
 * changed files plus the inferred Conventional Commits scope.
 *
 * @param rawDiff - Full string output of `git diff --staged`
 */
export function parseDiff(rawDiff: string): ParsedDiff {
  const files = extractChangedFiles(rawDiff);
  const scope = inferScope(files);
  return { files, scope };
}

/**
 * Truncates a diff to at most `maxLines` lines, appending a notice when cut.
 *
 * @param rawDiff  - Raw diff string
 * @param maxLines - Maximum number of lines to keep
 */
export function truncateDiff(rawDiff: string, maxLines: number): string {
  const lines = rawDiff.split('\n');
  if (lines.length <= maxLines) {
    return rawDiff;
  }
  const kept = lines.slice(0, maxLines);
  kept.push(`\n[... diff truncated at ${maxLines} lines ...]`);
  return kept.join('\n');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts every "b/<path>" filename from `diff --git a/<path> b/<path>` lines.
 */
function extractChangedFiles(rawDiff: string): string[] {
  const files: string[] = [];
  // Match: diff --git a/<old> b/<new>
  // We always use the "b/" (new) path, which handles renames correctly.
  const pattern = /^diff --git a\/.+ b\/(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(rawDiff)) !== null) {
    const path = match[1];
    if (path !== undefined) {
      files.push(path);
    }
  }

  return files;
}

/**
 * Infers the commit scope from the list of changed file paths.
 *
 * Algorithm:
 * 1. Strip a leading "src/" segment so that "src/auth/login.ts" and
 *    "auth/login.ts" are treated the same way.
 * 2. Take the first remaining directory segment of each path.
 * 3. If all files share the same first segment → that is the scope.
 * 4. If the files span multiple different segments → scope is undefined.
 * 5. Root-level files (no directory) → scope is undefined.
 */
function inferScope(files: string[]): string | undefined {
  if (files.length === 0) {
    return undefined;
  }

  const segments = files.map(firstMeaningfulSegment);

  // If any file produced no segment (root-level file), drop the scope.
  if (segments.some((s) => s === undefined)) {
    return undefined;
  }

  const unique = new Set(segments as string[]);
  if (unique.size === 1) {
    return [...unique][0];
  }

  return undefined;
}

/**
 * Returns the first "meaningful" directory segment of a file path,
 * skipping a leading "src" segment if present.
 *
 * Examples:
 *   "src/auth/login.ts"         → "auth"
 *   "auth/login.ts"             → "auth"
 *   "src/auth/jwt/token.ts"     → "auth"
 *   "README.md"                 → undefined  (root-level, no directory)
 *   "src/index.ts"              → undefined  (only "src" above the file)
 */
function firstMeaningfulSegment(filePath: string): string | undefined {
  const parts = filePath.split('/');

  // Remove the filename (last part).
  const dirs = parts.slice(0, -1);

  if (dirs.length === 0) {
    return undefined;
  }

  // Skip the leading "src" segment.
  const start = dirs[0] === 'src' ? 1 : 0;

  return dirs[start];
}
