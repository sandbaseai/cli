import assert from "node:assert/strict";
import test from "node:test";
import { installNativeSkill, installOpenClawMcp, installOpenClawSkill, inspectOpenClawMcp, inspectOpenClawSkill, openClawSandbaseSkill, removeNativeSkill, removeOpenClawMcp, removeOpenClawSkill, sandbaseSkillRelease, validateSandbaseSkillRelease, type OpenClawCommandRunner, type SkillsCommandRunner } from "../src/skills-cli.js";

const listed = JSON.stringify({ sourceUrl: "https://github.com/sandbaseai/sandbase-skills.git", agents: ["Kiro CLI"], path: "/fixture" });
function fixture(responses: Array<{ code: number | null; stdout?: string; stderr?: string }>): { runner: SkillsCommandRunner; calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    runner: async args => {
      calls.push([...args]);
      const next = responses.shift();
      if (!next) throw new Error("unexpected Skills CLI call");
      return { code: next.code, stdout: next.stdout || "", stderr: next.stderr || "" };
    },
  };
}

function openClawFixture(responses: Array<{ code: number | null; stdout?: string; stderr?: string }>): { runner: OpenClawCommandRunner; calls: string[][] } {
  const calls: string[][] = [];
  return { calls, runner: async args => {
    calls.push([...args]); const next = responses.shift();
    if (!next) throw new Error("unexpected OpenClaw call");
    return { code: next.code, stdout: next.stdout || "", stderr: next.stderr || "" };
  } };
}

const openClawReadback = JSON.stringify({ name: "sandbase", source: "workspace", homepage: openClawSandbaseSkill.page });
const managedMcp = (bridge = "/home/test/.sandbase/bin/sandbase-mcp-bridge.mjs") => JSON.stringify({ command: "node", args: [bridge, "--client", "openclaw"], env: { SANDBASE_CLI_MANAGED: "1" } });

test("OpenClaw adapter uses the exact ClawHub install argv and verified readback", async () => {
  const f = openClawFixture([{ code: 0, stdout: JSON.stringify({ error: "not found" }) }, { code: 0 }, { code: 0, stdout: openClawReadback }]);
  const result = await installOpenClawSkill(f.runner);
  assert.equal(result.status, "installed");
  assert.deepEqual(f.calls, [
    ["skills", "info", "sandbase", "--json"],
    ["skills", "install", "@joeliu926/sandbase"],
    ["skills", "info", "sandbase", "--json"],
  ]);
});

test("OpenClaw adapter fails closed for missing CLI, install failure, and mismatched readback", async () => {
  const missing = openClawFixture([{ code: null }]);
  assert.equal((await installOpenClawSkill(missing.runner)).status, "failed");
  assert.deepEqual(missing.calls, [["skills", "info", "sandbase", "--json"]]);

  const failedInstall = openClawFixture([{ code: 0, stdout: "{}" }, { code: 1 }]);
  assert.equal((await installOpenClawSkill(failedInstall.runner)).status, "failed");
  assert.deepEqual(failedInstall.calls, [["skills", "info", "sandbase", "--json"], ["skills", "install", "@joeliu926/sandbase"]]);

  const mismatch = openClawFixture([{ code: 0, stdout: "{}" }, { code: 0 }, { code: 0, stdout: JSON.stringify({ name: "sandbase", source: "workspace", homepage: "https://example.test" }) }]);
  const result = await installOpenClawSkill(mismatch.runner);
  assert.equal(result.code, "readback_failed");
  assert.doesNotMatch(result.message, /example\.test/);
});

test("OpenClaw verified repeat install is idempotent and removal fails closed without deletion", async () => {
  const existing = openClawFixture([{ code: 0, stdout: openClawReadback }]);
  assert.equal((await installOpenClawSkill(existing.runner)).status, "already_installed");
  assert.deepEqual(existing.calls, [["skills", "info", "sandbase", "--json"]]);

  const inspect = openClawFixture([{ code: 0, stdout: openClawReadback }]);
  assert.equal((await inspectOpenClawSkill(inspect.runner)).status, "already_installed");
  const remove = openClawFixture([{ code: 0, stdout: openClawReadback }]);
  const removed = await removeOpenClawSkill(remove.runner);
  assert.equal(removed.status, "confirmation_required");
  assert.match(removed.message, /no supported Skill removal command/);
  assert.deepEqual(remove.calls, [["skills", "info", "sandbase", "--json"]]);
});

