<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>让你的 AI 助手拥有超能力。一行命令，2,000+ AI 模型与 API。</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | 中文 | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | <a href="./README.es.md">Español</a> | <a href="./README.fr.md">Français</a> | <a href="./README.de.md">Deutsch</a> | <a href="./README.pt-BR.md">Português</a>
  </p>
  <p align="center">
    <a href="https://github.com/sandbaseai/cli/releases/latest"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sandbaseai/cli/actions/workflows/ci.yml/badge.svg"></a>
    <a href="https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.sandbaseai%2Fcli"><img alt="官方 MCP Registry" src="https://img.shields.io/badge/MCP%20Registry-%E5%B7%B2%E6%94%B6%E5%BD%95-5a67d8"></a>
    <a href="https://tensorblock.co/mcp/servers/github-sandbaseai-cli-c4e113db"><img alt="TensorBlock MCP Index 已收录" src="https://mcp-index.tensorblock.co/v1/servers/github-sandbaseai-cli-c4e113db/badge.svg"></a>
    <a href="https://github.com/sandbaseai/cli/blob/main/LICENSE"><img alt="开源许可" src="https://img.shields.io/github/license/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/sandbaseai/cli?style=social"></a>
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI 安全连接 AI 客户端与模型、API、媒体、数据和沙箱" width="100%">
</p>

---

你的 AI 编程助手很聪明，但它被困在一个盒子里。它不能搜索网页、查看社交媒体、生成图片、或获取实时数据 — 除非你自己逐个对接每个 API。

