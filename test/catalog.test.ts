import test from "node:test";
import assert from "node:assert/strict";
import { clientCatalog, stableCatalog } from "../src/catalog.js";
import { clients } from "../src/types.js";

test("catalog is the stable unique 25-client authority with 17/5/2/1 delivery classes", () => {
  assert.equal(clientCatalog.length, 25);
  assert.equal(new Set(clientCatalog.map(entry => entry.id)).size, 25);
  assert.deepEqual(clients, clientCatalog.map(entry => entry.id));
  assert.deepEqual(Object.fromEntries(["adapter", "prompt", "desktop_import", "remote_workspace"].map(delivery => [delivery, clientCatalog.filter(entry => entry.delivery === delivery).length])), { adapter: 17, prompt: 5, desktop_import: 2, remote_workspace: 1 });
  const chatgpt=clientCatalog.find(entry=>entry.id==="chatgpt")!;
  assert.deepEqual({auto:chatgpt.autoEligible,auth:chatgpt.localAuthorization,install:chatgpt.installScriptEligible},{auto:false,auth:true,install:true});
  assert.deepEqual(JSON.parse(stableCatalog()).clients, clientCatalog);
});
