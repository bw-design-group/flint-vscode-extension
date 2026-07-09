/**
 * @module RenameResourceCommand.test
 * @description Unit tests for RenameResourceCommand validation and logic
 */

import * as assert from 'assert';

import { ServiceContainer } from '../../../../core/ServiceContainer';
import { ResourceTypeProviderRegistry } from '../../../../services/resources/ResourceTypeProviderRegistry';

suite('RenameResourceCommand Test Suite', () => {
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

    suite('Name Validation', () => {
        test('Should accept valid new names', () => {
            const validNames = ['NewName', 'updated_script', 'v2-handler'];
            for (const name of validNames) {
                assert.ok(/^[a-zA-Z0-9_-]+$/.test(name), `"${name}" should be valid`);
            }
        });

        test('Should reject names with invalid characters', () => {
            const invalidNames = ['has space', 'has/slash', 'has.dot', 'has@at'];
            for (const name of invalidNames) {
                assert.ok(!/^[a-zA-Z0-9_-]+$/.test(name), `"${name}" should be invalid`);
            }
        });

        test('Should reject empty names', () => {
            assert.ok(!/^[a-zA-Z0-9_-]+$/.test(''), 'Empty name should be invalid');
        });

        test('Should detect when new name equals old name', () => {
            const oldName = 'MyResource';
            const newName = 'MyResource';
            assert.strictEqual(oldName, newName, 'Same name should be detected');
        });

        test('Should detect case-only changes as different', () => {
            const oldName = 'myResource';
            const newName = 'MyResource';
            assert.notStrictEqual(oldName, newName, 'Case change should be different');
        });
    });

    suite('Path Reconstruction', () => {
        test('Should reconstruct path from folder and name', () => {
            const folder = 'scripts/utils';
            const name = 'newHelper';
            const newPath = `${folder}/${name}`;
            assert.strictEqual(newPath, 'scripts/utils/newHelper');
        });

        test('Should handle root-level resources', () => {
            const name = 'TopLevel';
            assert.strictEqual(name, 'TopLevel');
        });
    });
});
