/**
 * @module DesignerBridgeService
 * @description Main service for managing Designer connections
 */

import * as vscode from 'vscode';

import {
    ConnectionState,
    DesignerConnectionManager,
    type ExecuteScriptOptions,
    type ProjectScanOptions,
    type ProjectScanResult
} from './DesignerConnectionManager';
import { DesignerDiscoveryService, type DesignerInstance } from './DesignerDiscoveryService';
import { DesignerGatewayMatcher, type GatewayMatchResult } from './DesignerGatewayMatcher';
import { DesignerMultiConnectionManager } from './DesignerMultiConnectionManager';

import { FlintError } from '@/core/errors';
import { ServiceContainer } from '@/core/ServiceContainer';
import { IServiceLifecycle, ServiceStatus } from '@/core/types/services';

/**
 * Aggregated result from scanning all connected Designers
 */
export interface ScanAllResult {
    /** Result from the primary connection scan */
    primaryResult: ProjectScanResult | null;
    /** Results from secondary connection scans, keyed by PID */
    secondaryResults: Map<number, ProjectScanResult>;
    /** Whether all scans succeeded */
    allSucceeded: boolean;
    /** Total number of Designers scanned */
    totalScanned: number;
}

/**
 * Main service for Designer bridge functionality
 */
export class DesignerBridgeService implements IServiceLifecycle {
    private status: ServiceStatus = ServiceStatus.NOT_INITIALIZED;
    private discoveryService: DesignerDiscoveryService;
    private connectionManager: DesignerConnectionManager;
    private gatewayMatcher: DesignerGatewayMatcher;
    private secondaryConnections: DesignerMultiConnectionManager;
    private autoConnectEnabled = true;
    private lastMatchResult: GatewayMatchResult | null = null;

    constructor(private readonly serviceContainer: ServiceContainer) {
        this.discoveryService = new DesignerDiscoveryService(serviceContainer);
        this.connectionManager = new DesignerConnectionManager(serviceContainer);
        this.gatewayMatcher = new DesignerGatewayMatcher(serviceContainer);
        this.secondaryConnections = new DesignerMultiConnectionManager();
    }

    async initialize(): Promise<void> {
        this.status = ServiceStatus.INITIALIZING;

        try {
            await this.discoveryService.initialize();
            await this.connectionManager.initialize();
            await this.gatewayMatcher.initialize();

            // Share the WebSocket class with the multi-connection manager
            const wsClass = this.connectionManager.getWebSocketClass();
            if (wsClass) {
                this.secondaryConnections.initialize(wsClass);
            }

            // Auto-connect when designers are discovered
            this.discoveryService.onDesignersChanged(designers => {
                void this.handleDesignersChanged(designers);
            });

            // Handle primary disconnection - promote a secondary if available
            this.connectionManager.onConnectionStateChanged(state => {
                if (state === ConnectionState.DISCONNECTED) {
                    void this.handlePrimaryDisconnected();
                }
            });

            this.status = ServiceStatus.INITIALIZED;
        } catch (error) {
            this.status = ServiceStatus.FAILED;
            throw new FlintError(
                'Failed to initialize designer bridge service',
                'DESIGNER_BRIDGE_INIT_FAILED',
                'Could not initialize discovery or connection services',
                error instanceof Error ? error : undefined
            );
        }
    }

    async start(): Promise<void> {
        if (this.status !== ServiceStatus.INITIALIZED && this.status !== ServiceStatus.STOPPED) {
            await this.initialize();
        }

        this.status = ServiceStatus.STARTING;

        await this.discoveryService.start();
        await this.connectionManager.start();
        await this.gatewayMatcher.start();

        this.status = ServiceStatus.RUNNING;
    }

    async stop(): Promise<void> {
        this.status = ServiceStatus.STOPPING;

        this.secondaryConnections.disconnectAll();
        await this.connectionManager.stop();
        await this.discoveryService.stop();
        await this.gatewayMatcher.stop();

        this.status = ServiceStatus.STOPPED;
    }

    async dispose(): Promise<void> {
        await this.stop();
        this.secondaryConnections.dispose();
        await this.connectionManager.dispose();
        await this.discoveryService.dispose();
        await this.gatewayMatcher.dispose();
    }

    getStatus(): ServiceStatus {
        return this.status;
    }

    /**
     * Gets the discovery service
     */
    getDiscoveryService(): DesignerDiscoveryService {
        return this.discoveryService;
    }

    /**
     * Gets the connection manager
     */
    getConnectionManager(): DesignerConnectionManager {
        return this.connectionManager;
    }

    /**
     * Gets the secondary connection manager
     */
    getSecondaryConnections(): DesignerMultiConnectionManager {
        return this.secondaryConnections;
    }

    /**
     * Gets all discovered Designer instances
     */
    getDiscoveredDesigners(): DesignerInstance[] {
        return this.discoveryService.getDiscoveredDesigners();
    }

    /**
     * Gets the currently connected Designer
     */
    getConnectedDesigner(): DesignerInstance | null {
        return this.connectionManager.getConnectedDesigner();
    }

