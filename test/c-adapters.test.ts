import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "jsonc-parser";
import { ampManagedSettingsPaths, inspectC, installC, restoreCUnregister, snapshotCUnregister, unregisterC, type CClient, type CCommandRunner } from "../src/c-adapters.js";
import { configPath } from "../src/paths.js";
import { unregister as unregisterCommand } from "../src/commands.js";
import { FileCredentialStore } from "../src/credentials/store.js";
import type { AuthorizationApi } from "../src/auth/api.js";

const ok = (stdout="") => ({code:0,stdout,stderr:""});
const bridgeEntry = (client:CClient,bridge:string) => client==="crush"?{type:"stdio",command:"node",args:[bridge,"--client",client]}:{command:"node",args:[bridge,"--client",client]};
async function write(path:string,value:unknown){await mkdir(join(path,".."),{recursive:true});await writeFile(path,JSON.stringify(value,null,2)+"\n");}

test("Amp preserves global JSONC, uses amp.mcpServers and requires doctor readback",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-amp-")),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),PWD:join(home,"workspace")},path=configPath("amp",env),bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs"),calls:string[][]=[];
  await mkdir(join(path,".."),{recursive:true});await writeFile(path,'{\n  // keep\n  "theme": "dark",\n  "amp.mcpServers": {"peer":{"url":"https://peer"}},\n}\n');
  const runner:CCommandRunner=async(_client,args)=>{calls.push([...args]);return args.join(" ")==="mcp doctor"?ok("sandbase healthy"):ok("supported")};
  await installC("amp",bridge,env,runner);const raw=await readFile(path,"utf8"),root=parse(raw) as Record<string,any>;assert.match(raw,/\/\/ keep/);assert.deepEqual(root["amp.mcpServers"].sandbase,bridgeEntry("amp",bridge));assert.ok(root["amp.mcpServers"].peer);assert.equal((await inspectC("amp",env,runner)).state,"configured");await unregisterC("amp",env,async(client,args)=>args.join(" ")==="mcp doctor"?ok(""):runner(client,args));assert.doesNotMatch(await readFile(path,"utf8"),/"sandbase"/);assert.ok(calls.some(args=>args.join(" ")==="mcp doctor"));
});

test("Amp workspace override and explicit permission denial are zero-mutation",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-amp-policy-")),workspace=join(home,"work"),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),PWD:workspace},path=configPath("amp",env),bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs"),runner:CCommandRunner=async()=>ok("supported");
  await write(path,{"amp.mcpServers":{peer:{url:"https://peer"}}});const original=await readFile(path,"utf8");await write(join(workspace,".amp","settings.json"),{"amp.mcpServers":{sandbase:{command:"other"}}});await assert.rejects(installC("amp",bridge,env,runner),/nearest workspace/);assert.equal(await readFile(path,"utf8"),original);
  await writeFile(join(workspace,".amp","settings.json"),'{}\n');await write(path,{"amp.mcpPermissions":{sandbase:"deny"}});const denied=await readFile(path,"utf8");await assert.rejects(installC("amp",bridge,env,runner),/permissions deny/);assert.equal(await readFile(path,"utf8"),denied);
});

test("Amp doctor failure restores the exact JSONC snapshot",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-amp-rollback-")),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),PWD:join(home,"workspace")},path=configPath("amp",env),bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs");
  await mkdir(join(path,".."),{recursive:true});const original='{\n  // exact snapshot\n  "theme": "dark",\n}\n';await writeFile(path,original);
  const runner:CCommandRunner=async(_client,args)=>args.join(" ")==="mcp doctor"?{code:1,stdout:"",stderr:"offline"}:ok("supported");
  await assert.rejects(installC("amp",bridge,env,runner),/readback failed/);
  assert.equal(await readFile(path,"utf8"),original);
});

test("Amp discovers nearest parent workspace and managed settings before global mutation",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-amp-parent-")),repo=join(home,"repo"),cwd=join(repo,"packages","app","src"),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),PWD:cwd},path=configPath("amp",env),managed=join(home,"managed-settings.json"),bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs"),runner:CCommandRunner=async()=>ok("sandbase healthy");await mkdir(join(repo,".git"),{recursive:true});await mkdir(cwd,{recursive:true});await write(path,{"amp.mcpServers":{peer:{url:"https://peer"}}});const original=await readFile(path,"utf8");await write(join(repo,".amp","settings.jsonc"),{"amp.mcpServers":{sandbase:{command:"workspace"}}});await assert.rejects(installC("amp",bridge,env,runner),/nearest workspace/);assert.equal(await readFile(path,"utf8"),original);
  await writeFile(join(repo,".amp","settings.jsonc"),'{}\n');await write(managed,{"amp.mcpServers":{sandbase:{command:"managed"}}});await assert.rejects(installC("amp",bridge,env,runner,{ampManagedPaths:[managed]}),/managed settings override/);assert.equal(await readFile(path,"utf8"),original);await write(managed,{"amp.mcpPermissions":{sandbase:"deny"}});assert.equal((await inspectC("amp",env,runner,{ampManagedPaths:[managed]})).state,"confirmation_required");assert.equal(await readFile(path,"utf8"),original);
  assert.deepEqual(ampManagedSettingsPaths({},"darwin"),["/Library/Application Support/ampcode/managed-settings.json"]);assert.deepEqual(ampManagedSettingsPaths({},"linux"),["/etc/ampcode/managed-settings.json"]);assert.deepEqual(ampManagedSettingsPaths({PROGRAMDATA:"D:\\ProgramData"},"win32"),["D:\\ProgramData\\ampcode\\managed-settings.json"]);
});

