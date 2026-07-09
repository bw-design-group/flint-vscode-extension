/**
 * @module GetTagConfigCommand
 * @description Command to fetch and display tag configuration JSON
 */

import * as vscode from 'vscode';

import { Command } from '@/commands/base/Command';
import { COMMANDS } from '@/core/constants/commands';
import { FlintError } from '@/core/errors';
import { CommandContext } from '@/core/types/commands';
import { TagBrowserService } from '@/services/tags/TagBrowserService';
import { TagTreeNode } from '@/views/tagBrowser/TagTreeDataProvider';

/**
 * Fetches the full configuration for a tag and opens it in an untitled JSON editor
 */
export class GetTagConfigCommand extends Command {
    constructor(context: CommandContext) {
        super(COMMANDS.TAG_GET_CONFIG, context);
    }

    protected async executeImpl(...args: unknown[]): Promise<void> {
        const node = args[0] as TagTreeNode | undefined;

        if (!node) {
            throw new FlintError('No tag selected', 'TAG_NO_SELECTION', 'Select a tag to view its configuration');
        }

        const tagService = this.getService<TagBrowserService>('TagBrowserService');
        const qualifiedPath = node.fullPath;

        try {
            const result = await tagService.getConfig(qualifiedPath);
            const configJson = JSON.stringify(result.config, null, 2);

            const document = await vscode.workspace.openTextDocument({
                content: configJson,
                language: 'json'
            });

            await vscode.window.showTextDocument(document);
        } catch (error) {
            throw new FlintError(
                'Failed to get tag configuration',
                'TAG_CONFIG_FAILED',
                `Could not fetch configuration for tag: ${node.fullPath}`,
                error instanceof Error ? error : undefined
            );
        }
    }
}
