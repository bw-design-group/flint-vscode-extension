/**
 * @module EnvironmentService.test
 * @description Unit tests for gateway configuration resolution.
 *
 * Covers the "gateway config readers disagree on where connection fields live" bug:
 * resolution must produce one object that satisfies every consumer, for all three
 * config shapes in src/test/helpers/gatewayFixtures.ts.
 */

import * as assert from 'assert';

import { ServiceContainer } from '../../../../core/ServiceContainer';
import { GatewayConfig } from '../../../../core/types/configuration';
import { EnvironmentService } from '../../../../services/environments/EnvironmentService';
import {
    allShapes,
    createStubExtensionContext,
    duplicatedGateway,
    environmentsOnlyGateway,
    languageServerWouldGoIdle,
    legacyGateway,
    TOKEN_PATH
} from '../../../helpers/gatewayFixtures';

function createGateway(data: Record<string, unknown>): GatewayConfig {
    return data as unknown as GatewayConfig;
}

suite('EnvironmentService Test Suite', () => {
    let service: EnvironmentService;

    setup(async () => {
        service = new EnvironmentService(new ServiceContainer(), createStubExtensionContext());
        await service.initialize();
    });

    teardown(async () => {
        await service.dispose();
    });

    // ========================================================================
    // REPRODUCTION SHAPES - every shape must satisfy every consumer
    // ========================================================================

    suite('Reproduction shapes', () => {
        test('Shape A (legacy) resolves an apiTokenFilePath so the LSP does not go idle', () => {
            const resolved = service.resolveEnvironmentConfig(legacyGateway());

            assert.strictEqual(
                resolved.modules['project-scan-endpoint'].apiTokenFilePath,
                TOKEN_PATH,
                'legacy gateway-level apiTokenFilePath must be reachable'
            );
            assert.strictEqual(
                languageServerWouldGoIdle(resolved),
                false,
                'language server must not fall back to offline completion'
            );
        });

        test('Shape B (environments-only) resolves connection details', () => {
            const resolved = service.resolveEnvironmentConfig(environmentsOnlyGateway());

            assert.strictEqual(resolved.environment, 'local');
            assert.strictEqual(resolved.host, 'localhost');
            assert.strictEqual(resolved.port, 8088);
            assert.strictEqual(resolved.ssl, false);
            assert.strictEqual(resolved.modules['project-scan-endpoint'].apiTokenFilePath, TOKEN_PATH);
        });

        test('Shape C (both levels) keeps working', () => {
            const resolved = service.resolveEnvironmentConfig(duplicatedGateway());

            assert.strictEqual(resolved.host, 'localhost');
            assert.strictEqual(resolved.port, 8088);
            assert.strictEqual(resolved.ssl, false);
            assert.strictEqual(resolved.modules['project-scan-endpoint'].enabled, true);
            assert.strictEqual(resolved.modules['project-scan-endpoint'].apiTokenFilePath, TOKEN_PATH);
        });

        test('Every shape resolves enabled and apiTokenFilePath from the same object', () => {
            for (const { name, gateway } of allShapes()) {
                const module = service.resolveEnvironmentConfig(gateway).modules['project-scan-endpoint'];

                assert.strictEqual(module.enabled, true, `${name}: enabled`);
                assert.strictEqual(module.apiTokenFilePath, TOKEN_PATH, `${name}: apiTokenFilePath`);
                assert.strictEqual(module.forceUpdateDesigner, false, `${name}: forceUpdateDesigner default`);
            }
        });

        test('Every shape resolves the same connection endpoint', () => {
            for (const { name, gateway } of allShapes()) {
                const resolved = service.resolveEnvironmentConfig(gateway);

                assert.strictEqual(resolved.host, 'localhost', `${name}: host`);
                assert.strictEqual(resolved.port, 8088, `${name}: port`);
                assert.strictEqual(resolved.ssl, false, `${name}: ssl`);
                assert.deepStrictEqual([...resolved.projects], ['example-project'], `${name}: projects`);
            }
        });
    });

    // ========================================================================
    // PRECEDENCE - environment overrides gateway, gateway acts as default
    // ========================================================================

    suite('Environment / gateway precedence', () => {
        test('Environment values override gateway-level defaults', () => {
            const gateway = createGateway({
                id: 'gw',
                host: 'gateway.example.com',
                port: 8088,
                ssl: false,
                username: 'gateway-user',
                ignoreSSLErrors: false,
                timeoutMs: 10000,
                ignitionVersion: '8.1.44',
                environments: {
                    prod: {
                        host: 'prod.example.com',
                        port: 443,
                        ssl: true,
                        username: 'prod-user',
                        ignoreSSLErrors: true,
                        timeoutMs: 30000,
                        ignitionVersion: '8.3.8'
                    }
                }
            });

            const resolved = service.resolveEnvironmentConfig(gateway, 'prod');

            assert.strictEqual(resolved.host, 'prod.example.com');
            assert.strictEqual(resolved.port, 443);
            assert.strictEqual(resolved.ssl, true);
            assert.strictEqual(resolved.username, 'prod-user');
            assert.strictEqual(resolved.ignoreSSLErrors, true);
            assert.strictEqual(resolved.timeoutMs, 30000);
            assert.strictEqual(resolved.ignitionVersion, '8.3.8');
        });

        test('Gateway-level values are inherited when the environment omits them', () => {
            const gateway = createGateway({
                id: 'gw',
                host: 'gateway.example.com',
                port: 9088,
                ssl: false,
                username: 'gateway-user',
                ignoreSSLErrors: true,
                timeoutMs: 25000,
                ignitionVersion: '8.1.44',
                environments: {
                    // Overrides nothing but ssl; everything else falls back to gateway level
                    local: { ssl: true }
                }
            });

            const resolved = service.resolveEnvironmentConfig(gateway, 'local');

            assert.strictEqual(resolved.host, 'gateway.example.com', 'host inherited');
            assert.strictEqual(resolved.port, 9088, 'port inherited');
            assert.strictEqual(resolved.ssl, true, 'ssl overridden');
            assert.strictEqual(resolved.username, 'gateway-user');
            assert.strictEqual(resolved.ignoreSSLErrors, true);
            assert.strictEqual(resolved.timeoutMs, 25000);
            assert.strictEqual(resolved.ignitionVersion, '8.1.44');
        });

        test('Environment module settings override gateway module settings', () => {
            const gateway = createGateway({
                id: 'gw',
                host: 'localhost',
                modules: {
                    'project-scan-endpoint': {
                        enabled: true,
                        apiTokenFilePath: '/tokens/shared',
                        forceUpdateDesigner: true
                    }
                },
                environments: {
                    local: {},
                    staging: {
                        modules: {
                            'project-scan-endpoint': {
                                enabled: false,
                                apiTokenFilePath: '/tokens/staging',
                                forceUpdateDesigner: false
                            }
                        }
                    }
                }
            });

            const local = service.resolveEnvironmentConfig(gateway, 'local').modules['project-scan-endpoint'];
            assert.strictEqual(local.enabled, true, 'gateway default inherited');
            assert.strictEqual(local.apiTokenFilePath, '/tokens/shared');
            assert.strictEqual(local.forceUpdateDesigner, true);

            const staging = service.resolveEnvironmentConfig(gateway, 'staging').modules['project-scan-endpoint'];
            assert.strictEqual(staging.enabled, false, 'environment override wins');
            assert.strictEqual(staging.apiTokenFilePath, '/tokens/staging');
            assert.strictEqual(staging.forceUpdateDesigner, false);
        });

        test('An environment-level apiTokenFilePath applies even when enabled is gateway-level', () => {
            // This is shape C's split, which must still resolve from one place.
            const module = service.resolveEnvironmentConfig(duplicatedGateway()).modules['project-scan-endpoint'];

            assert.strictEqual(module.enabled, true);
            assert.strictEqual(module.apiTokenFilePath, TOKEN_PATH);
        });
    });

    // ========================================================================
    // DEFAULTS AND SELECTION
    // ========================================================================

    suite('Defaults and environment selection', () => {
        test('Applies documented defaults when nothing is configured', () => {
            const resolved = service.resolveEnvironmentConfig(createGateway({ id: 'gw', host: 'localhost' }));

            assert.strictEqual(resolved.environment, 'default');
            assert.strictEqual(resolved.port, 8088);
            assert.strictEqual(resolved.ssl, true);
            assert.strictEqual(resolved.ignoreSSLErrors, false);
            assert.strictEqual(resolved.timeoutMs, 10000);
            assert.deepStrictEqual([...resolved.projects], []);
            assert.strictEqual(resolved.modules['project-scan-endpoint'].enabled, false);
            assert.strictEqual(resolved.modules['project-scan-endpoint'].apiTokenFilePath, undefined);
        });

        test('Uses defaultEnvironment when no environment is requested', () => {
            const gateway = createGateway({
                id: 'gw',
                defaultEnvironment: 'staging',
                environments: {
                    local: { host: 'localhost' },
                    staging: { host: 'staging.example.com' }
                }
            });

            assert.strictEqual(service.resolveEnvironmentConfig(gateway).environment, 'staging');
            assert.strictEqual(service.resolveEnvironmentConfig(gateway).host, 'staging.example.com');
        });

        test('Falls back to the first environment when there is no defaultEnvironment', () => {
            const gateway = createGateway({
                id: 'gw',
                environments: {
                    local: { host: 'localhost' },
                    staging: { host: 'staging.example.com' }
                }
            });

            assert.strictEqual(service.resolveEnvironmentConfig(gateway).environment, 'local');
        });

        test('Strips a protocol prefix from the host', () => {
            const gateway = createGateway({ id: 'gw', host: 'https://gateway.example.com' });
            assert.strictEqual(service.resolveEnvironmentConfig(gateway).host, 'gateway.example.com');
        });

        test('Reports the gateway id on the resolved config', () => {
            assert.strictEqual(service.resolveEnvironmentConfig(legacyGateway()).gatewayId, 'example-gateway');
        });

        test('Flags ssl as not explicitly declared when it is absent at both levels', () => {
            const resolved = service.resolveEnvironmentConfig(createGateway({ id: 'gw', host: 'localhost' }));

            assert.strictEqual(resolved.ssl, true, 'connections still default to HTTPS');
            assert.strictEqual(resolved.sslExplicit, false, 'but nothing was actually declared');
        });

        test('Flags ssl as explicit when declared at gateway level', () => {
            const resolved = service.resolveEnvironmentConfig(
                createGateway({ id: 'gw', host: 'localhost', ssl: false })
            );

            assert.strictEqual(resolved.ssl, false);
            assert.strictEqual(resolved.sslExplicit, true);
        });

        test('Flags ssl as explicit when declared only on the environment', () => {
            const gateway = createGateway({ id: 'gw', host: 'localhost', environments: { local: { ssl: false } } });
            const resolved = service.resolveEnvironmentConfig(gateway, 'local');

            assert.strictEqual(resolved.ssl, false);
            assert.strictEqual(resolved.sslExplicit, true);
        });

        test('An environment inherits an explicitly declared gateway-level ssl', () => {
            const gateway = createGateway({ id: 'gw', host: 'localhost', ssl: true, environments: { local: {} } });
            const resolved = service.resolveEnvironmentConfig(gateway, 'local');

            assert.strictEqual(resolved.sslExplicit, true);
        });
    });

    // ========================================================================
    // RESOLVING ALL ENVIRONMENTS
    // ========================================================================

    suite('resolveAllEnvironmentConfigs', () => {
        test('Returns one entry per environment', () => {
            const gateway = createGateway({
                id: 'gw',
                environments: {
                    local: { host: 'localhost', port: 8088, ssl: false },
                    prod: { host: 'prod.example.com', port: 443, ssl: true }
                }
            });

            const resolved = service.resolveAllEnvironmentConfigs(gateway);

            assert.strictEqual(resolved.length, 2);
            assert.deepStrictEqual(
                resolved.map(r => r.environment),
                ['local', 'prod']
            );
            assert.strictEqual(resolved[1].port, 443);
        });

        test('Returns a single default entry for a legacy gateway', () => {
            const resolved = service.resolveAllEnvironmentConfigs(legacyGateway());

            assert.strictEqual(resolved.length, 1);
            assert.strictEqual(resolved[0].environment, 'default');
        });

        test('Skips unresolvable environments instead of throwing', () => {
            const gateway = createGateway({
                id: 'gw',
                environments: {
                    broken: { port: 8088 }, // no host at either level
                    good: { host: 'localhost' }
                }
            });

            const resolved = service.resolveAllEnvironmentConfigs(gateway);

            assert.strictEqual(resolved.length, 1);
            assert.strictEqual(resolved[0].environment, 'good');
        });
    });

    // ========================================================================
    // ERRORS
    // ========================================================================

    suite('Error handling', () => {
        test('Throws when no host is configured at either level', () => {
            assert.throws(
                () => service.resolveEnvironmentConfig(createGateway({ id: 'gw' })),
                /No host configured for gateway 'gw'/
            );
        });

        test('Throws when an environment has no host and the gateway has none either', () => {
            const gateway = createGateway({ id: 'gw', environments: { local: { port: 8088 } } });

            assert.throws(
                () => service.resolveEnvironmentConfig(gateway, 'local'),
                /No host configured for gateway 'gw' environment 'local'/
            );
        });

        test('Throws when the requested environment does not exist', () => {
            const gateway = createGateway({ id: 'gw', environments: { local: { host: 'localhost' } } });

            assert.throws(
                () => service.resolveEnvironmentConfig(gateway, 'nope'),
                /Environment 'nope' not found for gateway 'gw'/
            );
        });
    });

    // ========================================================================
    // URL BUILDING
    // ========================================================================

    suite('URL building', () => {
        test('Includes a non-default port', () => {
            const resolved = service.resolveEnvironmentConfig(legacyGateway());
            assert.strictEqual(EnvironmentService.buildUrl(resolved), 'http://localhost:8088');
        });

        test('Omits the port when it is the protocol default', () => {
            const gateway = createGateway({ id: 'gw', host: 'gateway.example.com', port: 443, ssl: true });
            const resolved = service.resolveEnvironmentConfig(gateway);

            assert.strictEqual(EnvironmentService.buildUrl(resolved, '/path'), 'https://gateway.example.com/path');
        });
    });
});
