# CLAUDE.md - Project Instructions for Claude Code

## Project: gcm-ai

**Git Commit Message Generator** — A standalone CLI tool installed globally via npm. Reads `git diff --staged`, sends it to an LLM, and generates commit messages following the Conventional Commits specification. Each user's configuration (API key, provider, preferences) is stored locally on their machine. No server, no accounts, no infrastructure to manage.

## Architecture

Single TypeScript project compiled to a standalone CLI binary distributed via npm.

### Directory Structure

```
gcm-ai/
  src/
    core/
      generator.ts        # Orchestrator: runs git diff, calls provider, returns message
      prompt.ts           # System prompt template for Conventional Commits
      diff-parser.ts      # Parses git diff to extract changed files and scope
    providers/
      base.ts             # LLMProvider interface
      openai.ts           # OpenAI REST API client (native fetch, no SDK)
      anthropic.ts        # Anthropic REST API client (native fetch, no SDK)
      registry.ts         # Maps provider names to implementations
    cli/
      index.ts            # Entry point (bin/gcm). Arg parsing, main flow
      setup.ts            # First-run interactive setup wizard
      ui.ts               # Terminal UI: spinner, colors, prompts, diff display
    config/
      store.ts            # Read/write ~/.gcm/config.json (permissions 0600)
      schema.ts           # Config shape, defaults, validation with Zod
    utils/
      git.ts              # Git operations: diff, commit, check staged, get repo root
      errors.ts           # Custom error classes with actionable messages
  test/
    core/generator.test.ts
    providers/openai.test.ts
    providers/anthropic.test.ts
    cli/setup.test.ts
    config/store.test.ts
    utils/git.test.ts
  package.json
  tsconfig.json
  README.md
  CHANGELOG.md
  LICENSE
  .npmignore
```

## Technical Decisions

- **Language**: TypeScript strict mode
- **Build**: tsc compiling to dist/
- **Testing**: vitest with coverage
- **Node minimum**: 18.0.0 (for native fetch)
- **Zero runtime dependencies on LLM SDKs**: Call OpenAI and Anthropic REST APIs directly with native fetch
- **Minimal dependencies**: Only chalk (colors), ora (spinner). No frameworks.
- **Config storage**: Plain JSON file at ~/.gcm/config.json with fs permissions 0600
- **No telemetry, no analytics, no network calls except to the user's chosen LLM provider**

## Conventional Commits Format

Generated messages MUST follow:
```
type(scope): short description

- detail line 1 (only if diff is complex enough)
- detail line 2
```

Valid types: feat, fix, docs, style, refactor, perf, test, chore, ci, build
Scope: inferred from the top-level directories of changed files (e.g., src/auth/login.ts -> auth).
If changes span many directories, omit scope.

## Config Schema (~/.gcm/config.json)

```typescript
interface GcmConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;            // default depends on provider
  language: 'en' | 'es' | 'auto';
  maxDiffLines: number;     // default 500, truncate large diffs
}
```

Defaults:
- OpenAI: model = "gpt-4o-mini"
- Anthropic: model = "claude-sonnet-4-20250514"
- language = "en"
- maxDiffLines = 500

## CLI Commands and Flags

```
gcm                  # Main flow: generate commit message from staged changes
gcm --setup          # Re-run setup wizard (overwrite existing config)
gcm --provider X     # Override provider for this run only
gcm --model X        # Override model for this run only
gcm --dry-run        # Show generated message but don't commit
gcm --help           # Show usage
gcm --version        # Show version
```

## CLI UX Flow (main command)

```
$ gcm

# If no config exists -> run setup wizard automatically, then continue

# If no staged changes:
  "No staged changes found. Stage files with git add first."
  Exit code 1

# If not inside a git repo:
  "Not a git repository. Run this command inside a git project."
  Exit code 1

# Happy path:
  Analyzing staged changes...  (spinner)

  feat(auth): add JWT refresh token rotation

  - Implement automatic token refresh before expiration
  - Add retry logic for failed refresh attempts

  ? [Y] Accept  [e] Edit  [r] Regenerate  [n] Cancel

  Y -> runs git commit -m "<message>", shows success
  e -> opens $EDITOR with message, commits after save
  r -> calls LLM again with same diff
  n -> aborts, exit code 0
```

## Setup Wizard Flow

```
$ gcm --setup

  gcm-ai setup

  ? Select your LLM provider:
    > OpenAI
      Anthropic

  ? Enter your API key: sk-********************************
    (input is masked)

  ? Select default model:
    > gpt-4o-mini (fast, cheap)
      gpt-4o (more accurate)

  ? Commit message language:
    > English
      Spanish
      Auto-detect

  Testing connection... (checkmark) Connected successfully.

  Configuration saved to ~/.gcm/config.json
  You're all set. Run gcm after staging changes.
```

## Provider Interface

```typescript
interface LLMProvider {
  readonly name: string;
  generateCommitMessage(diff: string, language: string): Promise<string>;
  testConnection(): Promise<boolean>;
}
```

## Error Handling

All errors must be:
1. Caught at the CLI level (src/cli/index.ts)
2. Displayed with chalk.red and an actionable message
3. Never show raw stack traces to the user
4. Exit with appropriate codes (0 success, 1 user error, 2 system error)

Examples:
- API key invalid -> "Authentication failed. Run gcm --setup to update your API key."
- Network error -> "Could not reach [provider]. Check your internet connection."
- Empty diff -> "No staged changes found. Stage files with git add first."
- Rate limited -> "Rate limited by [provider]. Wait a moment and try again."

## Code Style

- async/await everywhere (no .then() chains)
- Early returns over nested conditionals
- JSDoc on all public functions
- No any types
- No console.log in core/ or providers/ -- only cli/ layer uses the UI abstraction
- Prefer const over let
- Meaningful variable names (no single letters except loop counters)

## Security

- API key stored with file permissions 0600 (owner read/write only)
- API key input masked in terminal
- API key never logged, never included in error messages
- No data sent anywhere except the user's chosen LLM API endpoint
- Diff content sent only to the LLM -- not stored, not cached