/**
 * @module TagBrowserService.test
 * @description Tests for TagBrowserService request parameter formatting.
 * Verifies that all tag methods send the correct param names and structures
 * expected by the Java TagHandler.
 */

import * as assert from 'assert';

import { MockDesignerBridgeService } from '../../../mocks/designerBridge.mock';

suite('TagBrowserService - Request Parameters', () => {
    let bridge: MockDesignerBridgeService;

    setup(() => {
        bridge = new MockDesignerBridgeService();
    });

    teardown(() => {
        bridge.reset();
    });

    /**
     * Helper to send a request and return the captured params
     */
    async function sendAndCapture(method: string, params?: unknown): Promise<{ method: string; params?: unknown }> {
        await bridge.connect();
        await bridge.sendRequest(method, params);
        const msg = bridge.getLastMessage();
        assert.ok(msg, 'Expected a message to be sent');
        return msg;
    }

    // ==================== tags.browse ====================

    suite('tags.browse params', () => {
        test('sends provider and parentPath', async () => {
            const msg = await sendAndCapture('tags.browse', {
                provider: 'default',
                parentPath: 'Folder',
                typeFilter: undefined,
                nameFilter: undefined
            });
            assert.strictEqual(msg.method, 'tags.browse');
            const params = msg.params as Record<string, unknown>;
            assert.strictEqual(params.provider, 'default');
            assert.strictEqual(params.parentPath, 'Folder');
        });
    });

    // ==================== tags.read ====================

    suite('tags.read params', () => {
        test('sends tagPaths (not paths)', async () => {
            const msg = await sendAndCapture('tags.read', {
                tagPaths: ['[default]Tag1', '[default]Tag2']
            });
            assert.strictEqual(msg.method, 'tags.read');
            const params = msg.params as Record<string, unknown>;
            assert.ok(Array.isArray(params.tagPaths), 'tagPaths should be an array');
            assert.strictEqual((params.tagPaths as string[]).length, 2);
            assert.strictEqual(params.paths, undefined, 'Should not have "paths" key');
        });
    });

    // ==================== tags.write ====================

    suite('tags.write params', () => {
        test('sends writes array (not entries)', async () => {
            const msg = await sendAndCapture('tags.write', {
                writes: [{ path: '[default]Tag1', value: '42' }]
            });
            assert.strictEqual(msg.method, 'tags.write');
            const params = msg.params as Record<string, unknown>;
            assert.ok(Array.isArray(params.writes), 'writes should be an array');
            assert.strictEqual(params.entries, undefined, 'Should not have "entries" key');
        });
    });

    // ==================== tags.getConfig ====================

    suite('tags.getConfig params', () => {
        test('sends tagPath (not path)', async () => {
            const msg = await sendAndCapture('tags.getConfig', {
                tagPath: '[default]Folder/Tag1'
            });
            assert.strictEqual(msg.method, 'tags.getConfig');
            const params = msg.params as Record<string, unknown>;
            assert.strictEqual(params.tagPath, '[default]Folder/Tag1');
            assert.strictEqual(params.path, undefined, 'Should not have "path" key');
        });
    });

    // ==================== tags.create ====================

    suite('tags.create params', () => {
        test('sends parentPath and tags array', async () => {
            const msg = await sendAndCapture('tags.create', {
                parentPath: '[default]Folder',
                tags: [{ name: 'NewTag', tagType: 'AtomicTag', dataType: 'Int4' }]
            });
            assert.strictEqual(msg.method, 'tags.create');
            const params = msg.params as Record<string, unknown>;
            assert.strictEqual(params.parentPath, '[default]Folder');
            assert.ok(Array.isArray(params.tags), 'tags should be an array');
            const tags = params.tags as Array<Record<string, unknown>>;
            assert.strictEqual(tags[0].name, 'NewTag');
            assert.strictEqual(tags[0].tagType, 'AtomicTag');
        });

        test('does not send provider, name, tagType as top-level params', async () => {
            const msg = await sendAndCapture('tags.create', {
                parentPath: '[default]',
                tags: [{ name: 'Test', tagType: 'AtomicTag' }]
            });
            const params = msg.params as Record<string, unknown>;
            assert.strictEqual(params.provider, undefined, 'provider should not be top-level');
            assert.strictEqual(params.name, undefined, 'name should not be top-level');
            assert.strictEqual(params.tagType, undefined, 'tagType should not be top-level');
        });
    });

    // ==================== tags.edit ====================

    suite('tags.edit params', () => {
        test('sends tagPath and config (not path)', async () => {
            const msg = await sendAndCapture('tags.edit', {
                tagPath: '[default]Tag1',
                config: { tooltip: 'Updated' }
            });
            assert.strictEqual(msg.method, 'tags.edit');
            const params = msg.params as Record<string, unknown>;
            assert.strictEqual(params.tagPath, '[default]Tag1');
            assert.strictEqual(params.path, undefined, 'Should not have "path" key');
            assert.ok(params.config, 'Should have config object');
        });
    });

    // ==================== tags.delete ====================

    suite('tags.delete params', () => {
        test('sends tagPaths array (not path string)', async () => {
            const msg = await sendAndCapture('tags.delete', {
                tagPaths: ['[default]Tag1']
            });
            assert.strictEqual(msg.method, 'tags.delete');
            const params = msg.params as Record<string, unknown>;
            assert.ok(Array.isArray(params.tagPaths), 'tagPaths should be an array');
            assert.strictEqual(params.path, undefined, 'Should not have "path" key');
        });
    });
});
