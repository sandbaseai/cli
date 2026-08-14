import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configure, detectClient, isConfigured, rollback, unregister } from "../src/adapters/index.js";
import { backup, restore } from "../src/fs-safe.js";
import { pathToFileURL } from "node:url";
import { FileCredentialStore } from "../src/credentials/store.js";
import type { Client } from "../src/types.js";

for (const client of ["codex","claude-code","cursor","hermes"] as Client[]) test(`${client} adapter preserves complex config and is idempotent`, async () => {
  const home=await mkdtemp(join(tmpdir(),"sandbase-adapter-")); const env={HOME:home,CODEX_HOME:join(home,".codex"),HERMES_HOME:join(home,".hermes")};
  const path = client === "codex" ? join(env.CODEX_HOME,"config.toml") : client === "claude-code" ? join(home,".claude.json") : client === "cursor" ? join(home,".cursor","mcp.json") : join(env.HERMES_HOME,"config.yaml");
  await mkdir(join(path,".."),{recursive:true}); const original = client === "codex" ? 'model = "gpt"\n[mcp_servers.other]\ncommand="x"\n' : client === "hermes" ? 'model: test\nother:\n  nested: true\n' : JSON.stringify({theme:"dark",mcpServers:{other:{command:"x",args:["a b"]}}},null,2)+"\n";
  await writeFile(path,original); const one=await configure(client,"/sandbase-mcp-bridge.mjs",env); const first=await readFile(path,"utf8"); const two=await configure(client,"/sandbase-mcp-bridge.mjs",env); assert.equal(two.changed,false); assert.equal(await readFile(path,"utf8"),first); assert.equal(await isConfigured(client,env),true); assert.ok(first.includes("other") || first.includes("model")); assert.equal(first.includes("credential"),false);
  assert.equal(await unregister(client,env),true); const removed=await readFile(path,"utf8"); assert.ok(!removed.includes("safe bridge")); assert.ok(removed.includes("other") || removed.includes("model")); await rollback(one); assert.equal(await readFile(path,"utf8"),original);
});

test("Codex and Hermes leave a pre-existing unowned sandbase entry untouched",async()=>{ for(const client of ["codex","hermes"] as Client[]){ const home=await mkdtemp(join(tmpdir(),"sandbase-existing-")); const env={HOME:home,CODEX_HOME:join(home,".codex"),HERMES_HOME:join(home,".hermes")}; const path=client==="codex"?join(env.CODEX_HOME,"config.toml"):join(env.HERMES_HOME,"config.yaml"); const original=client==="codex"?'[mcp_servers.sandbase]\ncommand="old"\n[mcp_servers.other]\ncommand="keep"\n':'mcp_servers:\n  sandbase:\n    command: old\n  other:\n    command: keep\n'; await mkdir(join(path,".."),{recursive:true}); await writeFile(path,original); await assert.rejects(configure(client,"/new",env),/invalid/); assert.equal(await readFile(path,"utf8"),original); }});

test("Claude Code and Cursor leave a pre-existing unowned sandbase key untouched",async()=>{ for(const client of ["claude-code","cursor"] as Client[]){ const home=await mkdtemp(join(tmpdir(),"sandbase-json-existing-")); const path=client==="claude-code"?join(home,".claude.json"):join(home,".cursor","mcp.json"); const original=JSON.stringify({theme:"keep",mcpServers:{sandbase:{command:"old"},other:{command:"keep"}}},null,2); await mkdir(join(path,".."),{recursive:true}); await writeFile(path,original); await assert.rejects(configure(client,"/new bridge",{HOME:home}),/invalid/); assert.equal(await readFile(path,"utf8"),original); }});

test("invalid JSON is rejected before backup or mutation", async()=>{ const home=await mkdtemp(join(tmpdir(),"sandbase-invalid-")); await mkdir(join(home,".cursor")); const path=join(home,".cursor","mcp.json"); await writeFile(path,"{broken"); await assert.rejects(configure("cursor","/bridge",{HOME:home}),/invalid/); assert.equal(await readFile(path,"utf8"),"{broken"); });

for (const client of ["codex","hermes"] as Client[]) test(`invalid ${client} text configuration is rejected before backup or mutation`, async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-invalid-text-")); const env={HOME:home,CODEX_HOME:join(home,".codex"),HERMES_HOME:join(home,".hermes")}; const path=client==="codex"?join(env.CODEX_HOME,"config.toml"):join(env.HERMES_HOME,"config.yaml"); await mkdir(join(path,".."),{recursive:true}); const invalid=client==="codex"?'[[unterminated\nkey = "value"\n':'mcp_servers:\n\tbad: tab-indentation\n'; await writeFile(path,invalid);
  await assert.rejects(configure(client,"/bridge",env),/invalid/);
  assert.equal(await readFile(path,"utf8"),invalid);
  assert.ok(!(await readdir(join(path,".."))).some(name=>name.includes("sandbase-backup")));
  await assert.rejects(unregister(client,env),/invalid/);
  assert.equal(await readFile(path,"utf8"),invalid);
});

