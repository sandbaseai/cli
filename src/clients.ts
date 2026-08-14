import type { Client } from "./types.js";

export type InstallMode = "auto" | "manual" | "skill";
export type SkillTier = "s1_slash" | "s3_promotion" | "s3_fallback" | "s4_none";
export type MCPMode = "auto" | "desktop" | "manual" | "none";
export type SkillMode = "shared_skill" | "client_skill" | "prompt" | "none";
export type Invocation = "slash" | "skill_picker" | "mcp_chat" | "desktop_ui" | "prompt" | "none";
export type Verification = "fixture" | "read_only_probe" | "user_action" | "real_client_matrix";
export type CapabilityStatus = "configured" | "already_configured" | "action_required" | "unsupported" | "failed";
export interface NativeCapability { mcpMode: MCPMode; skillMode: SkillMode; invocation: Invocation; verification: Verification; guide: string; uninstall: "managed_only"; terminal: Exclude<CapabilityStatus, "configured" | "already_configured" | "failed">; }
export type RuntimeStatus = "configured" | "already_configured" | "confirmation_required" | "unsupported" | "failed";
export type ImplementationState = "implemented" | "blocked";
export interface Evidence { source: string; retrieved: string; conclusion: string; kind: "first_party" | "internal_blocker"; }
export interface InstallerDescriptor { mcp: "adapter" | "confirmation" | "none"; skill: "shared" | "private" | "confirmation" | "none"; }
export interface ValidatorDescriptor { mcp: "read_back" | "confirmation" | "none"; skill: "ownership_checksum" | "real_client_matrix" | "confirmation" | "none"; }
export interface CapabilityV2 { evidence: Evidence; installer: InstallerDescriptor; validator: ValidatorDescriptor; implementation: ImplementationState; status: RuntimeStatus; nextStep: string; }

export interface ClientProfile {
  id: Client;
  label: string;
  mode: InstallMode;
  executable?: string;
  adapter?: "codex" | "json" | "yaml" | "a1" | "b" | "c" | "warp" | "kiro";
}

export const clientProfiles: Record<Client, ClientProfile> = {
  codex: { id: "codex", label: "Codex", mode: "auto", executable: "codex", adapter: "codex" },
  "claude-code": { id: "claude-code", label: "Claude Code", mode: "auto", executable: "claude", adapter: "json" },
  cursor: { id: "cursor", label: "Cursor", mode: "auto", executable: "cursor", adapter: "json" },
  windsurf: { id: "windsurf", label: "Windsurf", mode: "auto", executable: "windsurf", adapter: "a1" },
  "gemini-cli": { id: "gemini-cli", label: "Gemini CLI", mode: "auto", executable: "gemini", adapter: "b" },
  opencode: { id: "opencode", label: "OpenCode", mode: "auto", executable: "opencode2", adapter: "a1" },
  chatgpt: { id: "chatgpt", label: "ChatGPT", mode: "manual" },
  hermes: { id: "hermes", label: "Hermes", mode: "auto", executable: "hermes", adapter: "yaml" },
  openclaw: { id: "openclaw", label: "OpenClaw", mode: "auto", executable: "openclaw" },
  antigravity: { id: "antigravity", label: "Antigravity", mode: "skill" },
  "claude-desktop": { id: "claude-desktop", label: "Claude Desktop", mode: "manual" },
  "cursor-cli": { id: "cursor-cli", label: "Cursor CLI", mode: "auto", executable: "cursor-agent", adapter: "b" },
  warp: { id: "warp", label: "Warp", mode: "auto", adapter: "warp" },
  trae: { id: "trae", label: "Trae", mode: "skill" },
  "kimi-cli": { id: "kimi-cli", label: "Kimi CLI", mode: "auto", executable: "kimi", adapter: "b" },
  "qwen-code": { id: "qwen-code", label: "Qwen Code", mode: "auto", executable: "qwen", adapter: "a1" },
  kiro: { id: "kiro", label: "Kiro IDE", mode: "auto", adapter: "kiro" },
  "kiro-cli": { id: "kiro-cli", label: "Kiro CLI", mode: "auto", executable: "kiro-cli", adapter: "b" },
  amp: { id: "amp", label: "Amp", mode: "auto", executable: "amp", adapter: "c" },
  crush: { id: "crush", label: "Crush", mode: "auto", executable: "crush", adapter: "c" },
  "iflow-cli": { id: "iflow-cli", label: "iFlow CLI (legacy)", mode: "auto", executable: "iflow", adapter: "c" },
  qoder: { id: "qoder", label: "Qoder", mode: "skill" },
  workbuddy: { id: "workbuddy", label: "WorkBuddy", mode: "skill" },
  cowork: { id: "cowork", label: "Cowork", mode: "manual" },
  pi: { id: "pi", label: "Pi", mode: "skill" },
};