test("OpenClaw MCP adapter uses documented set/show argv and never passes a credential", async () => {
  const bridge = "/home/test/.sandbase/bin/sandbase-mcp-bridge.mjs";
  const f = openClawFixture([
    { code: 1 },
    { code: 0 },
    { code: 0, stdout: managedMcp(bridge) },
  ]);
  const result = await installOpenClawMcp(bridge, f.runner);
  assert.equal(result.status, "configured");
  assert.deepEqual(f.calls, [
    ["mcp", "show", "sandbase", "--json"],
    ["mcp", "set", "sandbase", managedMcp(bridge)],
    ["mcp", "show", "sandbase", "--json"],
  ]);
  assert.doesNotMatch(JSON.stringify(f.calls), /sk-cli|credential|authorization/i);
});

test("OpenClaw MCP adapter preserves a user-owned sandbase server and fails closed", async () => {
  const foreign = JSON.stringify({ command: "python", args: ["-m", "other_mcp"] });
  const f = openClawFixture([{ code: 0, stdout: foreign }]);
  const result = await installOpenClawMcp("/home/test/.sandbase/bin/sandbase-mcp-bridge.mjs", f.runner);
  assert.equal(result.status, "confirmation_required");
  assert.deepEqual(f.calls, [["mcp", "show", "sandbase", "--json"]]);
  assert.match(result.message, /left untouched/i);
});

test("OpenClaw MCP readback mismatch restores a prior managed entry", async () => {
  const previous = "/home/test/.sandbase/bin/sandbase-mcp-bridge.mjs";
  const next = "/home/test/.sandbase/bin/new-sandbase-mcp-bridge.mjs";
  const f = openClawFixture([
    { code: 0, stdout: managedMcp(previous) },
    { code: 0 },
    { code: 0, stdout: JSON.stringify({ command: "node", args: [next, "--client", "wrong"], env: { SANDBASE_CLI_MANAGED: "1" } }) },
    { code: 0 },
  ]);
  const result = await installOpenClawMcp(next, f.runner);
  assert.equal(result.status, "failed");
  assert.deepEqual(f.calls, [
    ["mcp", "show", "sandbase", "--json"],
    ["mcp", "set", "sandbase", managedMcp(next)],
    ["mcp", "show", "sandbase", "--json"],
    ["mcp", "set", "sandbase", managedMcp(previous)],
  ]);
});

test("OpenClaw MCP inspection and removal only act on the managed bridge", async () => {
  const foreign = openClawFixture([{ code: 0, stdout: JSON.stringify({ command: "python", args: ["-m", "other_mcp"] }) }]);
  assert.equal((await removeOpenClawMcp(foreign.runner)).status, "confirmation_required");
  assert.deepEqual(foreign.calls, [["mcp", "show", "sandbase", "--json"]]);

  const managed = openClawFixture([{ code: 0, stdout: managedMcp() }, { code: 0 }, { code: 1 }]);
  assert.equal((await removeOpenClawMcp(managed.runner)).status, "removed");
  assert.deepEqual(managed.calls, [["mcp", "show", "sandbase", "--json"], ["mcp", "unset", "sandbase"], ["mcp", "show", "sandbase", "--json"]]);

  const inspect = openClawFixture([{ code: 0, stdout: managedMcp() }]);
  assert.equal((await inspectOpenClawMcp(inspect.runner)).status, "already_configured");
});

