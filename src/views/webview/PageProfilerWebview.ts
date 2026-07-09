/**
 * @module PageProfilerWebview
 * @description Interactive webview for real-time Perspective page binding profiler.
 * Records all binding state transitions across all views on a page,
 * displaying a waterfall timeline and event log.
 */

import * as path from 'path';

import * as vscode from 'vscode';

import { ServiceContainer } from '@/core/ServiceContainer';
import type {
    RecordingCompleteData,
    RecordingEventBatch,
    StartRecordingParams,
    StartRecordingResult,
    StopRecordingResult
} from '@/core/types/profiler';
import { IServiceLifecycle, ServiceStatus } from '@/core/types/services';
import type { DesignerConnectionManager } from '@/services/designer/DesignerConnectionManager';

/**
 * Messages from extension to webview
 */
type ExtensionToWebviewMessage =
    | { command: 'profilerOpened' }
    | {
          command: 'recordingStarted';
          recordingId: string;
          viewPath: string | null;
          pendingCount: number;
          resolvedCount: number;
          errorCount: number;
          totalCount: number;
          pollIntervalMs: number;
      }
    | { command: 'recordingEvents'; batch: RecordingEventBatch }
    | {
          command: 'recordingComplete';
          recordingId: string;
          reason: string;
          pendingCount: number;
          resolvedCount: number;
          errorCount: number;
          totalCount: number;
      }
    | { command: 'recordingStopped'; durationMs: number; totalEventsRecorded: number; totalPollCount: number }
    | { command: 'error'; message: string }
    | { command: 'snapshotLoaded'; data: { events: unknown[]; waterfall: unknown[]; durationMs: number } }
    | {
          command: 'scopeOptions';
          sessions: ScopeOption[];
          pages: ScopeOption[];
          currentSessionId: string;
          currentPageId: string;
      }
    | { command: 'pageViews'; views: ScopeOption[] }
    | { command: 'reloadingStarted'; viewPath: string }
    | { command: 'reloadingStatus'; message: string }
    | { command: 'reloadingCancelled' };

interface ScopeOption {
    id: string;
    label: string;
    viewPath?: string;
}

/**
 * Messages from webview to extension
 */
type WebviewToExtensionMessage =
    | { command: 'ready' }
    | { command: 'stopRecording' }
    | { command: 'exportData'; data: unknown }
    | { command: 'openInDesigner'; resourceType: string; resourcePath: string }
    | { command: 'refreshRecording' }
    | { command: 'importSnapshot' }
    | { command: 'exportCsv'; csv: string }
    | { command: 'changeScope'; sessionId: string; pageId: string }
    | { command: 'requestScopeUpdate'; level: 'sessions' | 'pages'; sessionId?: string; pageId?: string }
    | { command: 'startRecording'; sessionId: string; pageId: string; pollIntervalMs: number }
    | { command: 'startReloadRecord'; sessionId: string; pageId: string; viewPath: string; pollIntervalMs: number }
    | { command: 'cancelReloadRecord' };

/**
 * Interactive page binding profiler webview
 */
export class PageProfilerWebview implements IServiceLifecycle {
    private static readonly viewType = 'flint.pageProfiler';
    private panel: vscode.WebviewPanel | null = null;
    private isInitialized = false;
    private currentRecordingId: string | null = null;
    private connectionManager: DesignerConnectionManager | null = null;

    private boundOnRecordingEvent: ((batch: RecordingEventBatch) => void) | null = null;
    private boundOnRecordingComplete: ((data: RecordingCompleteData) => void) | null = null;
    private currentTarget: { sessionId: string; pageId: string } | null = null;
    private currentPollIntervalMs = 50;

    // Reload & Record state
    private reloadTimer: ReturnType<typeof setInterval> | null = null;
    private reloadViewPath: string | null = null;
    private reloadSessionId: string | null = null;
    private reloadPageId: string | null = null;
    private reloadPollIntervalMs = 50;
    private reloadStartTime = 0;
    private isReloadPollInFlight = false;
    private reloadPhase: 'waiting-disappear' | 'waiting-appear' = 'waiting-disappear';
    private static readonly RELOAD_TIMEOUT_MS = 30000;

    // View ordering cache: pageId → primaryViewPath
    private pageViewPaths: Map<string, string> = new Map();

    constructor(
        private readonly serviceContainer: ServiceContainer,
        private readonly context: vscode.ExtensionContext
    ) {}

    // ============================================================================
    // SERVICE LIFECYCLE
    // ============================================================================

