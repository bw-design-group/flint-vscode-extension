/**
 * @module DesignerGatewayMatcher.test
 * @description Unit tests for matching Designer instances to configured gateways.
 *
 * The matcher must read the same resolved configuration the rest of the extension
 * connects with, so all three reproduction config shapes match the same Designer.
 */

import * as assert from 'assert';

import { ServiceContainer } from '../../../../core/ServiceContainer';
import { GatewayConfig } from '../../../../core/types/configuration';
import { DesignerGatewayMatcher } from '../../../../services/designer/DesignerGatewayMatcher';
import { EnvironmentService } from '../../../../services/environments/EnvironmentService';
import {
    allShapes,
    createDesigner,
    createStubExtensionContext,
    duplicatedGateway,
    environmentsOnlyGateway,
    legacyGateway
} from '../../../helpers/gatewayFixtures';

function createGateway(data: Record<string, unknown>): GatewayConfig {
    return data as unknown as GatewayConfig;
}

/**
 * Builds a matcher wired to a fixed set of gateways.
 */
async function createMatcher(gateways: Record<string, GatewayConfig>): Promise<DesignerGatewayMatcher> {
    const container = new ServiceContainer();
    const environmentService = new EnvironmentService(container, createStubExtensionContext());
    await environmentService.initialize();

    container.register('WorkspaceConfigService', {
        getGateways: (): Promise<Record<string, GatewayConfig>> => Promise.resolve(gateways)
    });
    container.register('EnvironmentService', environmentService);

    const matcher = new DesignerGatewayMatcher(container);
    await matcher.initialize();
    return matcher;
}