export const skillTiers: Record<Client, SkillTier> = {
  codex: "s3_promotion", "claude-code": "s1_slash", cursor: "s3_promotion", hermes: "s3_promotion",
  windsurf: "s4_none", "gemini-cli": "s4_none", opencode: "s4_none", chatgpt: "s4_none", openclaw: "s3_promotion", antigravity: "s4_none", "claude-desktop": "s4_none", "cursor-cli": "s4_none", warp: "s4_none", trae: "s4_none", "kimi-cli": "s4_none", "qwen-code": "s4_none", kiro: "s3_promotion", "kiro-cli": "s4_none", amp: "s4_none", crush: "s4_none", "iflow-cli": "s4_none", qoder: "s4_none", workbuddy: "s4_none", cowork: "s4_none", pi: "s4_none",
};

const guide = (client: string, action: string, check: string) => `${client}: ${action} Completion check: ${check} Recovery: keep existing settings unchanged and retry after correcting the client setup.`;
export const nativeCapabilities: Record<Client, NativeCapability> = {
  codex: { mcpMode: "auto", skillMode: "shared_skill", invocation: "skill_picker", verification: "read_only_probe", guide: guide("Codex", "Restart Codex and use its Skill picker to select SandBase; do not assume a slash command.", "SandBase MCP tools are visible in the session."), uninstall: "managed_only", terminal: "action_required" },
  "claude-code": { mcpMode: "auto", skillMode: "client_skill", invocation: "slash", verification: "real_client_matrix", guide: guide("Claude Code", "Restart Claude Code; native Skill discovery remains unverified until the real-client matrix is complete.", "SandBase MCP tools and the private Skill are installed."), uninstall: "managed_only", terminal: "action_required" },
  cursor: { mcpMode: "auto", skillMode: "shared_skill", invocation: "slash", verification: "real_client_matrix", guide: guide("Cursor", "Restart Cursor, type /, and look for /sandbase.", "A real-client matrix confirms /sandbase discovery and invocation."), uninstall: "managed_only", terminal: "action_required" },
  "cursor-cli": { mcpMode: "auto", skillMode: "none", invocation: "mcp_chat", verification: "read_only_probe", guide: guide("Cursor CLI", "Restart cursor-agent and inspect MCP servers/tools.", "cursor-agent mcp list and list-tools read back SandBase."), uninstall: "managed_only", terminal: "action_required" },
  "gemini-cli": { mcpMode: "auto", skillMode: "none", invocation: "mcp_chat", verification: "read_only_probe", guide: guide("Gemini CLI", "Restart the CLI session and use the configured SandBase MCP tools.", "SandBase tools are listed by the client."), uninstall: "managed_only", terminal: "action_required" },
  hermes: { mcpMode: "auto", skillMode: "client_skill", invocation: "mcp_chat", verification: "real_client_matrix", guide: guide("Hermes", "Restart Hermes, then use the SandBase native Skill or configured MCP tools; native discovery requires the real-client matrix.", "The managed Hermes Skill and SandBase MCP entry are present."), uninstall: "managed_only", terminal: "action_required" },
  "claude-desktop": { mcpMode: "desktop", skillMode: "client_skill", invocation: "desktop_ui", verification: "real_client_matrix", guide: guide("Claude Desktop", "Download and import the versioned MCP config and reviewed Skill, then restart the desktop app.", "Verify MCP and Skill separately in the real-client matrix."), uninstall: "managed_only", terminal: "action_required" },
  "qwen-code": { mcpMode: "auto", skillMode: "none", invocation: "mcp_chat", verification: "read_only_probe", guide: guide("Qwen Code", "Restart Qwen Code, open /mcp, and inspect SandBase settings/tools.", "The user-scope SandBase server is present in /mcp and settings readback."), uninstall: "managed_only", terminal: "action_required" },
  windsurf: { mcpMode: "auto", skillMode: "none", invocation: "desktop_ui", verification: "read_only_probe", guide: guide("Windsurf", "Restart Windsurf and inspect Cascade MCP Servers.", "The SandBase remote server and tools are visible."), uninstall: "managed_only", terminal: "action_required" },
  opencode: { mcpMode: "auto", skillMode: "none", invocation: "mcp_chat", verification: "read_only_probe", guide: guide("OpenCode", "Restart OpenCode and inspect its MCP server list.", "opencode2 mcp list reads back SandBase."), uninstall: "managed_only", terminal: "action_required" },
  chatgpt: { mcpMode: "manual", skillMode: "none", invocation: "desktop_ui", verification: "user_action", guide: guide("ChatGPT", "After SandBase authorization and local bridge preparation, use an eligible Business, Enterprise, or Edu workspace: enable Developer Mode, create the SandBase App, Scan Tools, and have an administrator publish it.", "In a fresh ChatGPT conversation, read back the published SandBase tools and complete one safe call; this CLI never writes ChatGPT configuration."), uninstall: "managed_only", terminal: "action_required" },
  warp: { mcpMode: "auto", skillMode: "none", invocation: "desktop_ui", verification: "read_only_probe", guide: guide("Warp", "Approve the managed server with /agent-add-mcp, then inspect Warp's MCP server and tool readback.", "The owned user entry is present and Warp lists SandBase tools without a project override."), uninstall: "managed_only", terminal: "action_required" },
  trae: { mcpMode: "none", skillMode: "prompt", invocation: "prompt", verification: "user_action", guide: guide("Trae", "Paste a SandBase MCP usage prompt into the client after configuring its supported integration.", "The client confirms the prompt or tool availability."), uninstall: "managed_only", terminal: "action_required" },
  "kimi-cli": { mcpMode: "auto", skillMode: "none", invocation: "mcp_chat", verification: "read_only_probe", guide: guide("Kimi CLI", "Restart Kimi and inspect its persistent MCP list/test output.", "kimi mcp list/test read back SandBase tools."), uninstall: "managed_only", terminal: "action_required" },
  "kiro-cli": { mcpMode: "auto", skillMode: "client_skill", invocation: "mcp_chat", verification: "read_only_probe", guide: guide("Kiro CLI", "Use the independently verified native Skill and hot-reloaded global SandBase MCP server.", "Skills CLI verifies the immutable SandBase source while kiro-cli mcp list/status independently reads back MCP."), uninstall: "managed_only", terminal: "action_required" },
  kiro: { mcpMode: "auto", skillMode: "client_skill", invocation: "desktop_ui", verification: "real_client_matrix", guide: guide("Kiro IDE", "Reload Kiro after the owned user MCP entry and user Skill pass readback; resolve any workspace override first.", "Kiro IDE lists SandBase server/tools and completes a safe tool call."), uninstall: "managed_only", terminal: "action_required" },
  amp: { mcpMode: "auto", skillMode: "none", invocation: "mcp_chat", verification: "read_only_probe", guide: guide("Amp", "Restart Amp after the global JSON/JSONC entry passes amp mcp doctor.", "The owned global bridge is effective without a workspace or managed-policy override."), uninstall: "managed_only", terminal: "action_required" },
  crush: { mcpMode: "auto", skillMode: "none", invocation: "mcp_chat", verification: "read_only_probe", guide: guide("Crush", "Restart Crush after the global static stdio entry is installed.", "The exact owned entry is effective without a project override; real tools require client validation."), uninstall: "managed_only", terminal: "action_required" },
  "iflow-cli": { mcpMode: "auto", skillMode: "none", invocation: "mcp_chat", verification: "read_only_probe", guide: guide("iFlow CLI (legacy)", "Use only an existing compatible installation with Node.js 22+ and user-provided model access; vendor service ended 2026-04-17.", "iflow mcp get/list reads back the user-scope SandBase bridge; real tools remain subject to post-release user validation."), uninstall: "managed_only", terminal: "action_required" },
  qoder: { mcpMode: "none", skillMode: "prompt", invocation: "prompt", verification: "user_action", guide: guide("Qoder", "Paste the SandBase MCP usage prompt into Qoder.", "Qoder confirms the prompt or tool availability."), uninstall: "managed_only", terminal: "action_required" },
  workbuddy: { mcpMode: "none", skillMode: "prompt", invocation: "prompt", verification: "user_action", guide: guide("WorkBuddy", "Paste the SandBase MCP usage prompt into WorkBuddy.", "WorkBuddy confirms the prompt or tool availability."), uninstall: "managed_only", terminal: "action_required" },
  cowork: { mcpMode: "desktop", skillMode: "client_skill", invocation: "desktop_ui", verification: "real_client_matrix", guide: guide("Cowork", "Download the versioned MCP config and reviewed Skill, then use the supported account or administrator import flow.", "Verify MCP and Skill separately in the real-client matrix."), uninstall: "managed_only", terminal: "action_required" },
  pi: { mcpMode: "none", skillMode: "prompt", invocation: "prompt", verification: "user_action", guide: guide("Pi", "Paste the SandBase MCP usage prompt into Pi.", "Pi confirms the prompt or tool availability."), uninstall: "managed_only", terminal: "action_required" },
  openclaw: { mcpMode: "auto", skillMode: "client_skill", invocation: "mcp_chat", verification: "real_client_matrix", guide: guide("OpenClaw", "Restart OpenClaw after SandBase reads back its MCP bridge and ClawHub Skill; then use a natural-language SandBase request.", "OpenClaw reads back the managed MCP bridge and the exact SandBase ClawHub Skill identity."), uninstall: "managed_only", terminal: "action_required" },
  antigravity: { mcpMode: "none", skillMode: "prompt", invocation: "prompt", verification: "user_action", guide: guide("Antigravity", "Paste the SandBase MCP usage prompt into Antigravity.", "Antigravity confirms the prompt or tool availability."), uninstall: "managed_only", terminal: "action_required" },
};

