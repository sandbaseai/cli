#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// This file is both the installed standalone bridge and the runtime loaded by
// dist/cli.js. Keep the proxy implementation here so the two launchers cannot
// drift.
const allowedClients = new Set(["codex", "claude-code", "cursor", "gemini-cli", "hermes", "openclaw", "opencode", "qwen-code", "windsurf", "cursor-cli", "kimi-cli", "kiro", "kiro-cli", "amp", "crush", "iflow-cli", "warp", "claude-desktop", "cowork", "antigravity", "trae", "qoder", "workbuddy", "pi"]);

function bridgeError(message) { return new Error(message); }
function responseError(id, message) { return JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message } }) + "\n"; }
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
function emitPayload(text, contentType, output) {
  if (!text.trim()) return;
  if (contentType.includes("text/event-stream")) {
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload && payload !== "[DONE]") output.write(payload + "\n");
    }
    return;
  }
  try { output.write(JSON.stringify(JSON.parse(text)) + "\n"); }
  catch {
    for (const line of text.split(/\r?\n/)) {
      const payload = line.trim();
      if (!payload) continue;
      try { output.write(JSON.stringify(JSON.parse(payload)) + "\n"); } catch { /* Never forward an untrusted non-JSON body to the client. */ }
    }
  }
}

export async function runMCPBridge(options = {}) {
  const client = options.client;
  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  const signal = options.signal;
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!allowedClients.has(client)) throw bridgeError("SandBase bridge client is invalid.");

  const store = join(env.SANDBASE_HOME || join(homedir(), ".sandbase"), "credentials.json");
  let raw;
  try { raw = await readFile(store, "utf8"); }
  catch { throw bridgeError("SandBase credential is unavailable. Run sandbase connect again."); }
  const record = parseCredential(raw, client);
  let buffer = Buffer.alloc(0);
  let session;

  const forward = async line => {
    let request;
    try { request = JSON.parse(line); } catch { return; }
    if (!request || typeof request !== "object" || Array.isArray(request)) return;
    try {
      const headers = { authorization: `Bearer ${record.credential}`, "content-type": "application/json", accept: "application/json, text/event-stream" };
      if (session) headers["mcp-session-id"] = session;
      const response = await fetchImpl(record.mcpUrl, { method: "POST", headers, body: JSON.stringify(request), ...(signal ? { signal } : {}) });
      const nextSession = response.headers.get("mcp-session-id");
      if (nextSession) session = nextSession;
      const text = await response.text();
      if (!response.ok) {
        if (request.id !== undefined) output.write(responseError(request.id, `SandBase MCP request failed (${response.status})`));
        return;
      }
      emitPayload(text, response.headers.get("content-type") || "", output);
    } catch {
      if (!signal?.aborted && request.id !== undefined) output.write(responseError(request.id, "SandBase MCP is unavailable"));
    }
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
        if (line) await forward(line);
      }
    }
    const finalLine = buffer.toString("utf8").trim();
    if (!signal?.aborted && finalLine) await forward(finalLine);
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
