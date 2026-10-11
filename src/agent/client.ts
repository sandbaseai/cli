// Agent-facing SandBase client: one JSON-RPC-over-HTTP path to the public MCP
// endpoint, shared by the discover/inspect/run/runs/balance commands and by
// `sandbase doctor`. Every failure becomes a SandBaseError carrying a stable
// code plus a concrete next step, so an agent reading the output knows what to
// do instead of giving up.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sandbaseHome } from "../paths.js";
import { clients, type Client, type CredentialRecord } from "../types.js";

export const DEFAULT_MCP_URL = "https://api.sandbase.ai/v1/mcp";
// What to try when SandBase cannot be reached. api.sandbase.ai is the only API
// host (#64), so a network/proxy/firewall block there has no implicit fallback —
// the one self-serve escape is pointing the CLI at a reachable mirror.
export const UNREACHABLE_HINT = "Run `sandbase doctor` to pinpoint it. If api.sandbase.ai is blocked on this network (proxy, firewall, or regional routing), set SANDBASE_MCP_FALLBACK_URLS to a reachable mirror (comma-separated, each ending in /v1/mcp), or SANDBASE_MCP_URL to replace the endpoint.";
const PREFERENCE_TTL_MS = 6 * 60 * 60 * 1000;

export type ErrorCode =
  | "AUTH_REQUIRED" | "AUTH_FAILED" | "INSUFFICIENT_BALANCE" | "FORBIDDEN" | "NOT_FOUND" | "RATE_LIMITED"
  | "INVALID_INPUT" | "NETWORK" | "UPSTREAM" | "RUN_FAILED" | "INVALID_RESPONSE" | "TOOL_ERROR" | "USAGE";

export class SandBaseError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly hint?: string, readonly status?: number, readonly runId?: string) { super(message); this.name = "SandBaseError"; }
}

export function webUrl(env = process.env): string { return (env.SANDBASE_WEB_URL || "https://www.sandbase.ai").replace(/\/+$/, ""); }
export function billingUrl(env = process.env): string { return `${webUrl(env)}/console/billing`; }
export function keysUrl(env = process.env): string { return `${webUrl(env)}/console/keys`; }
export const CONNECT_COMMAND = "npx -y @sandbaseai/cli@latest connect";

export function validMcpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.hash && url.pathname === "/v1/mcp" ? url.href : undefined;
  } catch { return undefined; }
}

/**
 * Ordered endpoint candidates: the recorded URL first, then any extra mirrors
 * the user explicitly opted into via SANDBASE_MCP_FALLBACK_URLS. The API is
 * served only from api.sandbase.ai, so there is no implicit cross-host
 * fallback — the main-site and bare hosts are not API entry points.
 */
export function endpointCandidates(primary: string, env = process.env): string[] {
  const out = [primary];
  const configured = env.SANDBASE_MCP_FALLBACK_URLS;
  if (configured !== undefined) {
    for (const item of configured.split(",").map(value => value.trim()).filter(Boolean)) { const url = validMcpUrl(item); if (url) out.push(url); }
  }
  return [...new Set(out)];
}

export interface Endpoint { credential: string; urls: string[]; source: string }
export interface StoredKey { key: string; mcpUrl?: string; addedAt: string }
export function keyFilePath(env = process.env): string { return join(sandbaseHome(env), "cli-key.json"); }
export async function readStoredKey(env = process.env): Promise<StoredKey | undefined> {
  try { const value = JSON.parse(await readFile(keyFilePath(env), "utf8")) as StoredKey; return typeof value?.key === "string" && value.key ? value : undefined; }
  catch { return undefined; }
}
async function readCredentials(env: NodeJS.ProcessEnv): Promise<Partial<Record<Client, CredentialRecord>>> {
  try { const value: unknown = JSON.parse(await readFile(join(sandbaseHome(env), "credentials.json"), "utf8")); return value && typeof value === "object" && !Array.isArray(value) ? value as Partial<Record<Client, CredentialRecord>> : {}; }
  catch { return {}; }
}
function usable(record: CredentialRecord | undefined, client: Client): record is CredentialRecord { return !!record && record.client === client && typeof record.credential === "string" && !!record.credential && !!validMcpUrl(record.mcpUrl); }

