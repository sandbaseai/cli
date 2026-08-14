import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { connect } from "../src/commands.js";
import { sandbaseSkillRelease } from "../src/skills-cli.js";
import { FileCredentialStore } from "../src/credentials/store.js";
import type { AuthorizationApi } from "../src/auth/api.js";
import { promptAssistedClients, type ConnectClient, type PromptAssistedClient } from "../src/types.js";

function approvedApi(client: "auto" | "kiro-cli", secret = "sk-cli-kiro-fixture"): AuthorizationApi {
  return { create: async () => ({ authorization_id: "cla_kiro", status: "pending", verification_uri_complete: "https://example.test/authorize", expires_at: "later", interval: 1 }), status: async () => ({ status: "approved", interval: 1 }), exchange: async () => ({ credential: secret, credential_id: "key", key_prefix: "sk-cli-fixture", client, scope: ["mcp:invoke"], mcp_url: "https://example.test/v1/mcp", created_at: "now", cleanup_token: "cleanup-fixture", cleanup_expires_at: "later" }), cancel: async () => {}, cleanup: async () => {} } as unknown as AuthorizationApi;
}

function kiroRunner(path: string) {
  let installed = false;
  return async (_client: string, args: readonly string[]) => {
    if (args.includes("--help")) return { code: 0, stdout: "--scope", stderr: "" };
    if (args[0] === "--version") return { code: 0, stdout: "kiro-cli 1.0", stderr: "" };
    if (args[0] === "mcp" && args[1] === "add") {
      installed = true; await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify({ mcpServers: { sandbase: { command: args.at(-1) } } }));
      return { code: 0, stdout: "added", stderr: "" };
    }
    if (args[0] === "mcp" && (args[1] === "list" || args[1] === "status")) return { code: 0, stdout: installed ? "sandbase" : "", stderr: "" };
    return { code: 0, stdout: "", stderr: "" };
  };
}

test("save failure triggers grant-bound cleanup and never logs secrets", async()=>{
  let cleanup:unknown[]=[]; const secret="sk-cli-super-secret", token="cln-super-secret"; const api={ create:async()=>({authorization_id:"cla_x",status:"pending",verification_uri_complete:"https://example/auth",expires_at:"later",interval:1}), status:async()=>({status:"approved",interval:1}), exchange:async()=>({credential:secret,credential_id:"key",key_prefix:"sk-cli-ab",client:"codex",scope:["mcp:invoke"],mcp_url:"https://example/v1/mcp",created_at:"now",cleanup_token:token,cleanup_expires_at:"later"}), cancel:async()=>{}, cleanup:async(...args:unknown[])=>void cleanup.push(args) } as unknown as AuthorizationApi;
  const store={save:async()=>{throw new Error("disk full")},get:async()=>undefined,remove:async()=>{}} as unknown as FileCredentialStore; const logs:string[]=[];
  await assert.rejects(connect("codex",{api,store,open:async()=>{},log:s=>logs.push(s),detect:()=>({installed:true,detail:"test"})}),/disk full/); assert.deepEqual(cleanup,[["cla_x",token]]); assert.ok(!logs.join(" ").includes(secret)); assert.ok(!logs.join(" ").includes(token));
});

function promptApi(client: PromptAssistedClient, cleanup: string[] = []): AuthorizationApi {
  return {
    create: async (requested: ConnectClient) => { assert.equal(requested, client); return { authorization_id: `cla_${client}`, status: "pending", verification_uri_complete: "https://example.test/authorize", expires_at: "later", interval: 1 }; },
    status: async () => ({ status: "approved", interval: 1 }),
    exchange: async () => ({ credential: `fixture-credential-${client}`, credential_id: `key-${client}`, key_prefix: "fixture-prefix", client, scope: ["mcp:invoke"], mcp_url: "https://example.test/v1/mcp", created_at: "now", cleanup_token: `fixture-cleanup-${client}`, cleanup_expires_at: "later" }),
    cancel: async () => {}, cleanup: async (_id: string, token: string) => { cleanup.push(token); },
  } as unknown as AuthorizationApi;
}

