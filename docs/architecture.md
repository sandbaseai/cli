# 架构说明

## 分层

```
cmd/           命令层 — Cobra 命令定义、参数解析、OutputRenderer 调用
internal/      核心服务层 — 全部可测试的业务逻辑
├── auth/      认证解析（env > project > stored）
├── config/    配置分层（全局 + 项目 + 别名 + 默认参数）
├── output/    双模式渲染（TTY/JSON，管道安全）
├── client/    HTTP 传输（重试、SSE、multipart、verbose）
├── resource/  CRUD 服务（REST 端点映射）
├── schema/    动态 Schema（获取、校验、帮助生成）
├── poller/    异步轮询（指数退避）
├── file/      文件服务（校验、上传、下载、命名）
├── stream/    SSE 流式消费（增量/聚合）
├── models/    模型过滤（纯函数）
└── errors/    统一错误模型
```

## 依赖流向

```
cmd → internal services → client → net/http
cmd → output (渲染)
```

命令层只做：解析参数 → 调核心服务 → 把结果交给 OutputRenderer。

## 生命周期

1. `main.go`: signal.NotifyContext + NewRootCmd + ExecuteContext + 统一退出码
2. `PersistentPreRunE` (`app.init()`): 构造 Output → Config → Auth
3. `app.EnsureClient()` (按需): 构造 Client → Schema → Poller → File → Stream → Resource
4. 命令 `RunE`: 调用核心服务 → Output.Data/Info/Error

## 超时模型

- `http.Client.Timeout = 0`（不限制连接总时长）
- unary 调用（Request/PostMultipart）: `context.WithTimeout(ctx, TimeoutSec)`
- 流式（Stream/GetStream）: 不加超时，靠 context 取消（Ctrl+C/SIGTERM）
- retry 退避: `select { ctx.Done() / time.After() }`，可中断

## 测试策略

- 19 条属性测试（testing/quick，100+ 迭代/条）
- 单元测试（core services 68-100% 覆盖）
- httptest 集成测试（resource CRUD、client SSE）
- cmd 包冒烟测试（download 安全、humanize）
