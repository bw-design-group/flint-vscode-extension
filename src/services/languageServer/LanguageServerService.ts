/**
 * @module LanguageServerService
 * @description Launches the editor-agnostic `flint-lsp-proxy` as a VS Code language client so
 * Ignition Jython (Python 2.7) scripting gets full, gateway-backed intelligence — completion,
 * hover, go-to-definition, references, diagnostics, and workspace/document symbols — sourced
 * directly from the gateway configured in `flint.config.json`. No Designer is required.
 *
 * The proxy is configured entirely via environment variables.
 * This service derives those variables from the selected gateway/environment and restarts the
 * client whenever the relevant selection or configuration changes.
 */
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

import { ServiceContainer } from '@/core/ServiceContainer';
import { IServiceLifecycle, ServiceStatus } from '@/core/types/services';
import { WorkspaceConfigService } from '@/services/config/WorkspaceConfigService';
import { ScriptFileSystemService } from '@/services/decode/ScriptFileSystemService';
import { EnvironmentService } from '@/services/environments/EnvironmentService';
import { GatewayManagerService } from '@/services/gateways/GatewayManagerService';
import { readApiTokenValue } from '@/utils/gatewayHttpHelper';

const CONFIG_SECTION = 'flint.languageServer';
const DEFAULT_PROXY_COMMAND = 'flint-lsp-proxy';

/**
 * Manages the Flint Jython language client, bridging VS Code to the gateway-hosted
 * language server via the `flint-lsp-proxy` stdio process.
 */
export class LanguageServerService implements IServiceLifecycle {
    private status: ServiceStatus = ServiceStatus.NOT_INITIALIZED;
    private client: LanguageClient | undefined;
    private outputChannel: vscode.OutputChannel | undefined;
    private readonly disposables: vscode.Disposable[] = [];

    private gatewayManager!: GatewayManagerService;
    private configService!: WorkspaceConfigService;
    private environmentService!: EnvironmentService;

    constructor(private readonly serviceContainer: ServiceContainer) {}

    /**
     * Returns whether the Flint language server is enabled via configuration.
     * Used both here and by the extension to decide whether to register the legacy
     * Python completion provider (they are mutually exclusive).
     */
    static isEnabled(): boolean {
        return vscode.workspace.getConfiguration(CONFIG_SECTION).get<boolean>('enabled', true);
    }

    initialize(): Promise<void> {
        this.status = ServiceStatus.INITIALIZING;

        this.gatewayManager = this.serviceContainer.get<GatewayManagerService>('GatewayManagerService');
        this.configService = this.serviceContainer.get<WorkspaceConfigService>('WorkspaceConfigService');
        this.environmentService = this.serviceContainer.get<EnvironmentService>('EnvironmentService');
        this.outputChannel = vscode.window.createOutputChannel('Flint Language Server');

        this.status = ServiceStatus.INITIALIZED;
        return Promise.resolve();
    }

