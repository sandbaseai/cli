import { rm } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite, readOptional } from "./fs-safe.js";
import { sandbaseHome } from "./paths.js";
import type { Client } from "./types.js";

export type DesktopClient = Extract<Client, "claude-desktop" | "cowork">;
export const desktopClients: readonly DesktopClient[] = ["claude-desktop", "cowork"];
const owner = "sandbase-cli/desktop-bridge";

export interface DesktopBridgeIdentity { schemaVersion: 1; owner: typeof owner; client: DesktopClient; launcher: "sandbase-mcp-bridge.mjs"; mcpArtifact: "mcp-config"; skillArtifact: "skill"; }
export function isDesktopClient(client: Client): client is DesktopClient { return desktopClients.includes(client as DesktopClient); }
export function desktopIdentityPath(client: DesktopClient, home = sandbaseHome()): string { return join(home, "desktop", `${client}.json`); }
export function expectedDesktopIdentity(client: DesktopClient): DesktopBridgeIdentity { return { schemaVersion: 1, owner, client, launcher: "sandbase-mcp-bridge.mjs", mcpArtifact: "mcp-config", skillArtifact: "skill" }; }
export async function readDesktopIdentity(client: DesktopClient, home = sandbaseHome()): Promise<"ready" | "missing" | "invalid"> { const raw = await readOptional(desktopIdentityPath(client, home)); if (!raw) return "missing"; try { return JSON.stringify(JSON.parse(raw)) === JSON.stringify(expectedDesktopIdentity(client)) ? "ready" : "invalid"; } catch { return "invalid"; } }
export async function writeDesktopIdentity(client: DesktopClient, home = sandbaseHome()): Promise<{ path: string; previous?: string; changed: boolean }> { const path = desktopIdentityPath(client, home); const previous = await readOptional(path); if (previous && await readDesktopIdentity(client, home) === "invalid") throw new Error(`${client} SandBase artifact identity is unrecognized; no changes were made`); const next = JSON.stringify(expectedDesktopIdentity(client), null, 2) + "\n"; if (previous === next) return { path, previous, changed: false }; await atomicWrite(path, next, 0o600); return { path, ...(previous === undefined ? {} : { previous }), changed: true }; }
export async function rollbackDesktopIdentity(result: { path: string; previous?: string; changed: boolean }): Promise<void> { if (!result.changed) return; if (result.previous === undefined) await rm(result.path, { force: true }); else await atomicWrite(result.path, result.previous, 0o600); }
export async function removeDesktopIdentity(client: DesktopClient, home = sandbaseHome()): Promise<boolean> { const state = await readDesktopIdentity(client, home); if (state === "missing") return false; if (state === "invalid") throw new Error(`${client} SandBase artifact identity is unrecognized; no changes were made`); await rm(desktopIdentityPath(client, home)); return true; }
