/**
 * @module gatewayFixtures
 * @description Shared fixtures for gateway configuration resolution tests.
 *
 * The three gateway shapes below are the reproduction from the "gateway config readers
 * disagree on where connection fields live" bug report. Each one must satisfy *both*
 * consumers: the resolved config the language server reads, and the Designer matcher.
 *
 *   A. Legacy      - connection + module settings at gateway level, no environments
 *   B. Environment - connection + module settings inside environments.local only
 *   C. Both        - connection details at both levels, enabled at gateway level and
 *                    apiTokenFilePath in the environment (the only shape that used to work)
 */

import * as vscode from 'vscode';

import { GatewayConfig } from '../../core/types/configuration';
import { DesignerInstance } from '../../services/designer/DesignerDiscoveryService';
import { ResolvedEnvironmentConfig } from '../../services/environments/EnvironmentService';

/** The Designer used throughout: localhost:8088, non-SSL, project 'example-project'. */
export const DESIGNER_HOST = 'localhost';
export const DESIGNER_PORT = 8088;
export const DESIGNER_PROJECT = 'example-project';

/** Token path shared by every shape, so assertions can compare against one value. */
export const TOKEN_PATH = '/tokens/example-gateway-token';

/**
 * Shape A - legacy: host and modules['project-scan-endpoint'] at gateway level, no environments.
 * Regression target: apiTokenFilePath used to be unreachable here, silently idling the LSP.
 */
export function legacyGateway(): GatewayConfig {
    return {
        id: 'example-gateway',
        host: DESIGNER_HOST,
        port: DESIGNER_PORT,
        ssl: false,
        projects: [DESIGNER_PROJECT],
        modules: {
            'project-scan-endpoint': {
                enabled: true,
                apiTokenFilePath: TOKEN_PATH
            }
        }
    };
}

/**
 * Shape B - environments only: every connection and module field lives in environments.local.
 * Regression target: the Designer matcher used to report "no host configured" here.
 */
export function environmentsOnlyGateway(): GatewayConfig {
    return {
        id: 'example-gateway',
        projects: [DESIGNER_PROJECT],
        environments: {
            local: {
                host: DESIGNER_HOST,
                port: DESIGNER_PORT,
                ssl: false,
                modules: {
                    'project-scan-endpoint': {
                        enabled: true,
                        apiTokenFilePath: TOKEN_PATH
                    }
                }
            }
        }
    };
}

/**
 * Shape C - both levels, with `enabled` at gateway level and `apiTokenFilePath` in the
 * environment. This is the shape existing users were forced into; it must keep working.
 */
export function duplicatedGateway(): GatewayConfig {
    return {
        id: 'example-gateway',
        host: DESIGNER_HOST,
        port: DESIGNER_PORT,
        ssl: false,
        enabled: true,
        projects: [DESIGNER_PROJECT],
        modules: {
            'project-scan-endpoint': {
                enabled: true
            }
        },
        environments: {
            local: {
                host: DESIGNER_HOST,
                port: DESIGNER_PORT,
                ssl: false,
                modules: {
                    'project-scan-endpoint': {
                        apiTokenFilePath: TOKEN_PATH
                    }
                }
            }
        }
    };
}

/** All three reproduction shapes, for table-driven tests. */
export function allShapes(): Array<{ name: string; gateway: GatewayConfig }> {
    return [
        { name: 'A. legacy', gateway: legacyGateway() },
        { name: 'B. environments-only', gateway: environmentsOnlyGateway() },
        { name: 'C. both levels', gateway: duplicatedGateway() }
    ];
}

/**
 * Builds a DesignerInstance reporting the given gateway endpoint.
 * Only the fields the matcher reads are meaningful; the rest are filler.
 */
export function createDesigner(
    overrides: {
        host?: string;
        port?: number;
        ssl?: boolean;
        project?: string;
    } = {}
): DesignerInstance {
    return {
        pid: 4242,
        port: 8000,
        startTime: '2026-01-01T00:00:00Z',
        gateway: {
            host: overrides.host ?? DESIGNER_HOST,
            port: overrides.port ?? DESIGNER_PORT,
            ssl: overrides.ssl ?? false,
            name: 'Ignition-Gateway'
        },
        project: {
            name: overrides.project ?? DESIGNER_PROJECT,
            title: overrides.project ?? DESIGNER_PROJECT
        },
        user: { username: 'admin' },
        designerVersion: '8.3.8',
        moduleVersion: '1.0.0',
        capabilities: { scriptExecution: true, gatewayScope: true },
        secret: 'secret',
        registryFilePath: '/tmp/designer-4242.json'
    };
}

/**
 * Mirrors the guard in `LanguageServerService.resolveConnection()`: the language server
 * logs "no API token configured" and goes idle when the resolved project-scan-endpoint
 * module has no apiTokenFilePath. Keep in sync with
 * src/services/languageServer/LanguageServerService.ts.
 */
export function languageServerWouldGoIdle(resolved: ResolvedEnvironmentConfig): boolean {
    return !resolved.modules['project-scan-endpoint'].apiTokenFilePath;
}

/**
 * Minimal ExtensionContext stub backed by an in-memory map, sufficient for
 * EnvironmentService's globalState-based environment selection storage.
 */
export function createStubExtensionContext(): vscode.ExtensionContext {
    const store = new Map<string, unknown>();
    return {
        globalState: {
            get: (key: string): unknown => store.get(key),
            update: (key: string, value: unknown): Promise<void> => {
                store.set(key, value);
                return Promise.resolve();
            },
            keys: (): readonly string[] => Array.from(store.keys()),
            setKeysForSync: (): void => undefined
        }
    } as unknown as vscode.ExtensionContext;
}
