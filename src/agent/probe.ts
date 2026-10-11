// Real connectivity check used by `sandbase doctor` and `sandbase setup`:
// initialize → tools/list → sandbase_account (free) against the API endpoint.
// Local file checks alone cannot tell "configured" from "configured but
// unreachable", which is the failure agents actually hit.
import { SandBaseError, SandBaseMCPClient, validMcpUrl, DEFAULT_MCP_URL, type FetchLike } from "./client.js";
import { cliVersion } from "./update.js";

export interface ProbeResult { ok: boolean; line: string }

export async function probeEndpoint(label: string, credential: string, mcpUrl: string, env = process.env, fetchImpl?: FetchLike, timeoutMs = 15_000): Promise<ProbeResult> {
  const url = validMcpUrl(mcpUrl) || DEFAULT_MCP_URL;
  const client = new SandBaseMCPClient({ credential, url, source: label }, fetchImpl, timeoutMs, env);
  const started = Date.now();
  try {
    await client.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sandbase-doctor", version: cliVersion() } });
    const listed = await client.rpc("tools/list", {}) as { tools?: unknown[] };
    const account = await client.tool("sandbase_account", {});
    const host = new URL(url).host;
    const tools = Array.isArray(listed?.tools) ? listed.tools.length : 0;
    const balance = account.data.balance === undefined ? "unknown" : `$${String(account.data.balance)}`;
    const low = Number(account.data.balance) <= 0 ? ", next_step=Balance is empty; top up before running paid tools." : "";
    return { ok: tools > 0, line: `${label}: network=ok, endpoint=${host}, latency=${Date.now() - started}ms, tools=${tools}, balance=${balance}${low}` };
  } catch (error) {
    const failure = error instanceof SandBaseError ? error : new SandBaseError("NETWORK", error instanceof Error ? error.message : "unknown failure");
    return { ok: false, line: `${label}: network=failed, code=${failure.code}, reason=${failure.message}${failure.hint ? `, next_step=${failure.hint}` : ""}` };
  }
}
