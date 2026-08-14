import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
export function sandbaseHome(env = process.env): string { return env.SANDBASE_HOME || join(env.HOME || homedir(), ".sandbase"); }
export function configPath(client: string, env = process.env): string {
  const home = env.HOME || homedir();
  if (client === "codex") return env.CODEX_HOME ? join(env.CODEX_HOME, "config.toml") : join(home, ".codex", "config.toml");
  if (client === "claude-code") return join(home, ".claude.json");
  if (client === "cursor") return join(home, ".cursor", "mcp.json");
  if (client === "hermes") return env.HERMES_HOME ? join(env.HERMES_HOME, "config.yaml") : join(home, ".hermes", "config.yaml");
  if (client === "gemini-cli") return join(home, ".gemini", "settings.json");
  if (client === "qwen-code") return join(home, ".qwen", "settings.json");
  if (client === "opencode") {
    if (env.OPENCODE_CONFIG) return env.OPENCODE_CONFIG;
    const json = join(home, ".config", "opencode", "opencode.json");
    const jsonc = join(home, ".config", "opencode", "opencode.jsonc");
    return existsSync(json) || !existsSync(jsonc) ? json : jsonc;
  }
  if (client === "windsurf") return join(home, ".codeium", "windsurf", "mcp_config.json");
  if (client === "cursor-cli") return join(home, ".cursor", "mcp.json");
  if (client === "kimi-cli") return join(env.KIMI_SHARE_DIR || join(home, ".kimi"), "mcp.json");
  if (client === "kiro-cli") return join(env.KIRO_HOME || join(home, ".kiro"), "settings", "mcp.json");
  if (client === "kiro") return join(home, ".kiro", "settings", "mcp.json");
  if (client === "amp") {
    const json = join(home, ".config", "amp", "settings.json");
    const jsonc = join(home, ".config", "amp", "settings.jsonc");
    return existsSync(json) || !existsSync(jsonc) ? json : jsonc;
  }
  if (client === "crush") return env.CRUSH_GLOBAL_CONFIG || join(home, ".config", "crush", "crush.json");
  if (client === "iflow-cli") return join(home, ".iflow", "settings.json");
  if (client === "warp") return join(home, ".warp", ".mcp.json");
  return join(sandbaseHome(env), "manual", `${client}.json`);
}
