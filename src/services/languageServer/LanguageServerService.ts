/**
 * @module LanguageServerService
 * @description Connects VS Code to the gateway-hosted Flint language server so Ignition Jython
 * (Python 2.7) scripting gets full, gateway-backed intelligence — completion, hover, go-to-definition,
 * references, diagnostics, and workspace/document symbols — sourced directly from the gateway
 * configured in `flint.config.json`. No Designer is required.
 *
 * The gateway module (Flint Designer Bridge v1.2.0+) speaks raw LSP over a WebSocket at
 * `/system/flint-lsp`; this service connects to it directly — no local proxy process. It discovers
 * WebSocket support via `/data/flint/health`, derives auth headers from the selected
 * gateway/environment, and restarts the client whenever the relevant selection or configuration
 * changes.
 */
import * as vscode from 'vscode';
import {
    CloseAction,
    ErrorAction,
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    type CloseHandlerResult,
    type ErrorHandler,
    type ErrorHandlerResult,
    type Message
} from 'vscode-languageclient/node';

import { ServiceContainer } from '@/core/ServiceContainer';
import { IServiceLifecycle, ServiceStatus } from '@/core/types/services';
import { WorkspaceConfigService } from '@/services/config/WorkspaceConfigService';
import { ScriptFileSystemService } from '@/services/decode/ScriptFileSystemService';
import { EnvironmentService } from '@/services/environments/EnvironmentService';
import { GatewayManagerService } from '@/services/gateways/GatewayManagerService';
import { openLspStream, probeWsSupport } from '@/services/languageServer/GatewayLspSocket';
import { readApiTokenValue } from '@/utils/gatewayHttpHelper';

const CONFIG_SECTION = 'flint.languageServer';
/** Minimum Flint Designer Bridge module version that speaks LSP over WebSocket. */
const MIN_MODULE_VERSION = 'v1.2.0';
/** Errors tolerated before the default handler gives up on the connection. */
const MAX_TOLERATED_ERRORS = 3;
/** Restarts allowed before the connection is left closed (mirrors the client's default handler). */
const MAX_RESTART_COUNT = 4;
/** Window (ms) over which restarts are counted before giving up. */
const RESTART_WINDOW_MS = 3 * 60 * 1000;

/** Auth header scheme for a gateway token. */
type GatewayTokenType = 'native' | 'bearer';

/** Everything needed to open an authenticated LSP WebSocket to the selected gateway. */
interface IGatewayLspConnection {
    /** Gateway origin (e.g. `https://gw.example.com:8043`), no trailing slash or `/data` path. */
    gatewayUrl: string;
    /** Auth headers sent on the WebSocket upgrade request. */
    headers: Record<string, string>;
    /** Accept self-signed TLS certs for this gateway (dev gateways). */
    insecureTls: boolean;
    /** Selected project, forwarded to the server via `initializationOptions`. */
    project: string | undefined;
}

/**
 * Manages the Flint Jython language client, connecting VS Code directly to the gateway-hosted
 * language server over an authenticated WebSocket.
 */
export class LanguageServerService implements IServiceLifecycle {
    private status: ServiceStatus = ServiceStatus.NOT_INITIALIZED;
    private client: LanguageClient | undefined;
    private outputChannel: vscode.OutputChannel | undefined;
    private hasWarnedUnsupported = false;
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

        const connection = await this.resolveConnection();
        if (!connection) {
            // Not enough configuration to connect; stay dormant until the user configures a gateway.
            return;
        }

        const probe = await probeWsSupport(connection.gatewayUrl, connection.insecureTls);
        if (probe.lspWsPath === undefined) {
            if (probe.reachable) {
                this.warnUnsupportedOnce(connection.gatewayUrl);
            } else {
                this.log(
                    `Gateway ${connection.gatewayUrl} is unreachable or the Flint module is not installed; ` +
                        'language server is idle.'
                );
            }
            return;
        }

