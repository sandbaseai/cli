import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { ConnectClient, Exchange, Grant } from "../types.js";
const b64 = (b: Buffer) => b.toString("base64url");
export interface Secrets { requestId: string; deviceSecret: string; verifier: string; deviceChallenge: string; codeChallenge: string }
export function createSecrets(): Secrets { const deviceSecret = b64(randomBytes(32)); const verifier = b64(randomBytes(32)); return { requestId: randomUUID(), deviceSecret, verifier, deviceChallenge: b64(createHash("sha256").update(deviceSecret).digest()), codeChallenge: b64(createHash("sha256").update(verifier).digest()) }; }
export class ApiError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }
export class AuthorizationApi {
  constructor(readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch) {}
  private async request<T>(path: string, init: RequestInit): Promise<T> { const res = await this.fetcher(this.baseUrl + path, init); if (res.status === 204) return undefined as T; const body = await res.json().catch(() => ({})) as { error?: { code?: string; message?: string } }; if (!res.ok) throw new ApiError(res.status, body.error?.code || "request_failed", body.error?.message || `Request failed (${res.status})`); return body as T; }
  create(client: ConnectClient, s: Secrets): Promise<Grant> { return this.request("/api/cli/authorizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ request_id: s.requestId, client, device_secret_challenge: s.deviceChallenge, code_challenge: s.codeChallenge, code_challenge_method: "S256" }) }); }
  status(id: string, secret: string): Promise<{status:string;interval:number}> { return this.request(`/api/cli/authorizations/${encodeURIComponent(id)}/status`, { headers: { authorization: `Device ${secret}` } }); }
  exchange(id: string, secret: string, verifier: string): Promise<Exchange> { return this.request(`/api/cli/authorizations/${encodeURIComponent(id)}/token`, { method: "POST", headers: { authorization: `Device ${secret}`, "content-type": "application/json" }, body: JSON.stringify({ code_verifier: verifier }) }); }
  cancel(id: string, secret: string): Promise<void> { return this.request(`/api/cli/authorizations/${encodeURIComponent(id)}`, { method: "DELETE", headers: { authorization: `Device ${secret}` } }); }
  cleanup(id: string, token: string): Promise<void> { return this.request(`/api/cli/authorizations/${encodeURIComponent(id)}/credential`, { method: "DELETE", headers: { authorization: `Cleanup ${token}` } }); }
}
