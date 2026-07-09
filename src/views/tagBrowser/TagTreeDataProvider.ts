/**
 * @module TagTreeDataProvider
 * @description Tree data provider for the Ignition Tag Browser view
 */

import * as vscode from 'vscode';

import { IServiceLifecycle, ServiceStatus } from '@/core/types/services';
import { TagNodeInfo, TagType, TagValueInfo } from '@/core/types/tags';
import { TagBrowserService } from '@/services/tags/TagBrowserService';

/**
 * Cache entry with TTL tracking
 */
interface CacheEntry {
    tags: TagNodeInfo[];
    timestamp: number;
}

/**
 * Options for constructing a TagTreeNode
 */
interface TagTreeNodeOptions {
    label: string;
    nodeType: 'provider' | 'folder' | 'atomicTag' | 'udtType' | 'udtInstance';
    fullPath: string;
    providerName: string;
    collapsibleState: vscode.TreeItemCollapsibleState;
    dataType?: string;
    valueSource?: string;
}

/**
 * Tag tree node for the VS Code tree view
 */
export class TagTreeNode extends vscode.TreeItem {
    public readonly nodeType: TagTreeNodeOptions['nodeType'];
    public readonly fullPath: string;
    public readonly providerName: string;
    public readonly dataType?: string;
    public readonly valueSource?: string;

    constructor(options: TagTreeNodeOptions) {
        super(options.label, options.collapsibleState);
        this.nodeType = options.nodeType;
        this.fullPath = options.fullPath;
        this.providerName = options.providerName;
        this.dataType = options.dataType;
        this.valueSource = options.valueSource;

        this.contextValue = `tag:${options.nodeType}`;
        this.tooltip = options.fullPath;
        this.id = `${options.providerName}:${options.fullPath}`;

        // Set icons based on node type
        switch (options.nodeType) {
            case 'provider':
                this.iconPath = new vscode.ThemeIcon('database');
                break;
            case 'folder':
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            case 'atomicTag':
                this.iconPath = new vscode.ThemeIcon('symbol-variable');
                break;
            case 'udtType':
                this.iconPath = new vscode.ThemeIcon('symbol-class');
                break;
            case 'udtInstance':
                this.iconPath = new vscode.ThemeIcon('symbol-object');
                break;
            default:
                break;
        }
    }
}

/**
 * Tree data provider for browsing Ignition tags
 */
export class TagTreeDataProvider implements vscode.TreeDataProvider<TagTreeNode>, IServiceLifecycle {
    private static readonly CACHE_TTL_MS = 60_000;
    private static readonly POLL_INTERVAL_MS = 5_000;
    private static readonly MAX_POLL_TAGS = 100;

    private readonly _onDidChangeTreeData = new vscode.EventEmitter<TagTreeNode | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private status: ServiceStatus = ServiceStatus.NOT_INITIALIZED;
    private cache = new Map<string, CacheEntry>();
    private valueCache = new Map<string, TagValueInfo>();
    private pollTimer?: ReturnType<typeof setInterval>;
    private visibleAtomicTags: TagTreeNode[] = [];
    private isTreeVisible = false;

    constructor(private readonly tagBrowserService: TagBrowserService) {}

    initialize(): Promise<void> {
        this.status = ServiceStatus.INITIALIZED;
        return Promise.resolve();
    }

    async start(): Promise<void> {
        if (this.status !== ServiceStatus.INITIALIZED && this.status !== ServiceStatus.STOPPED) {
            await this.initialize();
        }
        this.status = ServiceStatus.RUNNING;
    }

    stop(): Promise<void> {
        this.stopPolling();
        this.status = ServiceStatus.STOPPED;
        return Promise.resolve();
    }

    dispose(): Promise<void> {
        this.stopPolling();
        this._onDidChangeTreeData.dispose();
        this.cache.clear();
        this.valueCache.clear();
        this.status = ServiceStatus.DISPOSED;
        return Promise.resolve();
    }

    getStatus(): ServiceStatus {
        return this.status;
    }

    /**
     * Handles tree view visibility changes
     */
    handleVisibilityChange(visible: boolean): void {
        this.isTreeVisible = visible;
        if (visible) {
            this.startPolling();
        } else {
            this.stopPolling();
        }
    }

    /**
     * Clears the cache and refreshes the entire tree
     */
    refresh(): void {
        this.cache.clear();
        this.valueCache.clear();
        this.visibleAtomicTags = [];
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TagTreeNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TagTreeNode): Promise<TagTreeNode[]> {
        if (!this.tagBrowserService.isConnected()) {
            return [];
        }

        try {
            if (!element) {
                return await this.getRootNodes();
            }

            if (element.nodeType === 'provider') {
                return await this.getTagChildren(element.providerName, '');
            }

            if (element.nodeType === 'folder' || element.nodeType === 'udtType' || element.nodeType === 'udtInstance') {
                return await this.getTagChildren(element.providerName, element.fullPath);
            }

            return [];
        } catch (error) {
            console.error('[TagTreeDataProvider] Error getting children:', error);
            return [];
        }
    }

