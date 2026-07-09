/**
 * @module ReadTagCommand
 * @description Command to read and display the current value of a tag
 */

import * as vscode from 'vscode';

import { Command } from '@/commands/base/Command';
import { COMMANDS } from '@/core/constants/commands';
import { FlintError } from '@/core/errors';
import { CommandContext } from '@/core/types/commands';
import { TagBrowserService } from '@/services/tags/TagBrowserService';
import { TagTreeNode } from '@/views/tagBrowser/TagTreeDataProvider';

/**
 * Reads the current value of a tag and displays it in an information message
 */
export class ReadTagCommand extends Command {
    constructor(context: CommandContext) {
        super(COMMANDS.TAG_READ_VALUE, context);
    }

    protected async executeImpl(...args: unknown[]): Promise<void> {
        const node = args[0] as TagTreeNode | undefined;

        if (!node) {
            throw new FlintError('No tag selected', 'TAG_NO_SELECTION', 'Select a tag to read its value');
        }

        const tagService = this.getService<TagBrowserService>('TagBrowserService');
        const qualifiedPath = node.fullPath;

        try {
            const result = await tagService.read([qualifiedPath]);

            if (result.results.length > 0) {
                const value = result.results[0];
                let valueStr: string;
                if (value.value === null || value.value === undefined) {
                    valueStr = 'null';
                } else if (typeof value.value === 'object') {
                    valueStr = JSON.stringify(value.value);
                } else {
                    valueStr = String(value.value as string | number | boolean);
                }
                void vscode.window.showInformationMessage(
                    `${node.fullPath}: ${valueStr} (${value.dataType}, ${value.quality})`
                );
            } else {
                void vscode.window.showWarningMessage(`No value returned for tag: ${node.fullPath}`);
            }
        } catch (error) {
            throw new FlintError(
                'Failed to read tag value',
                'TAG_READ_FAILED',
                `Could not read value for tag: ${node.fullPath}`,
                error instanceof Error ? error : undefined
            );
        }
    }
}
