/**
 * @module ProfilePageCommand
 * @description Command to open the page binding profiler for live Perspective pages.
 * Opens in idle mode where the user configures scope and poll rate before starting.
 */

import * as vscode from 'vscode';

import { Command } from '@/commands/base/Command';
import { COMMANDS } from '@/core/constants/commands';
import { CommandContext } from '@/core/types/commands';
import { ConnectionState, DesignerBridgeService } from '@/services/designer';
import { PageProfilerWebview } from '@/views/webview/PageProfilerWebview';

/**
 * Command that opens the page binding profiler in idle mode
 */
export class ProfilePageCommand extends Command {
    constructor(context: CommandContext) {
        super(COMMANDS.PROFILE_PAGE, context);
    }

    protected async executeImpl(): Promise<void> {
        // Ensure Designer bridge is connected
        const bridgeService = this.getService<DesignerBridgeService>('DesignerBridgeService');
        if (bridgeService.getConnectionState() !== ConnectionState.CONNECTED) {
            const connect = await vscode.window.showWarningMessage(
                'Not connected to Designer. Connect first to profile a page.',
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

        // Open profiler in idle mode — user configures scope and starts from the webview
        const profilerWebview = this.getService<PageProfilerWebview>('PageProfilerWebview');
        await profilerWebview.openIdle(connectionManager);
    }
}
