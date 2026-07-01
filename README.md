# sandbase

SandBase AI 平台命令行工具。统一管理多模态生成、LLM 对话、Agent/Session 编排、文件上传下载、账户查询等全部平台能力。

## 安装

```bash
# curl（推荐）
curl -fsSL https://raw.githubusercontent.com/sandbaseai/cli/main/install.sh | sh

# Homebrew
brew install sandbaseai/tap/sandbase

# npm
npm install -g @sandbaseai/cli

# 从源码构建（需要 Go 1.21+）
go install github.com/sandbaseai/cli@latest
```

curl 安装支持固定版本和自定义安装目录：

```bash
SANDBASE_VERSION=0.1.1 sh -c "$(curl -fsSL https://raw.githubusercontent.com/sandbaseai/cli/main/install.sh)"
SANDBASE_INSTALL_DIR="$HOME/.local/bin" sh -c "$(curl -fsSL https://raw.githubusercontent.com/sandbaseai/cli/main/install.sh)"
```

## 快速上手

```bash
# 登录（会校验密钥有效性）
sandbase auth login --key sk-xxxxxxxx

# 搜索模型
sandbase models flux

# 查看模型参数
sandbase schema black-forest-labs/flux-1.1-pro

# 生成图片（自动上传本地文件、轮询、下载）
sandbase run black-forest-labs/flux-1.1-pro \
  --set prompt="a cat in space" \
  --set width=1024

# LLM 对话（流式输出）
sandbase chat --model anthropic/claude-sonnet-4 "解释量子计算"

# 查看任务状态
sandbase status <job_id>
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `auth login/logout/status` | 认证管理 |
| `models [query]` | 搜索/列出模型 |
| `schema <slug>` | 查看模型参数 schema |
| `run <slug>` | 提交多模态生成任务 |
| `chat` | LLM 对话（流式） |
| `status <job_id>` | 查看异步任务状态 |
| `agent create/list/get/update/archive/versions` | Agent 管理 |
| `environment create/list/get/update/delete` | 环境管理 |
| `session create/list/get/update/stop/archive/delete/send/events/stream` | 会话管理 |
| `skill create/list/update/delete` | Skill 管理 |
| `embed create/list/get/update/delete/usage` | Embed 配置管理 |
| `mcp list` | MCP Server 发现 |
| `upload <file...>` | 上传文件 |
| `download <url...>` | 下载文件 |
| `account balance/history/pricing` | 账户与计费 |
| `open [target]` | 打开平台页面 |
| `config set/get` | 全局配置 |
| `init` | 初始化项目配置 |

## 全局选项

```
--json       强制 JSON 输出（适合脚本/Agent 消费）
--verbose    输出完整 HTTP 请求/响应到 stderr
--timeout N  单次 API 调用超时秒数（默认 300）
--version    打印版本号
```

## Agent-First 设计

sandbase 遵循 Agent-First 理念：

- **stdout 仅承载数据**，stderr 承载诊断/进度，管道安全
- **--json 模式**：所有输出为结构化 JSON，错误也写入 stdout JSON
- **TTY 检测**：非终端自动切换 JSON 模式
- **NO_COLOR**：尊重 `NO_COLOR` 环境变量
- **可预测退出码**：成功 0，错误 1

```bash
# 脚本用法示例
JOB_ID=$(sandbase run flux-pro --set prompt="test" --no-wait --json | jq -r .job_id)
sandbase status "$JOB_ID" --json | jq .status
```

## 项目配置

在项目根目录创建 `sandbase.json`：

```bash
sandbase init
```

```json
{
  "$schema": "https://raw.githubusercontent.com/sandbaseai/cli/main/install.sh/schema/sandbase.json",
  "defaultChatModel": "anthropic/claude-sonnet-4",
  "aliases": {
    "kling": "kwaivgi/kling-video/3.0/pro/image-to-video",
    "flux": "black-forest-labs/flux-1.1-pro"
  },
  "defaults": {
    "kwaivgi/kling-video/3.0/pro/image-to-video": {
      "duration": 5,
      "aspect_ratio": "16:9"
    }
  }
}
```

配置优先级：命令行参数 > 项目配置 > 全局配置 > 内置默认值

## 认证

优先级：`SANDBASE_API_KEY` 环境变量 > 项目配置 `apiKey` > 存储凭证

```bash
# 环境变量（CI/CD 推荐）
export SANDBASE_API_KEY=sk-xxxxxxxx

# 交互式登录（本地开发）
sandbase auth login

# 查看当前状态
sandbase auth status
```

## 开发

```bash
# 构建
go build -o sandbase .

# 测试
go test ./...

# 带版本号构建
go build -ldflags "-X github.com/sandbaseai/cli/cmd.Version=0.1.0" -o sandbase .

# goreleaser 本地快照
goreleaser release --snapshot --clean
```

## License

MIT
