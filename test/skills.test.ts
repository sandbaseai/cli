import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { doctor } from "../src/commands.js";
import { skillTiers } from "../src/clients.js";
import { inspectSkill, installSkill, probeSkill, removeSkill, rollbackSkill, sharedSkillPath, sharedSkillReferences, skillFallback, skillPath } from "../src/skills.js";

async function environment() {
  const root = await mkdtemp(join(tmpdir(), "sandbase-skill-"));
  return { ...process.env, HOME: root, CODEX_HOME: join(root, ".codex"), HERMES_HOME: join(root, ".hermes-managed"), SANDBASE_HOME: join(root, ".sandbase") };
}

test("Cursor and Codex converge on one owned shared native Skill", async () => {
  const env = await environment();
  assert.equal(skillTiers.cursor, "s3_promotion");
  assert.equal(skillTiers.codex, "s3_promotion");
  const cursor = await installSkill("cursor", env); const codex = await installSkill("codex", env);
  assert.equal(cursor.state, "configured"); assert.equal(codex.state, "already_configured");
  assert.equal(skillPath("cursor", env), sharedSkillPath(env)); assert.equal(skillPath("codex", env), sharedSkillPath(env));
  const content = await readFile(sharedSkillPath(env), "utf8");
  assert.match(content, /^name: sandbase$/m); assert.match(content, /^disable-model-invocation: true$/m); assert.match(content, /sandbase-cli-managed: sandbase/);
  assert.doesNotMatch(content, /(?:sk-|cln-|authorization|credential|\/Users\/|C:\\Users\\)/i);
  const again = await installSkill("cursor", env); assert.equal(again.state, "already_configured"); assert.equal(again.changed, false);
});

test("rollback restores both a native Skill and its ownership metadata", async () => {
  const env = await environment(); const result = await installSkill("claude-code", env); const path = skillPath("claude-code", env)!; const metadata = join(dirname(path), ".sandbase-managed.json");
  assert.equal(result.changed, true); await rollbackSkill(result); await assert.rejects(readFile(path, "utf8"), /ENOENT/); await assert.rejects(readFile(metadata, "utf8"), /ENOENT/);
});

test("modified shared Skill and unmanaged legacy copies fail closed", async () => {
  const env = await environment();
  const path = sharedSkillPath(env);
  await installSkill("cursor", env);
  await writeFile(path, `${await readFile(path, "utf8")}\n<!-- local formatting -->\n`);
  await assert.rejects(() => installSkill("cursor", env), /ownership or checksum is invalid/);
  await writeFile(path, "# user-owned skill\n");
  const probe = await probeSkill("cursor", env);
  assert.equal(probe.compatible, false);
  assert.match(probe.message, /ownership or checksum is invalid/);
  await assert.rejects(() => installSkill("cursor", env), /ownership or checksum is invalid/);
  await assert.rejects(() => removeSkill("cursor", env), /ownership or checksum is invalid/);
  assert.equal(await readFile(path, "utf8"), "# user-owned skill\n");
  assert.equal(await inspectSkill("cursor", env), "modified");
});

test("unregister removes only the SandBase-owned artifact and preserves sibling Skills", async () => {
  const env = await environment();
  const path = sharedSkillPath(env);
  await installSkill("cursor", env);
  const sibling = join(env.HOME!, ".agents", "skills", "unrelated", "SKILL.md");
  await mkdir(join(env.HOME!, ".agents", "skills", "unrelated"), { recursive: true });
  await writeFile(sibling, "# Unrelated\n");
  assert.equal(await removeSkill("cursor", env), true);
  assert.equal(await inspectSkill("cursor", env), "missing");
  assert.equal(await readFile(sibling, "utf8"), "# Unrelated\n");
  await assert.rejects(() => readFile(path, "utf8"));
  assert.equal(await removeSkill("cursor", env), false);
});

