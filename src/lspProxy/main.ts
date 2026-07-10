#!/usr/bin/env node
/**
 * @module lspProxy/main
 * @description flint-lsp-proxy — a thin, editor-agnostic LSP server (stdio) that forwards Language
 * Server requests to the Ignition gateway's headless Flint language server over the authenticated
 * `/data/flint` transport. The gateway holds the semantic core (Jython parser + project index +
 * system.* hints); this process only translates between the editor's LSP and gateway JSON-RPC.
 *
 * This file is bundled to a standalone Node script (out/src/lspProxy/main.js) and launched by the
 * extension as a language server module. It MUST NOT import `vscode` — it runs as its own process.
 *
 * Config via env: FLINT_GATEWAY_URL, FLINT_GATEWAY_TOKEN, FLINT_GATEWAY_TOKEN_TYPE
 * (native|bearer), FLINT_GATEWAY_INSECURE_TLS, FLINT_GATEWAY_PROJECT.
 */
import {
    createConnection,
    ProposedFeatures,
    TextDocuments,
    TextDocumentSyncKind,
    type CompletionItem,
    type Definition,
    type DocumentSymbol,
    type Hover,
    type InitializeResult,
    type Location,
    type SymbolInformation
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { loadGatewayConfigFromEnv } from './gatewayConfig';
import { GatewayConnectionManager } from './gatewayConnectionManager';

const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);
const documents = new TextDocuments(TextDocument);

const gateway = new GatewayConnectionManager();
const GW_ID = 'default';
const project = process.env.FLINT_GATEWAY_PROJECT ?? undefined;
// Stable session id so the gateway keys this proxy's documents together.
const sessionId = `lsp-${process.pid}`;
let rootUri: string | undefined;

function ensureGateway(): boolean {
    if (gateway.has(GW_ID)) {
        return true;
    }
    const cfg = loadGatewayConfigFromEnv();
    if (!cfg) {
        connection.console.error(
            'flint-lsp-proxy: set FLINT_GATEWAY_URL and FLINT_GATEWAY_TOKEN (and FLINT_GATEWAY_PROJECT).'
        );
        return false;
    }
    gateway.register({ ...cfg, id: GW_ID });
    return true;
}

async function rpc<T = unknown>(method: string, params: Record<string, unknown>): Promise<T | null> {
    if (!ensureGateway()) {
        return null;
    }
    try {
        return await gateway.sendRequest<T>(GW_ID, method, { sessionId, project, rootUri, ...params });
    } catch (err) {
        connection.console.error(`flint-lsp-proxy ${method} failed: ${String(err)}`);
        return null;
    }
}

connection.onInitialize((params): InitializeResult => {
    rootUri = params.rootUri ?? params.workspaceFolders?.[0]?.uri ?? undefined;
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            completionProvider: { triggerCharacters: ['.'] },
            hoverProvider: true,
            definitionProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
            workspaceSymbolProvider: true
        },
        serverInfo: { name: 'flint-lsp-proxy', version: '1.0.0' }
    };
});

connection.onInitialized((): void => {
    ensureGateway();
    connection.console.info('flint-lsp-proxy connected to Ignition gateway language server');
});

// ---- Document sync -> gateway + push diagnostics ----

async function syncAndDiagnose(doc: TextDocument): Promise<void> {
    await rpc('lsp.didChange', { uri: doc.uri, text: doc.getText() });
    const res = await rpc<{ diagnostics?: unknown[] }>('lsp.diagnostics', { uri: doc.uri });
    void connection.sendDiagnostics({ uri: doc.uri, diagnostics: (res?.diagnostics ?? []) as never[] });
}

documents.onDidOpen((e): void => {
    void rpc('lsp.didOpen', { uri: e.document.uri, text: e.document.getText() }).then(() =>
        syncAndDiagnose(e.document)
    );
});
documents.onDidChangeContent((e): void => {
    void syncAndDiagnose(e.document);
});
documents.onDidClose((e): void => {
    void rpc('lsp.didClose', { uri: e.document.uri });
    void connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

// ---- Feature requests (pass current text so the gateway always parses fresh) ----

function textOf(uri: string): string | undefined {
    return documents.get(uri)?.getText();
}

connection.onCompletion(async (params): Promise<CompletionItem[]> => {
    const res = await rpc<{ items?: unknown[] }>('lsp.completion', {
        uri: params.textDocument.uri,
        position: params.position,
        text: textOf(params.textDocument.uri)
    });
    return (res?.items ?? []) as never[];
});

connection.onHover(async (params): Promise<Hover | null> => {
    const res = await rpc<{ value?: string; range?: unknown }>('lsp.hover', {
        uri: params.textDocument.uri,
        position: params.position,
        text: textOf(params.textDocument.uri)
    });
    const value = res?.value;
    if (value === undefined || value === '') {
        return null;
    }
    return { contents: { kind: 'markdown', value }, range: res?.range as never };
});

connection.onDefinition(async (params): Promise<Definition | null> => {
    const res = await rpc<{ uri?: string; range?: unknown }>('lsp.definition', {
        uri: params.textDocument.uri,
        position: params.position,
        text: textOf(params.textDocument.uri)
    });
    const targetUri = res?.uri;
    if (targetUri === undefined || targetUri === '') {
        return null;
    }
    return { uri: targetUri, range: res?.range as never };
});

connection.onReferences(async (params): Promise<Location[]> => {
    const res = await rpc<{ references?: unknown[] }>('lsp.references', {
        uri: params.textDocument.uri,
        position: params.position,
        includeDeclaration: params.context?.includeDeclaration ?? true,
        text: textOf(params.textDocument.uri)
    });
    return (res?.references ?? []) as never[];
});

connection.onDocumentSymbol(async (params): Promise<DocumentSymbol[]> => {
    const res = await rpc<{ symbols?: unknown[] }>('lsp.documentSymbol', {
        uri: params.textDocument.uri,
        text: textOf(params.textDocument.uri)
    });
    return (res?.symbols ?? []) as never[];
});

connection.onWorkspaceSymbol(async (params): Promise<SymbolInformation[]> => {
    const res = await rpc<{ symbols?: Array<Record<string, unknown>> }>('lsp.workspaceSymbol', {
        query: params.query
    });
    // Gateway returns {name, kind, containerName, location}; that IS SymbolInformation.
    return (res?.symbols ?? []) as never[];
});

documents.listen(connection);
connection.listen();
