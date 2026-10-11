import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { endpointCandidates, httpError, resolveEndpoint, SandBaseError, SandBaseMCPClient, type FetchLike } from "../src/agent/client.js";
import { formatPrice, resolveSchema, runAgentCommand } from "../src/agent/commands.js";
import { probeEndpoint } from "../src/agent/probe.js";
import { compareVersions, updateNotice } from "../src/agent/update.js";

type Reply = { status?: number; body: unknown; contentType?: string };
type Call = { url: string; method: string; params: Record<string, unknown> | undefined; authorization: string | undefined };
function connectTimeout(): Error { const error = new TypeError("fetch failed") as TypeError & { cause?: unknown }; error.cause = { code: "UND_ERR_CONNECT_TIMEOUT" }; return error; }
function fakeFetch(handler: (call: Call) => Reply | Error): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const request = JSON.parse(init.body) as { id: number; method: string; params?: Record<string, unknown> };
    const call = { url, method: request.method, params: request.params, authorization: init.headers.authorization };
    calls.push(call);
    const reply = handler(call);
    if (reply instanceof Error) throw reply;
    const body = typeof reply.body === "string" ? reply.body : JSON.stringify({ jsonrpc: "2.0", id: request.id, ...(reply.body as object) });
    return { ok: (reply.status ?? 200) < 300, status: reply.status ?? 200, headers: { get: (name: string) => name === "content-type" ? reply.contentType ?? "application/json" : null }, text: async () => body };
  };
  return { fetch, calls };
}
const toolResult = (data: unknown): Reply => ({ body: { result: { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError: false } } });
async function home(): Promise<NodeJS.ProcessEnv> { const root = await mkdtemp(join(tmpdir(), "sandbase-agent-")); return { HOME: root, SANDBASE_HOME: join(root, ".sandbase"), SANDBASE_NO_UPDATE_CHECK: "1" }; }
async function connected(env: NodeJS.ProcessEnv, client = "codex", mcpUrl = "https://api.sandbase.ai/v1/mcp"): Promise<void> {
  await mkdir(env.SANDBASE_HOME!, { recursive: true });
  await writeFile(join(env.SANDBASE_HOME!, "credentials.json"), JSON.stringify({ [client]: { credential: "test-credential-value", credentialId: "k", keyPrefix: "p", client, scope: ["mcp:invoke"], mcpUrl, createdAt: "now" } }));
}
async function cli(command: Parameters<typeof runAgentCommand>[0], argv: string[], env: NodeJS.ProcessEnv, fetch: FetchLike) {
  const out: string[] = [], err: string[] = [];
  let clock = 0;
  const code = await runAgentCommand(command, argv, { env, fetchImpl: fetch, out: text => void out.push(text), err: text => void err.push(text), sleep: async ms => { clock += ms; }, now: () => clock });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

test("credential precedence: env key, then stored key, then a connected client", async () => {
  const env = await home();
  await assert.rejects(resolveEndpoint({}, env), (error: SandBaseError) => error.code === "AUTH_REQUIRED" && /connect/.test(error.hint ?? ""));
  await connected(env, "claude-code");
  assert.equal((await resolveEndpoint({}, env)).source, "client:claude-code");
  await writeFile(join(env.SANDBASE_HOME!, "cli-key.json"), JSON.stringify({ key: "stored-key", addedAt: "now" }));
  assert.equal((await resolveEndpoint({}, env)).credential, "stored-key");
  assert.equal((await resolveEndpoint({ client: "claude-code" }, env)).source, "client:claude-code");
  assert.equal((await resolveEndpoint({}, { ...env, SANDBASE_API_KEY: "env-key" })).credential, "env-key");
  await assert.rejects(resolveEndpoint({ client: "cursor" }, env), /No SandBase credential is stored for client "cursor"/);
});

test("the public API host gets the Cloudflare mirror as a fallback; overrides are honored", () => {
  assert.deepEqual(endpointCandidates("https://api.sandbase.ai/v1/mcp", {}), ["https://api.sandbase.ai/v1/mcp", "https://www.sandbase.ai/v1/mcp"]);
  assert.deepEqual(endpointCandidates("http://127.0.0.1:9/v1/mcp", {}), ["http://127.0.0.1:9/v1/mcp"]);
  assert.deepEqual(endpointCandidates("https://api.sandbase.ai/v1/mcp", { SANDBASE_MCP_FALLBACK_URLS: "" }), ["https://api.sandbase.ai/v1/mcp"]);
});

test("an unreachable primary falls back to the mirror and the preference persists across processes", async () => {
  const env = await home(); await connected(env);
  const { fetch, calls } = fakeFetch(call => call.url.includes("api.sandbase.ai") ? connectTimeout() : toolResult({ balance: "1.5", currency: "USD" }));
  const first = new SandBaseMCPClient(await resolveEndpoint({}, env), fetch, 1000, env);
  assert.equal((await first.tool("sandbase_account")).data.balance, "1.5");
  assert.deepEqual(calls.map(call => new URL(call.url).host), ["api.sandbase.ai", "www.sandbase.ai"]);
  const second = new SandBaseMCPClient(await resolveEndpoint({}, env), fetch, 1000, env);
  await second.tool("sandbase_account");
  assert.equal(new URL(calls.at(-1)!.url).host, "www.sandbase.ai"); assert.equal(calls.length, 3, "second process skips the dead primary");
});

test("network and HTTP failures carry a code and a next step", async () => {
  const env = await home(); await connected(env, "codex", "https://api.sandbase.ai/v1/mcp");
  const { fetch } = fakeFetch(() => connectTimeout());
  const result = await cli("balance", [], env, fetch);
  assert.equal(result.code, 1); assert.match(result.err, /Error \[NETWORK\]: Cannot reach SandBase \(api\.sandbase\.ai: connection timed out; www\.sandbase\.ai: connection timed out\)/); assert.match(result.err, /Next: .*sandbase doctor/);
  assert.equal(httpError(402, '{"error":"API key spending limit exceeded"}', "api.sandbase.ai").code, "INSUFFICIENT_BALANCE");
  assert.match(httpError(401, "<html>", "api.sandbase.ai").hint ?? "", /connect/);
  const json = await cli("balance", ["-j"], env, fetch);
  assert.equal(JSON.parse(json.out).error.code, "NETWORK"); assert.doesNotMatch(json.out + json.err, /test-credential-value/);
});

test("discover shows a HEALTH column and inspect shows a health line", async () => {
  const env = await home(); await connected(env, "codex", "http://127.0.0.1:9/v1/mcp");
  const discover = fakeFetch(() => toolResult({ data: [{ tool_name: "sandbase_a", category: "api", vendor: "V", pricing: { base_price: "0.01" }, description: "x", metrics: { status: "stable", run_time_ms: { p50: 3543, p95: 27748 }, sample_size: 75 } }], count: 1 }));
  const found = await cli("discover", ["-q", "a"], env, discover.fetch);
  assert.match(found.out, /HEALTH/); assert.match(found.out, /stable 3\.5s/); assert.match(found.out, /break ties/);
  const inspect = fakeFetch(() => toolResult({ tool_name: "sandbase_a", description: "x", pricing: { base_price: "0.01" }, inputSchema: { type: "object", properties: {} }, metrics: { status: "stable", run_time_ms: { p50: 3543, p95: 27748 }, sample_size: 75 } }));
  const detail = await cli("inspect", ["sandbase_a"], env, inspect.fetch);
  assert.match(detail.out, /Health: stable · 3\.5s typical, 27\.7s tail · 75 samples/);
  // No metrics -> no HEALTH noise beyond the (empty) column.
  const bare = fakeFetch(() => toolResult({ tool_name: "sandbase_b", description: "y", pricing: {}, inputSchema: { type: "object", properties: {} } }));
  assert.doesNotMatch((await cli("inspect", ["sandbase_b"], env, bare.fetch)).out, /Health:/);
});

test("discover renders a table with price and next step; zero results show server hints", async () => {
  const env = await home(); await connected(env, "codex", "http://127.0.0.1:9/v1/mcp");
  const { fetch, calls } = fakeFetch(call => toolResult(call.params?.arguments && (call.params.arguments as { q?: string }).q === "none" ? { data: [], count: 0, hints: ["Try different keywords."] } : { data: [{ tool_name: "sandbase_flux", category: "multimodal", vendor: "BFL", pricing: { base_price: "0.0480" }, run_count: 12, description: "Text to image" }], count: 1 }));
  const found = await cli("discover", ["-q", "image generation", "-l", "5"], env, fetch);
  assert.equal(found.code, 0); assert.match(found.out, /sandbase_flux\s+multimodal\s+BFL\s+\$0\.048\/call/); assert.match(found.out, /Next: sandbase inspect/);
  assert.deepEqual(calls[0]!.params, { name: "sandbase_discover", arguments: { q: "image generation", limit: 5 } });
  assert.equal(calls[0]!.authorization, "Bearer test-credential-value");
  const none = await cli("discover", ["none"], env, fetch);
  assert.match(none.out, /No tools matched "none"/); assert.match(none.out, /Try different keywords/);
  assert.equal((await cli("discover", [], env, fetch)).code, 2);
});

test("inspect resolves $ref schemas into fields and a runnable example", async () => {
  const schema = { $ref: "#/components/schemas/GenerationRequest", components: { schemas: { GenerationRequest: { type: "object", required: ["keyword"], properties: { keyword: { type: "string", description: "Search keyword", example: "OpenAI" }, search_type: { type: "string", default: "Top" } } } } } };
  assert.deepEqual(Object.keys((resolveSchema(schema).properties ?? {}) as object), ["keyword", "search_type"]);
  const env = await home(); await connected(env, "codex", "http://127.0.0.1:9/v1/mcp");
  const { fetch } = fakeFetch(() => toolResult({ tool_name: "sandbase_twitter_search", model: "twitter/search", category: "api", description: "Search posts", pricing: { base_price: "0" }, inputSchema: schema }));
  const text = await cli("inspect", ["sandbase_twitter_search"], env, fetch);
  assert.match(text.out, /keyword\s+string\s+yes\s+Search keyword/); assert.match(text.out, /sandbase run sandbase_twitter_search -i '\{"keyword":"OpenAI"\}'/);
  const json = JSON.parse((await cli("inspect", ["sandbase_twitter_search", "-j"], env, fetch)).out);
  assert.deepEqual(json.example_arguments, { keyword: "OpenAI" }); assert.equal(json.inputSchema.type, "object");
  assert.equal(formatPrice({ input_per_million: "2.500000", output_per_million: "10.000000" }), "$2.5/$10 per 1M tok");
});

test("run -w polls an async run to completion, fetches its output, and -o keeps it out of stdout", async () => {
  const env = await home(); await connected(env, "codex", "http://127.0.0.1:9/v1/mcp");
  let polls = 0;
  const { fetch, calls } = fakeFetch(call => {
    const name = (call.params as { name?: string } | undefined)?.name;
    if (call.method === "tools/call" && name === "sandbase_run") return toolResult({ prediction_id: "pred_1", status: "running", output: null, taskId: "pred_1" });
    if (call.method === "tools/call" && name === "sandbase_run_get") return toolResult({ run_id: "pred_1", model: "kling/video", status: ++polls < 3 ? "running" : "completed", cost: "0.2000" });
    if (call.method === "tasks/result") return { body: { result: { content: [{ type: "text", text: "" }], structuredContent: { prediction_id: "pred_1", status: "completed", output: [{ url: "https://cdn.test/video.mp4" }] } } } };
    return { body: { error: { code: -32601, message: "unexpected" } } };
  });
  const file = join(env.HOME!, "result.json");
  const result = await cli("run", ["sandbase_kling_video", "-i", '{"prompt":"a cat"}', "-w", "-o", file, "-j"], env, fetch);
  assert.equal(result.code, 0, result.err);
  const view = JSON.parse(result.out);
  assert.equal(view.status, "completed"); assert.equal(view.cost, "0.2000"); assert.equal(view.output_file, file); assert.equal(view.output, undefined);
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), [{ url: "https://cdn.test/video.mp4" }]);
  assert.deepEqual(calls[0]!.params, { name: "sandbase_run", arguments: { name: "sandbase_kling_video", arguments: { prompt: "a cat" } } });
  assert.ok(calls.some(call => call.method === "tasks/result"));
});