    /**
     * Gets the connection state
     */
    getConnectionState(): ConnectionState {
        return this.connectionManager.getConnectionState();
    }

    /**
     * Connects to a specific Designer instance
     * Also performs gateway matching to determine if the Designer matches configuration
     */
    async connectToDesigner(designer: DesignerInstance): Promise<void> {
        // Perform gateway matching before connecting
        this.lastMatchResult = await this.gatewayMatcher.matchDesignerToGateway(designer);

        // Connect to the Designer
        await this.connectionManager.connect(designer);
    }

    /**
     * Gets the gateway match result for the currently connected Designer
     */
    getGatewayMatchResult(): GatewayMatchResult | null {
        return this.lastMatchResult;
    }

    /**
     * Gets the gateway matcher service
     */
    getGatewayMatcher(): DesignerGatewayMatcher {
        return this.gatewayMatcher;
    }

    /**
     * Disconnects from the current Designer
     */
    async disconnect(): Promise<void> {
        this.lastMatchResult = null;
        await this.connectionManager.disconnect();
    }

    /**
     * Shows a quick pick to select a Designer to connect to
     */
    async selectAndConnect(): Promise<boolean> {
        const designers = this.discoveryService.getDiscoveredDesigners();

        if (designers.length === 0) {
            void vscode.window.showInformationMessage(
                'No Designer instances found. Make sure the Flint Designer Bridge module is installed and a Designer is running.'
            );
            return false;
        }

        if (designers.length === 1) {
            // Auto-connect to the only available designer
            try {
                await this.connectToDesigner(designers[0]);
                void vscode.window.showInformationMessage(
                    `Connected to Designer: ${designers[0].project.name} (${designers[0].gateway.host})`
                );
                return true;
            } catch (error) {
                void vscode.window.showErrorMessage(
                    `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
                );
                return false;
            }
        }

        // Show quick pick for multiple designers
        const items = designers.map(d => ({
            label: `$(window) ${d.project.name}`,
            description: `${d.gateway.host}:${d.gateway.port}`,
            detail: `PID: ${d.pid} | User: ${d.user.username} | Port: ${d.port}`,
            designer: d
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a Designer to connect to',
            title: 'Connect to Designer'
        });

        if (!selected) {
            return false;
        }

        try {
            await this.connectToDesigner(selected.designer);
            void vscode.window.showInformationMessage(`Connected to Designer: ${selected.designer.project.name}`);
            return true;
        } catch (error) {
            void vscode.window.showErrorMessage(
                `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
            );
            return false;
        }
    }

    /**
     * Scans all connected Designers (primary + secondary) in parallel.
     * Used by file save handlers to propagate changes to all gateways.
     */
    async scanAllDesigners(options?: ProjectScanOptions): Promise<ScanAllResult> {
        let primaryResult: ProjectScanResult | null = null;
        let secondaryResults = new Map<number, ProjectScanResult>();

        // Scan primary and secondaries in parallel
        const primaryPromise =
            this.connectionManager.getConnectionState() === ConnectionState.CONNECTED
                ? this.connectionManager.scanProject(options).catch((error: unknown) => {
                      console.error('[Flint] Primary Designer scan failed:', error);
                      return null;
                  })
                : Promise.resolve(null);

        const secondaryPromise =
            this.secondaryConnections.getConnectionCount() > 0
                ? this.secondaryConnections.scanProjectAll(options)
                : Promise.resolve(new Map<number, ProjectScanResult>());

        [primaryResult, secondaryResults] = await Promise.all([primaryPromise, secondaryPromise]);

        const totalScanned = (primaryResult ? 1 : 0) + secondaryResults.size;
        const allSucceeded =
            (primaryResult === null || primaryResult.success) &&
            Array.from(secondaryResults.values()).every(r => r.success);

        return {
            primaryResult,
            secondaryResults,
            allSucceeded,
            totalScanned
        };
    }

    /**
     * Returns whether any Designer connections are active (primary or secondary)
     */
    hasAnyConnection(): boolean {
        return (
            this.connectionManager.getConnectionState() === ConnectionState.CONNECTED ||
            this.secondaryConnections.getConnectionCount() > 0
        );
    }

    /**
     * Executes a Python script in the connected Designer or Gateway scope
     * @param options Execution options including code, timeout, session, scope, etc.
     */
    async executeScript(options: ExecuteScriptOptions): Promise<{
        success: boolean;
        stdout: string;
        stderr: string;
        error?: string;
        executionTimeMs: number;
    }> {
        if (this.connectionManager.getConnectionState() !== ConnectionState.CONNECTED) {
            throw new FlintError('Not connected to Designer', 'NOT_CONNECTED', 'Connect to a Designer first');
        }

        return this.connectionManager.executeScript(options);
    }

    /**
     * Shows a message in the connected Designer
     */
    async showMessageInDesigner(message: string, title?: string): Promise<void> {
        if (this.connectionManager.getConnectionState() !== ConnectionState.CONNECTED) {
            throw new FlintError('Not connected to Designer', 'NOT_CONNECTED', 'Connect to a Designer first');
        }

        return this.connectionManager.showMessage(message, title);
    }

    /**
     * Prompts for input and sends it to the Designer as a message
     */
    async promptAndShowMessage(): Promise<void> {
        if (this.connectionManager.getConnectionState() !== ConnectionState.CONNECTED) {
            const connect = await vscode.window.showInformationMessage(
                'Not connected to a Designer. Would you like to connect?',
                'Connect',
                'Cancel'
            );

            if (connect === 'Connect') {
                const connected = await this.selectAndConnect();
                if (!connected) {
                    return;
                }
            } else {
                return;
            }
        }

        const message = await vscode.window.showInputBox({
            prompt: 'Enter a message to show in the Designer',
            placeHolder: 'Hello from VS Code!'
        });

        if (!message) {
            return;
        }

        try {
            await this.showMessageInDesigner(message, 'Message from Flint');
            void vscode.window.showInformationMessage('Message sent to Designer!');
        } catch (error) {
            void vscode.window.showErrorMessage(
                `Failed to send message: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Registers a callback for connection state changes
     */
    onConnectionStateChanged(callback: (state: ConnectionState, designer: DesignerInstance | null) => void): void {
        this.connectionManager.onConnectionStateChanged(callback);
    }

    /**
     * Registers a callback for when discovered designers change
     */
    onDesignersChanged(callback: (designers: DesignerInstance[]) => void): void {
        this.discoveryService.onDesignersChanged(callback);
    }

    /**
     * Registers a callback for when secondary connections change
     */
    onSecondaryConnectionsChanged(callback: () => void): void {
        this.secondaryConnections.onSecondaryConnectionsChanged(callback);
    }

    /**
     * Sets whether auto-connect is enabled
     */
    setAutoConnect(enabled: boolean): void {
        this.autoConnectEnabled = enabled;
    }

    /**
     * Handles changes to discovered designers.
     * Auto-connects primary to the first matching Designer, and secondaries to the rest.
     */
    private async handleDesignersChanged(designers: DesignerInstance[]): Promise<void> {
        // If we're not connected and auto-connect is enabled, connect to the first available
        if (
            this.autoConnectEnabled &&
            this.connectionManager.getConnectionState() === ConnectionState.DISCONNECTED &&
            designers.length > 0
        ) {
            try {
                await this.connectToDesigner(designers[0]);
                console.log(`Auto-connected to Designer: ${designers[0].project.name}`);
            } catch (error) {
                console.error('Auto-connect failed:', error);
            }
        }

        // If we're connected but our designer is no longer available, disconnect
        const connected = this.connectionManager.getConnectedDesigner();
        if (connected) {
            const stillAvailable = designers.some(d => d.pid === connected.pid);
            if (!stillAvailable) {
                await this.connectionManager.disconnect();
            }
        }

        // Manage secondary connections for other matching Designers
        await this.updateSecondaryConnections(designers);
    }

    /**
     * Updates secondary connections based on discovered Designers.
     * Connects to matching Designers that aren't the primary, disconnects stale ones.
     */
    private async updateSecondaryConnections(designers: DesignerInstance[]): Promise<void> {
        const primaryPid = this.connectionManager.getConnectedDesigner()?.pid;

        // Find Designers that match gateway config (excluding primary)
        const matchingDesigners: DesignerInstance[] = [];
        for (const designer of designers) {
            if (designer.pid === primaryPid) continue;

            try {
                const match = await this.gatewayMatcher.matchDesignerToGateway(designer);
                if (match.isExactMatch) {
                    matchingDesigners.push(designer);
                }
            } catch {
                // Skip Designers we can't match
            }
        }

        // Disconnect secondaries that are no longer in the discovered list
        const currentSecondaries = this.secondaryConnections.getConnectedDesigners();
        for (const secondary of currentSecondaries) {
            const stillAvailable = matchingDesigners.some(d => d.pid === secondary.pid);
            if (!stillAvailable) {
                this.secondaryConnections.disconnect(secondary.pid);
            }
        }

        // Connect to new matching Designers
        const currentPids = new Set(currentSecondaries.map(d => d.pid));
        for (const designer of matchingDesigners) {
            if (!currentPids.has(designer.pid)) {
                try {
                    await this.secondaryConnections.connect(designer);
                } catch (error) {
                    console.error(
                        `Failed to establish secondary connection to ${designer.project.name} (PID ${designer.pid}):`,
                        error
                    );
                }
            }
        }
    }

    /**
     * Handles primary connection disconnection.
     * If secondary connections exist, promotes one to primary.
     */
    private async handlePrimaryDisconnected(): Promise<void> {
        if (!this.autoConnectEnabled) return;

        const candidate = this.secondaryConnections.removeForPromotion();
        if (!candidate) return;

        try {
            console.log(`[Flint] Promoting secondary connection to primary: ${candidate.project.name}`);
            await this.connectToDesigner(candidate);
        } catch (error) {
            console.error('[Flint] Failed to promote secondary to primary:', error);
        }
    }
}