/**
 * Credential precedence: SANDBASE_API_KEY → `sandbase keys add` → the record of
 * --client / SANDBASE_CLIENT → any connected client record. Connected client
 * records are the browser sign-in result, so most users never paste a key.
 */
export async function resolveEndpoint(options: { client?: string } = {}, env = process.env): Promise<Endpoint> {
  const override = env.SANDBASE_MCP_URL ? validMcpUrl(env.SANDBASE_MCP_URL) : undefined;
  if (env.SANDBASE_MCP_URL && !override) throw new SandBaseError("USAGE", "SANDBASE_MCP_URL must be an http(s) URL ending in /v1/mcp.");
  if (env.SANDBASE_API_KEY) return { credential: env.SANDBASE_API_KEY, urls: endpointCandidates(override || DEFAULT_MCP_URL, env), source: "env:SANDBASE_API_KEY" };
  const wanted = options.client || env.SANDBASE_CLIENT;
  if (!wanted) {
    const stored = await readStoredKey(env);
    if (stored) return { credential: stored.key, urls: endpointCandidates(override || validMcpUrl(stored.mcpUrl) || DEFAULT_MCP_URL, env), source: "keys" };
  }
  const records = await readCredentials(env);
  if (wanted) {
    const record = records[wanted as Client];
    if (!usable(record, wanted as Client)) throw new SandBaseError("AUTH_REQUIRED", `No SandBase credential is stored for client "${wanted}".`, `Run \`${CONNECT_COMMAND} --client ${wanted}\`, or omit --client to use any connected client.`);
    return { credential: record.credential, urls: endpointCandidates(override || record.mcpUrl, env), source: `client:${wanted}` };
  }
  for (const client of clients) {
    const record = records[client];
    if (usable(record, client)) return { credential: record.credential, urls: endpointCandidates(override || record.mcpUrl, env), source: `client:${client}` };
  }
  throw new SandBaseError("AUTH_REQUIRED", "No SandBase credential found on this machine.", `Run \`${CONNECT_COMMAND}\` (browser sign-in, nothing to paste), or create an API key at ${keysUrl(env)} and run \`sandbase keys add -k <key>\` (or set SANDBASE_API_KEY).`);
}

