/**
 * @module TagTypes
 * @description Tag system type definitions for Ignition tag browsing and interaction.
 */

export interface TagNodeInfo {
    name: string;
    fullPath: string;
    tagType: TagType;
    dataType?: string;
    hasChildren: boolean;
    valueSource?: string;
}

export interface TagValueInfo {
    path: string;
    value: unknown;
    dataType: string;
    quality: string;
    timestamp: string;
}

export interface TagWriteEntry {
    path: string;
    value: unknown;
}

export interface TagProviderInfo {
    name: string;
    type: string;
}

export enum TagType {
    AtomicTag = 'AtomicTag',
    Folder = 'Folder',
    UdtType = 'UdtType',
    UdtInstance = 'UdtInstance'
}

export interface TagBrowseResult {
    results: TagNodeInfo[];
}

export interface TagReadResult {
    results: TagValueInfo[];
}

export interface TagWriteStatus {
    path: string;
    success: boolean;
    quality: string;
    error?: string;
}

export interface TagWriteResult {
    results: TagWriteStatus[];
}

export interface TagConfigResult {
    path: string;
    config: Record<string, unknown>;
}

export interface TagCreateParams {
    provider: string;
    parentPath: string;
    name: string;
    tagType: string;
    dataType?: string;
}

export interface TagCreateStatus {
    name: string;
    success: boolean;
    error?: string;
}

export interface TagCreateResult {
    results: TagCreateStatus[];
}

export interface TagDeleteStatus {
    path: string;
    success: boolean;
    error?: string;
}

export interface TagDeleteResult {
    results: TagDeleteStatus[];
}

export interface TagEditResult {
    success: boolean;
    error?: string;
}

export interface TagProvidersResult {
    providers: TagProviderInfo[];
}