test("a run still going at --timeout prints the resume command; a failed run exits 1", async () => {
  const env = await home(); await connected(env, "codex", "http://127.0.0.1:9/v1/mcp");
  const running = fakeFetch(call => toolResult((call.params as { name?: string }).name === "sandbase_run" ? { prediction_id: "pred_2", status: "running" } : { run_id: "pred_2", status: "running" }));
  const slow = await cli("run", ["sandbase_video", "-i", "{}", "-w", "--timeout", "5"], env, running.fetch);
  assert.equal(slow.code, 0); assert.match(slow.out, /still running when --timeout elapsed/); assert.match(slow.out, /Next: sandbase runs get -r pred_2 -w/);
  const failing = fakeFetch(call => call.method === "tasks/result" ? { body: { result: { structuredContent: { status: "failed", error: { message: "content policy" } } } } } : toolResult((call.params as { name?: string }).name === "sandbase_run" ? { prediction_id: "pred_3", status: "running" } : { run_id: "pred_3", status: "failed" }));
  const failed = await cli("runs", ["get", "-r", "pred_3"], env, failing.fetch);
  assert.equal(failed.code, 1); assert.match(failed.out, /Status: failed/); assert.match(failed.out, /content policy/);
  const bad = await cli("run", ["sandbase_video", "-i", "not json"], env, running.fetch);
  assert.equal(bad.code, 2); assert.match(bad.err, /not valid JSON/);
});

