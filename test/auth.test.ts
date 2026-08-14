import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationApi, ApiError, createSecrets } from "../src/auth/api.js";
import { authorize } from "../src/auth/flow.js";

test("secrets are independent high-entropy PKCE S256 values", () => {
  const a = createSecrets(), b = createSecrets();
  assert.match(a.deviceSecret, /^[A-Za-z0-9_-]{43}$/); assert.match(a.verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.deviceSecret, a.verifier); assert.notEqual(a.deviceChallenge, a.deviceSecret); assert.notEqual(a.requestId, b.requestId);
});

test("authorization polls at server interval, slows down, then exchanges once", async () => {
  const calls: Array<{url:string;init?:RequestInit}> = []; let status = 0;
  const fetcher: typeof fetch = async (input, init) => { const url = String(input); calls.push({url, ...(init ? {init}: {})});
    if (url.endsWith("/authorizations")) return Response.json({ authorization_id:"cla_1", status:"pending", verification_uri_complete:"https://example/cli/authorize?id=cla_1", expires_at:"2099-01-01T00:00:00Z", interval:1 }, {status:201});
    if (url.endsWith("/status")) { status++; if (status === 1) return Response.json({error:{code:"slow_down",message:"slow"}}, {status:429}); return Response.json({status: status === 2 ? "pending" : "approved", interval:1}); }
    if (url.endsWith("/token")) return Response.json({credential:"secret",credential_id:"key_1",key_prefix:"sk-cli-ab",client:"codex",scope:["mcp:invoke"],mcp_url:"https://example/v1/mcp",created_at:"now",cleanup_token:"cleanup",cleanup_expires_at:"later"});
    return new Response(null,{status:204}); };
  const delays:number[]=[]; const opened:string[]=[];
  const result = await authorize(new AuthorizationApi("https://api", fetcher), "codex", { open: async u => void opened.push(u), sleep: async ms => void delays.push(ms), log:()=>{} });
  assert.equal(result.exchange.credential, "secret"); assert.deepEqual(delays, [1000,6000,6000]); assert.equal(opened.length,1); assert.equal(calls.filter(c=>c.url.endsWith("/token")).length,1);
  const createBody = JSON.parse(String(calls[0]?.init?.body)); assert.equal(createBody.code_challenge_method,"S256"); assert.ok(!Object.values(createBody).includes(result.exchange.credential));
});

test("abort cancels pending grant and terminal denial never exchanges", async () => {
  let cancelled=0, exchanged=0;
  const fetcher: typeof fetch = async (input) => { const url=String(input); if (url.endsWith("/authorizations")) return Response.json({authorization_id:"cla_2",status:"pending",verification_uri_complete:"https://example/auth",expires_at:"later",interval:1},{status:201}); if (url.endsWith("/status")) return Response.json({status:"denied",interval:1}); if (url.endsWith("/token")) { exchanged++; return Response.json({}); } cancelled++; return new Response(null,{status:204}); };
  await assert.rejects(authorize(new AuthorizationApi("https://api",fetcher),"cursor",{open:async()=>{},sleep:async()=>{},log:()=>{}}),/denied/);
  assert.equal(exchanged,0); assert.equal(cancelled,1);
});

test("API errors expose code without echoing submitted secret", async () => {
  const api = new AuthorizationApi("https://api", async()=>Response.json({error:{code:"cleanup_not_found",message:"not found"}},{status:404}));
  await assert.rejects(api.cleanup("cla_1","top-secret"), (e:unknown) => e instanceof ApiError && e.code === "cleanup_not_found" && !e.message.includes("top-secret"));
});

test("auto authorization sends no local target metadata", async () => {
  const calls: Array<{init?: RequestInit}> = [];
  const api = new AuthorizationApi("https://api", async (_input, init) => { calls.push({ ...(init ? { init } : {}) }); return Response.json({ authorization_id:"cla_3", status:"pending", verification_uri_complete:"https://example/auth", expires_at:"later", interval:1 }, { status: 201 }); });
  await api.create("auto", createSecrets());
  const body = JSON.parse(String(calls[0]?.init?.body));
  assert.equal(body.client, "auto"); assert.equal(body.target_clients, undefined);
  assert.ok(!JSON.stringify(body).includes("HOME"));
});
