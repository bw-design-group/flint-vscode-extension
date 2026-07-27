/**
 * @module EnvironmentService
 * @description Service for managing environment selection and persistence
 * Stores environment selections locally (not in workspace config) for per-machine preferences
 */

import * as vscode from 'vscode';

import { FlintError } from '@/core/errors';
import { ServiceContainer } from '@/core/ServiceContainer';
import { GatewayConfig, GatewayEnvironmentConfig } from '@/core/types/configuration';
import { ResolvedModules } from '@/core/types/modules';
import { IServiceLifecycle, ServiceStatus } from '@/core/types/services';

/**
 * Environment selection data stored locally
 */
interface EnvironmentSelection {
    /** Map of gatewayId to selected environment name */
    selectedEnvironments: Record<string, string>;
    /** Last updated timestamp */
    lastUpdated: string;
}

/**
 * Fully resolved gateway configuration for a single environment.
 *
 * This is the single object every consumer (LSP connection, Designer matcher, scan
 * endpoint, status bar, quick picks) reads from. Values are merged as
 * `environment ?? gateway ?? default`, so no consumer should reach back into the raw
 * {@link GatewayConfig} for a connection or module field.
 */
export interface ResolvedEnvironmentConfig {
    /** Gateway id this configuration was resolved from */
    readonly gatewayId: string;
    /** Environment name */
    readonly environment: string;
    /** Gateway hostname or IP address */
    readonly host: string;
    /** Gateway port number */
    readonly port: number;
    /** Whether to use SSL/HTTPS */
    readonly ssl: boolean;
    /**
     * Whether `ssl` was actually declared at either level, as opposed to falling back to
     * the default. Connecting always uses {@link ssl}; Designer matching uses this to avoid
     * failing on a value the user never configured. See DesignerGatewayMatcher.
     */
    readonly sslExplicit: boolean;
    /** Username for authentication */
    readonly username?: string;
    /** Whether to ignore SSL certificate errors */
    readonly ignoreSSLErrors: boolean;
    /** Connection timeout in milliseconds */
    readonly timeoutMs: number;
    /** Ignition version for this environment */
    readonly ignitionVersion?: string;
    /** Projects available on this gateway */
    readonly projects: readonly string[];
    /** Module configurations (merged from gateway and environment) */
    readonly modules: ResolvedModules;
}

/**
 * Service for managing gateway environment selection
 * Handles both legacy single-environment and new multi-environment configurations
 */
export class EnvironmentService implements IServiceLifecycle {
    private static readonly STORAGE_KEY = 'flint.selectedEnvironments';
    private static readonly DEFAULT_ENVIRONMENT = 'default';

    private serviceContainer: ServiceContainer;
    private context: vscode.ExtensionContext;
    private isInitialized = false;
    private _onEnvironmentChanged = new vscode.EventEmitter<{
        gatewayId: string;
        environment: string;
        config: ResolvedEnvironmentConfig;
    }>();
    readonly onEnvironmentChanged = this._onEnvironmentChanged.event;

    constructor(serviceContainer: ServiceContainer, context: vscode.ExtensionContext) {
        this.serviceContainer = serviceContainer;
        this.context = context;
    }

    async initialize(): Promise<void> {
        try {
            // Initialize storage if it doesn't exist
            const stored = this.context.globalState.get<EnvironmentSelection>(EnvironmentService.STORAGE_KEY);
            if (!stored) {
                await this.context.globalState.update(EnvironmentService.STORAGE_KEY, {
                    selectedEnvironments: {},
                    lastUpdated: new Date().toISOString()
                });
            }

            this.isInitialized = true;
        } catch (error) {
            throw new FlintError(
                'Failed to initialize environment service',
                'ENVIRONMENT_SERVICE_INIT_FAILED',
                'Environment service could not start properly',
                error instanceof Error ? error : undefined
            );
        }
    }

