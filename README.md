# @sandbaseai/cli

Node.js 20+ CLI for securely connecting Codex, Claude Code, Cursor, or Hermes to SandBase MCP.

```sh
npx -y @sandbaseai/cli connect --client codex
sandbase doctor --client codex
sandbase unregister --client codex
```

The CLI opens the SandBase authorization page. Secrets are never included in command-line arguments or browser URLs. `SANDBASE_API_URL` may override the API origin for development and tests.