test("duplicate TOML/YAML keys and excessive YAML aliases fail closed",async()=>{ const fixtures:[Client,string][]=[["codex",'key = "one"\nkey = "two"\n'],["hermes",'key: one\nkey: two\n'],["hermes",`base: &base [value]\nrefs: [${Array.from({length:51},()=>"*base").join(", ")}]\n`]]; for(const [client,invalid] of fixtures){const home=await mkdtemp(join(tmpdir(),"sandbase-duplicate-"));const env={HOME:home,CODEX_HOME:join(home,".codex"),HERMES_HOME:join(home,".hermes")};const path=client==="codex"?join(env.CODEX_HOME,"config.toml"):join(env.HERMES_HOME,"config.yaml");await mkdir(join(path,".."),{recursive:true});await writeFile(path,invalid);await assert.rejects(configure(client,"/bridge",env),/invalid/);await assert.rejects(unregister(client,env),/invalid/);assert.equal(await readFile(path,"utf8"),invalid);assert.ok(!(await readdir(join(path,".."))).some(name=>name.includes("sandbase-backup")));}});

test("real TOML/YAML parsers accept complex valid syntax before preserving it",async()=>{ const fixtures:[Client,string][]=[["codex",'title = "complex"\nvalues = [\n  "one",\n  "two",\n]\n[\"quoted.table\"]\nkey = { nested = true, count = 2 }\n'],["hermes",'defaults: &defaults\n  enabled: true\nflow: { one: 1, two: [a, b] }\ncopy:\n  <<: *defaults\n']]; for(const [client,original] of fixtures){const home=await mkdtemp(join(tmpdir(),"sandbase-parser-"));const env={HOME:home,CODEX_HOME:join(home,".codex"),HERMES_HOME:join(home,".hermes")};const path=client==="codex"?join(env.CODEX_HOME,"config.toml"):join(env.HERMES_HOME,"config.yaml");await mkdir(join(path,".."),{recursive:true});await writeFile(path,original);await configure(client,"/bridge",env);const result=await readFile(path,"utf8");assert.ok(result.includes(client==="codex"?'"quoted.table"':'&defaults'));assert.ok(result.includes("sandbase"));}});

test("adapter atomic write failure restores the exact original file",async()=>{const home=await mkdtemp(join(tmpdir(),"sandbase-write-fail-"));const path=join(home,".cursor","mcp.json");await mkdir(join(path,".."),{recursive:true});const original=JSON.stringify({mcpServers:{peer:{command:"keep"}}},null,2)+"\n";await writeFile(path,original);await assert.rejects(configure("cursor","/bridge",{HOME:home},{backup,write:async()=>{throw new Error("simulated write failure")},restore}),/simulated write failure/);assert.equal(await readFile(path,"utf8"),original);});

test("bridge install is mode 0600 and rollback deletes a newly created bridge",async()=>{const packaged=await import(pathToFileURL(join(process.cwd(),"dist","adapters","index.js")).href) as typeof import("../src/adapters/index.js");const home=await mkdtemp(join(tmpdir(),"sandbase-bridge-"));const result=await packaged.installBridge(home);assert.equal((await stat(result.path)).mode&0o777,0o600);await packaged.rollbackBridge(result);await assert.rejects(readFile(result.path,"utf8"),/ENOENT/);});

test("credential store writes mode 0600, preserves peers and removes one client", async()=>{ const home=await mkdtemp(join(tmpdir(),"sandbase-store-")); const store=new FileCredentialStore(home); const base={credential:"secret",credentialId:"key",keyPrefix:"sk-cli-ab",scope:["mcp:invoke"],mcpUrl:"https://example/v1/mcp",createdAt:"now"}; await store.save({...base,client:"codex"}); await store.save({...base,credential:"other",client:"cursor"}); assert.equal((await stat(store.path)).mode & 0o777,0o600); assert.equal((await store.get("codex"))?.credential,"secret"); await store.remove("codex"); assert.equal(await store.get("codex"),undefined); assert.equal((await store.get("cursor"))?.credential,"other"); });

