/**
 * @module TagBrowserService
 * @description Service for browsing and interacting with Ignition tags via the Designer bridge
 */

import { FlintError } from '@/core/errors';
import { ServiceContainer } from '@/core/ServiceContainer';
import { IServiceLifecycle, ServiceStatus } from '@/core/types/services';
import {
    TagBrowseResult,
    TagConfigResult,
    TagCreateParams,
    TagCreateResult,
    TagDeleteResult,
    TagEditResult,
    TagProvidersResult,
    TagReadResult,
    TagWriteResult
} from '@/core/types/tags';
import { ConnectionState, DesignerBridgeService } from '@/services/designer';

/**
 * Service for browsing, reading, writing, and managing Ignition tags
 * through the Designer bridge WebSocket connection.
 */
export class TagBrowserService implements IServiceLifecycle {
    private status: ServiceStatus = ServiceStatus.NOT_INITIALIZED;
    private bridgeService!: DesignerBridgeService;

    constructor(private readonly serviceContainer: ServiceContainer) {}

    initialize(): Promise<void> {
        this.status = ServiceStatus.INITIALIZING;

        try {
            this.bridgeService = this.serviceContainer.get<DesignerBridgeService>('DesignerBridgeService');
            this.status = ServiceStatus.INITIALIZED;
        } catch (error) {
            this.status = ServiceStatus.FAILED;
            throw new FlintError(
                'Failed to initialize tag browser service',
                'TAG_BROWSER_INIT_FAILED',
                'Could not initialize tag browser service',
                error instanceof Error ? error : undefined
            );
        }

        return Promise.resolve();
    }

    async start(): Promise<void> {
        if (this.status !== ServiceStatus.INITIALIZED && this.status !== ServiceStatus.STOPPED) {
            await this.initialize();
        }

        this.status = ServiceStatus.RUNNING;
    }

    stop(): Promise<void> {
        this.status = ServiceStatus.STOPPED;
        return Promise.resolve();
    }

    async dispose(): Promise<void> {
        await this.stop();
        this.status = ServiceStatus.DISPOSED;
    }

    getStatus(): ServiceStatus {
        return this.status;
    }

    /**
     * Checks if the Designer bridge is connected
     */
    isConnected(): boolean {
        return this.bridgeService.getConnectionState() === ConnectionState.CONNECTED;
    }

    /**
     * Browses tags at a given path
     */
    async browse(
        provider?: string,
        parentPath?: string,
        typeFilter?: string,
        nameFilter?: string
    ): Promise<TagBrowseResult> {
        this.ensureConnected();

        return this.bridgeService.getConnectionManager().sendRequest<TagBrowseResult>('tags.browse', {
            provider: provider ?? 'default',
            parentPath: parentPath ?? '',
            typeFilter,
            nameFilter
        });
    }

    /**
     * Reads the current value of one or more tags
     */
    async read(paths: string[]): Promise<TagReadResult> {
        this.ensureConnected();

        return this.bridgeService.getConnectionManager().sendRequest<TagReadResult>('tags.read', {
            tagPaths: paths
        });
    }

    /**
     * Writes values to one or more tags
     */
    async write(writes: Array<{ path: string; value: unknown }>): Promise<TagWriteResult> {
        this.ensureConnected();

        return this.bridgeService.getConnectionManager().sendRequest<TagWriteResult>('tags.write', {
            writes
        });
    }

    /**
     * Gets the full configuration for a tag
     */
    async getConfig(tagPath: string): Promise<TagConfigResult> {
        this.ensureConnected();

        return this.bridgeService.getConnectionManager().sendRequest<TagConfigResult>('tags.getConfig', {
            tagPath
        });
    }

    /**
     * Creates a new tag
     */
    async create(params: TagCreateParams): Promise<TagCreateResult> {
        this.ensureConnected();

        return this.bridgeService.getConnectionManager().sendRequest<TagCreateResult>('tags.create', {
            parentPath: params.parentPath,
            tags: [
                {
                    name: params.name,
                    tagType: params.tagType,
                    dataType: params.dataType
                }
            ]
        });
    }

    /**
     * Edits an existing tag's configuration
     */
    async edit(tagPath: string, config: Record<string, unknown>): Promise<TagEditResult> {
        this.ensureConnected();

        return this.bridgeService.getConnectionManager().sendRequest<TagEditResult>('tags.edit', {
            tagPath,
            config
        });
    }

    /**
     * Deletes a tag
     */
    async delete(tagPath: string): Promise<TagDeleteResult> {
        this.ensureConnected();

        return this.bridgeService.getConnectionManager().sendRequest<TagDeleteResult>('tags.delete', {
            tagPaths: [tagPath]
        });
    }

    /**
     * Gets all available tag providers
     */
    async getProviders(): Promise<TagProvidersResult> {
        this.ensureConnected();

        return this.bridgeService.getConnectionManager().sendRequest<TagProvidersResult>('tags.getProviders');
    }

    /**
     * Ensures the Designer bridge is connected before making requests
     */
    private ensureConnected(): void {
        if (!this.isConnected()) {
            throw new FlintError('Not connected to Designer', 'NOT_CONNECTED', 'Connect to a Designer to browse tags');
        }
    }
}
