import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configPath } from "../src/paths.js";
import { findWarpProjectOverride, inspectWarp, installWarp, rollbackWarp, snapshotWarpUnregister, unregisterWarp } from "../src/warp-adapter.js";
import { connect, unregister as unregisterCommand } from "../src/commands.js";
import { FileCredentialStore, type CredentialStore } from "../src/credentials/store.js";
import type { AuthorizationApi } from "../src/auth/api.js";

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "sandbase-warp-")), project = join(home, "work", "nested"), env = { HOME: home, SANDBASE_HOME: join(home, ".sandbase"), PWD: project };
  await mkdir(project, { recursive: true }); return { home, project, env, path: configPath("warp", env), bridge: join(env.SANDBASE_HOME, "bin", "sandbase-mcp-bridge.mjs") };
}
async function write(path: string, value: unknown) { await mkdir(join(path, ".."), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 2) + "\n"); }

test("Warp installs an owned global command entry, preserves peers, and is idempotent", async () => {
  const { env, path, bridge } = await fixture(); await write(path, { theme: "dark", mcpServers: { peer: { command: "peer", args: [] } } });
  const first = await installWarp(bridge, env), installed = JSON.parse(await readFile(path, "utf8"));
  assert.equal(first.changed, true); assert.deepEqual(installed.mcpServers.sandbase, { command: "node", args: [bridge, "--client", "warp"] }); assert.equal(installed.mcpServers.peer.command, "peer");
  const second = await installWarp(bridge, env); assert.equal(second.changed, false); assert.equal((await inspectWarp(env)).state, "configured");
  assert.doesNotMatch(await readFile(path, "utf8"), /credential|Bearer|token/i);
});

test("Warp fails closed for nearest project override, foreign ownership, and malformed JSON", async () => {
  const { env, project, path, bridge } = await fixture(), projectPath = join(project, ".warp", ".mcp.json");
  await write(path, { mcpServers: { peer: { command: "keep" } } }); await write(projectPath, { mcpServers: { sandbase: { command: "foreign" } } }); const original = await readFile(path, "utf8");
  assert.equal(await findWarpProjectOverride(env), projectPath); await assert.rejects(installWarp(bridge, env), /higher-priority project/); assert.equal(await readFile(path, "utf8"), original);
  await write(projectPath, { mcpServers: { peer: { command: "keep" } } }); await write(path, { mcpServers: { sandbase: { command: "foreign" } } }); await assert.rejects(installWarp(bridge, env), /not SandBase-owned/);
  await writeFile(path, "{broken"); await assert.rejects(installWarp(bridge, env), /Expected|Unexpected|configuration/i); assert.equal(await readFile(path, "utf8"), "{broken");
});

test("Warp rollback restores exact previous state and unregister removes only owned state", async () => {
  const { env, path, bridge } = await fixture(); const original = JSON.stringify({ mcpServers: { peer: { command: "keep", args: ["x"] } } }, null, 2) + "\n"; await mkdir(join(path, ".."), { recursive: true }); await writeFile(path, original);
  const installed = await installWarp(bridge, env); await rollbackWarp(installed); assert.equal(await readFile(path, "utf8"), original); assert.equal((await inspectWarp(env)).state, "missing");
  await installWarp(bridge, env); assert.ok(await snapshotWarpUnregister(env)); assert.equal(await unregisterWarp(env), true); const after = JSON.parse(await readFile(path, "utf8")); assert.equal(after.mcpServers.sandbase, undefined); assert.equal(after.mcpServers.peer.command, "keep"); assert.equal(await unregisterWarp(env), false);
});

test("Warp project search excludes the user-level ~/.warp/.mcp.json itself", async () => {
  const { env, path } = await fixture(); await write(path, { mcpServers: { sandbase: { command: "foreign" } } }); assert.equal(await findWarpProjectOverride(env), undefined);
});

