/**
 * @module CreateTagCommand
 * @description Command to create a new tag
 */

import * as vscode from 'vscode';

import { Command } from '@/commands/base/Command';
import { COMMANDS } from '@/core/constants/commands';
import { FlintError } from '@/core/errors';
import { CommandContext } from '@/core/types/commands';
import { TagBrowserService } from '@/services/tags/TagBrowserService';
import { TagTreeDataProvider, TagTreeNode } from '@/views/tagBrowser/TagTreeDataProvider';

/**
 * Creates a new tag under a provider or folder
 */
export class CreateTagCommand extends Command {
    constructor(context: CommandContext) {
        super(COMMANDS.TAG_CREATE, context);
    }

    protected async executeImpl(...args: unknown[]): Promise<void> {
        const node = args[0] as TagTreeNode | undefined;

        if (!node) {
            throw new FlintError(
                'No location selected',
                'TAG_NO_SELECTION',
                'Select a provider or folder to create a tag in'
            );
        }

        // Prompt for tag name
        const name = await vscode.window.showInputBox({
            prompt: 'Enter the tag name',
            placeHolder: 'NewTag',
            title: 'Create Tag',
            validateInput: value => {
                if (!value || value.trim().length === 0) {
                    return 'Tag name is required';
                }
                if (/[/\\]/.test(value)) {
                    return 'Tag name cannot contain path separators';
                }
                return undefined;
            }
        });

        if (!name) {
            return;
        }

        // Prompt for tag type
        const tagType = await vscode.window.showQuickPick(
            [
                { label: 'Atomic Tag', value: 'AtomicTag' },
                { label: 'Folder', value: 'Folder' },
                { label: 'UDT Definition', value: 'UdtType' },
                { label: 'UDT Instance', value: 'UdtInstance' }
            ],
            { placeHolder: 'Select tag type', title: 'Tag Type' }
        );

        if (!tagType) {
            return;
        }

        // Prompt for data type if atomic tag
        let dataType: string | undefined;
        if (tagType.value === 'AtomicTag') {
            const selectedDataType = await vscode.window.showQuickPick(
                ['Int4', 'Int8', 'Float4', 'Float8', 'Boolean', 'String', 'DateTime', 'Int1', 'Int2'],
                { placeHolder: 'Select data type', title: 'Data Type' }
            );

            if (!selectedDataType) {
                return;
            }

            dataType = selectedDataType;
        }

        const tagService = this.getService<TagBrowserService>('TagBrowserService');
        const parentPath = node.nodeType === 'provider' ? `[${node.providerName}]` : node.fullPath;

        try {
            const result = await tagService.create({
                provider: node.providerName,
                parentPath,
                name: name.trim(),
                tagType: tagType.value,
                dataType
            });

            const allSucceeded = result.results.length > 0 && result.results.every(r => r.success);
            if (allSucceeded) {
                void vscode.window.showInformationMessage(`Tag '${name}' created successfully`);

                // Refresh the tree
                const treeProvider = this.getService<TagTreeDataProvider>('TagTreeDataProvider');
                treeProvider.refresh();
            } else {
                const errors = result.results.filter(r => !r.success).map(r => r.error ?? 'Unknown');
                void vscode.window.showErrorMessage(`Failed to create tag: ${errors.join(', ')}`);
            }
        } catch (error) {
            throw new FlintError(
                'Failed to create tag',
                'TAG_CREATE_FAILED',
                `Could not create tag '${name}'`,
                error instanceof Error ? error : undefined
            );
        }
    }
}
