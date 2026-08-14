import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isConfigured } from "./adapters/index.js";
import { atomicWrite, backup, readOptional, restore } from "./fs-safe.js";
import { clientProfiles, skillTiers, type SkillTier } from "./clients.js";
import { sandbaseHome } from "./paths.js";
import type { Client } from "./types.js";

const ownershipMarker = "<!-- sandbase-cli-managed: sandbase -->";
const sharedClients: Client[] = ["cursor", "codex"];
const privateClients: Client[] = ["claude-code", "hermes", "kiro"];
export type SkillState = "installed" | "missing" | "modified" | "fallback" | "unsupported";
export interface SkillInstallResult { state: "configured" | "already_configured" | "fallback" | "skipped"; message: string; path?: string; backup?: string; metadataPath?: string; metadataBackup?: string | undefined; changed: boolean; }
export interface SkillProbe { compatible: boolean; message: string; }
type Ownership = "missing" | "owned" | "ambiguous";

function sha256(content: string): string { return createHash("sha256").update(content, "utf8").digest("hex"); }
function sharedRoot(env = process.env): string { const home = env.HOME || sandbaseHome(env); return join(home, ".agents", "skills", "sandbase"); }
export function sharedSkillPath(env = process.env): string { return join(sharedRoot(env), "SKILL.md"); }
function metadataPath(env = process.env): string { return join(sharedRoot(env), ".sandbase-managed.json"); }
function privateRoot(client: Client, env = process.env): string | undefined {
  const home = env.HOME || sandbaseHome(env);
  if (client === "claude-code") return join(home, ".claude", "skills", "sandbase");
  if (client === "hermes") return join(env.HERMES_HOME || join(home, ".hermes"), "skills", "sandbase");
  if (client === "kiro") return join(home, ".kiro", "skills", "sandbase");
  return undefined;
}
function privateSkillPath(client: Client, env = process.env): string | undefined { const root = privateRoot(client, env); return root ? join(root, "SKILL.md") : undefined; }
function privateMetadataPath(client: Client, env = process.env): string | undefined { const root = privateRoot(client, env); return root ? join(root, ".sandbase-managed.json") : undefined; }
function legacySkillPath(client: Client, env = process.env): string | undefined {
  const home = env.HOME || sandbaseHome(env);
  if (client === "cursor") return join(home, ".cursor", "skills", "sandbase", "SKILL.md");
  if (client === "codex") return join(env.CODEX_HOME || join(home, ".codex"), "skills", "sandbase", "SKILL.md");
  return undefined;
}
export function skillPath(client: Client, env = process.env): string | undefined { return sharedClients.includes(client) ? sharedSkillPath(env) : privateSkillPath(client, env); }

export function skillFallback(client: Client): string {
  if (client === "claude-code") return `${clientProfiles[client].label} native SandBase Skill is not available yet. Use the configured SandBase MCP tools directly in chat.`;
  return "No native SandBase Skill is available for this client. Use the configured SandBase MCP tools directly.";
}
export function skillInvocation(client: Client): string { return `${clientProfiles[client].label} has a SandBase Skill artifact installed. Native discovery remains unverified until the real-client matrix is complete.`; }
function nativeTier(client: Client): boolean { return skillTiers[client] === "s3_promotion" || skillTiers[client] === "s1_slash"; }
function marked(content: string): boolean { return content.includes(ownershipMarker) && /^name:\s*sandbase\s*$/m.test(content); }
async function asset(relative = "../assets/skills/sandbase/SKILL.md"): Promise<string> {
  const bundled = fileURLToPath(new URL(relative, import.meta.url));
  try { return await readFile(bundled, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return readFile(join(process.cwd(), "assets", "skills", "sandbase", "SKILL.md"), "utf8"); }
}
async function sharedOwnership(env = process.env): Promise<Ownership> {
  const [skill, metadata] = await Promise.all([readOptional(sharedSkillPath(env)), readOptional(metadataPath(env))]);
  if (!skill && !metadata) return "missing";
  if (!skill || !metadata || !marked(skill)) return "ambiguous";
  try { const parsed = JSON.parse(metadata) as { owner?: string; sha256?: string }; return parsed.owner === "sandbase-cli" && parsed.sha256 === sha256(skill) ? "owned" : "ambiguous"; }
  catch { return "ambiguous"; }
}
async function privateOwnership(client: Client, env = process.env): Promise<Ownership> {
  const skill = privateSkillPath(client, env); const metadata = privateMetadataPath(client, env); if (!skill || !metadata) return "missing";
  const [content, meta] = await Promise.all([readOptional(skill), readOptional(metadata)]);
  if (!content && !meta) return "missing";
  if (!content || !meta || !marked(content)) return "ambiguous";
  try { const parsed = JSON.parse(meta) as { owner?: string; client?: string; sha256?: string }; return parsed.owner === "sandbase-cli" && parsed.client === client && parsed.sha256 === sha256(content) ? "owned" : "ambiguous"; }
  catch { return "ambiguous"; }
}
async function withLock<T>(env: NodeJS.ProcessEnv, work: () => Promise<T>): Promise<T> {
  const lock = join(dirname(sharedRoot(env)), ".sandbase-skill.lock"); await mkdir(dirname(lock), { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await mkdir(lock, { mode: 0o700 }); try { return await work(); } finally { await rm(lock, { recursive: true, force: true }); } }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; await new Promise(resolve => setTimeout(resolve, 20)); }
  }
  throw new Error("Another SandBase Skill installation is still running. Retry after it finishes.");
}
async function legacyCopies(env: NodeJS.ProcessEnv): Promise<Array<{ client: Client; path: string; content: string }>> {
  const copies: Array<{ client: Client; path: string; content: string }> = [];
  for (const client of ["cursor", "codex"] as Client[]) { const path = legacySkillPath(client, env)!; const content = await readOptional(path); if (content) copies.push({ client, path, content }); }
  return copies;
}
function verifiedLegacy(content: string): boolean { return marked(content); }
export async function sharedSkillReferences(env = process.env): Promise<Client[]> { const refs: Client[] = []; for (const client of sharedClients) if (await isConfigured(client, env)) refs.push(client); return refs; }

