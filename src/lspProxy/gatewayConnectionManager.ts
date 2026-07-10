/**
 * @module lspProxy/gatewayConnectionManager
 * @description HTTP JSON-RPC client for talking directly to an Ignition gateway's Flint module —
 * no Designer required. The proxy registers a single gateway (id "default") and issues
 * authenticated JSON-RPC 2.0 requests against `/data/flint/rpc`. Kept dependency-light so it can be
 * bundled into a standalone Node process that does not import `vscode`.
 */
import { Agent, fetch, type RequestInit } from 'undici';

import type { GatewayConfig, JsonRpcRequest, JsonRpcResponse } from './types';

const RPC_PATH = '/data/flint/rpc';
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Keeps registered gateways (by id/alias) and their optional TLS-relaxed dispatchers, and forwards
 * JSON-RPC requests to the gateway's Flint endpoint with the correct auth header.
 */
export class GatewayConnectionManager {
    private readonly gateways = new Map<string, GatewayConfig>();
    private readonly agents = new Map<string, Agent>();
    private requestId = 0;

    /** Registers or replaces a gateway config (in memory). Returns the id. Does not probe. */
    register(cfg: GatewayConfig): string {
        const normalized: GatewayConfig = {
            ...cfg,
            baseUrl: cfg.baseUrl.replace(/\/+$/, '')
        };
        this.gateways.set(normalized.id, normalized);
        // Reset any cached dispatcher so TLS setting changes take effect.
        this.agents.delete(normalized.id);
        return normalized.id;
    }

    has(id: string): boolean {
        return this.gateways.has(id);
    }

    /** POSTs a JSON-RPC 2.0 request to /data/flint/rpc and returns the result. */
    async sendRequest<T = unknown>(
        id: string,
        method: string,
        params?: unknown,
        timeoutMs: number = DEFAULT_TIMEOUT_MS
    ): Promise<T> {
        const cfg = this.requireGateway(id);
        const body: JsonRpcRequest = {
            jsonrpc: '2.0',
            id: ++this.requestId,
            method,
            params: params ?? {}
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const opts: RequestInit = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.buildAuthHeaders(cfg)
                },
                body: JSON.stringify(body),
                signal: controller.signal,
                dispatcher: this.dispatcherFor(cfg)
            };
            const res = await fetch(cfg.baseUrl + RPC_PATH, opts);
            if (res.status === 401 || res.status === 403) {
                throw new Error(`Gateway "${id}" rejected auth (HTTP ${res.status}). Check token / tokenType.`);
            }
            if (!res.ok) {
                throw new Error(`Gateway "${id}" HTTP ${res.status}: ${await res.text()}`);
            }
            const parsed = (await res.json()) as JsonRpcResponse;
            if (parsed.error) {
                throw new Error(`${method} returned [${parsed.error.code}] ${parsed.error.message}`);
            }
            return parsed.result as T;
        } catch (error) {
            if (controller.signal.aborted) {
                throw new Error(`Request timeout: ${method}`);
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    private requireGateway(id: string): GatewayConfig {
        const cfg = this.gateways.get(id);
        if (!cfg) {
            throw new Error(
                `No gateway registered with id "${id}". Set FLINT_GATEWAY_URL and FLINT_GATEWAY_TOKEN first.`
            );
        }
        return cfg;
    }

    private buildAuthHeaders(cfg: GatewayConfig): Record<string, string> {
        if (cfg.tokenType === 'native') {
            return { 'X-Ignition-API-Token': cfg.token };
        }
        return { Authorization: `Bearer ${cfg.token}` };
    }

    /**
     * Returns a per-gateway undici dispatcher that skips TLS validation when this gateway allows
     * self-signed certs, else undefined (default validating dispatcher). Scoped per-gateway so a
     * prod gateway stays validated even if a dev gateway is relaxed.
     */
    private dispatcherFor(cfg: GatewayConfig): Agent | undefined {
        if (cfg.insecureTLS !== true) {
            return undefined;
        }
        let agent = this.agents.get(cfg.id);
        if (!agent) {
            agent = new Agent({ connect: { rejectUnauthorized: false } });
            this.agents.set(cfg.id, agent);
        }
        return agent;
    }
}