    /**
     * Gets the root-level provider nodes
     */
    private async getRootNodes(): Promise<TagTreeNode[]> {
        try {
            const result = await this.tagBrowserService.getProviders();

            return result.providers.map(
                provider =>
                    new TagTreeNode({
                        label: provider.name,
                        nodeType: 'provider',
                        fullPath: '',
                        providerName: provider.name,
                        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
                    })
            );
        } catch (error) {
            console.error('[TagTreeDataProvider] Error fetching providers:', error);
            return [];
        }
    }

    /**
     * Gets tag children for a given provider and parent path
     */
    private async getTagChildren(providerName: string, parentPath: string): Promise<TagTreeNode[]> {
        const cacheKey = `${providerName}:${parentPath}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < TagTreeDataProvider.CACHE_TTL_MS) {
            return this.buildNodes(cached.tags, providerName);
        }

        try {
            const result = await this.tagBrowserService.browse(providerName, parentPath);
            const tags = result.results;

            this.cache.set(cacheKey, { tags, timestamp: Date.now() });

            return this.buildNodes(tags, providerName);
        } catch (error) {
            console.error(`[TagTreeDataProvider] Error browsing tags at ${cacheKey}:`, error);
            return [];
        }
    }

    /**
     * Builds TagTreeNode instances from TagNodeInfo data
     */
    private buildNodes(tags: TagNodeInfo[], providerName: string): TagTreeNode[] {
        const nodes: TagTreeNode[] = [];
        const atomicTags: TagTreeNode[] = [];

        for (const tag of tags) {
            const nodeType = this.mapTagType(tag.tagType);
            const isCollapsible = tag.hasChildren;
            const collapsibleState = isCollapsible
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;

            const node = new TagTreeNode({
                label: tag.name,
                nodeType,
                fullPath: tag.fullPath,
                providerName,
                collapsibleState,
                dataType: tag.dataType,
                valueSource: tag.valueSource
            });

            // Set description for atomic tags from cached values
            if (nodeType === 'atomicTag') {
                const cachedValue = this.valueCache.get(tag.fullPath);
                if (cachedValue) {
                    node.description = this.formatValueDescription(cachedValue);
                }
                atomicTags.push(node);
            }

            nodes.push(node);
        }

        // Track visible atomic tags for polling
        this.visibleAtomicTags = [
            ...this.visibleAtomicTags.filter(t => !tags.some(tag => tag.fullPath === t.fullPath)),
            ...atomicTags
        ].slice(0, TagTreeDataProvider.MAX_POLL_TAGS);

        return nodes;
    }

    /**
     * Maps a TagType enum to the node type string
     */
    private mapTagType(tagType: TagType): 'atomicTag' | 'folder' | 'udtType' | 'udtInstance' {
        switch (tagType) {
            case TagType.AtomicTag:
                return 'atomicTag';
            case TagType.Folder:
                return 'folder';
            case TagType.UdtType:
                return 'udtType';
            case TagType.UdtInstance:
                return 'udtInstance';
            default:
                return 'atomicTag';
        }
    }

    /**
     * Formats a tag value info as a description string
     */
    private formatValueDescription(valueInfo: TagValueInfo): string {
        let valueStr: string;
        if (valueInfo.value === null || valueInfo.value === undefined) {
            valueStr = 'null';
        } else if (typeof valueInfo.value === 'object') {
            valueStr = JSON.stringify(valueInfo.value);
        } else {
            valueStr = String(valueInfo.value as string | number | boolean);
        }
        return `${valueStr} [${valueInfo.quality}]`;
    }

    /**
     * Starts the value polling timer
     */
    private startPolling(): void {
        if (this.pollTimer) {
            return;
        }

        this.pollTimer = setInterval(() => {
            void this.pollValues();
        }, TagTreeDataProvider.POLL_INTERVAL_MS);
    }

    /**
     * Stops the value polling timer
     */
    private stopPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
    }

    /**
     * Polls current values for visible atomic tags and fires tree updates for changed items
     */
    private async pollValues(): Promise<void> {
        if (!this.isTreeVisible || !this.tagBrowserService.isConnected() || this.visibleAtomicTags.length === 0) {
            return;
        }

        const paths = this.visibleAtomicTags.map(t => t.fullPath);

        try {
            const result = await this.tagBrowserService.read(paths);
            const changedNodes: TagTreeNode[] = [];

            for (const valueInfo of result.results) {
                const previous = this.valueCache.get(valueInfo.path);
                const previousDesc = previous ? this.formatValueDescription(previous) : undefined;
                const newDesc = this.formatValueDescription(valueInfo);

                this.valueCache.set(valueInfo.path, valueInfo);

                if (previousDesc !== newDesc) {
                    const node = this.visibleAtomicTags.find(t => t.fullPath === valueInfo.path);
                    if (node) {
                        changedNodes.push(node);
                    }
                }
            }

            // Only fire change events for items whose values actually changed
            for (const node of changedNodes) {
                this._onDidChangeTreeData.fire(node);
            }
        } catch (error) {
            // Silently handle poll errors to avoid spamming the user
            console.debug('[TagTreeDataProvider] Value poll error:', error);
        }
    }
}