test("Kiro native adapter uses the approved immutable source and agent selector", async () => {
  const f = fixture([{ code: 0, stdout: "skills 1.5.20" }, { code: 0, stdout: "" }, { code: 0, stdout: "[]" }, { code: 0 }, { code: 0, stdout: listed }]);
  const result = await installNativeSkill("kiro-cli", f.runner, async json => json === listed);
  assert.deepEqual(result, { status: "installed", message: "Native SandBase Skill was installed and verified by Skills CLI readback." });
  assert.deepEqual(f.calls, [
    ["--version"],
    ["add", sandbaseSkillRelease.sourceArg, "--agent", "kiro-cli", "--list"],
    ["list", "-g", "-a", "kiro-cli", "--json"],
    ["add", sandbaseSkillRelease.sourceArg, "-g", "-a", "kiro-cli"],
    ["list", "-g", "-a", "kiro-cli", "--json"],
  ]);
});

test("invalid source tuples and unsupported targets fail closed before installation", async () => {
  const f = fixture([]);
  assert.equal(validateSandbaseSkillRelease({ ...sandbaseSkillRelease, release: "main" } as never), false);
  // The exported release is immutable in production; an unsupported target is also rejected before process invocation.
  const result = await installNativeSkill("codex", f.runner);
  assert.equal(result.code, "unsupported_by_skills_cli");
  assert.deepEqual(f.calls, []);
});

test("missing or old Skills CLI fails closed without an add invocation", async () => {
  const f = fixture([{ code: 0, stdout: "skills 1.5.19" }]);
  const result = await installNativeSkill("kiro-cli", f.runner);
  assert.equal(result.code, "skills_cli_unavailable");
  assert.deepEqual(f.calls, [["--version"]]);
});

test("readback requires the SandBase source and an owned Skill is removed through Skills CLI", async () => {
  const f = fixture([{ code: 0, stdout: "skills 1.5.20" }, { code: 0, stdout: "" }, { code: 0, stdout: listed }, { code: 0 }, { code: 0, stdout: "[]" }]);
  const result = await removeNativeSkill("kiro-cli", f.runner, async json => json === listed);
  assert.equal(result.status, "removed");
  assert.deepEqual(f.calls, [
    ["--version"],
    ["add", sandbaseSkillRelease.sourceArg, "--agent", "kiro-cli", "--list"], ["list", "-g", "-a", "kiro-cli", "--json"],
    ["remove", "sandbase", "-g", "-a", "kiro-cli"],
    ["list", "-g", "-a", "kiro-cli", "--json"],
  ]);
});

test("unproven ownership leaves third-party Skills untouched", async () => {
  const f = fixture([{ code: 0, stdout: "skills 1.5.20" }, { code: 0, stdout: "" }, { code: 0, stdout: "[]" }]);
  const result = await removeNativeSkill("kiro-cli", f.runner, async () => false);
  assert.equal(result.status, "confirmation_required");
  assert.equal(result.code, undefined);
  assert.deepEqual(f.calls, [["--version"], ["add", sandbaseSkillRelease.sourceArg, "--agent", "kiro-cli", "--list"], ["list", "-g", "-a", "kiro-cli", "--json"]]);
});

test("verified repeat installation is idempotent and never invokes add", async () => {
  const f = fixture([
    { code: 0, stdout: "skills 1.5.20" },
    { code: 0, stdout: "" },
    { code: 0, stdout: listed },
  ]);
  const result = await installNativeSkill("kiro-cli", f.runner, async json => json === listed);
  assert.equal(result.status, "already_installed");
  assert.deepEqual(f.calls, [
    ["--version"],
    ["add", sandbaseSkillRelease.sourceArg, "--agent", "kiro-cli", "--list"],
    ["list", "-g", "-a", "kiro-cli", "--json"],
  ]);
});

test("offline probe failure exposes no subprocess detail and stops before install", async () => {
  const f = fixture([{ code: 0, stdout: "skills 1.5.20" }, { code: 1, stderr: "offline credential=do-not-echo" }]);
  const result = await installNativeSkill("kiro-cli", f.runner);
  assert.equal(result.status, "failed");
  assert.equal(result.code, "skills_cli_unavailable");
  assert.doesNotMatch(result.message, /credential=do-not-echo/);
  assert.deepEqual(f.calls, [
    ["--version"],
    ["add", sandbaseSkillRelease.sourceArg, "--agent", "kiro-cli", "--list"],
  ]);
});
