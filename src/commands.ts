import { spawn } from "node:child_process";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { clients, isPromptAssistedClient, type Client, type ConnectClient, type CredentialRecord, type PromptAssistedClient } from "./types.js";
import { AuthorizationApi } from "./auth/api.js";
import { authorize } from "./auth/flow.js";
import { autoClients, capabilityRegistry, clientProfiles, nativeCapabilities, type RuntimeStatus } from "./clients.js";
import { FileCredentialStore, type CredentialStore } from "./credentials/store.js";
import { configure, detectClient, inspectBridge, installBridge, isConfigured, rollback, rollbackBridge, unregister as removeAdapter, type AdapterResult } from "./adapters/index.js";
import { inspectA1, installA1, isA1Client, rollbackA1, restoreA1Unregister, snapshotA1Unregister, unregisterA1, type A1AdapterResult, type A1CommandRunner } from "./a1-adapters.js";
import { inspectB, installB, isBClient, rollbackB, restoreBUnregister, snapshotBUnregister, unregisterB, type BAdapterResult, type BCommandRunner } from "./b-adapters.js";
import { inspectC, installC, isCClient, rollbackC, restoreCUnregister, snapshotCUnregister, unregisterC, type CAdapterResult, type CCommandRunner } from "./c-adapters.js";
import { inspectWarp, installWarp, rollbackWarp, restoreWarpUnregister, snapshotWarpUnregister, unregisterWarp, type WarpAdapterResult } from "./warp-adapter.js";
import { inspectKiroIDE, installKiroIDE, rollbackKiroIDE, restoreKiroIDEUnregister, snapshotKiroIDEUnregister, unregisterKiroIDE, type KiroIDEResult } from "./kiro-ide.js";
import { inspectSkill, installSkill, removeSkill, sharedSkillReferences, skillFallback, skillInvocation, skillPath } from "./skills.js";
import { executeNativeSkillRemoval, inspectNativeSkill, installNativeSkill, planNativeSkillRemoval, removeNativeSkill, skillsAgentRegistry, inspectOpenClawMcp, inspectOpenClawSkill, installOpenClawMcp, installOpenClawSkill, removeOpenClawMcp, removeOpenClawSkill, type NativeSkillRemovalPlan, type NativeSkillResult, type OpenClawCommandRunner, type OpenClawReadbackVerifier, type SkillsCommandRunner, type SkillsReadbackVerifier } from "./skills-cli.js";
import { desktopIdentityPath, isDesktopClient, readDesktopIdentity, removeDesktopIdentity, rollbackDesktopIdentity, writeDesktopIdentity } from "./desktop-bridge.js";
import { claudeDesktopArtifactPath, readClaudeDesktopArtifactState, removeClaudeDesktopArtifacts, rollbackClaudeDesktopArtifacts } from "./claude-desktop.js";
import { coworkStatePath, readCoworkState, removeCoworkState, rollbackCoworkState } from "./cowork.js";
import { atomicWrite, readOptional, restore } from "./fs-safe.js";
import { configPath } from "./paths.js";

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => { const t = setTimeout(resolve, ms); signal?.addEventListener("abort", () => { clearTimeout(t); reject(new Error("Authorization cancelled")); }, { once: true }); });
type Detection = { installed: boolean; detail: string };
export interface CommandDependencies { api?: AuthorizationApi; store?: CredentialStore; open?: (url: string) => Promise<void>; signal?: AbortSignal; log?: (s: string) => void; detect?: (client: Client) => Detection; skillsRunner?: SkillsCommandRunner; skillsReadbackVerifier?: SkillsReadbackVerifier; openClawRunner?: OpenClawCommandRunner; openClawReadbackVerifier?: OpenClawReadbackVerifier; a1Runner?: A1CommandRunner; bRunner?: BCommandRunner; cRunner?: CCommandRunner; }

async function compensate(api: AuthorizationApi, authorizationId: string, token: string): Promise<boolean> { for (const delay of [0, 250, 750]) { if (delay) await sleep(delay); try { await api.cleanup(authorizationId, token); return true; } catch { /* bounded retry inside the five-minute capability window */ } } return false; }
export async function openBrowser(url: string): Promise<void> { const cmd = platform() === "darwin" ? "open" : platform() === "win32" ? "cmd" : "xdg-open"; const args = platform() === "win32" ? ["/c", "start", "", url] : [url]; const child = spawn(cmd, args, { detached: true, stdio: "ignore" }); child.unref(); }

function mcpServerSnippet(client: Client, bridgePath: string): string { return JSON.stringify({ mcpServers: { sandbase: { command: "node", args: [bridgePath, "--client", client] } } }, null, 2); }
function promptAssistedLauncher(client: PromptAssistedClient, bridge: string): string { return JSON.stringify({ command: "node", args: [bridge, "--client", client] }, null, 2); }
const sharedSlotPairs = [["cursor", "cursor-cli"], ["kiro", "kiro-cli"]] as const;
async function sharedSlotOwner(client: Client): Promise<Client | undefined> {
  const pair=sharedSlotPairs.find(item=>item.includes(client as never)); if(!pair)return undefined;
  const raw=await readOptional(configPath(client)); if(!raw)return undefined;
  try {
    const value=(JSON.parse(raw) as {mcpServers?:Record<string,{args?:unknown[];command?:unknown}>}).mcpServers?.sandbase;
    if(!value)return undefined;
    if(Array.isArray(value.args)&&value.args.length===3&&value.args[1]==="--client"&&typeof value.args[2]==="string")return pair.includes(value.args[2] as never)?value.args[2] as Client:undefined;
    if(typeof value.command==="string"){
      const match=/(?:^|\s)--client\s+(cursor-cli|cursor|kiro-cli|kiro)(?=\s|$)/.exec(value.command);
      return match?.[1]&&pair.includes(match[1] as never)?match[1] as Client:undefined;
    }
    return undefined;
  } catch { return undefined; }
}
async function assertSharedSlotAvailable(client:Client):Promise<void>{const pair=sharedSlotPairs.find(item=>item.includes(client as never));if(!pair)return;const owner=await sharedSlotOwner(client);if(owner&&owner!==client)throw new Error(`${client} shares one SandBase configuration slot with ${owner}, which currently owns it. Run sandbase unregister --client ${owner}, then retry ${client}; authorization was not started.`);}
async function resolveAutoSharedSlots(targets:Client[],log:(message:string)=>void):Promise<Client[]>{const selected=[...targets];for(const pair of sharedSlotPairs){if(!pair.every(client=>selected.includes(client)))continue;const owner=await sharedSlotOwner(pair[0]);const keep=owner&&pair.includes(owner as never)?owner:pair[0],skip=pair.find(client=>client!==keep)!;selected.splice(selected.indexOf(skip),1);log(`${skip}: status=action_required, authorization=not_started, local_write=none, next_step=${keep} uses the same SandBase configuration slot. Complete or unregister ${keep}, then run sandbase connect --client ${skip}.`);}return selected;}
function safeFailure(error:unknown):string{let message=error instanceof Error?error.message:"unknown failure";for(const value of [process.env.HOME,process.env.SANDBASE_HOME,process.env.PWD])if(value)message=message.replaceAll(value,"[LOCAL_PATH]");return message.replace(/(?:sk|cln)-[A-Za-z0-9_-]+/g,"[REDACTED]").replace(/\s+/g," ").slice(0,240);}
function nextStepPrompts(label: string): string[] { return [`2. In ${label}, try asking:`, "   - List the available SandBase MCP tools.", "   - Use SandBase to fetch Elon Musk's latest 10 posts on Twitter."]; }
function successMessage(client: Client, bridgePath: string): string {
  const profile = clientProfiles[client]; const label = profile.label;
  if (client === "warp") return ["", "SandBase MCP configuration is staged for Warp.", "", "Client: Warp (warp)", "Credential was stored locally with restricted permissions.", "", "Next steps:", "1. Open Warp and use /agent-add-mcp to review and approve the SandBase server.", "2. Read back SandBase in Warp's MCP server list, inspect its tools, and complete one safe call.", "3. If a project .warp/.mcp.json defines sandbase, remove or rename that override first; SandBase leaves it untouched.", "", 'Manage access: revoke the "CLI Login" key in SandBase Dashboard when you no longer need it.'].join("\n");
  const common = ["", "SandBase local configuration is ready; client verification is still required.", "", `Client: ${label} (${client})`, "Credential was stored locally with restricted permissions."];
  if (profile.mode === "auto") return [...common, "", "Next steps:", `1. Restart or reload ${label} so it picks up the new MCP configuration.`, ...nextStepPrompts(label), "", 'Manage access: revoke the "CLI Login" key in SandBase Dashboard when you no longer need it.'].join("\n");
  if (profile.mode === "skill") return [...common, "", "Skill/prompt setup required.", `Copy the following instruction into ${label}:`, "", `Install the SandBase MCP bridge for ${label}. Use this local MCP server configuration and keep the scope limited to SandBase:`, mcpServerSnippet(client, bridgePath), `After setup, reload ${label} if needed.`, "", "Next steps:", "1. Finish the skill/prompt setup in ${label}.", ...nextStepPrompts(label), "", 'Manage access: revoke the "CLI Login" key in SandBase Dashboard when you no longer need it.'].join("\n");
  return [...common, "", "Manual MCP configuration required.", `Add this MCP server configuration to ${label}:`, "", mcpServerSnippet(client, bridgePath), "", "Next steps:", `1. Save the configuration and restart or reload ${label}.`, ...nextStepPrompts(label), "", 'Manage access: revoke the "CLI Login" key in SandBase Dashboard when you no longer need it.'].join("\n");
}

