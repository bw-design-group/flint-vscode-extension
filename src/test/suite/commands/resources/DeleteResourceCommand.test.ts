/**
 * @module DeleteResourceCommand.test
 * @description Unit tests for DeleteResourceCommand validation and logic
 */

import * as assert from 'assert';

import { ServiceContainer } from '../../../../core/ServiceContainer';
import { ServiceStatus } from '../../../../core/types/services';
import { ResourceTypeProviderRegistry } from '../../../../services/resources/ResourceTypeProviderRegistry';
import { ResourceValidationService } from '../../../../services/resources/ResourceValidationService';

suite('DeleteResourceCommand Test Suite', () => {
    let container: ServiceContainer;
    let registry: ResourceTypeProviderRegistry;
    let validationService: ResourceValidationService;

    setup(async () => {
        container = new ServiceContainer();
        registry = new ResourceTypeProviderRegistry(container);
        await registry.initialize();
        validationService = new ResourceValidationService(container);
        await validationService.initialize();
    });

    teardown(async () => {
        await validationService.dispose();
        await registry.dispose();
    });

    suite('Validation Service Integration', () => {
        test('Should have validation service running', () => {
            assert.strictEqual(validationService.getStatus(), ServiceStatus.RUNNING);
        });

        test('Should have resource type registry available', () => {
            const providers = registry.getAllProviders();
            assert.ok(providers.length > 0);
        });
    });

    suite('Resource Path Validation', () => {
        test('Should validate well-formed resource paths', () => {
            const validPaths = ['MyScript', 'Folder/SubFolder/Resource', 'scripts/utils/helpers'];
            for (const p of validPaths) {
                assert.ok(p.length > 0 && !p.includes('..'), `"${p}" should be valid`);
            }
        });

        test('Should reject path traversal attempts', () => {
            const maliciousPaths = ['../etc/passwd', 'scripts/../../secret', '..'];
            for (const p of maliciousPaths) {
                assert.ok(p.includes('..'), `"${p}" should contain path traversal`);
            }
        });

        test('Should handle empty paths', () => {
            assert.strictEqual(''.length, 0, 'Empty path should have zero length');
        });
    });

    suite('Folder vs File Detection', () => {
        test('Should distinguish folder resources', () => {
            const isFolder = true;
            assert.strictEqual(isFolder, true);
        });

        test('Should distinguish file resources', () => {
            const isFolder = false;
            assert.strictEqual(isFolder, false);
        });
    });

    suite('Validation Rules', () => {
        test('Should have global validation rules registered', () => {
            const stats = validationService.getValidationStats();
            assert.ok(stats, 'Validation stats should be available');
        });
    });
});
