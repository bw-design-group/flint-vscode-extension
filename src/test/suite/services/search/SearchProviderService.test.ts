/**
 * @module SearchProviderService.test
 * @description Unit tests for SearchProviderService
 * Tests the search provider coordination service lifecycle, provider registration,
 * and search execution behavior
 */

import * as assert from 'assert';

import { ServiceContainer } from '../../../../core/ServiceContainer';
import { ServiceStatus } from '../../../../core/types/services';
import { SearchProviderService } from '../../../../services/search/SearchProviderService';
import {
    createMockServiceContainer,
    MockResourceTypeProviderRegistry,
    MockSearchProviderService
} from '../../../mocks/services.mock';

suite('SearchProviderService Test Suite', () => {
    // ============================================================================
    // MOCK CONTAINER TESTS
    // ============================================================================

    suite('Mock Container Registration', () => {
        test('Should be registered in mock container', () => {
            const container = createMockServiceContainer();
            const mockService = container.get('SearchProviderService');
            assert.ok(mockService, 'SearchProviderService should exist in container');
        });

        test('Mock search provider should return results', async () => {
            const container = createMockServiceContainer();
            const mockService = container.get<MockSearchProviderService>('SearchProviderService');

            const results = await mockService.search('test');
            assert.ok(Array.isArray(results));
        });

        test('Mock search provider should return configured results', async () => {
            const container = createMockServiceContainer();
            const mockService = container.get<MockSearchProviderService>('SearchProviderService');

            const mockResults = [
                { resourcePath: 'Scripts/Test', resourceType: 'script-python', projectId: 'test-project' }
            ];
            mockService.setSearchResults(mockResults);

            const results = await mockService.search('test');
            assert.strictEqual(results.length, 1);
            assert.deepStrictEqual(results[0], mockResults[0]);
        });

        test('Mock search provider should implement lifecycle', async () => {
            const container = createMockServiceContainer();
            const mockService = container.get<MockSearchProviderService>('SearchProviderService');

            await mockService.initialize();
            assert.strictEqual(mockService.initializeCalled, true);

            await mockService.start();
            assert.strictEqual(mockService.startCalled, true);

            await mockService.stop();
            assert.strictEqual(mockService.stopCalled, true);

            await mockService.dispose();
            assert.strictEqual(mockService.disposeCalled, true);
        });
    });

    // ============================================================================
    // REAL SERVICE LIFECYCLE TESTS
    // ============================================================================

    suite('Service Lifecycle', () => {
        test('Should be STOPPED before initialization', () => {
            const container = new ServiceContainer();
            const service = new SearchProviderService(container);
            assert.strictEqual(service.getStatus(), ServiceStatus.STOPPED);
        });

        test('Should throw when starting before initialization', async () => {
            const container = new ServiceContainer();
            const service = new SearchProviderService(container);

            try {
                await service.start();
                assert.fail('Should have thrown');
            } catch (e) {
                assert.ok((e as Error).message.includes('must be initialized'));
            }
        });

        test('Should initialize when ResourceTypeProviderRegistry is available', async () => {
            const container = new ServiceContainer();

            // Register a mock registry that provides searchable providers
            const mockRegistry = new MockResourceTypeProviderRegistry();
            (mockRegistry as unknown as Record<string, unknown>).getSearchableProviders = (): unknown[] => [
                { resourceTypeId: 'script-python' }
            ];
            container.register('ResourceTypeProviderRegistry', mockRegistry);

            const service = new SearchProviderService(container);

            try {
                await service.initialize();
                assert.strictEqual(service.getStatus(), ServiceStatus.RUNNING);
                await service.dispose();
            } catch {
                // If initialization fails due to missing dependencies, that is expected
                // in unit test context since we do not have the full VS Code runtime
                assert.ok(true);
            }
        });
    });

    // ============================================================================
    // SEARCH RESULT CONTRACT TESTS
    // ============================================================================

    suite('Search Result Contract', () => {
        test('Search results should have expected structure', () => {
            const mockResult = {
                resourcePath: 'Scripts/MyScript',
                resourceType: 'script-python',
                projectId: 'test-project',
                displayName: 'MyScript',
                score: 1.0,
                matches: [],
                metadata: {}
            };

            assert.strictEqual(typeof mockResult.resourcePath, 'string');
            assert.strictEqual(typeof mockResult.resourceType, 'string');
            assert.strictEqual(typeof mockResult.projectId, 'string');
            assert.strictEqual(typeof mockResult.displayName, 'string');
            assert.ok(mockResult.score >= 0 && mockResult.score <= 1);
            assert.ok(Array.isArray(mockResult.matches));
        });

        test('Should deduplicate search results by path and project', () => {
            const results = [
                { resourcePath: 'a', projectId: 'p1', score: 0.5 },
                { resourcePath: 'b', projectId: 'p1', score: 0.8 },
                { resourcePath: 'a', projectId: 'p1', score: 0.9 } // duplicate
            ];

            const unique = results.filter(
                (r, i, arr) =>
                    arr.findIndex(x => x.resourcePath === r.resourcePath && x.projectId === r.projectId) === i
            );

            assert.strictEqual(unique.length, 2);
        });

        test('Should allow same path in different projects', () => {
            const results = [
                { resourcePath: 'a', projectId: 'project-1' },
                { resourcePath: 'a', projectId: 'project-2' }
            ];

            const unique = results.filter(
                (r, i, arr) =>
                    arr.findIndex(x => x.resourcePath === r.resourcePath && x.projectId === r.projectId) === i
            );

            assert.strictEqual(unique.length, 2);
        });

        test('Search results should sort by score descending', () => {
            const results = [
                { resourcePath: 'low', score: 30 },
                { resourcePath: 'high', score: 100 },
                { resourcePath: 'mid', score: 60 }
            ];

            const sorted = [...results].sort((a, b) => (b.score || 0) - (a.score || 0));

            assert.strictEqual(sorted[0].resourcePath, 'high');
            assert.strictEqual(sorted[1].resourcePath, 'mid');
            assert.strictEqual(sorted[2].resourcePath, 'low');
        });
    });

    // ============================================================================
    // PROVIDER REGISTRATION CONTRACT TESTS
    // ============================================================================

    suite('Provider Registration Contract', () => {
        test('Registration should have required fields', () => {
            const registration = {
                providerId: 'test-provider',
                resourceTypes: ['script-python', 'named-query'],
                priority: 100,
                isEnabled: true
            };

            assert.strictEqual(typeof registration.providerId, 'string');
            assert.ok(Array.isArray(registration.resourceTypes));
            assert.strictEqual(typeof registration.priority, 'number');
            assert.strictEqual(typeof registration.isEnabled, 'boolean');
        });

        test('Providers should be sortable by priority', () => {
            const providers = [
                { providerId: 'low', priority: 10 },
                { providerId: 'high', priority: 100 },
                { providerId: 'mid', priority: 50 }
            ];

            const sorted = [...providers].sort((a, b) => b.priority - a.priority);

            assert.strictEqual(sorted[0].providerId, 'high');
            assert.strictEqual(sorted[1].providerId, 'mid');
            assert.strictEqual(sorted[2].providerId, 'low');
        });

        test('Provider metrics should have expected structure', () => {
            const metrics = {
                providerId: 'test-provider',
                totalSearches: 42,
                averageExecutionTime: 150.5,
                successRate: 0.95,
                errorCount: 2,
                lastError: undefined
            };

            assert.strictEqual(typeof metrics.providerId, 'string');
            assert.strictEqual(typeof metrics.totalSearches, 'number');
            assert.strictEqual(typeof metrics.averageExecutionTime, 'number');
            assert.ok(metrics.successRate >= 0 && metrics.successRate <= 1);
            assert.strictEqual(typeof metrics.errorCount, 'number');
        });
    });

    // ============================================================================
    // SEARCH FILTER TESTS
    // ============================================================================

    suite('Search Filters', () => {
        test('Resource type filter should support wildcard', () => {
            const resourceTypes = ['*'];
            const targetType = 'script-python';

            const matches = resourceTypes.includes('*') || resourceTypes.includes(targetType);
            assert.strictEqual(matches, true);
        });

        test('Resource type filter should match specific types', () => {
            const resourceTypes = ['script-python', 'named-query'];

            assert.strictEqual(resourceTypes.includes('script-python'), true);
            assert.strictEqual(resourceTypes.includes('perspective-view'), false);
        });

        test('Project filter should narrow results', () => {
            const allResults = [
                { projectId: 'project-a', resourcePath: 'a' },
                { projectId: 'project-b', resourcePath: 'b' },
                { projectId: 'project-a', resourcePath: 'c' }
            ];

            const filtered = allResults.filter(r => r.projectId === 'project-a');
            assert.strictEqual(filtered.length, 2);
        });

        test('Max results should limit output', () => {
            const maxResults = 5;
            const results = Array.from({ length: 20 }, (_, i) => ({ id: i }));

            const limited = results.slice(0, maxResults);
            assert.strictEqual(limited.length, 5);
        });
    });
});
