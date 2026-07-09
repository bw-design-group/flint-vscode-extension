/**
 * @module CopyTagPathCommand
 * @description Command to copy a tag's full path to the clipboard
 */

import * as vscode from 'vscode';

import { Command } from '@/commands/base/Command';
import { COMMANDS } from '@/core/constants/commands';
import { FlintError } from '@/core/errors';
import { CommandContext } from '@/core/types/commands';
import { TagTreeNode } from '@/views/tagBrowser/TagTreeDataProvider';

/**
 * Copies the full path of a tag to the clipboard
 */
export class CopyTagPathCommand extends Command {
    constructor(context: CommandContext) {
        super(COMMANDS.TAG_COPY_PATH, context);
    }

    protected async executeImpl(...args: unknown[]): Promise<void> {
        const node = args[0] as TagTreeNode | undefined;

        if (!node) {
            throw new FlintError('No tag selected', 'TAG_NO_SELECTION', 'Select a tag to copy its path');
        }

        const pathToCopy = node.fullPath;

        await vscode.env.clipboard.writeText(pathToCopy);
        vscode.window.setStatusBarMessage(`Copied tag path: ${pathToCopy}`, 3000);
    }
}