**SandBase 改变了这一切。** 一行命令，通过 [Model Context Protocol](https://modelcontextprotocol.io) 将你的 Agent 连接到 2,000+ AI 模型与 API。不用管理 API Key，不用折腾配置。

在 macOS 或 Linux 上使用官方 Homebrew Formula：

```sh
brew install sandbaseai/tap/sandbaseai-cli
sandbase connect
```

或者直接运行不可变的 v0.1.17 发布包：

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

想先验证兼容性、暂不登录也不修改本地配置？运行只读目录命令，确认当前版本支持的 25 个客户端：

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz catalog --json
```

这里使用的是不可变的 GitHub `v0.1.17` 发布包；其 SHA-256 为
`1ad535b2899ca460b57b3c268aef278fee28fd28e649a89b92951514fd71fffa`。
目前 npm 的 `latest` 标签仍是 v0.1.14，因此在可信发布启用完成前，请使用上面的版本化 GitHub 地址。

项目已进入[官方 MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.sandbaseai%2Fcli/versions/0.1.17)，并被[中国独立开发者项目（程序员版）](https://github.com/1c7/chinese-independent-developer/blob/master/pages/README-Programmer-Edition.md#sandbase---github)独立收录。

查看[中文项目页](https://sandbaseai.github.io/cli/zh/)和[中文工作流指南](https://github.com/sandbaseai/cli/discussions/48)。如果 SandBase CLI 对你有帮助，请[给仓库一个 Star](https://github.com/sandbaseai/cli)，让更多开发者发现它。

就这样。你的 Agent 现在能访问一切。

## SandBase 开源技术栈

- **[SandBase Harness](https://github.com/sandbaseai/sandbase-harness)** — 自托管 Agent Runtime，提供持久会话、沙箱隔离、审批、审计与回放。
- **[SandBase Agent Skills](https://github.com/sandbaseai/sandbase-skills)** — 88 个可安装 Skills，覆盖研究、社交情报、营销和商业工作流。
- **[SandBase for Codex](https://github.com/sandbaseai/sandbase-codex-plugin)** — 官方 Codex 插件，封装 SandBase MCP 桥接器和引导式 Agent Skill。

---

## 一套可验证的 Agent 工作流

连接后，让 Agent 按以下顺序工作，而不是直接猜测模型名称、输入字段或费用：

1. 使用 `sandbase_discover` 按任务或能力搜索候选模型与 API。
2. 使用 `sandbase_inspect` 读取当前输入 Schema、价格和执行要求。
3. 确认模型、参数和可能费用后，再使用 `sandbase_run` 执行。
4. 对异步任务使用 `sandbase_run_get` 查询状态和结果。
5. 使用 `sandbase_runs` 查看最近运行、状态与实际费用。
6. 使用 `sandbase_account` 检查账户余额。

例如，你可以要求：

> 搜索适合生成产品演示图的模型。先比较输入字段和当前价格，只展示候选项，不要执行。

选择模型后再明确要求执行。模型目录、Schema、价格和运行结果都会变化，因此应以工具当次返回的数据为准。不要把示例输出当作实时结果。

---

## 包含什么

| 分类 | 工具 | 能做什么 |
|------|------|----------|
| **网页搜索** | Google、Exa、Tavily、Scholar | 实时搜索任何信息 |
| **社交媒体** | Twitter/X、YouTube、Reddit、Instagram、TikTok、小红书、微博、B站 | 监控趋势、获取帖子、分析内容 |
| **网页抓取** | Firecrawl、Exa Content | 从任何公开网页提取数据 |
| **AI 模型** | GPT-4o、Claude、Gemini、DeepSeek、Qwen、Llama | 调用任何模型，无需自己管 Key |
| **图像生成** | Flux、DALL-E、Ideogram、Recraft | Logo、插画、原型图 |
| **视频生成** | Kling、MiniMax、Runway、Luma | 短视频、动画 |
| **音频** | ElevenLabs、Whisper | 文字转语音、语音转文字 |
| **电商** | 淘宝、Amazon | 选品调研、价格对比 |
| **金融** | 股票行情、公司信息 | 市场研究与分析 |

---

## 支持的客户端（25 个目标）

兼容所有主流 AI 编程工具：

| 自动配置 | 手动配置 |
|---------|---------|
| Cursor、Cursor CLI | ChatGPT |
| Claude Code | Claude Desktop |
| Codex | |
| Kiro IDE、Kiro CLI | |
| Windsurf | |
| Gemini CLI | |
| Amp | |
| Warp | |
| OpenCode、Qwen Code、Kimi CLI | |
| Hermes、OpenClaw | |

无需登录或修改任何文件，即可预览完整兼容性目录：

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz catalog --json
```

```sh
# 一次连接所有检测到的客户端
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect

# 或者指定某个客户端
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect --client cursor
```

---

## 工作原理

```
┌─────────────────┐         ┌───────────────┐         ┌────────────────────┐
│   你的 Agent    │  MCP    │  本地 Bridge  │  HTTPS  │    SandBase API     │
│  (Cursor 等)    │────────▶│  (按需启动)   │────────▶│ 2,000+ 模型/API    │
│                 │◀────────│               │◀────────│                    │
└─────────────────┘         └───────────────┘         └────────────────────┘
```

1. 运行 `connect` → 浏览器打开授权 → 你点击同意
2. API Key 本地保存（权限 `0600`）
3. 自动为你的客户端写入 MCP 配置
4. Agent 按需调用工具。没有后台进程。

---

## 命令

### CLI 命令

```sh
sandbase connect [--client <name>]    # 授权 + 配置
sandbase doctor [--client <name>]     # 健康检查
sandbase unregister [--client <name>] # 移除配置
sandbase catalog --json               # 列出所有支持的客户端
```

### MCP 工具（连接后你的 Agent 可以使用）

| 工具 | 用途 |
|------|------|
| `sandbase_discover` | 搜索全部 2,000+ 可用 AI 模型与 API |
| `sandbase_inspect` | 获取输入参数、定价和调用模板 |
| `sandbase_run` | 执行模型或 API |
| `sandbase_run_get` | 轮询异步任务状态/结果（视频生成等） |
| `sandbase_runs` | 查看最近的 API 调用记录和费用 |
| `sandbase_account` | 查看账户余额（免费，不扣费） |

**Agent 自动遵循的调用流程：**

```
discover → inspect → run
```

```
1. sandbase_discover(q: "推特搜索")              → 找到匹配的工具
2. sandbase_inspect(name: "twitter_timeline")    → 获取参数定义 + 定价
3. sandbase_run(name: "twitter_timeline", ...)   → 执行并返回数据
```

---

## 安全性

- **URL 和 CLI 参数中没有任何密钥** — OAuth device flow + PKCE
- **受限文件权限** — 凭据以 `0600` 存储
- **所有权感知更新** — 保留现有 JSONC 注释以及用户自行管理的 MCP 配置项
- **精确回滚** — 失败或执行 `unregister` 时，只移除由 SandBase 创建的配置
- **随时吊销** — [SandBase Dashboard](https://sandbase.ai/console/keys) 一键操作

---

## 开始使用

```sh
npx -y https://github.com/sandbaseai/cli/releases/download/v0.1.17/sandbaseai-cli-0.1.17.tgz connect
```

然后让你的 Agent 做一些它以前做不到的事。

**[注册免费账号 →](https://sandbase.ai)**

如果 SandBase 帮你节省了配置时间，欢迎[为项目点个 Star](https://github.com/sandbaseai/cli)——这会让更多 Agent 用户发现它。

---

## 链接

- [SandBase 平台](https://sandbase.ai)
- [文档](https://www.sandbase.ai/docs/)
- [官方 MCP Registry 收录](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.sandbaseai%2Fcli)
- [Glama MCP Connector 收录](https://glama.ai/mcp/connectors/io.github.sandbaseai/cli)
- [官方 Registry 社区技术展示](https://github.com/modelcontextprotocol/registry/discussions/1584)
- 六工具实战指南：[中文](https://github.com/sandbaseai/cli/discussions/48) · [English](https://github.com/sandbaseai/cli/discussions/47)
- [VaultPlane MCP 目录收录](https://www.vaultplane.com/server/sandbase-cli)
- [AIMCP 目录收录](https://www.aimcp.info/zh/g/522d366e-114b-4d90-9f1a-552b4b3a9c86)
- [中国独立开发者项目（程序员版）收录](https://github.com/1c7/chinese-independent-developer/blob/master/pages/README-Programmer-Edition.md#sandbase---github)
- [npm 包](https://www.npmjs.com/package/@sandbaseai/cli)
- [控制台](https://sandbase.ai/console)

## 开源协议

Apache-2.0