test("five prompt-assisted clients authorize, store isolated credentials, and print only stable action-required launchers", async () => {
  const packaged = await import(pathToFileURL(join(process.cwd(), "dist", "commands.js")).href) as typeof import("../src/commands.js");
  for (const client of promptAssistedClients) {
    const sandboxHome = await mkdtemp(join(tmpdir(), `sandbase-prompt-${client}-`)); const previous = process.env.SANDBASE_HOME; process.env.SANDBASE_HOME = sandboxHome; const logs: string[] = []; const store = new FileCredentialStore(sandboxHome);
    try { await packaged.connect(client, { api: promptApi(client), store, open: async () => {}, log: line => logs.push(line), detect: () => { throw new Error("prompt-assisted connect must not probe a client-private path"); } }); }
    finally { if (previous === undefined) delete process.env.SANDBASE_HOME; else process.env.SANDBASE_HOME = previous; }
    const output = logs.join("\n"); const stored = await store.get(client);
    assert.equal(stored?.client, client); assert.equal(stored?.credential, `fixture-credential-${client}`); assert.equal(stored?.scope.join(","), "mcp:invoke");
    assert.match(output, new RegExp(`^Open this URL to authorize:[\\s\\S]*${client}: status=action_required`));
    assert.match(output, /registration=registration_required/); assert.match(output, /"command": "node"/); assert.match(output, /sandbase-mcp-bridge\.mjs/); assert.match(output, new RegExp(`"--client",\\s+"${client}"`));
    assert.doesNotMatch(output, /connected|status=configured|"command": "npx"|@sandbaseai\/cli/i); assert.doesNotMatch(output, /fixture-credential|fixture-cleanup/);
    assert.match(await readFile(join(sandboxHome, "bin", "sandbase-mcp-bridge.mjs"), "utf8"), /runMCPBridge/);
  }
});

test("prompt-assisted bridge preparation failure restores local state and invokes grant-bound cleanup", async () => {
  const packaged = await import(pathToFileURL(join(process.cwd(), "dist", "commands.js")).href) as typeof import("../src/commands.js");
  const sandboxHome = await mkdtemp(join(tmpdir(), "sandbase-prompt-cleanup-")); const previous = process.env.SANDBASE_HOME; process.env.SANDBASE_HOME = sandboxHome;
  await writeFile(join(sandboxHome, "bin"), "bridge directory conflict\n"); const store = new FileCredentialStore(sandboxHome); const cleanup: string[] = [];
  try { await assert.rejects(packaged.connect("antigravity", { api: promptApi("antigravity", cleanup), store, open: async () => {}, log: () => {} }), /EEXIST|ENOTDIR/); }
  finally { if (previous === undefined) delete process.env.SANDBASE_HOME; else process.env.SANDBASE_HOME = previous; }
  assert.equal(await store.get("antigravity"), undefined); assert.deepEqual(cleanup, ["fixture-cleanup-antigravity"]);
});

test("default connect installs Kiro native Skills independently alongside its MCP adapter", async()=>{
  const packagedModule=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js");
  const root=await mkdtemp(join(tmpdir(),"sandbase-auto-kiro-")); const sandboxHome=join(root,"sandbase"); const userHome=join(root,"home"); const kiroHome=join(userHome,".kiro");
  const before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,KIRO_HOME:process.env.KIRO_HOME,PWD:process.env.PWD}; process.env.HOME=userHome; process.env.SANDBASE_HOME=sandboxHome; process.env.KIRO_HOME=kiroHome; process.env.PWD=root;
  const logs:string[]=[]; const calls:string[][]=[]; let listed=0;
  const skillsRunner=async(args:readonly string[])=>{
    calls.push([...args]);
    if(args[0]==="--version") return {code:0,stdout:"skills 1.5.20",stderr:""};
    if(args[0]==="add") return {code:0,stdout:"",stderr:""};
    listed++; return {code:0,stdout:listed === 1 ? "" : `kiro-cli ${sandbaseSkillRelease.sourceArg}`,stderr:""};
  };
  try { await packagedModule.connect("auto",{api:approvedApi("auto"),store:new FileCredentialStore(sandboxHome),open:async()=>{},log:s=>logs.push(s),detect:client=>({installed:client==="kiro-cli",detail:"fixture"}),skillsRunner,skillsReadbackVerifier:async json=>json.includes(sandbaseSkillRelease.sourceArg),bRunner:kiroRunner(join(kiroHome,"settings","mcp.json"))}); }
  finally { for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;} }
  assert.deepEqual(calls,[["--version"],["add",sandbaseSkillRelease.sourceArg,"--agent","kiro-cli","--list"],["list","-g","-a","kiro-cli","--json"],["add",sandbaseSkillRelease.sourceArg,"-g","-a","kiro-cli"],["list","-g","-a","kiro-cli","--json"]]);
  assert.match(logs.join("\n"),/kiro-cli: status=confirmation_required, mcp=not_configured, skill=installed/);
  assert.match(logs.join("\n"),/Configured clients: kiro-cli/);
});

