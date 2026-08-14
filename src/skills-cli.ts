import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Client } from "./types.js";

/** Immutable release identity approved for the native Skills CLI adapter. */
export const sandbaseSkillRelease = {
  repository: "https://github.com/sandbaseai/sandbase-skills",
  release: "v0.1.0",
  sourceArg: "https://github.com/sandbaseai/sandbase-skills/tree/v0.1.0",
  commit: "03bc2811987db610cd64cbddfaa79b08e46c0e2f",
  skillSha256: "583879aa39368577ebadd270434923969cbdeac0e0be73f5db0c2494019418da",
  minimumCliVersion: "1.5.20",
} as const;

export interface SkillsAgentRegistration { skillsAgentId: string; }

/** Only IDs verified by the release owner may be passed to the Skills CLI. */
export const skillsAgentRegistry: Partial<Record<Client, SkillsAgentRegistration>> = {
  "kiro-cli": { skillsAgentId: "kiro-cli" },
};

export type NativeSkillStatus = "installed" | "already_installed" | "removed" | "confirmation_required" | "failed";
export type NativeSkillFailure = "skill_source_unavailable" | "skills_cli_unavailable" | "unsupported_by_skills_cli" | "readback_failed";
export interface NativeSkillResult { status: NativeSkillStatus; code?: NativeSkillFailure; message: string; }
export interface NativeSkillRemovalPlan { agent?: string; owned: boolean; result: NativeSkillResult; }
export interface SkillsCommandResult { code: number | null; stdout: string; stderr: string; }
export type SkillsCommandRunner = (args: readonly string[]) => Promise<SkillsCommandResult>;
export type SkillsReadbackVerifier = (json: string, agent: string) => Promise<boolean>;

/** Immutable public identity of the ClawHub Skill adapter. */
export const openClawSandbaseSkill = {
  slug: "@joeliu926/sandbase",
  name: "sandbase",
  page: "https://clawhub.ai/joeliu926/skills/sandbase",
} as const;

export type OpenClawCommandRunner = (args: readonly string[]) => Promise<SkillsCommandResult>;
export type OpenClawReadbackVerifier = (json: string) => Promise<boolean>;
export type OpenClawMcpStatus = "configured" | "already_configured" | "missing" | "confirmation_required" | "failed" | "removed";
export interface OpenClawMcpResult { status: OpenClawMcpStatus; message: string; }

const openClawMcpName = "sandbase";
const openClawManagedEnvironment = { SANDBASE_CLI_MANAGED: "1" } as const;
type OpenClawMcpEntry = { command: string; args: string[]; env: Record<string, string> };

