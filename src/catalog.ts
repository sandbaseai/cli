export const clientCatalog = [
  { id: "codex", label: "Codex", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "claude-code", label: "Claude Code", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "cursor", label: "Cursor", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "windsurf", label: "Windsurf", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "gemini-cli", label: "Gemini CLI", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "opencode", label: "OpenCode", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "hermes", label: "Hermes", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "openclaw", label: "OpenClaw", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "cursor-cli", label: "Cursor CLI", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "warp", label: "Warp", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "kimi-cli", label: "Kimi CLI", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "qwen-code", label: "Qwen Code", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "kiro", label: "Kiro IDE", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "kiro-cli", label: "Kiro CLI", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "amp", label: "Amp", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "crush", label: "Crush", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "iflow-cli", label: "iFlow CLI (legacy)", delivery: "adapter", autoEligible: true, localAuthorization: true, installScriptEligible: true },
  { id: "antigravity", label: "Antigravity", delivery: "prompt", autoEligible: false, localAuthorization: true, installScriptEligible: true },
  { id: "trae", label: "Trae", delivery: "prompt", autoEligible: false, localAuthorization: true, installScriptEligible: true },
  { id: "qoder", label: "Qoder", delivery: "prompt", autoEligible: false, localAuthorization: true, installScriptEligible: true },
  { id: "workbuddy", label: "WorkBuddy", delivery: "prompt", autoEligible: false, localAuthorization: true, installScriptEligible: true },
  { id: "pi", label: "Pi", delivery: "prompt", autoEligible: false, localAuthorization: true, installScriptEligible: true },
  { id: "claude-desktop", label: "Claude Desktop", delivery: "desktop_import", autoEligible: false, localAuthorization: true, installScriptEligible: true },
  { id: "cowork", label: "Cowork", delivery: "desktop_import", autoEligible: false, localAuthorization: true, installScriptEligible: true },
  { id: "chatgpt", label: "ChatGPT", delivery: "remote_workspace", autoEligible: false, localAuthorization: true, installScriptEligible: true },
] as const;

export type ClientCatalogEntry = (typeof clientCatalog)[number];
export type CatalogClient = ClientCatalogEntry["id"];
export function stableCatalog(): string {
  return JSON.stringify({ schemaVersion: 1, clients: clientCatalog }, null, 2) + "\n";
}