test("tool errors from the server are mapped to actionable hints", async () => {
  const env = await home(); await connected(env, "codex", "http://127.0.0.1:9/v1/mcp");
  const { fetch } = fakeFetch(() => ({ body: { error: { code: -32600, message: "invalid service request" } } }));
  const result = await cli("inspect", ["nope"], env, fetch);
  assert.equal(result.code, 1); assert.match(result.err, /\[NOT_FOUND\]/); assert.match(result.err, /sandbase discover -q/);
});

test("keys add stores a 0600 key used before client records", async () => {
  const env = await home(); await connected(env);
  const added = await cli("keys", ["add", "-k", "sb-test-1234567890"], env, fakeFetch(() => toolResult({})).fetch);
  assert.equal(added.code, 0); assert.doesNotMatch(added.out, /sb-test-1234567890/);
  assert.equal((await resolveEndpoint({}, env)).source, "keys");
  assert.equal((await cli("keys", ["remove"], env, fakeFetch(() => toolResult({})).fetch)).code, 0);
  assert.equal((await resolveEndpoint({}, env)).source, "client:codex");
});

test("doctor probe reports the mirror and balance, or the exact failure", async () => {
  const ok = fakeFetch(call => call.url.includes("api.sandbase.ai") ? connectTimeout() : call.method === "tools/list" ? { body: { result: { tools: [{ name: "sandbase_discover" }] } } } : call.method === "initialize" ? { body: { result: {} } } : toolResult({ balance: "3.2" }));
  const env = await home();
  const good = await probeEndpoint("codex", "secret", "https://api.sandbase.ai/v1/mcp", env, ok.fetch, 1000);
  assert.equal(good.ok, true); assert.match(good.line, /network=ok, endpoint=www\.sandbase\.ai/); assert.match(good.line, /primary=api\.sandbase\.ai \(connection timed out\)/); assert.match(good.line, /balance=\$3\.2/);
  const denied = fakeFetch(() => ({ status: 401, body: '{"error":"invalid API key"}' }));
  const bad = await probeEndpoint("codex", "secret", "http://127.0.0.1:9/v1/mcp", env, denied.fetch, 1000);
  assert.equal(bad.ok, false); assert.match(bad.line, /network=failed, code=AUTH_FAILED/); assert.match(bad.line, /next_step=.*connect/); assert.doesNotMatch(bad.line, /secret/);
});

