#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// This file is both the installed standalone bridge and the runtime loaded by
// dist/cli.js. Keep the proxy implementation here so the two launchers cannot
// drift. It must stay dependency-free: it is copied to ~/.sandbase/bin.
//
// Agent-facing guarantees:
// 1. The SandBase server and its tools stay visible even when the network is
//    down (initialize/tools/list are answered locally), so the client never
//    silently drops the server.
// 2. Every tool failure reaches the model as an `isError` tool result that
//    names the cause and the next step, instead of an opaque protocol error.
// 3. The API is reached only at api.sandbase.ai (the single API host); a
//    transport failure keeps the server usable via the offline responder.
const allowedClients = new Set(["codex", "claude-code", "cursor", "gemini-cli", "hermes", "openclaw", "opencode", "qwen-code", "windsurf", "cursor-cli", "kimi-cli", "kiro", "kiro-cli", "amp", "crush", "iflow-cli", "warp", "claude-desktop", "cowork", "antigravity", "trae", "qoder", "workbuddy", "pi"]);
const BILLING_URL = "https://www.sandbase.ai/console/billing";
const RECONNECT = "npx -y @sandbaseai/cli@latest connect";
// Tool calls get no bridge-side deadline (long synchronous tools must be able to
// finish); control-plane methods are bounded so offline detection stays quick.
const CONTROL_TIMEOUT_MS = 60_000;
// Runs are synchronous for the agent: the server waits up to ~50s per call, and
// when a job is still going the bridge keeps waiting locally so the agent gets
// the finished output instead of a run id to poll. Clients that allow long tool
// calls (Claude Code; Codex with the tool_timeout_sec that connect writes) wait
// in one call; others get bounded waits that stay under their 60s tool timeout.
const RUN_POLL_MS = 3_000;
const LONG_RUN_WAIT_MS = 20 * 60_000;
const BOUNDED_RUN_WAIT_MS = 50_000;
const MAX_POLL_FAILURES = 5;
// Claude Code allows very long MCP tool calls by default. Codex only does when
// its config raises tool_timeout_sec, which `connect` writes together with
// SANDBASE_LONG_TOOL_CALLS=1 — so an older Codex config keeps bounded waits.
function allowsLongToolCalls(client, env) {
  return client === "claude-code" || (client === "codex" && env.SANDBASE_LONG_TOOL_CALLS === "1");
}

// Used only when SandBase is unreachable and no tools/list was ever cached.
const offlineTools = [
  { name: "sandbase_discover", title: "Discover", description: "Search SandBase models, APIs, and Agent Services by what you need (e.g. 'twitter posts', 'text to video', '小红书'). Call this before writing a scraper or declaring data inaccessible.", inputSchema: { type: "object", properties: { q: { type: "string" }, type: { type: "string", enum: ["llm", "api", "multimodal", "embedding", "service"] }, vendor: { type: "string" }, limit: { type: "integer" } }, additionalProperties: false } },
  { name: "sandbase_inspect", title: "Inspect", description: "Get a tool's input schema, price, and a ready-to-run template. Always inspect before running.", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false } },
  { name: "sandbase_run", title: "Run", description: "Execute a SandBase model, API, or Agent Service with arguments matching the inspected schema.", inputSchema: { type: "object", properties: { name: { type: "string" }, arguments: { type: "object" } }, required: ["name", "arguments"], additionalProperties: false } },
  { name: "sandbase_run_get", title: "Get Run Result", description: "Get the status, cost, and output of an async run.", inputSchema: { type: "object", properties: { run_id: { type: "string" }, service_id: { type: "string" }, cursor: { type: "string" }, limit: { type: "integer" } }, required: ["run_id"], additionalProperties: false } },
  { name: "sandbase_runs", title: "List Runs", description: "List recent runs with cost.", inputSchema: { type: "object", properties: { limit: { type: "integer" }, model: { type: "string" }, service_id: { type: "string" }, offset: { type: "integer" } }, additionalProperties: false } },
  { name: "sandbase_account", title: "Account", description: "Check the SandBase balance. Free.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "sandbase_run_cancel", title: "Cancel Service Run", description: "Request cancellation of an Agent Service run.", inputSchema: { type: "object", properties: { service_id: { type: "string" }, run_id: { type: "string" }, idempotency_key: { type: "string" } }, required: ["service_id", "run_id", "idempotency_key"], additionalProperties: false } },
];

