import assert from "node:assert/strict";
import test from "node:test";
import { connect } from "../src/commands.js";
import { assertNativeCapabilities, capabilityRegistry, nativeCapabilities } from "../src/clients.js";
import { clients } from "../src/types.js";

test("all registered clients have a complete deterministic capability", () => {
  assert.doesNotThrow(assertNativeCapabilities);
  assert.equal(Object.keys(nativeCapabilities).length, clients.length);
  for (const client of clients) {
    const capability = nativeCapabilities[client];
    assert.match(capability.guide, new RegExp(client === "cursor-cli" ? "Cursor CLI" : ".+"));
    assert.equal(capability.uninstall, "managed_only");
    assert.ok(["action_required", "unsupported"].includes(capability.terminal));
    assert.ok(["configured", "already_configured", "confirmation_required", "unsupported", "failed"].includes(capabilityRegistry[client].status));
    assert.notEqual(capabilityRegistry[client].status, "action_required");
    assert.ok(capabilityRegistry[client].evidence.source.length > 0);
    assert.ok(capabilityRegistry[client].installer);
    assert.ok(capabilityRegistry[client].validator);
    if (capabilityRegistry[client].implementation === "blocked") {
      assert.equal(capabilityRegistry[client].status, "failed");
      assert.equal(capabilityRegistry[client].installer.mcp, "none");
      assert.equal(capabilityRegistry[client].installer.skill, "none");
    }
  }
  assert.equal(nativeCapabilities.cursor.invocation, "slash");
  assert.equal(nativeCapabilities.cursor.verification, "real_client_matrix");
  assert.equal(nativeCapabilities.codex.invocation, "skill_picker");
  assert.equal(capabilityRegistry.hermes.implementation, "implemented");
  assert.equal(nativeCapabilities.hermes.skillMode, "client_skill");
  assert.equal(nativeCapabilities.hermes.invocation, "mcp_chat");
  assert.equal(nativeCapabilities.chatgpt.terminal, "action_required");
  for (const client of ["antigravity", "trae", "qoder", "workbuddy", "pi"] as const) assert.equal(capabilityRegistry[client].implementation, "implemented");
});

test("implemented A, B, C and Warp batches enter automatic configuration with first-party evidence", () => {
  assert.equal(capabilityRegistry.codex.evidence.kind, "first_party");
  assert.equal(capabilityRegistry["claude-code"].evidence.kind, "first_party");
  assert.equal(capabilityRegistry.cursor.evidence.kind, "first_party");
  for (const client of ["gemini-cli", "cursor-cli", "kimi-cli", "kiro-cli"] as const) {
    assert.equal(capabilityRegistry[client].implementation, "implemented");
    assert.equal(capabilityRegistry[client].installer.mcp, "adapter");
    assert.equal(capabilityRegistry[client].evidence.kind, "first_party");
  }
  for (const client of ["gemini-cli", "cursor-cli", "kimi-cli"] as const) {
    assert.equal(nativeCapabilities[client].skillMode, "none");
    assert.equal(capabilityRegistry[client].installer.skill, "none");
  }
  assert.equal(nativeCapabilities["kiro-cli"].skillMode, "client_skill");
  assert.notEqual(capabilityRegistry["kiro-cli"].installer.skill, "none");
  for (const client of ["amp", "crush", "iflow-cli"] as const) {
    assert.equal(nativeCapabilities[client].mcpMode, "auto");
    assert.equal(nativeCapabilities[client].skillMode, "none");
    assert.equal(capabilityRegistry[client].implementation, "implemented");
    assert.equal(capabilityRegistry[client].installer.mcp, "adapter");
    assert.equal(capabilityRegistry[client].installer.skill, "none");
    assert.equal(capabilityRegistry[client].evidence.kind, "first_party");
  }
  assert.match(nativeCapabilities["iflow-cli"].guide, /ended 2026-04-17/);
  assert.equal(nativeCapabilities.warp.mcpMode, "auto");
  assert.equal(capabilityRegistry.warp.implementation, "implemented");
  assert.equal(capabilityRegistry.warp.installer.mcp, "adapter");
  assert.equal(capabilityRegistry.warp.evidence.kind, "first_party");
});

test("an unavailable OpenClaw Skill fails before authorization", async () => {
  const output: string[] = [];
  let calls = 0;
  const api = { create: async () => { calls++; throw new Error("must not authorize"); } };
  await connect("openclaw", { api: api as never, log: line => output.push(line), detect: () => ({ installed: true, detail: "fixture" }), openClawRunner: async () => ({ code: null, stdout: "", stderr: "" }) });
  assert.equal(calls, 0);
  assert.match(output[0]!, /openclaw: status=failed.*mcp=not_configured/i);
  assert.ok(output.every(line => !/(?:sk-[A-Za-z0-9_-]+|cln-[A-Za-z0-9_-]+)/i.test(line)));
});

test("default auto flow summarizes detected blocked clients without guide-only statuses", async () => {
  const output: string[] = [];
  await connect("auto", { log: line => output.push(line), detect: client => ({ installed: client === "chatgpt" || client === "openclaw", detail: "test" }), openClawRunner: async () => ({ code: null, stdout: "", stderr: "" }) });
  assert.ok(output.some(line => /^chatgpt: status=confirmation_required.*mcp=not_configured/.test(line)), "Auto may report guidance but must not configure ChatGPT");
  assert.ok(output.some(line => line.startsWith("openclaw: status=failed")));
  assert.ok(!output.some(line => /Configured clients/.test(line)));
});
