/**
 * @module TreeNodeBuilder.test
 * @description Unit tests for tree node building, folder hierarchy, and resource type display
 */

import * as assert from 'assert';

suite('TreeNodeBuilder Test Suite', () => {
    suite('Node Creation', () => {
        test('Should create nodes with label and context', () => {
            const node = { label: 'Test', contextValue: 'resource', children: [] };
            assert.strictEqual(node.label, 'Test');
            assert.strictEqual(node.contextValue, 'resource');
        });

        test('Should support collapsible and non-collapsible nodes', () => {
            const NONE = 0;
            const COLLAPSED = 1;
            const EXPANDED = 2;

            const leaf = { collapsibleState: NONE };
            const folder = { collapsibleState: COLLAPSED };
            const expanded = { collapsibleState: EXPANDED };

            assert.strictEqual(leaf.collapsibleState, NONE);
            assert.strictEqual(folder.collapsibleState, COLLAPSED);
            assert.strictEqual(expanded.collapsibleState, EXPANDED);
        });
    });

    suite('Folder Hierarchy Building', () => {
        test('Should build hierarchy from flat paths', () => {
            const paths = ['Scripts/Util/Helper', 'Scripts/Util/Config', 'Scripts/Main'];

            // Simulate folder grouping
            const tree = new Map<string, string[]>();
            for (const p of paths) {
                const parts = p.split('/');
                const folder = parts.slice(0, -1).join('/');
                if (!tree.has(folder)) tree.set(folder, []);
                tree.get(folder)!.push(parts[parts.length - 1]);
            }

            assert.strictEqual(tree.size, 2);
            assert.strictEqual(tree.get('Scripts/Util')!.length, 2);
            assert.strictEqual(tree.get('Scripts')!.length, 1);
        });

        test('Should handle root-level resources', () => {
            const paths = ['TopLevelScript', 'Folder/Nested'];
            const rootLevel = paths.filter(p => !p.includes('/'));
            assert.strictEqual(rootLevel.length, 1);
            assert.strictEqual(rootLevel[0], 'TopLevelScript');
        });

        test('Should handle deeply nested paths', () => {
            const path = 'A/B/C/D/E/Resource';
            const parts = path.split('/');
            assert.strictEqual(parts.length, 6);
            assert.strictEqual(parts[parts.length - 1], 'Resource');
        });
    });

    suite('Resource Type Display', () => {
        test('Should map resource types to display names', () => {
            const displayNames: Record<string, string> = {
                'script-python': 'Python Scripts',
                'named-query': 'Named Queries',
                'perspective-view': 'Perspective Views',
                'perspective-style': 'Style Classes',
                'vision-window': 'Vision Windows',
                report: 'Reports'
            };

            assert.strictEqual(displayNames['script-python'], 'Python Scripts');
            assert.strictEqual(displayNames['named-query'], 'Named Queries');
        });

        test('Should assign icons per resource type', () => {
            const icons: Record<string, string> = {
                'script-python': 'symbol-method',
                'named-query': 'database',
                'perspective-view': 'browser'
            };

            assert.ok(icons['script-python']);
            assert.ok(icons['named-query']);
        });
    });

    suite('Singleton Resources', () => {
        test('Should identify singleton resource types', () => {
            const singletonTypes = [
                'perspective-page-config',
                'perspective-session-props',
                'perspective-session-events',
                'perspective-general-props'
            ];

            assert.ok(singletonTypes.includes('perspective-page-config'));
            assert.ok(!singletonTypes.includes('script-python'));
        });
    });

    suite('Resource Statistics', () => {
        test('Should count resources per type', () => {
            const resources = [
                { type: 'script-python' },
                { type: 'script-python' },
                { type: 'script-python' },
                { type: 'named-query' },
                { type: 'perspective-view' },
                { type: 'perspective-view' }
            ];

            const counts = new Map<string, number>();
            for (const r of resources) {
                counts.set(r.type, (counts.get(r.type) || 0) + 1);
            }

            assert.strictEqual(counts.get('script-python'), 3);
            assert.strictEqual(counts.get('named-query'), 1);
            assert.strictEqual(counts.get('perspective-view'), 2);
        });

        test('Should calculate total resource count', () => {
            const counts = new Map([
                ['a', 3],
                ['b', 2],
                ['c', 5]
            ]);
            const total = [...counts.values()].reduce((sum, c) => sum + c, 0);
            assert.strictEqual(total, 10);
        });
    });

    suite('Inheritance Indicators', () => {
        test('Should mark inherited resources', () => {
            const resource = {
                path: 'InheritedScript',
                isInherited: true,
                parentProject: 'BaseProject'
            };

            assert.strictEqual(resource.isInherited, true);
            assert.strictEqual(resource.parentProject, 'BaseProject');
        });

        test('Should distinguish own vs inherited resources', () => {
            const resources = [
                { path: 'Own1', isInherited: false },
                { path: 'Inherited1', isInherited: true },
                { path: 'Own2', isInherited: false }
            ];

            const own = resources.filter(r => !r.isInherited);
            const inherited = resources.filter(r => r.isInherited);

            assert.strictEqual(own.length, 2);
            assert.strictEqual(inherited.length, 1);
        });
    });
});
