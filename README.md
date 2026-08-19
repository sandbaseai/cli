<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>Give your AI agent superpowers. One command. 2,000+ AI models.</strong>
  </p>
  <p align="center">
    English | <a href="./README.zh-CN.md">中文</a> | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | <a href="./README.es.md">Español</a> | <a href="./README.fr.md">Français</a> | <a href="./README.de.md">Deutsch</a> | <a href="./README.pt-BR.md">Português</a>
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/@sandbaseai/cli"><img alt="npm version" src="https://img.shields.io/npm/v/%40sandbaseai%2Fcli"></a>
    <a href="https://www.npmjs.com/package/@sandbaseai/cli"><img alt="npm downloads" src="https://img.shields.io/npm/dm/%40sandbaseai%2Fcli"></a>
    <a href="https://github.com/sandbaseai/cli/releases/latest"><img alt="GitHub release" src="https://img.shields.io/github/v/release/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sandbaseai/cli/actions/workflows/ci.yml/badge.svg"></a>
    <a href="https://github.com/sandbaseai/cli/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/sandbaseai/cli?style=social"></a>
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI connects AI clients to 2,000+ AI models" width="100%">
</p>

---

Your AI coding assistant is smart, but it's trapped in a box. It can't search the web, check social media, generate images, or access real-time data — unless you wire up each API yourself.

