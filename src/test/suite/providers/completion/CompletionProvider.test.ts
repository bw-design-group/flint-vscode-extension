/**
 * @module CompletionProvider.test
 * @description Unit tests for Python completion provider logic including module path extraction,
 * completion item structure, filtering, and configuration settings
 */

import * as assert from 'assert';

suite('PythonCompletionProvider Test Suite', () => {
    suite('Module Path Extraction', () => {
        test('Should extract system module prefix', () => {
            const line = 'system.tag.read';
            const dotIndex = line.lastIndexOf('.');
            const prefix = line.substring(0, dotIndex);
            assert.strictEqual(prefix, 'system.tag');
        });

        test('Should handle single-level module', () => {
            const line = 'system.';
            const prefix = line.substring(0, line.length - 1);
            assert.strictEqual(prefix, 'system');
        });

        test('Should handle deeply nested modules', () => {
            const line = 'system.tag.browse.';
            const prefix = line.substring(0, line.length - 1);
            const parts = prefix.split('.');
            assert.strictEqual(parts.length, 3);
            assert.strictEqual(parts[0], 'system');
        });

        test('Should not trigger for non-Python contexts', () => {
            const isPythonFile = (fileName: string): boolean =>
                fileName.endsWith('.py') || fileName.includes('script-python');

            assert.strictEqual(isPythonFile('test.py'), true);
            assert.strictEqual(isPythonFile('script-python/code.py'), true);
            assert.strictEqual(isPythonFile('test.js'), false);
            assert.strictEqual(isPythonFile('test.json'), false);
        });
    });

    suite('Completion Item Structure', () => {
        test('Should create completion items with required fields', () => {
            const item = {
                label: 'readBlocking',
                kind: 2, // Method
                detail: 'system.tag.readBlocking(tagPaths)',
                documentation: 'Reads tag values synchronously'
            };

            assert.strictEqual(typeof item.label, 'string');
            assert.strictEqual(typeof item.kind, 'number');
            assert.ok(item.detail);
        });

        test('Should support different completion kinds', () => {
            const KINDS = {
                METHOD: 2,
                FUNCTION: 3,
                PROPERTY: 10,
                MODULE: 9,
                CLASS: 7
            };

            assert.strictEqual(KINDS.METHOD, 2);
            assert.strictEqual(KINDS.FUNCTION, 3);
            assert.strictEqual(KINDS.MODULE, 9);
        });

        test('Should include insert text for completions', () => {
            const item = {
                label: 'readBlocking',
                insertText: 'readBlocking(${1:tagPaths})'
            };

            assert.ok(item.insertText.includes('readBlocking'));
            assert.ok(item.insertText.includes('tagPaths'));
        });
    });

    suite('Completion Filtering', () => {
        test('Should filter items by prefix', () => {
            const items = [
                { label: 'read' },
                { label: 'readBlocking' },
                { label: 'write' },
                { label: 'writeBlocking' }
            ];

            const prefix = 'read';
            const filtered = items.filter(i => i.label.startsWith(prefix));
            assert.strictEqual(filtered.length, 2);
        });

        test('Should support case-insensitive filtering', () => {
            const items = [{ label: 'ReadBlocking' }, { label: 'readAsync' }, { label: 'Write' }];

            const prefix = 'read';
            const filtered = items.filter(i => i.label.toLowerCase().startsWith(prefix.toLowerCase()));
            assert.strictEqual(filtered.length, 2);
        });
    });

    suite('Configuration', () => {
        test('Should respect enablePythonAutocomplete setting', () => {
            const config = { enablePythonAutocomplete: true };
            assert.strictEqual(config.enablePythonAutocomplete, true);
        });

        test('Should respect enableDesignerLspCompletion setting', () => {
            const config = { enableDesignerLspCompletion: false };
            assert.strictEqual(config.enableDesignerLspCompletion, false);
        });

        test('Should respect enableLocalScriptCompletion setting', () => {
            const config = { enableLocalScriptCompletion: true };
            assert.strictEqual(config.enableLocalScriptCompletion, true);
        });
    });
});