suite('DesignerGatewayMatcher Test Suite', () => {
    // ========================================================================
    // REPRODUCTION SHAPES
    // ========================================================================

    suite('Reproduction shapes', () => {
        test('Every config shape matches the same Designer', async () => {
            for (const { name, gateway } of allShapes()) {
                const matcher = await createMatcher({ 'example-gateway': gateway });
                const match = await matcher.matchDesignerToGateway(createDesigner());

                assert.strictEqual(match.isExactMatch, true, `${name}: isExactMatch`);
                assert.strictEqual(match.projectMatched, true, `${name}: projectMatched`);
                assert.strictEqual(match.gatewayId, 'example-gateway', `${name}: gatewayId`);
                assert.strictEqual(match.mismatchReason, null, `${name}: mismatchReason`);
            }
        });

        test('Shape B (environments-only) no longer reports "no host configured"', async () => {
            const matcher = await createMatcher({ 'example-gateway': environmentsOnlyGateway() });

            const match = await matcher.matchDesignerToGateway(createDesigner());

            assert.strictEqual(match.isExactMatch, true);
            assert.strictEqual(match.environment, 'local');
            assert.ok(
                match.mismatchReason === null || !/no host configured/i.test(match.mismatchReason),
                `unexpected mismatch reason: ${match.mismatchReason}`
            );
        });

        test('Shape A (legacy) reports the default environment', async () => {
            const matcher = await createMatcher({ 'example-gateway': legacyGateway() });

            const match = await matcher.matchDesignerToGateway(createDesigner());

            assert.strictEqual(match.isExactMatch, true);
            assert.strictEqual(match.environment, 'default');
        });

        test('Shape C (both levels) still matches', async () => {
            const matcher = await createMatcher({ 'example-gateway': duplicatedGateway() });

            const match = await matcher.matchDesignerToGateway(createDesigner());

            assert.strictEqual(match.isExactMatch, true);
            assert.strictEqual(match.gatewayId, 'example-gateway');
        });
    });

    // ========================================================================
    // MATCHING ACROSS ENVIRONMENTS
    // ========================================================================

    suite('Matching across environments', () => {
        test('Matches an environment that is not the selected one', async () => {
            // 'local' is the default environment, but the Designer is on staging.
            const gateway = createGateway({
                id: 'gw',
                defaultEnvironment: 'local',
                projects: ['example-project'],
                environments: {
                    local: { host: 'localhost', port: 8088, ssl: false },
                    staging: { host: 'staging.example.com', port: 443, ssl: true }
                }
            });
            const matcher = await createMatcher({ gw: gateway });

            const match = await matcher.matchDesignerToGateway(
                createDesigner({ host: 'staging.example.com', port: 443, ssl: true })
            );

            assert.strictEqual(match.isExactMatch, true);
            assert.strictEqual(match.environment, 'staging');
            assert.strictEqual(match.gatewayId, 'gw');
        });

        test('Matches an environment that inherits the gateway-level host', async () => {
            const gateway = createGateway({
                id: 'gw',
                host: 'localhost',
                port: 8088,
                ssl: false,
                projects: ['example-project'],
                environments: {
                    // Inherits host/port/ssl entirely from gateway level
                    local: {}
                }
            });
            const matcher = await createMatcher({ gw: gateway });

            const match = await matcher.matchDesignerToGateway(createDesigner());

            assert.strictEqual(match.isExactMatch, true);
            assert.strictEqual(match.environment, 'local');
        });

        test('Picks the matching gateway among several', async () => {
            const matcher = await createMatcher({
                other: createGateway({ id: 'other', host: 'other.example.com', port: 8088, ssl: false }),
                'example-gateway': legacyGateway()
            });

            const match = await matcher.matchDesignerToGateway(createDesigner());

            assert.strictEqual(match.gatewayId, 'example-gateway');
        });
    });

    // ========================================================================
    // MISMATCHES
    // ========================================================================

    suite('Mismatches', () => {
        test('Reports a host mismatch', async () => {
            const matcher = await createMatcher({ 'example-gateway': legacyGateway() });

            const match = await matcher.matchDesignerToGateway(createDesigner({ host: 'elsewhere.example.com' }));

            assert.strictEqual(match.isExactMatch, false);
            assert.strictEqual(match.gatewayId, null);
            assert.match(match.mismatchReason ?? '', /host mismatch/);
        });

        test('Reports a port mismatch with the resolved port, not undefined', async () => {
            const matcher = await createMatcher({ 'example-gateway': environmentsOnlyGateway() });

            const match = await matcher.matchDesignerToGateway(createDesigner({ port: 9999 }));

            assert.strictEqual(match.isExactMatch, false);
            assert.match(match.mismatchReason ?? '', /port mismatch/);
            assert.ok(
                !/undefined/.test(match.mismatchReason ?? ''),
                `mismatch reason leaked undefined: ${match.mismatchReason}`
            );
        });

        test('Treats localhost and 127.0.0.1 as equivalent', async () => {
            const matcher = await createMatcher({ 'example-gateway': legacyGateway() });

            const match = await matcher.matchDesignerToGateway(createDesigner({ host: '127.0.0.1' }));

            assert.strictEqual(match.isExactMatch, true);
        });

        test('Flags a project that is not in the gateway project list', async () => {
            const matcher = await createMatcher({ 'example-gateway': legacyGateway() });

            const match = await matcher.matchDesignerToGateway(createDesigner({ project: 'unlisted-project' }));

            assert.strictEqual(match.isExactMatch, true);
            assert.strictEqual(match.projectMatched, false);
            assert.match(match.mismatchReason ?? '', /not in gateway's project list/);
        });

        test('Matches any project when no project list is configured', async () => {
            const gateway = createGateway({ id: 'gw', host: 'localhost', port: 8088, ssl: false });
            const matcher = await createMatcher({ gw: gateway });

            const match = await matcher.matchDesignerToGateway(createDesigner({ project: 'anything' }));

            assert.strictEqual(match.projectMatched, true);
        });

        test('Reports no resolvable host when every gateway is unconfigured', async () => {
            const matcher = await createMatcher({ gw: createGateway({ id: 'gw', projects: ['example-project'] }) });

            const match = await matcher.matchDesignerToGateway(createDesigner());

            assert.strictEqual(match.isExactMatch, false);
            assert.match(match.mismatchReason ?? '', /no configured gateway has a resolvable host/i);
        });
    });
});
