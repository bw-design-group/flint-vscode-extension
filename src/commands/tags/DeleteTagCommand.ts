/**
 * @module DeleteTagCommand
 * @description Command to delete a tag
 */

import * as vscode from 'vscode';

import { Command } from '@/commands/base/Command';
import { COMMANDS } from '@/core/constants/commands';
import { FlintError } from '@/core/errors';
import { CommandContext } from '@/core/types/commands';
import { TagBrowserService } from '@/services/tags/TagBrowserService';
import { TagTreeDataProvider, TagTreeNode } from '@/views/tagBrowser/TagTreeDataProvider';

/**
 * Deletes a tag after confirmation
 */
export class DeleteTagCommand extends Command {
    constructor(context: CommandContext) {
        super(COMMANDS.TAG_DELETE, context);
    }

    protected async executeImpl(...args: unknown[]): Promise<void> {
        const node = args[0] as TagTreeNode | undefined;

        if (!node) {
            throw new FlintError('No tag selected', 'TAG_NO_SELECTION', 'Select a tag to delete');
        }

        const confirmation = await vscode.window.showWarningMessage(
            `Are you sure you want to delete '${node.fullPath}'? This cannot be undone.`,
            { modal: true },
            'Delete'
        );

        if (confirmation !== 'Delete') {
            return;
        }

        const tagService = this.getService<TagBrowserService>('TagBrowserService');
        const qualifiedPath = node.fullPath;

        try {
            const result = await tagService.delete(qualifiedPath);

            const allSucceeded = result.results.length > 0 && result.results.every(r => r.success);
            if (allSucceeded) {
                void vscode.window.showInformationMessage(`Tag '${node.fullPath}' deleted successfully`);

                // Refresh the tree
                const treeProvider = this.getService<TagTreeDataProvider>('TagTreeDataProvider');
                treeProvider.refresh();
            } else {
                const errors = result.results.filter(r => !r.success).map(r => r.error ?? 'Unknown');
                void vscode.window.showErrorMessage(`Failed to delete tag: ${errors.join(', ')}`);
            }
        } catch (error) {
            throw new FlintError(
                'Failed to delete tag',
                'TAG_DELETE_FAILED',
                `Could not delete tag '${node.fullPath}'`,
                error instanceof Error ? error : undefined
            );
        }
    }
}
