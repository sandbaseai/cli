import type { ConnectClient, Exchange } from "../types.js";
import { AuthorizationApi, ApiError, createSecrets } from "./api.js";
export interface FlowOptions { signal?: AbortSignal; open(url: string): Promise<void>; sleep(ms: number, signal?: AbortSignal): Promise<void>; log(message: string): void }
export async function authorize(api: AuthorizationApi, client: ConnectClient, options: FlowOptions): Promise<{authorizationId:string;exchange:Exchange}> {
  const secrets = createSecrets(); const grant = await api.create(client, secrets); let pending = true;
  const cancel = async () => { if (pending) await api.cancel(grant.authorization_id, secrets.deviceSecret).catch(() => undefined); };
  options.signal?.addEventListener("abort", () => void cancel(), { once: true });
  try {
    options.log(`Open this URL to authorize: ${grant.verification_uri_complete}`); await options.open(grant.verification_uri_complete);
    let interval = Math.max(1, grant.interval) * 1000;
    for (;;) { if (options.signal?.aborted) throw new Error("Authorization cancelled"); await options.sleep(interval, options.signal); try { const state = await api.status(grant.authorization_id, secrets.deviceSecret); interval = Math.max(interval, state.interval * 1000); if (state.status === "pending") continue; if (state.status === "approved") break; throw new Error(`Authorization ${state.status}`); } catch (e) { if (e instanceof ApiError && e.code === "slow_down") { interval += 5000; continue; } throw e; } }
    const exchange = await api.exchange(grant.authorization_id, secrets.deviceSecret, secrets.verifier); pending = false; return { authorizationId: grant.authorization_id, exchange };
  } catch (e) { await cancel(); throw e; }
}