test("explicit Warp connect uses B-063, stages approval without logging the secret, and unregisters transactionally", async () => {
  const { env, path } = await fixture(), previous = { HOME: process.env.HOME, SANDBASE_HOME: process.env.SANDBASE_HOME, PWD: process.env.PWD }, logs: string[] = [], secret = "test-warp-secret-never-log";
  process.env.HOME = env.HOME; process.env.SANDBASE_HOME = env.SANDBASE_HOME; process.env.PWD = env.PWD;
  const api = { create: async () => ({ authorization_id: "cla_warp", status: "pending", verification_uri_complete: "https://example.test/authorize", expires_at: "later", interval: 1 }), status: async () => ({ status: "approved", interval: 1 }), exchange: async () => ({ credential: secret, credential_id: "key", key_prefix: "sk-cli-ab", client: "warp", scope: ["mcp:invoke"], mcp_url: "https://example.test/v1/mcp", created_at: "now", cleanup_token: "cleanup", cleanup_expires_at: "later" }), cancel: async () => {}, cleanup: async () => {} } as unknown as AuthorizationApi;
  const store = new FileCredentialStore(env.SANDBASE_HOME);
  try {
    await connect("warp", { api, store, open: async () => {}, log: line => logs.push(line), detect: () => ({ installed: true, detail: "Warp fixture" }) });
    assert.equal((await inspectWarp(process.env)).state, "configured"); assert.ok(await store.get("warp")); assert.match(logs.join("\n"), /staged.*Warp|configuration is staged/i); assert.doesNotMatch(logs.join("\n"), new RegExp(secret));
    const configured = JSON.parse(await readFile(path, "utf8")); assert.equal(configured.mcpServers.sandbase.args[2], "warp");
    await unregisterCommand("warp", store, () => ({ installed: true, detail: "fixture" })); assert.equal((await inspectWarp(process.env)).state, "missing"); assert.equal(await store.get("warp"), undefined);
  } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test("Warp ownership conflict compensates the authorization credential and local bridge", async () => {
  const { env, path, bridge } = await fixture(), previous = { HOME: process.env.HOME, SANDBASE_HOME: process.env.SANDBASE_HOME, PWD: process.env.PWD };
  const original = JSON.stringify({ mcpServers: { sandbase: { command: "foreign", args: [] }, peer: { command: "keep" } } }, null, 2) + "\n";
  await mkdir(join(path, ".."), { recursive: true }); await writeFile(path, original);
  process.env.HOME = env.HOME; process.env.SANDBASE_HOME = env.SANDBASE_HOME; process.env.PWD = env.PWD;
  const secret = "test-warp-conflict-secret", logs: string[] = []; let cleanup = 0;
  const api = { create: async () => ({ authorization_id: "cla_warp", status: "pending", verification_uri_complete: "https://example.test/authorize", expires_at: "later", interval: 1 }), status: async () => ({ status: "approved", interval: 1 }), exchange: async () => ({ credential: secret, credential_id: "key", key_prefix: "sk-cli-ab", client: "warp", scope: ["mcp:invoke"], mcp_url: "https://example.test/v1/mcp", created_at: "now", cleanup_token: "cleanup", cleanup_expires_at: "later" }), cancel: async () => {}, cleanup: async () => { cleanup++; } } as unknown as AuthorizationApi;
  const store = new FileCredentialStore(env.SANDBASE_HOME);
  try {
    await assert.rejects(connect("warp", { api, store, open: async () => {}, log: line => logs.push(line), detect: () => ({ installed: true, detail: "Warp fixture" }) }), /not SandBase-owned/);
    assert.equal(cleanup, 1); assert.equal(await store.get("warp"), undefined); assert.equal(await readFile(path, "utf8"), original);
    await assert.rejects(readFile(bridge, "utf8"), /ENOENT/); assert.doesNotMatch(logs.join("\n"), new RegExp(secret));
  } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test("Warp unregister restores owned state when credential removal fails", async () => {
  const { env, bridge } = await fixture(), previous = { HOME: process.env.HOME, SANDBASE_HOME: process.env.SANDBASE_HOME, PWD: process.env.PWD };
  process.env.HOME = env.HOME; process.env.SANDBASE_HOME = env.SANDBASE_HOME; process.env.PWD = env.PWD; await installWarp(bridge, env);
  const record = { credential: "test-warp-credential", credentialId: "key", keyPrefix: "sk-cli-ab", client: "warp" as const, scope: ["mcp:invoke"], mcpUrl: "https://example.test/v1/mcp", createdAt: "now" };
  let restored = 0; const store = { get: async () => record, remove: async () => { throw new Error("credential remove failed"); }, save: async saved => { assert.deepEqual(saved, record); restored++; } } satisfies CredentialStore;
  try {
    await assert.rejects(unregisterCommand("warp", store, () => ({ installed: true, detail: "fixture" })), /credential remove failed/);
    assert.equal(restored, 1); assert.equal((await inspectWarp(env)).state, "configured"); assert.ok(await snapshotWarpUnregister(env));
  } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