function v2(client: Client, capability: NativeCapability): CapabilityV2 {
  const evidence: Partial<Record<Client, Evidence>> = {
    codex: { source: "https://developers.openai.com/codex/skills/", retrieved: "2026-07-29", conclusion: "Codex supports SKILL.md; the existing B-063 adapter provides the MCP transaction.", kind: "first_party" },
    "claude-code": { source: "https://docs.anthropic.com/en/docs/claude-code/skills", retrieved: "2026-07-29", conclusion: "Personal Skills use ~/.claude/skills/<skill-name>/SKILL.md and the directory name maps to its command.", kind: "first_party" },
    cursor: { source: "https://docs.cursor.com/context/skills", retrieved: "2026-07-28", conclusion: "The user-level ~/.agents/skills root is discovered by Cursor; UI discovery remains subject to the real-client matrix.", kind: "first_party" },
    hermes: { source: "Hermes Agent CLI v0.10.0 local help and installed source", retrieved: "2026-07-29", conclusion: "Hermes uses a managed local Skill under HERMES_HOME and the existing YAML stdio MCP adapter; UI discovery remains subject to the real-client matrix.", kind: "first_party" },
    openclaw: { source: "OpenClaw 2026.4.12 local help and installed source", retrieved: "2026-07-30", conclusion: "OpenClaw supports `mcp set/show/unset` plus ClawHub Skill installation/readback; SandBase configures both through the existing CLI authorization transaction.", kind: "first_party" },
    "claude-desktop": { source: "B-079 feature design r2", retrieved: "2026-07-30", conclusion: "Claude Desktop uses the shared local bridge credential lifecycle and a separate versioned artifact import transaction.", kind: "first_party" },
    cowork: { source: "B-079 feature design r2", retrieved: "2026-07-30", conclusion: "Cowork uses the shared local bridge credential lifecycle and its independent account or administrator import transaction.", kind: "first_party" },
    opencode: { source: "https://opencode.ai/v2/docs/mcp-servers", retrieved: "2026-07-30", conclusion: "OpenCode V2 supports global MCP configuration and independent CLI list readback.", kind: "first_party" },
    "qwen-code": { source: "https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/", retrieved: "2026-07-30", conclusion: "Qwen Code supports explicit user-scope MCP add/remove and /mcp settings readback.", kind: "first_party" },
    windsurf: { source: "https://docs.windsurf.com/windsurf/cascade/mcp", retrieved: "2026-07-30", conclusion: "Windsurf supports a user mcp_config.json remote server schema with file credential interpolation.", kind: "first_party" },
    "gemini-cli": { source: "https://geminicli.com/docs/tools/mcp-server/", retrieved: "2026-07-30", conclusion: "Gemini CLI supports explicit user-scope persistent MCP add/list/remove.", kind: "first_party" },
    "cursor-cli": { source: "https://docs.cursor.com/en/cli/using", retrieved: "2026-07-30", conclusion: "cursor-agent consumes the shared user .cursor/mcp.json and exposes independent MCP list/list-tools readback.", kind: "first_party" },
    "kimi-cli": { source: "https://moonshotai.github.io/kimi-cli/en/reference/kimi-mcp.html", retrieved: "2026-07-30", conclusion: "Kimi Code CLI supports persistent MCP add/list/test/remove through the kimi executable.", kind: "first_party" },
    "kiro-cli": { source: "https://kiro.dev/docs/cli/mcp/configuration/", retrieved: "2026-07-30", conclusion: "Kiro CLI supports global command MCP add/list/status/remove and hot reload with KIRO_HOME precedence.", kind: "first_party" },
    kiro: { source: "https://kiro.dev/docs/mcp/configuration/", retrieved: "2026-07-31", conclusion: "Kiro IDE supports user MCP settings, higher-priority workspace settings, and user Skills independently of kiro-cli.", kind: "first_party" },
    amp: { source: "https://ampcode.com/manual", retrieved: "2026-07-30", conclusion: "Amp supports global JSON/JSONC stdio MCP configuration and mcp doctor readback, with higher-priority workspace and managed-policy constraints.", kind: "first_party" },
    crush: { source: "https://github.com/charmbracelet/crush/blob/main/schema.json", retrieved: "2026-07-30", conclusion: "Crush supports a global top-level mcp stdio schema with project precedence; SandBase writes only static argv and never shell expansion.", kind: "first_party" },
    "iflow-cli": { source: "https://github.com/iflow-ai/iflow-cli/blob/main/docs_en/examples/mcp.md", retrieved: "2026-07-30", conclusion: "The discontinued iFlow CLI exposes user-scope add-json/get/list/remove for existing legacy installations; vendor maintenance and service availability are not claimed.", kind: "first_party" },
    warp: { source: "https://docs.warp.dev/agent-platform/capabilities/mcp/", retrieved: "2026-07-30", conclusion: "Warp supports user-level ~/.warp/.mcp.json command servers and explicit /agent-add-mcp approval/readback.", kind: "first_party" },
    chatgpt: { source: "https://platform.openai.com/docs/mcp", retrieved: "2026-07-31", conclusion: "ChatGPT remote Apps require product-side Developer Mode, app creation, tool scanning, publication, and verification; SandBase CLI only prepares its owned credential and bridge.", kind: "first_party" },
    antigravity: { source: "B-082 feature design r1", retrieved: "2026-07-30", conclusion: "Prompt-assisted authorization prepares an isolated local bridge without guessing private client schema.", kind: "first_party" },
    trae: { source: "B-082 feature design r1", retrieved: "2026-07-30", conclusion: "Prompt-assisted authorization prepares an isolated local bridge without guessing private client schema.", kind: "first_party" },
    qoder: { source: "B-082 feature design r1", retrieved: "2026-07-30", conclusion: "Prompt-assisted authorization prepares an isolated local bridge without guessing private client schema.", kind: "first_party" },
    workbuddy: { source: "B-082 feature design r1", retrieved: "2026-07-30", conclusion: "Prompt-assisted authorization prepares an isolated local bridge without guessing private client schema.", kind: "first_party" },
    pi: { source: "B-082 feature design r1", retrieved: "2026-07-30", conclusion: "Prompt-assisted authorization prepares an isolated local bridge without guessing private client schema.", kind: "first_party" },
  };
  const implemented = true;
  const blocker = "This client batch has no completed installer and validator in the current iteration.";
  if (!implemented) return {
    evidence: { source: "docs/design/features/REQ-20260728-e4a8c1b9d2f0-all-agent-native-capabilities/design.md#2.1", retrieved: "2026-07-29", conclusion: blocker, kind: "internal_blocker" },
    installer: { mcp: "none", skill: "none" }, validator: { mcp: "none", skill: "none" }, implementation: "blocked", status: "failed", nextStep: blocker,
  };
  const hasSkill = capability.skillMode === "shared_skill" || capability.skillMode === "client_skill";
  const desktop = client === "claude-desktop" || client === "cowork";
  const skillInstaller: InstallerDescriptor["skill"] = !hasSkill ? "none" : desktop ? "confirmation" : client === "claude-code" || client === "hermes" ? "private" : "shared";
  const skillValidator: ValidatorDescriptor["skill"] = !hasSkill ? "none" : desktop || client === "cursor" || client === "claude-code" || client === "hermes" || client === "openclaw" ? "real_client_matrix" : "ownership_checksum";
  return {
    evidence: evidence[client]!, installer: { mcp: desktop || client === "chatgpt" ? "confirmation" : "adapter", skill: skillInstaller },
    validator: { mcp: client === "chatgpt" ? "confirmation" : "read_back", skill: skillValidator }, implementation: "implemented", status: "confirmation_required",
    nextStep: capability.guide,
  };
}
export const capabilityRegistry: Record<Client, CapabilityV2> = Object.fromEntries((Object.keys(clientProfiles) as Client[]).map(client => [client, v2(client, nativeCapabilities[client])])) as Record<Client, CapabilityV2>;

