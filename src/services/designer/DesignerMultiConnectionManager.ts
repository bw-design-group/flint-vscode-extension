/**
 * @module DesignerMultiConnectionManager
 * @description Manages secondary WebSocket connections to Designer instances for scan fan-out.
 * Only used for project scan operations - all interactive operations use the primary connection.
 */

import type WebSocket from 'ws';

import type { ProjectScanOptions, ProjectScanResult } from './DesignerConnectionManager';
import type { DesignerInstance } from './DesignerDiscoveryService';

import { FlintError } from '@/core/errors';
import { isWSL } from '@/utils/platformHelper';
import type { WslProxy } from '@/utils/wslProxy';

// WebSocket class type for dynamic import
type WebSocketConstructor = new (url: string) => WebSocket;

/**
 * JSON-RPC request structure
 */
interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
    id: number | string;
}

/**
 * JSON-RPC response structure
 */
interface JsonRpcResponse {
    jsonrpc: '2.0';
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
    id: number | string | null;
}

/**
 * Pending request tracking
 */
interface PendingRequest {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

/**
 * A lightweight secondary connection to a Designer, used only for scan fan-out
 */
interface SecondaryConnection {
    ws: WebSocket;
    designer: DesignerInstance;
    isAuthenticated: boolean;
    requestIdCounter: number;
    pendingRequests: Map<number | string, PendingRequest>;
    wslProxy: WslProxy | null;
}

/**
 * Manages secondary WebSocket connections to Designer instances.
 * These connections are used exclusively for fanning out project scan operations
 * to multiple Designers simultaneously.
 */
export class DesignerMultiConnectionManager {
    private static readonly REQUEST_TIMEOUT_MS = 30000;

    private connections: Map<number, SecondaryConnection> = new Map();
    private WebSocketClass: WebSocketConstructor | null = null;

    private onSecondaryConnectionsChangedCallbacks: Array<() => void> = [];

    /**
     * Initializes the manager by loading the WebSocket module
     */
    initialize(wsClass: WebSocketConstructor): void {
        this.WebSocketClass = wsClass;
    }

    /**
     * Connects to a Designer as a secondary connection
     */
    async connect(designer: DesignerInstance): Promise<void> {
        if (!this.WebSocketClass) {
            throw new FlintError(
                'WebSocket not initialized',
                'WEBSOCKET_NOT_INITIALIZED',
                'Call initialize() before connect()'
            );
        }

        // Already connected to this Designer
        if (this.connections.has(designer.pid)) {
            return;
        }

        try {
            await this.connectToPort(designer, designer.port, null);
        } catch (directError: unknown) {
            // On WSL, fall back to proxy if direct connection fails
            if (isWSL()) {
                let proxy: WslProxy | null = null;
                try {
                    const { createWslProxy } = await import('@/utils/wslProxy');
                    proxy = await createWslProxy(designer.port);
                    console.log(`[MultiConn][WSL] Created proxy on port ${proxy.localPort} -> ${designer.port}`);
                    await this.connectToPort(designer, proxy.localPort, proxy);
                } catch (proxyError: unknown) {
                    proxy?.close();
                    throw proxyError instanceof Error ? proxyError : new Error(String(proxyError));
                }
            } else {
                throw directError instanceof Error ? directError : new Error(String(directError));
            }
        }
    }