test("update notice compares semver and is suppressed when disabled", async () => {
  assert.equal(compareVersions("0.10.0", "0.9.9"), 1); assert.equal(compareVersions("v1.2.3", "1.2.3"), 0); assert.equal(compareVersions("0.2.0", "0.2.1"), -1);
  const env = { ...(await home()), SANDBASE_NO_UPDATE_CHECK: "" , CI: "", NODE_ENV: "" };
  const registry = (async () => ({ ok: true, json: async () => ({ version: "99.0.0" }) })) as unknown as typeof fetch;
  assert.match((await updateNotice(env, registry)) ?? "", /Update available: @sandbaseai\/cli .* → 99\.0\.0.*sandbase setup.*skill\.md/);
  assert.equal(await updateNotice({ ...env, SANDBASE_NO_UPDATE_CHECK: "1" }, registry), undefined);
});

async function bridge(env: NodeJS.ProcessEnv, fetch: FetchLike, lines: unknown[]): Promise<Array<Record<string, any>>> {
  const runtime = await import(pathToFileURL(join(process.cwd(), "assets", "mcp-bridge.mjs")).href) as { runMCPBridge(options: Record<string, unknown>): Promise<void> };
  const input = new PassThrough(), output = new PassThrough(); let text = "";
  output.on("data", chunk => { text += chunk; });
  const done = runtime.runMCPBridge({ client: "codex", env, input, output, fetchImpl: fetch });
  input.end(lines.map(line => JSON.stringify(line)).join("\n") + "\n");
  await done;
  return text.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
}

