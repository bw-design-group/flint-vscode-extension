/**
 * @module ProfileViewCommand
 * @description Command to perform runtime profiling of a live Perspective view.
 * Connects to a running Perspective session via the Designer bridge and inspects
 * binding states, property sizes, and component-level metrics.
 */

import * as vscode from 'vscode';

import { Command } from '@/commands/base/Command';
import { COMMANDS } from '@/core/constants/commands';
import { FlintError } from '@/core/errors';
import { CommandContext } from '@/core/types/commands';
import type { PerspectivePageInfo, PerspectiveSessionInfo, PerspectiveViewInfo } from '@/core/types/perspective';
import type { ViewProfileResult } from '@/core/types/profiler';
import { ConnectionState, DesignerBridgeService } from '@/services/designer';
import { ProfilerWebview } from '@/views/webview/ProfilerWebview';

/**
 * Command that profiles a live Perspective view via the Designer bridge
 */
export class ProfileViewCommand extends Command {
    constructor(context: CommandContext) {
        super(COMMANDS.PROFILE_VIEW_PERFORMANCE, context);
    }

    protected async executeImpl(): Promise<void> {
        // Ensure Designer bridge is connected
        const bridgeService = this.getService<DesignerBridgeService>('DesignerBridgeService');
        if (bridgeService.getConnectionState() !== ConnectionState.CONNECTED) {
            const connect = await vscode.window.showWarningMessage(
                'Not connected to Designer. Connect first to profile a live view.',
                'Connect'
            );
            if (connect === 'Connect') {
                await bridgeService.selectAndConnect();
            }
            if (bridgeService.getConnectionState() !== ConnectionState.CONNECTED) {
                return;
            }
        }

        const connectionManager = bridgeService.getConnectionManager();

        // Check Perspective availability
        try {
            const available = await connectionManager.isPerspectiveAvailable();
            if (!available) {
                vscode.window.showErrorMessage('Perspective module is not available on this gateway');
                return;
            }
        } catch {
            vscode.window.showErrorMessage('Failed to check Perspective availability');
            return;
        }

        // Select session
        const sessionsResult = await connectionManager.perspectiveListSessions();
        const sessions: PerspectiveSessionInfo[] = sessionsResult.sessions ?? [];

        if (sessions.length === 0) {
            vscode.window.showWarningMessage('No active Perspective sessions found');
            return;
        }

        const sessionItems = sessions.map(s => ({
            label: s.userName || 'Unknown User',
            description: s.projectName,
            detail: `${s.viewCount} views, started ${new Date(s.startTime).toLocaleTimeString()}`,
            sessionId: s.sessionId
        }));

        const selectedSession = await vscode.window.showQuickPick(sessionItems, {
            placeHolder: 'Select a Perspective session to profile',
            title: 'Perspective Session'
        });

        if (!selectedSession) {
            return;
        }

        // Select page
        const pagesResult = await connectionManager.perspectiveGetSessionPages(selectedSession.sessionId);
        const pages: PerspectivePageInfo[] = pagesResult.pages ?? [];

        if (pages.length === 0) {
            vscode.window.showWarningMessage('No pages found in selected session');
            return;
        }

        let selectedPage: { pageId: string; label: string };
        if (pages.length === 1) {
            selectedPage = { pageId: pages[0].pageId, label: pages[0].primaryViewPath };
        } else {
            const pageItems = pages.map(p => ({
                label: p.primaryViewPath,
                description: `${p.viewCount} views`,
                pageId: p.pageId
            }));

            const picked = await vscode.window.showQuickPick(pageItems, {
                placeHolder: 'Select a page',
                title: 'Perspective Page'
            });

            if (!picked) {
                return;
            }
            selectedPage = picked;
        }

        // Select view
        const viewsResult = await connectionManager.perspectiveGetPageViews(
            selectedSession.sessionId,
            selectedPage.pageId
        );
        const views: PerspectiveViewInfo[] = viewsResult.views ?? [];

        if (views.length === 0) {
            vscode.window.showWarningMessage('No views found on selected page');
            return;
        }

        let selectedView: { viewInstanceId: string; viewPath: string };
        if (views.length === 1) {
            selectedView = { viewInstanceId: views[0].viewInstanceId, viewPath: views[0].viewPath };
        } else {
            const viewItems = views.map(v => ({
                label: v.viewPath,
                description: `${v.componentCount} components`,
                viewInstanceId: v.viewInstanceId,
                viewPath: v.viewPath
            }));

            const picked = await vscode.window.showQuickPick(viewItems, {
                placeHolder: 'Select a view to profile',
                title: 'Perspective View'
            });

            if (!picked) {
                return;
            }
            selectedView = picked;
        }

        // Run the profiler
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Profiling Perspective view...',
                cancellable: false
            },
            async () => {
                try {
                    const result: ViewProfileResult = await connectionManager.perspectiveProfileView(
                        selectedSession.sessionId,
                        selectedPage.pageId,
                        selectedView.viewInstanceId
                    );

                    // Display results
                    const profilerWebview = this.getService<ProfilerWebview>('ProfilerWebview');
                    await profilerWebview.showRuntimeProfile(result);

                    // Summary notification
                    const errorCount = result.errorBindingCount;
                    if (errorCount > 0) {
                        vscode.window.showWarningMessage(
                            `Profile complete: ${result.totalComponentCount} components, ${errorCount} binding errors`
                        );
                    } else {
                        vscode.window.showInformationMessage(
                            `Profile complete: ${result.totalComponentCount} components, ${result.totalBindingCount} bindings`
                        );
                    }
                } catch (error) {
                    throw new FlintError(
                        'Failed to profile view',
                        'PROFILE_FAILED',
                        `Profiling failed: ${error instanceof Error ? error.message : String(error)}`,
                        error instanceof Error ? error : undefined
                    );
                }
            }
        );
    }
}
