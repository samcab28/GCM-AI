import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { type GcmConfig, parseConfig } from './schema.js';

const GCM_DIR = join(homedir(), '.gcm');
const CONFIG_PATH = join(GCM_DIR, 'config.json');

/**
 * Returns the path to the config file. Exposed for testing.
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}

/**
 * Reads and validates ~/.gcm/config.json.
 * Returns null if the file does not exist (first run — setup required).
 * Throws if the file exists but contains invalid data.
 */
export function loadConfig(): GcmConfig | null {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }

  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  return parseConfig(parsed);
}

/**
 * Writes config to ~/.gcm/config.json with permissions 0600.
 * Creates ~/.gcm/ if it does not exist.
 */
export function saveConfig(config: GcmConfig): void {
  if (!existsSync(GCM_DIR)) {
    mkdirSync(GCM_DIR, { recursive: true });
  }

  const content = JSON.stringify(config, null, 2);
  writeFileSync(CONFIG_PATH, content, { encoding: 'utf-8' });
  chmodSync(CONFIG_PATH, 0o600);
}