test("Crush honors CRUSH_GLOBAL_CONFIG and writes only exact static stdio argv",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-crush-")),custom=join(home,"custom","crush.json"),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),CRUSH_GLOBAL_CONFIG:custom,PWD:join(home,"project")},bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs"),runner:CCommandRunner=async()=>ok("crush 1.0");await write(custom,{mcp:{peer:{type:"http",url:"https://peer"}}});
  await installC("crush",bridge,env,runner);const root=JSON.parse(await readFile(custom,"utf8"));assert.deepEqual(root.mcp.sandbase,bridgeEntry("crush",bridge));assert.doesNotMatch(JSON.stringify(root.mcp.sandbase),/\$\(|\$\{|`/);assert.equal((await inspectC("crush",env,runner)).state,"configured");const snapshot=await snapshotCUnregister("crush",env,runner);await unregisterC("crush",env,runner);assert.equal(JSON.parse(await readFile(custom,"utf8")).mcp.sandbase,undefined);await restoreCUnregister(snapshot!,env,runner);assert.deepEqual(JSON.parse(await readFile(custom,"utf8")).mcp.sandbase,bridgeEntry("crush",bridge));
});

test("Crush project override, malformed JSON and lookalike ownership fail closed",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-crush-safe-")),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),PWD:join(home,"project")},path=configPath("crush",env),bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs"),runner:CCommandRunner=async()=>ok("crush 1.0");await write(path,{mcp:{peer:{type:"http",url:"https://peer"}}});await write(join(env.PWD,".crush.json"),{mcp:{sandbase:bridgeEntry("crush",bridge)}});await assert.rejects(installC("crush",bridge,env,runner),/nearest project/);
  await writeFile(join(env.PWD,".crush.json"),'{}\n');await writeFile(path,"{broken");await assert.rejects(installC("crush",bridge,env,runner),/invalid/);assert.equal(await readFile(path,"utf8"),"{broken");await write(path,{mcp:{sandbase:bridgeEntry("crush","/third-party/sandbase-mcp-bridge.mjs")}});await assert.rejects(installC("crush",bridge,env,runner),/not SandBase-owned/);
});

test("Crush rejects an existing shell-substitution entry without executing or mutating it",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-crush-shell-")),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),PWD:join(home,"project")},path=configPath("crush",env),bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs"),runner:CCommandRunner=async()=>ok("crush 1.0");
  await write(path,{mcp:{sandbase:{type:"stdio",command:"$(touch /tmp/should-never-run)",args:[]}}});const original=await readFile(path,"utf8");
  await assert.rejects(installC("crush",bridge,env,runner),/not SandBase-owned/);
  assert.equal(await readFile(path,"utf8"),original);
});

test("Crush discovers the nearest parent project configuration before global mutation",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-crush-parent-")),repo=join(home,"repo"),cwd=join(repo,"nested","package"),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),PWD:cwd},path=configPath("crush",env),bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs"),runner:CCommandRunner=async()=>ok("crush 1.0");await mkdir(join(repo,".git"),{recursive:true});await mkdir(cwd,{recursive:true});await write(path,{mcp:{peer:{type:"http",url:"https://peer"}}});const original=await readFile(path,"utf8");await write(join(repo,"crush.json"),{mcp:{sandbase:{type:"stdio",command:"other",args:[]}}});await assert.rejects(installC("crush",bridge,env,runner),/nearest project/);assert.equal(await readFile(path,"utf8"),original);
});

function iflowFixture(initial?:unknown){let current=initial;const calls:string[][]=[];const runner:CCommandRunner=async(_client,args)=>{calls.push([...args]);if(args.at(-1)==="--help")return ok(args[1]==="add-json"?"--scope user":"supported");if(args[0]==="--version")return ok("iflow legacy");if(args[1]==="get")return current===undefined?{code:1,stdout:"",stderr:"not found"}:ok(JSON.stringify(current));if(args[1]==="list")return ok(current===undefined?"No servers":"sandbase");if(args[1]==="add-json"){current=JSON.parse(args.at(-1)!);return ok("added")};if(args[1]==="remove"){current=undefined;return ok("removed")};return ok()};return{runner,calls,current:()=>current};}

test("iFlow uses only legacy user-scope add-json/get/list/remove and compensates exactly",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-iflow-")),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),PWD:join(home,"project")},bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs"),fixture=iflowFixture();await installC("iflow-cli",bridge,env,fixture.runner);const add=fixture.calls.find(args=>args[1]==="add-json"&&args.at(-1)!=="--help")!;assert.deepEqual(add.slice(0,5),["mcp","add-json","--scope","user","sandbase"]);assert.deepEqual(JSON.parse(add[5]!),bridgeEntry("iflow-cli",bridge));assert.doesNotMatch(JSON.stringify(fixture.calls),/Bearer|sk-cli/);const inspection=await inspectC("iflow-cli",env,fixture.runner);assert.equal(inspection.state,"configured");assert.match(inspection.detail,/vendor service ended 2026-04-17/);const snapshot=await snapshotCUnregister("iflow-cli",env,fixture.runner);await unregisterC("iflow-cli",env,fixture.runner);assert.equal(fixture.current(),undefined);await restoreCUnregister(snapshot!,env,fixture.runner);assert.deepEqual(fixture.current(),bridgeEntry("iflow-cli",bridge));
});

test("iFlow rejects unowned existing entry and removes a failed partial install",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-iflow-safe-")),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),PWD:join(home,"project")},bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs"),foreign=iflowFixture({command:"node",args:["/third-party/sandbase-mcp-bridge.mjs","--client","iflow-cli"]});await assert.rejects(installC("iflow-cli",bridge,env,foreign.runner),/not SandBase-owned/);assert.ok(!foreign.calls.some(args=>args[1]==="add-json"&&args.at(-1)!=="--help"));
  let current:unknown;const calls:string[][]=[];const failing:CCommandRunner=async(_client,args)=>{calls.push([...args]);if(args.at(-1)==="--help")return ok(args[1]==="add-json"?"--scope":"supported");if(args[0]==="--version")return ok();if(args[1]==="get")return current===undefined?{code:1,stdout:"",stderr:""}:ok(JSON.stringify(current));if(args[1]==="add-json"){current=JSON.parse(args.at(-1)!);return ok()};if(args[1]==="list")return current===undefined?ok("No servers"):{code:1,stdout:"",stderr:"offline"};if(args[1]==="remove"){current=undefined;return ok()};return ok()};await assert.rejects(installC("iflow-cli",bridge,env,failing),error=>error instanceof Error&&/readback/.test(error.message)&&!/compensation was incomplete/.test(error.message));assert.equal(current,undefined);assert.ok(calls.some(args=>args.join(" ")==="mcp remove sandbase"));assert.ok(calls.filter(args=>args.join(" ")==="mcp list").length>=2);
});

test("iFlow reports incomplete compensation when failed readback cannot remove the partial add",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-iflow-compensation-")),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),PWD:join(home,"project")},bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs");let current:unknown;
  const runner:CCommandRunner=async(_client,args)=>{if(args.at(-1)==="--help")return ok(args[1]==="add-json"?"--scope":"supported");if(args[0]==="--version")return ok();if(args[1]==="get")return current===undefined?{code:1,stdout:"",stderr:""}:ok(JSON.stringify(current));if(args[1]==="add-json"){current=JSON.parse(args.at(-1)!);return ok()};if(args[1]==="list")return{code:1,stdout:"",stderr:"offline"};if(args[1]==="remove")return{code:1,stdout:"",stderr:"remove failed"};return ok()};
  await assert.rejects(installC("iflow-cli",bridge,env,runner),/compensation was incomplete/);
  assert.notEqual(current,undefined);
});

test("iFlow incomplete local compensation still lets connect clean credential and bridge",async()=>{
  const packaged=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js"),home=await mkdtemp(join(tmpdir(),"sandbase-iflow-connect-compensation-")),sandbox=join(home,".sandbase"),env={HOME:home,SANDBASE_HOME:sandbox,PWD:join(home,"project")},bridge=join(sandbox,"bin","sandbase-mcp-bridge.mjs"),previous={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,PWD:process.env.PWD};process.env.HOME=env.HOME;process.env.SANDBASE_HOME=env.SANDBASE_HOME;process.env.PWD=env.PWD;let current:unknown,cleanup=0;
  const runner:CCommandRunner=async(_client,args)=>{if(args.at(-1)==="--help")return ok(args[1]==="add-json"?"--scope":"supported");if(args[0]==="--version")return ok();if(args[1]==="get")return current===undefined?{code:1,stdout:"",stderr:""}:ok(JSON.stringify(current));if(args[1]==="add-json"){current=JSON.parse(args.at(-1)!);return ok()};if(args[1]==="list")return{code:1,stdout:"",stderr:"offline"};if(args[1]==="remove")return{code:1,stdout:"",stderr:"remove failed"};return ok()};const api={create:async()=>({authorization_id:"cla_iflow",status:"pending",verification_uri_complete:"https://example.test/authorize",expires_at:"later",interval:1}),status:async()=>({status:"approved",interval:1}),exchange:async()=>({credential:"sk-cli-never-log",credential_id:"key",key_prefix:"sk-cli-ab",client:"iflow-cli",scope:["mcp:invoke"],mcp_url:"https://example.test/v1/mcp",created_at:"now",cleanup_token:"cleanup",cleanup_expires_at:"later"}),cancel:async()=>{},cleanup:async()=>{cleanup++}} as unknown as AuthorizationApi;const store=new FileCredentialStore(sandbox);
  try{await assert.rejects(packaged.connect("iflow-cli",{api,store,open:async()=>{},log:()=>{},detect:()=>({installed:true,detail:"fixture"}),cRunner:runner}),error=>error instanceof Error&&/readback failed.*compensation was incomplete/.test(error.message));assert.equal(await store.get("iflow-cli"),undefined);await assert.rejects(readFile(bridge,"utf8"),/ENOENT/);assert.equal(cleanup,1);assert.notEqual(current,undefined);}
  finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test("module C command unregister restores config and credential after a late store failure",async()=>{
  const home=await mkdtemp(join(tmpdir(),"sandbase-c-command-")),env={HOME:home,SANDBASE_HOME:join(home,".sandbase"),PWD:join(home,"project")},path=configPath("crush",env),bridge=join(env.SANDBASE_HOME,"bin","sandbase-mcp-bridge.mjs"),runner:CCommandRunner=async()=>ok("crush 1.0"),previous={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,PWD:process.env.PWD};process.env.HOME=env.HOME;process.env.SANDBASE_HOME=env.SANDBASE_HOME;process.env.PWD=env.PWD;await write(path,{theme:"dark"});await installC("crush",bridge,process.env,runner);const original=await readFile(path,"utf8"),credential={credential:"test-secret",credentialId:"key",keyPrefix:"sk-cli-ab",client:"crush" as const,scope:["mcp:invoke"],mcpUrl:"https://example.test/v1/mcp",createdAt:"now"},store={get:async()=>credential,save:async()=>undefined,remove:async()=>{throw new Error("credential store unavailable")}};
  try{await assert.rejects(unregisterCommand("crush",store,()=>({installed:true,detail:"fixture"}),undefined,undefined,undefined,undefined,undefined,undefined,runner),/credential store unavailable/);assert.equal(await readFile(path,"utf8"),original);}
  finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test("explicit Crush connect completes the B-063 authorization and C adapter transaction",async()=>{
  const packaged=await import(pathToFileURL(join(process.cwd(),"dist","commands.js")).href) as typeof import("../src/commands.js"),home=await mkdtemp(join(tmpdir(),"sandbase-c-connect-")),sandbox=join(home,".sandbase"),env={HOME:home,SANDBASE_HOME:sandbox,PWD:join(home,"project")},path=configPath("crush",env),secret="sk-cli-module-c-secret",logs:string[]=[],previous={HOME:process.env.HOME,SANDBASE_HOME:process.env.SANDBASE_HOME,PWD:process.env.PWD};process.env.HOME=env.HOME;process.env.SANDBASE_HOME=env.SANDBASE_HOME;process.env.PWD=env.PWD;
  const api={create:async()=>({authorization_id:"cla_c",status:"pending",verification_uri_complete:"https://example.test/authorize",expires_at:"later",interval:1}),status:async()=>({status:"approved",interval:1}),exchange:async()=>({credential:secret,credential_id:"key",key_prefix:"sk-cli-ab",client:"crush",scope:["mcp:invoke"],mcp_url:"https://example.test/v1/mcp",created_at:"now",cleanup_token:"cleanup",cleanup_expires_at:"later"}),cancel:async()=>{},cleanup:async()=>{}} as unknown as AuthorizationApi;
  try{await packaged.connect("crush",{api,store:new FileCredentialStore(sandbox),open:async()=>{},log:line=>logs.push(line),detect:client=>({installed:client==="crush",detail:"fixture"}),cRunner:async()=>ok("crush 1.0")});assert.equal((await inspectC("crush",process.env,async()=>ok("crush 1.0"))).state,"configured");assert.ok(await new FileCredentialStore(sandbox).get("crush"));assert.match(logs.join("\n"),/local configuration is ready/i);assert.doesNotMatch(logs.join("\n"),new RegExp(secret));assert.deepEqual(JSON.parse(await readFile(path,"utf8")).mcp.sandbase.args.slice(1),["--client","crush"]);}
  finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
