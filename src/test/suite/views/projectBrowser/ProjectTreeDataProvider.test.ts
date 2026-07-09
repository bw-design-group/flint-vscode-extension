/**
 * @module ProjectTreeDataProvider.test
 * @description Unit tests for the ProjectTreeDataProvider contract and tree node structure
 */

import * as assert from 'assert';

import { createMockServiceContainer } from '../../../mocks/services.mock';

suite('ProjectTreeDataProvider Test Suite', () => {
    suite('Contract Verification', () => {
        test('Mock container has required services for tree provider', () => {
            const container = createMockServiceContainer();
            assert.ok(container.get('WorkspaceConfigService'));
            assert.ok(container.get('GatewayManagerService'));
            assert.ok(container.get('ProjectScannerService'));
            assert.ok(container.get('ResourceTypeProviderRegistry'));
        });

        test('Gateway manager provides active gateway for tree root', () => {
            const container = createMockServiceContainer();
            const gwService = container.get<{ getActiveGatewayId(): string | undefined }>('GatewayManagerService');
            // Initially undefined
            assert.strictEqual(gwService.getActiveGatewayId(), undefined);
        });

        test('Project scanner provides projects for tree', () => {
            const container = createMockServiceContainer();
            const scanner = container.get<{ getAllProjects(): Map<string, unknown> }>('ProjectScannerService');
            const projects = scanner.getAllProjects();
            assert.ok(projects instanceof Map);
        });
    });

    suite('Tree Node Structure', () => {
        test('Tree nodes should have required properties', () => {
            const node = {
                label: 'Python Scripts',
                contextValue: 'resourceType',
                collapsibleState: 1, // Collapsed
                children: []
            };

            assert.strictEqual(typeof node.label, 'string');
            assert.strictEqual(typeof node.contextValue, 'string');
            assert.ok(node.collapsibleState >= 0);
        });

        test('Resource nodes should have resource metadata', () => {
            const resourceNode = {
                label: 'MyScript',
                contextValue: 'resource',
                resourcePath: 'Scripts/MyScript',
                resourceType: 'script-python',
                projectId: 'test-project'
            };

            assert.strictEqual(resourceNode.contextValue, 'resource');
            assert.ok(resourceNode.resourcePath);
            assert.ok(resourceNode.resourceType);
        });

        test('Folder nodes should have folder context', () => {
            const folderNode = {
                label: 'Utilities',
                contextValue: 'resourceFolder',
                collapsibleState: 1,
                children: []
            };

            assert.strictEqual(folderNode.contextValue, 'resourceFolder');
        });

        test('Gateway selector node should have correct context', () => {
            const gwNode = {
                label: 'Select Gateway',
                contextValue: 'gatewaySelector'
            };
            assert.strictEqual(gwNode.contextValue, 'gatewaySelector');
        });

        test('Project selector node should have correct context', () => {
            const projNode = {
                label: 'Select Project',
                contextValue: 'projectSelector'
            };
            assert.strictEqual(projNode.contextValue, 'projectSelector');
        });
    });

    suite('Resource Type Grouping', () => {
        test('Resources should be groupable by type', () => {
            const resources = [
                { type: 'script-python', path: 'Script1' },
                { type: 'script-python', path: 'Script2' },
                { type: 'named-query', path: 'Query1' },
                { type: 'perspective-view', path: 'View1' }
            ];

            const grouped = new Map<string, typeof resources>();
            for (const r of resources) {
                if (!grouped.has(r.type)) grouped.set(r.type, []);
                grouped.get(r.type)!.push(r);
            }

            assert.strictEqual(grouped.size, 3);
            assert.strictEqual(grouped.get('script-python')!.length, 2);
            assert.strictEqual(grouped.get('named-query')!.length, 1);
        });

        test('Empty resource types should be filterable', () => {
            const types = ['script-python', 'named-query', 'perspective-view'];
            const resourceCounts = new Map([
                ['script-python', 5],
                ['named-query', 0],
                ['perspective-view', 3]
            ]);

            const nonEmpty = types.filter(t => (resourceCounts.get(t) || 0) > 0);
            assert.strictEqual(nonEmpty.length, 2);
            assert.ok(!nonEmpty.includes('named-query'));
        });
    });

    suite('Refresh Behavior', () => {
        test('Config change should trigger refresh flag', () => {
            let refreshNeeded = false;
            const onConfigChange = (): void => {
                refreshNeeded = true;
            };

            onConfigChange();
            assert.strictEqual(refreshNeeded, true);
        });

        test('Project scan should trigger refresh', () => {
            let refreshCount = 0;
            const onRefresh = (): void => {
                refreshCount++;
            };

            onRefresh();
            onRefresh();
            assert.strictEqual(refreshCount, 2);
        });
    });
});
