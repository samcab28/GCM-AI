# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-08

### Added

- **CLI entry point** (`gcm`) with flags: `--setup`, `--dry-run`, `--verbose`,
  `--provider`, `--model`, `--help`, `--version`.
- **Interactive setup wizard** (`gcm --setup`) — selects provider, model, and
  language; masks API key input; tests connection before saving; retries on
  authentication failure.
- **OpenAI provider** — calls `POST /v1/chat/completions` with native `fetch`;
  handles 401, 429, 500, and network errors with actionable messages.
- **Anthropic provider** — calls `POST /v1/messages` with `x-api-key` and
  `anthropic-version` headers; same error handling as OpenAI.
- **Provider registry** — `getProvider(config)` maps config to the correct
  provider instance with exhaustive TypeScript type checking.
- **Diff parser** — extracts changed files from `git diff --staged` output and
  infers the Conventional Commits scope from the common top-level directory.
  Handles renames (uses the `b/` path), missing `src/` prefix, and root-level
  files.
- **Diff truncation** — diffs exceeding `maxDiffLines` (default 500) are cut
  and annotated before being sent to the LLM.
- **Generator** — orchestrates diff reading, parsing, truncation, and LLM call;
  returns `GenerateResult` with message, scope, file count, truncation flag, and
  the exact diff sent.
- **System prompt** — Conventional Commits specification with type table, format
  rules, good/bad examples, and language support (`en` / `es` / `auto`).
- **Terminal UI** — ora spinner, chalk-colored output, single-keypress
  confirmation (`Y` / `e` / `r` / `n`), numbered select, and masked password
  prompt — all using raw-mode stdin without extra dependencies.
- **Config storage** — reads/writes `~/.gcm/config.json` with `0600`
  permissions; validated with Zod on load.
- **`--verbose` flag** — prints provider/model info, the diff sent to the LLM,
  and the raw response text for debugging.
- **Editor integration** — `e` in the confirmation prompt opens `$EDITOR` (or
  `vi`) with the generated message in a temp file; commits the edited result.
- **`--dry-run` flag** — displays the generated message without committing.
- **`--provider` / `--model` flags** — per-run overrides without touching
  the saved configuration.
- 79 unit tests across config, git utils, both LLM providers, diff parser,
  and generator (vitest, zero real network calls).

### Security

- API key stored with `chmod 0600`; never logged, never included in error
  messages, never sent anywhere except the user's chosen LLM endpoint.
- Diff content sent only to the LLM — not stored, not cached.

[0.1.0]: https://github.com/samcab28/GCM-AI/releases/tag/v0.1.0
