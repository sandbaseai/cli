import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser";
import { atomicWrite, backup, readOptional, restore } from "./fs-safe.js";
import { configPath, sandbaseHome } from "./paths.js";

export const bClients = ["gemini-cli", "cursor-cli", "kimi-cli", "kiro-cli"] as const;
export type BClient = typeof bClients[number];
export function isBClient(client: string): client is BClient { return bClients.includes(client as BClient); }
export interface BCommandResult { code: number | null; stdout: string; stderr: string }
export type BCommandRunner = (client: BClient, args: readonly string[]) => Promise<BCommandResult>;
export interface BAdapterResult { path: string; backup?: string; changed: boolean; identityPath: string; identityPrevious?: string; identityChanged: boolean }
export interface BUnregisterSnapshot { client: BClient; path: string; config: string; identityPath: string; identity?: string }
export type BInspection = { state: "configured" | "missing" | "conflict" | "invalid" | "confirmation_required"; detail: string };

const executables: Record<BClient, string> = { "gemini-cli": "gemini", "cursor-cli": "cursor-agent", "kimi-cli": "kimi", "kiro-cli": "kiro-cli" };
export const defaultBRunner: BCommandRunner = async (client, args) => { const result = spawnSync(executables[client], [...args], { encoding: "utf8", timeout: 10_000 }); return { code: result.status, stdout: result.stdout || "", stderr: result.stderr || "" }; };
type Identity = { marker: "sandbase-cli-b-v1"; client: BClient; bridge: string };
function ownerPath(client: BClient, env = process.env): string { return join(sandbaseHome(env), "ownership", `${client}.json`); }
function defaultBridge(env = process.env): string { return join(sandbaseHome(env), "bin", "sandbase-mcp-bridge.mjs"); }
async function identity(client: BClient, env = process.env): Promise<Identity | undefined> { const raw = await readOptional(ownerPath(client, env)); if (raw === undefined) return undefined; try { const value = JSON.parse(raw) as Identity; if (value.marker !== "sandbase-cli-b-v1" || value.client !== client || !isAbsolute(value.bridge)) throw new Error(); return value; } catch { throw new Error(`${client} ownership identity is invalid; no changes were made`); } }
function parseObject(raw: string, client: BClient): Record<string, unknown> { const errors: ParseError[] = []; const value = parse(raw, errors, { allowTrailingComma: true, disallowComments: false }) as unknown; if (errors.length || !value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${client} configuration is invalid; no changes were made`); return value as Record<string, unknown>; }
function map(value: unknown, client: BClient): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${client} configuration is invalid; no changes were made`); return value as Record<string, unknown>; }
function commandString(bridge: string): string { return `node ${JSON.stringify(bridge)} --client kiro-cli`; }
function owned(value: unknown, client: BClient, allowed: readonly string[]): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false; const entry = value as { command?: unknown; args?: unknown };
  if (client === "kiro-cli" && typeof entry.command === "string" && entry.args === undefined) return allowed.some(path => entry.command === commandString(path));
  return entry.command === "node" && Array.isArray(entry.args) && entry.args.length === 3 && typeof entry.args[0] === "string" && isAbsolute(entry.args[0]) && allowed.includes(entry.args[0]) && entry.args[1] === "--client" && entry.args[2] === client;
}
function update(raw: string, value: unknown): string { return applyEdits(raw, modify(raw, ["mcpServers", "sandbase"], value, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" } })); }
function projectOverlay(client: BClient, env = process.env): string | undefined { const root = env.PWD || process.cwd(); if (client === "cursor-cli") return join(root, ".cursor", "mcp.json"); if (client === "kiro-cli") return join(root, ".kiro", "settings", "mcp.json"); return undefined; }
async function overlayConflict(client: BClient, env = process.env): Promise<boolean> { const path = projectOverlay(client, env); if (!path || path === configPath(client, env)) return false; const raw = await readOptional(path); if (raw === undefined) return false; const root = parseObject(raw, client); const servers = root.mcpServers === undefined ? undefined : map(root.mcpServers, client); return servers?.sandbase !== undefined; }
async function inspectConfig(client: BClient, env = process.env, expected?: string): Promise<BInspection> {
  try {
    if (await overlayConflict(client, env)) return { state: "confirmation_required", detail: "a higher-priority workspace SandBase entry was left untouched" };
    const raw = await readOptional(configPath(client, env)); if (raw === undefined) return { state: "missing", detail: "configuration is missing" }; const root = parseObject(raw, client);
    if (client === "gemini-cli") { const mcp = root.mcp as Record<string, unknown> | undefined; const allowed = Array.isArray(mcp?.allowed) ? mcp.allowed : undefined; const excluded = Array.isArray(mcp?.excluded) ? mcp.excluded : undefined; if ((allowed && !allowed.includes("sandbase")) || excluded?.includes("sandbase")) return { state: "confirmation_required", detail: "Gemini MCP policy does not allow SandBase" }; }
    const servers = root.mcpServers === undefined ? undefined : map(root.mcpServers, client); const entry = servers?.sandbase; if (entry === undefined) return { state: "missing", detail: "SandBase is not registered" };
    const id = await identity(client, env); const allowed = [...new Set([defaultBridge(env), id?.bridge, expected].filter((v): v is string => !!v))]; return owned(entry, client, allowed) ? { state: "configured", detail: "managed bridge ownership verified" } : { state: "conflict", detail: "the sandbase entry is not SandBase-owned" };
  } catch (error) { return { state: "invalid", detail: error instanceof Error ? error.message : `${client} configuration is invalid` }; }
}
async function capability(client: BClient, runner: BCommandRunner): Promise<void> {
  const probes: Record<BClient, readonly (readonly string[])[]> = {
    "gemini-cli": [["--version"], ["mcp","add","--help"], ["mcp","list","--help"], ["mcp","remove","--help"]],
    "cursor-cli": [["--version"], ["mcp","list","--help"], ["mcp","list-tools","--help"]],
    "kimi-cli": [["--version"], ["mcp","add","--help"], ["mcp","list","--help"], ["mcp","remove","--help"], ["mcp","test","--help"]],
    "kiro-cli": [["--version"], ["mcp","add","--help"], ["mcp","list","--help"], ["mcp","status","--help"], ["mcp","remove","--help"]],
  };
  const results = await Promise.all(probes[client].map(args => runner(client, args))); if (results.some(result => result.code !== 0)) throw new Error(`${client} persistent MCP capability is unavailable; no changes were made`);
  if (client === "gemini-cli" && ![results[1], results[3]].every(result => /--scope/.test(`${result?.stdout}${result?.stderr}`))) throw new Error("Gemini user-scope MCP capability is unavailable; no changes were made");
}
async function readback(client: BClient, runner: BCommandRunner): Promise<boolean> {
  if (client === "gemini-cli") { const list = await runner(client,["mcp","list"]); return list.code === 0 && /(^|\W)sandbase(\W|$)/i.test(`${list.stdout}${list.stderr}`); }
  if (client === "cursor-cli") { const list=await runner(client,["mcp","list"]), tools=await runner(client,["mcp","list-tools","sandbase"]); return list.code===0&&tools.code===0&&/(^|\W)sandbase(\W|$)/i.test(`${list.stdout}${list.stderr}`); }
  if (client === "kimi-cli") { const list=await runner(client,["mcp","list"]), test=await runner(client,["mcp","test","sandbase"]); return list.code===0&&test.code===0&&/(^|\W)sandbase(\W|$)/i.test(`${list.stdout}${list.stderr}`); }
  const list=await runner(client,["mcp","list","global"]), status=await runner(client,["mcp","status","--name","sandbase"]); return list.code===0&&status.code===0&&/(^|\W)sandbase(\W|$)/i.test(`${list.stdout}${list.stderr}`);
}
export async function inspectB(client: BClient, env=process.env, runner:BCommandRunner=defaultBRunner):Promise<BInspection>{const state=await inspectConfig(client,env);if(state.state!=="configured")return state;return await readback(client,runner)?state:{state:"invalid",detail:`${client} CLI readback failed`};}
export async function installB(client:BClient,bridge:string,env=process.env,runner:BCommandRunner=defaultBRunner):Promise<BAdapterResult>{
  if(!isAbsolute(bridge))throw new Error(`${client} managed bridge path must be absolute; no changes were made`);await capability(client,runner);const before=await inspectConfig(client,env,bridge);if(before.state==="conflict"||before.state==="invalid"||before.state==="confirmation_required")throw new Error(`${client}: ${before.detail}; no changes were made`);
  const path=configPath(client,env),raw=await readOptional(path),text=raw===undefined||!raw.trim()?"{}\n":raw,backupPath=before.state==="configured"?undefined:await backup(path);const idPath=ownerPath(client,env),idPrevious=await readOptional(idPath),idNext=JSON.stringify({marker:"sandbase-cli-b-v1",client,bridge},null,2)+"\n",identityChanged=idPrevious!==idNext;const result={path,...(backupPath?{backup:backupPath}:{}),changed:before.state!=="configured",identityPath:idPath,...(idPrevious===undefined?{}:{identityPrevious:idPrevious}),identityChanged};
  try{if(identityChanged)await atomicWrite(idPath,idNext);if(before.state!=="configured"){if(client==="cursor-cli")await atomicWrite(path,update(text,{command:"node",args:[bridge,"--client",client]}));else{const args=client==="gemini-cli"?["mcp","add","--scope","user","--transport","stdio","sandbase","node",bridge,"--client",client]:client==="kimi-cli"?["mcp","add","--transport","stdio","sandbase","--","node",bridge,"--client",client]:["mcp","add","--name","sandbase","--scope","global","--command",commandString(bridge)];const added=await runner(client,args);if(added.code!==0)throw new Error(`${client} persistent MCP add failed`);}}
    const configured=await inspectConfig(client,env);if(configured.state!=="configured"||!(await readback(client,runner)))throw new Error(`${client} MCP readback failed`);return result;
  }catch(error){if(before.state!=="configured")await restore(path,backupPath);if(identityChanged)idPrevious===undefined?await rm(idPath,{force:true}):await atomicWrite(idPath,idPrevious);throw error;}
}
export async function rollbackB(result:BAdapterResult):Promise<void>{if(result.changed)await restore(result.path,result.backup);if(result.identityChanged)result.identityPrevious===undefined?await rm(result.identityPath,{force:true}):await atomicWrite(result.identityPath,result.identityPrevious);}
export async function snapshotBUnregister(client:BClient,env=process.env):Promise<BUnregisterSnapshot|undefined>{const state=await inspectConfig(client,env);if(state.state==="missing")return undefined;if(state.state!=="configured")throw new Error(`${client}: ${state.detail}; no changes were made`);const path=configPath(client,env),config=(await readOptional(path))!,idPath=ownerPath(client,env),id=await readOptional(idPath);return{client,path,config,identityPath:idPath,...(id===undefined?{}:{identity:id})};}
async function restoreContent(path:string,value?:string):Promise<void>{if(value===undefined)await rm(path,{force:true});else await atomicWrite(path,value);}
export async function restoreBUnregister(snapshot:BUnregisterSnapshot):Promise<void>{await restoreContent(snapshot.path,snapshot.config);await restoreContent(snapshot.identityPath,snapshot.identity);}
export async function unregisterB(client:BClient,env=process.env,runner:BCommandRunner=defaultBRunner):Promise<boolean>{const snapshot=await snapshotBUnregister(client,env);if(!snapshot)return false;await capability(client,runner);try{if(client==="cursor-cli")await atomicWrite(snapshot.path,update(snapshot.config,undefined));else{const args=client==="gemini-cli"?["mcp","remove","sandbase","--scope","user"]:client==="kimi-cli"?["mcp","remove","sandbase"]:["mcp","remove","--name","sandbase","--scope","global"];const removed=await runner(client,args);if(removed.code!==0)throw new Error(`${client} persistent MCP remove failed`);}await rm(snapshot.identityPath,{force:true});const after=await inspectConfig(client,env);if(after.state!=="missing")throw new Error(`${client} removal readback failed`);return true;}catch(error){await restoreBUnregister(snapshot);throw error;}}
