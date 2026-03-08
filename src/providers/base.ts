/**
 * Common interface every LLM provider must implement.
 */
export interface LLMProvider {
  /** Human-readable provider name, e.g. "OpenAI" or "Anthropic". */
  readonly name: string;

  /**
   * Sends the staged diff to the LLM and returns a Conventional Commits
   * formatted commit message.
   *
   * @param diff     - Output of `git diff --staged`
   * @param language - One of "en" | "es" | "auto"
   */
  generateCommitMessage(diff: string, language: string): Promise<string>;

  /**
   * Verifies that the stored API key can reach the provider.
   * Returns true on success, throws ProviderError / NetworkError otherwise.
   */
  testConnection(): Promise<boolean>;
}