test("explicit Kiro install runs independent Skill and persistent MCP lifecycles without leaking authorization data", async () => {
  const packagedModule=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js");
  const root=await mkdtemp(join(tmpdir(),"sandbase-explicit-kiro-")); const sandboxHome=join(root,"sandbase"); const userHome=join(root,"home"); const kiroHome=join(userHome,".kiro");
  const before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,KIRO_HOME:process.env.KIRO_HOME,PWD:process.env.PWD}; process.env.HOME=userHome; process.env.SANDBASE_HOME=sandboxHome; process.env.KIRO_HOME=kiroHome; process.env.PWD=root;
  const calls: string[][] = []; const logs: string[] = []; const secret = "sk-cli-must-not-reach-skills";
  const skillsRunner = async (args: readonly string[]) => {
    calls.push([...args]);
    if (args[0] === "--version") return { code: 0, stdout: "skills 1.5.20", stderr: "" };
    if (args[0] === "add" && !args.includes("--list")) return { code: 0, stdout: "", stderr: "" };
    return { code: 0, stdout: calls.filter(call => call[0] === "list").length === 1 ? "[]" : sandbaseSkillRelease.sourceArg, stderr: "" };
  };
  try { await packagedModule.connect("kiro-cli", {
    api: approvedApi("kiro-cli", secret), store:new FileCredentialStore(sandboxHome), open:async()=>{},
    detect: client => ({ installed: client === "kiro-cli", detail: "fixture" }),
    log: line => logs.push(line),
    skillsRunner,
    skillsReadbackVerifier: async json => json === sandbaseSkillRelease.sourceArg,
    bRunner:kiroRunner(join(kiroHome,"settings","mcp.json")),
  }); } finally { for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;} }
  assert.deepEqual(calls, [
    ["--version"],
    ["add", sandbaseSkillRelease.sourceArg, "--agent", "kiro-cli", "--list"],
    ["list", "-g", "-a", "kiro-cli", "--json"],
    ["add", sandbaseSkillRelease.sourceArg, "-g", "-a", "kiro-cli"],
    ["list", "-g", "-a", "kiro-cli", "--json"],
  ]);
  assert.match(logs.join("\n"), /mcp=not_configured, skill=installed/);
  assert.match(logs.join("\n"), /local configuration is ready/i);
  assert.doesNotMatch(JSON.stringify(calls), new RegExp(secret));
  assert.doesNotMatch(logs.join("\n"), new RegExp(secret));
});