/** True when the request provably never reached the server, so resending it elsewhere cannot duplicate work. */
export function isPreSendFailure(error: unknown): boolean {
  const err = error as { code?: string; cause?: { code?: string } };
  const code = err?.cause?.code || err?.code || "";
  return ["UND_ERR_CONNECT_TIMEOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "EADDRNOTAVAIL"].includes(code) || /CERT|SSL|TLS/i.test(code);
}

/** Calls that start or cancel billable work must never be replayed on another host after they may have been sent. */
export function isIdempotentRequest(method: string, params: unknown): boolean {
  if (method !== "tools/call") return true;
  const name = (params as { name?: unknown } | undefined)?.name;
  return name !== "sandbase_run" && name !== "sandbase_run_cancel";
}

export function describeNetworkFailure(error: unknown): string {
  const err = error as { name?: string; code?: string; cause?: { code?: string; name?: string; message?: string } };
  const code = err?.cause?.code || err?.code || "";
  if (err?.name === "TimeoutError" || err?.name === "AbortError" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT") return "connection timed out";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS lookup failed";
  if (code === "ECONNREFUSED") return "connection refused";
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return "connection reset";
  if (/CERT|SSL|TLS/i.test(code)) return `TLS error (${code})`;
  return code ? `network error (${code})` : "network error";
}

/** Map a server/tool error message to the most useful next step. */
export function hintForMessage(message: string, env = process.env): string | undefined {
  const text = message.toLowerCase();
  // Auth first: "API key not found" is a sign-in problem, not a misspelled tool.
  if (/unauthori[sz]ed|api key|credential|revoked|expired|authenticat|sign-in|signin/.test(text)) return `Sign in again with \`${CONNECT_COMMAND}\`, or check SANDBASE_API_KEY.`;
  if (/insufficient (balance|credit|funds)|payment required|spending limit|top up/.test(text)) return `Top up at ${billingUrl(env)}, then retry.`;
  if (/rate.?limit|too many requests|429/.test(text)) return "Rate limited. Wait 10-30 seconds, then retry once.";
  if (/run .*not found|task not found/.test(text)) return "Use the run_id printed by `sandbase run` (or find it with `sandbase runs list`). Agent Service runs also need --service <svc_id>.";
  if (/invalid service request|unknown tool|tool(?: '[^']*')? (?:was )?not found|model not found|tool name is required/.test(text)) return "Check the exact name with `sandbase discover -q \"<what you need>\"` (MCP: sandbase_discover). Names look like sandbase_twitter_web_search_timeline.";
  if (/invalid (params|arguments|input)|is required|schema|must be|unexpected field|additional propert/.test(text)) return "Re-read the input schema with `sandbase inspect <name>` (MCP: sandbase_inspect) and pass exactly those fields.";
  if (/capability call failed|upstream|provider|bad gateway|timeout|unavailable/.test(text)) return "The upstream provider failed. Retry once; if it fails again, choose another tool from discover.";
  return undefined;
}

export function httpError(status: number, body: string, host: string, env = process.env): SandBaseError {
  let message = "";
  try { const parsed = JSON.parse(body) as { error?: unknown; message?: unknown }; const e = parsed.error; message = typeof e === "string" ? e : e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string" ? (e as { message: string }).message : typeof parsed.message === "string" ? parsed.message : ""; } catch { /* gateway HTML or empty body: the status carries the meaning */ }
  const detail = message ? `: ${message}` : "";
  if (status === 401) return new SandBaseError("AUTH_FAILED", `SandBase rejected the saved sign-in or API key (401)${detail}.`, `Sign in again with \`${CONNECT_COMMAND}\`, or create a new key at ${keysUrl(env)}.`, status);
  if (status === 402) return new SandBaseError("INSUFFICIENT_BALANCE", `Insufficient balance or spending limit reached (402)${detail}.`, `Top up at ${billingUrl(env)}, then retry.`, status);
  if (status === 403) return new SandBaseError("FORBIDDEN", `This credential is not allowed to call ${host} (403)${detail}.`, `Use a credential issued by \`${CONNECT_COMMAND}\` or a full API key from ${keysUrl(env)}.`, status);
  if (status === 404) return new SandBaseError("NOT_FOUND", `MCP endpoint not found on ${host} (404)${detail}.`, "Check SANDBASE_MCP_URL; it must end in /v1/mcp.", status);
  if (status === 429) return new SandBaseError("RATE_LIMITED", `Rate limited (429)${detail}.`, "Wait 10-30 seconds, then retry once.", status);
  if (status >= 500) return new SandBaseError("UPSTREAM", `SandBase returned HTTP ${status} from ${host}${detail}.`, "Temporary server error. Retry in a minute; run `sandbase doctor` if it persists.", status);
  return new SandBaseError("UPSTREAM", `SandBase returned HTTP ${status} from ${host}${detail}.`, hintForMessage(message, env), status);
}

interface RpcResponse { id?: unknown; result?: unknown; error?: { code?: number; message?: string; data?: unknown } }
function parseRpcBody(text: string, contentType: string, id: number): RpcResponse | undefined {
  const candidates: string[] = [];
  if (contentType.includes("text/event-stream")) { for (const line of text.split(/\r?\n/)) if (line.startsWith("data:")) candidates.push(line.slice(5).trim()); }
  else candidates.push(text, ...text.split(/\r?\n/));
  let fallback: RpcResponse | undefined;
  for (const candidate of candidates) {
    if (!candidate || candidate === "[DONE]") continue;
    try { const value = JSON.parse(candidate) as RpcResponse; if (!value || typeof value !== "object") continue; if (value.id === id) return value; fallback ??= value; } catch { /* keep scanning */ }
  }
  return fallback;
}

export interface ToolOutput { data: Record<string, unknown>; text: string }
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null }; text(): Promise<string> }>;

export class SandBaseMCPClient {
  private session: string | undefined;
  private preferred = 0;
  private nextId = 1;
  readonly attempts: Array<{ url: string; outcome: string }> = [];
  constructor(readonly endpoint: Endpoint, private readonly fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike, private readonly timeoutMs = 120_000, private readonly env = process.env) {
    // Each CLI invocation is a new process: remember which mirror answered so an
    // unreachable primary costs one connect timeout per 6 hours, not per command.
    try {
      const cached = JSON.parse(readFileSync(this.preferenceFile(), "utf8")) as { primary?: string; url?: string; savedAt?: number };
      const index = cached.url ? endpoint.urls.indexOf(cached.url) : -1;
      if (cached.primary === endpoint.urls[0] && index > 0 && Date.now() - (cached.savedAt || 0) < PREFERENCE_TTL_MS) this.preferred = index;
    } catch { /* no preference yet */ }
  }
  private preferenceFile(): string { return join(sandbaseHome(this.env), "cache", "endpoint.json"); }
  private rememberPreference(index: number): void {
    const primary = this.endpoint.urls[0];
    try {
      if (index === 0) { rmSync(this.preferenceFile(), { force: true }); return; }
      mkdirSync(dirname(this.preferenceFile()), { recursive: true, mode: 0o700 });
      writeFileSync(this.preferenceFile(), JSON.stringify({ primary, url: this.endpoint.urls[index], savedAt: Date.now() }) + "\n", { mode: 0o600 });
    } catch { /* preference is an optimization only */ }
  }
  /** The endpoint that last answered (or the first candidate before any call). */
  activeUrl(): string { return this.endpoint.urls[this.preferred] || this.endpoint.urls[0] || DEFAULT_MCP_URL; }

  async rpc(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });
    const idempotent = isIdempotentRequest(method, params);
    const failures: string[] = [];
    let lastServerError: SandBaseError | undefined;
    const order = [...this.endpoint.urls.slice(this.preferred), ...this.endpoint.urls.slice(0, this.preferred)];
    for (const [position, url] of order.entries()) {
      const host = new URL(url).host;
      const isLast = position === order.length - 1;
      let response;
      try {
        const headers: Record<string, string> = { authorization: `Bearer ${this.endpoint.credential}`, "content-type": "application/json", accept: "application/json, text/event-stream", "x-sandbase-client": "cli" };
        if (this.session) headers["mcp-session-id"] = this.session;
        response = await this.fetchImpl(url, { method: "POST", headers, body, signal: AbortSignal.timeout(this.timeoutMs) });
      } catch (error) {
        const reason = describeNetworkFailure(error); this.attempts.push({ url, outcome: reason });
        if (!idempotent && !isPreSendFailure(error)) {
          // The request may already be running server-side; replaying it would bill twice.
          throw new SandBaseError("NETWORK", `The request to ${host} was interrupted after it was sent (${reason}); it may have started a run.`, "Do not re-run yet. Check `sandbase runs list` for the run and poll it with `sandbase runs get -r <run_id> -w`.");
        }
        failures.push(`${host}: ${reason}`);
        continue;
      }
      this.attempts.push({ url, outcome: `HTTP ${response.status}` });
      const session = response.headers.get("mcp-session-id"); if (session) this.session = session;
      const text = await response.text();
      if (response.status >= 500 && idempotent && !isLast) {
        // Gateway/origin errors are what a mirror can fix; only safe for idempotent calls.
        lastServerError = httpError(response.status, text, host, this.env); failures.push(`${host}: HTTP ${response.status}`);
        continue;
      }
      const index = this.endpoint.urls.indexOf(url);
      if (index !== this.preferred || failures.length) this.rememberPreference(index);
      this.preferred = index;
      if (!response.ok) throw httpError(response.status, text, host, this.env);
      const parsed = parseRpcBody(text, response.headers.get("content-type") || "", id);
      if (!parsed) throw new SandBaseError("INVALID_RESPONSE", `Expected JSON-RPC from ${host} but got ${text ? `"${text.slice(0, 80).replace(/\s+/g, " ")}"` : "an empty body"}.`, "A proxy or captive portal may be intercepting traffic. Run `sandbase doctor`.");
      if (parsed.error) {
        const message = parsed.error.message || "request failed";
        const code: ErrorCode = parsed.error.code === -32602 ? "INVALID_INPUT" : /unknown tool|tool(?: '[^']*')? (?:was )?not found|run not found|invalid service request/i.test(message) ? "NOT_FOUND" : "TOOL_ERROR";
        throw new SandBaseError(code, message, hintForMessage(message, this.env));
      }
      return parsed.result;
    }
    if (lastServerError && failures.every(failure => /HTTP 5\d\d$/.test(failure))) throw lastServerError;
    throw new SandBaseError("NETWORK", `Cannot reach SandBase (${failures.join("; ")}).`, UNREACHABLE_HINT);
  }

  async tool(name: string, args: Record<string, unknown> = {}): Promise<ToolOutput> {
    return toolOutput(await this.rpc("tools/call", { name, arguments: args }), this.env);
  }
}