function plannedAutoClients(detect: (client: Client) => Detection): Client[] { return autoClients().filter(client => detect(client).installed); }
function logDetectedActionRequired(detect: (client: Client) => Detection, log: (message: string) => void): void {
  for (const client of clients) {
    const capability = nativeCapabilities[client];
    const v2 = capabilityRegistry[client];
    if (skillsAgentRegistry[client]) continue;
    if (!detect(client).installed || (v2.implementation === "implemented" && (capability.mcpMode === "auto" || capability.mcpMode === "desktop"))) continue;
    log(`${client}: status=${v2.status}, mcp=not_configured, skill=not_configured, invocation=${capability.invocation}, next_step=${v2.nextStep}`);
  }
}
function recordFor(client: Client, exchange: { credential: string; credential_id: string; key_prefix: string; scope: string[]; mcp_url: string; created_at: string }): CredentialRecord { return { credential: exchange.credential, credentialId: exchange.credential_id, keyPrefix: exchange.key_prefix, client, scope: exchange.scope, mcpUrl: exchange.mcp_url, createdAt: exchange.created_at }; }
async function restoreCredential(store: CredentialStore, client: Client, previous?: CredentialRecord): Promise<void> { if (previous) await store.save(previous); else await store.remove(client); }
type MCPAdapterResult = AdapterResult | A1AdapterResult | BAdapterResult | CAdapterResult | WarpAdapterResult | KiroIDEResult;
async function configureMCP(client: Client, bridge: string, exchange: { credential: string; mcp_url: string }, a1Runner?: A1CommandRunner, bRunner?: BCommandRunner, cRunner?: CCommandRunner): Promise<MCPAdapterResult> { return client === "kiro" ? installKiroIDE(bridge) : client === "warp" ? installWarp(bridge) : isA1Client(client) ? installA1(client, bridge, exchange.credential, exchange.mcp_url, process.env, a1Runner) : isBClient(client) ? installB(client, bridge, process.env, bRunner) : isCClient(client) ? installC(client, bridge, process.env, cRunner) : configure(client, bridge); }
async function verifyMCP(client: Client, a1Runner?: A1CommandRunner, bRunner?: BCommandRunner, cRunner?: CCommandRunner): Promise<boolean> { return client === "kiro" ? (await inspectKiroIDE()).state === "configured" : client === "warp" ? (await inspectWarp()).state === "configured" : isA1Client(client) ? (await inspectA1(client, process.env, a1Runner)).state === "configured" : isBClient(client) ? (await inspectB(client, process.env, bRunner)).state === "configured" : isCClient(client) ? (await inspectC(client, process.env, cRunner)).state === "configured" : isConfigured(client); }
async function rollbackMCP(client: Client, result: MCPAdapterResult, cRunner?: CCommandRunner): Promise<void> { if (client === "kiro") await rollbackKiroIDE(result as KiroIDEResult); else if (client === "warp") await rollbackWarp(result as WarpAdapterResult); else if (isA1Client(client)) await rollbackA1(result as A1AdapterResult); else if (isBClient(client)) await rollbackB(result as BAdapterResult); else if (isCClient(client)) await rollbackC(result as CAdapterResult, process.env, cRunner); else await rollback(result as AdapterResult); }
async function configureSkill(client: Client, log: (message: string) => void): Promise<RuntimeStatus> {
  try { const result = await installSkill(client); const status: RuntimeStatus = result.state === "already_configured" ? "already_configured" : result.state === "configured" ? "configured" : "confirmation_required"; log(`${client}: status=action_required, mcp=local_configured, skill=${result.state}, invocation=${nativeCapabilities[client].invocation}, next_step=${result.message}`); return status; }
  catch (error) { const message = error instanceof Error ? error.message : "Unknown native Skill failure"; log(`${client}: status=failed, mcp=local_configured, skill=failed, invocation=${nativeCapabilities[client].invocation}, next_step=${message}`); return "failed"; }
}

async function configureNativeSkill(client: Client, detected: Detection, log: (message: string) => void, runner?: SkillsCommandRunner, verify?: SkillsReadbackVerifier): Promise<void> {
  if (!skillsAgentRegistry[client]) return;
  if(client==="kiro-cli"&&(await inspectSkill("kiro"))!=="missing"){log("kiro-cli: status=confirmation_required, mcp=not_configured, skill=confirmation_required, invocation=mcp_chat, next_step=Kiro IDE already has a local SandBase Skill; the Kiro CLI Skill installer was not run to avoid taking over the shared Kiro Skill path.");return;}
  if (!detected.installed) { log(`${client}: status=confirmation_required, mcp=not_configured, skill=confirmation_required, invocation=${nativeCapabilities[client].invocation}, next_step=${clientProfiles[client].label} is not locally detected; no Skills CLI invocation was attempted.`); return; }
  const result = await installNativeSkill(client, runner, verify);
  const status: RuntimeStatus = result.status === "failed" ? "failed" : "confirmation_required";
  log(`${client}: status=${status}, mcp=not_configured, skill=${result.status}, invocation=${nativeCapabilities[client].invocation}, next_step=${result.message}`);
}

