import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectA1, installA1, rollbackA1, unregisterA1, type A1CommandRunner, type A1CommandResult } from "../src/a1-adapters.js";

function runnerFixture(handler: (client: string, args: readonly string[]) => A1CommandResult | Promise<A1CommandResult>) {
  const calls: { client: string; args: string[] }[] = [];
  const runner: A1CommandRunner = async (client, args) => { calls.push({ client, args: [...args] }); return handler(client, args); };
  return { calls, runner };
}
const ok = (stdout = ""): A1CommandResult => ({ code: 0, stdout, stderr: "" });

test("OpenCode preserves JSONC comments, uses global schema, and requires CLI readback", async () => {
  const home = await mkdtemp(join(tmpdir(), "sandbase-opencode-")); const env = { HOME: home, SANDBASE_HOME: join(home, ".sandbase") }; const path = join(home, ".config", "opencode", "opencode.jsonc");
  await mkdir(join(path, ".."), { recursive: true }); const original = '{\n  // keep this comment\n  "theme": "dark",\n}\n'; await writeFile(path, original);
  const f = runnerFixture((_client, args) => ok(args.join(" ") === "mcp list" && f.calls.length > 1 ? "sandbase connected" : "no servers"));
  const result = await installA1("opencode", "/safe/sandbase-mcp-bridge.mjs", "secret", "https://example.test/v1/mcp", env, f.runner);
  const configured = await readFile(path, "utf8"); assert.match(configured, /keep this comment/); assert.match(configured, /"servers"/); assert.match(configured, /--client/); assert.doesNotMatch(configured, /secret/);
  assert.equal((await inspectA1("opencode", env, f.runner)).state, "configured");
  assert.equal((await installA1("opencode", "/safe/sandbase-mcp-bridge.mjs", "secret", "https://example.test/v1/mcp", env, f.runner)).changed, false);
  await rollbackA1(result); assert.equal(await readFile(path, "utf8"), original);
});

test("OpenCode ownership conflict performs no write or CLI mutation", async () => {
  const home = await mkdtemp(join(tmpdir(), "sandbase-opencode-conflict-")); const env = { HOME: home }; const path = join(home, ".config", "opencode", "opencode.json"); await mkdir(join(path, ".."), { recursive: true }); const original = '{"mcp":{"servers":{"sandbase":{"type":"remote","url":"https://third-party.test"}}}}\n'; await writeFile(path, original);
  const f = runnerFixture(() => ok("sandbase")); await assert.rejects(installA1("opencode", "/bridge", "secret", "https://example.test/v1/mcp", env, f.runner), /not SandBase-owned/); assert.equal(f.calls.length, 0); assert.equal(await readFile(path, "utf8"), original);
});

for (const client of ["opencode", "qwen-code"] as const) test(`${client} ownership cannot be forged with a lookalike bridge path`, async () => {
    const home = await mkdtemp(join(tmpdir(), `sandbase-${client}-lookalike-`));
    const env = { HOME: home, SANDBASE_HOME: join(home, ".sandbase") };
    const path = client === "opencode" ? join(home, ".config", "opencode", "opencode.json") : join(home, ".qwen", "settings.json");
    const entry = { command: ["node", "/third-party/sandbase-mcp-bridge.mjs", "--client", client] };
    const original = JSON.stringify(client === "opencode" ? { mcp: { servers: { sandbase: { type: "local", ...entry } } } } : { mcpServers: { sandbase: entry } }) + "\n";
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, original);
    const f = runnerFixture((_client, args) => args.at(-1) === "--help" ? ok("--scope") : ok("sandbase"));
    await assert.rejects(installA1(client, join(env.SANDBASE_HOME, "bin", "sandbase-mcp-bridge.mjs"), "secret", "https://example.test/v1/mcp", env, f.runner), /not SandBase-owned/);
    assert.equal(await readFile(path, "utf8"), original);
});

test("Qwen uses exact user-scope add/remove argv and settings ownership readback", async () => {
  const home = await mkdtemp(join(tmpdir(), "sandbase-qwen-")); const env = { HOME: home }; const path = join(home, ".qwen", "settings.json"); await mkdir(join(path, ".."), { recursive: true }); await writeFile(path, '{"theme":"dark","mcpServers":{"peer":{"command":"peer"}}}\n');
  const bridge = "/safe/sandbase-mcp-bridge.mjs";
  const f = runnerFixture(async (_client, args) => {
    if (args.at(-1) === "--help") return ok("--scope <scope>");
    if (args[1] === "add") { await writeFile(path, JSON.stringify({ theme: "dark", mcpServers: { peer: { command: "peer" }, sandbase: { command: "node", args: [bridge, "--client", "qwen-code"] } } }) + "\n"); return ok(); }
    if (args[1] === "remove") { await writeFile(path, JSON.stringify({ theme: "dark", mcpServers: { peer: { command: "peer" } } }) + "\n"); return ok(); }
    return { code: 1, stdout: "", stderr: "unexpected" };
  });
  await installA1("qwen-code", bridge, "secret", "https://example.test/v1/mcp", env, f.runner); assert.equal((await inspectA1("qwen-code", env, f.runner)).state, "configured"); assert.doesNotMatch(await readFile(path, "utf8"), /secret/);
  assert.deepEqual(f.calls[2]?.args, ["mcp", "add", "--scope", "user", "--transport", "stdio", "sandbase", "node", bridge, "--client", "qwen-code"]);
  assert.equal((await installA1("qwen-code", bridge, "secret", "https://example.test/v1/mcp", env, f.runner)).changed, false); assert.equal(f.calls.filter(call => call.args[1] === "add" && call.args.at(-1) !== "--help").length, 1);
  assert.equal(await unregisterA1("qwen-code", env, f.runner), true); assert.deepEqual(f.calls.at(-1)?.args, ["mcp", "remove", "sandbase", "--scope", "user"]); assert.match(await readFile(path, "utf8"), /peer/);
});

