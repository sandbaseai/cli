// Once-a-day npm version check. The notice is printed to stderr in text mode and
// appended to `notes` in JSON mode, because agents that parse JSON never read
// stderr — and the notice is what tells them to refresh the Skill too.
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWrite } from "../fs-safe.js";
import { sandbaseHome } from "../paths.js";

export const SKILL_URL = "https://www.sandbase.ai/skill.md";
const DAY_MS = 24 * 60 * 60 * 1000;

export function cliVersion(): string {
  for (const relative of ["../../package.json", "../../../package.json"]) {
    try { const value = JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")) as { name?: string; version?: string }; if (value.name === "@sandbaseai/cli" && value.version) return value.version; } catch { /* try the next layout */ }
  }
  return "0.0.0";
}

export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => value.replace(/^v/, "").split("-")[0]!.split(".").map(part => Number.parseInt(part, 10) || 0);
  const left = parse(a), right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) { const diff = (left[i] || 0) - (right[i] || 0); if (diff) return Math.sign(diff); }
  return 0;
}

interface Cache { checkedAt: number; latest?: string }
function cachePath(env: NodeJS.ProcessEnv): string { return join(sandbaseHome(env), "update-check.json"); }
function disabled(env: NodeJS.ProcessEnv): boolean { return env.SANDBASE_NO_UPDATE_CHECK === "1" || env.CI === "true" || env.NODE_ENV === "test"; }

/** Starts (at most daily) a background registry check; resolves to an update notice or undefined. Never throws. */
export async function updateNotice(env = process.env, fetchImpl: typeof fetch = globalThis.fetch, now = Date.now()): Promise<string | undefined> {
  if (disabled(env)) return undefined;
  const current = cliVersion();
  let cache: Cache | undefined;
  try { cache = JSON.parse(await readFile(cachePath(env), "utf8")) as Cache; } catch { /* first run */ }
  let latest = cache?.latest;
  if (!cache || now - cache.checkedAt > DAY_MS) {
    try {
      const response = await fetchImpl("https://registry.npmjs.org/@sandbaseai/cli/latest", { signal: AbortSignal.timeout(2000) });
      if (response.ok) { const value = await response.json() as { version?: string }; if (typeof value.version === "string") latest = value.version; }
    } catch { /* offline: keep the cached answer */ }
    try { await atomicWrite(cachePath(env), JSON.stringify({ checkedAt: now, ...(latest ? { latest } : {}) }) + "\n", 0o600); } catch { /* read-only home */ }
  }
  if (!latest || compareVersions(latest, current) <= 0) return undefined;
  return `Update available: @sandbaseai/cli ${current} → ${latest}. Run \`npx -y @sandbaseai/cli@latest setup\` (or \`npm install -g @sandbaseai/cli@latest && sandbase setup\`) to update the CLI, the local MCP bridge, and the SandBase Skill. Latest Skill: ${SKILL_URL}`;
}
