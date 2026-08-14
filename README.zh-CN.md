# @sandbaseai/cli

[English](./README.md) | 中文

一行命令，将你的 AI 编程助手接入 [SandBase](https://sandbase.ai) — 统一的 MCP 网关，让任何 LLM 工具通过单一接口访问 2,000+ API、模型和数据源。

## 为什么选择 SandBase？

SandBase 是 AI 编程助手与外部工具之间的统一 MCP (Model Context Protocol) 桥接层：

- **2,000+ 工具** — 网页搜索、社交媒体、电商、加密货币、金融、天气、旅行等
- **200+ AI 模型** — GPT-4o、Claude、Gemini、Llama、Qwen、图像/视频/音频生成
- **一次授权** — 无需管理多个 API Key，通过 CLI 一次授权即可
- **隐私优先** — 密钥永远不会出现在命令行参数或浏览器 URL 中

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

### 3. 开始使用 SandBase 工具

在已连接的客户端中，尝试：

> "用 SandBase 搜索最新的 Next.js 版本发布说明。"

> "用 SandBase 获取 Elon Musk 最近 10 条推特。"

> "用 SandBase 生成一张山脉日落的图片。"

## 命令

| 命令 | 说明 |
|------|------|
| `sandbase connect [--client <name>]` | 授权并为客户端配置 MCP |
| `sandbase doctor [--client <name>]` | 检查连接状态和配置健康度 |
| `sandbase unregister [--client <name>]` | 移除本地 SandBase 配置 |
| `sandbase catalog --json` | 输出支持的客户端目录（JSON 格式） |

## 工作原理

1. **授权** — CLI 发起 device/PKCE 流程，你在浏览器中完成审批。
2. **凭据存储** — API Key 以受限文件权限存储在本地。
3. **MCP 配置** — CLI 为你的客户端写入相应的 MCP 服务器配置。
4. **桥接** — 一个轻量的本地 Node.js 进程（MCP Bridge）在客户端和 SandBase API 之间转发请求。

无需后台守护进程。MCP Bridge 仅在客户端调用工具时按需启动。

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
