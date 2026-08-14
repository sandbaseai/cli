# @sandbaseai/cli

[English](./README.md) | 中文 | [日本語](./README.ja.md)

一行命令，将你的 AI 编程助手接入 [SandBase](https://sandbase.ai) — 统一的 MCP 网关，让任何 LLM 工具通过单一接口访问 2,000+ API、模型和数据源。

## 为什么选择 SandBase？

SandBase 是 AI 编程助手与外部工具之间的统一 MCP (Model Context Protocol) 桥接层：

- **2,000+ 工具** — 网页搜索、社交媒体、电商、加密货币、金融、天气、旅行等
- **200+ AI 模型** — GPT-4o、Claude、Gemini、Llama、Qwen、图像/视频/音频生成
- **一次授权** — 无需管理多个 API Key，通过 CLI 一次授权即可
- **隐私优先** — 密钥永远不会出现在命令行参数或浏览器 URL 中

## 快速开始

### 前置条件

- Node.js 20 或更高版本
- 一个 [SandBase](https://sandbase.ai) 账号（有免费额度）

### 1. 连接你的客户端

```sh
npx -y @sandbaseai/cli connect
```

这会在浏览器中打开 SandBase 授权页面。授权通过后，CLI 会自动为所有检测到的客户端配置 MCP。

指定单个客户端：

```sh
npx -y @sandbaseai/cli connect --client cursor
```

### 2. 验证连接

```sh
npx -y @sandbaseai/cli doctor --client cursor
```

### 3. 开始使用

在已连接的客户端中，直接用自然语言请求即可：

> "帮我搜索一下 Next.js 15 的最新特性。"

> "获取 Elon Musk 最近 10 条推特。"

> "生成一张赛博朋克风格的城市夜景图。"

> "抓取 stripe.com 的定价页面并总结。"

---

## 连接后能做什么？

一旦连接，你的 AI 助手会通过 MCP 透明地调用所有 SandBase 工具。以下是真实使用场景：

### 网页搜索与抓取

```
你: "搜索一下关于 GPT-5 发布时间的最新消息"

Agent: [调用 SandBase 网页搜索]
→ 找到最近一周的 10 条结果：
  1. "OpenAI 预计 2025 Q3 发布 GPT-5" - TechCrunch
  2. "GPT-5 跑分泄露..." - The Verge
  ...
```

```
你: "抓取 https://example.com/pricing 的内容并提取套餐信息"

Agent: [调用 SandBase Firecrawl 抓取工具]
→ 提取到 3 个定价方案：
  - 入门版: $9/月 - 1,000 次 API 调用
  - 专业版: $49/月 - 50,000 次 API 调用
  - 企业版: 定制价格
```

### 社交媒体数据

```
你: "搜索推特上关于 AI Agent 的热门讨论"

Agent: [调用 SandBase Twitter API]
→ 24 小时内热门推文 Top 10：
  1. @kaborshik: "AI agents are replacing entire SaaS workflows..." (12.4K 点赞)
  2. @emollick: "The speed of agent improvement is remarkable..." (8.2K 点赞)
  ...
```

```
你: "搜索小红书上关于机器学习的热门帖子"

Agent: [调用 SandBase 小红书 API]
→ 找到 10 篇帖子：
  1. "2025年最值得学的AI工具清单" - 5.2K 点赞
  2. "一个月学会机器学习的路线图" - 3.8K 点赞
  ...
```

### 图像与视频生成

```
你: "生成一个咖啡店 logo，店名叫 'ByteBrew'，极简风格"

Agent: [调用 SandBase Flux 图像生成]
→ 生成图片: [bytebrew-logo.png]
  风格: 极简
  分辨率: 1024x1024
  费用: $0.003
```

```
你: "生成一段 5 秒的日落海浪视频"

Agent: [调用 SandBase Kling 视频生成 - 异步]
→ 视频生成中 (run_id: pred_abc123)
→ 轮询中... 45 秒后完成
→ 输出: [ocean-sunset.mp4] (5秒, 720p)
  费用: $0.10
```

### LLM 推理（200+ 模型）

```
你: "用 DeepSeek 分析这段代码的安全漏洞"

Agent: [调用 SandBase DeepSeek 模型]
→ 发现 3 个潜在问题：
  1. 第 42 行 SQL 注入 - 用户输入未清洗
  2. 第 78 行硬编码密钥
  3. /api/auth 端点缺少速率限制
```

### 加密货币与金融

```
你: "查一下比特币和以太坊的当前价格"

Agent: [调用 SandBase 加密货币市场 API]
→ BTC: $67,234.50 (+2.3% 24h)
→ ETH: $3,456.78 (+1.8% 24h)
  更新时间: 2 分钟前
```

### 电商数据

```
你: "搜索淘宝上 500 元以下的机械键盘"

Agent: [调用 SandBase 淘宝 API]
→ Top 5 结果：
  1. Keychron K8 Pro - ¥459 (4.9★, 1.2万已售)
  2. RK84 RGB - ¥289 (4.8★, 8千已售)
  ...
```

---

## 支持的客户端

| 客户端 | 模式 | 命令 |
|--------|------|------|
| Codex | 自动 | `npx -y @sandbaseai/cli connect --client codex` |
| Claude Code | 自动 | `npx -y @sandbaseai/cli connect --client claude-code` |
| Cursor | 自动 | `npx -y @sandbaseai/cli connect --client cursor` |
| Cursor CLI | 自动 | `npx -y @sandbaseai/cli connect --client cursor-cli` |
| Kiro IDE | 自动 | `npx -y @sandbaseai/cli connect --client kiro` |
| Kiro CLI | 自动 | `npx -y @sandbaseai/cli connect --client kiro-cli` |
| Windsurf | 自动 | `npx -y @sandbaseai/cli connect --client windsurf` |
| Gemini CLI | 自动 | `npx -y @sandbaseai/cli connect --client gemini-cli` |
| OpenCode | 自动 | `npx -y @sandbaseai/cli connect --client opencode` |
| Qwen Code | 自动 | `npx -y @sandbaseai/cli connect --client qwen-code` |
| Kimi CLI | 自动 | `npx -y @sandbaseai/cli connect --client kimi-cli` |
| Warp | 自动 | `npx -y @sandbaseai/cli connect --client warp` |
| Amp | 自动 | `npx -y @sandbaseai/cli connect --client amp` |
| Hermes | 自动 | `npx -y @sandbaseai/cli connect --client hermes` |
| OpenClaw | 自动 | `npx -y @sandbaseai/cli connect --client openclaw` |
| ChatGPT | 手动 | `npx -y @sandbaseai/cli connect --client chatgpt` |
| Claude Desktop | 手动 | `npx -y @sandbaseai/cli connect --client claude-desktop` |

使用 `--client auto`（或省略 `--client`）可一次配置所有已检测到的客户端。

## 命令

| 命令 | 说明 |
|------|------|
| `sandbase connect [--client <name>]` | 授权并为客户端配置 MCP |
| `sandbase doctor [--client <name>]` | 检查连接状态和配置健康度 |
| `sandbase unregister [--client <name>]` | 移除本地 SandBase 配置 |
| `sandbase catalog --json` | 输出支持的客户端目录（JSON 格式） |

## 工作原理

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────┐
│  你的 Agent │────▶│  MCP Bridge  │────▶│   SandBase API    │
│  (Cursor,   │     │  (本地,      │     │  (2000+ 工具,     │
│   Claude,   │◀────│   按需启动)  │◀────│   200+ 模型)      │
│   Codex...) │     └──────────────┘     └───────────────────┘
└─────────────┘
```

1. **授权** — CLI 发起 device/PKCE 流程，你在浏览器中完成审批。
2. **凭据存储** — API Key 以 `0600` 权限存储在本地。
3. **MCP 配置** — CLI 为你的客户端写入相应的 MCP 服务器配置。
4. **桥接** — 轻量的本地 Node.js 进程在客户端和 SandBase API 之间转发请求。

无需后台守护进程。MCP Bridge 仅在客户端调用工具时按需启动。

## 工具分类

| 分类 | 包含工具 | 使用场景 |
|------|----------|----------|
| **搜索** | Google、Exa、Tavily、Scholar | 调研、事实核查、文档查找 |
| **社交媒体** | Twitter/X、Instagram、TikTok、YouTube、Reddit、小红书、微博 | 趋势分析、舆情监控、内容调研 |
| **网页抓取** | Firecrawl、Exa content、URL fetch | 数据提取、竞品分析 |
| **AI 模型** | GPT-4o、Claude、Gemini、DeepSeek、Qwen、Llama | 推理、分析、翻译 |
| **图像生成** | Flux、DALL-E、Ideogram、Recraft | Logo、插画、原型图 |
| **视频生成** | Kling、MiniMax、Runway、Luma | 短视频、动画 |
| **音频** | ElevenLabs TTS、Whisper STT | 配音、转写 |
| **加密货币** | 行情数据、链上分析 | 价格查询、钱包分析 |
| **电商** | 淘宝、Amazon 商品数据 | 选品调研、价格监控 |
| **金融** | 股票行情、公司数据 | 市场研究、分析 |

## 安全性

- OAuth device flow + PKCE — 密钥不会出现在 URL 或命令行参数中
- 凭据以 `0600` 权限存储
- 失败时自动回滚（凭据、配置和 MCP 状态）
- Cleanup token 确保错误时吊销悬挂的授权
- `SANDBASE_API_URL` 仅用于开发/测试环境

## 管理访问权限

随时可在 [SandBase Dashboard](https://sandbase.ai/console/keys) 的 API Keys 中吊销 CLI 凭据。

## 开发

```sh
# 安装依赖
npm ci

# 构建
npm run build

# 运行测试
npm test

# 代码检查
npm run lint
```

## 相关链接

- [SandBase 平台](https://sandbase.ai)
- [SandBase 控制台](https://sandbase.ai/console)
- [SandBase 文档](https://docs.sandbase.ai)
- [npm 包](https://www.npmjs.com/package/@sandbaseai/cli)

## 开源协议

Apache-2.0
