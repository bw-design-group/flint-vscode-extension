/**
 * @module WriteTagCommand
 * @description Command to write a value to a tag
 */

import * as vscode from 'vscode';

import { Command } from '@/commands/base/Command';
import { COMMANDS } from '@/core/constants/commands';
import { FlintError } from '@/core/errors';
import { CommandContext } from '@/core/types/commands';
import { TagBrowserService } from '@/services/tags/TagBrowserService';
import { TagTreeNode } from '@/views/tagBrowser/TagTreeDataProvider';

/**
 * Prompts for a new value and writes it to a tag
 */
export class WriteTagCommand extends Command {
    constructor(context: CommandContext) {
        super(COMMANDS.TAG_WRITE_VALUE, context);
    }

    protected async executeImpl(...args: unknown[]): Promise<void> {
        const node = args[0] as TagTreeNode | undefined;

        if (!node) {
            throw new FlintError('No tag selected', 'TAG_NO_SELECTION', 'Select a tag to write a value');
        }

        const newValue = await vscode.window.showInputBox({
            prompt: `Enter new value for ${node.fullPath}`,
            placeHolder: 'New value',
            title: 'Write Tag Value'
        });

        if (newValue === undefined) {
            return;
        }

        const tagService = this.getService<TagBrowserService>('TagBrowserService');
        const qualifiedPath = node.fullPath;

        try {
            const result = await tagService.write([{ path: qualifiedPath, value: newValue }]);

            const allSucceeded = result.results.length > 0 && result.results.every(r => r.success);
            if (allSucceeded) {
                void vscode.window.showInformationMessage(`Successfully wrote value to ${node.fullPath}`);
            } else {
                const errors = result.results.filter(r => !r.success).map(r => r.error ?? 'Unknown');
                void vscode.window.showErrorMessage(`Failed to write tag: ${errors.join(', ')}`);
            }
        } catch (error) {
            throw new FlintError(
                'Failed to write tag value',
                'TAG_WRITE_FAILED',
                `Could not write value to tag: ${node.fullPath}`,
                error instanceof Error ? error : undefined
            );
        }
    }
}
