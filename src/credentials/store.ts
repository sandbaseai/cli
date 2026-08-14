import { join } from "node:path";
import { atomicWrite, readOptional } from "../fs-safe.js";
import { sandbaseHome } from "../paths.js";
import type { Client, CredentialRecord } from "../types.js";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
export interface CredentialStore { save(record: CredentialRecord): Promise<void>; get(client: Client): Promise<CredentialRecord | undefined>; remove(client: Client): Promise<void>; }
export class FileCredentialStore implements CredentialStore {
  readonly path: string;
  constructor(home = sandbaseHome()) { this.path = join(home, "credentials.json"); }
  private async all(): Promise<Partial<Record<Client, CredentialRecord>>> { const raw = await readOptional(this.path); if (!raw) return {}; const parsed: unknown = JSON.parse(raw); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("SandBase credential store is invalid"); return parsed as Partial<Record<Client, CredentialRecord>>; }
  private async locked<T>(operation: () => Promise<T>): Promise<T> {
    const lock = `${this.path}.lock`; const deadline = Date.now() + 5000;
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    for (;;) {
      try { await mkdir(lock, { mode: 0o700 }); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        try { if (Date.now() - (await stat(lock)).mtimeMs > 30_000) await rm(lock, { recursive: true, force: true }); } catch { /* another process released it */ }
        if (Date.now() >= deadline) throw new Error("SandBase credential store is busy; retry the command.");
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
    try { return await operation(); } finally { await rm(lock, { recursive: true, force: true }); }
  }
  async save(record: CredentialRecord): Promise<void> { await this.locked(async()=>{ const all = await this.all(); all[record.client] = record; await atomicWrite(this.path, JSON.stringify(all, null, 2) + "\n"); }); }
  async get(client: Client): Promise<CredentialRecord | undefined> { return (await this.all())[client]; }
  async remove(client: Client): Promise<void> { await this.locked(async()=>{ const all = await this.all(); delete all[client]; await atomicWrite(this.path, JSON.stringify(all, null, 2) + "\n"); }); }
}
