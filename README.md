# gcm-ai

AI-powered Git commit message generator following [Conventional Commits](https://www.conventionalcommits.org/).

Reads your staged changes, sends the diff to an LLM, and generates a clean commit message. You accept, edit, or reject before anything is committed.

## Install

```bash
npm install -g gcm-ai
```

Requires Node.js 18+.

## Usage

```bash
git add .
gcm
```

First run triggers a one-time setup wizard. After that, just run `gcm` in any git repository.

```
$ gcm

  Analyzing staged changes...

  feat(auth): add JWT refresh token rotation

  - Implement automatic token refresh before expiration
  - Add retry logic for failed refresh attempts

  ? [Y] Accept  [e] Edit  [r] Regenerate  [n] Cancel
```

## Setup

Runs automatically on first use, or manually with:

```bash
gcm --setup
```

The wizard asks for:
- LLM provider (OpenAI or Anthropic)
- API key (stored locally, never sent anywhere except your chosen provider)
- Preferred model
- Commit message language

Configuration is saved to `~/.gcm/config.json` with restricted file permissions.

## Commands

| Command            | Description                                |
|--------------------|--------------------------------------------|
| `gcm`              | Generate commit message from staged changes|
| `gcm --setup`      | Run or re-run the setup wizard             |
| `gcm --dry-run`    | Show message without committing            |
| `gcm --provider X` | Override provider for this run             |
| `gcm --model X`    | Override model for this run                |
| `gcm --help`       | Show usage information                     |
| `gcm --version`    | Show version                               |

## Supported Providers

| Provider  | Default Model                 | Get API Key                  |
|-----------|-------------------------------|------------------------------|
| OpenAI    | gpt-4o-mini                   | https://platform.openai.com  |
| Anthropic | claude-sonnet-4-20250514      | https://console.anthropic.com|

## How It Works

1. Runs `git diff --staged` in the current repository
2. Parses changed files to infer a commit scope
3. Sends the diff to your configured LLM with an optimized prompt
4. Presents the generated message for your approval
5. Commits only when you explicitly accept

## Privacy

- Your API key is stored locally in `~/.gcm/config.json` with file permissions `0600`
- No telemetry, no analytics, no tracking
- The only network request is to your chosen LLM provider
- Diff content is sent to the LLM and not stored or cached anywhere

## Development

```bash
git clone https://github.com/YOUR_USERNAME/gcm-ai.git
cd gcm-ai
npm install
npm run build
npm test
npm link    # Test the CLI locally
```

## License

MIT