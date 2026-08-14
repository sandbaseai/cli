import { clientCatalog, type CatalogClient } from "./catalog.js";
export const clients = clientCatalog.map(entry => entry.id) as CatalogClient[];
export type Client = CatalogClient;
export const promptAssistedClients = ["antigravity", "trae", "qoder", "workbuddy", "pi"] as const;
export type PromptAssistedClient = typeof promptAssistedClients[number];
export const bridgeClients = ["claude-desktop", "cowork", ...promptAssistedClients] as const;
export type BridgeClient = typeof bridgeClients[number];
export function isPromptAssistedClient(value: string): value is PromptAssistedClient { return promptAssistedClients.includes(value as PromptAssistedClient); }
export function isBridgeClient(value: string): value is BridgeClient { return bridgeClients.includes(value as BridgeClient); }
export type ConnectClient = Client | "auto";
export function isClient(value: string): value is Client { return clients.includes(value as Client); }
export interface CredentialRecord { credential: string; credentialId: string; keyPrefix: string; client: Client; scope: string[]; mcpUrl: string; createdAt: string }
export interface Grant { authorization_id: string; status: string; verification_uri_complete: string; expires_at: string; interval: number }
export interface Exchange { credential: string; credential_id: string; key_prefix: string; client: ConnectClient; scope: string[]; mcp_url: string; created_at: string; cleanup_token: string; cleanup_expires_at: string }