test("a Kiro Skills CLI failure is isolated from the automatic MCP transaction", async () => {
  const packagedModule = await import(pathToFileURL(join(process.cwd(), "dist", "commands.js")).href) as typeof import("../src/commands.js");
  const root = await mkdtemp(join(tmpdir(), "sandbase-kiro-isolation-")); const sandboxHome = join(root, "sandbase"); const userHome = join(root, "home");
  const before = { HOME: process.env.HOME, SANDBASE_HOME: process.env.SANDBASE_HOME };
  process.env.HOME = userHome; process.env.SANDBASE_HOME = sandboxHome;
  const secret = "sk-cli-transaction-secret"; const logs: string[] = []; const calls: string[][] = [];
  const api = {
    create: async () => ({ authorization_id: "cla_fixture", status: "pending", verification_uri_complete: "https://example.test/authorize", expires_at: "later", interval: 1 }),
    status: async () => ({ status: "approved", interval: 1 }),
    exchange: async () => ({ credential: secret, credential_id: "key", key_prefix: "sk-cli-fixture", client: "auto", scope: ["mcp:invoke"], mcp_url: "https://example.test/v1/mcp", created_at: "now", cleanup_token: "cleanup-fixture", cleanup_expires_at: "later" }),
    cancel: async () => {}, cleanup: async () => {},
  } as unknown as AuthorizationApi;
  const skillsRunner = async (args: readonly string[]) => {
    calls.push([...args]);
    return args[0] === "--version" ? { code: 0, stdout: "skills 1.5.20", stderr: "" } : { code: 1, stdout: "", stderr: "offline " + secret };
  };
  try {
    await packagedModule.connect("auto", {
      api, store: new FileCredentialStore(sandboxHome), open: async () => {}, log: line => logs.push(line),
      detect: client => ({ installed: client === "kiro-cli" || client === "cursor", detail: "fixture" }),
      skillsRunner,
    });
  } finally {
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  assert.match(logs.join("\n"), /kiro-cli: status=failed, mcp=not_configured, skill=failed/);
  assert.match(logs.join("\n"), /Configured clients: cursor/);
  assert.doesNotMatch(logs.join("\n"), new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(calls), new RegExp(secret));
});

test("successful connect prints installation summary and next-step prompts", async()=>{
  const packagedModule=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js");
  const root=await mkdtemp(join(tmpdir(),"sandbase-connect-success-")); const sandboxHome=join(root,"sandbase"); const userHome=join(root,"home"); const before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME};
  process.env.HOME=userHome; process.env.SANDBASE_HOME=sandboxHome;
  const secret="sk-cli-secret-that-must-not-be-logged"; const logs:string[]=[];
  const api={ create:async()=>({authorization_id:"cla_x",status:"pending",verification_uri_complete:"https://example/auth",expires_at:"later",interval:1}), status:async()=>({status:"approved",interval:1}), exchange:async()=>({credential:secret,credential_id:"key",key_prefix:"sk-cli-ab",client:"cursor",scope:["mcp:invoke"],mcp_url:"https://example/v1/mcp",created_at:"now",cleanup_token:"cln-test",cleanup_expires_at:"later"}), cancel:async()=>{}, cleanup:async()=>{} } as unknown as AuthorizationApi;
  try { await packagedModule.connect("cursor",{api,store:new FileCredentialStore(sandboxHome),open:async()=>{},log:s=>logs.push(s),detect:()=>({installed:true,detail:"test"})}); }
  finally { for(const [key,value] of Object.entries(before)){ if(value===undefined) delete process.env[key]; else process.env[key]=value; } }
  const output=logs.join("\n");
  assert.match(output,/local configuration is ready/i);
  assert.match(output,/Restart or reload Cursor/);
  assert.match(output,/List the available SandBase MCP tools/);
  assert.match(output,/Use SandBase to fetch Elon Musk's latest 10 posts on Twitter/);
  assert.match(output,/Credential was stored locally with restricted permissions/);
  assert.doesNotMatch(output,/sandbase-mcp-bridge\.mjs/);
  assert.ok(!output.includes(secret));
});

test("OpenClaw connect installs the Skill before authorizing and reports local readback as action-required", async()=>{
  const packagedModule=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js");
  const root=await mkdtemp(join(tmpdir(),"sandbase-connect-skill-")); const sandboxHome=join(root,"sandbase"); const userHome=join(root,"home"); const before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME};
  process.env.HOME=userHome; process.env.SANDBASE_HOME=sandboxHome;
  const secret="sk-cli-secret-that-must-not-be-logged"; const logs:string[]=[];
  const api={ create:async()=>({authorization_id:"cla_x",status:"pending",verification_uri_complete:"https://example/auth",expires_at:"later",interval:1}), status:async()=>({status:"approved",interval:1}), exchange:async()=>({credential:secret,credential_id:"key",key_prefix:"sk-cli-ab",client:"openclaw",scope:["mcp:invoke"],mcp_url:"https://example/v1/mcp",created_at:"now",cleanup_token:"cln-test",cleanup_expires_at:"later"}), cancel:async()=>{}, cleanup:async()=>{} } as unknown as AuthorizationApi;
  const calls: string[][]=[]; const bridge = join(sandboxHome,"bin","sandbase-mcp-bridge.mjs");
  const openClawRunner=async(args: readonly string[])=>{ calls.push([...args]);
    if(args[0]==="skills" && args[1]==="info" && calls.length===1)return {code:0,stdout:"{}",stderr:""};
    if(args[0]==="skills" && args[1]==="install")return {code:0,stdout:"",stderr:""};
    if(args[0]==="skills" && args[1]==="info")return {code:0,stdout:JSON.stringify({name:"sandbase",source:"workspace",homepage:"https://clawhub.ai/joeliu926/skills/sandbase"}),stderr:""};
    if(args[0]==="mcp" && args[1]==="show" && calls.filter(call=>call[0]==="mcp").length===1)return {code:1,stdout:"",stderr:""};
    if(args[0]==="mcp" && args[1]==="set")return {code:0,stdout:"",stderr:""};
    return {code:0,stdout:JSON.stringify({command:"node",args:[bridge,"--client","openclaw"],env:{SANDBASE_CLI_MANAGED:"1"}}),stderr:""};
  };
  try { await packagedModule.connect("openclaw",{api,store:new FileCredentialStore(sandboxHome),open:async()=>{},log:s=>logs.push(s),detect:()=>({installed:true,detail:"manual"}),openClawRunner}); }
  finally { for(const [key,value] of Object.entries(before)){ if(value===undefined) delete process.env[key]; else process.env[key]=value; } }
  const output=logs.join("\n");
  assert.match(output,/openclaw: status=action_required, mcp=local_configured, skill=already_installed/);
  assert.deepEqual(calls, [["skills","info","sandbase","--json"],["skills","install","@joeliu926/sandbase"],["skills","info","sandbase","--json"],["mcp","show","sandbase","--json"],["mcp","set","sandbase",JSON.stringify({command:"node",args:[bridge,"--client","openclaw"],env:{SANDBASE_CLI_MANAGED:"1"}})],["mcp","show","sandbase","--json"]]);
  assert.ok(!output.includes(secret));
});

