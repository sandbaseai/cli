# MCP Server

The `sandbase mcp serve` command starts an MCP (Model Context Protocol) server that exposes SandBase platform capabilities as standardized tools. IDE and AI agent clients can connect to it via stdio locally, or via Streamable HTTP when hosted.

## Quick Start

```bash
sandbase mcp serve
```

Hosted HTTP:

```bash
sandbase mcp serve --transport http --addr :8080 --endpoint /mcp
```

Production hosted endpoint:

```text
https://mcp.sandbase.ai/mcp
```

Test hosted endpoint:

```text
https://mcp-test193f.sandbase.ai/mcp
```

## IDE Configuration

### Claude Desktop / Claude Code

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sandbase": {
      "command": "sandbase",
      "args": ["mcp", "serve"],
      "env": {
        "SANDBASE_API_KEY": "sk-xxx"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "sandbase": {
      "command": "sandbase",
      "args": ["mcp", "serve"],
      "env": {
        "SANDBASE_API_KEY": "sk-xxx"
      }
    }
  }
}
```

### VS Code / Kiro

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "sandbase": {
      "type": "stdio",
      "command": "sandbase",
      "args": ["mcp", "serve"],
      "env": {
        "SANDBASE_API_KEY": "sk-xxx"
      }
    }
  }
}
```

### Remote MCP

Use the hosted SandBase MCP server when the client supports Streamable HTTP:

```json
{
  "mcpServers": {
    "sandbase": {
      "type": "http",
      "url": "https://mcp.sandbase.ai/mcp",
      "headers": {
        "Authorization": "Bearer ${SANDBASE_API_KEY}"
      }
    }
  }
}
```

The hosted server is stateless. Each HTTP request can pass a SandBase API key as a bearer token; the server forwards that token to the SandBase API for the tool call. If no bearer token is provided, only public/read-only API behavior should be expected.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--transport` | `stdio` | Transport protocol (stdio, http) |
| `--addr` | `:8080` | HTTP listen address when `--transport=http` |
| `--endpoint` | `/mcp` | HTTP MCP endpoint path when `--transport=http` |
| `--toolsets` | all | Comma-separated toolsets to enable |
| `--read-only` | false | Only expose read-only tools |
| `--verbose` | false | Log HTTP requests to stderr |
| `--timeout` | 300 | API call timeout in seconds |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SANDBASE_API_KEY` | API key (recommended for IDE config) |
| `SANDBASE_BASE_URL` | Override API endpoint |
| `SANDBASE_MCP_TOOLSETS` | Equivalent to --toolsets |
| `SANDBASE_MCP_READ_ONLY` | Set to "true" for read-only mode |

## Toolsets

| Toolset | Tools | Description |
|---------|-------|-------------|
| `models` | models_list, models_get, schema_get | Model discovery |
| `run` | run_submit, run_status | Multimodal generation |
| `chat` | chat | LLM conversation |
| `upload` | upload | File upload |
| `agent` | agent_list/get/create/update/archive | Agent management |
| `session` | session_list/get/create/send/events/stop | Session execution |
| `environment` | env_list/get/create/update/delete | Environment management |
| `skill` | skill_list/get/library/create/update/delete | Skill management |
| `embed` | embed_list/get/create/update/delete/usage | Embed config management |
| `mcp` | mcp_servers | Platform MCP discovery |
| `account` | balance, history | Account info |

## Security Recommendations

- **Use `--read-only` by default** to prevent LLM from accidentally executing destructive operations
- Pass API key via `env` in IDE config, not via command-line args (visible in process list)
- Use `--toolsets` to limit exposed tools to only what's needed

## Examples

```bash
# All tools (default)
sandbase mcp serve

# Only model discovery and generation
sandbase mcp serve --toolsets models,run

# Read-only mode (recommended for safety)
sandbase mcp serve --read-only

# Verbose logging for debugging
sandbase mcp serve --verbose

# Hosted HTTP mode for model discovery, chat, generation, MCP discovery, and account info
SANDBASE_MCP_TOOLSETS=models,mcp,chat,run,account sandbase mcp serve --transport http --addr :8080
```