export async function probeSkill(client: Client, env = process.env): Promise<SkillProbe> {
  if (!nativeTier(client)) return { compatible: true, message: "No promotion probe is required." };
  try {
    if (privateClients.includes(client)) {
      if ((await privateOwnership(client, env)) === "ambiguous") return { compatible: false, message: `The ${clientProfiles[client].label} SandBase Skill ownership or checksum is invalid. It was left untouched; resolve it manually, then retry.` };
      return { compatible: true, message: `${clientProfiles[client].label} managed Skills root is available for installation.` };
    }
    if ((await sharedOwnership(env)) === "ambiguous") return { compatible: false, message: "The shared SandBase Skill ownership or checksum is invalid. It was left untouched; resolve it manually, then retry." };
    const copies = await legacyCopies(env); const unknown = copies.find(copy => !verifiedLegacy(copy.content));
    if (unknown) return { compatible: false, message: `An unmanaged legacy ${clientProfiles[unknown.client].label} SandBase Skill was left untouched. Resolve it manually, then retry.` };
    return { compatible: true, message: "Shared Agent Skills root is available for installation." };
  } catch { return { compatible: false, message: "The shared Agent Skills root is not readable. Check its local configuration and retry." }; }
}
export async function inspectSkill(client: Client, env = process.env): Promise<SkillState> {
  const tier: SkillTier = skillTiers[client]; if (tier === "s3_fallback") return "fallback"; if (tier === "s4_none") return "unsupported";
  if (privateClients.includes(client)) { const ownership = await privateOwnership(client, env); return ownership === "owned" ? "installed" : ownership === "missing" ? "missing" : "modified"; }
  const ownership = await sharedOwnership(env); return ownership === "owned" ? "installed" : ownership === "missing" ? "missing" : "modified";
}

