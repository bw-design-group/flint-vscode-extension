/**
 * @module RefreshTagBrowserCommand
 * @description Command to refresh the tag browser tree view
 */

import { Command } from '@/commands/base/Command';
import { COMMANDS } from '@/core/constants/commands';
import { CommandContext } from '@/core/types/commands';
import { TagTreeDataProvider } from '@/views/tagBrowser/TagTreeDataProvider';

/**
 * Refreshes the tag browser by clearing the cache and re-browsing
 */
export class RefreshTagBrowserCommand extends Command {
    constructor(context: CommandContext) {
        super(COMMANDS.TAG_REFRESH, context);
    }

    protected executeImpl(): Promise<void> {
        const treeProvider = this.getService<TagTreeDataProvider>('TagTreeDataProvider');
        treeProvider.refresh();
        return Promise.resolve();
    }
}
