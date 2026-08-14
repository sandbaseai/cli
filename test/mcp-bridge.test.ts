import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import test from "node:test";
import { FileCredentialStore } from "../src/credentials/store.js";
import { bridgeClients } from "../src/types.js";

interface ChildResult { code: number | null; stdout: string; stderr: string; timedOut: boolean }
async function runCLI(args: string[], home: string, input = "", timeoutMs = 3_000): Promise<ChildResult> {
  const child = spawn(process.execPath, [join(process.cwd(), "dist", "cli.js"), ...args], { env: { ...process.env, SANDBASE_HOME: home }, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
  child.stdin.end(input);
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
  const [code] = await once(child, "close") as [number | null, NodeJS.Signals | null];
  clearTimeout(timeout);
  return { code, stdout, stderr, timedOut };
}
async function body(request: IncomingMessage): Promise<string> { const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks).toString("utf8"); }

test("dist CLI mcp-bridge proxies JSON-RPC with a client-matched credential for every bridge client", async () => {
  const seen: Array<{ authorization: string | undefined; session: string | undefined; body: string }> = [];
  const server = createServer(async (request, response) => {
    seen.push({ authorization: request.headers.authorization, session: request.headers["mcp-session-id"] as string | undefined, body: await body(request) });
    response.setHeader("mcp-session-id", "fixture-session");
    response.setHeader("content-type", "application/json");
    const id = (JSON.parse(seen.at(-1)!.body) as { id: number }).id;
    response.end(JSON.stringify({ jsonrpc: "2.0", id, result: { tools: [] } }));
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    for (const client of bridgeClients) {
      const home = await mkdtemp(join(tmpdir(), `sandbase-bridge-${client}-`));
      await new FileCredentialStore(home).save({ credential: "test-credential-value", credentialId: "fixture-key", keyPrefix: "test-prefix", client, scope: ["mcp:invoke"], mcpUrl: `http://127.0.0.1:${address.port}/v1/mcp`, createdAt: "fixture" });
      const start = seen.length;
      const result = await runCLI(["mcp-bridge", "--client", client], home, '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n');
      assert.equal(result.timedOut, false, `${client} bridge did not exit after stdin EOF`); assert.equal(result.code, 0); assert.equal(result.stderr, "");
      assert.deepEqual(result.stdout.trim().split("\n").map(line => JSON.parse(line)), [
        { jsonrpc: "2.0", id: 1, result: { tools: [] } },
        { jsonrpc: "2.0", id: 2, result: { tools: [] } },
      ]);
      const calls = seen.slice(start); assert.equal(calls.length, 2);
      assert.equal(calls[0]!.authorization, "Bearer test-credential-value"); assert.equal(calls[0]!.session, undefined);
      assert.equal(calls[1]!.session, "fixture-session");
    }
  } finally { server.close(); await once(server, "close"); }
});

test("dist CLI mcp-bridge rejects unsupported clients before reading credentials", async () => {
  const home = await mkdtemp(join(tmpdir(), "sandbase-bridge-invalid-"));
  const result = await runCLI(["mcp-bridge", "--client", "codex"], home);
  assert.equal(result.timedOut, false); assert.equal(result.code, 2); assert.match(result.stderr, /claude-desktop\|cowork\|antigravity\|trae\|qoder\|workbuddy\|pi/); assert.equal(result.stdout, "");
});

test("dist CLI mcp-bridge never falls back to another prompt client's credential", async () => {
  const home = await mkdtemp(join(tmpdir(), "sandbase-bridge-isolation-"));
  await new FileCredentialStore(home).save({ credential: "antigravity-only-credential", credentialId: "fixture-key", keyPrefix: "fixture-prefix", client: "antigravity", scope: ["mcp:invoke"], mcpUrl: "https://example.test/v1/mcp", createdAt: "fixture" });
  const result = await runCLI(["mcp-bridge", "--client", "trae"], home, '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');
  assert.equal(result.timedOut, false); assert.equal(result.code, 1); assert.match(result.stderr, /credential is unavailable/); assert.doesNotMatch(result.stderr, /antigravity-only-credential|Bearer/); assert.equal(result.stdout, "");
});

test("dist CLI mcp-bridge still aborts on SIGTERM and then releases its signal listeners", async () => {
  const home = await mkdtemp(join(tmpdir(), "sandbase-bridge-sigterm-"));
  await new FileCredentialStore(home).save({ credential: "fixture-signal-credential", credentialId: "fixture-key", keyPrefix: "fixture-prefix", client: "pi", scope: ["mcp:invoke"], mcpUrl: "https://example.test/v1/mcp", createdAt: "fixture" });
  const child = spawn(process.execPath, [join(process.cwd(), "dist", "cli.js"), "mcp-bridge", "--client", "pi"], { env: { ...process.env, SANDBASE_HOME: home }, stdio: ["pipe", "pipe", "pipe"] });
  let timedOut = false; const timeout = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, 3_000);
  await new Promise<void>((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
  await new Promise(resolve => setTimeout(resolve, 200));
  child.kill("SIGTERM");
  const [code, signal] = await once(child, "close") as [number | null, NodeJS.Signals | null]; clearTimeout(timeout);
  assert.equal(timedOut, false, "bridge did not exit after SIGTERM abort"); assert.equal(code, 0); assert.equal(signal, null);
});

test("dist CLI mcp-bridge fails closed with secret-free output when its credential is missing", async () => {
  const home = await mkdtemp(join(tmpdir(), "sandbase-bridge-missing-"));
  const result = await runCLI(["mcp-bridge", "--client", "claude-desktop"], home);
  assert.equal(result.timedOut, false); assert.equal(result.code, 1); assert.match(result.stderr, /credential is unavailable/); assert.doesNotMatch(result.stderr, /authorization|Bearer|test-credential-value/); assert.equal(result.stdout, "");
});