test("Claude Code and Hermes use isolated managed Skill roots while S4 clients do not create an artifact", async () => {
  const env = await environment();
  assert.equal((await installSkill("claude-code", env)).state, "configured");
  assert.equal(await inspectSkill("claude-code", env), "installed");
  assert.equal(skillPath("claude-code", env), join(env.HOME!, ".claude", "skills", "sandbase", "SKILL.md"));
  const hermes = await installSkill("hermes", env);
  const hermesPath = join(env.HERMES_HOME!, "skills", "sandbase", "SKILL.md");
  assert.equal(hermes.state, "configured");
  assert.equal(skillPath("hermes", env), hermesPath);
  assert.equal(await inspectSkill("hermes", env), "installed");
  await writeFile(hermesPath, "# user-owned Hermes Skill\n");
  assert.equal(await inspectSkill("hermes", env), "modified");
  await assert.rejects(() => removeSkill("hermes", env), /ownership or checksum is invalid/);
  assert.equal(await readFile(hermesPath, "utf8"), "# user-owned Hermes Skill\n");
  assert.equal((await installSkill("windsurf", env)).state, "skipped");
  assert.equal(await inspectSkill("windsurf", env), "unsupported");
});

test("doctor reports MCP and native Skill state independently", async () => {
  const env = await environment();
  const config = join(env.HOME!, ".cursor", "mcp.json");
  await mkdir(join(env.HOME!, ".cursor"), { recursive: true });
  await writeFile(config, '{"mcpServers":{"sandbase":{"command":"node","args":["bridge","--client","cursor"],"env":{"SANDBASE_CLI_MANAGED":"1"}}}}\n');
  const output: string[] = []; const original = console.log; const oldEnv = { ...process.env };
  Object.assign(process.env, env); console.log = (line: string) => void output.push(line);
  const store = { get: async () => ({ keyPrefix: "sk-cli-test", mcpUrl: "https://example.test/v1/mcp", scope: ["mcp:invoke"] }), remove: async () => undefined, save: async () => undefined };
  try {
    assert.equal(await doctor("cursor", store as never, () => ({ installed: true, detail: "test" })), false);
    await installSkill("cursor", env);
    assert.equal(await doctor("cursor", store as never, () => ({ installed: true, detail: "test" })), true);
  } finally { console.log = original; for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key]; Object.assign(process.env, oldEnv); }
  assert.ok(output.some(line => line.includes("skill=missing")));
  assert.ok(output.some(line => line.includes("skill=installed") && line.includes("Native discovery remains unverified")));
});

test("concurrent shared installs are idempotent and clean only verified legacy private copies", async () => {
  const env = await environment();
  const legacy = join(env.HOME!, ".cursor", "skills", "sandbase", "SKILL.md");
  await mkdir(join(env.HOME!, ".cursor", "skills", "sandbase"), { recursive: true });
  await writeFile(legacy, await readFile(join(process.cwd(), "skills", "sandbase", "SKILL.md"), "utf8"));
  const results = await Promise.all([installSkill("cursor", env), installSkill("codex", env)]);
  assert.ok(results.some(result => result.state === "configured"));
  assert.match(await readFile(sharedSkillPath(env), "utf8"), /disable-model-invocation: true/);
  await assert.rejects(() => readFile(legacy, "utf8"));
});

test("shared checksum and client-scoped references fail closed", async () => {
  const env = await environment();
  await installSkill("cursor", env);
  const cursorConfig = join(env.HOME!, ".cursor", "mcp.json"); const codexConfig = join(env.CODEX_HOME!, "config.toml");
  await mkdir(dirname(cursorConfig), { recursive: true }); await mkdir(dirname(codexConfig), { recursive: true });
  await writeFile(cursorConfig, '{"mcpServers":{"sandbase":{"command":"node","args":["bridge","--client","cursor"],"env":{"SANDBASE_CLI_MANAGED":"1"}}}}\n'); await writeFile(codexConfig, '# >>> sandbase managed >>>\n[mcp_servers.sandbase]\ncommand = "node"\nargs = ["/sandbase-mcp-bridge.mjs", "--client", "codex"]\nenv = { SANDBASE_CLI_MANAGED = "1" }\n# <<< sandbase managed <<<\n');
  assert.deepEqual(await sharedSkillReferences(env), ["cursor", "codex"]);
  assert.equal(await removeSkill("cursor", env), false);
  await writeFile(cursorConfig, '{"mcpServers":{}}\n'); await writeFile(codexConfig, "");
  assert.equal(await removeSkill("codex", env), true);
  await installSkill("cursor", env);
  await writeFile(join(dirname(sharedSkillPath(env)), ".sandbase-managed.json"), '{"owner":"sandbase-cli","sha256":"wrong"}\n');
  assert.equal(await inspectSkill("cursor", env), "modified");
  await assert.rejects(() => installSkill("cursor", env), /ownership or checksum is invalid/);
});