async function prepareOpenClawSkill(detected: Detection, log: (message: string) => void, runner?: OpenClawCommandRunner, verify?: OpenClawReadbackVerifier): Promise<boolean> {
  if (!detected.installed) { log("openclaw: status=confirmation_required, mcp=not_configured, skill=confirmation_required, invocation=mcp_chat, next_step=OpenClaw is not locally detected; no SandBase configuration was attempted."); return false; }
  const result = await installOpenClawSkill(runner, verify);
  if (result.status === "installed" || result.status === "already_installed") return true;
  log(`openclaw: status=${result.status === "failed" ? "failed" : "confirmation_required"}, mcp=not_configured, skill=${result.status}, invocation=mcp_chat, next_step=${result.message}`);
  return false;
}

async function connectOpenClaw(deps: CommandDependencies): Promise<void> {
  const api = deps.api || new AuthorizationApi((process.env.SANDBASE_API_URL || "https://sandbase.ai").replace(/\/$/, "")); const store = deps.store || new FileCredentialStore(); const log = deps.log || console.log; const detect = deps.detect || detectClient;
  if (!(await prepareOpenClawSkill(detect("openclaw"), log, deps.openClawRunner, deps.openClawReadbackVerifier))) return;
  const previous = await store.get("openclaw"); const { authorizationId, exchange } = await authorize(api, "openclaw", { open: deps.open || openBrowser, sleep, log, ...(deps.signal ? { signal: deps.signal } : {}) }); let bridgeResult;
  try {
    await store.save(recordFor("openclaw", exchange)); bridgeResult = await installBridge();
    const mcp = await installOpenClawMcp(bridgeResult.path, deps.openClawRunner);
    if (mcp.status !== "configured" && mcp.status !== "already_configured") throw new Error(mcp.message);
    log(`openclaw: status=action_required, mcp=local_configured, skill=already_installed, invocation=mcp_chat, next_step=Restart OpenClaw, read back server/tools, then complete one safe call.`);
    exchange.cleanup_token = "";
  } catch (error) {
    if (bridgeResult) await rollbackBridge(bridgeResult).catch(() => undefined); await restoreCredential(store, "openclaw", previous).catch(() => undefined);
    if (!(await compensate(api, authorizationId, exchange.cleanup_token))) console.error("WARNING: automatic credential cleanup failed. Revoke the new CLI credential in SandBase Dashboard immediately."); exchange.cleanup_token = ""; throw error;
  }
}

async function connectDesktop(client: Extract<Client, "claude-desktop" | "cowork">, deps: CommandDependencies): Promise<void> {
  const api = deps.api || new AuthorizationApi((process.env.SANDBASE_API_URL || "https://sandbase.ai").replace(/\/$/, "")); const store = deps.store || new FileCredentialStore(); const log = deps.log || console.log;
  const previous = await store.get(client); const { authorizationId, exchange } = await authorize(api, client, { open: deps.open || openBrowser, sleep, log, ...(deps.signal ? { signal: deps.signal } : {}) }); let bridgeResult; let identityResult;
  try {
    await store.save(recordFor(client, exchange)); bridgeResult = await installBridge(); identityResult = await writeDesktopIdentity(client);
    log(`${client}: status=action_required, credential=ready, bridge=ready, mcp_artifact=not_read_back, skill_artifact=not_read_back, next_step=${client === "cowork" ? "Download and inspect both artifacts, then obtain explicit account/workspace administrator approval before import." : "Download the versioned artifacts from SandBase Dashboard and complete the client-specific import."} Product verification is pending.`);
    exchange.cleanup_token = "";
  } catch (error) {
    if (identityResult) await rollbackDesktopIdentity(identityResult).catch(() => undefined); if (bridgeResult) await rollbackBridge(bridgeResult).catch(() => undefined); await restoreCredential(store, client, previous).catch(() => undefined);
    if (!(await compensate(api, authorizationId, exchange.cleanup_token))) console.error("WARNING: automatic credential cleanup failed. Revoke the new CLI credential in SandBase Dashboard immediately."); exchange.cleanup_token = ""; throw error;
  }
}

async function connectPromptAssisted(client: PromptAssistedClient, deps: CommandDependencies): Promise<void> {
  const api = deps.api || new AuthorizationApi((process.env.SANDBASE_API_URL || "https://sandbase.ai").replace(/\/$/, "")); const store = deps.store || new FileCredentialStore(); const log = deps.log || console.log;
  const previous = await store.get(client); const { authorizationId, exchange } = await authorize(api, client, { open: deps.open || openBrowser, sleep, log, ...(deps.signal ? { signal: deps.signal } : {}) }); let bridgeResult;
  try {
    await store.save(recordFor(client, exchange)); bridgeResult = await installBridge();
    log(`${client}: status=action_required, authorization=completed, credential=stored, bridge=ready, registration=registration_required, verification=real_client_matrix\nUse these generic stdio launcher fields in ${clientProfiles[client].label}'s existing MCP manager; no client settings were changed:\n${promptAssistedLauncher(client, bridgeResult.path)}\nReload the client, read back the SandBase MCP server and tool list, then make one safe SandBase tool call. Until all three checks pass, status remains action_required.`);
    exchange.cleanup_token = "";
  } catch (error) {
    if (bridgeResult) await rollbackBridge(bridgeResult).catch(() => undefined); await restoreCredential(store, client, previous).catch(() => undefined);
    if (!(await compensate(api, authorizationId, exchange.cleanup_token))) console.error("WARNING: automatic credential cleanup failed. Revoke the new CLI credential in SandBase Dashboard immediately."); exchange.cleanup_token = ""; throw error;
  }
}

async function connectChatGPT(deps: CommandDependencies): Promise<void> {
  const api = deps.api || new AuthorizationApi((process.env.SANDBASE_API_URL || "https://sandbase.ai").replace(/\/$/, "")); const store = deps.store || new FileCredentialStore(); const log = deps.log || console.log;
  const previous = await store.get("chatgpt"); const { authorizationId, exchange } = await authorize(api, "chatgpt", { open: deps.open || openBrowser, sleep, log, ...(deps.signal ? { signal: deps.signal } : {}) }); let bridgeResult;
  try {
    await store.save(recordFor("chatgpt", exchange)); bridgeResult = await installBridge();
    log("chatgpt: status=action_required, authorization=completed, credential=stored, bridge=ready, chatgpt_app=not_configured, verification=not_verified, next_step=Use an eligible ChatGPT Business, Enterprise, or Edu workspace. Enable Developer Mode, open Apps and choose Create, register the SandBase remote MCP endpoint using the approved authentication method, run Scan Tools, have a workspace administrator review and publish the App, then start a fresh conversation and complete one safe SandBase tool call. The CLI did not write or change any ChatGPT configuration.");
    exchange.cleanup_token = "";
  } catch (error) {
    if (bridgeResult) await rollbackBridge(bridgeResult).catch(() => undefined); await restoreCredential(store, "chatgpt", previous).catch(() => undefined);
    if (!(await compensate(api, authorizationId, exchange.cleanup_token))) console.error("WARNING: automatic credential cleanup failed. Revoke the new CLI credential in SandBase Dashboard immediately."); exchange.cleanup_token = ""; throw error;
  }
}