function bridgeError(message) { return new Error(message); }
function responseError(id, message) { return JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } }) + "\n"; }
function toolError(id, message) { return JSON.stringify({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: message }], isError: true } }) + "\n"; }
function validEndpoint(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.hash && url.pathname === "/v1/mcp" ? url.href : undefined;
  } catch { return undefined; }
}
function parseCredential(raw, client) {
  let all;
  try { all = JSON.parse(raw); } catch { throw bridgeError("SandBase credential store is invalid. Run sandbase connect again."); }
  const record = all && typeof all === "object" && !Array.isArray(all) ? all[client] : undefined;
  const mcpUrl = typeof record?.mcpUrl === "string" ? validEndpoint(record.mcpUrl) : undefined;
  if (record?.client !== client || typeof record?.credential !== "string" || !record.credential || !mcpUrl) throw bridgeError("SandBase credential is unavailable. Run sandbase connect again.");
  return { credential: record.credential, mcpUrl };
}
export function describeNetworkFailure(error) {
  const code = error?.cause?.code || error?.code || "";
  if (error?.name === "TimeoutError" || error?.name === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT") return "connection timed out";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS lookup failed";
  if (code === "ECONNREFUSED") return "connection refused";
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return "connection reset";
  if (/CERT|SSL|TLS/i.test(code)) return `TLS error (${code})`;
  return code ? `network error (${code})` : "network error";
}
/** True when the request provably never reached the server, so another host cannot duplicate work. */
export function isPreSendFailure(error) {
  const code = error?.cause?.code || error?.code || "";
  return ["UND_ERR_CONNECT_TIMEOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "EADDRNOTAVAIL"].includes(code) || /CERT|SSL|TLS/i.test(code);
}
/** Starting or cancelling billable work must never be replayed after it may have been sent. */
export function isIdempotentRequest(request) {
  return request?.method !== "tools/call" || (request?.params?.name !== "sandbase_run" && request?.params?.name !== "sandbase_run_cancel");
}
export function hintFor(message) {
  const text = String(message || "").toLowerCase();
  // Auth first: "API key not found" is a sign-in problem, not a misspelled tool.
  if (/unauthori[sz]ed|api key|credential|revoked|expired|authenticat|sign-in|signin/.test(text)) return `The SandBase sign-in is not valid. Ask the user to run \`${RECONNECT}\` in a terminal.`;
  if (/insufficient (balance|credit|funds)|payment required|spending limit|top up/.test(text)) return `Tell the user their SandBase balance is insufficient; they can top up at ${BILLING_URL}.`;
  if (/rate.?limit|too many requests|429/.test(text)) return "Rate limited: wait 10-30 seconds, then retry once.";
  if (/run .*not found|task not found/.test(text)) return "Use the prediction_id/run_id returned by sandbase_run, or list recent runs with sandbase_runs. Agent Service runs also need service_id.";
  if (/invalid service request|unknown tool|tool(?: '[^']*')? (?:was )?not found|model not found|tool name is required/.test(text)) return "Check the exact tool name with sandbase_discover (names look like sandbase_twitter_web_search_timeline), then sandbase_inspect it.";
  if (/invalid (params|arguments|input)|is required|schema|must be|unexpected field|additional propert/.test(text)) return "Call sandbase_inspect for this tool and pass exactly the fields in its inputSchema.";
  if (/capability call failed|upstream|provider|bad gateway|timeout|unavailable/.test(text)) return "The upstream provider failed. Retry once; if it fails again, pick another tool from sandbase_discover.";
  return "";
}
function httpFailure(status, text, host) {
  let detail = "";
  try { const parsed = JSON.parse(text); const e = parsed?.error; detail = typeof e === "string" ? e : typeof e?.message === "string" ? e.message : typeof parsed?.message === "string" ? parsed.message : ""; } catch { /* non-JSON gateway body is never forwarded */ }
  const suffix = detail ? `: ${detail.slice(0, 300)}` : "";
  if (status === 401) return `SandBase rejected the saved sign-in (401)${suffix}. Ask the user to run \`${RECONNECT}\` in a terminal to sign in again.`;
  if (status === 402) return `SandBase balance is insufficient or a spending limit was reached (402)${suffix}. The user can top up at ${BILLING_URL}.`;
  if (status === 403) return `This SandBase credential is not allowed for this request (403)${suffix}. Ask the user to run \`${RECONNECT}\`.`;
  if (status === 429) return `SandBase rate limit reached (429)${suffix}. Wait 10-30 seconds, then retry once.`;
  if (status >= 500) return `SandBase returned HTTP ${status} from ${host}${suffix}. Temporary server error: retry in a minute; the user can run \`sandbase doctor\` if it persists.`;
  return `SandBase MCP request failed (${status}) at ${host}${suffix}.${hintFor(detail) ? ` ${hintFor(detail)}` : ""}`;
}
// Same rule as the CLI: only an explicit failure is failed; any status we do not
// know (IN_QUEUE, created, …) is still running, so the bridge keeps waiting.
const SUCCEEDED_STATUSES = new Set(["completed", "succeeded", "success", "done"]);
const FAILED_STATUSES = new Set(["failed", "failure", "error", "errored", "cancelled", "canceled", "timeout", "timed_out", "expired", "rejected", "blocked", "stopped"]);
function runPhase(status) {
  const value = String(status ?? "").trim().toLowerCase();
  return SUCCEEDED_STATUSES.has(value) ? "succeeded" : FAILED_STATUSES.has(value) ? "failed" : "running";
}
function structuredOf(payload) { const value = payload?.result?.structuredContent; return value && typeof value === "object" ? value : undefined; }
/** A run result the bridge should keep waiting on: still running, or completed while its files are still being copied. */
function awaitingRun(payload) {
  const data = structuredOf(payload);
  if (!data || payload?.result?.isError) return false;
  if (data.service_id || String(data.tool_name ?? data.name ?? "").startsWith("svc_")) return false;
  const phase = runPhase(data.status);
  if (phase === "running") return true;
  return phase === "succeeded" && (data.output === undefined || data.output === null) && /still being transferred/i.test(JSON.stringify(data.hints ?? ""));
}
function runIdOf(payload) { const data = structuredOf(payload) || {}; const id = data.run_id ?? data.prediction_id ?? data.taskId; return typeof id === "string" && id ? id : undefined; }
function sleep(ms, signal) {
  return new Promise(resolve => {
    if (signal?.aborted) { resolve(); return; }
    const timer = setTimeout(() => { signal?.removeEventListener("abort", stop); resolve(); }, ms);
    const stop = () => { clearTimeout(timer); resolve(); };
    signal?.addEventListener("abort", stop, { once: true });
  });
}
/** The finished run as the agent should see it: output as text, failures as isError. */
function finalRunResult(id, payload, runId) {
  const data = structuredOf(payload) || {};
  if (runPhase(data.status) === "failed") {
    const error = data.error;
    const detail = typeof error === "string" ? error : typeof error?.message === "string" ? error.message : "";
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Run ${runId} failed${detail ? `: ${detail}` : ""}. Read the error, fix the arguments with sandbase_inspect if needed, then retry once or choose another tool from sandbase_discover.` }], structuredContent: data, isError: true } };
  }
  const output = data.output;
  const text = output === undefined || output === null ? JSON.stringify(data) : typeof output === "string" ? output : JSON.stringify(output, null, 2);
  return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], structuredContent: data, isError: false } };
}

function payloadsOf(text, contentType) {
  const out = [];
  if (!text.trim()) return out;
  if (contentType.includes("text/event-stream")) {
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try { out.push(JSON.parse(payload)); } catch { /* Never forward an untrusted non-JSON body to the client. */ }
    }
    return out;
  }
  try { out.push(JSON.parse(text)); return out; }
  catch {
    for (const line of text.split(/\r?\n/)) {
      const payload = line.trim();
      if (!payload) continue;
      try { out.push(JSON.parse(payload)); } catch { /* Never forward an untrusted non-JSON body to the client. */ }
    }
  }
  return out;
}

export async function runMCPBridge(options = {}) {
  const client = options.client;
  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  const signal = options.signal;
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const runPollMs = Number.isFinite(options.runPollMs) && options.runPollMs > 0 ? options.runPollMs : RUN_POLL_MS;
  if (!allowedClients.has(client)) throw bridgeError("SandBase bridge client is invalid.");

  const home = env.SANDBASE_HOME || join(homedir(), ".sandbase");
  let raw;
  try { raw = await readFile(join(home, "credentials.json"), "utf8"); }
  catch { throw bridgeError("SandBase credential is unavailable. Run sandbase connect again."); }
  const record = parseCredential(raw, client);
  const url = record.mcpUrl;
  const host = new URL(url).host;
  const toolsCache = join(home, "cache", "tools.json");
  let buffer = Buffer.alloc(0);
  let session;

  const cachedTools = async () => { try { const value = JSON.parse(await readFile(toolsCache, "utf8")); if (Array.isArray(value?.tools) && value.tools.length) return value.tools; } catch { /* fall back to the bundled list */ } return offlineTools; };
  const rememberTools = async tools => { if (!Array.isArray(tools) || !tools.length) return; try { await mkdir(join(home, "cache"), { recursive: true, mode: 0o700 }); const tmp = `${toolsCache}.tmp-${process.pid}`; await writeFile(tmp, JSON.stringify({ savedAt: new Date().toISOString(), tools }) + "\n", { mode: 0o600 }); await rename(tmp, toolsCache); } catch { /* cache is best effort */ } };

  const offline = async (request, reason) => {
    const id = request.id;
    if (id === undefined) return;
    const message = `SandBase is unreachable from this machine (${reason}). Tell the user to check their network, proxy, or VPN, then run \`sandbase doctor\` in a terminal. Do not retry this call until connectivity is restored.`;
    if (request.method === "initialize") {
      const version = typeof request.params?.protocolVersion === "string" ? request.params.protocolVersion : "2025-06-18";
      output.write(JSON.stringify({ jsonrpc: "2.0", id, result: { protocolVersion: version, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "sandbase", title: "SandBase", version: "bridge-offline" }, instructions: `SandBase tools are available but the service is currently unreachable (${reason}). Tool calls return an error with the fix until connectivity is restored.` } }) + "\n");
    } else if (request.method === "tools/list") output.write(JSON.stringify({ jsonrpc: "2.0", id, result: { tools: await cachedTools() } }) + "\n");
    else if (request.method === "tools/call") output.write(toolError(id, message));
    else if (request.method === "ping") output.write(JSON.stringify({ jsonrpc: "2.0", id, result: {} }) + "\n");
    else output.write(responseError(id, message));
  };

  const deliver = async (request, payload) => {
    if (request.method === "tools/call" && payload && typeof payload === "object" && payload.error && payload.id === request.id) {
      // Tool execution failures must be visible to the model so it can self-correct.
      const message = typeof payload.error.message === "string" && payload.error.message ? payload.error.message : "SandBase tool call failed";
      const hint = hintFor(message);
      output.write(toolError(request.id, hint ? `${message}. ${hint}` : message));
      return;
    }
    if (request.method === "tools/list" && payload?.id === request.id && Array.isArray(payload?.result?.tools)) await rememberTools(payload.result.tools);
    output.write(JSON.stringify(payload) + "\n");
  };

  const post = async (request, timeoutMs) => {
    const headers = { authorization: `Bearer ${record.credential}`, "content-type": "application/json", accept: "application/json, text/event-stream" };
    if (session) headers["mcp-session-id"] = session;
    const timeout = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
    const combined = signal && timeout && typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : signal || timeout;
    return fetchImpl(url, { method: "POST", headers, body: JSON.stringify(request), ...(combined ? { signal: combined } : {}) });
  };

  let pollSeq = 0;
  /** One sandbase_run_get read: { payload } on an answer, { failed, fatal } on a transport/HTTP/protocol problem. */
  const readRun = async (runId, timeoutMs) => {
    const request = { jsonrpc: "2.0", id: `sandbase-bridge-poll-${++pollSeq}`, method: "tools/call", params: { name: "sandbase_run_get", arguments: { run_id: runId } } };
    try {
      const response = await post(request, Math.max(1_000, Math.min(CONTROL_TIMEOUT_MS, timeoutMs)));
      const text = await response.text();
      if (!response.ok) return { failed: true, fatal: response.status === 401 || response.status === 403 };
      const payload = payloadsOf(text, response.headers.get("content-type") || "").find(item => item?.id === request.id && (item.result || item.error));
      return payload?.result ? { payload } : { failed: true };
    } catch { return { failed: true }; }
  };

  // One cancel handle per in-flight tools/call id, registered before the request
  // is sent, so notifications/cancelled (or stdin closing) can stop it at any point.
  const calls = new Map();
  const CANCELLED = Symbol("cancelled");

  /** Keep a still-running run going until it has a result or the wait budget passes. */
  const awaitRun = async (request, initial, budgetMs, cancel) => {
    const runId = runIdOf(initial);
    if (!runId || budgetMs <= 0) return initial;
    const progressToken = request.params?._meta?.progressToken;
    const deadline = Date.now() + budgetMs;
    const stop = signal && typeof AbortSignal.any === "function" ? AbortSignal.any([signal, cancel.signal]) : cancel.signal;
    let latest = initial, progress = 0, failures = 0;
    {
      while (!stop.aborted && Date.now() + runPollMs <= deadline) {
        await sleep(runPollMs, stop);
        if (cancel.signal.aborted) return CANCELLED;
        if (stop.aborted) break;
        if (progressToken !== undefined) output.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/progress", params: { progressToken, progress: ++progress, message: `SandBase run ${runId} is still running` } }) + "\n");
        const read = await readRun(runId, deadline - Date.now());
        if (cancel.signal.aborted) return CANCELLED;
        if (read.failed) {
          // A revoked sign-in or a persistent outage must not turn into a silent
          // multi-minute wait: give the agent the run id and stop.
          if (read.fatal || ++failures >= MAX_POLL_FAILURES) break;
          continue;
        }
        failures = 0;
        latest = read.payload;
        // A tool error while reading the run (e.g. run not found) goes to the agent as-is.
        if (latest.result?.isError) return { ...latest, id: request.id };
        if (!awaitingRun(latest)) return finalRunResult(request.id, latest, runId);
      }
    }
    // Still running when the budget ran out: return the latest status (with its
    // run id and next step) under the agent's request id.
    return { ...latest, id: request.id };
  };
  const longWait = allowsLongToolCalls(client, env);
  const runWaitBudget = request => {
    if (request.method !== "tools/call") return 0;
    const name = request.params?.name;
    const args = request.params?.arguments || {};
    if (name === "sandbase_run" && !String(args.name ?? "").startsWith("svc_")) return longWait ? LONG_RUN_WAIT_MS : 0;
    if (name === "sandbase_run_get" && !args.service_id) return longWait ? LONG_RUN_WAIT_MS : BOUNDED_RUN_WAIT_MS;
    return 0;
  };

  const forward = async line => {
    let request;
    try { request = JSON.parse(line); } catch { return; }
    if (!request || typeof request !== "object" || Array.isArray(request)) return;
    const idempotent = isIdempotentRequest(request);
    // A cancelled request stops its local wait; the notification still goes to the server.
    if (request.method === "notifications/cancelled") calls.get(request.params?.requestId)?.abort();
    const tracked = request.method === "tools/call" && request.id !== undefined;
    const cancel = new AbortController();
    if (tracked) calls.set(request.id, cancel);
    try { await send(request, idempotent, cancel); }
    finally { if (tracked && calls.get(request.id) === cancel) calls.delete(request.id); }
  };

  const send = async (request, idempotent, cancel) => {
    let response;
    try {
      response = await post(request, request.method === "tools/call" ? undefined : CONTROL_TIMEOUT_MS);
    } catch (error) {
      if (signal?.aborted) return;
      const reason = describeNetworkFailure(error);
      if (!idempotent && !isPreSendFailure(error)) {
        // The run may already be executing; blindly retrying would bill twice.
        if (request.id !== undefined) output.write(toolError(request.id, `The request to ${host} was interrupted after it was sent (${reason}); a run may have started. Do not call sandbase_run again yet: check sandbase_runs for the new run and poll it with sandbase_run_get.`));
        return;
      }
      // Transport failure: keep the server usable (tools stay listed, calls get an actionable error).
      await offline(request, `${host}: ${reason}`);
      return;
    }
    const text = await response.text();
    const nextSession = response.headers.get("mcp-session-id");
    if (nextSession) session = nextSession;
    if (!response.ok) {
      if (request.id === undefined) return;
      // Never let a server error during the handshake make the client drop SandBase.
      if (response.status >= 500 && (request.method === "initialize" || request.method === "tools/list")) { await offline(request, `${host}: HTTP ${response.status}`); return; }
      const message = httpFailure(response.status, text, host);
      output.write(request.method === "tools/call" ? toolError(request.id, message) : responseError(request.id, message));
      return;
    }
    const budget = runWaitBudget(request);
    for (let payload of payloadsOf(text, response.headers.get("content-type") || "")) {
      // MCP: no response is sent for a request the client cancelled.
      if (cancel.signal.aborted && payload?.id === request.id) continue;
      if (budget > 0 && payload?.id === request.id && awaitingRun(payload)) payload = await awaitRun(request, payload, budget, cancel);
      if (payload === CANCELLED) continue;
      await deliver(request, payload);
    }
  };
  // Tool calls run concurrently (each answers by its own id), so a long run never
  // blocks pings, other tools, or the client's cancellation of that run.
  const inflight = new Set();
  const dispatch = async line => {
    let method;
    try { method = JSON.parse(line)?.method; } catch { /* forward() ignores it */ }
    if (method !== "tools/call") { await forward(line); return; }
    const task = forward(line).catch(() => {}).finally(() => inflight.delete(task));
    inflight.add(task);
  };

  const stopInput = () => { if (typeof input.destroy === "function") input.destroy(); };
  signal?.addEventListener("abort", stopInput, { once: true });
  try {
    for await (const chunk of input) {
      if (signal?.aborted) break;
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      for (;;) {
        const split = buffer.indexOf("\n");
        if (split < 0) break;
        const line = buffer.subarray(0, split).toString("utf8").trim();
        buffer = buffer.subarray(split + 1);
        if (line) await dispatch(line);
      }
    }
    const finalLine = buffer.toString("utf8").trim();
    if (!signal?.aborted && finalLine) await dispatch(finalLine);
    // The client closed stdin: nobody can receive a long wait's answer, so stop
    // local waits now; requests already sent finish within their server budget.
    for (const cancel of calls.values()) cancel.abort();
    await Promise.allSettled([...inflight]);
  } catch (error) {
    if (!signal?.aborted) throw error;
  } finally { signal?.removeEventListener("abort", stopInput); }
}

function mainClient(argv) {
  return argv.length === 2 && argv[0] === "--client" && allowedClients.has(argv[1]) ? argv[1] : undefined;
}
const isMain = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const client = mainClient(process.argv.slice(2));
  if (!client) { process.stderr.write("Usage: sandbase-mcp-bridge --client <supported-client>\n"); process.exitCode = 2; }
  else {
    const controller = new AbortController();
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => controller.abort());
    try { await runMCPBridge({ client, signal: controller.signal }); }
    catch (error) { process.stderr.write(`${error instanceof Error ? error.message : "SandBase bridge failed."}\n`); process.exitCode = 1; }
  }
}