export function assertNativeCapabilities(): void {
  for (const client of Object.keys(clientProfiles) as Client[]) {
    const capability = nativeCapabilities[client];
    if (!capability || !capability.mcpMode || !capability.skillMode || !capability.invocation || !capability.verification || !capability.guide || !capability.uninstall || !capability.terminal) throw new Error(`Invalid native capability for ${client}`);
    const v2 = capabilityRegistry[client];
    if (!v2?.evidence.source || !v2.evidence.retrieved || !v2.evidence.conclusion || !v2.evidence.kind || !v2.installer || !v2.validator || !v2.implementation || !v2.status || !v2.nextStep) throw new Error(`Invalid capability v2 for ${client}`);
    if (v2.implementation === "blocked" && (v2.status !== "failed" || v2.installer.mcp !== "none" || v2.installer.skill !== "none" || v2.validator.mcp !== "none" || v2.validator.skill !== "none")) throw new Error(`Blocked capability must not be exposed as implemented for ${client}`);
    if (v2.implementation === "implemented" && v2.evidence.kind !== "first_party") throw new Error(`Implemented capability lacks first-party evidence for ${client}`);
    if (v2.status === "unsupported" || v2.status === "confirmation_required") { if (v2.status === "unsupported" && !v2.evidence.conclusion) throw new Error(`Unsupported capability lacks evidence for ${client}`); }
    if (v2.status === "confirmation_required" && v2.installer.mcp === "none" && v2.installer.skill === "none") throw new Error(`Confirmation cannot replace an installer for ${client}`);
  }
}
assertNativeCapabilities();

export function clientList(): string {
  return Object.keys(clientProfiles).join("|");
}
export function autoClients(): Client[] {
  return Object.values(clientProfiles).filter(profile => profile.mode === "auto" && !!profile.adapter && capabilityRegistry[profile.id].implementation === "implemented").map(profile => profile.id);
}
