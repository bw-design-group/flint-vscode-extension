/**
 * @module ProfilerWebview
 * @description Webview panel for displaying Perspective view performance profiler results.
 * Handles both static analysis results and runtime profiling results.
 */

import * as path from 'path';

import * as vscode from 'vscode';

import { ServiceContainer } from '@/core/ServiceContainer';
import type { PerformanceWarning, ViewAnalysisResult, ViewProfileResult } from '@/core/types/profiler';
import { IServiceLifecycle, ServiceStatus } from '@/core/types/services';

/**
 * Webview panel for displaying profiler results
 */
export class ProfilerWebview implements IServiceLifecycle {
    private static readonly viewType = 'flint.profiler';
    private panel: vscode.WebviewPanel | null = null;
    private isInitialized = false;

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
     * Shows static analysis results in the webview
     */
    async showStaticAnalysis(result: ViewAnalysisResult): Promise<void> {
        await this.ensurePanel('Static Analysis');
        if (!this.panel) {
            return;
        }

        this.panel.title = `Profiler: ${result.viewPath}`;
        this.panel.webview.html = this.generateStaticAnalysisHtml(result, this.panel.webview);
    }

    /**
     * Shows runtime profiling results in the webview
     */
    async showRuntimeProfile(result: ViewProfileResult): Promise<void> {
        await this.ensurePanel('Runtime Profile');
        if (!this.panel) {
            return;
        }

        this.panel.title = `Profile: ${result.viewPath}`;
        this.panel.webview.html = this.generateRuntimeProfileHtml(result, this.panel.webview);
    }

    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================

    private async ensurePanel(subtitle: string): Promise<void> {
        await Promise.resolve();

        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            ProfilerWebview.viewType,
            `Perspective ${subtitle}`,
            vscode.ViewColumn.Two,
            {
                enableScripts: false,
                localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'media'))]
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = null;
        });
    }

    private generateStaticAnalysisHtml(result: ViewAnalysisResult, webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'profiler.css'))
        );

        const m = result.metrics;
        const warningsHtml = this.renderWarnings(result.warnings);
        const bindingsBreakdown = Object.entries(m.bindingsByType)
            .map(([type, count]) => `<tr><td>${escapeHtml(type)}</td><td>${count}</td></tr>`)
            .join('');
        const transformsBreakdown = Object.entries(m.transformsByType)
            .map(([type, count]) => `<tr><td>${escapeHtml(type)}</td><td>${count}</td></tr>`)
            .join('');
        const componentTypesHtml = result.componentTypes
            .map(
                ct =>
                    `<div class="component-type-item"><span class="type-name">${escapeHtml(ct.type)}</span><span class="type-count">${ct.count}</span></div>`
            )
            .join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource};">
    <link href="${styleUri.toString()}" rel="stylesheet">
    <title>View Performance Analysis</title>
</head>
<body>
<div class="profiler-container">
    <div class="profiler-header">
        <div>
            <h1>View Performance Analysis</h1>
            <div class="view-path">${escapeHtml(result.viewPath)}</div>
        </div>
        <span class="analysis-type">Static Analysis</span>
    </div>

    <div class="score-card">
        <div class="score-card-item${m.componentCount >= 250 ? ' severity-high' : m.componentCount >= 100 ? ' severity-medium' : ''}">
            <span class="value">${m.componentCount}</span>
            <span class="label">Components</span>
        </div>
        <div class="score-card-item${m.maxDepth >= 12 ? ' severity-high' : m.maxDepth >= 8 ? ' severity-medium' : ''}">
            <span class="value">${m.maxDepth}</span>
            <span class="label">Max Depth</span>
        </div>
        <div class="score-card-item${m.totalBindings >= 150 ? ' severity-high' : m.totalBindings >= 50 ? ' severity-medium' : ''}">
            <span class="value">${m.totalBindings}</span>
            <span class="label">Bindings</span>
        </div>
        <div class="score-card-item${m.scriptTransformCount >= 30 ? ' severity-high' : m.scriptTransformCount >= 10 ? ' severity-medium' : ''}">
            <span class="value">${m.scriptTransformCount}</span>
            <span class="label">Script Transforms</span>
        </div>
        <div class="score-card-item">
            <span class="value">${m.embeddedViewCount}</span>
            <span class="label">Embedded Views</span>
        </div>
        <div class="score-card-item">
            <span class="value">${formatBytes(result.totalViewSizeBytes)}</span>
            <span class="label">View Size</span>
        </div>
    </div>

    <div class="section">
        <h2>Warnings (${result.warnings.length})</h2>
        ${warningsHtml}
    </div>

    <div class="section">
        <h2>Metrics</h2>
        <table class="metrics-table">
            <thead><tr><th>Metric</th><th>Value</th></tr></thead>
            <tbody>
                <tr><td>Total Components</td><td>${m.componentCount}</td></tr>
                <tr><td>Max Tree Depth</td><td>${m.maxDepth}</td></tr>
                <tr><td>Total Bindings</td><td>${m.totalBindings}</td></tr>
                <tr><td>Total Transforms</td><td>${m.totalTransforms}</td></tr>
                <tr><td>Script Transforms</td><td>${m.scriptTransformCount}</td></tr>
                <tr><td>Embedded Views</td><td>${m.embeddedViewCount}</td></tr>
                <tr><td>Flex Repeaters</td><td>${m.flexRepeaterCount}</td></tr>
                <tr><td>Script Event Handlers</td><td>${m.scriptEventCount}</td></tr>
                <tr><td>Gateway-Scoped Scripts</td><td>${m.gatewayScopedScriptCount}</td></tr>
                <tr><td>Largest Prop Size</td><td>${formatBytes(m.largestPropSizeBytes)}</td></tr>
                <tr><td>Total View Size</td><td>${formatBytes(result.totalViewSizeBytes)}</td></tr>
            </tbody>
        </table>
    </div>

    ${
        bindingsBreakdown
            ? `<div class="section">
        <h2>Bindings by Type</h2>
        <table class="metrics-table">
            <thead><tr><th>Type</th><th>Count</th></tr></thead>
            <tbody>${bindingsBreakdown}</tbody>
        </table>
    </div>`
            : ''
    }

    ${
        transformsBreakdown
            ? `<div class="section">
        <h2>Transforms by Type</h2>
        <table class="metrics-table">
            <thead><tr><th>Type</th><th>Count</th></tr></thead>
            <tbody>${transformsBreakdown}</tbody>
        </table>
    </div>`
            : ''
    }

    ${
        componentTypesHtml
            ? `<div class="section">
        <h2>Component Types</h2>
        <div class="component-type-list">${componentTypesHtml}</div>
    </div>`
            : ''
    }

    <div class="profiler-footer">
        Analyzed at ${new Date(result.analyzedAt).toLocaleString()}
    </div>