test("OpenClaw MCP ownership conflict cleans up the new grant, credential, and bridge", async () => {
  const packagedModule = await import(pathToFileURL(join(process.cwd(), "dist", "commands.js")).href) as typeof import("../src/commands.js");
  const root = await mkdtemp(join(tmpdir(), "sandbase-openclaw-rollback-")); const sandboxHome = join(root, "sandbase"); const before = { SANDBASE_HOME: process.env.SANDBASE_HOME };
  process.env.SANDBASE_HOME = sandboxHome; let cleanup = 0;
  const api = { create: async () => ({ authorization_id: "cla_x", status: "pending", verification_uri_complete: "https://example/auth", expires_at: "later", interval: 1 }), status: async () => ({ status: "approved", interval: 1 }), exchange: async () => ({ credential: "sk-cli-never-log", credential_id: "key", key_prefix: "sk-cli-ab", client: "openclaw", scope: ["mcp:invoke"], mcp_url: "https://example/v1/mcp", created_at: "now", cleanup_token: "cleanup-token", cleanup_expires_at: "later" }), cancel: async () => {}, cleanup: async () => { cleanup++; } } as unknown as AuthorizationApi;
  const openClawRunner = async (args: readonly string[]) => {
    if (args[0] === "skills" && args[1] === "info") return { code: 0, stdout: openClawReadback(), stderr: "" };
    return { code: 0, stdout: JSON.stringify({ command: "python", args: ["-m", "other_mcp"] }), stderr: "" };
  };
  try {
    await assert.rejects(packagedModule.connect("openclaw", { api, store: new FileCredentialStore(sandboxHome), open: async () => {}, log: () => {}, detect: () => ({ installed: true, detail: "fixture" }), openClawRunner }), /left untouched/);
    assert.equal(await new FileCredentialStore(sandboxHome).get("openclaw"), undefined);
    await assert.rejects(readFile(join(sandboxHome, "bin", "sandbase-mcp-bridge.mjs"), "utf8"), /ENOENT/);
  } finally { if (before.SANDBASE_HOME === undefined) delete process.env.SANDBASE_HOME; else process.env.SANDBASE_HOME = before.SANDBASE_HOME; }
  assert.equal(cleanup, 1);
});

test("automatic mode authorizes once when OpenClaw joins another automatic client", async () => {
  const packagedModule = await import(pathToFileURL(join(process.cwd(), "dist", "commands.js")).href) as typeof import("../src/commands.js");
  const root = await mkdtemp(join(tmpdir(), "sandbase-auto-openclaw-")); const sandboxHome = join(root, "sandbase"); const userHome = join(root, "home"); const previous = { HOME: process.env.HOME, SANDBASE_HOME: process.env.SANDBASE_HOME, CODEX_HOME: process.env.CODEX_HOME };
  process.env.HOME = userHome; process.env.SANDBASE_HOME = sandboxHome; process.env.CODEX_HOME = join(userHome, ".codex"); let creates = 0; const bridge = join(sandboxHome, "bin", "sandbase-mcp-bridge.mjs");
  const api = { create: async () => { creates++; return { authorization_id: "cla_x", status: "pending", verification_uri_complete: "https://example/auth", expires_at: "later", interval: 1 }; }, status: async () => ({ status: "approved", interval: 1 }), exchange: async () => ({ credential: "sk-cli-never-log", credential_id: "key", key_prefix: "sk-cli-ab", client: "auto", scope: ["mcp:invoke"], mcp_url: "https://example/v1/mcp", created_at: "now", cleanup_token: "cleanup-token", cleanup_expires_at: "later" }), cancel: async () => {}, cleanup: async () => {} } as unknown as AuthorizationApi;
  let mcpShow = 0; const openClawRunner = async (args: readonly string[]) => {
    if (args[0] === "skills" && args[1] === "info") return { code: 0, stdout: openClawReadback(), stderr: "" };
    if (args[0] === "mcp" && args[1] === "show") { mcpShow++; return mcpShow === 1 ? { code: 1, stdout: "", stderr: "" } : { code: 0, stdout: JSON.stringify({ command: "node", args: [bridge, "--client", "openclaw"], env: { SANDBASE_CLI_MANAGED: "1" } }), stderr: "" }; }
    return { code: 0, stdout: "", stderr: "" };
  };
  try { await packagedModule.connect("auto", { api, store: new FileCredentialStore(sandboxHome), open: async () => {}, log: () => {}, detect: client => ({ installed: client === "codex" || client === "openclaw", detail: "fixture" }), openClawRunner }); }
  finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
  assert.equal(creates, 1);
});