**SandBase changes that.** One command connects your agent to 2,000+ AI models through the [Model Context Protocol](https://modelcontextprotocol.io). No API keys to manage. No configuration headaches.

```sh
npx -y @sandbaseai/cli connect
```

Approve the browser authorization once; each supported client can then discover,
inspect, and run available SandBase models and APIs through the local MCP bridge.

Want to inspect compatibility before signing in or changing configuration? The current
[`v0.1.16` GitHub release](https://github.com/sandbaseai/cli/releases/tag/v0.1.16)
includes a verified 25-client catalog:

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.16/sandbaseai-cli-0.1.16.tgz catalog --json
```

The npm `latest` tag currently serves v0.1.14 while tokenless trusted publishing is
being enabled. The GitHub release tarball is built from the immutable `v0.1.16` tag;
its SHA-256 is published with the release.

## SandBase Open-Source Stack

- **[SandBase Harness](https://github.com/sandbaseai/sandbase-harness)** — self-hosted agent runtime with persistent sessions, sandbox isolation, approvals, audit, and replay.
- **[SandBase Agent Skills](https://github.com/sandbaseai/sandbase-skills)** — 88 installable Skills for research, social intelligence, marketing, and business workflows.

---

## See It In Action

After connecting, just ask your agent naturally. It handles the rest.

### "Search the web for React 19 new features"

```
Agent → SandBase Web Search → 10 results in 0.8s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. "React 19 is Here: What's New" — react.dev
2. "React 19 Compiler Deep Dive" — Dan Abramov's blog
3. "Migrating to React 19" — Vercel Engineering
...
```

### "Get trending posts about AI on Twitter"

```
Agent → SandBase Twitter API → Top 10 posts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. @karpathy: "LLMs are the new CPUs..." (45K ❤️)
2. @emollick: "Agent benchmarks just crossed..." (12K ❤️)
3. @swyx: "The MCP ecosystem is growing fast..." (8K ❤️)
...
```

### "Generate a minimalist logo for my startup 'NightOwl'"

```
Agent → SandBase Flux Image Gen → 1024x1024 PNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Generated: nightowl-logo.png
  Style: Minimalist, dark theme
  Cost: $0.003
  Time: 2.1s
```

### "Scrape the pricing table from linear.app"

```
Agent → SandBase Firecrawl Scraper → Structured data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Extracted 3 plans:
  Free: $0/mo — Up to 250 issues
  Standard: $8/user/mo — Unlimited issues + cycles
  Plus: $14/user/mo — Advanced features + analytics
```

### "Use GPT-4o to review this pull request for issues"

```
Agent → SandBase GPT-4o → Analysis complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Found 2 issues:
  ⚠️  Race condition in useEffect (line 42)
  ⚠️  Missing error boundary around async component
  ✓  Type safety looks good
  ✓  Test coverage adequate
```

### "Create a 5-second product demo video"

```
Agent → SandBase Kling Video Gen → Async processing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ Generating... (45s)
✓ Output: product-demo.mp4 (5s, 720p)
  Cost: $0.10
```

---

## What's Inside

| Category | Tools | What You Can Do |
|----------|-------|-----------------|
| **Web Search** | Google, Exa, Tavily, Scholar | Research anything in real-time |
| **Social Media** | Twitter/X, YouTube, Reddit, Instagram, TikTok, Xiaohongshu, Weibo, Bilibili | Monitor trends, pull posts, analyze content |
| **Scraping** | Firecrawl, Exa Content | Extract data from any public webpage |
| **AI Models** | GPT-4o, Claude, Gemini, DeepSeek, Qwen, Llama | Run any model without managing keys |
| **Image Gen** | Flux, DALL-E, Ideogram, Recraft | Create logos, illustrations, mockups |
| **Video Gen** | Kling, MiniMax, Runway, Luma | Generate short clips and animations |
| **Audio** | ElevenLabs, Whisper | Text-to-speech, transcription |
| **E-commerce** | Taobao, Amazon | Product research, price comparison |
| **Finance** | Stock data, company info | Market research and analysis |

---

## Supported Clients (17+)

Works with every major AI coding tool:

| Auto-configured | Manual setup |
|-----------------|--------------|
| Cursor, Cursor CLI | ChatGPT |
| Claude Code | Claude Desktop |
| Codex | |
| Kiro IDE, Kiro CLI | |
| Windsurf | |
| Gemini CLI | |
| Amp | |
| Warp | |
| OpenCode, Qwen Code, Kimi CLI | |
| Hermes, OpenClaw | |

Preview the complete compatibility catalog without signing in or changing any files:

```sh
npx -y @sandbaseai/cli catalog --json
```

```sh
# Connect all detected clients at once
npx -y @sandbaseai/cli connect

# Or target one specific client
npx -y @sandbaseai/cli connect --client cursor
```

---

## How It Works

```
┌─────────────────┐         ┌───────────────┐         ┌────────────────────┐
│   Your Agent    │  MCP    │  Local Bridge │  HTTPS  │    SandBase API     │
│  (Cursor, etc.) │────────▶│  (on-demand)  │────────▶│  2,000+ AI models  │
│                 │◀────────│               │◀────────│                    │
└─────────────────┘         └───────────────┘         └────────────────────┘
```

1. Run `connect` → CLI opens browser auth → you approve
2. API key saved locally (file permissions `0600`)
3. MCP bridge configured for your client
4. Agent calls tools on-demand. No daemon. No background process.

---

## Commands

### CLI Commands

```sh
sandbase connect [--client <name>]    # Authorize + configure
sandbase doctor [--client <name>]     # Health check
sandbase unregister [--client <name>] # Remove configuration
sandbase catalog --json               # List all supported clients
```

### MCP Tools (available to your agent after connecting)

| Tool | Purpose |
|------|---------|
| `sandbase_discover` | Search all 2,000+ available AI models |
| `sandbase_inspect` | Get input schema, pricing, and ready-to-use template |
| `sandbase_run` | Execute a model or API endpoint |
| `sandbase_run_get` | Poll status/result of an async run (video gen, etc.) |
| `sandbase_runs` | List your recent API calls with cost breakdown |
| `sandbase_account` | Check account balance (free, no cost) |

**Workflow your agent follows automatically:**

```
discover → inspect → run
```

```
1. sandbase_discover(q: "twitter search")        → finds matching tools
2. sandbase_inspect(name: "twitter_timeline")    → gets schema + pricing
3. sandbase_run(name: "twitter_timeline", ...)   → executes and returns data
```

---

## Security

- **Zero secrets in URLs or CLI args** — OAuth device flow with PKCE
- **Restricted file permissions** — Credentials stored with `0600`
- **Ownership-aware updates** — Existing JSONC comments and user-managed MCP entries are preserved
- **Exact rollback** — On failure or `unregister`, only configuration owned by SandBase is removed
- **Revoke anytime** — One click in the [SandBase Dashboard](https://sandbase.ai/console/keys)

---

## Get Started

```sh
npx -y @sandbaseai/cli connect
```

Then ask your agent to do something it couldn't before.

**[Create a free account →](https://sandbase.ai)**

If SandBase saves you setup time, [star the repository](https://github.com/sandbaseai/cli) — it helps more agent users discover the project.

---

## Links

- [SandBase Platform](https://sandbase.ai)
- [Documentation](https://docs.sandbase.ai)
- [CLI setup guide](https://www.sandbase.ai/docs/setup/cli)
- [npm Package](https://www.npmjs.com/package/@sandbaseai/cli)
- [Dashboard](https://sandbase.ai/console)

## Community

- [Ask a question or share what you built](https://github.com/sandbaseai/cli/discussions)
- [Report a reproducible bug](https://github.com/sandbaseai/cli/issues/new?template=bug-report.yml)
- [Propose an integration or improvement](https://github.com/sandbaseai/cli/issues/new?template=feature-request.yml)
- [Contribute to SandBase CLI](./CONTRIBUTING.md)

Community-curated listings:

- [Awesome Gemini CLI](https://github.com/Piebald-AI/awesome-gemini-cli)
- [Awesome AI Tools](https://github.com/QAInsights/awesome-ai-tools)
- [Awesome MCP Server](https://github.com/AIAnytime/Awesome-MCP-Server)

## License

Apache-2.0