async function connectOne(client: Client, deps: CommandDependencies): Promise<void> {
  const api = deps.api || new AuthorizationApi((process.env.SANDBASE_API_URL || "https://sandbase.ai").replace(/\/$/, "")); const store = deps.store || new FileCredentialStore(); const log = deps.log || console.log; const detect = deps.detect || detectClient;
  const profile = clientProfiles[client]; const capability = nativeCapabilities[client];
  const v2 = capabilityRegistry[client];
  if (client === "chatgpt") { await connectChatGPT(deps); return; }
  await assertSharedSlotAvailable(client);
  if (isPromptAssistedClient(client)) { await connectPromptAssisted(client, deps); return; }
  if (isDesktopClient(client)) { await connectDesktop(client, deps); return; }
  if (client === "openclaw") { await connectOpenClaw(deps); return; }
  if (skillsAgentRegistry[client]) {
    await configureNativeSkill(client, detect(client), log, deps.skillsRunner, deps.skillsReadbackVerifier);
    // Kiro has both a native Skill lifecycle and a persistent MCP adapter.
    // Keep the two lifecycles independent, but do not skip its MCP setup.
    if (!isBClient(client)) return;
  }
  if (v2.implementation === "blocked") { log(`${client}: status=failed, mcp=not_configured, skill=not_configured, invocation=${capability.invocation}, next_step=${v2.nextStep}`); return; }
  if (capability.mcpMode === "manual" || capability.mcpMode === "none") {
    const detected = detect(client);
    if (skillsAgentRegistry[client]) { await configureNativeSkill(client, detected, log, deps.skillsRunner, deps.skillsReadbackVerifier); return; }
    const v2 = capabilityRegistry[client]; log(`${client}: status=${v2.status}, mcp=not_configured, skill=not_configured, invocation=${capability.invocation}, next_step=${v2.nextStep}`); return;
  }
  const detected = detect(client); if (!detected.installed) throw new Error(`${profile.label} is not installed or is incompatible. Install a supported version, then retry.`);
  const previous = await store.get(client); const { authorizationId, exchange } = await authorize(api, client, { open: deps.open || openBrowser, sleep, log, ...(deps.signal ? { signal: deps.signal } : {}) }); let configured; let bridgeResult;
  try {
    const record = recordFor(client, exchange); await store.save(record); bridgeResult = await installBridge(); configured = await configureMCP(client, bridgeResult.path, exchange, deps.a1Runner, deps.bRunner, deps.cRunner);
    if (profile.mode === "auto" && !(await verifyMCP(client, deps.a1Runner, deps.bRunner, deps.cRunner))) throw new Error("Client configuration verification failed");
    if (client === "kiro") { const skill = await installSkill("kiro"); if (skill.state !== "configured" && skill.state !== "already_configured") throw new Error("Kiro IDE Skill local readback failed"); log(`kiro: status=action_required, mcp=local_configured, skill=${skill.state}, invocation=desktop_ui, next_step=Reload Kiro IDE, read back the SandBase server and tools, then complete one safe tool call.`); }
    else { log(successMessage(client, bridgeResult.path)); if (!skillsAgentRegistry[client]) await configureSkill(client, log); } exchange.cleanup_token = "";
  } catch (e) {
    if (configured) await rollbackMCP(client, configured, deps.cRunner).catch(() => undefined); if (bridgeResult) await rollbackBridge(bridgeResult).catch(() => undefined); await restoreCredential(store, client, previous).catch(() => undefined);
    if (!(await compensate(api, authorizationId, exchange.cleanup_token))) console.error("WARNING: automatic credential cleanup failed. Revoke the new CLI credential in SandBase Dashboard immediately."); exchange.cleanup_token = ""; throw e;
  }
}

async function connectAuto(deps: CommandDependencies): Promise<void> {
  const api = deps.api || new AuthorizationApi((process.env.SANDBASE_API_URL || "https://sandbase.ai").replace(/\/$/, "")); const store = deps.store || new FileCredentialStore(); const log = deps.log || console.log; const detect = deps.detect || detectClient;
  const targets: Client[] = await resolveAutoSharedSlots(plannedAutoClients(detect).filter(client => client !== "openclaw") as Client[],log);
  const nativeSkillTargets = clients.filter(target => targets.includes(target) && !!skillsAgentRegistry[target] && detect(target).installed);
  // Native Skills are an independent local lifecycle: do not let their result
  // change MCP authorization, configuration, or rollback decisions.
  for (const target of nativeSkillTargets) await configureNativeSkill(target, detect(target), log, deps.skillsRunner, deps.skillsReadbackVerifier);
  // ClawHub Skill installation must succeed before OpenClaw joins the same
  // one-time authorization transaction used by the other automatic clients.
  const openClawReady = detect("openclaw").installed && await prepareOpenClawSkill(detect("openclaw"), log, deps.openClawRunner, deps.openClawReadbackVerifier);
  if (openClawReady) targets.push("openclaw");
  if (!targets.length) { log("No installed compatible clients support automatic MCP configuration. Use --client <client> for manual or skill setup guidance."); logDetectedActionRequired(detect, log); return; }
  const { authorizationId, exchange } = await authorize(api, "auto", { open: deps.open || openBrowser, sleep, log, ...(deps.signal ? { signal: deps.signal } : {}) });
  let bridgeResult;
  const succeeded: Client[] = [], failed: Client[] = [];
  try {
    bridgeResult = await installBridge();
    for (const client of targets) {
      const previous = await store.get(client); let configured;
      try {
        const record = recordFor(client, exchange); await store.save(record);
        if (client === "openclaw") {
          const mcp = await installOpenClawMcp(bridgeResult.path, deps.openClawRunner);
          if (mcp.status !== "configured" && mcp.status !== "already_configured") throw new Error(mcp.message);
          log(`openclaw: status=action_required, mcp=local_configured, skill=already_installed, invocation=mcp_chat, next_step=Restart OpenClaw, read back server/tools, then complete one safe call.`);
        } else {
          configured = await configureMCP(client, bridgeResult.path, exchange, deps.a1Runner, deps.bRunner, deps.cRunner);
          if (!(await verifyMCP(client, deps.a1Runner, deps.bRunner, deps.cRunner))) throw new Error("Client configuration verification failed");
          if (client === "kiro") { const skill=await installSkill("kiro"); if(skill.state!=="configured"&&skill.state!=="already_configured")throw new Error("Kiro IDE Skill local readback failed"); log(`kiro: status=action_required, mcp=local_configured, skill=${skill.state}, invocation=desktop_ui, next_step=Reload Kiro IDE and read back server/tools plus one safe call.`); }
          else if (!skillsAgentRegistry[client]) await configureSkill(client, log);
        }
        succeeded.push(client);
      } catch (error) {
        if (configured) await rollbackMCP(client, configured, deps.cRunner).catch(() => undefined); await restoreCredential(store, client, previous).catch(() => undefined); failed.push(client);
        log(`${client}: status=failed, reason=${safeFailure(error)}, next_step=Run sandbase doctor --client ${client}, resolve the reported ownership, precedence, capability, or readback issue, then retry.`);
      }
    }
    if (!succeeded.length) throw new Error("No clients were configured successfully.");
    log(`Configured clients: ${succeeded.join(", ")}.`);
    if (failed.length) log(`Partial success: failed clients were rolled back: ${failed.join(", ")}.`);
    logDetectedActionRequired(detect, log);
    exchange.cleanup_token = "";
  } catch (e) {
    if (bridgeResult) await rollbackBridge(bridgeResult).catch(() => undefined);
    if (!(await compensate(api, authorizationId, exchange.cleanup_token))) console.error("WARNING: automatic credential cleanup failed. Revoke the new CLI credential in SandBase Dashboard immediately."); exchange.cleanup_token = ""; throw e;
  }
}

