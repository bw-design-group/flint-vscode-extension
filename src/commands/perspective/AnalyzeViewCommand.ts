/**
 * @module AnalyzeViewCommand
 * @description Command to perform static performance analysis on a Perspective view.json file.
 * Available from the project browser context menu on Perspective views and from the command palette.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import * as vscode from 'vscode';

import { Command } from '@/commands/base/Command';
import { COMMANDS } from '@/core/constants/commands';
import { FlintError } from '@/core/errors';
import { CommandContext } from '@/core/types/commands';
import { TreeNode } from '@/core/types/tree';
import { analyzeView } from '@/services/perspective/ViewPerformanceAnalyzer';
import { ResourceTypeProviderRegistry } from '@/services/resources/ResourceTypeProviderRegistry';
import { ProfilerWebview } from '@/views/webview/ProfilerWebview';

/**
 * Type guard to check if argument is a TreeNode from the project browser
 */
function isTreeNode(arg: unknown): arg is TreeNode {
    return (
        typeof arg === 'object' &&
        arg !== null &&
        'projectId' in arg &&
        'resourcePath' in arg &&
        ('typeId' in arg || 'resourceType' in arg)
    );
}

/**
 * Command that analyzes a Perspective view.json for performance issues
 */
export class AnalyzeViewCommand extends Command {
    constructor(context: CommandContext) {
        super(COMMANDS.ANALYZE_VIEW_PERFORMANCE, context);
    }

    protected async executeImpl(...args: unknown[]): Promise<void> {
        let viewUri: vscode.Uri | undefined;

        // Check if a TreeNode was passed (from project browser context menu)
        if (args.length > 0 && isTreeNode(args[0])) {
            viewUri = await this.resolveViewUriFromTreeNode(args[0]);
            if (!viewUri) {
                return;
            }
        }

        // Check if a URI was passed (from file explorer or programmatic call)
        if (!viewUri && args.length > 0 && args[0] instanceof vscode.Uri) {
            viewUri = args[0];
        }

        // If no URI, try the active editor
        if (!viewUri) {
            const editor = vscode.window.activeTextEditor;
            if (editor?.document.fileName.endsWith('view.json')) {
                viewUri = editor.document.uri;
            }
        }

        // If still no URI, prompt the user to select a file
        if (!viewUri) {
            const selected = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: { 'View JSON': ['json'] },
                title: 'Select a Perspective view.json file'
            });

            if (!selected || selected.length === 0) {
                return;
            }

            viewUri = selected[0];
        }

        // Read and parse the file
        let viewJson: Record<string, unknown>;
        try {
            const content = await fs.readFile(viewUri.fsPath, 'utf8');
            viewJson = JSON.parse(content) as Record<string, unknown>;
        } catch (error) {
            throw new FlintError(
                'Failed to read or parse view.json',
                'VIEW_PARSE_FAILED',
                `Could not parse ${viewUri.fsPath}: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : undefined
            );
        }

        // Validate it looks like a view.json
        if (!viewJson.root) {
            throw new FlintError(
                'Not a valid Perspective view.json',
                'INVALID_VIEW_JSON',
                'The file does not contain a "root" property expected in a Perspective view.json'
            );
        }

        // Extract a display path from the file path
        const viewPath = extractViewPath(viewUri.fsPath);

        // Run the analysis
        const result = analyzeView(viewJson, viewPath);

        // Display results
        const profilerWebview = this.getService<ProfilerWebview>('ProfilerWebview');
        await profilerWebview.showStaticAnalysis(result);

        // Show a summary notification
        const warningCount = result.warnings.length;
        const highCount = result.warnings.filter(w => w.severity === 'high').length;

        if (highCount > 0) {
            vscode.window.showWarningMessage(
                `View analysis complete: ${result.metrics.componentCount} components, ${warningCount} warnings (${highCount} high)`
            );
        } else if (warningCount > 0) {
            vscode.window.showInformationMessage(
                `View analysis complete: ${result.metrics.componentCount} components, ${warningCount} warnings`
            );
        } else {
            vscode.window.showInformationMessage(
                `View analysis complete: ${result.metrics.componentCount} components, no performance warnings`
            );
        }
    }

    /**
     * Resolves the view.json URI from a project browser TreeNode
     */
    private async resolveViewUriFromTreeNode(node: TreeNode): Promise<vscode.Uri | undefined> {
        const typeId = node.typeId ?? node.resourceType;
        if (typeId !== 'perspective-view') {
            vscode.window.showWarningMessage('View analysis is only available for Perspective views');
            return undefined;
        }

        const projectId = node.projectId;
        const resourcePath = node.resourcePath;
        if (!projectId || !resourcePath) {
            vscode.window.showErrorMessage('Missing project or resource path information');
            return undefined;
        }

        const resourceRegistry = this.getService<ResourceTypeProviderRegistry>('ResourceTypeProviderRegistry');
        const provider = resourceRegistry.getProvider(typeId);
        if (!provider) {
            vscode.window.showErrorMessage('Perspective view resource provider not found');
            return undefined;
        }

        const searchConfig = provider.getSearchConfig();
        const directoryPaths = searchConfig.directoryPaths ?? [];
        if (directoryPaths.length === 0) {
            return undefined;
        }

        const resourceDirectory = directoryPaths[0];
        const editorConfig = provider.getEditorConfig();
        const primaryFile = editorConfig?.primaryFile ?? 'view.json';

        // Get project base path from workspace config
        const workspaceConfig = this.getService<any>('WorkspaceConfigService');
        const projectPaths: string[] = await workspaceConfig.getProjectPaths();

        for (const basePath of projectPaths) {
            const candidatePath = path.join(basePath, projectId);
            try {
                await fs.access(candidatePath);

                // Strip the resource directory prefix if already included
                let relativeResourcePath = resourcePath;
                if (resourcePath.startsWith(`${resourceDirectory}/`)) {
                    relativeResourcePath = resourcePath.substring(resourceDirectory.length + 1);
                }

                const viewJsonPath = path.join(candidatePath, resourceDirectory, relativeResourcePath, primaryFile);
                await fs.access(viewJsonPath);
                return vscode.Uri.file(viewJsonPath);
            } catch {
                // Try next path
            }
        }

        vscode.window.showErrorMessage(`Could not find view.json for resource '${resourcePath}'`);
        return undefined;
    }
}

/**
 * Extracts a human-readable view path from a file system path.
 * Looks for the views/ directory marker in the path.
 */
function extractViewPath(fsPath: string): string {
    const viewsMarker = '/views/';
    const idx = fsPath.lastIndexOf(viewsMarker);
    if (idx >= 0) {
        // Get the part after /views/, removing the trailing /view.json
        let viewPath = fsPath.substring(idx + viewsMarker.length);
        if (viewPath.endsWith('/view.json')) {
            viewPath = viewPath.slice(0, -'/view.json'.length);
        }
        return viewPath;
    }

    // Fallback: just use the filename's parent directory name
    const parts = fsPath.split('/');
    const viewJsonIdx = parts.indexOf('view.json');
    if (viewJsonIdx > 0) {
        return parts[viewJsonIdx - 1];
    }

    return fsPath;
}
