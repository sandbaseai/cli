import { chmod, copyFile, mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
export async function readOptional(path: string): Promise<string | undefined> { try { return await readFile(path, "utf8"); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw e; } }
export async function atomicWrite(path: string, data: string, mode = 0o600): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  const fh = await open(tmp, "wx", mode);
  try { await fh.writeFile(data, "utf8"); await fh.sync(); } finally { await fh.close(); }
  await rename(tmp, path); await chmod(path, mode);
}
export async function backup(path: string): Promise<string | undefined> {
  try { await stat(path); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw e; }
  const dest = `${path}.sandbase-backup-${Date.now()}-${randomBytes(3).toString("hex")}`; await copyFile(path, dest); await chmod(dest, 0o600); return dest;
}
export async function restore(path: string, backupPath?: string): Promise<void> { if (backupPath) { await copyFile(backupPath, path); await chmod(path, 0o600); } else await rm(path, { force: true }); }