export async function connect(client: ConnectClient = "auto", deps: CommandDependencies = {}): Promise<void> { if (client === "auto") return connectAuto(deps); return connectOne(client, deps); }

async function unregisterClaudeDesktop(store: CredentialStore): Promise<boolean> {
  const [artifactState, identityState, credential, artifactPrevious, identityPrevious] = await Promise.all([readClaudeDesktopArtifactState(), readDesktopIdentity("claude-desktop"), store.get("claude-desktop"), readOptional(claudeDesktopArtifactPath()), readOptional(desktopIdentityPath("claude-desktop"))]);
  if (artifactState.ownership === "invalid") throw new Error("Claude Desktop artifact ownership is unrecognized; no changes were made");
  if (identityState === "invalid") throw new Error("claude-desktop SandBase artifact identity is unrecognized; no changes were made");
  if (credential && (credential.client !== "claude-desktop" || !credential.credential || !credential.credentialId || !credential.scope.includes("mcp:invoke") || !credential.mcpUrl)) throw new Error("Claude Desktop credential ownership is unrecognized; no changes were made");
  try {
    const removedArtifact = await removeClaudeDesktopArtifacts(); const removedIdentity = await removeDesktopIdentity("claude-desktop"); if (credential) await store.remove("claude-desktop"); return removedArtifact || removedIdentity || !!credential;
  } catch (error) {
    await Promise.allSettled([rollbackClaudeDesktopArtifacts({ path: claudeDesktopArtifactPath(), ...(artifactPrevious === undefined ? {} : { previous: artifactPrevious }), changed: true }), rollbackDesktopIdentity({ path: desktopIdentityPath("claude-desktop"), ...(identityPrevious === undefined ? {} : { previous: identityPrevious }), changed: true }), credential ? store.save(credential) : store.remove("claude-desktop")]); throw error;
  }
}
async function unregisterCowork(store: CredentialStore): Promise<boolean> {
  const [connector, identity, credential, connectorPrevious, identityPrevious] = await Promise.all([readCoworkState(), readDesktopIdentity("cowork"), store.get("cowork"), readOptional(coworkStatePath()), readOptional(desktopIdentityPath("cowork"))]);
  if (connector.ownership === "invalid") throw new Error("Cowork connector ownership is unrecognized; no changes were made"); if (identity === "invalid") throw new Error("cowork SandBase artifact identity is unrecognized; no changes were made"); if (credential && (credential.client !== "cowork" || !credential.credential || !credential.credentialId || !credential.scope.includes("mcp:invoke") || !credential.mcpUrl)) throw new Error("Cowork credential ownership is unrecognized; no changes were made");
  try { const removedConnector = await removeCoworkState(); const removedIdentity = await removeDesktopIdentity("cowork"); if (credential) await store.remove("cowork"); return removedConnector || removedIdentity || !!credential; }
  catch (error) { await Promise.allSettled([rollbackCoworkState({ path: coworkStatePath(), ...(connectorPrevious === undefined ? {} : { previous: connectorPrevious }), changed: true }), rollbackDesktopIdentity({ path: desktopIdentityPath("cowork"), ...(identityPrevious === undefined ? {} : { previous: identityPrevious }), changed: true }), credential ? store.save(credential) : store.remove("cowork")]); throw error; }
}
function validOwnedCredential(client: Client, credential?: CredentialRecord): boolean { return !credential || (credential.client === client && !!credential.credential && !!credential.credentialId && credential.scope.includes("mcp:invoke") && !!credential.mcpUrl); }
async function unregisterA1Transaction(client: Extract<Client, "opencode" | "qwen-code" | "windsurf">, store: CredentialStore, runner?: A1CommandRunner): Promise<boolean> {
  const [snapshot, credential] = await Promise.all([snapshotA1Unregister(client), store.get(client)]);
  if (!snapshot) return false; if (!validOwnedCredential(client, credential)) throw new Error(`${client} credential ownership is unrecognized; no changes were made`);
  try { const removed = await unregisterA1(client, process.env, runner); if (removed && credential) await store.remove(client); return removed; }
  catch (error) {
    const restored = await Promise.allSettled([restoreA1Unregister(snapshot), credential ? store.save(credential) : store.remove(client)]);
    if (restored.some(result => result.status === "rejected")) throw new Error(`${error instanceof Error ? error.message : "A1 unregister failed"}; compensation was incomplete`);
    throw error;
  }
}
async function unregisterBTransaction(client: Extract<Client, "gemini-cli" | "cursor-cli" | "kimi-cli" | "kiro-cli">, store: CredentialStore, runner?: BCommandRunner): Promise<boolean> {
  const snapshot = await snapshotBUnregister(client); if (!snapshot) return false; const credential = await store.get(client); if (!validOwnedCredential(client, credential)) throw new Error(`${client} credential ownership is unrecognized; no changes were made`);
  try { const removed = await unregisterB(client, process.env, runner); if (removed && credential) await store.remove(client); return removed; }
  catch (error) { const restored = await Promise.allSettled([restoreBUnregister(snapshot), credential ? store.save(credential) : store.remove(client)]); if (restored.some(result => result.status === "rejected")) throw new Error(`${error instanceof Error ? error.message : "Module B unregister failed"}; compensation was incomplete`); throw error; }
}
async function unregisterCTransaction(client: Extract<Client, "amp" | "crush" | "iflow-cli">, store: CredentialStore, runner?: CCommandRunner): Promise<boolean> {
  const snapshot = await snapshotCUnregister(client, process.env, runner); if (!snapshot) return false; const credential = await store.get(client); if (!validOwnedCredential(client, credential)) throw new Error(`${client} credential ownership is unrecognized; no changes were made`);
  try { const removed = await unregisterC(client, process.env, runner); if (removed && credential) await store.remove(client); return removed; }
  catch (error) { const restored = await Promise.allSettled([restoreCUnregister(snapshot, process.env, runner), credential ? store.save(credential) : store.remove(client)]); if (restored.some(result => result.status === "rejected")) throw new Error(`${error instanceof Error ? error.message : "Module C unregister failed"}; compensation was incomplete`); throw error; }
}
async function unregisterWarpTransaction(store: CredentialStore): Promise<boolean> {
  const snapshot = await snapshotWarpUnregister(); if (!snapshot) return false; const credential = await store.get("warp");
  if (!validOwnedCredential("warp", credential)) throw new Error("warp credential ownership is unrecognized; no changes were made");
  try { const removed = await unregisterWarp(); if (removed && credential) await store.remove("warp"); return removed; }
  catch (error) { const restored = await Promise.allSettled([restoreWarpUnregister(snapshot), credential ? store.save(credential) : store.remove("warp")]); if (restored.some(result => result.status === "rejected")) throw new Error(`${error instanceof Error ? error.message : "Warp unregister failed"}; compensation was incomplete`); throw error; }
}
async function unregisterKiroIDETransaction(store: CredentialStore): Promise<{mcp:boolean;skill:boolean}> {
  const mcp=await snapshotKiroIDEUnregister(),state=await inspectSkill("kiro"),path=skillPath("kiro")!,meta=join(dirname(path),".sandbase-managed.json");
  if(state==="modified")throw new Error("kiro Skill ownership is unrecognized; no changes were made");
  const [skillPrevious,metaPrevious,credential]=await Promise.all([readOptional(path),readOptional(meta),store.get("kiro")]);
  if(!validOwnedCredential("kiro",credential))throw new Error("kiro credential ownership is unrecognized; no changes were made");
  let mcpRemoved=false,skillRemoved=false;
  try{if(mcp){mcpRemoved=await unregisterKiroIDE();if(mcpRemoved&&credential)await store.remove("kiro");}if(state==="installed")skillRemoved=await removeSkill("kiro");return{mcp:mcpRemoved,skill:skillRemoved};}
  catch(error){const work:Promise<unknown>[]=[];if(mcpRemoved&&mcp)work.push(restoreKiroIDEUnregister(mcp),credential?store.save(credential):store.remove("kiro"));if(skillRemoved){work.push(skillPrevious===undefined?restore(path):atomicWrite(path,skillPrevious),metaPrevious===undefined?restore(meta):atomicWrite(meta,metaPrevious));}const settled=await Promise.allSettled(work);if(settled.some(item=>item.status==="rejected"))throw new Error(`${error instanceof Error?error.message:"Kiro IDE unregister failed"}; compensation was incomplete`);throw error;}
}

