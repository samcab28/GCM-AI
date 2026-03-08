import chalk from 'chalk';
import ora from 'ora';
import type { Ora } from 'ora';

export type { Ora };

// ── Passive output ────────────────────────────────────────────────────────────

/**
 * Starts an ora spinner with the given text and returns it so the
 * caller can call .stop(), .succeed(), or .fail() later.
 */
export function showSpinner(text: string): Ora {
  return ora(text).start();
}

/** Prints a green success line to stdout. */
export function showSuccess(text: string): void {
  console.log(chalk.green(`✓ ${text}`));
}

/** Prints a red error line to stderr. */
export function showError(text: string): void {
  console.error(chalk.red(`✗ ${text}`));
}

/**
 * Renders a commit message with the header in bold cyan and
 * bullet lines in dim, indented by two spaces.
 */
export function showCommitMessage(message: string): void {
  console.log();
  for (const line of message.split('\n')) {
    if (line.startsWith('-')) {
      console.log('  ' + chalk.dim(line));
    } else if (line.trim() === '') {
      console.log();
    } else {
      console.log('  ' + chalk.bold.cyan(line));
    }
  }
  console.log();
}

// ── Interactive prompts (raw-mode stdin) ──────────────────────────────────────

/**
 * Displays the [Y/e/r/n] confirmation bar and waits for a single keypress.
 * Enter and Y/y both map to "accept". Ctrl+C maps to "cancel".
 */
export async function askConfirmation(): Promise<'accept' | 'edit' | 'regenerate' | 'cancel'> {
  process.stdout.write(
    chalk.dim('? ') +
      `[${chalk.bold.green('Y')}] Accept  ` +
      `[${chalk.bold('e')}] Edit  ` +
      `[${chalk.bold('r')}] Regenerate  ` +
      `[${chalk.bold('n')}] Cancel  `,
  );

  return new Promise((resolve) => {
    const handler = (key: Buffer): void => {
      const char = key.toString('utf-8').toLowerCase();
      cleanup();
      process.stdout.write('\n');

      if (char === 'e') resolve('edit');
      else if (char === 'r') resolve('regenerate');
      else if (char === 'n' || char === '\u0003') resolve('cancel');
      else resolve('accept'); // Y, Enter, or any other key
    };

    const cleanup = (): void => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', handler);
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', handler);
  });
}

export interface SelectOption<T extends string> {
  label: string;
  value: T;
}

/**
 * Displays a numbered list of options and waits for a single keypress
 * corresponding to the option index (1-based).
 */
export async function askSelect<T extends string>(
  question: string,
  options: Array<SelectOption<T>>,
): Promise<T> {
  console.log(chalk.dim('? ') + question);
  options.forEach((opt, i) => {
    console.log(`  ${chalk.bold(`[${i + 1}]`)} ${opt.label}`);
  });
  process.stdout.write(`\n  ${chalk.dim(`Select [1-${options.length}]:`)} `);

  return new Promise((resolve) => {
    const handler = (key: Buffer): void => {
      const char = key.toString('utf-8');

      if (char === '\u0003') {
        // Ctrl+C
        cleanup();
        process.stdout.write('\n');
        process.exit(0);
      }

      const num = parseInt(char, 10);
      if (isNaN(num) || num < 1 || num > options.length) {
        return; // ignore invalid keys, keep waiting
      }

      cleanup();
      const selected = options[num - 1]!;
      process.stdout.write(chalk.cyan(selected.label) + '\n\n');
      resolve(selected.value);
    };

    const cleanup = (): void => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', handler);
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', handler);
  });
}

/**
 * Prompts for a secret value, printing '*' for each character typed.
 * Supports Backspace and Ctrl+C.
 */
export async function askPassword(question: string): Promise<string> {
  process.stdout.write(chalk.dim('? ') + question);

  return new Promise((resolve) => {
    let value = '';

    const handler = (key: Buffer): void => {
      const char = key.toString('utf-8');

      if (char === '\r' || char === '\n') {
        cleanup();
        process.stdout.write('\n');
        resolve(value);
      } else if (char === '\u0003') {
        // Ctrl+C
        cleanup();
        process.stdout.write('\n');
        process.exit(0);
      } else if (char === '\u007F' || char === '\u0008') {
        // Backspace / Delete
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        value += char;
        process.stdout.write('*');
      }
    };

    const cleanup = (): void => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', handler);
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', handler);
  });
}