function openClawReadback(): string { return JSON.stringify({ name: "sandbase", source: "workspace", homepage: "https://clawhub.ai/joeliu926/skills/sandbase" }); }

test("adapter failure restores a pre-existing bridge instead of leaving a partial upgrade", async()=>{
  const packagedModule=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js");
  const packagedConnect=packagedModule.connect;
  const root=await mkdtemp(join(tmpdir(),"sandbase-connect-rollback-")); const sandboxHome=join(root,"sandbase"); const userHome=join(root,"home"); const bridge=join(sandboxHome,"bin","sandbase-mcp-bridge.mjs"); await mkdir(join(sandboxHome,"bin"),{recursive:true}); await writeFile(bridge,"// previous known-good bridge\n");
  // A directory at the Codex config path forces adapter read/configuration to fail
  // after the credential and bridge stages have already run.
  await mkdir(join(userHome,".codex","config.toml"),{recursive:true});
  const before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,CODEX_HOME:process.env.CODEX_HOME}; process.env.HOME=userHome; process.env.SANDBASE_HOME=sandboxHome; process.env.CODEX_HOME=join(userHome,".codex");
  let cleanup=0; const api={ create:async()=>({authorization_id:"cla_x",status:"pending",verification_uri_complete:"https://example/auth",expires_at:"later",interval:1}), status:async()=>({status:"approved",interval:1}), exchange:async()=>({credential:"sk-cli-test",credential_id:"key",key_prefix:"sk-cli-ab",client:"codex",scope:["mcp:invoke"],mcp_url:"https://example/v1/mcp",created_at:"now",cleanup_token:"cln-test",cleanup_expires_at:"later"}), cancel:async()=>{}, cleanup:async()=>{cleanup++} } as unknown as AuthorizationApi;
  const deps={api,store:new FileCredentialStore(sandboxHome),open:async()=>{},log:()=>{},detect:()=>({installed:true,detail:"test"})} as unknown as Parameters<typeof packagedConnect>[1];
  try { await assert.rejects(packagedConnect("codex",deps)); }
  finally { for(const [key,value] of Object.entries(before)){ if(value===undefined) delete process.env[key]; else process.env[key]=value; } }
  assert.equal(cleanup,1); assert.equal(await readFile(bridge,"utf8"),"// previous known-good bridge\n");
  assert.equal((await stat(bridge)).mode&0o777,0o600);
});

test("adapter failure deletes a bridge created by the failed connect", async()=>{
  const packagedModule=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js"); const root=await mkdtemp(join(tmpdir(),"sandbase-connect-new-")); const sandboxHome=join(root,"sandbase"); const userHome=join(root,"home"); const bridge=join(sandboxHome,"bin","sandbase-mcp-bridge.mjs"); await mkdir(join(userHome,".codex","config.toml"),{recursive:true}); const before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,CODEX_HOME:process.env.CODEX_HOME}; process.env.HOME=userHome; process.env.SANDBASE_HOME=sandboxHome; process.env.CODEX_HOME=join(userHome,".codex"); let cleanup=0; const api={create:async()=>({authorization_id:"cla_x",status:"pending",verification_uri_complete:"https://example/auth",expires_at:"later",interval:1}),status:async()=>({status:"approved",interval:1}),exchange:async()=>({credential:"sk-cli-test",credential_id:"key",key_prefix:"sk-cli-ab",client:"codex",scope:["mcp:invoke"],mcp_url:"https://example/v1/mcp",created_at:"now",cleanup_token:"cln-test",cleanup_expires_at:"later"}),cancel:async()=>{},cleanup:async()=>{cleanup++}} as unknown as AuthorizationApi; const deps={api,store:new FileCredentialStore(sandboxHome),open:async()=>{},log:()=>{},detect:()=>({installed:true,detail:"test"})} as unknown as Parameters<typeof packagedModule.connect>[1]; try{await assert.rejects(packagedModule.connect("codex",deps));}finally{for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}} assert.equal(cleanup,1); await assert.rejects(readFile(bridge,"utf8"),/ENOENT/);
});