async function unregisterKiroTransaction(store: CredentialStore, skillsRunner?: SkillsCommandRunner, skillsReadbackVerifier?: SkillsReadbackVerifier, bRunner?: BCommandRunner): Promise<{ mcp: "removed" | "missing"; skill: NativeSkillResult }> {
  // Preflight every MCP-owned state before either lifecycle mutates anything.
  // Skills CLI performs its own immutable-source ownership check immediately
  // before remove, so an absent or third-party Skill is never deleted.
  const ideSkill=await inspectSkill("kiro"),protectedPlan:NativeSkillRemovalPlan={owned:false,result:{status:"confirmation_required",message:"Kiro IDE owns the shared local Skill path; Kiro CLI Skill removal was skipped."}};
  const [snapshot, skillPlan] = await Promise.all([snapshotBUnregister("kiro-cli"), ideSkill==="missing"?planNativeSkillRemoval("kiro-cli", skillsRunner, skillsReadbackVerifier):Promise.resolve(protectedPlan)]);
  const credential = snapshot ? await store.get("kiro-cli") : undefined;
  if (!validOwnedCredential("kiro-cli", credential)) throw new Error("kiro-cli credential ownership is unrecognized; no changes were made");
  let mcpRemoved = false; let skill: NativeSkillResult | undefined;
  try {
    if (snapshot) {
      mcpRemoved = await unregisterB("kiro-cli", process.env, bRunner);
      if (mcpRemoved && credential) await store.remove("kiro-cli");
    }
    skill = await executeNativeSkillRemoval(skillPlan, skillsRunner, skillsReadbackVerifier);
    if (skill.code === "readback_failed") throw new Error(skill.message);
    return { mcp: mcpRemoved ? "removed" : "missing", skill };
  } catch (error) {
    const compensation: Promise<unknown>[] = [];
    if (mcpRemoved && snapshot) compensation.push(restoreBUnregister(snapshot), credential ? store.save(credential) : store.remove("kiro-cli"));
    // A removal readback failure is the only Skill failure that may occur after
    // deletion. Reinstalling the same immutable source is its safe compensation.
    if (skill?.code === "readback_failed") compensation.push(installNativeSkill("kiro-cli", skillsRunner, skillsReadbackVerifier).then(result => {
      if (result.status !== "installed" && result.status !== "already_installed") throw new Error(result.message);
    }));
    const restored = await Promise.allSettled(compensation);
    if (restored.some(result => result.status === "rejected")) throw new Error(`${error instanceof Error ? error.message : "Kiro unregister failed"}; compensation was incomplete`);
    throw error;
  }
}

