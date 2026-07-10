/**
 * @module GatewayLspSocket
 * @description Transport helpers for the gateway-hosted Flint language server. The gateway module
 * (Flint Designer Bridge v1.2.0+) speaks raw LSP over a WebSocket at `/system/flint-lsp`, so the
 * extension connects directly — no local proxy process. This module probes the gateway for that
 * capability via `/data/flint/health` and opens the WebSocket as a duplex {@link StreamInfo} stream
 * that `vscode-languageclient` drives.
 */
import type { Duplex } from 'stream';

import { Agent, fetch } from 'undici';
import type { StreamInfo } from 'vscode-languageclient/node';
import type WebSocket from 'ws';

import { FlintError } from '@/core/errors/FlintError';

/** Default WebSocket mount path advertised by the gateway module. */
const DEFAULT_LSP_WS_PATH = '/system/flint-lsp';
const HEALTH_PATH = '/data/flint/health';
const WS_CAPABILITY = 'lsp.websocket';
const HEALTH_TIMEOUT_MS = 5000;

/** Result of probing a gateway's `/data/flint/health` for LSP-over-WebSocket support. */
export interface ILspWsProbe {
    /** Whether the Flint health endpoint responded — used to distinguish "too old" from "offline". */
    reachable: boolean;
    /** Path where the LSP WebSocket is mounted; present iff the gateway advertises WS support. */
    lspWsPath?: string;
}

/** Shape of the relevant fields in the gateway's `/data/flint/health` response. */
interface IHealthResponse {
    capabilities?: unknown;
    lspWsPath?: unknown;
}

/**
 * Returns a per-request undici dispatcher that skips TLS validation when the gateway allows
 * self-signed certs, else undefined (the default validating dispatcher).
 */
function insecureDispatcher(insecureTls: boolean): Agent | undefined {
    if (!insecureTls) {
        return undefined;
    }
    return new Agent({ connect: { rejectUnauthorized: false } });
}

/**
 * Probes a gateway for native LSP-over-WebSocket support by fetching `/data/flint/health`.
 * Sets `lspWsPath` when the gateway advertises the `"lsp.websocket"` capability. `reachable` is
 * true whenever the Flint health endpoint responds, letting callers distinguish an out-of-date
 * module (reachable, no `lspWsPath`) from an offline/absent gateway (`reachable: false`).
 *
 * @param gatewayUrl - Gateway origin (e.g. `https://gw.example.com:8043`), no trailing `/data` path.
 * @param insecureTls - Accept self-signed TLS certs for this gateway (dev gateways).
 */
export async function probeWsSupport(gatewayUrl: string, insecureTls: boolean): Promise<ILspWsProbe> {
    const baseUrl = gatewayUrl.replace(/\/+$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
        const res = await fetch(baseUrl + HEALTH_PATH, {
            method: 'GET',
            signal: controller.signal,
            dispatcher: insecureDispatcher(insecureTls)
        });
        if (!res.ok) {
            return { reachable: false };
        }

        const health = (await res.json()) as IHealthResponse;
        const capabilities = Array.isArray(health.capabilities) ? health.capabilities : [];
        if (!capabilities.includes(WS_CAPABILITY)) {
            return { reachable: true };
        }

        const lspWsPath =
            typeof health.lspWsPath === 'string' && health.lspWsPath !== '' ? health.lspWsPath : DEFAULT_LSP_WS_PATH;
        return { reachable: true, lspWsPath };
    } catch {
        // Unreachable gateway, timeout, or malformed response.
        return { reachable: false };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Opens an authenticated LSP WebSocket to the gateway and returns it as a duplex
 * {@link StreamInfo} for `vscode-languageclient`. Resolves once the socket is open; rejects if the
 * socket errors or closes before opening.
 *
 * @param wsUrl - Fully-qualified `ws://`/`wss://` URL of the LSP endpoint.
 * @param headers - Auth headers sent on the WebSocket upgrade request.
 * @param insecureTls - Accept self-signed TLS certs for this gateway (dev gateways).
 */
export async function openLspStream(
    wsUrl: string,
    headers: Record<string, string>,
    insecureTls: boolean
): Promise<StreamInfo> {
    const wsModule = await import('ws');
    const WebSocketClass = wsModule.default;

    const options: WebSocket.ClientOptions = { headers };
    if (insecureTls) {
        options.rejectUnauthorized = false;
    }

    const socket = new WebSocketClass(wsUrl, options);

    await new Promise<void>((resolve, reject) => {
        const onOpen = (): void => {
            cleanup();
            resolve();
        };
        const onError = (error: Error): void => {
            cleanup();
            reject(
                new FlintError(`Failed to open LSP WebSocket: ${error.message}`, 'LSP_WS_OPEN_FAILED', undefined, error)
            );
        };
        const onClose = (code: number, reason: Buffer): void => {
            cleanup();
            reject(
                new FlintError(
                    `LSP WebSocket closed before opening (code ${code}): ${reason.toString()}`,
                    'LSP_WS_CLOSED_BEFORE_OPEN'
                )
            );
        };
        const cleanup = (): void => {
            socket.off('open', onOpen);
            socket.off('error', onError);
            socket.off('close', onClose);
        };
        socket.once('open', onOpen);
        socket.once('error', onError);
        socket.once('close', onClose);
    });

    const duplex: Duplex = wsModule.createWebSocketStream(socket);
    return { reader: duplex, writer: duplex };
}
