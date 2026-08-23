import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { clients } from "../src/types.js";
import { doctor, unregister } from "../src/commands.js";
import { sandbaseSkillRelease } from "../src/skills-cli.js";
const cli = join(process.cwd(), "dist", "cli.js");

test("doctor uses the packaged sandbase entry point for every client", async () => {
  for (const client of clients) {
    const root = await mkdtemp(join(tmpdir(), `sandbase-doctor-${client}-`));
    const result = spawnSync(process.execPath, [cli, "doctor", "--client", client], {
      encoding: "utf8",
      env: { ...process.env, HOME: root, KIRO_HOME: join(root, ".kiro"), PWD: root, SANDBASE_HOME: join(root, ".sandbase") },
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, new RegExp(`^${client}:`));
  }
});

test("unregister uses the packaged sandbase entry point for every client", async () => {
  for (const client of clients) {
    const root = await mkdtemp(join(tmpdir(), `sandbase-unregister-${client}-`));
    const result = spawnSync(process.execPath, [cli, "unregister", "--client", client], {
      encoding: "utf8",
      env: { ...process.env, HOME: root, KIRO_HOME: join(root, ".kiro"), PWD: root, SANDBASE_HOME: join(root, ".sandbase") },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`^(?:Removed local SandBase |${client}: )`));
  }
});

test("connect without --client enters auto mode instead of selecting one client", { skip: process.platform === "darwin" }, async () => {
  const root = await mkdtemp(join(tmpdir(), "sandbase-connect-auto-cli-"));
  const result = spawnSync(process.execPath, [cli, "connect"], {
    encoding: "utf8",
    env: { ...process.env, HOME: root, SANDBASE_HOME: join(root, ".sandbase"), PATH: "" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No installed compatible clients support automatic MCP configuration/);
  assert.doesNotMatch(result.stdout, /Open this URL to authorize/);
});

test("default doctor and unregister only act on installed automatic adapters", async () => {
  const root = await mkdtemp(join(tmpdir(), "sandbase-default-maintenance-"));
  const codexHome = join(root, ".codex");
  const cursorHome = join(root, ".cursor");
  await mkdir(codexHome, { recursive: true });
  await mkdir(cursorHome, { recursive: true });
  await writeFile(join(codexHome, "config.toml"), '# >>> sandbase managed >>>\n[mcp_servers.sandbase]\ncommand = "node"\nargs = ["/sandbase-mcp-bridge.mjs", "--client", "codex"]\nenv = { SANDBASE_CLI_MANAGED = "1" }\n# <<< sandbase managed <<<\n');
  await writeFile(join(cursorHome, "mcp.json"), '{"mcpServers":{"sandbase":{"command":"node","args":["bridge","--client","cursor"],"env":{"SANDBASE_CLI_MANAGED":"1"}}}}\n');
  const removed: string[] = [];
  const output: string[] = [];
  const previousLog = console.log;
  const previousEnv = { HOME: process.env.HOME, CODEX_HOME: process.env.CODEX_HOME, SANDBASE_HOME: process.env.SANDBASE_HOME };
  const store = {
    get: async (client: string) => client === "codex" ? { keyPrefix: "sk-cli-test", mcpUrl: "https://example.test/v1/mcp", scope: ["mcp:invoke"] } : undefined,
    remove: async (client: string) => void removed.push(client),
    save: async () => undefined,
  };
  const detect = (client: string) => ({ installed: client === "codex" || client === "cursor" || client === "openclaw", detail: "test" });
  console.log = (message: string) => void output.push(message);
  process.env.HOME = root;
  process.env.CODEX_HOME = codexHome;
  process.env.SANDBASE_HOME = join(root, ".sandbase");
  try {
    const openClawRunner = async () => ({ code: 0, stdout: JSON.stringify({ name: "sandbase", source: "workspace", homepage: "https://clawhub.ai/joeliu926/skills/sandbase" }), stderr: "" });
    assert.equal(await doctor("auto", store as never, detect as never, undefined, undefined, openClawRunner), false);
    await unregister("auto", store as never, detect as never, undefined, undefined, openClawRunner);
  } finally {
    console.log = previousLog;
    for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  assert.deepEqual(removed, ["codex", "cursor"]);
  assert.doesNotMatch(await readFile(join(codexHome, "config.toml"), "utf8"), /mcp_servers\.sandbase/);
  assert.doesNotMatch(await readFile(join(cursorHome, "mcp.json"), "utf8"), /sandbase/);
  assert.ok(output.some(line => line.startsWith("codex:")));
  assert.ok(output.some(line => line.startsWith("cursor:")));
  assert.ok(output.some(line => line.startsWith("openclaw:") && line.includes("mcp=")));
});

test("doctor uses source-specific Skills CLI readback for Kiro", async () => {
  const calls: string[][] = []; let listCount = 0; const output: string[] = []; const previousLog = console.log;
  const isolatedHome = await mkdtemp(join(tmpdir(), "sandbase-kiro-maintenance-"));
  const previousKiroHome = process.env.KIRO_HOME;
  const previousPwd = process.env.PWD;
  process.env.KIRO_HOME = join(isolatedHome, ".kiro");
  process.env.PWD = isolatedHome;
  const runner = async (args: readonly string[]) => {
    calls.push([...args]);
    if (args[0] === "--version") return { code: 0, stdout: "skills 1.5.20", stderr: "" };
    if (args[0] === "add" || args[0] === "remove") return { code: 0, stdout: "", stderr: "" };
    listCount++;
    return { code: 0, stdout: listCount === 3 ? "third-party skill" : sandbaseSkillRelease.sourceArg, stderr: "" };
  };
  console.log = (message: string) => void output.push(message);
  try {
    assert.equal(await doctor("kiro-cli", {} as never, () => ({ installed: true, detail: "fixture" }), runner, async json => json === sandbaseSkillRelease.sourceArg), true);
  } finally {
    console.log = previousLog;
    if (previousKiroHome === undefined) delete process.env.KIRO_HOME; else process.env.KIRO_HOME = previousKiroHome;
    if (previousPwd === undefined) delete process.env.PWD; else process.env.PWD = previousPwd;
  }
  assert.deepEqual(calls, [
    ["--version"], ["add", sandbaseSkillRelease.sourceArg, "--agent", "kiro-cli", "--list"], ["list", "-g", "-a", "kiro-cli", "--json"],
  ]);
  assert.match(output[0]!, /mcp=not_configured, skill=already_installed/);
});

test("Kiro unregister removes independently owned MCP and Skill state", async () => {
  const root = await mkdtemp(join(tmpdir(), "sandbase-kiro-unregister-"));
  const config = join(root, ".kiro", "settings", "mcp.json");
  const bridge = join(root, ".sandbase", "bin", "sandbase-mcp-bridge.mjs");
  await mkdir(join(config, ".."), { recursive: true });
  await writeFile(config, JSON.stringify({ mcpServers: { sandbase: { command: `node ${JSON.stringify(bridge)} --client kiro-cli` } } }) + "\n");
  const previous = { HOME: process.env.HOME, SANDBASE_HOME: process.env.SANDBASE_HOME, PWD: process.env.PWD };
  process.env.HOME = root;
  process.env.SANDBASE_HOME = join(root, ".sandbase");
  process.env.PWD = join(root, "project");
  const removed: string[] = [];
  const store = {
    get: async () => ({ credential: "test-secret", credentialId: "key", keyPrefix: "sk-cli-test", client: "kiro-cli", scope: ["mcp:invoke"], mcpUrl: "https://example.test/v1/mcp", createdAt: "now" }),
    save: async () => undefined,
    remove: async (client: string) => void removed.push(client),
  };
  let skillListCount = 0;
  const skillsRunner = async (args: readonly string[]) => {
    if (args[0] === "--version") return { code: 0, stdout: "skills 1.5.20", stderr: "" };
    if (args[0] === "add" || args[0] === "remove") return { code: 0, stdout: "", stderr: "" };
    skillListCount++;
    return { code: 0, stdout: skillListCount === 1 ? sandbaseSkillRelease.sourceArg : "not installed", stderr: "" };
  };
  const bRunner = async (_client: string, args: readonly string[]) => {
    if (args[1] === "remove" && args.at(-1) !== "--help") await writeFile(config, '{"mcpServers":{}}\n');
    return { code: 0, stdout: "supported", stderr: "" };
  };
  try {
    await unregister("kiro-cli", store as never, () => ({ installed: true, detail: "fixture" }), skillsRunner, async output => output === sandbaseSkillRelease.sourceArg, undefined, undefined, undefined, bRunner as never);
    assert.deepEqual(removed, ["kiro-cli"]);
    assert.doesNotMatch(await readFile(config, "utf8"), /sandbase/);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("Kiro unregister restores MCP and credential when Skill removal readback fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "sandbase-kiro-unregister-rollback-"));
  const config = join(root, ".kiro", "settings", "mcp.json");
  const bridge = join(root, ".sandbase", "bin", "sandbase-mcp-bridge.mjs");
  await mkdir(join(config, ".."), { recursive: true });
  const original = JSON.stringify({ mcpServers: { sandbase: { command: `node ${JSON.stringify(bridge)} --client kiro-cli` } } }, null, 2) + "\n";
  await writeFile(config, original);
  const previous = { HOME: process.env.HOME, SANDBASE_HOME: process.env.SANDBASE_HOME, PWD: process.env.PWD };
  process.env.HOME = root;
  process.env.SANDBASE_HOME = join(root, ".sandbase");
  process.env.PWD = join(root, "project");
  const credential = { credential: "test-secret", credentialId: "key", keyPrefix: "sk-cli-test", client: "kiro-cli" as const, scope: ["mcp:invoke"], mcpUrl: "https://example.test/v1/mcp", createdAt: "now" };
  const saved: unknown[] = [];
  const store = { get: async () => credential, remove: async () => undefined, save: async (value: unknown) => void saved.push(value) };
  const skillsRunner = async (args: readonly string[]) => {
    if (args[0] === "--version") return { code: 0, stdout: "skills 1.5.20", stderr: "" };
    if (args[0] === "add" || args[0] === "remove") return { code: 0, stdout: "", stderr: "" };
    return { code: 0, stdout: sandbaseSkillRelease.sourceArg, stderr: "" };
  };
  const bRunner = async (_client: string, args: readonly string[]) => {
    if (args[1] === "remove" && args.at(-1) !== "--help") await writeFile(config, '{"mcpServers":{}}\n');
    return { code: 0, stdout: "supported", stderr: "" };
  };
  try {
    await assert.rejects(unregister("kiro-cli", store as never, () => ({ installed: true, detail: "fixture" }), skillsRunner, async output => output === sandbaseSkillRelease.sourceArg, undefined, undefined, undefined, bRunner as never), /could not prove native Skill removal/);
    assert.equal(await readFile(config, "utf8"), original);
    assert.deepEqual(saved, [credential]);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("A1 unregister restores managed configuration when credential removal fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "sandbase-a1-unregister-rollback-"));
  const config = join(root, ".config", "opencode", "opencode.json");
  const bridge = join(root, ".sandbase", "bin", "sandbase-mcp-bridge.mjs");
  await mkdir(join(config, ".."), { recursive: true });
  const original = JSON.stringify({
    theme: "dark",
    mcp: { servers: { sandbase: { type: "local", command: ["node", bridge, "--client", "opencode"], enabled: true } } },
  }, null, 2) + "\n";
  await writeFile(config, original);
  const previousEnv = { HOME: process.env.HOME, SANDBASE_HOME: process.env.SANDBASE_HOME };
  process.env.HOME = root;
  process.env.SANDBASE_HOME = join(root, ".sandbase");
  const store = {
    get: async () => ({ credential: "test-secret", credentialId: "key", keyPrefix: "sk-cli-ab", client: "opencode", scope: ["mcp:invoke"], mcpUrl: "https://example.test/v1/mcp", createdAt: "now" }),
    save: async () => undefined,
    remove: async () => { throw new Error("credential store unavailable"); },
  };
  const runner = async (_client: string, args: readonly string[]) => ({ code: 0, stdout: args.join(" ") === "mcp list" ? "no servers" : "", stderr: "" });
  try {
    await assert.rejects(unregister("opencode", store as never, () => ({ installed: true, detail: "fixture" }), undefined, undefined, undefined, undefined, runner as never), /credential store unavailable/);
    assert.equal(await readFile(config, "utf8"), original);
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test("module B unregister restores managed configuration when credential removal fails", async () => {
  const root=await mkdtemp(join(tmpdir(),"sandbase-b-unregister-rollback-")),config=join(root,".cursor","mcp.json"),bridge=join(root,".sandbase","bin","sandbase-mcp-bridge.mjs");await mkdir(join(config,".."),{recursive:true});const original=JSON.stringify({theme:"dark",mcpServers:{sandbase:{command:"node",args:[bridge,"--client","cursor-cli"]}}},null,2)+"\n";await writeFile(config,original);const previous={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,PWD:process.env.PWD};process.env.HOME=root;process.env.SANDBASE_HOME=join(root,".sandbase");process.env.PWD=join(root,"project");const credential={credential:"test-secret",credentialId:"key",keyPrefix:"sk-cli-ab",client:"cursor-cli" as const,scope:["mcp:invoke"],mcpUrl:"https://example.test/v1/mcp",createdAt:"now"};const store={get:async()=>credential,save:async()=>{},remove:async()=>{throw new Error("credential store unavailable")}};const runner=async(_client:string,args:readonly string[])=>({code:0,stdout:args[1]==="list"?"no servers":"supported",stderr:""});try{await assert.rejects(unregister("cursor-cli",store as never,()=>({installed:true,detail:"fixture"}),undefined,undefined,undefined,undefined,undefined,runner as never),/credential store unavailable/);assert.equal(await readFile(config,"utf8"),original);}finally{for(const[key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
