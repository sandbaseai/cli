<p align="center">
  <h1 align="center">@sandbaseai/cli</h1>
  <p align="center">
    <strong>让你的 AI 助手拥有超能力。一行命令，2,000+ AI 模型。</strong>
  </p>
  <p align="center">
    <a href="./README.md">English</a> | 中文 | <a href="./README.ja.md">日本語</a> | <a href="./README.ko.md">한국어</a> | <a href="./README.es.md">Español</a> | <a href="./README.fr.md">Français</a> | <a href="./README.de.md">Deutsch</a> | <a href="./README.pt-BR.md">Português</a>
  </p>
  <p align="center">
    <a href="https://github.com/sandbaseai/cli/releases/latest"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/sandbaseai/cli/actions/workflows/ci.yml/badge.svg"></a>
    <a href="https://github.com/sandbaseai/cli/blob/main/LICENSE"><img alt="开源许可" src="https://img.shields.io/github/license/sandbaseai/cli"></a>
    <a href="https://github.com/sandbaseai/cli/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/sandbaseai/cli?style=social"></a>
  </p>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sandbaseai/cli/main/.github/assets/sandbase-cli-hero.webp" alt="SandBase CLI 安全连接 AI 客户端与模型、API、媒体、数据和沙箱" width="100%">
</p>

---

你的 AI 编程助手很聪明，但它被困在一个盒子里。它不能搜索网页、查看社交媒体、生成图片、或获取实时数据 — 除非你自己逐个对接每个 API。

**SandBase 改变了这一切。** 一行命令，通过 [Model Context Protocol](https://modelcontextprotocol.io) 将你的 Agent 连接到 2,000+ AI 模型。不用管理 API Key，不用折腾配置。

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

就这样。你的 Agent 现在能访问一切。

## SandBase 开源技术栈

- **[SandBase Harness](https://github.com/sandbaseai/sandbase-harness)** — 自托管 Agent Runtime，提供持久会话、沙箱隔离、审批、审计与回放。
- **[SandBase Agent Skills](https://github.com/sandbaseai/sandbase-skills)** — 88 个可安装 Skills，覆盖研究、社交情报、营销和商业工作流。

---

## 看看效果

连接后，用自然语言问你的 Agent 就行。

### "搜索一下 React 19 的新特性"

```
Agent → SandBase Web Search → 0.8 秒返回 10 条结果
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. "React 19 正式发布：全面解析新特性" — react.dev
2. "React 19 Compiler 深度解析" — Dan Abramov
3. "迁移到 React 19 指南" — Vercel Engineering
...
```

### "获取 Twitter 上关于 AI 的热门帖子"

```
Agent → SandBase Twitter API → 返回 Top 10 帖子
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. @karpathy: "LLMs are the new CPUs..." (45K ❤️)
2. @emollick: "Agent benchmarks just crossed..." (12K ❤️)
3. @swyx: "The MCP ecosystem is growing fast..." (8K ❤️)
...
```

### "帮我生成一个极简风格的 Logo，公司叫 'NightOwl'"

```
Agent → SandBase Flux 图像生成 → 1024x1024 PNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 已生成: nightowl-logo.png
  风格: 极简, 暗色主题
  费用: $0.003
  耗时: 2.1 秒
```

### "抓取 linear.app 的定价表"

```
Agent → SandBase Firecrawl 抓取 → 结构化数据
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ 提取到 3 个方案:
  Free: $0/月 — 最多 250 个 Issue
  Standard: $8/人/月 — 无限 Issue + Cycles
  Plus: $14/人/月 — 高级功能 + 分析
```

### "用 GPT-4o 帮我 Review 这个 PR"

```
Agent → SandBase GPT-4o → 分析完成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
发现 2 个问题:
  ⚠️  useEffect 中存在竞态条件 (第 42 行)
  ⚠️  异步组件缺少 Error Boundary
  ✓  类型安全良好
  ✓  测试覆盖充分
```

### "生成一段 5 秒的产品演示视频"

```
Agent → SandBase Kling 视频生成 → 异步处理
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ 生成中... (45 秒)
✓ 输出: product-demo.mp4 (5秒, 720p)
  费用: $0.10
```

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
│  (Cursor 等)    │────────▶│  (按需启动)   │────────▶│  2,000+ AI 模型    │
│                 │◀────────│               │◀────────│  和 API             │
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
| `sandbase_discover` | 搜索全部 2,000+ 可用 AI 模型 |
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
- [npm 包](https://www.npmjs.com/package/@sandbaseai/cli)
- [控制台](https://sandbase.ai/console)

## 开源协议

Apache-2.0
