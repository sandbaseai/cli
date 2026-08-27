# Install SandBase CLI

SandBase CLI is an open-source onboarding tool and local stdio MCP bridge. It
connects supported AI clients to the SandBase catalog of 2,000+ models and APIs without
requiring separate provider API keys.

## Requirements

- Node.js 20 or newer
- A graphical browser for the one-time authorization flow
- A supported client from the catalog below

## Verify before installing

This read-only command prints the 25 supported client targets. It does not open
a browser or change local configuration:

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz catalog --json
```

## Connect a client

Use the immutable v0.1.17 GitHub Release while npm `latest` is being updated:

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect --client <client-id>
```

For an offline/integrity check, the archive's SHA-256 is
`1ad535b2899ca460b57b3c268aef278fee28fd28e649a89b92951514fd71fffa`.

Common client IDs include `codex`, `claude-code`, `cursor`, `gemini-cli`,
`windsurf`, and `opencode`. To configure every supported client detected on the
machine, omit `--client <client-id>`.

The command opens the SandBase authorization page. The user must complete that
step personally. Never ask the user to paste a credential into chat. After
authorization, the CLI stores the credential locally with restricted file
permissions and adds only the SandBase-owned MCP entry.

## Verify

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz doctor --client <client-id>
```

Restart the target client after a successful connection so it reloads its MCP
configuration. The client should then expose six SandBase tools:
`sandbase_discover`, `sandbase_inspect`, `sandbase_run`, `sandbase_run_get`,
`sandbase_runs`, and `sandbase_account`.

## Remove the managed entry

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz unregister --client <client-id>
```

This removes only the SandBase-owned configuration. It leaves unrelated and
user-managed MCP entries unchanged.

Source: https://github.com/sandbaseai/cli