test("default auto mode authorizes once and reuses one credential for every successful target", async()=>{
  const packagedModule=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js");
  const root=await mkdtemp(join(tmpdir(),"sandbase-connect-auto-")); const sandboxHome=join(root,"sandbase"); const userHome=join(root,"home"); const before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,CODEX_HOME:process.env.CODEX_HOME}; process.env.HOME=userHome; process.env.SANDBASE_HOME=sandboxHome; process.env.CODEX_HOME=join(userHome,".codex");
  const creates:unknown[][]=[]; let cleanup=0; const api={create:async(...args:unknown[])=>{creates.push(args);return {authorization_id:"cla_x",status:"pending",verification_uri_complete:"https://example/auth",expires_at:"later",interval:1};},status:async()=>({status:"approved",interval:1}),exchange:async()=>({credential:"sk-cli-test",credential_id:"key",key_prefix:"sk-cli-ab",client:"auto",scope:["mcp:invoke"],mcp_url:"https://example/v1/mcp",created_at:"now",cleanup_token:"cln-test",cleanup_expires_at:"later"}),cancel:async()=>{},cleanup:async()=>{cleanup++;}} as unknown as AuthorizationApi;
  const store=new FileCredentialStore(sandboxHome); const logs:string[]=[];
  try { await packagedModule.connect("auto",{api,store,open:async()=>{},log:s=>logs.push(s),detect:client=>({installed:client==="codex"||client==="cursor",detail:"test"})}); }
  finally { for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;} }
  assert.equal(creates.length,1); assert.deepEqual(creates[0]?.slice(0,1),["auto"]); assert.equal(creates[0]?.[2], undefined); assert.equal((await store.get("codex"))?.credential,(await store.get("cursor"))?.credential); assert.equal(cleanup,0); assert.match(logs.join("\n"),/Configured clients: codex, cursor/); assert.ok(!logs.join(" ").includes("sk-cli-test"));
});

test("default auto mode keeps successful clients when one target rolls back", async()=>{
  const packagedModule=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js");
  const root=await mkdtemp(join(tmpdir(),"sandbase-connect-partial-")); const sandboxHome=join(root,"sandbase"); const userHome=join(root,"home"); await mkdir(join(userHome,".cursor","mcp.json"),{recursive:true}); const before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,CODEX_HOME:process.env.CODEX_HOME}; process.env.HOME=userHome; process.env.SANDBASE_HOME=sandboxHome; process.env.CODEX_HOME=join(userHome,".codex");
  let cleanup=0; const api={create:async()=>({authorization_id:"cla_x",status:"pending",verification_uri_complete:"https://example/auth",expires_at:"later",interval:1}),status:async()=>({status:"approved",interval:1}),exchange:async()=>({credential:"sk-cli-test",credential_id:"key",key_prefix:"sk-cli-ab",client:"auto",scope:["mcp:invoke"],mcp_url:"https://example/v1/mcp",created_at:"now",cleanup_token:"cln-test",cleanup_expires_at:"later"}),cancel:async()=>{},cleanup:async()=>{cleanup++;}} as unknown as AuthorizationApi;
  const store=new FileCredentialStore(sandboxHome); const logs:string[]=[];
  try { await packagedModule.connect("auto",{api,store,open:async()=>{},log:s=>logs.push(s),detect:client=>({installed:client==="codex"||client==="cursor",detail:"test"})}); }
  finally { for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;} }
  assert.ok(await store.get("codex")); assert.equal(await store.get("cursor"),undefined); assert.equal(cleanup,0); assert.match(logs.join("\n"),/Partial success: failed clients were rolled back: cursor/);
});

test("shared Cursor and Kiro slots reject the second product before authorization",async()=>{for(const [owner,target] of [["cursor","cursor-cli"],["kiro","kiro-cli"]] as const){const root=await mkdtemp(join(tmpdir(),`sandbase-shared-${owner}-`)),home=join(root,"home"),sandbox=join(root,"sandbase"),config=owner==="cursor"?join(home,".cursor","mcp.json"):join(home,".kiro","settings","mcp.json"),bridge=join(sandbox,"bin","sandbase-mcp-bridge.mjs"),before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,PWD:process.env.PWD};await mkdir(dirname(config),{recursive:true});await writeFile(config,JSON.stringify({mcpServers:{sandbase:{command:"node",args:[bridge,"--client",owner]}}}));process.env.HOME=home;process.env.SANDBASE_HOME=sandbox;process.env.PWD=root;let creates=0;try{await assert.rejects(connect(target,{api:{create:async()=>{creates++;throw new Error("must not authorize")}} as never,detect:()=>({installed:true,detail:"fixture"})}),new RegExp(`shares one SandBase configuration slot with ${owner}`));assert.equal(creates,0);}finally{for(const[key,value]of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}}});

