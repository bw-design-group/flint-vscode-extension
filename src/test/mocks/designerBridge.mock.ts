/**
 * @module designerBridge.mock
 * @description Mock implementation of the Designer Bridge Service for unit tests
 */

import { MockLifecycleService } from './services.mock';

/**
 * Mock Designer Bridge Service for testing.
 */
export class MockDesignerBridgeService extends MockLifecycleService {
    private connected = false;
    private designerPid: number | null = null;
    private messages: Array<{ method: string; params?: unknown; response?: unknown }> = [];

    // Connection state
    isConnected(): boolean {
        return this.connected;
    }

    setConnected(connected: boolean, pid?: number): void {
        this.connected = connected;
        this.designerPid = pid ?? null;
    }

    getDesignerPid(): number | null {
        return this.designerPid;
    }

    // Message tracking
    sendRequest(method: string, params?: unknown): Promise<unknown> {
        const entry = { method, params, response: undefined as unknown };

        // Return canned responses based on method
        switch (method) {
            case 'ping':
                entry.response = { status: 'ok', projectName: 'TestProject', authenticated: true };
                break;
            case 'executeScript':
                entry.response = { output: '4', error: null };
                break;
            case 'project.listResources':
                entry.response = { projectName: 'TestProject', resources: [], count: 0 };
                break;
            case 'lsp.completion':
                entry.response = { items: [], isIncomplete: false };
                break;
            default:
                entry.response = {};
        }

        this.messages.push(entry);
        return Promise.resolve(entry.response);
    }

    getMessages(): Array<{ method: string; params?: unknown; response?: unknown }> {
        return [...this.messages];
    }

    getLastMessage(): { method: string; params?: unknown; response?: unknown } | undefined {
        return this.messages[this.messages.length - 1];
    }

    clearMessages(): void {
        this.messages = [];
    }

    // Connect/disconnect
    connect(pid?: number): Promise<boolean> {
        this.connected = true;
        this.designerPid = pid ?? 12345;
        return Promise.resolve(true);
    }

    disconnect(): Promise<void> {
        this.connected = false;
        this.designerPid = null;
        return Promise.resolve();
    }

    // Reset
    override reset(): void {
        super.reset();
        this.connected = false;
        this.designerPid = null;
        this.messages = [];
    }
}