</div>
</body>
</html>`;
    }

    private generateRuntimeProfileHtml(result: ViewProfileResult, webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'profiler.css'))
        );

        const warningsHtml = this.renderWarnings(result.warnings);
        const totalBindings = result.totalBindingCount || 1;
        const resolvedPct = Math.round((result.resolvedBindingCount / totalBindings) * 100);
        const pendingPct = Math.round((result.pendingBindingCount / totalBindings) * 100);
        const errorPct = Math.round((result.errorBindingCount / totalBindings) * 100);

        const bindingsBreakdown = Object.entries(result.bindingsByType)
            .map(([type, count]) => `<tr><td>${escapeHtml(type)}</td><td>${count}</td></tr>`)
            .join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource};">
    <link href="${styleUri.toString()}" rel="stylesheet">
    <title>View Runtime Profile</title>
</head>
<body>
<div class="profiler-container">
    <div class="profiler-header">
        <div>
            <h1>Runtime View Profile</h1>
            <div class="view-path">${escapeHtml(result.viewPath)}</div>
        </div>
        <span class="analysis-type">Runtime</span>
    </div>

    <div class="score-card">
        <div class="score-card-item">
            <span class="value">${result.totalComponentCount}</span>
            <span class="label">Components</span>
        </div>
        <div class="score-card-item">
            <span class="value">${result.totalBindingCount}</span>
            <span class="label">Bindings</span>
        </div>
        <div class="score-card-item${result.pendingBindingCount > 0 ? ' severity-medium' : ''}">
            <span class="value">${result.pendingBindingCount}</span>
            <span class="label">Pending</span>
        </div>
        <div class="score-card-item${result.errorBindingCount > 0 ? ' severity-high' : ''}">
            <span class="value">${result.errorBindingCount}</span>
            <span class="label">Errors</span>
        </div>
        <div class="score-card-item">
            <span class="value">${formatBytes(result.totalPropertySizeBytes)}</span>
            <span class="label">Property Size</span>
        </div>
        <div class="score-card-item">
            <span class="value">${result.profilingDurationMs}ms</span>
            <span class="label">Profile Time</span>
        </div>
    </div>

    <div class="section">
        <h2>Binding States</h2>
        <div class="binding-state-bar">
            ${resolvedPct > 0 ? `<div class="binding-state-segment resolved" style="width: ${resolvedPct}%">${result.resolvedBindingCount}</div>` : ''}
            ${pendingPct > 0 ? `<div class="binding-state-segment pending" style="width: ${pendingPct}%">${result.pendingBindingCount}</div>` : ''}
            ${errorPct > 0 ? `<div class="binding-state-segment error" style="width: ${errorPct}%">${result.errorBindingCount}</div>` : ''}
        </div>
        <div class="binding-state-legend">
            <div class="legend-item"><span class="legend-dot resolved"></span> Resolved (${result.resolvedBindingCount})</div>
            <div class="legend-item"><span class="legend-dot pending"></span> Pending (${result.pendingBindingCount})</div>
            <div class="legend-item"><span class="legend-dot error"></span> Error (${result.errorBindingCount})</div>
        </div>
    </div>

    <div class="section">
        <h2>Warnings (${result.warnings.length})</h2>
        ${warningsHtml}
    </div>

    ${
        bindingsBreakdown
            ? `<div class="section">
        <h2>Bindings by Type</h2>
        <table class="metrics-table">
            <thead><tr><th>Type</th><th>Count</th></tr></thead>
            <tbody>${bindingsBreakdown}</tbody>
        </table>
    </div>`
            : ''
    }

    <div class="profiler-footer">
        Profiled in ${result.profilingDurationMs}ms
    </div>
</div>
</body>
</html>`;
    }

    private renderWarnings(warnings: readonly PerformanceWarning[]): string {
        if (warnings.length === 0) {
            return '<div class="no-warnings">No performance warnings detected</div>';
        }

        const items = warnings
            .map(
                w => `<li class="warning-item severity-${w.severity}">
    <span class="warning-badge severity-${w.severity}">${w.severity}</span>
    <div class="warning-content">
        <div class="message">${escapeHtml(w.message)}</div>
        <div class="recommendation">${escapeHtml(w.recommendation)}</div>
    </div>
</li>`
            )
            .join('');

        return `<ul class="warnings-list">${items}</ul>`;
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
