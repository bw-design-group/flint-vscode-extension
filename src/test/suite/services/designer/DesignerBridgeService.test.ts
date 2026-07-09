/**
 * @module DesignerBridgeService.test
 * @description Unit tests for DesignerBridgeService mock behavior and contract
 * Tests the mock implementation used across the test suite
 */

import * as assert from 'assert';

import { MockDesignerBridgeService } from '../../../mocks/designerBridge.mock';

suite('DesignerBridgeService Test Suite', () => {
    let service: MockDesignerBridgeService;

    setup(() => {
        service = new MockDesignerBridgeService();
    });

    teardown(() => {
        service.reset();
    });

    // ============================================================================
    // CONNECTION STATE TESTS
    // ============================================================================

    suite('Connection State', () => {
        test('Should start disconnected', () => {
            assert.strictEqual(service.isConnected(), false);
            assert.strictEqual(service.getDesignerPid(), null);
        });

        test('Should connect successfully', async () => {
            const result = await service.connect(12345);
            assert.strictEqual(result, true);
            assert.strictEqual(service.isConnected(), true);
            assert.strictEqual(service.getDesignerPid(), 12345);
        });

        test('Should use default PID when none provided', async () => {
            await service.connect();
            assert.strictEqual(service.isConnected(), true);
            assert.strictEqual(service.getDesignerPid(), 12345);
        });

        test('Should disconnect', async () => {
            await service.connect(12345);
            await service.disconnect();
            assert.strictEqual(service.isConnected(), false);
            assert.strictEqual(service.getDesignerPid(), null);
        });

        test('Should update connection state via setConnected', () => {
            service.setConnected(true, 99999);
            assert.strictEqual(service.isConnected(), true);
            assert.strictEqual(service.getDesignerPid(), 99999);
        });

        test('Should clear PID when setConnected with no PID', () => {
            service.setConnected(true, 12345);
            service.setConnected(false);
            assert.strictEqual(service.isConnected(), false);
            assert.strictEqual(service.getDesignerPid(), null);
        });
    });

    // ============================================================================
    // MESSAGE TRACKING TESTS
    // ============================================================================

    suite('Message Tracking', () => {
        test('Should track sent messages', async () => {
            await service.sendRequest('ping');
            await service.sendRequest('executeScript', { code: '1+1' });

            const messages = service.getMessages();
            assert.strictEqual(messages.length, 2);
            assert.strictEqual(messages[0].method, 'ping');
            assert.strictEqual(messages[1].method, 'executeScript');
        });

        test('Should track message params', async () => {
            const params = { code: '2+2', timeout: 5000 };
            await service.sendRequest('executeScript', params);

            const messages = service.getMessages();
            assert.strictEqual(messages.length, 1);
            assert.deepStrictEqual(messages[0].params, params);
        });

        test('Should get last message', async () => {
            await service.sendRequest('ping');
            await service.sendRequest('executeScript', { code: 'x' });

            const last = service.getLastMessage();
            assert.ok(last);
            assert.strictEqual(last.method, 'executeScript');
        });

        test('Should return undefined for last message when empty', () => {
            const last = service.getLastMessage();
            assert.strictEqual(last, undefined);
        });

        test('Should clear messages', async () => {
            await service.sendRequest('ping');
            await service.sendRequest('executeScript', { code: 'test' });
            service.clearMessages();
            assert.strictEqual(service.getMessages().length, 0);
        });

        test('Should return copy of messages array', async () => {
            await service.sendRequest('ping');
            const messages1 = service.getMessages();
            const messages2 = service.getMessages();

            // Arrays should be equal but not the same reference
            assert.deepStrictEqual(messages1, messages2);
            assert.notStrictEqual(messages1, messages2);
        });
    });

    // ============================================================================
    // CANNED RESPONSE TESTS
    // ============================================================================

    suite('Canned Responses', () => {
        test('Should return canned ping response', async () => {
            const result = await service.sendRequest('ping');
            assert.ok(result);
            const res = result as Record<string, unknown>;
            assert.strictEqual(res.status, 'ok');
            assert.strictEqual(res.projectName, 'TestProject');
            assert.strictEqual(res.authenticated, true);
        });

        test('Should return canned script execution response', async () => {
            const result = await service.sendRequest('executeScript', { code: '2+2' });
            assert.ok(result);
            const res = result as Record<string, unknown>;
            assert.strictEqual(res.output, '4');
            assert.strictEqual(res.error, null);
        });

        test('Should return canned list resources response', async () => {
            const result = await service.sendRequest('project.listResources');
            assert.ok(result);
            const res = result as Record<string, unknown>;
            assert.strictEqual(res.projectName, 'TestProject');
            assert.ok(Array.isArray(res.resources));
            assert.strictEqual(res.count, 0);
        });

        test('Should return canned LSP completion response', async () => {
            const result = await service.sendRequest('lsp.completion', {
                code: 'system.',
                line: 0,
                column: 7
            });
            assert.ok(result);
            const res = result as Record<string, unknown>;
            assert.ok(Array.isArray(res.items));
            assert.strictEqual(res.isIncomplete, false);
        });

        test('Should return empty object for unknown methods', async () => {
            const result = await service.sendRequest('unknown.method');
            assert.deepStrictEqual(result, {});
        });

        test('Should store response in message entry', async () => {
            await service.sendRequest('ping');
            const messages = service.getMessages();
            assert.ok(messages[0].response);
            assert.strictEqual((messages[0].response as Record<string, unknown>).status, 'ok');
        });
    });

    // ============================================================================
    // RESET TESTS
    // ============================================================================

    suite('Reset', () => {
        test('Should reset all state', async () => {
            await service.connect(99);
            await service.sendRequest('ping');
            service.reset();

            assert.strictEqual(service.isConnected(), false);
            assert.strictEqual(service.getDesignerPid(), null);
            assert.strictEqual(service.getMessages().length, 0);
        });

        test('Should reset lifecycle flags', async () => {
            await service.initialize();
            await service.start();
            service.reset();

            assert.strictEqual(service.initializeCalled, false);
            assert.strictEqual(service.startCalled, false);
            assert.strictEqual(service.stopCalled, false);
            assert.strictEqual(service.disposeCalled, false);
        });
    });

    // ============================================================================
    // LIFECYCLE TESTS
    // ============================================================================

    suite('Service Lifecycle', () => {
        test('Should implement initialize', async () => {
            await service.initialize();
            assert.strictEqual(service.initializeCalled, true);
        });

        test('Should implement start', async () => {
            await service.start();
            assert.strictEqual(service.startCalled, true);
        });

        test('Should implement stop', async () => {
            await service.stop();
            assert.strictEqual(service.stopCalled, true);
        });

        test('Should implement dispose', async () => {
            await service.dispose();
            assert.strictEqual(service.disposeCalled, true);
        });

        test('Should track full lifecycle sequence', async () => {
            await service.initialize();
            await service.start();
            await service.stop();
            await service.dispose();

            assert.strictEqual(service.initializeCalled, true);
            assert.strictEqual(service.startCalled, true);
            assert.strictEqual(service.stopCalled, true);
            assert.strictEqual(service.disposeCalled, true);
        });
    });
});
