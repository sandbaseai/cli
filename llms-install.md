# Install SandBase CLI

SandBase CLI is an open-source onboarding tool and local stdio MCP bridge. It
connects supported AI clients to the SandBase catalog of 2,000+ models and APIs without
requiring separate provider API keys.

## Requirements

- Node.js 20 or newer
- A graphical browser for the one-time authorization flow
- A supported AI client for MCP setup, or a SandBase API key for standalone terminal use

## Verify before installing

This read-only command prints the 25 supported client targets. It does not open
a browser or change local configuration:

```sh
npx -y @sandbaseai/cli@latest catalog --json
```

## Install with Homebrew

The official tap supports macOS and Linux:

```sh
brew install sandbaseai/tap/sandbaseai-cli
sandbase catalog --json
sandbase connect --client <client-id>
```

The formula installs the latest release archive and verifies its published
SHA-256 before installation.

## Connect a client

Alternatively, run the published npm CLI without a global installation:

```sh
npx -y @sandbaseai/cli@latest connect --client <client-id>
```

For an offline integrity check, compare the tarball against the SHA-256 published
on its [release page](https://github.com/sandbaseai/cli/releases/latest).

Common client IDs include `codex`, `claude-code`, `cursor`, `gemini-cli`,
`windsurf`, and `opencode`. To configure every supported client detected on the
machine, omit `--client <client-id>`.

The command opens the SandBase authorization page. The user must complete that
step personally. Never ask the user to paste a credential into chat. After
authorization, the CLI stores the credential locally with restricted file
permissions and adds only the SandBase-owned MCP entry.

## Verify

```sh
npx -y @sandbaseai/cli@latest doctor --client <client-id>
```

Restart the target client after a successful connection so it reloads its MCP
configuration. The client should then expose these SandBase tools:
`sandbase_discover`, `sandbase_inspect`, `sandbase_run`, `sandbase_run_get`,
`sandbase_runs`, `sandbase_account`, and `sandbase_run_cancel` (Agent Service runs only).

## Remove the managed entry

```sh
npx -y @sandbaseai/cli@latest unregister --client <client-id>
```

This removes only the SandBase-owned configuration. It leaves unrelated and
user-managed MCP entries unchanged.

Source: https://github.com/sandbaseai/cli

## Use the terminal directly

`npx` does not permanently install the executable. Continue using the full prefix:

```sh
npx -y @sandbaseai/cli@latest discover -q "Twitter posts" -t api
npx -y @sandbaseai/cli@latest inspect sandbase_twitter_web_search_timeline
```

These commands inspect the catalog without starting a run. Review current inputs and prices before executing work. To get a persistent `sandbase` command, install with `npm install -g @sandbaseai/cli@latest` or Homebrew. Do not mix installation methods. After an upgrade, run `sandbase setup`, then `sandbase doctor --client <client-id>` and restart your client.

For website, API and agent instructions, use [Quick Start](https://www.sandbase.ai/docs/getting-started/quickstart). SDKs and HTTP examples live in [sandbaseai/sandbase](https://github.com/sandbaseai/sandbase).
