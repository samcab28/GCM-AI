import chalk from 'chalk';
import { askSelect, askPassword, showSpinner } from './ui.js';
import { saveConfig } from '../config/store.js';
import { getProvider } from '../providers/registry.js';
import type { GcmConfig } from '../config/schema.js';

// ── Model menus per provider ──────────────────────────────────────────────────

const OPENAI_MODELS = [
  { label: 'gpt-4o-mini (fast, cheap)', value: 'gpt-4o-mini' },
  { label: 'gpt-4o (more accurate)', value: 'gpt-4o' },
] as const;

const ANTHROPIC_MODELS = [
  { label: 'claude-sonnet-4-20250514 (balanced)', value: 'claude-sonnet-4-20250514' },
  { label: 'claude-haiku-4-5-20251001 (fast, cheap)', value: 'claude-haiku-4-5-20251001' },
] as const;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Runs the interactive first-run setup wizard:
 * 1. Select provider (OpenAI | Anthropic)
 * 2. Enter API key (masked)
 * 3. Select default model
 * 4. Select commit message language
 * 5. Test connection — retries if the key is invalid
 * 6. Save ~/.gcm/config.json with 0600 permissions
 *
 * @returns The saved GcmConfig.
 */
export async function runSetup(): Promise<GcmConfig> {
  console.log('\n' + chalk.bold('  gcm-ai setup') + '\n');

  // Step 1 — provider
  const provider = await askSelect('Select your LLM provider:', [
    { label: 'OpenAI', value: 'openai' as const },
    { label: 'Anthropic', value: 'anthropic' as const },
  ]);

  // Step 2 — model (options depend on provider)
  const modelOptions = provider === 'openai' ? [...OPENAI_MODELS] : [...ANTHROPIC_MODELS];
  const model = await askSelect('Select default model:', modelOptions);

  // Step 3 — language
  const language = await askSelect('Commit message language:', [
    { label: 'English', value: 'en' as const },
    { label: 'Spanish', value: 'es' as const },
    { label: 'Auto-detect', value: 'auto' as const },
  ]);

  // Step 4 — API key + connection test with retry
  let apiKey = await askPassword('Enter your API key: ');
  let config = buildConfig(provider, apiKey, model, language);

  let connected = false;
  do {
    const spinner = showSpinner('Testing connection...');

    try {
      await getProvider(config).testConnection();
      spinner.succeed(chalk.green('Connected successfully.'));
      connected = true;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      spinner.fail(chalk.red(`Connection failed: ${detail}`));
      console.log();

      const action = await askSelect('What would you like to do?', [
        { label: 'Try a different API key', value: 'retry' as const },
        { label: 'Cancel setup', value: 'cancel' as const },
      ]);

      if (action === 'cancel') {
        console.log(chalk.dim('\nSetup cancelled. Run gcm --setup to try again.\n'));
        process.exit(1);
      }

      apiKey = await askPassword('Enter your API key: ');
      config = buildConfig(provider, apiKey, model, language);
    }
  } while (!connected);

  saveConfig(config);
  console.log(chalk.dim(`\n  Configuration saved to ~/.gcm/config.json`));
  console.log("  You're all set. Run gcm after staging changes.\n");

  return config;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildConfig(
  provider: GcmConfig['provider'],
  apiKey: string,
  model: string,
  language: GcmConfig['language'],
): GcmConfig {
  return { provider, apiKey, model, language, maxDiffLines: 500 };
}
