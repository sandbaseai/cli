import { spawnSync } from "node:child_process";
import { chmod, mkdir, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser";
import { atomicWrite, backup, readOptional, restore } from "./fs-safe.js";
import { configPath, sandbaseHome } from "./paths.js";

export const a1Clients = ["opencode", "qwen-code", "windsurf"] as const;
export type A1Client = typeof a1Clients[number];
export function isA1Client(client: string): client is A1Client { return a1Clients.includes(client as A1Client); }

export interface A1CommandResult { code: number | null; stdout: string; stderr: string }
export type A1CommandRunner = (client: Extract<A1Client, "opencode" | "qwen-code">, args: readonly string[]) => Promise<A1CommandResult>;
export interface A1AdapterResult { path: string; backup?: string; changed: boolean; credentialPath?: string; credentialBackup?: string; credentialChanged?: boolean; identityPath?: string; identityPrevious?: string; identityChanged?: boolean }
export type A1Inspection = { state: "configured" | "missing" | "conflict" | "invalid"; detail: string };
export interface A1UnregisterSnapshot { client: A1Client; path: string; config: string; identityPath: string; identity?: string; credentialPath?: string; credential?: string }

const executable: Record<Extract<A1Client, "opencode" | "qwen-code">, string> = { opencode: "opencode2", "qwen-code": "qwen" };
export const defaultA1Runner: A1CommandRunner = async (client, args) => {
  const result = spawnSync(executable[client], [...args], { encoding: "utf8", timeout: 10_000 });
  return { code: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
};

function parseObject(raw: string, label: string): Record<string, unknown> {
  const errors: ParseError[] = [];
  const value = parse(raw, errors, { allowTrailingComma: true, disallowComments: false }) as unknown;
  if (errors.length || !value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} configuration is invalid; no changes were made`);
  return value as Record<string, unknown>;
}
function objectMap(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} configuration is invalid; no changes were made`);
  return value as Record<string, unknown>;
}
type A1Identity = { marker: "sandbase-cli-a1-v1"; client: A1Client; bridge?: string; endpoint?: string };
function identityPath(client: A1Client, env = process.env): string { return join(sandbaseHome(env), "ownership", `${client}.json`); }
async function readIdentity(client: A1Client, env = process.env): Promise<A1Identity | undefined> {
  const raw = await readOptional(identityPath(client, env)); if (raw === undefined) return undefined;
  try { const value = JSON.parse(raw) as A1Identity; if (value.marker !== "sandbase-cli-a1-v1" || value.client !== client || (value.bridge !== undefined && !isAbsolute(value.bridge))) throw new Error(); return value; }
  catch { throw new Error(`${client} SandBase ownership identity is invalid; no changes were made`); }
}
function defaultBridge(env = process.env): string { return join(sandbaseHome(env), "bin", "sandbase-mcp-bridge.mjs"); }
function bridgeCommand(value: unknown, client: A1Client, allowedPaths: readonly string[]): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as { type?: unknown; command?: unknown; args?: unknown };
  const command = Array.isArray(entry.command) ? entry.command : entry.command === "node" && Array.isArray(entry.args) ? [entry.command, ...entry.args] : undefined;
  return !!command && command.length === 4 && command[0] === "node" && typeof command[1] === "string" && isAbsolute(command[1]) && allowedPaths.includes(command[1]) && command[2] === "--client" && command[3] === client;
}
function openCodeOwned(value: unknown, allowedPaths: readonly string[]): boolean { return bridgeCommand(value, "opencode", allowedPaths) && (value as { type?: unknown }).type === "local"; }
function qwenOwned(value: unknown, allowedPaths: readonly string[]): boolean { return bridgeCommand(value, "qwen-code", allowedPaths); }
function credentialPath(env = process.env): string { return join(sandbaseHome(env), "credentials", "windsurf.token"); }
function windsurfAuthorization(env = process.env): string { return `Bearer \${file:${credentialPath(env)}}`; }
function controlledEndpoint(value: string): boolean { try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname.replace(/\/$/, "") === "/v1/mcp"; } catch { return false; } }
function windsurfOwned(value: unknown, allowedEndpoints: readonly string[], env = process.env): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as { serverUrl?: unknown; headers?: unknown };
  if (typeof entry.serverUrl !== "string" || !controlledEndpoint(entry.serverUrl) || !allowedEndpoints.includes(entry.serverUrl.replace(/\/$/, ""))) return false;
  const headers = entry.headers;
  return !!headers && typeof headers === "object" && !Array.isArray(headers) && (headers as Record<string, unknown>).Authorization === windsurfAuthorization(env);
}
function applyJsonc(raw: string, path: (string | number)[], value: unknown): string {
  return applyEdits(raw, modify(raw, path, value, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" } }));
}
function initial(raw: string | undefined): string { return raw === undefined || !raw.trim() ? "{}\n" : raw; }
async function restoreSnapshot(path: string, backupPath?: string): Promise<void> { await restore(path, backupPath); }

async function inspectConfig(client: A1Client, env = process.env, expectedBridge?: string, expectedEndpoint?: string): Promise<A1Inspection> {
  const path = configPath(client, env); const raw = await readOptional(path); if (raw === undefined) return { state: "missing", detail: "configuration is missing" };
  try {
    const identity = await readIdentity(client, env); const root = parseObject(raw, client);
    const bridges = [...new Set([defaultBridge(env), identity?.bridge, expectedBridge].filter((value): value is string => !!value))];
    if (client === "opencode") {
      const mcp = root.mcp === undefined ? undefined : objectMap(root.mcp, client); const servers = mcp?.servers === undefined ? undefined : objectMap(mcp.servers, client); const entry = servers?.sandbase;
      return entry === undefined ? { state: "missing", detail: "SandBase is not registered" } : openCodeOwned(entry, bridges) ? { state: "configured", detail: "global configuration ownership verified" } : { state: "conflict", detail: "the sandbase entry is not SandBase-owned" };
    }
    const servers = root.mcpServers === undefined ? undefined : objectMap(root.mcpServers, client); const entry = servers?.sandbase;
    const endpoints = [...new Set(["https://sandbase.ai/v1/mcp", identity?.endpoint?.replace(/\/$/, ""), expectedEndpoint?.replace(/\/$/, "")].filter((value): value is string => !!value))];
    const owned = client === "qwen-code" ? qwenOwned(entry, bridges) : windsurfOwned(entry, endpoints, env);
    if (entry === undefined) return { state: "missing", detail: "SandBase is not registered" };
    if (!owned) return { state: "conflict", detail: "the sandbase entry is not SandBase-owned" };
    if (client === "windsurf") {
      try { const info = await stat(credentialPath(env)); if ((info.mode & 0o077) !== 0) return { state: "invalid", detail: "credential reference permissions are unsafe" }; }
      catch { return { state: "invalid", detail: "credential reference is missing" }; }
    }
    return { state: "configured", detail: client === "qwen-code" ? "user settings ownership verified; confirm tools in /mcp" : "remote configuration ownership verified" };
  } catch (error) { return { state: "invalid", detail: error instanceof Error ? error.message : `${client} configuration is invalid` }; }
}

export async function inspectA1(client: A1Client, env = process.env, runner: A1CommandRunner = defaultA1Runner): Promise<A1Inspection> {
  const state = await inspectConfig(client, env); if (state.state !== "configured" || client !== "opencode") return state;
  const listed = await runner("opencode", ["mcp", "list"]);
  return listed.code === 0 && /(^|\W)sandbase(\W|$)/i.test(`${listed.stdout}\n${listed.stderr}`) ? state : { state: "invalid", detail: "opencode2 mcp list did not read back SandBase" };
}

async function assertQwenCapability(runner: A1CommandRunner): Promise<void> {
  const add = await runner("qwen-code", ["mcp", "add", "--help"]); const remove = await runner("qwen-code", ["mcp", "remove", "--help"]);
  if (add.code !== 0 || remove.code !== 0 || !/--scope/.test(`${add.stdout}${add.stderr}`) || !/--scope/.test(`${remove.stdout}${remove.stderr}`)) throw new Error("Qwen Code does not expose user-scope MCP add/remove capability; no changes were made");
}

export async function installA1(client: A1Client, bridge: string, credential: string, mcpUrl: string, env = process.env, runner: A1CommandRunner = defaultA1Runner): Promise<A1AdapterResult> {
  const path = configPath(client, env); const raw = await readOptional(path); const text = initial(raw);
  if ((client === "opencode" || client === "qwen-code") && !isAbsolute(bridge)) throw new Error(`${client}: managed bridge path must be absolute; no changes were made`);
  if (client === "windsurf" && !controlledEndpoint(mcpUrl)) throw new Error("windsurf: MCP endpoint is not controlled; no changes were made");
  const before = await inspectConfig(client, env, bridge, mcpUrl); if (before.state === "conflict" || before.state === "invalid") throw new Error(`${client}: ${before.detail}; no changes were made`);
  const ownerPath = identityPath(client, env); const identityPrevious = await readOptional(ownerPath); const identity: A1Identity = client === "windsurf" ? { marker: "sandbase-cli-a1-v1", client, endpoint: mcpUrl.replace(/\/$/, "") } : { marker: "sandbase-cli-a1-v1", client, bridge };
  const identityNext = JSON.stringify(identity, null, 2) + "\n"; const identityChanged = identityPrevious !== identityNext;
  const writeIdentity = async () => { if (identityChanged) await atomicWrite(ownerPath, identityNext); };
  const identityResult = { identityPath: ownerPath, ...(identityPrevious === undefined ? {} : { identityPrevious }), identityChanged };
  if (client === "qwen-code") {
    await assertQwenCapability(runner);
    if (before.state === "configured") { await writeIdentity(); return { path, changed: false, ...identityResult }; }
    const backupPath = await backup(path);
    const args = ["mcp", "add", "--scope", "user", "--transport", "stdio", "sandbase", "node", bridge, "--client", "qwen-code"] as const;
    try {
      await writeIdentity(); const added = await runner("qwen-code", args); if (added.code !== 0) throw new Error("qwen mcp add failed");
      const after = await inspectConfig(client, env); if (after.state !== "configured") throw new Error("Qwen user settings readback did not match the managed bridge");
      return backupPath ? { path, backup: backupPath, changed: true, ...identityResult } : { path, changed: true, ...identityResult };
    } catch (error) { await restoreSnapshot(path, backupPath); if (identityChanged) identityPrevious === undefined ? await rm(ownerPath, { force: true }) : await atomicWrite(ownerPath, identityPrevious); throw error; }
  }
  if (client === "opencode") {
    const probe = await runner("opencode", ["mcp", "list"]); if (probe.code !== 0) throw new Error("OpenCode global MCP capability is unavailable; no changes were made");
    const root = parseObject(text, client); const mcp = root.mcp === undefined ? {} : objectMap(root.mcp, client); const servers = mcp.servers === undefined ? {} : objectMap(mcp.servers, client); const existing = servers.sandbase;
    if (existing !== undefined && !openCodeOwned(existing, [defaultBridge(env), bridge])) throw new Error("opencode: the sandbase entry is not SandBase-owned; no changes were made");
    const desired = { type: "local", command: ["node", bridge, "--client", "opencode"], enabled: true };
    const next = applyJsonc(text, ["mcp", "servers", "sandbase"], desired); if (next === raw) { await writeIdentity(); return { path, changed: false, ...identityResult }; }
    const backupPath = await backup(path);
    try { await writeIdentity(); await atomicWrite(path, next); const after = await inspectA1(client, env, runner); if (after.state !== "configured") throw new Error(after.detail); return backupPath ? { path, backup: backupPath, changed: true, ...identityResult } : { path, changed: true, ...identityResult }; }
    catch (error) { await restoreSnapshot(path, backupPath); if (identityChanged) identityPrevious === undefined ? await rm(ownerPath, { force: true }) : await atomicWrite(ownerPath, identityPrevious); throw error; }
  }
  const root = parseObject(text, client); const servers = root.mcpServers === undefined ? {} : objectMap(root.mcpServers, client); const existing = servers.sandbase;
  if (existing !== undefined && !windsurfOwned(existing, ["https://sandbase.ai/v1/mcp", mcpUrl.replace(/\/$/, "")], env)) throw new Error("windsurf: the sandbase entry is not SandBase-owned; no changes were made");
  const desired = { serverUrl: mcpUrl, headers: { Authorization: windsurfAuthorization(env) } }; const next = applyJsonc(text, ["mcpServers", "sandbase"], desired);
  const secretPath = credentialPath(env); const currentSecret = await readOptional(secretPath); const configBackup = next === raw ? undefined : await backup(path); const secretBackup = currentSecret === credential ? undefined : await backup(secretPath);
  try {
    await writeIdentity(); if (currentSecret !== credential) { await mkdir(dirname(secretPath), { recursive: true, mode: 0o700 }); await atomicWrite(secretPath, credential, 0o600); await chmod(secretPath, 0o600); }
    if (next !== raw) await atomicWrite(path, next);
    const after = await inspectConfig(client, env); if (after.state !== "configured") throw new Error(after.detail);
    return { path, ...(configBackup ? { backup: configBackup } : {}), changed: next !== raw, credentialPath: secretPath, ...(secretBackup ? { credentialBackup: secretBackup } : {}), credentialChanged: currentSecret !== credential, ...identityResult };
  } catch (error) { if (next !== raw) await restoreSnapshot(path, configBackup); if (currentSecret !== credential) await restoreSnapshot(secretPath, secretBackup); if (identityChanged) identityPrevious === undefined ? await rm(ownerPath, { force: true }) : await atomicWrite(ownerPath, identityPrevious); throw error; }
}

export async function rollbackA1(result: A1AdapterResult): Promise<void> {
  if (result.changed) await restoreSnapshot(result.path, result.backup);
  if (result.credentialPath && result.credentialChanged) await restoreSnapshot(result.credentialPath, result.credentialBackup);
  if (result.identityPath && result.identityChanged) result.identityPrevious === undefined ? await rm(result.identityPath, { force: true }) : await atomicWrite(result.identityPath, result.identityPrevious);
}

export async function snapshotA1Unregister(client: A1Client, env = process.env): Promise<A1UnregisterSnapshot | undefined> {
  const inspected = await inspectConfig(client, env); if (inspected.state === "missing") return undefined; if (inspected.state !== "configured") throw new Error(`${client}: ${inspected.detail}; no changes were made`);
  const path = configPath(client, env); const config = (await readOptional(path))!; const ownerPath = identityPath(client, env); const identity = await readOptional(ownerPath);
  const tokenPath = client === "windsurf" ? credentialPath(env) : undefined; const credential = tokenPath ? await readOptional(tokenPath) : undefined;
  return { client, path, config, identityPath: ownerPath, ...(identity === undefined ? {} : { identity }), ...(tokenPath ? { credentialPath: tokenPath } : {}), ...(credential === undefined ? {} : { credential }) };
}
async function restoreContent(path: string, value?: string): Promise<void> { if (value === undefined) await rm(path, { force: true }); else await atomicWrite(path, value, 0o600); }
export async function restoreA1Unregister(snapshot: A1UnregisterSnapshot): Promise<void> {
  await restoreContent(snapshot.path, snapshot.config); await restoreContent(snapshot.identityPath, snapshot.identity); if (snapshot.credentialPath) await restoreContent(snapshot.credentialPath, snapshot.credential);
}

export async function unregisterA1(client: A1Client, env = process.env, runner: A1CommandRunner = defaultA1Runner): Promise<boolean> {
  const snapshot = await snapshotA1Unregister(client, env); if (!snapshot) return false;
  const path = snapshot.path; const raw = snapshot.config;
  if (client === "qwen-code") {
    await assertQwenCapability(runner);
    try { const removed = await runner("qwen-code", ["mcp", "remove", "sandbase", "--scope", "user"]); if (removed.code !== 0) throw new Error("qwen mcp remove failed"); await rm(snapshot.identityPath, { force: true }); const after = await inspectConfig(client, env); if (after.state !== "missing") throw new Error("Qwen user settings still contains SandBase"); return true; }
    catch (error) { await restoreA1Unregister(snapshot); throw error; }
  }
  const jsonPath = client === "opencode" ? ["mcp", "servers", "sandbase"] : ["mcpServers", "sandbase"]; const next = applyJsonc(raw, jsonPath, undefined);
  try {
    await atomicWrite(path, next);
    if (snapshot.credentialPath) await rm(snapshot.credentialPath, { force: true }); await rm(snapshot.identityPath, { force: true });
    const after = await inspectConfig(client, env); if (after.state !== "missing") throw new Error(`${client} removal readback failed`);
    if (client === "opencode") { const listed = await runner("opencode", ["mcp", "list"]); if (listed.code !== 0 || /(^|\W)sandbase(\W|$)/i.test(`${listed.stdout}\n${listed.stderr}`)) throw new Error("opencode2 mcp list still reports SandBase"); }
    return true;
  } catch (error) { await restoreA1Unregister(snapshot); throw error; }
}
