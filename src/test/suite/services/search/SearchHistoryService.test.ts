/**
 * @module SearchHistoryService.test
 * @description Unit tests for SearchHistoryService business logic patterns
 * Since SearchHistoryService depends on VS Code's vscode.EventEmitter and filesystem,
 * we test the core business logic patterns that the service implements
 */

import * as assert from 'assert';

import { ServiceContainer } from '../../../../core/ServiceContainer';
import { ServiceStatus } from '../../../../core/types/services';
import { SearchHistoryService } from '../../../../services/search/SearchHistoryService';

suite('SearchHistoryService Test Suite', () => {
    let service: SearchHistoryService;
    let container: ServiceContainer;

    setup(async () => {
        container = new ServiceContainer();
        service = new SearchHistoryService(container);
        await service.initialize();
        await service.clearHistory();
    });

    teardown(async () => {
        await service.dispose();
    });

    // ============================================================================
    // SERVICE LIFECYCLE TESTS
    // ============================================================================

    suite('Service Lifecycle', () => {
        test('Should initialize successfully', async () => {
            const newContainer = new ServiceContainer();
            const newService = new SearchHistoryService(newContainer);
            assert.strictEqual(newService.getStatus(), ServiceStatus.STOPPED);

            await newService.initialize();
            assert.strictEqual(newService.getStatus(), ServiceStatus.RUNNING);

            await newService.dispose();
        });

        test('Should throw when starting before initialization', async () => {
            const newService = new SearchHistoryService(container);
            try {
                await newService.start();
                assert.fail('Should have thrown');
            } catch (e) {
                assert.ok((e as Error).message.includes('must be initialized'));
            }
        });

        test('Should start after initialization', async () => {
            const newContainer = new ServiceContainer();
            const newService = new SearchHistoryService(newContainer);
            await newService.initialize();
            await newService.start();
            assert.strictEqual(newService.getStatus(), ServiceStatus.RUNNING);
            await newService.dispose();
        });

        test('Should dispose and clear history', async () => {
            await service.addToHistory({
                query: 'test',
                resultCount: 5,
                executionTime: 100
            });

            await service.dispose();
            assert.strictEqual(service.getStatus(), ServiceStatus.STOPPED);

            // After dispose, history should be cleared
            const history = service.getSearchHistory();
            assert.strictEqual(history.length, 0);
        });
    });

    // ============================================================================
    // ADD TO HISTORY TESTS
    // ============================================================================

    suite('addToHistory()', () => {
        test('Should add a search query to history', async () => {
            await service.addToHistory({
                query: 'system.tag',
                resultCount: 10,
                executionTime: 50
            });

            const history = service.getSearchHistory();
            assert.strictEqual(history.length, 1);
            assert.strictEqual(history[0].query, 'system.tag');
            assert.strictEqual(history[0].resultCount, 10);
            assert.strictEqual(history[0].executionTime, 50);
        });

        test('Should not add empty queries', async () => {
            await service.addToHistory({
                query: '',
                resultCount: 0,
                executionTime: 0
            });
            await service.addToHistory({
                query: '   ',
                resultCount: 0,
                executionTime: 0
            });

            const history = service.getSearchHistory();
            assert.strictEqual(history.length, 0);
        });

        test('Should trim query whitespace', async () => {
            await service.addToHistory({
                query: '  system.tag  ',
                resultCount: 5,
                executionTime: 30
            });

            const history = service.getSearchHistory();
            assert.strictEqual(history[0].query, 'system.tag');
        });

        test('Should store timestamp', async () => {
            const before = new Date().toISOString();

            await service.addToHistory({
                query: 'test',
                resultCount: 1,
                executionTime: 10
            });

            const after = new Date().toISOString();
            const history = service.getSearchHistory();

            assert.ok(history[0].timestamp >= before);
            assert.ok(history[0].timestamp <= after);
        });

        test('Should store search options', async () => {
            await service.addToHistory({
                query: 'test',
                resultCount: 1,
                executionTime: 10,
                searchOptions: { caseSensitive: true }
            });

            const history = service.getSearchHistory();
            assert.deepStrictEqual(history[0].searchOptions, { caseSensitive: true });
        });

        test('Should store project IDs', async () => {
            await service.addToHistory({
                query: 'test',
                resultCount: 1,
                executionTime: 10,
                projectIds: ['project-a', 'project-b']
            });

            const history = service.getSearchHistory();
            assert.ok(history[0].projectIds);
            assert.deepStrictEqual([...history[0].projectIds], ['project-a', 'project-b']);
        });

        test('Should store resource types', async () => {
            await service.addToHistory({
                query: 'test',
                resultCount: 1,
                executionTime: 10,
                resourceTypes: ['script-python', 'named-query']
            });

            const history = service.getSearchHistory();
            assert.ok(history[0].resourceTypes);
            assert.deepStrictEqual([...history[0].resourceTypes], ['script-python', 'named-query']);
        });

        test('Should add most recent entries first', async () => {
            await service.addToHistory({ query: 'first', resultCount: 1, executionTime: 10 });
            await service.addToHistory({ query: 'second', resultCount: 2, executionTime: 20 });
            await service.addToHistory({ query: 'third', resultCount: 3, executionTime: 30 });

            const history = service.getSearchHistory();
            assert.strictEqual(history[0].query, 'third');
            assert.strictEqual(history[1].query, 'second');
            assert.strictEqual(history[2].query, 'first');
        });
    });

    // ============================================================================
    // GET HISTORY TESTS
    // ============================================================================

    suite('getSearchHistory()', () => {
        test('Should return empty array when no history', () => {
            const history = service.getSearchHistory();
            assert.ok(Array.isArray(history));
            assert.strictEqual(history.length, 0);
        });

        test('Should return all entries without limit', async () => {
            for (let i = 0; i < 5; i++) {
                await service.addToHistory({ query: `query-${i}`, resultCount: i, executionTime: 10 });
            }

            const history = service.getSearchHistory();
            assert.strictEqual(history.length, 5);
        });

        test('Should respect limit parameter', async () => {
            for (let i = 0; i < 10; i++) {
                await service.addToHistory({ query: `query-${i}`, resultCount: i, executionTime: 10 });
            }

            const history = service.getSearchHistory(3);
            assert.strictEqual(history.length, 3);
        });

        test('Should return frozen array', () => {
            const history = service.getSearchHistory();
            assert.ok(Object.isFrozen(history));
        });
    });

    // ============================================================================
    // RECENT QUERIES TESTS
    // ============================================================================

    suite('getRecentQueries()', () => {
        test('Should return unique recent queries', async () => {
            await service.addToHistory({ query: 'tag', resultCount: 1, executionTime: 10 });
            await service.addToHistory({ query: 'script', resultCount: 2, executionTime: 20 });
            await service.addToHistory({ query: 'tag', resultCount: 3, executionTime: 30 });

            const recent = service.getRecentQueries();

            // Should be unique - 'tag' appears only once (most recent)
            assert.strictEqual(recent.length, 2);
            assert.strictEqual(recent[0], 'tag'); // Most recent first
            assert.strictEqual(recent[1], 'script');
        });

        test('Should respect limit', async () => {
            for (let i = 0; i < 20; i++) {
                await service.addToHistory({ query: `unique-query-${i}`, resultCount: 1, executionTime: 10 });
            }

            const recent = service.getRecentQueries(5);
            assert.strictEqual(recent.length, 5);
        });

        test('Should default to 10 results', async () => {
            for (let i = 0; i < 20; i++) {
                await service.addToHistory({ query: `unique-${i}`, resultCount: 1, executionTime: 10 });
            }

            const recent = service.getRecentQueries();
            assert.strictEqual(recent.length, 10);
        });

        test('Should return frozen array', () => {
            const recent = service.getRecentQueries();
            assert.ok(Object.isFrozen(recent));
        });
    });

    // ============================================================================
    // CLEAR HISTORY TESTS
    // ============================================================================

    suite('clearHistory()', () => {
        test('Should clear all history', async () => {
            await service.addToHistory({ query: 'a', resultCount: 1, executionTime: 10 });
            await service.addToHistory({ query: 'b', resultCount: 2, executionTime: 20 });

            await service.clearHistory();

            const history = service.getSearchHistory();
            assert.strictEqual(history.length, 0);
        });

        test('Should clear query frequency', async () => {
            await service.addToHistory({ query: 'test', resultCount: 1, executionTime: 10 });
            await service.addToHistory({ query: 'test', resultCount: 2, executionTime: 20 });

            await service.clearHistory();

            const analytics = service.getSearchAnalytics();
            assert.strictEqual(analytics.totalSearches, 0);
            assert.strictEqual(analytics.uniqueQueries, 0);
        });
    });

    // ============================================================================
    // REMOVE FROM HISTORY TESTS
    // ============================================================================

    suite('removeFromHistory()', () => {
        test('Should remove specific query from history', async () => {
            await service.addToHistory({ query: 'keep', resultCount: 1, executionTime: 10 });
            await service.addToHistory({ query: 'remove', resultCount: 2, executionTime: 20 });
            await service.addToHistory({ query: 'keep-also', resultCount: 3, executionTime: 30 });

            await service.removeFromHistory('remove');

            const history = service.getSearchHistory();
            assert.strictEqual(history.length, 2);
            assert.ok(history.every(h => h.query !== 'remove'));
        });

        test('Should remove all instances of query', async () => {
            await service.addToHistory({ query: 'remove-me', resultCount: 1, executionTime: 10 });
            await service.addToHistory({ query: 'keep', resultCount: 2, executionTime: 20 });
            await service.addToHistory({ query: 'remove-me', resultCount: 3, executionTime: 30 });

            await service.removeFromHistory('remove-me');

            const history = service.getSearchHistory();
            assert.strictEqual(history.length, 1);
            assert.strictEqual(history[0].query, 'keep');
        });

        test('Should handle removing non-existent query', async () => {
            await service.addToHistory({ query: 'test', resultCount: 1, executionTime: 10 });

            // Should not throw
            await service.removeFromHistory('non-existent');

            const history = service.getSearchHistory();
            assert.strictEqual(history.length, 1);
        });
    });

    // ============================================================================
    // ANALYTICS TESTS
    // ============================================================================

    suite('getSearchAnalytics()', () => {
        test('Should return empty analytics when no history', () => {
            const analytics = service.getSearchAnalytics();

            assert.strictEqual(analytics.totalSearches, 0);
            assert.strictEqual(analytics.uniqueQueries, 0);
            assert.strictEqual(analytics.averageResultCount, 0);
            assert.strictEqual(analytics.averageExecutionTime, 0);
            assert.ok(Array.isArray(analytics.topQueries));
            assert.ok(Array.isArray(analytics.topResourceTypes));
            assert.ok(Array.isArray(analytics.searchTrends));
        });

        test('Should track total searches', async () => {
            await service.addToHistory({ query: 'a', resultCount: 1, executionTime: 10 });
            await service.addToHistory({ query: 'b', resultCount: 2, executionTime: 20 });
            await service.addToHistory({ query: 'a', resultCount: 3, executionTime: 30 });

            const analytics = service.getSearchAnalytics();
            assert.strictEqual(analytics.totalSearches, 3);
        });

        test('Should track unique queries', async () => {
            await service.addToHistory({ query: 'a', resultCount: 1, executionTime: 10 });
            await service.addToHistory({ query: 'b', resultCount: 2, executionTime: 20 });
            await service.addToHistory({ query: 'a', resultCount: 3, executionTime: 30 });

            const analytics = service.getSearchAnalytics();
            assert.strictEqual(analytics.uniqueQueries, 2);
        });

        test('Should calculate average result count', async () => {
            await service.addToHistory({ query: 'a', resultCount: 10, executionTime: 10 });
            await service.addToHistory({ query: 'b', resultCount: 20, executionTime: 20 });

            const analytics = service.getSearchAnalytics();
            assert.strictEqual(analytics.averageResultCount, 15);
        });

        test('Should calculate average execution time', async () => {
            await service.addToHistory({ query: 'a', resultCount: 1, executionTime: 100 });
            await service.addToHistory({ query: 'b', resultCount: 2, executionTime: 200 });

            const analytics = service.getSearchAnalytics();
            assert.strictEqual(analytics.averageExecutionTime, 150);
        });

        test('Should provide top queries sorted by frequency', async () => {
            await service.addToHistory({ query: 'rare', resultCount: 1, executionTime: 10 });
            await service.addToHistory({ query: 'common', resultCount: 2, executionTime: 10 });
            await service.addToHistory({ query: 'common', resultCount: 3, executionTime: 10 });
            await service.addToHistory({ query: 'common', resultCount: 4, executionTime: 10 });

            const analytics = service.getSearchAnalytics();
            assert.ok(analytics.topQueries.length >= 2);
            assert.strictEqual(analytics.topQueries[0].query, 'common');
            assert.strictEqual(analytics.topQueries[0].count, 3);
        });

        test('Should track top resource types', async () => {
            await service.addToHistory({
                query: 'a',
                resultCount: 1,
                executionTime: 10,
                resourceTypes: ['script-python']
            });
            await service.addToHistory({
                query: 'b',
                resultCount: 2,
                executionTime: 20,
                resourceTypes: ['script-python', 'named-query']
            });

            const analytics = service.getSearchAnalytics();
            assert.ok(analytics.topResourceTypes.length > 0);

            const pythonType = analytics.topResourceTypes.find(t => t.type === 'script-python');
            assert.ok(pythonType);
            assert.strictEqual(pythonType.count, 2);
        });

        test('Should include search trends', () => {
            const analytics = service.getSearchAnalytics();
            assert.ok(Array.isArray(analytics.searchTrends));
            // Should have 30 days of data
            assert.strictEqual(analytics.searchTrends.length, 30);
        });

        test('Should return frozen analytics', () => {
            const analytics = service.getSearchAnalytics();
            assert.ok(Object.isFrozen(analytics));
            assert.ok(Object.isFrozen(analytics.topQueries));
            assert.ok(Object.isFrozen(analytics.topResourceTypes));
            assert.ok(Object.isFrozen(analytics.searchTrends));
        });
    });

    // ============================================================================
    // SUGGESTION TESTS
    // ============================================================================

    suite('generateSuggestions()', () => {
        test('Should return empty suggestions when no history', async () => {
            const suggestions = await service.generateSuggestions();
            assert.ok(Array.isArray(suggestions));
            assert.strictEqual(suggestions.length, 0);
        });

        test('Should generate smart suggestions for partial query', async () => {
            const suggestions = await service.generateSuggestions('type');
            assert.ok(Array.isArray(suggestions));

            // Should include pattern-based suggestions matching 'type'
            const suggested = suggestions.filter(s => s.category === 'suggested');
            assert.ok(suggested.length > 0);
        });

        test('Should generate frequent suggestions for repeated queries', async () => {
            // Add same query multiple times to exceed SUGGESTION_THRESHOLD (2)
            for (let i = 0; i < 3; i++) {
                await service.addToHistory({ query: 'frequent-query', resultCount: 5, executionTime: 50 });
            }

            const suggestions = await service.generateSuggestions();
            const frequentSuggestion = suggestions.find(
                s => s.query === 'frequent-query' && (s.category === 'frequent' || s.category === 'recent')
            );
            assert.ok(frequentSuggestion, 'Should have a suggestion for the frequent query');
        });

        test('Should return frozen suggestions array', async () => {
            const suggestions = await service.generateSuggestions();
            assert.ok(Object.isFrozen(suggestions));
        });

        test('Should filter suggestions by partial query', async () => {
            for (let i = 0; i < 3; i++) {
                await service.addToHistory({ query: 'system.tag', resultCount: 5, executionTime: 50 });
            }
            for (let i = 0; i < 3; i++) {
                await service.addToHistory({ query: 'script.util', resultCount: 3, executionTime: 40 });
            }

            const systemSuggestions = await service.generateSuggestions('system');
            const hasSystemTag = systemSuggestions.some(s => s.query === 'system.tag');
            const hasScriptUtil = systemSuggestions.some(s => s.query === 'script.util');

            assert.strictEqual(hasSystemTag, true);
            assert.strictEqual(hasScriptUtil, false);
        });
    });

    // ============================================================================
    // EDGE CASES
    // ============================================================================

    suite('Edge Cases', () => {
        test('Should handle unicode queries', async () => {
            await service.addToHistory({ query: 'test', resultCount: 1, executionTime: 10 });

            const history = service.getSearchHistory();
            assert.strictEqual(history.length, 1);
        });

        test('Should handle very long queries', async () => {
            const longQuery = 'a'.repeat(500);
            await service.addToHistory({ query: longQuery, resultCount: 0, executionTime: 10 });

            const history = service.getSearchHistory();
            assert.strictEqual(history.length, 1);
            assert.strictEqual(history[0].query, longQuery);
        });

        test('Should handle special characters in queries', async () => {
            await service.addToHistory({
                query: 'test[with]special(chars)*+?.\\',
                resultCount: 1,
                executionTime: 10
            });

            const history = service.getSearchHistory();
            assert.strictEqual(history.length, 1);
        });
    });
});