export async function installSkill(client: Client, env = process.env): Promise<SkillInstallResult> {
  if (!nativeTier(client)) { const fallback = skillTiers[client] === "s3_fallback"; return { state: fallback ? "fallback" : "skipped", message: fallback ? skillFallback(client) : "No native SandBase Skill is available for this client.", changed: false }; }
  if (privateClients.includes(client)) return installPrivateSkill(client, env);
  return withLock(env, async () => {
    const probe = await probeSkill(client, env); if (!probe.compatible) throw new Error(probe.message);
    const desired = await asset(); const skillPath = sharedSkillPath(env); const metaPath = metadataPath(env); const metadata = JSON.stringify({ owner: "sandbase-cli", sha256: sha256(desired) }) + "\n";
    const current = await readOptional(skillPath); const copies = await legacyCopies(env); const needsWrite = current !== desired || await sharedOwnership(env) !== "owned";
    const skillBackup = await backup(skillPath); const metaBackup = await backup(metaPath); const legacyBackups = await Promise.all(copies.map(async copy => ({ ...copy, backup: await backup(copy.path) })));
    try {
      if (needsWrite) { await atomicWrite(skillPath, desired, 0o600); await atomicWrite(metaPath, metadata, 0o600); }
      if (await sharedOwnership(env) !== "owned") throw new Error("Shared native Skill verification failed");
      for (const copy of copies) await rm(copy.path);
    } catch (error) {
      await restore(skillPath, skillBackup); await restore(metaPath, metaBackup); await Promise.all(legacyBackups.map(copy => restore(copy.path, copy.backup))); throw error;
    }
    const changed = needsWrite || copies.length > 0;
    return skillBackup ? { state: changed ? "configured" : "already_configured", message: skillInvocation(client), path: skillPath, backup: skillBackup, metadataPath: metaPath, metadataBackup: metaBackup, changed } : { state: changed ? "configured" : "already_configured", message: skillInvocation(client), path: skillPath, metadataPath: metaPath, metadataBackup: metaBackup, changed };
  });
}
async function installPrivateSkill(client: Client, env: NodeJS.ProcessEnv): Promise<SkillInstallResult> {
  const path = privateSkillPath(client, env)!; const meta = privateMetadataPath(client, env)!;
  return withLock(env, async () => {
    const probe = await probeSkill(client, env); if (!probe.compatible) throw new Error(probe.message);
    const desired = await asset(); const desiredMeta = JSON.stringify({ owner: "sandbase-cli", client, sha256: sha256(desired) }) + "\n";
    const current = await readOptional(path); const needsWrite = current !== desired || await privateOwnership(client, env) !== "owned";
    const skillBackup = await backup(path); const metaBackup = await backup(meta);
    try { if (needsWrite) { await atomicWrite(path, desired, 0o600); await atomicWrite(meta, desiredMeta, 0o600); } if (await privateOwnership(client, env) !== "owned") throw new Error(`${clientProfiles[client].label} native Skill verification failed`); }
    catch (error) { await restore(path, skillBackup); await restore(meta, metaBackup); throw error; }
    const invocation = client === "claude-code" ? "/sandbase" : "the native Skill";
    const message = `${clientProfiles[client].label} managed SandBase Skill is installed; ${invocation} still requires real-client verification.`;
    return skillBackup ? { state: needsWrite ? "configured" : "already_configured", message, path, backup: skillBackup, metadataPath: meta, metadataBackup: metaBackup, changed: needsWrite } : { state: needsWrite ? "configured" : "already_configured", message, path, metadataPath: meta, metadataBackup: metaBackup, changed: needsWrite };
  });
}
export async function rollbackSkill(result: SkillInstallResult): Promise<void> { if (!result.changed || !result.path) return; await restore(result.path, result.backup); if (result.metadataPath) await restore(result.metadataPath, result.metadataBackup); }
export async function removeSkill(client: Client, env = process.env): Promise<boolean> {
  if (!nativeTier(client)) return false;
  if (privateClients.includes(client)) return removePrivateSkill(client, env);
  return withLock(env, async () => {
    if ((await sharedSkillReferences(env)).length) return false;
    const ownership = await sharedOwnership(env); if (ownership === "missing") return false;
    if (ownership !== "owned") throw new Error("The shared SandBase Skill ownership or checksum is invalid. It was left untouched; remove it manually if intended.");
    const skillPath = sharedSkillPath(env); const metaPath = metadataPath(env); const skillBackup = await backup(skillPath); const metaBackup = await backup(metaPath);
    try { await rm(skillPath); await rm(metaPath); } catch (error) { await restore(skillPath, skillBackup); await restore(metaPath, metaBackup); throw error; }
    return true;
  });
}
async function removePrivateSkill(client: Client, env: NodeJS.ProcessEnv): Promise<boolean> {
  const path = privateSkillPath(client, env)!; const meta = privateMetadataPath(client, env)!; const ownership = await privateOwnership(client, env); if (ownership === "missing") return false;
  if (ownership !== "owned") throw new Error(`The ${clientProfiles[client].label} SandBase Skill ownership or checksum is invalid. It was left untouched; remove it manually if intended.`);
  const skillBackup = await backup(path); const metaBackup = await backup(meta);
  try { await rm(path); await rm(meta); } catch (error) { await restore(path, skillBackup); await restore(meta, metaBackup); throw error; }
  return true;
}
