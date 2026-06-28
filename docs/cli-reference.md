# sandbase CLI 命令参考

## 全局选项

所有命令均支持以下全局选项：

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--json` | 强制 JSON 输出模式 | 自动检测（TTY=格式化，非TTY=JSON） |
| `--verbose` | 输出完整 HTTP 请求/响应到 stderr | false |
| `--timeout <seconds>` | 单次 API 调用超时 | 300 |
| `--version` | 打印版本号 | - |

---

## auth — 认证管理

### auth login

```
sandbase auth login [--key <token>] [--no-verify]
```

交互式或通过 `--key` 提供 API Key。默认存储前校验密钥有效性，`--no-verify` 跳过校验。

### auth logout

```
sandbase auth logout
```

删除存储的凭证。

### auth status

```
sandbase auth status
```

显示当前认证状态（来源、掩码密钥）。

---

## models — 模型发现

### models [query]

```
sandbase models [query] [--type <type>]
```

搜索模型。`query` 匹配名称/slug/厂商/标签。`--type` 过滤类型（llm/image/video/audio/3d）。

### models get

```
sandbase models get <slug>
```

显示模型详情。

---

## schema — 参数 Schema

```
sandbase schema <slug>
```

获取并展示模型的统一参数 schema，含名称、类型、是否必填、描述、默认值。

---

## run — 多模态生成

```
sandbase run <slug> [--set key=value...] [--no-wait] [--no-download] [--output <dir>]
```

提交多模态生成任务。

| 选项 | 说明 |
|------|------|
| `--set key=value` | 设置参数（可重复） |
| `--no-wait` | 只返回 job_id，不轮询 |
| `--no-download` | 只输出 URL，不下载 |
| `--output <dir>` | 下载目录（默认当前目录） |

特性：
- 本地文件路径自动上传（如 `--set image=./cat.png`）
- 指数退避轮询（1s → 10s 上限）
- LLM 类型模型自动提示改用 `chat`

---

## chat — LLM 对话

```
sandbase chat [prompt] --model <slug> [--system <text>] [--no-stream]
```

| 选项 | 说明 |
|------|------|
| `--model` | 模型 slug（必填，除非配置了 defaultChatModel） |
| `--system` | 系统消息 |
| `--no-stream` | 等待完整响应而非流式 |

支持 stdin 管道：`echo "hello" | sandbase chat --model ...`

---

## status — 任务状态

```
sandbase status <job_id>
```

查询异步任务当前状态及输出。

---

## agent — Agent 管理

```
sandbase agent create --name <name> [--environment <id>]
sandbase agent list
sandbase agent get <id>
sandbase agent update <id> --name <name>
sandbase agent archive <id>
sandbase agent versions <id>
```

---

## environment — 环境管理

```
sandbase environment create --name <name>
sandbase environment list
sandbase environment get <id>
sandbase environment update <id> --name <name>
sandbase environment delete <id>
```

别名：`sandbase env`

---

## session — 会话管理

```
sandbase session create [--agent <id>]
sandbase session list
sandbase session get <id>
sandbase session update <id>
sandbase session stop <id>
sandbase session archive <id>
sandbase session delete <id>
sandbase session send <id> "text"
sandbase session events <id>
sandbase session stream <id>
```

`stream` 通过 SSE 实时输出会话事件。

---

## skill — Skill 管理

```
sandbase skill create --name <name> --file ./skill.yaml
sandbase skill create --name <name> --skill-file-url https://media.sandbase.ai/_private/...
sandbase skill create --name <name> --git-url https://github.com/acme/skills/tree/main/my-skill
sandbase skill list
sandbase skill update <id> --name <name>
sandbase skill delete <id>
```

---

## embed — Embed 管理

```
sandbase embed create --name <name> --agent <agent_id> --environment <environment_id>
sandbase embed create --name site-assistant --agent agent_xxx --environment env_xxx --origin https://www.sandbase.ai --title Sandy
sandbase embed list
sandbase embed get <id>
sandbase embed update <id> --enabled=false
sandbase embed usage <id>
sandbase embed delete <id>
```

`embed create` 返回 `publishable_key` 和可直接放到网页里的 `embed_code`。管理面使用 `SANDBASE_API_KEY`；网页运行面使用 `publishable_key`。

---

## mcp — MCP 发现

```
sandbase mcp list
```

列出平台可用的 MCP Server。

---

## upload — 文件上传

```
sandbase upload <file...>
```

支持多文件。校验文件类型（image: jpg/png/webp/gif; video: mp4/mov/webm）和大小（image ≤ 20MB; video ≤ 500MB）。上传时显示进度。

---

## download — 文件下载

```
sandbase download <url...> [--output <dir>]
```

下载时显示进度。

---

## account — 账户管理

```
sandbase account balance
sandbase account history [--limit <n>]
sandbase account pricing <slug>
```

---

## open — 打开平台页面

```
sandbase open [dashboard|docs|models]
```

在浏览器打开对应页面。JSON 模式下输出 URL 而非启动浏览器。

---

## config — 配置管理

```
sandbase config set <key> <value>
sandbase config get <key>
```

操作全局配置 `~/.config/sandbase/config.json`。

---

## init — 初始化项目

```
sandbase init
```

在当前目录创建 `sandbase.json` 配置模板。