    async start(): Promise<void> {
        this.status = ServiceStatus.STARTING;

        // Restart the client whenever the target gateway/project/environment or config changes,
        // so the language server always points at the currently-selected gateway.
        this.disposables.push(
            this.gatewayManager.onGatewaySelected(() => void this.restart()),
            this.gatewayManager.onProjectSelected(() => void this.restart()),
            this.configService.onConfigChanged(() => void this.restart()),
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration(CONFIG_SECTION)) {
                    void this.restart();
                }
            })
        );

        await this.startClient();
        this.status = ServiceStatus.RUNNING;
    }

    async stop(): Promise<void> {
        this.status = ServiceStatus.STOPPING;
        await this.stopClient();
        this.status = ServiceStatus.STOPPED;
    }

    async dispose(): Promise<void> {
        this.disposables.forEach(d => {
            d.dispose();
        });
        this.disposables.length = 0;
        await this.stopClient();
        this.outputChannel?.dispose();
        this.outputChannel = undefined;
        this.status = ServiceStatus.STOPPED;
    }

    getStatus(): ServiceStatus {
        return this.status;
    }

    /**
     * Stops any running client and starts a fresh one for the current selection.
     */
    async restart(): Promise<void> {
        if (this.status === ServiceStatus.STOPPED || this.status === ServiceStatus.STOPPING) {
            return;
        }
        await this.stopClient();
        await this.startClient();
    }

    private async startClient(): Promise<void> {
        if (!LanguageServerService.isEnabled()) {
            this.log('Flint language server is disabled (flint.languageServer.enabled = false).');
            return;
        }

        const env = await this.buildEnvironment();
        if (!env) {
            // Not enough configuration to connect; stay dormant until the user configures a gateway.
            return;
        }

        const proxyCommand =
            vscode.workspace.getConfiguration(CONFIG_SECTION).get<string>('proxyPath')?.trim() || DEFAULT_PROXY_COMMAND;

        const serverOptions: ServerOptions = {
            command: proxyCommand,
            args: ['--stdio'],
            options: { env: { ...process.env, ...env } }
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { language: 'python', scheme: 'file' },
                { language: 'python', scheme: ScriptFileSystemService.SCHEME }
            ],
            outputChannel: this.outputChannel
        };

        const client = new LanguageClient('flintLanguageServer', 'Flint Language Server', serverOptions, clientOptions);

        try {
            await client.start();
            this.client = client;
            this.log(`Flint language server started (gateway: ${env.FLINT_GATEWAY_URL}).`);
        } catch (error) {
            this.log(
                `Failed to start Flint language server: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async stopClient(): Promise<void> {
        if (!this.client) {
            return;
        }
        try {
            await this.client.stop();
        } catch {
            // Best-effort shutdown; a crashed/never-started client can throw here.
        }
        this.client = undefined;
    }

    /**
     * Derives the `flint-lsp-proxy` environment from the selected gateway and environment.
     * Returns undefined when there is not enough configuration to connect (no gateway selected,
     * gateway not found, or no API token available).
     */
    private async buildEnvironment(): Promise<Record<string, string> | undefined> {
        const gatewayId = this.gatewayManager.getSelectedGateway();
        if (!gatewayId) {
            this.log('No gateway selected; Flint language server is idle.');
            return undefined;
        }

        const gateways = await this.configService.getGateways();
        const gatewayConfig = gateways[gatewayId];
        if (!gatewayConfig) {
            this.log(`Selected gateway '${gatewayId}' was not found in flint.config.json.`);
            return undefined;
        }

        const resolved = this.environmentService.getActiveEnvironmentConfig(gatewayConfig);
        const tokenFilePath = resolved.modules?.['project-scan-endpoint']?.apiTokenFilePath;
        if (!tokenFilePath) {
            this.log(
                `Gateway '${gatewayId}' has no API token configured ` +
                    "(modules['project-scan-endpoint'].apiTokenFilePath); Flint language server is idle."
            );
            return undefined;
        }

        let token: string;
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            token = await readApiTokenValue(tokenFilePath, workspaceRoot);
        } catch (error) {
            this.log(`Failed to read API token: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }

        const env: Record<string, string> = {
            FLINT_GATEWAY_URL: this.environmentService.buildGatewayUrl(gatewayConfig, ''),
            FLINT_GATEWAY_TOKEN: token
        };

        if (resolved.ignoreSSLErrors) {
            env.FLINT_GATEWAY_INSECURE_TLS = 'true';
        }

        // Ignition 8.1 uses a Flint-managed bearer token; 8.3+ uses native platform API tokens.
        // When the version is unknown the proxy auto-infers, so only set it when we can be sure.
        if (resolved.ignitionVersion) {
            env.FLINT_GATEWAY_TOKEN_TYPE = resolved.ignitionVersion.startsWith('8.1') ? 'bearer' : 'native';
        }

        const project = this.gatewayManager.getSelectedProject();
        if (project) {
            env.FLINT_GATEWAY_PROJECT = project;
        }

        return env;
    }

    private log(message: string): void {
        this.outputChannel?.appendLine(message);
    }
}