    async initialize(): Promise<void> {
        await Promise.resolve();
        this.isInitialized = true;
    }

    async start(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    async stop(): Promise<void> {
        await Promise.resolve();
        this.cleanupCallbacks();
        this.clearReloadTimer();
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
    }

    async dispose(): Promise<void> {
        await this.stop();
    }

    getStatus(): ServiceStatus {
        return this.isInitialized ? ServiceStatus.RUNNING : ServiceStatus.STOPPED;
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    /**
     * Opens the profiler in idle mode without starting a recording.
     * The user configures scope and poll rate in the webview, then clicks Start.
     */
    async openIdle(connectionManager: DesignerConnectionManager): Promise<void> {
        await Promise.resolve();

        this.connectionManager = connectionManager;

        // Create or reveal panel
        if (this.panel) {
            this.panel.reveal();
        } else {
            this.createPanel('Page Binding Profiler');
        }

        // Send idle state to webview
        const message: ExtensionToWebviewMessage = { command: 'profilerOpened' };
        await this.panel!.webview.postMessage(message);

        // Send initial scope options so dropdowns are populated
        await this.sendInitialScopeOptions();
    }

    /**
     * Opens the recording profiler and starts a recording session.
     * Kept for backward compatibility.
     */
    async openRecording(
        connectionManager: DesignerConnectionManager,
        startResult: StartRecordingResult,
        pollIntervalMs: number = 50,
        target?: { sessionId: string; pageId: string }
    ): Promise<void> {
        await Promise.resolve();

        this.connectionManager = connectionManager;
        this.currentRecordingId = startResult.recordingId;
        this.currentPollIntervalMs = pollIntervalMs;
        if (target) {
            this.currentTarget = target;
        }

        // Create or reveal panel
        if (this.panel) {
            this.panel.reveal();
        } else {
            this.createPanel(`Recording: ${startResult.viewPath ?? 'View'}`);
        }

        // Register notification callbacks
        this.registerCallbacks();

        // Send initial recording data to webview
        const message: ExtensionToWebviewMessage = {
            command: 'recordingStarted',
            recordingId: startResult.recordingId ?? '',
            viewPath: startResult.viewPath,
            pendingCount: startResult.pendingCount,
            resolvedCount: startResult.resolvedCount,
            errorCount: startResult.errorCount,
            totalCount: startResult.totalCount,
            pollIntervalMs
        };
        await this.panel!.webview.postMessage(message);

        // Send initial scope options for scope dropdowns
        await this.sendInitialScopeOptions();
    }

    // ============================================================================
    // PRIVATE METHODS - PANEL SETUP
    // ============================================================================

    private createPanel(title: string): void {
        this.panel = vscode.window.createWebviewPanel(PageProfilerWebview.viewType, title, vscode.ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'media'))]
        });

        this.panel.webview.html = this.generateWebviewHtml(this.panel.webview);

        this.panel.webview.onDidReceiveMessage(
            (message: WebviewToExtensionMessage): void => {
                void this.handleWebviewMessage(message);
            },
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose((): void => {
            this.panel = null;
            this.cleanupCallbacks();
            this.clearReloadTimer();
            // Auto-stop recording if panel is closed
            if (this.currentRecordingId && this.connectionManager) {
                void this.connectionManager.perspectiveStopRecording(this.currentRecordingId);
                this.currentRecordingId = null;
            }
        });
    }

    // ============================================================================
    // PRIVATE METHODS - CALLBACKS
    // ============================================================================

    private registerCallbacks(): void {
        this.cleanupCallbacks();

        if (!this.connectionManager) {
            return;
        }

        this.boundOnRecordingEvent = (batch: RecordingEventBatch): void => {
            if (this.panel) {
                const message: ExtensionToWebviewMessage = {
                    command: 'recordingEvents',
                    batch
                };
                void this.panel.webview.postMessage(message);
            }
        };

        this.boundOnRecordingComplete = (data: RecordingCompleteData): void => {
            if (this.panel) {
                const message: ExtensionToWebviewMessage = {
                    command: 'recordingComplete',
                    recordingId: data.recordingId,
                    reason: data.reason,
                    pendingCount: data.pendingCount,
                    resolvedCount: data.resolvedCount,
                    errorCount: data.errorCount,
                    totalCount: data.totalCount
                };
                void this.panel.webview.postMessage(message);
            }
            this.currentRecordingId = null;
        };

        this.connectionManager.onRecordingEvent(this.boundOnRecordingEvent);
        this.connectionManager.onRecordingComplete(this.boundOnRecordingComplete);
    }

    private cleanupCallbacks(): void {
        if (this.connectionManager) {
            if (this.boundOnRecordingEvent) {
                this.connectionManager.offRecordingEvent(this.boundOnRecordingEvent);
                this.boundOnRecordingEvent = null;
            }
            if (this.boundOnRecordingComplete) {
                this.connectionManager.offRecordingComplete(this.boundOnRecordingComplete);
                this.boundOnRecordingComplete = null;
            }
        }
    }

    // ============================================================================
    // PRIVATE METHODS - MESSAGE HANDLING
    // ============================================================================

    private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
        switch (message.command) {
            case 'ready':
                break;

            case 'stopRecording':
                await this.handleStopRecording();
                break;

            case 'exportData':
                await this.handleExportData(message.data);
                break;

            case 'openInDesigner':
                await this.handleOpenInDesigner(message.resourceType, message.resourcePath);
                break;

            case 'refreshRecording':
                await this.handleRefreshRecording();
                break;

            case 'importSnapshot':
                await this.handleImportSnapshot();
                break;

            case 'exportCsv':
                await this.handleExportCsv(message.csv);
                break;

            case 'changeScope':
                await this.handleChangeScope(message.sessionId, message.pageId);
                break;

            case 'requestScopeUpdate':
                await this.handleRequestScopeUpdate(message.level, message.sessionId, message.pageId);
                break;

            case 'startRecording':
                await this.handleStartRecording(message.sessionId, message.pageId, message.pollIntervalMs);
                break;

            case 'startReloadRecord':
                await this.handleStartReloadRecord(
                    message.sessionId,
                    message.pageId,
                    message.viewPath,
                    message.pollIntervalMs
                );
                break;

            case 'cancelReloadRecord':
                await this.handleCancelReloadRecord();
                break;

            default:
                console.warn('Unknown webview message:', message);
        }
    }

    // ============================================================================
    // PRIVATE METHODS - RECORDING
    // ============================================================================

    private async handleStartRecording(sessionId: string, pageId: string, pollIntervalMs: number): Promise<void> {
        if (!this.connectionManager) {
            return;
        }

        // Stop current recording if active
        if (this.currentRecordingId) {
            try {
                await this.connectionManager.perspectiveStopRecording(this.currentRecordingId);
            } catch {
                // Ignore errors stopping the old recording
            }
            this.currentRecordingId = null;
        }

        this.currentTarget = { sessionId, pageId };
        this.currentPollIntervalMs = pollIntervalMs;

        try {
            const params: StartRecordingParams = {
                ...this.currentTarget,
                pollIntervalMs
            };
            const startResult = await this.connectionManager.perspectiveStartRecording(params);

            if (!startResult.success) {
                if (this.panel) {
                    await this.panel.webview.postMessage({
                        command: 'error',
                        message: `Failed to start recording: ${startResult.error ?? 'Unknown error'}`
                    } as ExtensionToWebviewMessage);
                }
                return;
            }

            this.currentRecordingId = startResult.recordingId;
            this.registerCallbacks();

            if (this.panel) {
                this.panel.title = `Recording: ${startResult.viewPath ?? 'Page'}`;
                const message: ExtensionToWebviewMessage = {
                    command: 'recordingStarted',
                    recordingId: startResult.recordingId ?? '',
                    viewPath: startResult.viewPath,
                    pendingCount: startResult.pendingCount,
                    resolvedCount: startResult.resolvedCount,
                    errorCount: startResult.errorCount,
                    totalCount: startResult.totalCount,
                    pollIntervalMs
                };
                await this.panel.webview.postMessage(message);

                // Send page views for filter chips
                await this.sendPageViews(sessionId, pageId);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (this.panel) {
                await this.panel.webview.postMessage({
                    command: 'error',
                    message: `Failed to start recording: ${errorMsg}`
                } as ExtensionToWebviewMessage);
            }
        }
    }

    private async handleStopRecording(): Promise<void> {
        if (!this.currentRecordingId || !this.connectionManager) {
            return;
        }

        try {
            const result: StopRecordingResult = await this.connectionManager.perspectiveStopRecording(
                this.currentRecordingId
            );
            this.currentRecordingId = null;

            if (this.panel) {
                const message: ExtensionToWebviewMessage = {
                    command: 'recordingStopped',
                    durationMs: result.durationMs,
                    totalEventsRecorded: result.totalEventsRecorded,
                    totalPollCount: result.totalPollCount
                };
                await this.panel.webview.postMessage(message);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (this.panel) {
                await this.panel.webview.postMessage({
                    command: 'error',
                    message: `Failed to stop recording: ${errorMsg}`
                } as ExtensionToWebviewMessage);
            }
        }
    }

    private async handleRefreshRecording(): Promise<void> {
        if (!this.connectionManager || !this.currentTarget) {
            return;
        }

        // Stop current recording if active
        if (this.currentRecordingId) {
            try {
                await this.connectionManager.perspectiveStopRecording(this.currentRecordingId);
            } catch {
                // Ignore errors stopping the old recording
            }
            this.currentRecordingId = null;
        }

        // Start new recording with same target
        try {
            const params: StartRecordingParams = {
                ...this.currentTarget,
                pollIntervalMs: this.currentPollIntervalMs
            };
            const startResult = await this.connectionManager.perspectiveStartRecording(params);

            if (!startResult.success) {
                if (this.panel) {
                    await this.panel.webview.postMessage({
                        command: 'error',
                        message: `Failed to restart recording: ${startResult.error ?? 'Unknown error'}`
                    } as ExtensionToWebviewMessage);
                }
                return;
            }

            this.currentRecordingId = startResult.recordingId;
            this.registerCallbacks();

            if (this.panel) {
                const message: ExtensionToWebviewMessage = {
                    command: 'recordingStarted',
                    recordingId: startResult.recordingId ?? '',
                    viewPath: startResult.viewPath,
                    pendingCount: startResult.pendingCount,
                    resolvedCount: startResult.resolvedCount,
                    errorCount: startResult.errorCount,
                    totalCount: startResult.totalCount,
                    pollIntervalMs: this.currentPollIntervalMs
                };
                await this.panel.webview.postMessage(message);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (this.panel) {
                await this.panel.webview.postMessage({
                    command: 'error',
                    message: `Failed to restart recording: ${errorMsg}`
                } as ExtensionToWebviewMessage);
            }
        }
    }

    private async handleChangeScope(sessionId: string, pageId: string): Promise<void> {
        if (!this.connectionManager) {
            return;
        }

        // Stop current recording if active
        if (this.currentRecordingId) {
            try {
                await this.connectionManager.perspectiveStopRecording(this.currentRecordingId);
            } catch {
                // Ignore errors stopping the old recording
            }
            this.currentRecordingId = null;
        }

        // Update target
        this.currentTarget = { sessionId, pageId };

        // Start new recording
        try {
            const params: StartRecordingParams = {
                ...this.currentTarget,
                pollIntervalMs: this.currentPollIntervalMs
            };
            const startResult = await this.connectionManager.perspectiveStartRecording(params);

            if (!startResult.success) {
                if (this.panel) {
                    await this.panel.webview.postMessage({
                        command: 'error',
                        message: `Failed to start recording on new scope: ${startResult.error ?? 'Unknown error'}`
                    } as ExtensionToWebviewMessage);
                }
                return;
            }

            this.currentRecordingId = startResult.recordingId;
            this.registerCallbacks();

            if (this.panel) {
                const message: ExtensionToWebviewMessage = {
                    command: 'recordingStarted',
                    recordingId: startResult.recordingId ?? '',
                    viewPath: startResult.viewPath,
                    pendingCount: startResult.pendingCount,
                    resolvedCount: startResult.resolvedCount,
                    errorCount: startResult.errorCount,
                    totalCount: startResult.totalCount,
                    pollIntervalMs: this.currentPollIntervalMs
                };
                await this.panel.webview.postMessage(message);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (this.panel) {
                await this.panel.webview.postMessage({
                    command: 'error',
                    message: `Failed to start recording: ${errorMsg}`
                } as ExtensionToWebviewMessage);
            }
        }
    }

    // ============================================================================
    // PRIVATE METHODS - RELOAD & RECORD
    // ============================================================================

    private async handleStartReloadRecord(
        sessionId: string,
        pageId: string,
        viewPath: string,
        pollIntervalMs: number
    ): Promise<void> {
        if (!this.connectionManager || !this.panel) {
            return;
        }

        this.reloadSessionId = sessionId;
        this.reloadPageId = pageId;
        this.reloadViewPath = viewPath;
        this.reloadPollIntervalMs = pollIntervalMs;
        this.reloadStartTime = Date.now();
        this.isReloadPollInFlight = false;
        this.reloadPhase = 'waiting-disappear';

        const reloadingMessage: ExtensionToWebviewMessage = { command: 'reloadingStarted', viewPath };
        await this.panel.webview.postMessage(reloadingMessage);

        // Phase 1: Navigate away to destroy views
        try {
            const scriptResult = await this.connectionManager.executeScript({
                code: "system.perspective.navigate('/__flint_reload__')",
                scope: 'perspective',
                perspectiveSessionId: sessionId,
                perspectivePageId: pageId
            });

            if (!scriptResult.success) {
                await this.panel.webview.postMessage({
                    command: 'error',
                    message: `Reload failed: ${scriptResult.error ?? scriptResult.stderr ?? 'Unknown error'}`
                } as ExtensionToWebviewMessage);
                await this.panel.webview.postMessage({
                    command: 'reloadingCancelled'
                } as ExtensionToWebviewMessage);
                return;
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            await this.panel.webview.postMessage({
                command: 'error',
                message: `Reload failed: ${errorMsg}`
            } as ExtensionToWebviewMessage);
            await this.panel.webview.postMessage({
                command: 'reloadingCancelled'
            } as ExtensionToWebviewMessage);
            return;
        }

        // Phase 2: Poll for views to disappear, then navigate back, then wait for reappearance
        this.reloadTimer = setInterval(() => {
            void this.reloadPollCycle();
        }, 200);
    }

    private async reloadPollCycle(): Promise<void> {
        if (
            this.isReloadPollInFlight ||
            !this.connectionManager ||
            !this.reloadSessionId ||
            !this.reloadViewPath ||
            !this.reloadPageId
        ) {
            return;
        }

        // Check for timeout
        const elapsed = Date.now() - this.reloadStartTime;
        if (elapsed > PageProfilerWebview.RELOAD_TIMEOUT_MS) {
            this.clearReloadTimer();
            if (this.panel) {
                await this.panel.webview.postMessage({
                    command: 'error',
                    message: 'Reload timed out: view did not reappear within 30s'
                } as ExtensionToWebviewMessage);
                await this.panel.webview.postMessage({
                    command: 'reloadingCancelled'
                } as ExtensionToWebviewMessage);
            }
            return;
        }

        this.isReloadPollInFlight = true;

        try {
            const viewsResult = await this.connectionManager.perspectiveGetPageViews(
                this.reloadSessionId,
                this.reloadPageId
            );
            const views = viewsResult.views ?? [];

            if (this.reloadPhase === 'waiting-disappear') {
                // Phase 1: Wait for target view to disappear after navigate-away
                // (docked views may persist through navigation, so check specifically for target)
                const targetStillPresent = views.some(v => v.viewPath === this.reloadViewPath);
                if (!targetStillPresent) {
                    this.reloadPhase = 'waiting-appear';
                    // Navigate back to the original page
                    await this.connectionManager.executeScript({
                        code: 'system.perspective.navigateBack()',
                        scope: 'perspective',
                        perspectiveSessionId: this.reloadSessionId,
                        perspectivePageId: this.reloadPageId
                    });
                }
            } else {
                // Phase 2: Wait for target view to reappear
                const matchedView = views.find(v => v.viewPath === this.reloadViewPath);
                if (matchedView) {
                    await this.startRecordingForReloadedView(
                        this.reloadSessionId,
                        this.reloadPageId,
                        matchedView.viewInstanceId
                    );
                    return;
                }
            }

            // Send status update
            if (this.panel) {
                const elapsedSec = Math.round(elapsed / 1000);
                const phase = this.reloadPhase === 'waiting-disappear' ? 'Unloading' : 'Reloading';
                await this.panel.webview.postMessage({
                    command: 'reloadingStatus',
                    message: `${phase}... ${elapsedSec}s`
                } as ExtensionToWebviewMessage);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('Reload poll error:', errorMsg);
        } finally {
            this.isReloadPollInFlight = false;
        }
    }

    private async startRecordingForReloadedView(
        sessionId: string,
        pageId: string,
        viewInstanceId: string
    ): Promise<void> {
        if (!this.connectionManager) {
            return;
        }

        this.clearReloadTimer();

        this.currentTarget = { sessionId, pageId };
        this.currentPollIntervalMs = this.reloadPollIntervalMs;

        const params: StartRecordingParams = {
            sessionId,
            pageId,
            viewInstanceId,
            pollIntervalMs: this.reloadPollIntervalMs,
            autoStopOnAllResolved: true,
            autoStopDelayMs: 5000
        };
        const startResult = await this.connectionManager.perspectiveStartRecording(params);

        if (!startResult.success) {
            if (this.panel) {
                await this.panel.webview.postMessage({
                    command: 'error',
                    message: `Page reloaded but failed to start recording: ${startResult.error ?? 'Unknown error'}`
                } as ExtensionToWebviewMessage);
            }
            return;
        }

        this.currentRecordingId = startResult.recordingId;
        this.registerCallbacks();

        if (this.panel) {
            this.panel.title = `Recording: ${startResult.viewPath ?? 'Page'}`;
            const recordingMessage: ExtensionToWebviewMessage = {
                command: 'recordingStarted',
                recordingId: startResult.recordingId ?? '',
                viewPath: startResult.viewPath,
                pendingCount: startResult.pendingCount,
                resolvedCount: startResult.resolvedCount,
                errorCount: startResult.errorCount,
                totalCount: startResult.totalCount,
                pollIntervalMs: this.reloadPollIntervalMs
            };
            await this.panel.webview.postMessage(recordingMessage);

            // Send scope options so dropdowns reflect the reloaded page
            await this.sendInitialScopeOptions();

            // Send page views for filter chips
            await this.sendPageViews(sessionId, pageId);
        }
    }

    private async handleCancelReloadRecord(): Promise<void> {
        this.clearReloadTimer();

        if (this.panel) {
            const message: ExtensionToWebviewMessage = { command: 'reloadingCancelled' };
            await this.panel.webview.postMessage(message);
        }
    }

    private clearReloadTimer(): void {
        if (this.reloadTimer) {
            clearInterval(this.reloadTimer);
            this.reloadTimer = null;
        }
        this.reloadViewPath = null;
        this.reloadSessionId = null;
        this.reloadPageId = null;
        this.isReloadPollInFlight = false;
        this.reloadPhase = 'waiting-disappear';
    }

    // ============================================================================
    // PRIVATE METHODS - DATA OPERATIONS
    // ============================================================================

    private async handleOpenInDesigner(resourceType: string, resourcePath: string): Promise<void> {
        if (!this.connectionManager) {
            return;
        }

        try {
            await this.connectionManager.sendRequest('designer.openResource', { resourceType, resourcePath });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to open in Designer: ${errorMsg}`);
        }
    }

    private async handleExportData(data: unknown): Promise<void> {
        const defaultName = 'page-profiler-export.json';
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const defaultUri = workspaceFolder ? vscode.Uri.joinPath(workspaceFolder.uri, defaultName) : undefined;

        const uri = await vscode.window.showSaveDialog({
            filters: { 'JSON Files': ['json'] },
            defaultUri,
            saveLabel: 'Export Recording'
        });

        if (!uri) {
            return;
        }

        const json = JSON.stringify(data, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
    }

    private async handleImportSnapshot(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            filters: { 'JSON Files': ['json'] },
            canSelectMany: false,
            openLabel: 'Import Snapshot'
        });

        if (!uris || uris.length === 0) {
            return;
        }

        try {
            const fileContent = await vscode.workspace.fs.readFile(uris[0]);
            const text = Buffer.from(fileContent).toString('utf-8');
            const data = JSON.parse(text) as Record<string, unknown>;

            // Validate expected structure
            if (!Array.isArray(data.events) || !Array.isArray(data.waterfall) || typeof data.durationMs !== 'number') {
                vscode.window.showErrorMessage(
                    'Invalid snapshot file: expected "events", "waterfall", and "durationMs" fields'
                );
                return;
            }

            if (this.panel) {
                const message: ExtensionToWebviewMessage = {
                    command: 'snapshotLoaded',
                    data: {
                        events: data.events as unknown[],
                        waterfall: data.waterfall as unknown[],
                        durationMs: data.durationMs
                    }
                };
                await this.panel.webview.postMessage(message);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to import snapshot: ${errorMsg}`);
        }
    }

    private async handleExportCsv(csv: string): Promise<void> {
        const document = await vscode.workspace.openTextDocument({
            content: csv,
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(document);
    }

    // ============================================================================
    // PRIVATE METHODS - SCOPE OPTIONS
    // ============================================================================

    private async handleRequestScopeUpdate(
        level: 'sessions' | 'pages',
        sessionId?: string,
        pageId?: string
    ): Promise<void> {
        if (!this.connectionManager || !this.panel) {
            return;
        }

        try {
            const currentSessionId = sessionId ?? this.currentTarget?.sessionId ?? '';

            // Always fetch sessions for the dropdown
            const sessions = await this.fetchSessionOptions();

            // Cascade: fetch pages when we have a session
            const needsPages = level === 'pages';
            const pages = needsPages && currentSessionId ? await this.fetchPageOptions(currentSessionId) : [];

            // Auto-select first page if none specified
            const effectivePageId = pageId ?? this.currentTarget?.pageId ?? (pages.length > 0 ? pages[0].id : '');

            const message: ExtensionToWebviewMessage = {
                command: 'scopeOptions',
                sessions,
                pages,
                currentSessionId,
                currentPageId: effectivePageId
            };
            await this.panel.webview.postMessage(message);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('Failed to fetch scope options:', errorMsg);
        }
    }

    private async fetchSessionOptions(): Promise<ScopeOption[]> {
        if (!this.connectionManager) {
            return [];
        }
        const result = await this.connectionManager.perspectiveListSessions();
        return (result.sessions ?? []).map(s => ({
            id: s.sessionId,
            label: `${s.userName || 'Unknown'} - ${s.projectName}`
        }));
    }

    private async fetchPageOptions(sessionId: string): Promise<ScopeOption[]> {
        if (!this.connectionManager) {
            return [];
        }
        const result = await this.connectionManager.perspectiveGetSessionPages(sessionId);
        const pages = result.pages ?? [];

        // Cache primaryViewPath for each page (used by fetchViewOptions)
        for (const page of pages) {
            this.pageViewPaths.set(page.pageId, page.primaryViewPath);
        }

        return pages.map(p => ({
            id: p.pageId,
            label: p.primaryViewPath,
            viewPath: p.primaryViewPath
        }));
    }

    private async sendPageViews(sessionId: string, pageId: string): Promise<void> {
        if (!this.connectionManager || !this.panel) {
            return;
        }

        try {
            const result = await this.connectionManager.perspectiveGetPageViews(sessionId, pageId);
            const views = result.views ?? [];
            const primaryViewPath = this.pageViewPaths.get(pageId);

            // Sort: primary/root view first, then alphabetically by viewPath
            const sorted = views.slice().sort((a, b) => {
                const aIsRoot = primaryViewPath !== undefined && a.viewPath === primaryViewPath;
                const bIsRoot = primaryViewPath !== undefined && b.viewPath === primaryViewPath;
                if (aIsRoot && !bIsRoot) {
                    return -1;
                }
                if (!aIsRoot && bIsRoot) {
                    return 1;
                }
                return a.viewPath.localeCompare(b.viewPath);
            });

            const viewOptions: ScopeOption[] = sorted.map(v => {
                const isRoot = primaryViewPath !== undefined && v.viewPath === primaryViewPath;
                const label = isRoot ? `${v.viewPath} (root)` : `\u21B3 ${v.viewPath}`;
                return { id: v.viewInstanceId, label, viewPath: v.viewPath };
            });

            const message: ExtensionToWebviewMessage = {
                command: 'pageViews',
                views: viewOptions
            };
            await this.panel.webview.postMessage(message);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('Failed to fetch page views:', errorMsg);
        }
    }

    private async sendInitialScopeOptions(): Promise<void> {
        if (!this.connectionManager || !this.panel) {
            return;
        }

        // If we have a current target, send fully populated dropdowns
        if (this.currentTarget) {
            await this.handleRequestScopeUpdate('pages', this.currentTarget.sessionId, this.currentTarget.pageId);
            return;
        }

        // Auto-cascade: fetch sessions → pick first → fetch pages → pick first
        const sessions = await this.fetchSessionOptions();
        if (sessions.length === 0) {
            await this.panel.webview.postMessage({
                command: 'scopeOptions',
                sessions: [],
                pages: [],
                currentSessionId: '',
                currentPageId: ''
            } as ExtensionToWebviewMessage);
            return;
        }

        const firstSessionId = sessions[0].id;
        const pages = await this.fetchPageOptions(firstSessionId);

        let firstPageId = '';
        if (pages.length > 0) {
            firstPageId = pages[0].id;
        }

        await this.panel.webview.postMessage({
            command: 'scopeOptions',
            sessions,
            pages,
            currentSessionId: firstSessionId,
            currentPageId: firstPageId
        } as ExtensionToWebviewMessage);
    }

    // ============================================================================
    // PRIVATE METHODS - HTML GENERATION
    // ============================================================================

    private generateWebviewHtml(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'page-profiler.css'))
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'page-profiler.js'))
        );

        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   script-src 'nonce-${nonce}';
                   style-src ${webview.cspSource} 'unsafe-inline';">
    <link href="${styleUri.toString()}" rel="stylesheet">
    <title>Page Binding Profiler</title>
</head>
<body>
<div class="recording-container">
    <!-- Header -->
    <div class="recording-header">
        <div>
            <h1>Page Binding Profiler</h1>
            <div class="view-path" id="viewPath"></div>
        </div>
        <div class="header-controls">
            <span id="pollRateDisplay" class="poll-rate-display"></span>
            <span id="statusBadge" class="recording-status idle">Idle</span>
            <button id="startBtn" class="btn-icon btn-icon-start" title="Start Recording"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg></button>
            <button id="stopBtn" class="btn-icon btn-icon-danger" title="Stop Recording" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>
            <button id="refreshBtn" class="btn-icon" title="Re-record" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
            <button id="importBtn" class="btn-icon" title="Import Snapshot"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
            <button id="exportBtn" class="btn-icon" title="Export JSON"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>
        </div>
    </div>

    <!-- Counter Cards -->
    <div class="counter-cards">
        <div class="counter-card total">
            <span id="counterTotal" class="counter-value">0</span>
            <span class="counter-label">Total</span>
        </div>
        <div class="counter-card pending">
            <span id="counterPending" class="counter-value">0</span>
            <span class="counter-label">Pending</span>
        </div>
        <div class="counter-card resolved">
            <span id="counterResolved" class="counter-value">0</span>
            <span class="counter-label">Resolved</span>
        </div>
        <div class="counter-card errors">
            <span id="counterErrors" class="counter-value">0</span>
            <span class="counter-label">Errors</span>
        </div>
    </div>

    <!-- Scope & Actions Toolbar -->
    <div class="scope-toolbar">
        <label>Session: <select id="sessionSelect"></select></label>
        <label>Page: <select id="pageSelect"></select></label>
        <label>Poll: <select id="pollRateSelect">
            <option value="25">25ms</option>
            <option value="50" selected>50ms</option>
            <option value="100">100ms</option>
            <option value="200">200ms</option>
        </select></label>
        <div class="scope-actions">
            <button id="reloadRecordBtn" class="btn btn-reload" disabled
                    title="Reload the page and record binding load cycle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                Reload &amp; Record
            </button>
            <button id="cancelReloadBtn" class="btn-icon btn-icon-danger"
                    title="Cancel Reload" style="display:none;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
            <span id="reloadStatus" class="reload-status"></span>
        </div>
    </div>

    <!-- View Filter Chips -->
    <div id="viewFilterBar" class="view-filter-bar" style="display:none;"></div>

    <!-- Main Content -->
    <div class="content-area">
        <!-- Waterfall Timeline -->
        <div class="waterfall-section">
            <div class="section-header">
                <span>Waterfall Timeline</span>
                <span>
                    <button id="groupToggleBtn" class="btn btn-small" style="display:none;">Group</button>
                    <button id="resetZoomBtn" class="btn btn-small" style="display:none;">Reset Zoom</button>
                    <span id="waterfallCount" class="section-count">0 bindings</span>
                </span>
            </div>
            <div class="waterfall-container" id="waterfallContainer">
                <div id="waterfallTimeHeader" class="waterfall-time-header" style="display:none;"></div>
                <div id="waterfallRows" class="waterfall-rows" style="display:none;"></div>
                <div id="waterfallEmpty" class="waterfall-empty">
                    Select a session and page above to begin
                </div>
                <div id="timeCursor" class="time-cursor"><span class="time-cursor-label"></span></div>
                <div id="zoomOverlay" class="zoom-overlay"><span class="zoom-selection-label"></span></div>
            </div>
        </div>

        <!-- Event Log -->
        <div class="event-log-section">
            <div class="section-header">
                <span>Event Log</span>
                <span>
                    <button id="sortToggleBtn" class="btn btn-small">Sort: Time</button>
                    <button id="exportCsvBtn" class="btn-icon btn-icon-small" title="Export CSV"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg></button>
                    <span id="eventLogCount" class="section-count">0 events</span>
                </span>
            </div>
            <div id="eventLogContainer" class="event-log-container">
                <div id="eventLogEmpty" class="event-log-empty">
                    No events yet
                </div>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <div class="recording-footer">
        <span>Duration: <strong id="durationDisplay">0ms</strong></span>
        <span id="eventCountDisplay">0 events</span>
    </div>
</div>

<div id="waterfallTooltip" class="waterfall-tooltip"></div>
<div id="contextMenu" class="context-menu"></div>

<script nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
