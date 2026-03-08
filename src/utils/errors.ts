/**
 * Thrown when ~/.gcm/config.json does not exist.
 * The CLI should respond by running the setup wizard.
 */
export class ConfigNotFoundError extends Error {
  constructor() {
    super('No configuration found. Run gcm --setup to configure your provider.');
    this.name = 'ConfigNotFoundError';
  }
}

/**
 * Thrown when `git diff --staged` returns no output.
 */
export class NoStagedChangesError extends Error {
  constructor() {
    super('No staged changes found. Stage files with git add first.');
    this.name = 'NoStagedChangesError';
  }
}

/**
 * Thrown when the current directory is not inside a git repository.
 */
export class NotGitRepoError extends Error {
  constructor() {
    super('Not a git repository. Run this command inside a git project.');
    this.name = 'NotGitRepoError';
  }
}

/**
 * Thrown when the LLM provider returns an error response.
 * @param providerName - Human-readable provider name (e.g. "OpenAI", "Anthropic")
 * @param statusCode   - HTTP status from the provider API
 * @param message      - Additional context from the response body
 */
export class ProviderError extends Error {
  readonly statusCode: number;
  readonly providerName: string;

  constructor(providerName: string, statusCode: number, message: string) {
    super(ProviderError.buildMessage(providerName, statusCode, message));
    this.name = 'ProviderError';
    this.providerName = providerName;
    this.statusCode = statusCode;
  }

  private static buildMessage(
    providerName: string,
    statusCode: number,
    detail: string,
  ): string {
    if (statusCode === 401) {
      return `Authentication failed. Run gcm --setup to update your API key.`;
    }
    if (statusCode === 429) {
      return `Rate limited by ${providerName}. Wait a moment and try again.`;
    }
    return `${providerName} returned an error (${statusCode}): ${detail}`;
  }
}

/**
 * Thrown when a network-level failure prevents reaching the provider.
 */
export class NetworkError extends Error {
  readonly providerName: string;

  constructor(providerName: string, cause?: Error) {
    super(`Could not reach ${providerName}. Check your internet connection.`);
    this.name = 'NetworkError';
    this.providerName = providerName;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