const serverErrorCodes: Record<string, ErrorCode> = { tool_not_found: "NOT_FOUND", run_not_found: "NOT_FOUND", invalid_arguments: "INVALID_INPUT", insufficient_balance: "INSUFFICIENT_BALANCE", rate_limited: "RATE_LIMITED", unauthorized: "AUTH_FAILED", run_failed: "RUN_FAILED", upstream_error: "UPSTREAM", internal_error: "UPSTREAM" };

export function toolOutput(result: unknown, env = process.env): ToolOutput {
  const value = (result || {}) as { structuredContent?: unknown; content?: Array<{ type?: string; text?: string }>; isError?: boolean };
  const text = (value.content || []).filter(item => item?.type === "text" && typeof item.text === "string").map(item => item.text).join("\n");
  if (value.isError) {
    // Servers with B-283 send {error:{code,message,hint}, run_id?}; older ones only text.
    const structured = (value.structuredContent && typeof value.structuredContent === "object" ? value.structuredContent : {}) as { error?: { code?: unknown; message?: unknown; hint?: unknown }; run_id?: unknown };
    const serverCode = typeof structured.error?.code === "string" ? structured.error.code : "";
    const message = typeof structured.error?.message === "string" && structured.error.message ? structured.error.message : text || "The tool reported an error.";
    const hint = typeof structured.error?.hint === "string" && structured.error.hint ? structured.error.hint : hintForMessage(text, env);
    throw new SandBaseError(serverErrorCodes[serverCode] || "TOOL_ERROR", message, hint, undefined, typeof structured.run_id === "string" ? structured.run_id : undefined);
  }
  if (value.structuredContent && typeof value.structuredContent === "object" && !Array.isArray(value.structuredContent)) return { data: value.structuredContent as Record<string, unknown>, text };
  try { const parsed: unknown = JSON.parse(text); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { data: parsed as Record<string, unknown>, text }; } catch { /* plain text result */ }
  return { data: { text }, text };
}
