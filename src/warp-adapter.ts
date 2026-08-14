import { dirname, isAbsolute, join, parse } from "node:path";
import { rm } from "node:fs/promises";
import { atomicWrite, backup, readOptional, restore } from "./fs-safe.js";
import { configPath, sandbaseHome } from "./paths.js";

export type WarpInspectionState = "missing" | "configured" | "confirmation_required" | "conflict" | "invalid";
export interface WarpInspection { state: WarpInspectionState; detail: string; }
export interface WarpAdapterResult { path: string; changed: boolean; backup?: string; identityPath: string; identityChanged: boolean; identityPrevious?: string; }
export interface WarpUnregisterSnapshot { path: string; config: string; identityPath: string; identity: string; }

const marker = "sandbase-cli-warp-v1";
const identityPath = (env = process.env) => join(sandbaseHome(env), "adapters", "warp.json");

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}
function parseRoot(raw: string, label: string): Record<string, unknown> { return object(JSON.parse(raw) as unknown, label); }
function expected(bridge: string): Record<string, unknown> { return { command: "node", args: [bridge, "--client", "warp"] }; }
function owned(value: unknown, bridge: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as { command?: unknown; args?: unknown };
  return entry.command === "node" && Array.isArray(entry.args) && entry.args.length === 3 && entry.args[0] === bridge && entry.args[1] === "--client" && entry.args[2] === "warp";
}
async function identity(env = process.env): Promise<{ bridge: string } | undefined> {
  const raw = await readOptional(identityPath(env)); if (raw === undefined) return undefined;
  try { const value = parseRoot(raw, "Warp identity"); return value.marker === marker && value.client === "warp" && typeof value.bridge === "string" && isAbsolute(value.bridge) ? { bridge: value.bridge } : undefined; }
  catch { return undefined; }
}
function parentDirectories(start: string): string[] {
  const result: string[] = []; let current = start;
  for (;;) { result.push(current); const parent = dirname(current); if (parent === current) return result; current = parent; }
}
export async function findWarpProjectOverride(env = process.env): Promise<string | undefined> {
  const cwd = env.PWD || process.cwd(), globalPath = configPath("warp", env);
  for (const directory of parentDirectories(cwd)) {
    const path = join(directory, ".warp", ".mcp.json"); const raw = await readOptional(path); if (raw === undefined) continue;
    if (path === globalPath) continue;
    const root = parseRoot(raw, "Warp project configuration");
    const servers = root.mcpServers === undefined ? {} : object(root.mcpServers, "Warp project mcpServers");
    if (servers.sandbase !== undefined) return path;
  }
  return undefined;
}
export async function inspectWarp(env = process.env, expectedBridge?: string): Promise<WarpInspection> {
  try {
    const override = await findWarpProjectOverride(env);
    if (override) return { state: "confirmation_required", detail: `higher-priority project SandBase entry at ${override} was left untouched` };
    const raw = await readOptional(configPath("warp", env)); if (raw === undefined) return { state: "missing", detail: "Warp user configuration is missing" };
    const root = parseRoot(raw, "Warp user configuration"); const servers = root.mcpServers === undefined ? {} : object(root.mcpServers, "Warp user mcpServers");
    if (servers.sandbase === undefined) return { state: "missing", detail: "SandBase is not registered in the Warp user configuration" };
    const id = await identity(env); const bridge = expectedBridge || id?.bridge;
    if (!bridge || !owned(servers.sandbase, bridge)) return { state: "conflict", detail: "the sandbase entry is not SandBase-owned" };
    return { state: "configured", detail: "user configuration ownership verified; approve with /agent-add-mcp and read back tools in Warp" };
  } catch (error) { return { state: "invalid", detail: error instanceof Error ? error.message : "Warp configuration is invalid" }; }
}
export async function installWarp(bridge: string, env = process.env): Promise<WarpAdapterResult> {
  if (!isAbsolute(bridge)) throw new Error("warp: managed bridge path must be absolute; no changes were made");
  const before = await inspectWarp(env, bridge);
  if (["confirmation_required", "conflict", "invalid"].includes(before.state)) throw new Error(`warp: ${before.detail}; no changes were made`);
  const path = configPath("warp", env), raw = await readOptional(path), text = raw === undefined || !raw.trim() ? "{}\n" : raw;
  const root = parseRoot(text, "Warp user configuration"), servers = root.mcpServers === undefined ? {} : object(root.mcpServers, "Warp user mcpServers");
  const nextEntry = expected(bridge), nextIdentity = JSON.stringify({ marker, client: "warp", bridge }, null, 2) + "\n", idPath = identityPath(env), oldIdentity = await readOptional(idPath);
  const changed = !owned(servers.sandbase, bridge), identityChanged = oldIdentity !== nextIdentity;
  const result: WarpAdapterResult = { path, changed, identityPath: idPath, identityChanged, ...(oldIdentity === undefined ? {} : { identityPrevious: oldIdentity }) };
  try {
    if (identityChanged) await atomicWrite(idPath, nextIdentity);
    if (changed) { servers.sandbase = nextEntry; root.mcpServers = servers; const backupPath = await backup(path); if (backupPath !== undefined) result.backup = backupPath; await atomicWrite(path, JSON.stringify(root, null, 2) + "\n"); }
    const after = await inspectWarp(env, bridge); if (after.state !== "configured") throw new Error(`Warp readback failed: ${after.detail}`);
    return result;
  } catch (error) { await rollbackWarp(result); throw error; }
}
export async function rollbackWarp(result: WarpAdapterResult): Promise<void> {
  const operations: Promise<unknown>[] = [];
  if (result.changed) operations.push(restore(result.path, result.backup));
  if (result.identityChanged) operations.push(result.identityPrevious === undefined ? rm(result.identityPath, { force: true }) : atomicWrite(result.identityPath, result.identityPrevious));
  const settled = await Promise.allSettled(operations); if (settled.some(item => item.status === "rejected")) throw new Error("Warp rollback was incomplete");
}
export async function snapshotWarpUnregister(env = process.env): Promise<WarpUnregisterSnapshot | undefined> {
  const inspection = await inspectWarp(env); if (inspection.state === "missing") return undefined;
  if (inspection.state !== "configured") throw new Error(`warp: ${inspection.detail}; no changes were made`);
  const [config, identityRaw] = await Promise.all([readOptional(configPath("warp", env)), readOptional(identityPath(env))]);
  if (config === undefined || identityRaw === undefined) throw new Error("warp: managed ownership state is incomplete; no changes were made");
  return { path: configPath("warp", env), config, identityPath: identityPath(env), identity: identityRaw };
}
export async function restoreWarpUnregister(snapshot: WarpUnregisterSnapshot): Promise<void> { await Promise.all([atomicWrite(snapshot.path, snapshot.config), atomicWrite(snapshot.identityPath, snapshot.identity)]); }
export async function unregisterWarp(env = process.env): Promise<boolean> {
  const snapshot = await snapshotWarpUnregister(env); if (!snapshot) return false;
  try {
    const root = parseRoot(snapshot.config, "Warp user configuration"), servers = object(root.mcpServers, "Warp user mcpServers"); delete servers.sandbase; root.mcpServers = servers;
    await atomicWrite(snapshot.path, JSON.stringify(root, null, 2) + "\n"); await rm(snapshot.identityPath, { force: true });
    const after = await inspectWarp(env); if (after.state !== "missing") throw new Error(`Warp removal readback failed: ${after.detail}`); return true;
  } catch (error) { await restoreWarpUnregister(snapshot); throw error; }
}
