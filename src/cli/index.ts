#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { loadConfig } from '../config/store.js';
import { generateCommitMessage, type GenerateResult } from '../core/generator.js';
import { commitWithMessage } from '../utils/git.js';
import {
  showSpinner,
  showSuccess,
  showError,
  showCommitMessage,
  askConfirmation,
} from './ui.js';
import { runSetup } from './setup.js';
import type { GcmConfig } from '../config/schema.js';

// ── Version ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
) as { name: string; version: string };

// ── Arg parsing ───────────────────────────────────────────────────────────────

interface Flags {
  setup: boolean;
  dryRun: boolean;
  verbose: boolean;
  help: boolean;
  version: boolean;
  provider: string | undefined;
  model: string | undefined;
}

function parseArgs(): Flags {
  const args = process.argv.slice(2);

  const getFlagValue = (name: string): string | undefined => {
    const idx = args.indexOf(name);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  return {
    setup: args.includes('--setup'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    help: args.includes('--help') || args.includes('-h'),
    version: args.includes('--version') || args.includes('-v'),
    provider: getFlagValue('--provider'),
    model: getFlagValue('--model'),
  };
}

// ── Help / version ────────────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`
  ${chalk.bold(`${pkg.name} v${pkg.version}`)} — AI-powered Git commit message generator

  ${chalk.bold('USAGE')}
    gcm [options]

  ${chalk.bold('OPTIONS')}
    ${chalk.cyan('--setup')}               Run the setup wizard (create or update config)
    ${chalk.cyan('--dry-run')}             Show generated message without committing
    ${chalk.cyan('--verbose')}             Print the diff sent to the LLM and raw response
    ${chalk.cyan('--provider')} ${chalk.dim('<name>')}    Override provider for this run ${chalk.dim('(openai | anthropic)')}
    ${chalk.cyan('--model')} ${chalk.dim('<name>')}       Override model for this run
    ${chalk.cyan('--help')},  ${chalk.dim('-h')}          Show this help message
    ${chalk.cyan('--version')}, ${chalk.dim('-v')}        Show version number

  ${chalk.bold('EXAMPLES')}
    ${chalk.dim('$')} gcm                        Generate commit message from staged changes
    ${chalk.dim('$')} gcm --setup                Configure your provider and API key
    ${chalk.dim('$')} gcm --dry-run              Preview message without committing
    ${chalk.dim('$')} gcm --provider anthropic   Use Anthropic for this run only
    ${chalk.dim('$')} gcm --model gpt-4o         Use a specific model for this run
`);
}

function showVersion(): void {
  console.log(`${pkg.name} v${pkg.version}`);
}

// ── Editor ────────────────────────────────────────────────────────────────────

/**
 * Opens the message in $EDITOR (fallback: vi) via a temporary file.
 * Blocks until the editor process exits, then returns the edited content.
 */
function openInEditor(message: string): string {
  const tmpFile = join(tmpdir(), `gcm-${Date.now()}.txt`);
  writeFileSync(tmpFile, message, 'utf-8');

  const editor = process.env['EDITOR'] ?? 'vi';

  try {
    execSync(`${editor} ${JSON.stringify(tmpFile)}`, { stdio: 'inherit' });
    return readFileSync(tmpFile, 'utf-8').trim();
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors — the OS will reclaim the tmp file eventually.
    }
  }
}

// ── Verbose output ────────────────────────────────────────────────────────────

const VERBOSE_RULE = chalk.dim('─'.repeat(60));

/**
 * Prints debug information when --verbose is active.
 * Never prints the API key — only diff content and LLM output.
 */
function printVerbose(config: GcmConfig, result: GenerateResult): void {
  const lineCount = result.sentDiff.split('\n').length;
  const truncatedNote = result.truncated ? chalk.yellow(' (truncated)') : '';

  console.log(
    `\n${chalk.bold.magenta('[verbose]')} provider: ${chalk.cyan(config.provider)}  ` +
      `model: ${chalk.cyan(config.model)}`,
  );

  console.log(
    `${chalk.bold.magenta('[verbose]')} diff sent — ` +
      `${chalk.cyan(String(result.fileCount))} file(s), ` +
      `${chalk.cyan(String(lineCount))} lines${truncatedNote}`,
  );
  console.log(VERBOSE_RULE);
  console.log(chalk.dim(result.sentDiff));
  console.log(VERBOSE_RULE);

  console.log(`\n${chalk.bold.magenta('[verbose]')} raw LLM response:`);
  console.log(VERBOSE_RULE);
  console.log(chalk.dim(result.message));
  console.log(VERBOSE_RULE + '\n');
}

// ── Error rendering ───────────────────────────────────────────────────────────

function handleError(err: unknown): void {
  if (err instanceof Error) {
    showError(err.message);
  } else {
    showError('An unexpected error occurred.');
  }
}

// ── Config resolution ─────────────────────────────────────────────────────────

/**
 * Returns a resolved GcmConfig:
 * - Loads ~/.gcm/config.json if it exists.
 * - Runs the setup wizard if the file is missing or --setup was passed.
 * - Returns null when --setup was the explicit intent (no commit flow needed).
 */
async function resolveConfig(flags: Flags): Promise<GcmConfig | null> {
  const existing = loadConfig();

  if (!existing || flags.setup) {
    const fresh = await runSetup();
    // --setup: wizard done, caller should exit without committing.
    return flags.setup ? null : fresh;
  }

  return existing;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const flags = parseArgs();

  if (flags.help) {
    showHelp();
    return;
  }

  if (flags.version) {
    showVersion();
    return;
  }

  // Resolve config (runs setup wizard if needed).
  const baseConfig = await resolveConfig(flags);
  if (baseConfig === null) {
    // --setup was explicit: setup completed, nothing more to do.
    return;
  }

  // Apply per-run overrides.
  let config: GcmConfig = baseConfig;

  if (flags.provider !== undefined) {
    const p = flags.provider;
    if (p !== 'openai' && p !== 'anthropic') {
      showError(`Unknown provider "${p}". Valid values: openai, anthropic`);
      process.exit(1);
    }
    config = { ...config, provider: p };
  }

  if (flags.model !== undefined) {
    config = { ...config, model: flags.model };
  }

  // ── Generate ────────────────────────────────────────────────────────────────

  const spinner = showSpinner('Analyzing staged changes...');

  let result!: GenerateResult;
  try {
    result = await generateCommitMessage(config);
  } catch (err) {
    spinner.stop();
    handleError(err);
    process.exit(1);
  }

  spinner.stop();

  if (flags.verbose) {
    printVerbose(config, result);
  }

  showCommitMessage(result.message);

  if (result.truncated && !flags.verbose) {
    // verbose already shows truncation info; skip the duplicate notice
    console.log(chalk.dim(`  (diff truncated to ${config.maxDiffLines} lines)\n`));
  }

  if (flags.dryRun) {
    showSuccess('Dry run — no commit made.');
    return;
  }

  // ── Interaction loop ────────────────────────────────────────────────────────

  let currentMessage = result.message;
  let done = false;

  while (!done) {
    const answer = await askConfirmation();

    switch (answer) {
      case 'accept': {
        try {
          commitWithMessage(currentMessage);
          showSuccess('Committed successfully.');
        } catch (err) {
          handleError(err);
          process.exit(2);
        }
        done = true;
        break;
      }

      case 'edit': {
        const edited = openInEditor(currentMessage);
        if (!edited) {
          showError('Empty message — commit aborted.');
          process.exit(1);
        }
        currentMessage = edited;
        showCommitMessage(currentMessage);
        break;
      }

      case 'regenerate': {
        const spinner2 = showSpinner('Regenerating...');
        try {
          const fresh = await generateCommitMessage(config);
          currentMessage = fresh.message;
          spinner2.stop();
          showCommitMessage(currentMessage);
        } catch (err) {
          spinner2.stop();
          handleError(err);
          process.exit(1);
        }
        break;
      }

      case 'cancel': {
        console.log(chalk.dim('Aborted.'));
        done = true;
        break;
      }
    }
  }
}

main().catch((err: unknown) => {
  handleError(err);
  process.exit(2);
});