test("bridge keeps the server usable offline and turns tool failures into visible errors", async () => {
  const env = await home(); await connected(env, "codex", "https://api.sandbase.ai/v1/mcp");
  const offline = fakeFetch(() => connectTimeout());
  const [init, list, call] = await bridge(env, offline.fetch, [{ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, { jsonrpc: "2.0", id: 2, method: "tools/list" }, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "sandbase_discover", arguments: { q: "x" } } }]);
  assert.equal(init!.result.protocolVersion, "2025-06-18"); assert.match(init!.result.instructions, /unreachable/);
  assert.ok(list!.result.tools.some((tool: { name: string }) => tool.name === "sandbase_discover"));
  assert.equal(call!.result.isError, true); assert.match(call!.result.content[0].text, /unreachable from this machine \(api\.sandbase\.ai: connection timed out; www\.sandbase\.ai: connection timed out\).*sandbase doctor/);

  const mixed = fakeFetch(call => call.url.includes("api.sandbase.ai") ? connectTimeout() : call.method === "tools/list" ? { body: { result: { tools: [{ name: "sandbase_discover", description: "live" }] } } } : call.method === "tools/call" && (call.params as { name: string }).name === "sandbase_account" ? { status: 402, body: '{"error":"API key spending limit exceeded"}' } : { body: { error: { code: -32603, message: "capability call failed" } } });
  const [listed, failed, broke] = await bridge(env, mixed.fetch, [{ jsonrpc: "2.0", id: 1, method: "tools/list" }, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "sandbase_run", arguments: {} } }, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "sandbase_account", arguments: {} } }]);
  assert.equal(listed!.result.tools[0].description, "live");
  assert.equal(failed!.result.isError, true); assert.match(failed!.result.content[0].text, /capability call failed\. The upstream provider failed\. Retry once/);
  assert.equal(broke!.result.isError, true); assert.match(broke!.result.content[0].text, /\(402\): API key spending limit exceeded.*console\/billing/);
  assert.ok(mixed.calls.filter(call => call.url.includes("api.sandbase.ai")).length <= 1, "after one fallback the session stays on the mirror");

  const cachedOffline = await bridge(env, offline.fetch, [{ jsonrpc: "2.0", id: 9, method: "tools/list" }]);
  assert.equal(cachedOffline[0]!.result.tools[0].description, "live", "offline tools/list serves the last live list");
});

function resetAfterSend(): Error { const error = new TypeError("fetch failed") as TypeError & { cause?: unknown }; error.cause = { code: "ECONNRESET" }; return error; }

test("a paid run interrupted after sending is never replayed on the mirror", async () => {
  const env = await home(); await connected(env);
  const { fetch, calls } = fakeFetch(call => call.url.includes("api.sandbase.ai") ? resetAfterSend() : toolResult({ prediction_id: "pred_dup", status: "completed", output: "x" }));
  const result = await cli("run", ["sandbase_paid", "-i", "{}", "-j"], env, fetch);
  assert.equal(result.code, 1);
  assert.equal(calls.filter(call => call.method === "tools/call").length, 1, "no second sandbase_run");
  assert.match(JSON.parse(result.out).error.message, /may have started a run/);
  const reads = fakeFetch(call => call.url.includes("api.sandbase.ai") ? resetAfterSend() : toolResult({ balance: "2" }));
  assert.equal((await cli("balance", [], await (async () => { const e = await home(); await connected(e); return e; })(), reads.fetch)).code, 0, "idempotent reads may fail over");
});

