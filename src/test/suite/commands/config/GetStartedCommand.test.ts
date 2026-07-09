/**
 * @module GetStartedCommand.test
 * @description Unit tests for GetStartedCommand
 */

import * as assert from 'assert';

import { ServiceContainer } from '../../../../core/ServiceContainer';
import { ServiceStatus } from '../../../../core/types/services';
import { ConfigMigrationService } from '../../../../services/config/ConfigMigrationService';
import { ConfigValidationService } from '../../../../services/config/ConfigValidationService';

suite('GetStartedCommand Test Suite', () => {
    let container: ServiceContainer;
    let validationService: ConfigValidationService;
    let migrationService: ConfigMigrationService;

    setup(async () => {
        container = new ServiceContainer();
        validationService = new ConfigValidationService(container);
        migrationService = new ConfigMigrationService(container);
        await validationService.initialize();
        await migrationService.initialize();
    });

    teardown(async () => {
        await validationService.dispose();
        await migrationService.dispose();
    });

    suite('Dependencies', () => {
        test('Should have ConfigValidationService available', () => {
            assert.strictEqual(validationService.getStatus(), ServiceStatus.RUNNING);
        });

        test('Should have ConfigMigrationService available', () => {
            assert.strictEqual(migrationService.getStatus(), ServiceStatus.RUNNING);
        });

        test('Should create ServiceContainer for command context', () => {
            assert.ok(container);
            assert.strictEqual(typeof container.register, 'function');
            assert.strictEqual(typeof container.get, 'function');
        });
    });

    suite('Configuration Validation for First Run', () => {
        test('Should validate minimal config', async () => {
            const result = await validationService.validateConfiguration({
                schemaVersion: '2.0',
                'project-paths': [],
                gateways: {}
            });
            assert.ok(result);
        });

        test('Should validate config with project-paths', async () => {
            const result = await validationService.validateConfiguration({
                schemaVersion: '2.0',
                'project-paths': ['/some/path'],
                gateways: {}
            });
            assert.ok(result);
        });

        test('Should validate config with gateways and paths', async () => {
            const result = await validationService.validateConfiguration({
                schemaVersion: '2.0',
                'project-paths': ['/test/path'],
                gateways: {
                    'test-gw': {
                        id: 'test-gw',
                        host: 'localhost',
                        port: 8088
                    }
                }
            });
            assert.ok(result);
        });
    });

    suite('Migration Detection for First Run', () => {
        test('Should not require migration for null config', () => {
            const needs = migrationService.needsMigration(null);
            assert.strictEqual(needs, false);
        });

        test('Should detect v0.1 config needing migration', () => {
            const needs = migrationService.needsMigration({
                'config-version': '0.1',
                'project-paths': []
            });
            assert.strictEqual(needs, true);
        });
    });
});