export const systemOpenClawRunner: OpenClawCommandRunner = async (args) => new Promise(resolve => {
  const child = spawn("openclaw", [...args], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  let settled = false;
  const finish = (result: SkillsCommandResult) => { if (settled) return; settled = true; clearTimeout(timeout); resolve(result); };
  // The OpenClaw CLI may initialize plugins before executing a local MCP or
  // Skill command. Give that supported command enough time, while still
  // treating a timeout as unavailable rather than as ownership proof.
  const timeout = setTimeout(() => { child.kill(); finish({ code: null, stdout: "", stderr: "" }); }, 45_000);
  child.stdout.on("data", data => { stdout += String(data); });
  child.stderr.on("data", data => { stderr += String(data); });
  child.on("error", () => finish({ code: null, stdout: "", stderr: "" }));
  child.on("close", code => finish({ code, stdout, stderr }));
});

/**
 * OpenClaw's documented JSON readback reports an installed workspace Skill's
 * name, loader source, and frontmatter homepage. Those three values are the
 * only supported evidence used here; paths and raw SKILL.md contents are not
 * considered ownership proof.
 */
export const verifyOpenClawSandbaseReadback: OpenClawReadbackVerifier = async (json) => {
  try {
    const entry = JSON.parse(json) as { name?: unknown; source?: unknown; homepage?: unknown };
    return entry.name === openClawSandbaseSkill.name
      && entry.source === "workspace"
      && entry.homepage === openClawSandbaseSkill.page;
  } catch { return false; }
};

function openClawUnavailable(): NativeSkillResult {
  return { status: "failed", code: "skills_cli_unavailable", message: "OpenClaw CLI is unavailable or does not support the required Skill readback; no SandBase Skill was changed." };
}

async function invokeOpenClaw(runner: OpenClawCommandRunner, args: readonly string[]): Promise<SkillsCommandResult | undefined> {
  try { return await runner(args); } catch { return undefined; }
}

function entryFrom(value: unknown): OpenClawMcpEntry | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const candidate = value as { command?: unknown; args?: unknown; env?: unknown };
  if (typeof candidate.command !== "string" || !Array.isArray(candidate.args) || !candidate.args.every(arg => typeof arg === "string")) return undefined;
  const env = candidate.env && typeof candidate.env === "object" && !Array.isArray(candidate.env)
    ? Object.fromEntries(Object.entries(candidate.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : {};
  return { command: candidate.command, args: [...candidate.args], env };
}

/** Accept only documented JSON envelopes emitted by `openclaw mcp show`. */
function readMcpEntry(json: string): OpenClawMcpEntry | undefined {
  try {
    const root = JSON.parse(json) as Record<string, unknown>;
    return entryFrom(root)
      || entryFrom((root.mcpServers as Record<string, unknown> | undefined)?.[openClawMcpName])
      || entryFrom((root.servers as Record<string, unknown> | undefined)?.[openClawMcpName])
      || entryFrom(((root.mcp as Record<string, unknown> | undefined)?.servers as Record<string, unknown> | undefined)?.[openClawMcpName]);
  } catch { return undefined; }
}

function isManagedMcpEntry(entry: OpenClawMcpEntry): boolean {
  return entry.command === "node"
    && entry.args.length === 3
    && entry.args[0]!.endsWith("sandbase-mcp-bridge.mjs")
    && entry.args[1] === "--client"
    && entry.args[2] === "openclaw"
    && entry.env.SANDBASE_CLI_MANAGED === "1";
}

function desiredMcpEntry(bridgePath: string): OpenClawMcpEntry {
  return { command: "node", args: [bridgePath, "--client", "openclaw"], env: { ...openClawManagedEnvironment } };
}

function sameMcpEntry(left: OpenClawMcpEntry, right: OpenClawMcpEntry): boolean {
  return left.command === right.command
    && JSON.stringify(left.args) === JSON.stringify(right.args)
    && JSON.stringify(left.env) === JSON.stringify(right.env);
}

async function showOpenClawMcp(runner: OpenClawCommandRunner): Promise<{ entry?: OpenClawMcpEntry; missing: boolean; unavailable: boolean }> {
  const response = await invokeOpenClaw(runner, ["mcp", "show", openClawMcpName, "--json"]);
  if (!response || response.code === null) return { missing: false, unavailable: true };
  if (response.code !== 0) return { missing: response.code === 1, unavailable: response.code !== 1 };
  const entry = readMcpEntry(response.stdout);
  return entry ? { entry, missing: false, unavailable: false } : { missing: false, unavailable: true };
}

/** Read only the managed OpenClaw MCP entry; malformed or foreign entries fail closed. */
export async function inspectOpenClawMcp(runner: OpenClawCommandRunner = systemOpenClawRunner): Promise<OpenClawMcpResult> {
  const readback = await showOpenClawMcp(runner);
  if (readback.missing) return { status: "missing", message: "OpenClaw has no MCP server named sandbase." };
  if (readback.unavailable || !readback.entry) return { status: "failed", message: "OpenClaw CLI is unavailable or could not read back the sandbase MCP server." };
  return isManagedMcpEntry(readback.entry)
    ? { status: "already_configured", message: "OpenClaw read back the managed SandBase MCP bridge." }
    : { status: "confirmation_required", message: "An existing non-SandBase OpenClaw MCP server named sandbase was left untouched." };
}

async function setOpenClawMcp(runner: OpenClawCommandRunner, entry: OpenClawMcpEntry): Promise<boolean> {
  const result = await invokeOpenClaw(runner, ["mcp", "set", openClawMcpName, JSON.stringify(entry)]);
  return !!result && result.code === 0;
}

async function unsetOpenClawMcp(runner: OpenClawCommandRunner): Promise<boolean> {
  const result = await invokeOpenClaw(runner, ["mcp", "unset", openClawMcpName]);
  return !!result && result.code === 0;
}

async function rollbackOpenClawMcp(runner: OpenClawCommandRunner, previous?: OpenClawMcpEntry): Promise<void> {
  if (previous) await setOpenClawMcp(runner, previous);
  else await unsetOpenClawMcp(runner);
}

/**
 * Configure the documented OpenClaw MCP registry. The credential deliberately
 * remains in SandBase's restricted local store and is never included in this
 * JSON value or passed to OpenClaw.
 */
export async function installOpenClawMcp(bridgePath: string, runner: OpenClawCommandRunner = systemOpenClawRunner): Promise<OpenClawMcpResult> {
  const previous = await showOpenClawMcp(runner);
  if (previous.unavailable) return { status: "failed", message: "OpenClaw CLI is unavailable or does not support MCP readback; no MCP server was changed." };
  if (previous.entry && !isManagedMcpEntry(previous.entry)) return { status: "confirmation_required", message: "An existing non-SandBase OpenClaw MCP server named sandbase was left untouched." };
  const desired = desiredMcpEntry(bridgePath);
  if (previous.entry && sameMcpEntry(previous.entry, desired)) return { status: "already_configured", message: "OpenClaw already has the managed SandBase MCP bridge." };
  if (!(await setOpenClawMcp(runner, desired))) return { status: "failed", message: "OpenClaw could not register the SandBase MCP server; no success was reported." };
  const readback = await showOpenClawMcp(runner);
  if (!readback.entry || readback.unavailable || !isManagedMcpEntry(readback.entry) || !sameMcpEntry(readback.entry, desired)) {
    await rollbackOpenClawMcp(runner, previous.entry).catch(() => undefined);
    return { status: "failed", message: "OpenClaw could not verify the managed SandBase MCP bridge; the prior MCP state was restored." };
  }
  return { status: "configured", message: "OpenClaw registered and read back the managed SandBase MCP bridge." };
}

/** Remove only the exact managed entry, then prove that it is absent. */
export async function removeOpenClawMcp(runner: OpenClawCommandRunner = systemOpenClawRunner): Promise<OpenClawMcpResult> {
  const before = await showOpenClawMcp(runner);
  if (before.missing) return { status: "missing", message: "OpenClaw has no SandBase MCP server to remove." };
  if (before.unavailable || !before.entry) return { status: "failed", message: "OpenClaw CLI is unavailable or could not read back the SandBase MCP server; nothing was removed." };
  if (!isManagedMcpEntry(before.entry)) return { status: "confirmation_required", message: "OpenClaw MCP ownership could not be proven; the existing sandbase server was left untouched." };
  if (!(await unsetOpenClawMcp(runner))) return { status: "failed", message: "OpenClaw could not remove the managed SandBase MCP server." };
  const after = await showOpenClawMcp(runner);
  if (!after.missing) return { status: "failed", message: "OpenClaw could not verify SandBase MCP removal; no removal success was reported." };
  return { status: "removed", message: "OpenClaw removal of the managed SandBase MCP bridge was verified." };
}

async function inspectOpenClawSkillWith(
  runner: OpenClawCommandRunner,
  verify: OpenClawReadbackVerifier,
): Promise<NativeSkillResult> {
  const readback = await invokeOpenClaw(runner, ["skills", "info", openClawSandbaseSkill.name, "--json"]);
  if (!readback || readback.code !== 0) return openClawUnavailable();
  return await verify(readback.stdout)
    ? { status: "already_installed", message: "OpenClaw reports the exact SandBase ClawHub Skill identity." }
    : { status: "confirmation_required", message: "OpenClaw cannot prove the exact SandBase ClawHub Skill identity." };
}

export async function installOpenClawSkill(
  runner: OpenClawCommandRunner = systemOpenClawRunner,
  verify: OpenClawReadbackVerifier = verifyOpenClawSandbaseReadback,
): Promise<NativeSkillResult> {
  const before = await inspectOpenClawSkillWith(runner, verify);
  if (before.status === "already_installed") return before;
  if (before.status === "failed") return before;
  const installed = await invokeOpenClaw(runner, ["skills", "install", openClawSandbaseSkill.slug]);
  if (!installed || installed.code !== 0) return openClawUnavailable();
  const readback = await inspectOpenClawSkillWith(runner, verify);
  if (readback.status !== "already_installed") return { status: "failed", code: "readback_failed", message: "OpenClaw could not prove the exact SandBase ClawHub Skill identity; no success was reported." };
  return { status: "installed", message: "OpenClaw installed and read back the exact SandBase ClawHub Skill identity." };
}

export async function inspectOpenClawSkill(
  runner: OpenClawCommandRunner = systemOpenClawRunner,
  verify: OpenClawReadbackVerifier = verifyOpenClawSandbaseReadback,
): Promise<NativeSkillResult> {
  return inspectOpenClawSkillWith(runner, verify);
}

export async function removeOpenClawSkill(
  runner: OpenClawCommandRunner = systemOpenClawRunner,
  verify: OpenClawReadbackVerifier = verifyOpenClawSandbaseReadback,
): Promise<NativeSkillResult> {
  const existing = await inspectOpenClawSkillWith(runner, verify);
  if (existing.status !== "already_installed") return existing.status === "failed" ? existing : { status: "confirmation_required", message: "OpenClaw cannot prove SandBase Skill ownership; no Skill was removed." };
  // OpenClaw 2026.4.12 documents no `skills remove`/`uninstall` subcommand.
  // Do not delete the workspace directory or infer a removal path ourselves.
  return { status: "confirmation_required", message: "This OpenClaw version has no supported Skill removal command; the verified SandBase Skill was left unchanged." };
}

function versionAtLeast(actual: string, minimum: string): boolean {
  const parse = (value: string) => value.match(/\b(\d+)\.(\d+)\.(\d+)\b/)?.slice(1).map(Number);
  const a = parse(actual); const b = parse(minimum);
  if (!a || !b) return false;
  for (let index = 0; index < 3; index++) { if (a[index] !== b[index]) return a[index]! > b[index]!; }
  return true;
}

/** Reject every mutable or incomplete source tuple before starting any child process. */
export function validateSandbaseSkillRelease(release: typeof sandbaseSkillRelease = sandbaseSkillRelease): boolean {
  return release.repository === "https://github.com/sandbaseai/sandbase-skills"
    && release.release === "v0.1.0"
    && release.sourceArg === "https://github.com/sandbaseai/sandbase-skills/tree/v0.1.0"
    && release.commit === "03bc2811987db610cd64cbddfaa79b08e46c0e2f"
    && release.skillSha256 === "583879aa39368577ebadd270434923969cbdeac0e0be73f5db0c2494019418da"
    && release.minimumCliVersion === "1.5.20";
}

export const systemSkillsRunner: SkillsCommandRunner = async (args) => new Promise(resolve => {
  const child = spawn("npx", ["-y", "skills", ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  child.stdout.on("data", data => { stdout += String(data); });
  child.stderr.on("data", data => { stderr += String(data); });
  child.on("error", () => resolve({ code: null, stdout: "", stderr: "" }));
  child.on("close", code => resolve({ code, stdout, stderr }));
});

function unavailable(): NativeSkillResult { return { status: "failed", code: "skills_cli_unavailable", message: "Skills CLI is unavailable or below the required version; no native Skill was changed." }; }
function sourceUnavailable(): NativeSkillResult { return { status: "failed", code: "skill_source_unavailable", message: "The verified SandBase Skill source is unavailable; no native Skill was changed." }; }
// The first-party listing must echo the exact immutable selector. A repository
// name or a tag alone could refer to a different source and is not ownership proof.
export const verifySkillsReadback: SkillsReadbackVerifier = async (output, agent) => {
  try {
    const entries = JSON.parse(output) as unknown;
    const candidates: Array<{ sourceUrl?: unknown; agents?: unknown; path?: unknown }> = [];
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== "object") return;
      const item = value as { sourceUrl?: unknown; agents?: unknown; path?: unknown };
      if ("sourceUrl" in item || "agents" in item || "path" in item) candidates.push(item);
      Object.values(item).forEach(visit);
    };
    visit(entries);
    const agentLabel = agent === "kiro-cli" ? "Kiro CLI" : "";
    for (const candidate of candidates) {
      if (candidate.sourceUrl !== `${sandbaseSkillRelease.repository}.git` || typeof candidate.path !== "string" || !JSON.stringify(candidate.agents).includes(agentLabel)) continue;
      const skill = await readFile(join(candidate.path, "SKILL.md"), "utf8");
      if (createHash("sha256").update(skill, "utf8").digest("hex") === sandbaseSkillRelease.skillSha256) return true;
    }
  } catch { /* malformed/unreadable first-party readback is not proof */ }
  return false;
};

async function invoke(runner: SkillsCommandRunner, args: readonly string[]): Promise<SkillsCommandResult | undefined> {
  try { return await runner(args); } catch { return undefined; }
}

async function probe(client: Client, runner: SkillsCommandRunner): Promise<{ agent: string; listed: SkillsCommandResult } | NativeSkillResult> {
  if (!validateSandbaseSkillRelease()) return sourceUnavailable();
  const registration = skillsAgentRegistry[client];
  if (!registration) return { status: "failed", code: "unsupported_by_skills_cli", message: `No verified Skills CLI agent mapping exists for ${client}; no native Skill was changed.` };
  const version = await invoke(runner, ["--version"]);
  if (!version || version.code !== 0 || !versionAtLeast(`${version.stdout}\n${version.stderr}`, sandbaseSkillRelease.minimumCliVersion)) return unavailable();
  // `skills add <source> --agent <id> --list` is the documented capability
  // probe. It must succeed before an install or lifecycle command is attempted.
  const listed = await invoke(runner, ["add", sandbaseSkillRelease.sourceArg, "--agent", registration.skillsAgentId, "--list"]);
  if (!listed || listed.code !== 0) return unavailable();
  return { agent: registration.skillsAgentId, listed };
}

export async function installNativeSkill(client: Client, runner: SkillsCommandRunner = systemSkillsRunner, verify: SkillsReadbackVerifier = verifySkillsReadback): Promise<NativeSkillResult> {
  const checked = await probe(client, runner); if ("status" in checked) return checked;
  const before = await invoke(runner, ["list", "-g", "-a", checked.agent, "--json"]);
  if (!before || before.code !== 0) return unavailable();
  if (await verify(before.stdout, checked.agent)) return { status: "already_installed", message: "Native SandBase Skill is already installed and verified by Skills CLI readback." };
  const added = await invoke(runner, ["add", sandbaseSkillRelease.sourceArg, "-g", "-a", checked.agent]);
  if (!added || added.code !== 0) return unavailable();
  const readback = await invoke(runner, ["list", "-g", "-a", checked.agent, "--json"]);
  if (!readback || readback.code !== 0 || !(await verify(readback.stdout, checked.agent))) return { status: "failed", code: "readback_failed", message: "Skills CLI could not prove the SandBase source for this agent; no success was reported." };
  return { status: "installed", message: "Native SandBase Skill was installed and verified by Skills CLI readback." };
}

export async function inspectNativeSkill(client: Client, runner: SkillsCommandRunner = systemSkillsRunner, verify: SkillsReadbackVerifier = verifySkillsReadback): Promise<NativeSkillResult> {
  const checked = await probe(client, runner); if ("status" in checked) return checked;
  const readback = await invoke(runner, ["list", "-g", "-a", checked.agent, "--json"]);
  if (!readback || readback.code !== 0) return unavailable();
  return await verify(readback.stdout, checked.agent)
    ? { status: "already_installed", message: "Native SandBase Skill ownership is verified by Skills CLI readback." }
    : { status: "confirmation_required", message: "Native SandBase Skill is not listed for this agent." };
}

export async function planNativeSkillRemoval(client: Client, runner: SkillsCommandRunner = systemSkillsRunner, verify: SkillsReadbackVerifier = verifySkillsReadback): Promise<NativeSkillRemovalPlan> {
  const checked = await probe(client, runner); if ("status" in checked) return { owned: false, result: checked };
  const before = await invoke(runner, ["list", "-g", "-a", checked.agent, "--json"]);
  if (!before || before.code !== 0) return { owned: false, result: unavailable() };
  if (!(await verify(before.stdout, checked.agent))) return { agent: checked.agent, owned: false, result: { status: "confirmation_required", message: "Skills CLI cannot prove SandBase ownership for this agent; no native Skill was removed." } };
  return { agent: checked.agent, owned: true, result: { status: "already_installed", message: "Native SandBase Skill ownership is verified by Skills CLI readback." } };
}

export async function executeNativeSkillRemoval(plan: NativeSkillRemovalPlan, runner: SkillsCommandRunner = systemSkillsRunner, verify: SkillsReadbackVerifier = verifySkillsReadback): Promise<NativeSkillResult> {
  if (!plan.owned || !plan.agent) return plan.result;
  // Skills CLI removes by its first-party Skill name, never by a URL. This is
  // reached only after source, agent and digest ownership have been proven.
  const removed = await invoke(runner, ["remove", "sandbase", "-g", "-a", plan.agent]);
  if (!removed || removed.code !== 0) return unavailable();
  const readback = await invoke(runner, ["list", "-g", "-a", plan.agent, "--json"]);
  if (!readback || readback.code !== 0 || await verify(readback.stdout, plan.agent)) return { status: "failed", code: "readback_failed", message: "Skills CLI could not prove native Skill removal; no removal success was reported." };
  return { status: "removed", message: "Native SandBase Skill removal was verified by Skills CLI readback." };
}

export async function removeNativeSkill(client: Client, runner: SkillsCommandRunner = systemSkillsRunner, verify: SkillsReadbackVerifier = verifySkillsReadback): Promise<NativeSkillResult> {
  return executeNativeSkillRemoval(await planNativeSkillRemoval(client, runner, verify), runner, verify);
}
