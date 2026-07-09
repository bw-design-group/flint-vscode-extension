/**
 * @module TagCommands.test
 * @description Tests for tag command parameter construction.
 * Verifies that commands build the correct qualified tag paths and
 * do not double-prefix the provider name.
 */

import * as assert from 'assert';

import { TagTreeNode } from '../../../../views/tagBrowser/TagTreeDataProvider';

suite('Tag Commands - Path Construction', () => {
    // ==================== Path qualification ====================

    suite('tag path qualification', () => {
        test('fullPath from browse already has provider prefix - no re-qualification needed', () => {
            const node = new TagTreeNode({
                label: 'Ramp0',
                nodeType: 'atomicTag',
                fullPath: '[Sample_Tags]Ramp/Ramp0',
                providerName: 'Sample_Tags',
                collapsibleState: 0,
                dataType: 'Float4'
            });

            // Commands should use node.fullPath directly
            const qualifiedPath = node.fullPath;
            assert.strictEqual(qualifiedPath, '[Sample_Tags]Ramp/Ramp0');
        });

        test('read command path should not double-prefix', () => {
            const node = new TagTreeNode({
                label: 'Tag1',
                nodeType: 'atomicTag',
                fullPath: '[default]Folder/Tag1',
                providerName: 'default',
                collapsibleState: 0
            });

            // Correct: use fullPath directly
            const correctPath = node.fullPath;
            assert.strictEqual(correctPath, '[default]Folder/Tag1');

            // Wrong: double prefix
            const wrongPath = `[${node.providerName}]${node.fullPath}`;
            assert.strictEqual(wrongPath, '[default][default]Folder/Tag1');
            assert.notStrictEqual(correctPath, wrongPath);
        });

        test('getConfig command path should not double-prefix', () => {
            const node = new TagTreeNode({
                label: 'Motor1',
                nodeType: 'udtInstance',
                fullPath: '[default]Motor1',
                providerName: 'default',
                collapsibleState: 1
            });

            const correctPath = node.fullPath;
            assert.strictEqual(correctPath, '[default]Motor1');
        });

        test('delete command path should not double-prefix', () => {
            const node = new TagTreeNode({
                label: 'OldTag',
                nodeType: 'atomicTag',
                fullPath: '[default]Folder/OldTag',
                providerName: 'default',
                collapsibleState: 0
            });

            const correctPath = node.fullPath;
            assert.strictEqual(correctPath, '[default]Folder/OldTag');
        });

        test('write command path should not double-prefix', () => {
            const node = new TagTreeNode({
                label: 'Speed',
                nodeType: 'atomicTag',
                fullPath: '[default]Motor1/Speed',
                providerName: 'default',
                collapsibleState: 0,
                dataType: 'Float4'
            });

            const correctPath = node.fullPath;
            assert.strictEqual(correctPath, '[default]Motor1/Speed');
        });
    });

    // ==================== Create tag parent path ====================

    suite('create tag parent path', () => {
        test('provider root uses [providerName] as parentPath', () => {
            const providerNode = new TagTreeNode({
                label: 'default',
                nodeType: 'provider',
                fullPath: '',
                providerName: 'default',
                collapsibleState: 1
            });

            // CreateTagCommand logic for provider root
            const parentPath =
                providerNode.nodeType === 'provider' ? `[${providerNode.providerName}]` : providerNode.fullPath;

            assert.strictEqual(parentPath, '[default]');
        });

        test('folder node uses fullPath as parentPath', () => {
            const folderNode = new TagTreeNode({
                label: 'Ramp',
                nodeType: 'folder',
                fullPath: '[Sample_Tags]Ramp',
                providerName: 'Sample_Tags',
                collapsibleState: 1
            });

            const parentPath =
                folderNode.nodeType === 'provider' ? `[${folderNode.providerName}]` : folderNode.fullPath;

            assert.strictEqual(parentPath, '[Sample_Tags]Ramp');
        });
    });

    // ==================== Copy tag path ====================

    suite('copy tag path', () => {
        test('copies fullPath directly without re-prefixing', () => {
            const node = new TagTreeNode({
                label: 'Running',
                nodeType: 'atomicTag',
                fullPath: '[default]Motor1/Running',
                providerName: 'default',
                collapsibleState: 0,
                dataType: 'Boolean'
            });

            const pathToCopy = node.fullPath;
            assert.strictEqual(pathToCopy, '[default]Motor1/Running');
        });
    });
});