test("credential store serializes concurrent client updates without lost records",async()=>{const home=await mkdtemp(join(tmpdir(),"sandbase-store-concurrent-")),one=new FileCredentialStore(home),two=new FileCredentialStore(home),base={credential:"secret",credentialId:"key",keyPrefix:"sk-cli-ab",scope:["mcp:invoke"],mcpUrl:"https://example/v1/mcp",createdAt:"now"};await Promise.all([one.save({...base,client:"codex"}),two.save({...base,credential:"other",client:"cursor"})]);assert.equal((await one.get("codex"))?.credential,"secret");assert.equal((await two.get("cursor"))?.credential,"other");await Promise.all([one.remove("codex"),two.save({...base,credential:"third",client:"hermes"})]);assert.equal(await one.get("codex"),undefined);assert.equal((await one.get("cursor"))?.credential,"other");assert.equal((await one.get("hermes"))?.credential,"third");});

test("Codex falls back to an existing config when its CLI probe fails, without relaxing other CLIs", async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-codex-detect-")); const codexHome=join(home,".codex"); const cursorHome=join(home,".cursor"); await mkdir(cursorHome,{recursive:true}); await writeFile(join(cursorHome,"mcp.json"),'{}\n');
  const previous={HOME:process.env.HOME,CODEX_HOME:process.env.CODEX_HOME,PATH:process.env.PATH}; process.env.HOME=home; process.env.CODEX_HOME=codexHome; process.env.PATH="";
  try { assert.equal(detectClient("codex").installed,false); await mkdir(codexHome,{recursive:true}); await writeFile(join(codexHome,"config.toml"),'model = "gpt"\n'); assert.equal(detectClient("codex").installed,true); assert.match(detectClient("codex").detail,/CLI probe failed/); assert.equal(detectClient("cursor").installed,false); const result=await configure("codex","/sandbase-mcp-bridge.mjs",{HOME:home,CODEX_HOME:codexHome}); assert.equal(result.changed,true); assert.equal(await isConfigured("codex",{HOME:home,CODEX_HOME:codexHome}),true); }
  finally { for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;} }
});

test("Gemini detection requires user scope only for persistent add/remove", async () => {
  const root = await mkdtemp(join(tmpdir(), "sandbase-gemini-detect-"));
  const executable = join(root, "gemini");
  await writeFile(executable, `#!/bin/sh
case "$*" in
  "--version") echo "gemini 1.0" ;;
  "mcp add --help"|"mcp remove --help") echo "--scope user" ;;
  "mcp list --help") echo "list configured MCP servers" ;;
  *) exit 1 ;;
esac
`);
  await chmod(executable, 0o700);
  const previous = process.env.PATH;
  process.env.PATH = root;
  try { assert.deepEqual(detectClient("gemini-cli"), { installed: true, detail: "gemini persistent MCP capability detected" }); }
  finally { if (previous === undefined) delete process.env.PATH; else process.env.PATH = previous; }
});

test("module C detection requires exact persistent capabilities and preserves iFlow legacy boundary", async () => {
  const root=await mkdtemp(join(tmpdir(),"sandbase-c-detect-"));
  for(const executable of ["amp","crush","iflow"]){const path=join(root,executable);await writeFile(path,`#!/bin/sh
case "$*" in
  "--version") echo "${executable} 1.0" ;;
  "mcp add --help"|"mcp doctor --help") echo "supported" ;;
  "mcp add-json --help") echo "--scope user" ;;
  "mcp get --help"|"mcp list --help"|"mcp remove --help") echo "supported" ;;
  *) exit 1 ;;
esac
`);await chmod(path,0o700);}
  const previous=process.env.PATH;process.env.PATH=root;
  try{assert.equal(detectClient("amp").installed,true);assert.equal(detectClient("crush").installed,true);const legacy=detectClient("iflow-cli");assert.equal(legacy.installed,Number(process.versions.node.split(".")[0])>=22);assert.match(legacy.detail,/legacy.*ended 2026-04-17/);}
  finally{if(previous===undefined)delete process.env.PATH;else process.env.PATH=previous;}
});

test("Codex refuses altered managed blocks during validation and unregister", async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-codex-owned-")); const env={HOME:home,CODEX_HOME:join(home,".codex")}; const path=join(env.CODEX_HOME,"config.toml"); await mkdir(env.CODEX_HOME,{recursive:true});
  const altered='# >>> sandbase managed >>>\n[mcp_servers.sandbase]\ncommand = "node"\nargs = ["unexpected", "--client", "codex"]\nenv = { SANDBASE_CLI_MANAGED = "1" }\n# <<< sandbase managed <<<\n'; await writeFile(path,altered);
  assert.equal(await isConfigured("codex",env),false); assert.equal(await unregister("codex",env),false); assert.equal(await readFile(path,"utf8"),altered); await assert.rejects(configure("codex","/bridge",env),/invalid/);
});