export async function doctor(client: ConnectClient = "auto", store: CredentialStore = new FileCredentialStore(), detect: (client: Client) => Detection = detectClient, skillsRunner?: SkillsCommandRunner, skillsReadbackVerifier?: SkillsReadbackVerifier, openClawRunner?: OpenClawCommandRunner, openClawReadbackVerifier?: OpenClawReadbackVerifier, a1Runner?: A1CommandRunner, bRunner?: BCommandRunner, cRunner?: CCommandRunner): Promise<boolean> {
  const targets = client === "auto" ? [...new Set([...plannedAutoClients(detect), ...clients.filter(target => !!skillsAgentRegistry[target] && detect(target).installed), ...(detect("openclaw").installed ? ["openclaw" as Client] : [])])] : [client]; if (!targets.length) { console.log("No installed compatible clients support automatic configuration."); return false; }
  let healthy = true;
  for (const target of targets) {
    if (target === "chatgpt") { const [credential, bridge] = await Promise.all([store.get("chatgpt"), inspectBridge()]); const ready=!!credential&&validOwnedCredential("chatgpt",credential)&&bridge==="ready"; console.log(`chatgpt: status=${ready?"action_required":"failed"}, authorization=${ready?"completed":"required"}, credential=${ready?"present":credential?"invalid":"missing"}, bridge=${bridge}, chatgpt_app=not_observable, verification=not_verified, next_step=${ready?nativeCapabilities.chatgpt.guide:"Run sandbase connect --client chatgpt again to prepare the SandBase-owned credential and bridge. No ChatGPT configuration was changed."}`); healthy=false; continue; }
    if (isPromptAssistedClient(target)) { const [credential, bridge] = await Promise.all([store.get(target), inspectBridge()]); const ready=!!credential&&validOwnedCredential(target,credential)&&bridge==="ready"; console.log(`${target}: status=${ready?"action_required":"failed"}, credential=${ready?"present":credential?"invalid":"missing"}, bridge=${bridge}, registration=not_observable, verification=real_client_matrix, next_step=${ready?"Register the displayed local bridge in the client, reload, then read back server/tools and complete one safe call.":`Run sandbase connect --client ${target} again.`}`); healthy=false; continue; }
    if (isDesktopClient(target)) {
      const [credential, identity, bridge, artifact] = await Promise.all([store.get(target), readDesktopIdentity(target), inspectBridge(), target === "claude-desktop" ? readClaudeDesktopArtifactState() : readCoworkState()]);
      const credentialReady = !!credential && validOwnedCredential(target, credential);
      const artifactInvalid = artifact.ownership === "invalid" || artifact.mcp === "invalid" || artifact.skill === "invalid" || ("admin" in artifact && artifact.admin === "invalid");
      const locallyHealthy = credentialReady && identity === "ready" && bridge === "ready" && !artifactInvalid;
      const observable = (state: "ready" | "missing" | "invalid") => state === "missing" ? "not_observable" : state;
      const admin = target === "cowork" && "admin" in artifact ? artifact.admin === "required" ? "not_observable" : artifact.admin : "not_applicable";
      console.log(`${target}: status=${locallyHealthy ? "client_confirmation_required" : "failed"}, credential=${credentialReady ? "present" : credential ? "invalid" : "missing"}, bridge_identity=${identity}, bridge_runtime=${bridge}, mcp_artifact=${observable(artifact.mcp)}, skill_artifact=${observable(artifact.skill)}, admin_confirmation=${admin}, verification=real_client_matrix, next_step=${locallyHealthy ? target === "cowork" ? "Complete the supported Cowork account/workspace administrator import and verify MCP and Skill in a fresh session; local client state is not observable." : "Import both artifacts, restart Claude Desktop, and verify MCP and Skill independently; local client state is not observable." : "Run sandbase connect for this client again or repair the managed bridge; invalid local state was left untouched."}`);
      healthy = healthy && locallyHealthy; continue;
    }
    if (target === "openclaw") {
      const [credential, mcp, skill] = await Promise.all([store.get("openclaw"), inspectOpenClawMcp(openClawRunner), inspectOpenClawSkill(openClawRunner, openClawReadbackVerifier)]);
      const mcpReady = mcp.status === "already_configured"; const skillReady = skill.status === "already_installed";
      console.log(`openclaw: status=${credential && mcpReady && skillReady ? "configured" : "failed"}, credential=${credential ? "present" : "missing"}, mcp=${mcp.status}, skill=${skill.status}, invocation=mcp_chat, verification=read_back, next_step=${mcpReady && skillReady ? "Restart OpenClaw, then make a natural-language request that needs SandBase." : `${mcp.message} ${skill.message}`}`);
      healthy = healthy && !!credential && mcpReady && skillReady;
      continue;
    }
    if (isA1Client(target)) {
      const inspection = await inspectA1(target, process.env, a1Runner); const credential = await store.get(target); const ready = inspection.state === "configured" && !!credential;
      console.log(`${target}: status=${ready ? "configured" : inspection.state === "conflict" ? "confirmation_required" : "failed"}, credential=${credential ? "present" : "missing"}, mcp=${inspection.state}, verification=read_back, next_step=${inspection.detail}`);
      healthy = healthy && detect(target).installed && ready; continue;
    }
    if(target==="kiro"){const [inspection,skill,credential,bridge]=await Promise.all([inspectKiroIDE(),inspectSkill("kiro"),store.get("kiro"),inspectBridge()]),local=inspection.state==="configured"&&skill==="installed"&&!!credential&&bridge==="ready",status=local?"confirmation_required":inspection.state==="confirmation_required"||inspection.state==="conflict"||skill==="modified"?"confirmation_required":"failed";console.log(`kiro: status=${status}, app=${detect(target).installed?"detected":"not_detected"}, credential=${credential?"present":"missing"}, bridge=${bridge}, mcp=${inspection.state}, skill=${skill}, ide_verification=not_observable, next_step=${local?"Reload Kiro IDE, read back SandBase server/tools, and complete one safe tool call.":inspection.detail}`);healthy=false;continue;}
    if (isBClient(target)) {
      const inspection = await inspectB(target, process.env, bRunner);
      // A missing MCP registration has no credential ownership to inspect.
      // This also keeps the native Kiro Skill lifecycle independent.
      const credential = inspection.state === "configured" ? await store.get(target) : undefined;
      if (target === "kiro-cli") {
        const native = await inspectNativeSkill(target, skillsRunner, skillsReadbackVerifier);
        const mcpReady = inspection.state === "configured" && !!credential;
        const mcpMissing = inspection.state === "missing";
        const skillReady = native.status === "already_installed";
        const skillMissing = native.status === "confirmation_required";
        const ready = (mcpReady || skillReady) && (mcpReady || mcpMissing) && (skillReady || skillMissing);
        const status = ready ? "configured" : inspection.state === "conflict" || inspection.state === "confirmation_required" || native.status === "confirmation_required" ? "confirmation_required" : "failed";
        console.log(`${target}: status=${status}, credential=${credential ? "present" : "missing"}, mcp=${mcpMissing ? "not_configured" : inspection.state}, skill=${native.status}, verification=read_back, next_step=${inspection.detail} ${native.message}`);
        healthy = healthy && detect(target).installed && ready; continue;
      }
      const ready=inspection.state==="configured"&&!!credential; console.log(`${target}: status=${ready?"configured":inspection.state==="conflict"||inspection.state==="confirmation_required"?"confirmation_required":"failed"}, credential=${credential?"present":"missing"}, mcp=${inspection.state}, verification=read_back, next_step=${inspection.detail}`); healthy=healthy&&detect(target).installed&&ready; continue;
    }
    if (isCClient(target)) { const inspection=await inspectC(target,process.env,cRunner),credential=inspection.state==="configured"?await store.get(target):undefined,ready=inspection.state==="configured"&&!!credential;const legacy=target==="iflow-cli"?", lifecycle=legacy_vendor_discontinued_2026-04-17, real_client=post_release_user_validation":"";console.log(`${target}: status=${ready?"configured":inspection.state==="conflict"||inspection.state==="confirmation_required"?"confirmation_required":"failed"}, credential=${credential?"present":"missing"}, mcp=${inspection.state}, verification=read_back${legacy}, next_step=${inspection.detail}`);healthy=healthy&&detect(target).installed&&ready;continue;}
    if (target === "warp") { const inspection=await inspectWarp(),credential=inspection.state==="configured"?await store.get(target):undefined,staged=inspection.state==="configured"&&!!credential;console.log(`warp: status=${staged?"action_required":inspection.state==="confirmation_required"||inspection.state==="conflict"?"confirmation_required":"failed"}, credential=${credential?"present":"missing"}, mcp=${inspection.state}, approval=not_observable, verification=read_back, next_step=${staged?"Use /agent-add-mcp in Warp, approve SandBase, then inspect the MCP server/tools and complete one safe call.":inspection.detail}`);healthy=false;continue;}
    if (skillsAgentRegistry[target]) {
      const native = await inspectNativeSkill(target, skillsRunner, skillsReadbackVerifier);
      console.log(`${target}: status=${native.status === "failed" ? "failed" : "confirmation_required"}, mcp=not_configured, skill=${native.status}, invocation=${nativeCapabilities[target].invocation}, verification=read_only_probe, next_step=${native.message}`);
      healthy = healthy && native.status === "already_installed";
      continue;
    }
    const credential = await store.get(target); const profile = clientProfiles[target]; const configured = profile.mode === "auto" ? await isConfigured(target) : !!credential; const detected = detect(target); const skill = await inspectSkill(target);
    const capability = nativeCapabilities[target]; const skillDetail = skill === "installed" ? skillInvocation(target) : skill === "fallback" ? skillFallback(target) : skill === "unsupported" ? "No native SandBase Skill is available for this client." : skill === "modified" ? "Managed native Skill is missing or modified; it was left untouched." : capabilityRegistry[target].nextStep;
    const references = await sharedSkillReferences();
    const status: RuntimeStatus = configured && !!credential && skill === "installed" ? "configured" : "failed";
    console.log(`${target}: status=${status}, mcp=${configured ? "configured" : "not_configured"}, skill=${skill}, invocation=${capability.invocation}, verification=${capability.verification}, shared_skill_references=${references.join(",") || "none"}, next_step=${skillDetail}`);
    healthy = healthy && detected.installed && !!credential && configured && !["missing", "modified"].includes(skill);
  }
  return healthy;
}