test("Qwen failed readback restores the exact settings snapshot", async () => {
  const home = await mkdtemp(join(tmpdir(), "sandbase-qwen-rollback-")); const env = { HOME: home }; const path = join(home, ".qwen", "settings.json"); await mkdir(join(path, ".."), { recursive: true }); const original = '{"mcpServers":{"peer":{"command":"peer"}}}\n'; await writeFile(path, original);
  const f = runnerFixture(async (_client, args) => { if (args.at(-1) === "--help") return ok("--scope"); await writeFile(path, '{"mcpServers":{"sandbase":{"command":"third-party"}}}\n'); return ok(); });
  await assert.rejects(installA1("qwen-code", "/safe/sandbase-mcp-bridge.mjs", "secret", "https://example.test/v1/mcp", env, f.runner), /readback/); assert.equal(await readFile(path, "utf8"), original);
});

test("Windsurf writes an owned remote schema with a 0600 file reference and removes only it", async () => {
  const home = await mkdtemp(join(tmpdir(), "sandbase-windsurf-")); const env = { HOME: home, SANDBASE_HOME: join(home, ".sandbase") }; const path = join(home, ".codeium", "windsurf", "mcp_config.json"); await mkdir(join(path, ".."), { recursive: true }); await writeFile(path, JSON.stringify({ mcpServers: { peer: { serverUrl: "https://peer.test" } } }) + "\n");
  const result = await installA1("windsurf", "/unused", "sk-cli-never-in-config", "https://example.test/v1/mcp", env); const raw = await readFile(path, "utf8"); assert.match(raw, /serverUrl/); assert.match(raw, /\$\{file:/); assert.doesNotMatch(raw, /sk-cli-never-in-config/); assert.equal((await stat(result.credentialPath!)).mode & 0o777, 0o600); assert.equal((await inspectA1("windsurf", env)).state, "configured");
  const repeated = await installA1("windsurf", "/unused", "sk-cli-never-in-config", "https://example.test/v1/mcp", env); assert.equal(repeated.changed, false); assert.equal(repeated.credentialChanged, false);
  assert.equal(await unregisterA1("windsurf", env), true); const removed = await readFile(path, "utf8"); assert.match(removed, /peer/); assert.doesNotMatch(removed, /sandbase/); await assert.rejects(readFile(result.credentialPath!, "utf8"), /ENOENT/);
});

test("Windsurf invalid and third-party configs are zero-write", async () => {
  for (const original of ["{broken", '{"mcpServers":{"sandbase":{"serverUrl":"https://third-party.test"}}}\n']) {
    const home = await mkdtemp(join(tmpdir(), "sandbase-windsurf-safe-")); const env = { HOME: home, SANDBASE_HOME: join(home, ".sandbase") }; const path = join(home, ".codeium", "windsurf", "mcp_config.json"); await mkdir(join(path, ".."), { recursive: true }); await writeFile(path, original);
    await assert.rejects(installA1("windsurf", "/unused", "secret", "https://example.test/v1/mcp", env)); assert.equal(await readFile(path, "utf8"), original); await assert.rejects(readFile(join(env.SANDBASE_HOME, "credentials", "windsurf.token"), "utf8"), /ENOENT/);
  }
});

test("Windsurf ownership requires the exact SandBase endpoint", async () => {
  const home = await mkdtemp(join(tmpdir(), "sandbase-windsurf-endpoint-"));
  const env = { HOME: home, SANDBASE_HOME: join(home, ".sandbase") };
  const path = join(home, ".codeium", "windsurf", "mcp_config.json");
  const token = join(env.SANDBASE_HOME, "credentials", "windsurf.token");
  const original = JSON.stringify({ mcpServers: { sandbase: { serverUrl: "https://third-party.test/v1/mcp", headers: { Authorization: `Bearer \${file:${token}}` } } } }) + "\n";
  await mkdir(join(path, ".."), { recursive: true });
  await mkdir(join(token, ".."), { recursive: true });
  await writeFile(path, original);
  await writeFile(token, "third-party-secret", { mode: 0o600 });
  await assert.rejects(installA1("windsurf", "/unused", "sandbase-secret", "https://sandbase.ai/v1/mcp", env), /not SandBase-owned/);
  assert.equal(await readFile(path, "utf8"), original);
  assert.equal(await readFile(token, "utf8"), "third-party-secret");
});