test("shared Cursor CLI and Kiro CLI command owners reject IDE takeover before authorization",async()=>{for(const [owner,target] of [["cursor-cli","cursor"],["kiro-cli","kiro"]] as const){const root=await mkdtemp(join(tmpdir(),`sandbase-shared-reverse-${owner}-`)),home=join(root,"home"),sandbox=join(root,"sandbase"),config=owner==="cursor-cli"?join(home,".cursor","mcp.json"):join(home,".kiro","settings","mcp.json"),bridge=join(sandbox,"bin","sandbase-mcp-bridge.mjs"),before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,PWD:process.env.PWD};await mkdir(dirname(config),{recursive:true});await writeFile(config,JSON.stringify({mcpServers:{sandbase:{command:`node ${JSON.stringify(bridge)} --client ${owner}`}}}));process.env.HOME=home;process.env.SANDBASE_HOME=sandbox;process.env.PWD=root;let creates=0;try{await assert.rejects(connect(target,{api:{create:async()=>{creates++;throw new Error("must not authorize")}} as never,detect:()=>({installed:true,detail:"fixture"})}),new RegExp(`shares one SandBase configuration slot with ${owner}`));assert.equal(creates,0);}finally{for(const[key,value]of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}}});

test("default auto mode cleans up the new credential when every target fails", async()=>{
  const packagedModule=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js");
  const root=await mkdtemp(join(tmpdir(),"sandbase-connect-all-fail-")); const sandboxHome=join(root,"sandbase"); const userHome=join(root,"home"); await mkdir(join(userHome,".codex","config.toml"),{recursive:true}); await mkdir(join(userHome,".cursor","mcp.json"),{recursive:true}); const before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,CODEX_HOME:process.env.CODEX_HOME}; process.env.HOME=userHome; process.env.SANDBASE_HOME=sandboxHome; process.env.CODEX_HOME=join(userHome,".codex");
  let cleanup=0; const api={create:async()=>({authorization_id:"cla_x",status:"pending",verification_uri_complete:"https://example/auth",expires_at:"later",interval:1}),status:async()=>({status:"approved",interval:1}),exchange:async()=>({credential:"sk-cli-test",credential_id:"key",key_prefix:"sk-cli-ab",client:"auto",scope:["mcp:invoke"],mcp_url:"https://example/v1/mcp",created_at:"now",cleanup_token:"cln-test",cleanup_expires_at:"later"}),cancel:async()=>{},cleanup:async()=>{cleanup++;}} as unknown as AuthorizationApi;
  const store=new FileCredentialStore(sandboxHome); const logs:string[]=[];
  try { await assert.rejects(packagedModule.connect("auto",{api,store,open:async()=>{},log:s=>logs.push(s),detect:client=>({installed:client==="codex"||client==="cursor",detail:"test"})}),/No clients were configured successfully/); }
  finally { for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;} }
  assert.equal(cleanup,1); assert.equal(await store.get("codex"),undefined); assert.equal(await store.get("cursor"),undefined); assert.ok(!logs.join(" ").includes("sk-cli-test"));
});

test("Cursor native Skill probe failure leaves the local MCP configuration and credential intact", async()=>{
  const packagedModule=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js");
  const root=await mkdtemp(join(tmpdir(),"sandbase-skill-failure-")); const sandboxHome=join(root,"sandbase"); const userHome=join(root,"home"); const cursorHome=join(userHome,".cursor"); const skill=join(cursorHome,"skills","sandbase","SKILL.md"); await mkdir(join(cursorHome,"skills","sandbase"),{recursive:true}); await writeFile(skill,"# User-owned SandBase instructions\n");
  const before={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,CODEX_HOME:process.env.CODEX_HOME}; process.env.HOME=userHome; process.env.SANDBASE_HOME=sandboxHome;
  let cleanup=0; const logs:string[]=[]; const api={create:async()=>({authorization_id:"cla_x",status:"pending",verification_uri_complete:"https://example/auth",expires_at:"later",interval:1}),status:async()=>({status:"approved",interval:1}),exchange:async()=>({credential:"sk-cli-test",credential_id:"key",key_prefix:"sk-cli-ab",client:"cursor",scope:["mcp:invoke"],mcp_url:"https://example/v1/mcp",created_at:"now",cleanup_token:"cln-test",cleanup_expires_at:"later"}),cancel:async()=>{},cleanup:async()=>{cleanup++;}} as unknown as AuthorizationApi;
  const store=new FileCredentialStore(sandboxHome);
  try { await packagedModule.connect("cursor",{api,store,open:async()=>{},log:s=>logs.push(s),detect:()=>({installed:true,detail:"test"})}); }
  finally { for(const [key,value] of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;} }
  assert.ok(await store.get("cursor")); assert.equal(cleanup,0); assert.match(await readFile(join(cursorHome,"mcp.json"),"utf8"),/sandbase/); assert.equal(await readFile(skill,"utf8"),"# User-owned SandBase instructions\n"); assert.match(logs.join("\n"),/cursor: status=failed, mcp=local_configured, skill=failed/);
});