test("HTTP 5xx on the primary fails over for idempotent calls only", async () => {
  const env = await home(); await connected(env);
  const { fetch, calls } = fakeFetch(call => call.url.includes("api.sandbase.ai") ? { status: 502, body: "<html>bad gateway</html>" } : toolResult({ balance: "4" }));
  const ok = await cli("balance", [], env, fetch);
  assert.equal(ok.code, 0); assert.match(ok.out, /\$4/); assert.equal(calls.length, 2);
  const env2 = await home(); await connected(env2);
  const paid = fakeFetch(call => call.url.includes("api.sandbase.ai") ? { status: 502, body: "" } : toolResult({ prediction_id: "p", status: "completed" }));
  const failed = await cli("run", ["sandbase_paid", "-i", "{}"], env2, paid.fetch);
  assert.equal(failed.code, 1); assert.equal(paid.calls.length, 1); assert.match(failed.err, /\[UPSTREAM\].*HTTP 502/);
});

test("completed runs with output null fetch tasks/result and never write null", async () => {
  const env = await home(); await connected(env, "codex", "http://127.0.0.1:9/v1/mcp");
  let fetchedTask = false;
  const { fetch } = fakeFetch(call => call.method === "tasks/result" ? (fetchedTask = true, { body: { result: { structuredContent: { status: "completed", output: [{ url: "https://cdn.test/a.png" }] } } } }) : toolResult({ run_id: "pred_n", status: "completed", output: null }));
  const file = join(env.HOME!, "out.json");
  const result = await cli("runs", ["get", "-r", "pred_n", "-o", file, "-j"], env, fetch);
  assert.equal(result.code, 0); assert.ok(fetchedTask);
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), [{ url: "https://cdn.test/a.png" }]);
  const empty = fakeFetch(call => call.method === "tasks/result" ? { body: { result: { task: { status: "working" } } } } : toolResult({ run_id: "pred_e", status: "completed", output: null }));
  const file2 = join(env.HOME!, "never.json");
  const none = JSON.parse((await cli("runs", ["get", "-r", "pred_e", "-o", file2, "-j"], env, empty.fetch)).out);
  assert.equal(none.output_file, undefined); await assert.rejects(readFile(file2, "utf8"), /ENOENT/);
});

test("unknown statuses keep polling, plain-text sync results complete, server run_failed exits 1 with run id", async () => {
  const env = await home(); await connected(env, "codex", "http://127.0.0.1:9/v1/mcp");
  const queued = fakeFetch(() => toolResult({ prediction_id: "pred_q", status: "IN_QUEUE" }));
  const q = await cli("run", ["sandbase_fal", "-i", "{}"], env, queued.fetch);
  assert.equal(q.code, 0); assert.match(q.out, /Next: sandbase runs get -r pred_q -w/);
  const text = fakeFetch(() => ({ body: { result: { content: [{ type: "text", text: "hello world" }], isError: false } } }));
  const plain = await cli("run", ["sandbase_llm", "-i", "{}"], env, text.fetch);
  assert.equal(plain.code, 0); assert.match(plain.out, /Status: completed/); assert.match(plain.out, /hello world/);
  const failed = fakeFetch(() => ({ body: { result: { content: [{ type: "text", text: "The run failed: bad prompt" }], structuredContent: { error: { code: "run_failed", message: "The run failed: bad prompt", hint: "Fix the arguments" }, run_id: "pred_f" }, isError: true } } }));
  const f = JSON.parse((await cli("run", ["sandbase_video", "-i", "{}", "-j"], env, failed.fetch)).out);
  assert.equal(f.status, "failed"); assert.equal(f.run_id, "pred_f"); assert.match(f.error, /bad prompt/);
});

test("failures after a run started keep the run id; an unwritable -o fails before spending", async () => {
  const env = await home(); await connected(env, "codex", "http://127.0.0.1:9/v1/mcp");
  const { fetch, calls } = fakeFetch(call => (call.params as { name?: string }).name === "sandbase_run" ? toolResult({ prediction_id: "pred_k", status: "running" }) : connectTimeout());
  const lost = JSON.parse((await cli("run", ["sandbase_video", "-i", "{}", "-w", "-j"], env, fetch)).out);
  assert.equal(lost.run_id, "pred_k"); assert.match(lost.error.hint, /sandbase runs get -r pred_k -w/);
  const before = calls.length;
  const bad = await cli("run", ["sandbase_video", "-i", "{}", "-o", join(env.HOME!, "missing-dir", "x.json")], env, fetch);
  assert.equal(bad.code, 2); assert.match(bad.err, /nothing was run/); assert.equal(calls.length, before);
});

