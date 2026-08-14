import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AuthorizationApi } from "../src/auth/api.js";
import { connect, doctor, unregister } from "../src/commands.js";
import { FileCredentialStore } from "../src/credentials/store.js";
import type { ConnectClient } from "../src/types.js";

function approvedApi(calls: string[]): AuthorizationApi {
  return {
    create: async (client: ConnectClient) => { calls.push(client); return { authorization_id: "cla_chatgpt", status: "pending", verification_uri_complete: "https://example.test/authorize", expires_at: "later", interval: 1 }; },
    status: async () => ({ status: "approved", interval: 1 }),
    exchange: async () => ({ credential: "fixture-chatgpt-secret", credential_id: "key-chatgpt", key_prefix: "fixture-prefix", client: "chatgpt", scope: ["mcp:invoke"], mcp_url: "https://example.test/v1/mcp", created_at: "now", cleanup_token: "fixture-cleanup", cleanup_expires_at: "later" }),
    cancel: async () => {}, cleanup: async () => {},
  } as unknown as AuthorizationApi;
}

test("ChatGPT explicit connect authorizes and prepares only SandBase-owned local state", async () => {
  const home = await mkdtemp(join(tmpdir(), "sandbase-chatgpt-")); const previous = process.env.SANDBASE_HOME; process.env.SANDBASE_HOME = home;
  const store = new FileCredentialStore(home); const calls: string[] = []; const output: string[] = [];
  try {
    await connect("chatgpt", { api: approvedApi(calls), store, open: async () => {}, log: line => output.push(line), detect: () => { throw new Error("ChatGPT explicit flow must not use local detection"); } });
    assert.deepEqual(calls, ["chatgpt"]); assert.equal((await store.get("chatgpt"))?.client, "chatgpt");
    const text=output.join("\n"); assert.match(text, /status=action_required.*authorization=completed.*credential=stored.*bridge=ready/); assert.match(text, /Developer Mode.*Apps.*Create.*Scan Tools.*administrator.*publish.*safe SandBase tool call/); assert.match(text, /did not write or change any ChatGPT configuration/); assert.doesNotMatch(text, /status=(?:connected|verified)|fixture-chatgpt-secret|fixture-cleanup/i);

    const doctorOutput: string[]=[]; const oldLog=console.log; console.log=line=>void doctorOutput.push(line);
    try { assert.equal(await doctor("chatgpt",store),false); await unregister("chatgpt",store); } finally { console.log=oldLog; }
    assert.match(doctorOutput[0]!,/status=action_required.*authorization=completed.*credential=present.*bridge=ready.*chatgpt_app=not_observable.*verification=not_verified/);
    assert.match(doctorOutput[1]!,/status=removed.*bridge=retained.*third_party_config=preserved/); assert.equal(await store.get("chatgpt"),undefined);
  } finally { if(previous===undefined)delete process.env.SANDBASE_HOME;else process.env.SANDBASE_HOME=previous; }
});

test("ChatGPT remains excluded from automatic client selection", async () => {
  const output:string[]=[]; let authorizations=0;
  await connect("auto",{api:{create:async()=>{authorizations++;throw new Error("must not authorize")}} as never,log:line=>output.push(line),detect:client=>({installed:client==="chatgpt",detail:"fixture"}),openClawRunner:async()=>({code:null,stdout:"",stderr:""})});
  assert.equal(authorizations,0); assert.ok(output.some(line=>/^chatgpt: status=confirmation_required.*mcp=not_configured/.test(line)));
});
