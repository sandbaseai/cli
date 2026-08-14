# @sandbaseai/cli

English | [中文](./README.zh-CN.md) | [日本語](./README.ja.md)

One command to connect your AI coding agent to [SandBase](https://sandbase.ai) — the universal MCP gateway that gives any LLM-powered tool access to 2,000+ APIs, models, and data sources through a single interface.

## Why SandBase?

SandBase acts as a unified Model Context Protocol (MCP) bridge between your AI coding assistant and the tools it needs:

- **2,000+ tools** — web search, social media, e-commerce, crypto, finance, weather, travel, and more
- **200+ AI models** — GPT-4o, Claude, Gemini, Llama, Qwen, image/video/audio generation
- **One credential** — no per-service API key management; authorize once through the CLI
- **Privacy-first** — secrets never appear in command-line arguments or browser URLs

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

In your connected client, just ask naturally:

> "Search the web for the latest Next.js 15 features."

> "Get Elon Musk's latest 10 posts on Twitter."

> "Generate an image of a cyberpunk cityscape at night."

> "Scrape the pricing page from stripe.com and summarize it."

---

## What Can You Do After Connecting?

Once connected, your AI agent gains access to all SandBase tools transparently through MCP. Here are real examples of what you can ask:

### Web Search & Scraping

```
You: "Search for recent news about GPT-5 release date"

Agent: [Uses SandBase web search]
→ Found 10 results from the past week:
  1. "OpenAI Expected to Launch GPT-5 in Q3 2025" - TechCrunch
  2. "GPT-5 Benchmarks Leaked..." - The Verge
  ...
```

```
You: "Scrape https://example.com/pricing and extract the plan details"

Agent: [Uses SandBase Firecrawl scraper]
→ Extracted 3 pricing plans:
  - Starter: $9/mo - 1,000 API calls
  - Pro: $49/mo - 50,000 API calls
  - Enterprise: Custom pricing
```

### Social Media Data

```
You: "Get the top trending posts on Twitter about AI agents"

Agent: [Uses SandBase Twitter API]
→ Top 10 trending posts (past 24h):
  1. @kaborshik: "AI agents are replacing entire SaaS workflows..." (12.4K likes)
  2. @emollick: "The speed of agent improvement is remarkable..." (8.2K likes)
  ...
```

```
You: "Find popular posts about machine learning on Xiaohongshu (小红书)"

Agent: [Uses SandBase Xiaohongshu API]
→ Found 10 posts:
  1. "2025年最值得学的AI工具清单" - 5.2K likes
  2. "一个月学会机器学习的路线图" - 3.8K likes
  ...
```

### Image & Video Generation

```
You: "Generate a logo for a coffee shop called 'ByteBrew' - minimalist style"

Agent: [Uses SandBase Flux image generation]
→ Generated image: [bytebrew-logo.png]
  Style: Minimalist
  Resolution: 1024x1024
  Cost: $0.003
```

```
You: "Create a 5-second video of ocean waves at sunset"

Agent: [Uses SandBase Kling video generation - async]
→ Video generation started (run_id: pred_abc123)
→ Polling... completed in 45 seconds
→ Output: [ocean-sunset.mp4] (5s, 720p)
  Cost: $0.10
```

### LLM Inference (200+ models)

```
You: "Use DeepSeek to analyze this code for security vulnerabilities"

Agent: [Uses SandBase DeepSeek model]
→ Found 3 potential issues:
  1. SQL injection in line 42 - user input not sanitized
  2. Hardcoded secret in line 78
  3. Missing rate limiting on /api/auth endpoint
```

### Crypto & Finance

```
You: "What's the current price of Bitcoin and Ethereum?"

Agent: [Uses SandBase crypto market API]
→ BTC: $67,234.50 (+2.3% 24h)
→ ETH: $3,456.78 (+1.8% 24h)
  Updated: 2 minutes ago
```

### E-commerce Data

```
You: "Search Taobao for mechanical keyboards under 500 yuan"

Agent: [Uses SandBase Taobao API]
→ Top 5 results:
  1. Keychron K8 Pro - ¥459 (4.9★, 12K sold)
  2. RK84 RGB - ¥289 (4.8★, 8K sold)
  ...
```

---

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

## Commands

| Command | Description |
|---------|-------------|
| `sandbase connect [--client <name>]` | Authorize and configure MCP for a client |
| `sandbase doctor [--client <name>]` | Check connection health and configuration status |
| `sandbase unregister [--client <name>]` | Remove local SandBase configuration for a client |
| `sandbase catalog --json` | Output the supported client catalog as JSON |

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────┐
│  Your Agent │────▶│  MCP Bridge  │────▶│   SandBase API    │
│  (Cursor,   │     │  (local,     │     │  (2000+ tools,    │
│   Claude,   │◀────│   on-demand) │◀────│   200+ models)    │
│   Codex...) │     └──────────────┘     └───────────────────┘
└─────────────┘
```

1. **Authorization** — The CLI initiates a device/PKCE flow; you approve in the browser.
2. **Credential storage** — An API key is stored locally with restricted file permissions (`0600`).
3. **MCP configuration** — The CLI writes the appropriate MCP server entry for your client.
4. **Bridge** — A lightweight local Node.js process translates between your client and the SandBase API.

No background daemon is required. The MCP bridge runs on-demand when your client invokes a tool.

## Tool Categories

| Category | Examples | Use Cases |
|----------|----------|-----------|
| **Search** | Google, Exa, Tavily, Scholar | Research, fact-checking, documentation |
| **Social Media** | Twitter/X, Instagram, TikTok, YouTube, Reddit, Xiaohongshu, Weibo | Trends, monitoring, content research |
| **Web Scraping** | Firecrawl, Exa content, URL fetch | Data extraction, competitive analysis |
| **AI Models** | GPT-4o, Claude, Gemini, DeepSeek, Qwen, Llama | Inference, analysis, translation |
| **Image Gen** | Flux, DALL-E, Ideogram, Recraft | Logos, illustrations, mockups |
| **Video Gen** | Kling, MiniMax, Runway, Luma | Short clips, animations |
| **Audio** | ElevenLabs TTS, Whisper STT | Voiceover, transcription |
| **Crypto** | Market data, on-chain analytics | Prices, wallet analysis |
| **E-commerce** | Taobao, Amazon product data | Product research, price monitoring |
| **Finance** | Stock quotes, company data | Market research, analysis |

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