    async start(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    async stop(): Promise<void> {
        // Nothing to stop
    }

    dispose(): Promise<void> {
        this._onEnvironmentChanged.dispose();
        return Promise.resolve();
    }

    getStatus(): ServiceStatus {
        return this.isInitialized ? ServiceStatus.RUNNING : ServiceStatus.STOPPED;
    }

    /**
     * Gets the selected environment for a gateway
     */
    getSelectedEnvironment(gatewayId: string): string | undefined {
        const stored = this.context.globalState.get<EnvironmentSelection>(EnvironmentService.STORAGE_KEY);
        return stored?.selectedEnvironments[gatewayId];
    }

    /**
     * Sets the selected environment for a gateway
     */
    async setSelectedEnvironment(gatewayId: string, environment: string): Promise<void> {
        const stored = this.context.globalState.get<EnvironmentSelection>(EnvironmentService.STORAGE_KEY) ?? {
            selectedEnvironments: {},
            lastUpdated: new Date().toISOString()
        };

        const updated: EnvironmentSelection = {
            selectedEnvironments: {
                ...stored.selectedEnvironments,
                [gatewayId]: environment
            },
            lastUpdated: new Date().toISOString()
        };

        await this.context.globalState.update(EnvironmentService.STORAGE_KEY, updated);
        console.log(`Environment service: Selected environment '${environment}' for gateway '${gatewayId}'`);

        // Emit environment changed event
        try {
            const configService = this.serviceContainer.get<any>('WorkspaceConfigService');
            if (configService) {
                const gateways = await configService.getGateways();
                const gatewayConfig = gateways[gatewayId];
                if (gatewayConfig) {
                    const envConfig = this.resolveEnvironmentConfig(gatewayConfig, environment);
                    this._onEnvironmentChanged.fire({ gatewayId, environment, config: envConfig });
                }
            }
        } catch (error) {
            console.warn('Failed to emit environment changed event:', error);
        }
    }

    /**
     * Gets all selected environments
     */
    getAllSelectedEnvironments(): Record<string, string> {
        const stored = this.context.globalState.get<EnvironmentSelection>(EnvironmentService.STORAGE_KEY);
        return stored?.selectedEnvironments ?? {};
    }

    /**
     * Clears the selected environment for a gateway
     */
    async clearSelectedEnvironment(gatewayId: string): Promise<void> {
        const stored = this.context.globalState.get<EnvironmentSelection>(EnvironmentService.STORAGE_KEY);
        if (!stored) return;

        const updated: EnvironmentSelection = {
            selectedEnvironments: { ...stored.selectedEnvironments },
            lastUpdated: new Date().toISOString()
        };

        delete updated.selectedEnvironments[gatewayId];

        await this.context.globalState.update(EnvironmentService.STORAGE_KEY, updated);
        console.log(`Environment service: Cleared selected environment for gateway '${gatewayId}'`);
    }

    /**
     * Gets available environments for a gateway
     */
    getAvailableEnvironments(gatewayConfig: GatewayConfig): string[] {
        if (gatewayConfig.environments) {
            return Object.keys(gatewayConfig.environments);
        }

        // Legacy single-environment format
        return [EnvironmentService.DEFAULT_ENVIRONMENT];
    }

    /**
     * Resolves the actual environment configuration for a gateway
     * Handles both legacy and multi-environment formats
     */
    resolveEnvironmentConfig(gatewayConfig: GatewayConfig, environmentName?: string): ResolvedEnvironmentConfig {
        if (!gatewayConfig.environments) {
            // Legacy single-environment format: gateway-level values are the only source.
            return this.mergeConfig(gatewayConfig, EnvironmentService.DEFAULT_ENVIRONMENT);
        }

        const envName =
            environmentName ?? gatewayConfig.defaultEnvironment ?? Object.keys(gatewayConfig.environments)[0];
        const envConfig = gatewayConfig.environments[envName];

        if (!envConfig) {
            throw new FlintError(
                `Environment '${envName}' not found for gateway '${gatewayConfig.id}'`,
                'ENVIRONMENT_NOT_FOUND'
            );
        }

        return this.mergeConfig(gatewayConfig, envName, envConfig);
    }

    /**
     * Resolves every configured environment for a gateway.
     *
     * Environments that cannot be resolved (for example, no host at either level) are
     * skipped rather than throwing, so one broken environment does not hide the others.
     * A legacy gateway yields a single entry for the `default` environment.
     */
    resolveAllEnvironmentConfigs(gatewayConfig: GatewayConfig): ResolvedEnvironmentConfig[] {
        const resolved: ResolvedEnvironmentConfig[] = [];

        for (const envName of this.getAvailableEnvironments(gatewayConfig)) {
            try {
                resolved.push(this.resolveEnvironmentConfig(gatewayConfig, envName));
            } catch {
                // Skip environments that are not resolvable; other environments may still match.
            }
        }

        return resolved;
    }

    /**
     * Merges gateway-level defaults with environment-level overrides into the single
     * object all consumers read from.
     *
     * @param envConfig The environment being resolved, or undefined for a legacy gateway
     */
    private mergeConfig(
        gatewayConfig: GatewayConfig,
        environment: string,
        envConfig?: GatewayEnvironmentConfig
    ): ResolvedEnvironmentConfig {
        const host = envConfig?.host ?? gatewayConfig.host;
        if (!host) {
            throw new FlintError(
                `No host configured for gateway '${gatewayConfig.id}'${
                    envConfig ? ` environment '${environment}'` : ''
                }`,
                'GATEWAY_HOST_NOT_CONFIGURED'
            );
        }

        return {
            gatewayId: gatewayConfig.id,
            environment,
            host: this.normalizeHost(host),
            ...this.mergeConnectionSettings(gatewayConfig, envConfig),
            projects: gatewayConfig.projects ?? [],
            modules: this.buildResolvedModules(gatewayConfig, envConfig)
        };
    }

    /**
     * Merges the connection settings other than host, applying the documented defaults
     */
    private mergeConnectionSettings(
        gatewayConfig: GatewayConfig,
        envConfig?: GatewayEnvironmentConfig
    ): Pick<
        ResolvedEnvironmentConfig,
        'port' | 'ssl' | 'sslExplicit' | 'username' | 'ignoreSSLErrors' | 'timeoutMs' | 'ignitionVersion'
    > {
        const declaredSsl = envConfig?.ssl ?? gatewayConfig.ssl;

        return {
            port: envConfig?.port ?? gatewayConfig.port ?? 8088,
            ssl: declaredSsl ?? true,
            sslExplicit: declaredSsl !== undefined,
            username: envConfig?.username ?? gatewayConfig.username,
            ignoreSSLErrors: envConfig?.ignoreSSLErrors ?? gatewayConfig.ignoreSSLErrors ?? false,
            timeoutMs: envConfig?.timeoutMs ?? gatewayConfig.timeoutMs ?? 10000,
            ignitionVersion: envConfig?.ignitionVersion ?? gatewayConfig.ignitionVersion
        };
    }

    /**
     * Normalizes a host string by stripping any protocol prefix
     * This allows users to specify hosts like "https://example.com" or "example.com"
     */
    private normalizeHost(host: string): string {
        return host.replace(/^https?:\/\//, '');
    }

    /**
     * Builds resolved modules by merging gateway and environment configurations.
     * Every field uses the same `environment ?? gateway ?? default` precedence, so
     * `enabled` and `apiTokenFilePath` can be declared at whichever level suits the user.
     *
     * Note: Module names are defined in the type system (see modules.ts)
     * To add new modules, update modules.ts types and extend this method
     */
    private buildResolvedModules(gatewayConfig: GatewayConfig, envConfig?: GatewayEnvironmentConfig): ResolvedModules {
        const gatewayModule = gatewayConfig.modules?.['project-scan-endpoint'];
        const envModule = envConfig?.modules?.['project-scan-endpoint'];

        return {
            'project-scan-endpoint': {
                enabled: envModule?.enabled ?? gatewayModule?.enabled ?? false,
                apiTokenFilePath: envModule?.apiTokenFilePath ?? gatewayModule?.apiTokenFilePath,
                forceUpdateDesigner: envModule?.forceUpdateDesigner ?? gatewayModule?.forceUpdateDesigner ?? false
            }
        };
    }

    /**
     * Gets the currently active environment configuration for a gateway
     * Uses the stored selection or falls back to default
     */
    getActiveEnvironmentConfig(gatewayConfig: GatewayConfig): ResolvedEnvironmentConfig {
        const selectedEnv = this.getSelectedEnvironment(gatewayConfig.id);
        return this.resolveEnvironmentConfig(gatewayConfig, selectedEnv);
    }

    /**
     * Builds the gateway URL for the active environment
     */
    buildGatewayUrl(gatewayConfig: GatewayConfig, path: string = ''): string {
        return EnvironmentService.buildUrl(this.getActiveEnvironmentConfig(gatewayConfig), path);
    }

    /**
     * Builds a gateway URL from an already-resolved configuration.
     * Prefer this when the caller has resolved the config, so the URL and the rest of the
     * connection details come from the same resolution.
     */
    static buildUrl(envConfig: ResolvedEnvironmentConfig, path: string = ''): string {
        const protocol = envConfig.ssl ? 'https' : 'http';
        const portSuffix = envConfig.port !== (envConfig.ssl ? 443 : 80) ? `:${envConfig.port}` : '';
        return `${protocol}://${envConfig.host}${portSuffix}${path}`;
    }
}