test("auth wording beats not-found wording; service runs print their idempotency key; keys can come from stdin", async () => {
  const env = await home(); await connected(env, "codex", "http://127.0.0.1:9/v1/mcp");
  const denied = fakeFetch(() => ({ body: { error: { code: -32600, message: "API key not found" } } }));
  const auth = await cli("balance", [], env, denied.fetch);
  assert.match(auth.err, /\[TOOL_ERROR\]/); assert.match(auth.err, /Sign in again/);
  const svc = fakeFetch(() => toolResult({ service_id: "svc_demo", run_id: "run_1", status: "accepted" }));
  const service = await cli("run", ["svc_demo", "-i", '{"input":"hi"}'], env, svc.fetch);
  assert.match(service.out, /Idempotency key: cli-/);
  const out: string[] = [];
  const code = await runAgentCommand("keys", ["add", "-k", "-"], { env, out: text => void out.push(text), err: () => {}, stdin: async () => "sb-live-abcdefghijklmnopqrstuvwxyz\n" });
  assert.equal(code, 0); assert.doesNotMatch(out.join(""), /abcdefghijklmnop/);
  assert.equal((await resolveEndpoint({}, env)).credential, "sb-live-abcdefghijklmnopqrstuvwxyz");
});

test("bridge never replays sandbase_run, keeps the handshake alive on 5xx, and advertises a static offline list", async () => {
  const env = await home(); await connected(env, "codex", "https://api.sandbase.ai/v1/mcp");
  const reset = fakeFetch(call => call.url.includes("api.sandbase.ai") ? resetAfterSend() : toolResult({ status: "completed" }));
  const [run] = await bridge(env, reset.fetch, [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "sandbase_run", arguments: { name: "x", arguments: {} } } }]);
  assert.equal(run!.result.isError, true); assert.match(run!.result.content[0].text, /Do not call sandbase_run again yet/);
  assert.equal(reset.calls.length, 1);
  const down = fakeFetch(() => ({ status: 503, body: "" }));
  const [init, list] = await bridge(env, down.fetch, [{ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, { jsonrpc: "2.0", id: 2, method: "tools/list" }]);
  assert.equal(init!.result.capabilities.tools.listChanged, false);
  assert.ok(list!.result.tools.some((tool: { name: string }) => tool.name === "sandbase_run_cancel"));
});

test("setup refreshes the bridge and SandBase-owned Skills but leaves edited Skills alone", async () => {
  const env = await home();
  const previous = { HOME: process.env.HOME, SANDBASE_HOME: process.env.SANDBASE_HOME };
  process.env.HOME = env.HOME; process.env.SANDBASE_HOME = env.SANDBASE_HOME;
  try {
    const { createHash } = await import("node:crypto");
    const { setup } = await import("../src/commands.js");
    const { FileCredentialStore } = await import("../src/credentials/store.js");
    const old = "---\nname: sandbase\nversion: 0.1.0\n---\n<!-- sandbase-cli-managed: sandbase -->\nold\n";
    const claudeDir = join(env.HOME!, ".claude", "skills", "sandbase"); await mkdir(claudeDir, { recursive: true });
    await writeFile(join(claudeDir, "SKILL.md"), old);
    await writeFile(join(claudeDir, ".sandbase-managed.json"), JSON.stringify({ owner: "sandbase-cli", client: "claude-code", sha256: createHash("sha256").update(old).digest("hex") }));
    const kiroDir = join(env.HOME!, ".kiro", "skills", "sandbase"); await mkdir(kiroDir, { recursive: true });
    await writeFile(join(kiroDir, "SKILL.md"), `${old}user edit\n`);
    await writeFile(join(kiroDir, ".sandbase-managed.json"), JSON.stringify({ owner: "sandbase-cli", client: "kiro", sha256: createHash("sha256").update(old).digest("hex") }));
    await connected(env);
    const lines: string[] = [];
    assert.equal(await setup(new FileCredentialStore(env.SANDBASE_HOME!), line => void lines.push(line)), true);
    assert.match(lines.join("\n"), /bridge: status=updated/); assert.match(lines.join("\n"), /claude-code: skill=updated/); assert.match(lines.join("\n"), /kiro: skill=modified/);
    assert.match(await readFile(join(claudeDir, "SKILL.md"), "utf8"), /version: 0\.3\.1/);
    assert.match(await readFile(join(kiroDir, "SKILL.md"), "utf8"), /user edit/);
  } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
