/**
 * @module lspProxy/types
 * @description Shared types for the bundled `flint-lsp-proxy` — the standalone stdio language
 * server that forwards LSP requests to the Ignition gateway's headless Flint transport. These are
 * intentionally self-contained (no VS Code imports) because the proxy runs as its own Node process.
 */

/** JSON-RPC 2.0 request sent to the gateway's `/data/flint/rpc` endpoint. */
export interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
    id: number;
}

/** JSON-RPC 2.0 response returned by the gateway. */
export interface JsonRpcResponse {
    jsonrpc: '2.0';
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
    id: number | null;
}

/**
 * Auth header scheme for a gateway. `native` = Ignition 8.3 platform API token
 * (X-Ignition-API-Token: keyId:secret). `bearer` = Flint-managed token (Authorization: Bearer).
 */
export type GatewayTokenType = 'native' | 'bearer';

/** Configuration for a direct (headless) gateway connection. */
export interface GatewayConfig {
    /** Alias used to address this gateway (the headless analog of a Designer pid). */
    id: string;
    /** Base URL, e.g. "https://gw.example.com:8043" (no trailing slash, no /data path). */
    baseUrl: string;
    /** Secret token; never logged. */
    token: string;
    /** Which auth header to send. */
    tokenType: GatewayTokenType;
    /** Accept self-signed TLS certs for this gateway (dev gateways). */
    insecureTLS?: boolean;
}
