#!/usr/bin/env node
import { connect, doctor, unregister } from "./commands.js";
import { clientList } from "./clients.js";
import { bridgeClients, isBridgeClient, isClient, type BridgeClient, type ConnectClient } from "./types.js";
import { stableCatalog } from "./catalog.js";

if (Number(process.versions.node.split(".")[0]) < 20) { console.error("SandBase CLI requires Node.js 20 or newer. Upgrade Node.js and retry."); process.exit(1); }
const [command, ...args] = process.argv.slice(2); const at = args.indexOf("--client"); const value = at >= 0 ? args[at + 1] : undefined;
const client: ConnectClient | undefined = value === undefined || value === "auto" ? "auto" : isClient(value) ? value : undefined;
const bridgeClient: BridgeClient | undefined = value !== undefined && isBridgeClient(value) ? value : undefined;
if (command === "catalog") {
  if (args.length !== 1 || args[0] !== "--json") { console.error("Usage: sandbase catalog --json"); process.exit(2); }
} else if (command === "mcp-bridge") {
  if (!bridgeClient || at !== 0 || args.length !== 2) { console.error(`Usage: sandbase mcp-bridge --client <${bridgeClients.join("|")}>`); process.exit(2); }
} else if (!command || !client || !["connect", "doctor", "unregister"].includes(command) || (at >= 0 && !value)) { console.error(`Usage: sandbase <connect|doctor|unregister> [--client <${clientList()}|auto>]`); process.exit(2); }
const controller = new AbortController(); const signals = ["SIGINT", "SIGTERM"] as const; const abort = () => controller.abort(); for (const signal of signals) process.once(signal, abort);
try {
  if (command === "catalog") process.stdout.write(stableCatalog());
  else if (command === "mcp-bridge") {
    const runtime = await import(new URL("../assets/mcp-bridge.mjs", import.meta.url).href) as { runMCPBridge(options: { client: BridgeClient; signal: AbortSignal }): Promise<void> };
    await runtime.runMCPBridge({ client: bridgeClient!, signal: controller.signal });
  } else if (command === "connect") await connect(client, { signal: controller.signal });
  else if (command === "doctor") { if (!(await doctor(client))) process.exitCode = 1; }
  else await unregister(client);
} catch (e) { const message = e instanceof Error ? e.message : "Unknown failure"; if (message.includes("fetch failed")) console.error("Authorization response may have been lost. Check SandBase Dashboard for a newly created CLI credential, revoke it if present, then retry."); else console.error(message.replace(/(?:sk|cln)-[A-Za-z0-9_-]+/g, "[REDACTED]")); process.exitCode = 1; }
finally { for (const signal of signals) process.removeListener(signal, abort); }
