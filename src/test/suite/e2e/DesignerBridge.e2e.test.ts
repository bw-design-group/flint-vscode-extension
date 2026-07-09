/**
 * @module DesignerBridge.e2e.test
 * @description E2E tests for the Designer Bridge WebSocket connection.
 * Tests auto-skip when no Flint-enabled Designer is running.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Checks if a Flint-enabled Designer is running by looking for registry files.
 */
function findDesignerRegistry(): { pid: number; port: number; secret: string } | null {
    const registryDir = path.join(os.homedir(), '.ignition', 'flint', 'designers');

    if (!fs.existsSync(registryDir)) {
        return null;
    }

    const files = fs.readdirSync(registryDir);
    for (const file of files) {
        if (!file.startsWith('designer-') || !file.endsWith('.json')) continue;

        try {
            const content = fs.readFileSync(path.join(registryDir, file), 'utf-8');
            const info = JSON.parse(content) as { pid: number; port: number; secret: string };

            // Verify process is still running
            try {
                process.kill(info.pid, 0);
                return { pid: info.pid, port: info.port, secret: info.secret };
            } catch {
                // Process not running
            }
        } catch {
            // Skip invalid files
        }
    }

    return null;
}

suite('Designer Bridge E2E Tests', function () {
    this.timeout(120000); // 2 minutes for E2E

    let registry: { pid: number; port: number; secret: string } | null;
    let ws: import('ws').WebSocket | null = null;
    let requestId = 0;

    suiteSetup(function () {
        registry = findDesignerRegistry();
        if (!registry) {
            console.log('No running Designer found - skipping E2E tests');
            this.skip();
        }
    });

    suiteTeardown(() => {
        if (ws) {
            ws.close();
            ws = null;
        }
    });

    async function connectAndAuth(): Promise<import('ws').WebSocket> {
        if (!registry) throw new Error('No Designer registry');

        const WebSocket = (await import('ws')).default;
        return new Promise((resolve, reject) => {
            const socket = new WebSocket(`ws://127.0.0.1:${registry!.port}`);

            socket.on('open', () => {
                // Authenticate
                const authRequest = {
                    jsonrpc: '2.0',
                    method: 'authenticate',
                    params: {
                        secret: registry!.secret,
                        clientName: 'Flint E2E Tests',
                        clientVersion: '1.0.0'
                    },
                    id: ++requestId
                };

                socket.send(JSON.stringify(authRequest));
            });

            socket.on('message', (data: Buffer) => {
                const response = JSON.parse(data.toString()) as {
                    result?: { success: boolean };
                };
                if (response.result?.success) {
                    ws = socket;
                    resolve(socket);
                } else {
                    reject(new Error('Authentication failed'));
                }
            });

            socket.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });
    }

    function sendRequest(method: string, params?: unknown): Promise<unknown> {
        return new Promise((resolve, reject) => {
            if (!ws) throw new Error('Not connected');

            const id = ++requestId;
            const request = { jsonrpc: '2.0', method, params, id };

            const handler = (data: Buffer): void => {
                const response = JSON.parse(data.toString()) as {
                    id: number;
                    error?: { message: string };
                    result?: unknown;
                };
                if (response.id === id) {
                    ws!.off('message', handler);
                    if (response.error) {
                        reject(new Error(response.error.message));
                    } else {
                        resolve(response.result);
                    }
                }
            };

            ws.on('message', handler);
            ws.send(JSON.stringify(request));

            setTimeout(() => {
                ws!.off('message', handler);
                reject(new Error(`Request timeout: ${method}`));
            }, 30000);
        });
    }

    test('Should connect and authenticate', async () => {
        await connectAndAuth();
        assert.ok(ws, 'WebSocket should be connected');
    });

    test('Should respond to ping', async () => {
        if (!ws) await connectAndAuth();

        const pingResult = (await sendRequest('ping')) as Record<string, unknown>;
        assert.ok(pingResult, 'Ping should return a result');
        assert.strictEqual(typeof pingResult.projectName, 'string');
    });

    test('Should execute a designer-scope script', async () => {
        if (!ws) await connectAndAuth();

        const result = (await sendRequest('executeScript', {
            code: '2 + 2',
            timeout: 5000
        })) as Record<string, unknown>;

        assert.ok(result, 'Script execution should return a result');
    });

    test('Should list project resources', async () => {
        if (!ws) await connectAndAuth();

        const result = (await sendRequest('project.listResources')) as Record<string, unknown>;
        assert.ok(result, 'Should return resources');
        assert.ok(Array.isArray(result.resources), 'Should have resources array');
    });

    test('Should handle LSP completions', async () => {
        if (!ws) await connectAndAuth();

        const result = (await sendRequest('lsp.completion', {
            code: 'system.',
            line: 0,
            column: 7
        })) as Record<string, unknown>;

        assert.ok(result, 'Should return completion result');
    });

    test('Should handle request timeout gracefully', async () => {
        if (!ws) await connectAndAuth();

        // This should complete without throwing an unhandled error
        try {
            await sendRequest('nonexistent.method');
            assert.fail('Should have thrown an error');
        } catch (err) {
            assert.ok(err instanceof Error);
            // Either method not found or timeout
            assert.ok(
                err.message.includes('Method not found') || err.message.includes('timeout'),
                `Expected method not found or timeout error, got: ${err.message}`
            );
        }
    });
});