export async function unregister(client: ConnectClient = "auto", store: CredentialStore = new FileCredentialStore(), detect: (client: Client) => Detection = detectClient, skillsRunner?: SkillsCommandRunner, skillsReadbackVerifier?: SkillsReadbackVerifier, openClawRunner?: OpenClawCommandRunner, openClawReadbackVerifier?: OpenClawReadbackVerifier, a1Runner?: A1CommandRunner, bRunner?: BCommandRunner, cRunner?: CCommandRunner): Promise<void> {
  const targets = client === "auto" ? [...new Set([...plannedAutoClients(detect), ...clients.filter(target => !!skillsAgentRegistry[target] && detect(target).installed), ...(detect("openclaw").installed ? ["openclaw" as Client] : [])])] : [client]; if (!targets.length) { console.log("No installed compatible clients support automatic configuration."); return; }
  for (const target of targets) {
    if (target === "chatgpt") { const credential=await store.get("chatgpt"); if(credential&&!validOwnedCredential("chatgpt",credential))throw new Error("chatgpt credential ownership is unrecognized; no changes were made"); if(credential)await store.remove("chatgpt"); console.log(`chatgpt: status=${credential?"removed":"missing"}, bridge=retained, third_party_config=preserved, next_step=Only the SandBase-owned local ChatGPT credential was removed. The shared bridge and every ChatGPT App/workspace setting were left untouched; ask a workspace administrator to unpublish or remove the App separately if required.`); continue; }
    if (isPromptAssistedClient(target)) { const credential=await store.get(target); if(credential&&!validOwnedCredential(target,credential))throw new Error(`${target} credential ownership is unrecognized; no changes were made`); if(credential)await store.remove(target); console.log(`${target}: status=${credential?"removed":"missing"}, next_step=No client settings were changed; remove any manual MCP registration in the client, then revoke the CLI key in SandBase Dashboard if needed.`); continue; }
    if (isDesktopClient(target)) { const removed = target === "claude-desktop" ? await unregisterClaudeDesktop(store) : await unregisterCowork(store); console.log(`Removed local SandBase bridge identity for ${target}.${removed ? "" : " No managed identity was changed."} Desktop product settings were left untouched; revoke the server credential in SandBase Dashboard if it is no longer needed.`); continue; }
    if (target === "openclaw") {
      const mcp = await removeOpenClawMcp(openClawRunner);
      const skill = await removeOpenClawSkill(openClawRunner, openClawReadbackVerifier);
      if (mcp.status === "removed" || mcp.status === "missing") await store.remove("openclaw");
      console.log(`openclaw: mcp=${mcp.status}, skill=${skill.status}, next_step=${mcp.message} ${skill.message}`);
      continue;
    }
    if (isA1Client(target)) { const removed = await unregisterA1Transaction(target, store, a1Runner); console.log(`${target}: status=${removed ? "removed" : "confirmation_required"}, next_step=${removed ? "Managed SandBase registration was removed. The shared managed bridge was retained for other clients." : "No SandBase-owned registration was found; credential, bridge, and third-party configuration were left untouched."}`); continue; }
    if (target === "kiro-cli") { const result=await unregisterKiroTransaction(store,skillsRunner,skillsReadbackVerifier,bRunner); console.log(`${target}: mcp=${result.mcp}, skill=${result.skill.status}, next_step=${result.mcp==="removed"?"Managed persistent SandBase registration was removed; the shared bridge was retained.":"No SandBase-owned MCP registration was found."} ${result.skill.message}`); continue; }
    if (isBClient(target)) { const removed=await unregisterBTransaction(target,store,bRunner); console.log(`${target}: status=${removed?"removed":"confirmation_required"}, next_step=${removed?"Managed persistent SandBase registration was removed; the shared bridge was retained.":"No owned registration was found; all local state was left untouched."}`); continue; }
    if (isCClient(target)) { const removed=await unregisterCTransaction(target,store,cRunner);console.log(`${target}: status=${removed?"removed":"confirmation_required"}, next_step=${removed?`Managed ${target==="iflow-cli"?"legacy user-scope ":"global "}SandBase registration was removed; the shared bridge was retained.`:"No owned registration was found; all local state was left untouched."}`);continue;}
    if (target === "warp") { const removed=await unregisterWarpTransaction(store);console.log(`warp: status=${removed?"removed":"confirmation_required"}, next_step=${removed?"Managed Warp user registration was removed; project files and the shared bridge were retained.":"No SandBase-owned Warp registration was found; all local state was left untouched."}`);continue;}
    if(target==="kiro"){const removed=await unregisterKiroIDETransaction(store);console.log(`kiro: mcp=${removed.mcp?"removed":"missing"}, skill=${removed.skill?"removed":"missing"}, next_step=Only Kiro IDE-owned state was changed; kiro-cli credentials and configuration were retained.`);continue;}
    if (skillsAgentRegistry[target]) { const result = await removeNativeSkill(target, skillsRunner, skillsReadbackVerifier); console.log(`${target}: mcp=not_configured, skill=${result.status}, next_step=${result.message}`); continue; }
    if (capabilityRegistry[target].implementation === "blocked") { console.log(`${target}: status=failed, next_step=${capabilityRegistry[target].nextStep}`); continue; }
    const removed = await removeAdapter(target); const removedSkill = await removeSkill(target); await store.remove(target); console.log(`Removed local SandBase registration for ${target}.${removed || removedSkill ? "" : " No managed client configuration or Skill was changed."} Revoke the server credential in SandBase Dashboard if it is no longer needed.`);
  }
}