    /**
     * Establishes a secondary WebSocket connection to a specific port
     */
    private connectToPort(designer: DesignerInstance, port: number, wslProxy: WslProxy | null): Promise<void> {
        const WS = this.WebSocketClass!;

        return new Promise((resolve, reject) => {
            try {
                const url = `ws://127.0.0.1:${port}`;
                const ws = new WS(url);

                const conn: SecondaryConnection = {
                    ws,
                    designer,
                    isAuthenticated: false,
                    requestIdCounter: 0,
                    pendingRequests: new Map(),
                    wslProxy
                };

                ws.on('open', () => {
                    void this.authenticate(conn, designer.secret)
                        .then(() => {
                            conn.isAuthenticated = true;
                            this.connections.set(designer.pid, conn);
                            this.notifyConnectionsChanged();
                            console.log(
                                `[MultiConn] Secondary connection established to ${designer.project.name} (PID ${designer.pid})`
                            );
                            resolve();
                        })
                        .catch((error: unknown) => {
                            ws.close();
                            wslProxy?.close();
                            reject(error instanceof Error ? error : new Error(String(error)));
                        });
                });

                ws.on('message', (data: Buffer | string) => {
                    this.handleMessage(conn, data.toString());
                });

                ws.on('close', () => {
                    this.handleClose(designer.pid);
                });

                ws.on('error', (error: Error) => {
                    // If not yet in the map, this is a connection failure
                    if (!this.connections.has(designer.pid)) {
                        wslProxy?.close();
                        reject(
                            new FlintError(
                                'Secondary WebSocket connection failed',
                                'SECONDARY_CONNECTION_FAILED',
                                error.message,
                                error
                            )
                        );
                    } else {
                        console.error(`[MultiConn] Error on secondary connection (PID ${designer.pid}):`, error);
                    }
                });
            } catch (error: unknown) {
                wslProxy?.close();
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    /**
     * Disconnects a specific secondary connection by PID
     */
    disconnect(pid: number): void {
        const conn = this.connections.get(pid);
        if (!conn) return;

        this.cleanupConnection(pid, conn);
    }

    /**
     * Disconnects all secondary connections
     */
    disconnectAll(): void {
        for (const [pid, conn] of this.connections) {
            this.cleanupConnection(pid, conn);
        }
    }

    /**
     * Returns all connected secondary Designer instances
     */
    getConnectedDesigners(): DesignerInstance[] {
        return Array.from(this.connections.values())
            .filter(c => c.isAuthenticated)
            .map(c => c.designer);
    }

    /**
     * Returns the number of active secondary connections
     */
    getConnectionCount(): number {
        return this.connections.size;
    }

    /**
     * Sends a project scan to all secondary connections in parallel.
     * Returns a map of PID to scan result. Failed scans are included with success=false.
     */
    async scanProjectAll(options: ProjectScanOptions = {}): Promise<Map<number, ProjectScanResult>> {
        const results = new Map<number, ProjectScanResult>();

        const scanPromises = Array.from(this.connections.entries()).map(async ([pid, conn]) => {
            try {
                const result = await this.sendRequest<ProjectScanResult>(conn, 'project.scan', {
                    scanGateway: options.scanGateway ?? true,
                    refreshDesigner: options.refreshDesigner ?? true
                });
                results.set(pid, result);
            } catch (error) {
                console.error(`[MultiConn] Scan failed for PID ${pid}:`, error);
                results.set(pid, {
                    success: false,
                    gatewayScanSuccess: false,
                    designerRefreshSuccess: false,
                    timestamp: Date.now()
                });
            }
        });

        await Promise.all(scanPromises);
        return results;
    }

    /**
     * Removes and returns a secondary connection for promotion to primary.
     * Returns the DesignerInstance if available, null otherwise.
     */
    removeForPromotion(): DesignerInstance | null {
        const first = this.connections.entries().next();
        if (first.done) return null;

        const [pid, conn] = first.value;
        // Close the secondary WebSocket - the primary manager will create its own
        this.cleanupConnection(pid, conn);
        return conn.designer;
    }

    /**
     * Registers a callback for when secondary connections change
     */
    onSecondaryConnectionsChanged(callback: () => void): void {
        this.onSecondaryConnectionsChangedCallbacks.push(callback);
    }

    /**
     * Disposes all connections and clears state
     */
    dispose(): void {
        this.disconnectAll();
        this.onSecondaryConnectionsChangedCallbacks = [];
    }

    /**
     * Authenticates with a Designer
     */
    private async authenticate(conn: SecondaryConnection, secret: string): Promise<void> {
        const result = await this.sendRequest<{
            success: boolean;
        }>(conn, 'authenticate', {
            secret,
            clientName: 'Flint VS Code Extension (Secondary)',
            clientVersion: '1.0.0'
        });

        if (!result.success) {
            throw new FlintError('Authentication failed', 'AUTH_FAILED', 'Invalid secret for secondary connection');
        }
    }

    /**
     * Sends a JSON-RPC request on a secondary connection
     */
    private sendRequest<T>(conn: SecondaryConnection, method: string, params?: unknown): Promise<T> {
        if (!conn.ws || (method !== 'authenticate' && !conn.isAuthenticated)) {
            return Promise.reject(new FlintError('Not connected', 'NOT_CONNECTED', 'Secondary connection not ready'));
        }

        const id = ++conn.requestIdCounter;
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method,
            params,
            id
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                conn.pendingRequests.delete(id);
                reject(new FlintError('Request timed out', 'REQUEST_TIMEOUT', `Method: ${method}`));
            }, DesignerMultiConnectionManager.REQUEST_TIMEOUT_MS);

            conn.pendingRequests.set(id, {
                resolve: resolve as (result: unknown) => void,
                reject,
                timeout
            });

            conn.ws.send(JSON.stringify(request));
        });
    }

    /**
     * Handles incoming WebSocket messages on a secondary connection
     */
    private handleMessage(conn: SecondaryConnection, data: string): void {
        try {
            const message = JSON.parse(data) as JsonRpcResponse;

            // Only handle responses (ignore notifications on secondary connections)
            if (message.id !== null && message.id !== undefined) {
                const pending = conn.pendingRequests.get(message.id);
                if (pending) {
                    clearTimeout(pending.timeout);
                    conn.pendingRequests.delete(message.id);

                    if (message.error) {
                        pending.reject(
                            new FlintError(
                                message.error.message,
                                `JSONRPC_ERROR_${message.error.code}`,
                                message.error.message
                            )
                        );
                    } else {
                        pending.resolve(message.result);
                    }
                }
            }
        } catch (error) {
            console.error('[MultiConn] Failed to parse WebSocket message:', error);
        }
    }

    /**
     * Handles WebSocket close on a secondary connection
     */
    private handleClose(pid: number): void {
        const conn = this.connections.get(pid);
        if (!conn) return;

        // Reject pending requests
        for (const [id, pending] of conn.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Secondary connection closed'));
            conn.pendingRequests.delete(id);
        }

        conn.wslProxy?.close();
        this.connections.delete(pid);
        this.notifyConnectionsChanged();
        console.log(`[MultiConn] Secondary connection closed (PID ${pid})`);
    }

    /**
     * Cleans up a connection and removes it from the map
     */
    private cleanupConnection(pid: number, conn: SecondaryConnection): void {
        for (const [id, pending] of conn.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Connection closed'));
            conn.pendingRequests.delete(id);
        }

        conn.ws.close();
        conn.wslProxy?.close();
        this.connections.delete(pid);
        this.notifyConnectionsChanged();
    }

    /**
     * Notifies listeners that secondary connections changed
     */
    private notifyConnectionsChanged(): void {
        for (const callback of this.onSecondaryConnectionsChangedCallbacks) {
            try {
                callback();
            } catch (error) {
                console.error('[MultiConn] Error in connections changed callback:', error);
            }
        }
    }
}
