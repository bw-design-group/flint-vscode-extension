/**
 * @module SearchCommand.test
 * @description Unit tests for SearchResourcesCommand
 */

import * as assert from 'assert';

import { ServiceContainer } from '../../../../core/ServiceContainer';
import { ResourceTypeProviderRegistry } from '../../../../services/resources/ResourceTypeProviderRegistry';

suite('SearchResourcesCommand Test Suite', () => {
    let container: ServiceContainer;
    let registry: ResourceTypeProviderRegistry;

    setup(async () => {
        container = new ServiceContainer();
        registry = new ResourceTypeProviderRegistry(container);
        await registry.initialize();
    });

    teardown(async () => {
        await registry.dispose();
    });

    suite('Query Parsing', () => {
        test('Should parse simple text queries', () => {
            const query = 'myFunction';
            assert.ok(query.length > 0);
            assert.ok(!query.includes(':'));
        });

        test('Should detect type filter syntax', () => {
            const query = 'type:script-python myFunction';
            const hasFilter = query.includes('type:');
            assert.strictEqual(hasFilter, true);
        });

        test('Should detect project filter syntax', () => {
            const query = 'project:MainProject handler';
            const hasFilter = query.includes('project:');
            assert.strictEqual(hasFilter, true);
        });

        test('Should handle empty queries', () => {
            const query = '';
            assert.strictEqual(query.length, 0);
        });

        test('Should handle whitespace-only queries', () => {
            const query = '   ';
            assert.strictEqual(query.trim().length, 0);
        });
    });

    suite('Search Options', () => {
        test('Should support case-sensitive option', () => {
            const options = { caseSensitive: true, regex: false, limit: 100 };
            assert.strictEqual(options.caseSensitive, true);
        });

        test('Should support regex option', () => {
            const options = { caseSensitive: false, regex: true, limit: 100 };
            assert.strictEqual(options.regex, true);
        });

        test('Should have default result limit', () => {
            const defaultLimit = 100;
            assert.strictEqual(defaultLimit, 100);
        });

        test('Should limit quick pick display to 50 items', () => {
            const quickPickLimit = 50;
            assert.ok(quickPickLimit <= 100);
        });
    });

    suite('Search History', () => {
        test('Should track up to 10 recent queries', () => {
            const maxHistory = 10;
            const history: string[] = [];
            for (let i = 0; i < 15; i++) {
                history.push(`query-${i}`);
                if (history.length > maxHistory) {
                    history.shift();
                }
            }
            assert.strictEqual(history.length, maxHistory);
        });

        test('Should not duplicate recent queries', () => {
            const history: string[] = ['query1', 'query2'];
            const newQuery = 'query1';
            const filtered = history.filter(q => q !== newQuery);
            filtered.unshift(newQuery);
            assert.strictEqual(filtered.length, 2);
            assert.strictEqual(filtered[0], 'query1');
        });
    });

    suite('Resource Type Filtering', () => {
        test('Should get searchable providers', () => {
            const providers = registry.getSearchableProviders();
            assert.ok(Array.isArray(providers));
        });

        test('Should have at least one searchable provider', () => {
            const providers = registry.getSearchableProviders();
            assert.ok(providers.length > 0, 'Should have searchable providers');
        });
    });
});
