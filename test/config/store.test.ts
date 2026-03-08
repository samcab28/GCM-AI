import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ---------- mock node:fs ----------
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
}));

import * as fs from 'node:fs';
import { loadConfig, saveConfig, getConfigPath } from '../../src/config/store.js';
import type { GcmConfig } from '../../src/config/schema.js';

const EXPECTED_PATH = join(homedir(), '.gcm', 'config.json');

const VALID_CONFIG: GcmConfig = {
  provider: 'openai',
  apiKey: 'sk-test-key',
  model: 'gpt-4o-mini',
  language: 'en',
  maxDiffLines: 500,
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------- getConfigPath ----------
describe('getConfigPath', () => {
  it('returns ~/.gcm/config.json', () => {
    expect(getConfigPath()).toBe(EXPECTED_PATH);
  });
});

// ---------- loadConfig ----------
describe('loadConfig', () => {
  it('returns null when config file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = loadConfig();

    expect(result).toBeNull();
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('returns parsed config when file exists and is valid', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(VALID_CONFIG));

    const result = loadConfig();

    expect(result).toEqual(VALID_CONFIG);
  });

  it('throws ZodError when file exists but contains invalid JSON data', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ provider: 'unknown' }));

    expect(() => loadConfig()).toThrow();
  });

  it('throws SyntaxError when file contains malformed JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{ not valid json }');

    expect(() => loadConfig()).toThrow(SyntaxError);
  });
});

// ---------- saveConfig ----------
describe('saveConfig', () => {
  it('creates the ~/.gcm directory when it does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    saveConfig(VALID_CONFIG);

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      join(homedir(), '.gcm'),
      { recursive: true },
    );
  });

  it('skips mkdirSync when directory already exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    saveConfig(VALID_CONFIG);

    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('writes prettified JSON to the config path', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    saveConfig(VALID_CONFIG);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      EXPECTED_PATH,
      JSON.stringify(VALID_CONFIG, null, 2),
      { encoding: 'utf-8' },
    );
  });

  it('sets file permissions to 0600', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    saveConfig(VALID_CONFIG);

    expect(fs.chmodSync).toHaveBeenCalledWith(EXPECTED_PATH, 0o600);
  });
});