        const wsUrl = this.buildWebSocketUrl(connection.gatewayUrl, probe.lspWsPath);
        const serverOptions: ServerOptions = () => openLspStream(wsUrl, connection.headers, connection.insecureTls);

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { language: 'python', scheme: 'file' },
                { language: 'python', scheme: ScriptFileSystemService.SCHEME }
            ],
            outputChannel: this.outputChannel,
            initializationOptions: { project: connection.project },
            errorHandler: this.createErrorHandler()
        };

        const client = new LanguageClient('flintLanguageServer', 'Flint Language Server', serverOptions, clientOptions);

        try {
            await client.start();
            this.client = client;
            this.log(`Flint language server connected over WebSocket (${wsUrl}).`);
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
     * Resolves the connection details for the selected gateway: origin URL, auth headers, TLS mode,
     * and project. Returns undefined when there is not enough configuration to connect (no gateway
     * selected, gateway not found, or no API token available).
     */
    private async resolveConnection(): Promise<IGatewayLspConnection | undefined> {
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

        const tokenType = this.resolveTokenType(token, resolved.ignitionVersion);
        return {
            gatewayUrl: this.environmentService.buildGatewayUrl(gatewayConfig, ''),
            headers: this.buildAuthHeaders(token, tokenType),
            insecureTls: resolved.ignoreSSLErrors === true,
            project: this.gatewayManager.getSelectedProject() ?? undefined
        };
    }

    /**
     * Determines which auth header scheme the gateway expects. Ignition 8.1 uses a Flint-managed
     * bearer token; 8.3+ uses native platform API tokens. When the version is unknown, a
     * `keyId:secret`-shaped token is treated as a native token; anything else as a bearer token.
     */
    private resolveTokenType(token: string, ignitionVersion: string | undefined): GatewayTokenType {
        if (ignitionVersion?.startsWith('8.1') === true) {
            return 'bearer';
        }
        return /^[^:\s]+:[^:\s]+$/.test(token) ? 'native' : 'bearer';
    }

    private buildAuthHeaders(token: string, tokenType: GatewayTokenType): Record<string, string> {
        if (tokenType === 'native') {
            return { 'X-Ignition-API-Token': token };
        }
        return { Authorization: `Bearer ${token}` };
    }

    /** Maps a gateway origin to its LSP WebSocket URL (`https`→`wss`, `http`→`ws`). */
    private buildWebSocketUrl(gatewayUrl: string, lspWsPath: string): string {
        const wsOrigin = gatewayUrl.replace(/\/+$/, '').replace(/^http/, 'ws');
        return wsOrigin + lspWsPath;
    }

    /**
     * Shows a one-time (per session) warning when the gateway module is reachable but too old to
     * serve the language server over WebSocket. Subsequent restarts only log to the output channel.
     */
    private warnUnsupportedOnce(gatewayUrl: string): void {
        const message =
            `The Flint gateway module on ${gatewayUrl} does not support the language server over WebSocket. ` +
            `Upgrade the Flint Designer Bridge module to ${MIN_MODULE_VERSION} or newer.`;
        this.log(message);
        if (this.hasWarnedUnsupported) {
            return;
        }
        this.hasWarnedUnsupported = true;
        void vscode.window.showWarningMessage(message);
    }

    /**
     * Builds an {@link ErrorHandler} that logs connection errors and closures to the output channel
     * while otherwise mirroring the language client's default recovery behavior: tolerate a few
     * transient errors, then shut down; restart a bounded number of times before giving up.
     */
    private createErrorHandler(): ErrorHandler {
        const restarts: number[] = [];
        return {
            error: (error: Error, _message: Message | undefined, count: number | undefined): ErrorHandlerResult => {
                const occurrence = count !== undefined ? ` (occurrence ${count})` : '';
                this.log(`Language server connection error${occurrence}: ${error.message}`);
                if (count !== undefined && count <= MAX_TOLERATED_ERRORS) {
                    return { action: ErrorAction.Continue };
                }
                return { action: ErrorAction.Shutdown };
            },
            closed: (): CloseHandlerResult => {
                restarts.push(Date.now());
                if (restarts.length <= MAX_RESTART_COUNT) {
                    this.log('Language server connection closed; reconnecting.');
                    return { action: CloseAction.Restart };
                }
                const elapsed = restarts[restarts.length - 1] - restarts[0];
                if (elapsed <= RESTART_WINDOW_MS) {
                    this.log('Language server connection closed too frequently; giving up until the next change.');
                    return { action: CloseAction.DoNotRestart };
                }
                restarts.shift();
                this.log('Language server connection closed; reconnecting.');
                return { action: CloseAction.Restart };
            }
        };
    }

    private log(message: string): void {
        this.outputChannel?.appendLine(message);
    }
}
