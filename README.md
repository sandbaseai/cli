# @sandbaseai/cli

One command to connect your AI coding agent to [SandBase](https://sandbase.ai) — the universal MCP gateway that gives any LLM-powered tool access to 2,000+ APIs, models, and data sources through a single interface.

## Why SandBase?

SandBase acts as a unified Model Context Protocol (MCP) bridge between your AI coding assistant and the tools it needs:

- **2,000+ tools** — web search, social media, e-commerce, crypto, finance, weather, travel, and more
- **200+ AI models** — GPT-4o, Claude, Gemini, Llama, Qwen, image/video/audio generation
- **One credential** — no per-service API key management; authorize once through the CLI
- **Privacy-first** — secrets never appear in command-line arguments or browser URLs

## Supported Clients

| Client | Mode | Command |
|--------|------|---------|
| Codex | Auto | `npx -y @sandbaseai/cli connect --client codex` |
| Claude Code | Auto | `npx -y @sandbaseai/cli connect --client claude-code` |
| Cursor | Auto | `npx -y @sandbaseai/cli connect --client cursor` |
| Cursor CLI | Auto | `npx -y @sandbaseai/cli connect --client cursor-cli` |
| Kiro IDE | Auto | `npx -y @sandbaseai/cli connect --client kiro` |
| Kiro CLI | Auto | `npx -y @sandbaseai/cli connect --client kiro-cli` |
| Windsurf | Auto | `npx -y @sandbaseai/cli connect --client windsurf` |
| Gemini CLI | Auto | `npx -y @sandbaseai/cli connect --client gemini-cli` |
| OpenCode | Auto | `npx -y @sandbaseai/cli connect --client opencode` |
| Qwen Code | Auto | `npx -y @sandbaseai/cli connect --client qwen-code` |
| Kimi CLI | Auto | `npx -y @sandbaseai/cli connect --client kimi-cli` |
| Warp | Auto | `npx -y @sandbaseai/cli connect --client warp` |
| Amp | Auto | `npx -y @sandbaseai/cli connect --client amp` |
| Hermes | Auto | `npx -y @sandbaseai/cli connect --client hermes` |
| OpenClaw | Auto | `npx -y @sandbaseai/cli connect --client openclaw` |
| ChatGPT | Manual | `npx -y @sandbaseai/cli connect --client chatgpt` |
| Claude Desktop | Manual | `npx -y @sandbaseai/cli connect --client claude-desktop` |

Use `--client auto` (or omit `--client`) to configure all detected clients at once.

## Quick Start

### Prerequisites

- Node.js 20 or newer
- A [SandBase](https://sandbase.ai) account (free tier available)

### 1. Connect your client

```sh
npx -y @sandbaseai/cli connect
```

This opens SandBase authorization in your browser. After approval, the CLI automatically configures MCP for all detected clients.

To target a specific client:

```sh
npx -y @sandbaseai/cli connect --client cursor
```

### 2. Verify the connection

```sh
npx -y @sandbaseai/cli doctor --client cursor
```

### 3. Start using SandBase tools

In your connected client, try:

> "Use SandBase to search the web for the latest Next.js release notes."

> "Use SandBase to fetch Elon Musk's latest 10 posts on Twitter."

> "Use SandBase to generate an image of a mountain landscape at sunset."

## Commands

| Command | Description |
|---------|-------------|
| `sandbase connect [--client <name>]` | Authorize and configure MCP for a client |
| `sandbase doctor [--client <name>]` | Check connection health and configuration status |
| `sandbase unregister [--client <name>]` | Remove local SandBase configuration for a client |
| `sandbase catalog --json` | Output the supported client catalog as JSON |

## How It Works

1. **Authorization** — The CLI initiates a device/PKCE flow; you approve in the browser.
2. **Credential storage** — An API key is stored locally with restricted file permissions.
3. **MCP configuration** — The CLI writes the appropriate MCP server entry for your client.
4. **Bridge** — A lightweight local Node.js process (MCP bridge) translates between your client and the SandBase API.

No background daemon is required. The MCP bridge runs on-demand when your client invokes a tool.

## Security

- OAuth device flow with PKCE — no secrets in URLs or CLI arguments
- Credentials stored with `0600` file permissions
- Automatic rollback on failure (credentials, config, and MCP state)
- Cleanup token ensures dangling authorizations are revoked on error
- `SANDBASE_API_URL` override for development/testing only

## Manage Access

Revoke your CLI credential at any time from the [SandBase Dashboard](https://sandbase.ai/console/keys) under API Keys.

## Development

```sh
# Install dependencies
npm ci

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Links

- [SandBase Platform](https://sandbase.ai)
- [SandBase Dashboard](https://sandbase.ai/console)
- [SandBase Documentation](https://docs.sandbase.ai)
- [npm Package](https://www.npmjs.com/package/@sandbaseai/cli)

## License

Apache-2.0
