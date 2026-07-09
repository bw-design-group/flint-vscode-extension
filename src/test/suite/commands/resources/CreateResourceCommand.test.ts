/**
 * @module CreateResourceCommand.test
 * @description Unit tests for CreateResourceCommand validation and logic
 */

import * as assert from 'assert';

import { ServiceContainer } from '../../../../core/ServiceContainer';
import { ResourceTypeProviderRegistry } from '../../../../services/resources/ResourceTypeProviderRegistry';

suite('CreateResourceCommand Test Suite', () => {
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

    suite('Resource Type Availability', () => {
        test('Should have built-in resource types registered', () => {
            const providers = registry.getAllProviders();
            assert.ok(providers.length > 0, 'Should have at least one resource type provider');
        });

        test('Should have PythonScript provider', () => {
            const provider = registry.getProvider('script-python');
            assert.ok(provider, 'PythonScript provider should be registered');
        });

        test('Should have NamedQuery provider', () => {
            const provider = registry.getProvider('named-query');
            assert.ok(provider, 'NamedQuery provider should be registered');
        });

        test('Should have PerspectiveView provider', () => {
            const provider = registry.getProvider('perspective-view');
            assert.ok(provider, 'PerspectiveView provider should be registered');
        });
    });

    suite('Resource Name Validation', () => {
        test('Should accept valid alphanumeric names', () => {
            const validNames = ['MyScript', 'test_resource', 'resource-1', 'ABC123'];
            for (const name of validNames) {
                assert.ok(/^[a-zA-Z0-9_-]+$/.test(name), `"${name}" should be valid`);
            }
        });

        test('Should reject names with spaces', () => {
            assert.ok(!/^[a-zA-Z0-9_-]+$/.test('my script'), 'Names with spaces should be invalid');
        });

        test('Should reject names with special characters', () => {
            const invalidNames = ['my/script', 'test@resource', 'resource.name', 'test!'];
            for (const name of invalidNames) {
                assert.ok(!/^[a-zA-Z0-9_-]+$/.test(name), `"${name}" should be invalid`);
            }
        });

        test('Should reject empty names', () => {
            assert.ok(!/^[a-zA-Z0-9_-]+$/.test(''), 'Empty names should be invalid');
        });
    });

    suite('Resource Type Templates', () => {
        test('Should get templates for known resource types', () => {
            const provider = registry.getProvider('script-python');
            if (provider) {
                const templateConfig = provider.getTemplateConfig();
                assert.ok(templateConfig, 'Template config should exist');
            }
        });

        test('Should return undefined for unknown resource types', () => {
            const provider = registry.getProvider('nonexistent-type');
            assert.strictEqual(provider, undefined, 'Unknown type should return undefined');
        });
    });

    suite('Resource Type Provider Capabilities', () => {
        test('Each provider should have a typeId', () => {
            const providers = registry.getAllProviders();
            for (const provider of providers) {
                assert.ok(provider.resourceTypeId, 'Provider should have typeId');
            }
        });

        test('Each provider should have a display name', () => {
            const providers = registry.getAllProviders();
            for (const provider of providers) {
                assert.ok(provider.displayName, `Provider ${provider.resourceTypeId} should have displayName`);
            }
        });
    });
});
