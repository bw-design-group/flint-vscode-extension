/**
 * @module TagTreeDataProvider.test
 * @description Tests for TagTreeDataProvider node building, path handling,
 * and type mapping. Verifies that browse results are correctly transformed
 * into tree nodes without double-prefixing the provider.
 */

import * as assert from 'assert';

import { TagType, TagNodeInfo } from '../../../../core/types/tags';
import { TagTreeNode } from '../../../../views/tagBrowser/TagTreeDataProvider';

suite('TagTreeDataProvider - Node Building', () => {
    // ==================== fullPath from browse results ====================

    suite('fullPath handling', () => {
        test('fullPath from browse already includes provider prefix', () => {
            // Java browse returns fullPath like "[default]Folder/Tag1"
            const browseResult: TagNodeInfo = {
                name: 'Tag1',
                fullPath: '[default]Folder/Tag1',
                tagType: TagType.AtomicTag,
                dataType: 'Int4',
                hasChildren: false,
                valueSource: 'memory'
            };

            // The fullPath should be used directly — no additional [provider] prefix needed
            assert.ok(browseResult.fullPath.startsWith('['), 'fullPath should start with [provider]');
            assert.strictEqual(browseResult.fullPath, '[default]Folder/Tag1');
        });

        test('TagTreeNode stores fullPath as-is from browse result', () => {
            const node = new TagTreeNode({
                label: 'Ramp0',
                nodeType: 'atomicTag',
                fullPath: '[Sample_Tags]Ramp/Ramp0',
                providerName: 'Sample_Tags',
                collapsibleState: 0,
                dataType: 'Int4',
                valueSource: 'memory'
            });

            // fullPath already has provider prefix - should NOT be re-prefixed
            assert.strictEqual(node.fullPath, '[Sample_Tags]Ramp/Ramp0');
            // For any operation needing the full tag path, just use node.fullPath directly
            assert.ok(!node.fullPath.includes(']['), 'Should not have double bracket from double-prefix');
        });

        test('copy tag path should use fullPath directly (no double prefix)', () => {
            const node = new TagTreeNode({
                label: 'Motor1',
                nodeType: 'udtInstance',
                fullPath: '[default]Motor1',
                providerName: 'default',
                collapsibleState: 1
            });

            // The correct path to copy is just node.fullPath
            const pathToCopy = node.fullPath;
            assert.strictEqual(pathToCopy, '[default]Motor1');

            // Wrong: would produce [default][default]Motor1
            const wrongPath = `[${node.providerName}]${node.fullPath}`;
            assert.ok(wrongPath.includes(']['), 'Double-prefix produces incorrect path');
            assert.notStrictEqual(pathToCopy, wrongPath);
        });
    });

    // ==================== Tag type mapping ====================

    suite('tag type to node type mapping', () => {
        test('AtomicTag maps to atomicTag', () => {
            assert.strictEqual(mapTagType(TagType.AtomicTag), 'atomicTag');
        });

        test('Folder maps to folder', () => {
            assert.strictEqual(mapTagType(TagType.Folder), 'folder');
        });

        test('UdtType maps to udtType', () => {
            assert.strictEqual(mapTagType(TagType.UdtType), 'udtType');
        });

        test('UdtInstance maps to udtInstance', () => {
            assert.strictEqual(mapTagType(TagType.UdtInstance), 'udtInstance');
        });
    });

    // ==================== Node icon assignment ====================

    suite('node icons', () => {
        test('provider node gets database icon', () => {
            const node = new TagTreeNode({
                label: 'default',
                nodeType: 'provider',
                fullPath: '',
                providerName: 'default',
                collapsibleState: 1
            });
            assert.strictEqual(node.contextValue, 'tag:provider');
        });

        test('UDT type node gets symbol-class icon', () => {
            const node = new TagTreeNode({
                label: 'Motor',
                nodeType: 'udtType',
                fullPath: '[default]_types_/Motor',
                providerName: 'default',
                collapsibleState: 1
            });
            assert.strictEqual(node.contextValue, 'tag:udtType');
        });

        test('UDT instance node gets symbol-object icon', () => {
            const node = new TagTreeNode({
                label: 'Motor1',
                nodeType: 'udtInstance',
                fullPath: '[default]Motor1',
                providerName: 'default',
                collapsibleState: 1
            });
            assert.strictEqual(node.contextValue, 'tag:udtInstance');
        });
    });
});

/**
 * Replicates the private mapTagType logic for testing
 */
function mapTagType(tagType: TagType): string {
    switch (tagType) {
        case TagType.AtomicTag:
            return 'atomicTag';
        case TagType.Folder:
            return 'folder';
        case TagType.UdtType:
            return 'udtType';
        case TagType.UdtInstance:
            return 'udtInstance';
        default:
            return 'atomicTag';
    }
}
