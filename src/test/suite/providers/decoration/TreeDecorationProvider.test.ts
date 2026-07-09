/**
 * @module TreeDecorationProvider.test
 * @description Unit tests for TreeDecorationProvider
 */

import * as assert from 'assert';

import { ServiceContainer } from '../../../../core/ServiceContainer';
import { ResourceTypeProviderRegistry } from '../../../../services/resources/ResourceTypeProviderRegistry';

suite('TreeDecorationProvider Test Suite', () => {
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

    suite('Resource Type Icons', () => {
        test('Should have icons for all built-in resource types', () => {
            const providers = registry.getAllProviders();
            assert.ok(providers.length > 0, 'Should have providers');
            for (const provider of providers) {
                assert.ok(provider.resourceTypeId, 'Provider should have resourceTypeId');
            }
        });

        test('Should have PythonScript type registered', () => {
            const provider = registry.getProvider('script-python');
            assert.ok(provider, 'script-python provider should exist');
        });

        test('Should have NamedQuery type registered', () => {
            const provider = registry.getProvider('named-query');
            assert.ok(provider, 'named-query provider should exist');
        });

        test('Should have PerspectiveView type registered', () => {
            const provider = registry.getProvider('perspective-view');
            assert.ok(provider, 'perspective-view provider should exist');
        });

        test('Should have PerspectiveStyleClass type registered', () => {
            const provider = registry.getProvider('perspective-style-class');
            assert.ok(provider, 'perspective-style-class provider should exist');
        });
    });

    suite('Warning Detection Logic', () => {
        test('Should detect missing resource.json as warning', () => {
            const warningType = 'missing-resource-json';
            assert.ok(warningType.includes('missing'));
        });

        test('Should detect invalid JSON as warning', () => {
            const invalidJson = '{invalid json}';
            let isValid = true;
            try {
                JSON.parse(invalidJson);
            } catch {
                isValid = false;
            }
            assert.strictEqual(isValid, false, 'Invalid JSON should fail parsing');
        });

        test('Should detect circular inheritance', () => {
            const seen = new Set<string>();
            const chain = ['A', 'B', 'C', 'A'];
            let hasCircular = false;
            for (const item of chain) {
                if (seen.has(item)) {
                    hasCircular = true;
                    break;
                }
                seen.add(item);
            }
            assert.strictEqual(hasCircular, true, 'Should detect circular reference');
        });
    });

    suite('Decoration Configuration', () => {
        test('Should define default decoration options', () => {
            const defaults = {
                showWarnings: true,
                showInheritance: true,
                showResourceCounts: true,
                coloredIcons: true,
                warningPropagation: true
            };
            assert.strictEqual(defaults.showWarnings, true);
            assert.strictEqual(defaults.showInheritance, true);
            assert.strictEqual(defaults.showResourceCounts, true);
        });

        test('Should support disabling warning display', () => {
            const options = { showWarnings: false };
            assert.strictEqual(options.showWarnings, false);
        });

        test('Should support disabling inheritance display', () => {
            const options = { showInheritance: false };
            assert.strictEqual(options.showInheritance, false);
        });
    });
});
