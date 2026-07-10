---
title: Headless Gateway API
description: Call the Designer Bridge JSON-RPC API directly on the gateway over HTTP, with no Designer running.
sidebar_label: Headless API
---

The Designer Bridge module exposes a JSON-RPC 2.0 endpoint directly on the gateway at `POST /data/flint/rpc`. It lets scripts, CI pipelines, and other tooling execute gateway-scope Jython, read and write tags, manage Perspective views, run the debugger, and query the Jython language server — all without a Designer session or the VS Code extension.

The HTTP endpoint is wire-compatible with the [Designer WebSocket protocol](/module/json-rpc-reference): the same method names, parameters, and result shapes apply, so a client written against one transport works against the other.

:::info Prerequisites
Requires the Designer Bridge module installed on the gateway and an API token. No Designer needs to be running, and the VS Code extension is not involved. See [Module Installation](/module/installation) and [Security](/module/security).
:::

:::caution New surface
The headless HTTP transport shipped in module v1.1.0 and is the newest part of the Designer Bridge. It is functional and tested, but less battle-tested than the Designer WebSocket transport. Report issues on [GitHub](https://github.com/bw-design-group/flint-designer-bridge-ignition-module/releases).
:::

## Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/data/flint/health` | GET | None (intentionally public) | Probe: module version, Ignition version, auth schemes, capabilities, project list |
| `/data/flint/rpc` | POST | Required | JSON-RPC 2.0 requests |

## Authentication

Authentication is per-request via HTTP headers. The scheme differs by Ignition line:

| Ignition line | Header | Token source |
|---------------|--------|--------------|
| 8.3 | `X-Ignition-API-Token: keyId:secret` | Native platform API token, managed in the gateway web UI (Flint bearer token also accepted as a fallback) |
| 8.1 | `Authorization: Bearer <token>` | Flint-managed token only |

The Flint-managed token is resolved in this order:

1. `flint.gateway.apiToken` system property or `FLINT_GATEWAY_API_TOKEN` environment variable (never persisted — intended for containers)
2. An existing token file
3. An auto-generated 48-character token written to `<dataDir>/modules/flint/gateway/api-token.json` (file mode `0600`)

:::warning
A valid token grants gateway-developer-level power: arbitrary gateway-scope Jython execution plus tag, UDT, view, and project resource CRUD. Treat it like a gateway admin credential and use HTTPS for any non-local gateway. See [Security](/module/security).
:::

## Request envelope

Requests and responses use standard JSON-RPC 2.0. Protocol and method errors are returned as HTTP 200 with a JSON-RPC error envelope; requests without an `id` are treated as notifications and receive no body.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "executeScript",
  "params": {
    "code": "result = system.tag.readBlocking(['[default]Ramp/Ramp0'])[0].value",
    "sessionId": "ci-run-42",
    "timeoutMs": 10000
  }
}
```

`sessionId` selects a persistent script variable context on the gateway — successive `executeScript` calls with the same `sessionId` share state. Use `resetSession` (or `"resetSession": true` in the params) to clear it.

## Examples

Health check (no auth):

```bash
curl http://gateway:8088/data/flint/health
```

Execute a gateway-scope script (8.1 header shown; on 8.3 use `-H "X-Ignition-API-Token: keyId:secret"`):

```bash
curl -X POST http://gateway:8088/data/flint/rpc \
  -H "Authorization: Bearer $FLINT_GATEWAY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"executeScript",
       "params":{"code":"result = system.util.getGatewayName()","sessionId":"ci"}}'
```

Read tags:

```bash
curl -X POST http://gateway:8088/data/flint/rpc \
  -H "Authorization: Bearer $FLINT_GATEWAY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tags.read",
       "params":{"tagPaths":["[default]Ramp/Ramp0"]}}'
```

Fetch a Perspective view configuration:

```bash
curl -X POST http://gateway:8088/data/flint/rpc \
  -H "Authorization: Bearer $FLINT_GATEWAY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"view.getConfig",
       "params":{"projectName":"MyProject","viewPath":"Overview/Main"}}'
```

An `authenticate` request is accepted for wire compatibility with WebSocket clients — it simply echoes capability info, since HTTP auth already happened at the header level. `ping` returns the same capability payload.

## Available methods

Everything below works with no Designer running:

| Group | Methods |
|-------|---------|
| Core | `authenticate`, `ping`, `executeScript` (gateway-scope), `resetSession`, `project.scan` |
| Tags | `tags.browse`, `tags.read`, `tags.write`, `tags.getConfig`, `tags.create`, `tags.edit`, `tags.delete`, `tags.getProviders` |
| UDTs | `udt.getDefinitions`, `udt.getDefinition`, `udt.createDefinition`, `udt.createInstance` |
| Perspective | `perspective.isAvailable`, `listSessions`, `getSessionPages`, `getPageViews`, `getViewComponents`, `executeScript`, `getComponentCompletions`, `profileView`, `startRecording`, `stopRecording`, `pollRecording` |
| Debug | `debug.startSession`, `stopSession`, `setBreakpoints`, `run`, `continue`, `stepOver`, `stepInto`, `stepOut`, `pause`, `getStackTrace`, `getScopes`, `getVariables`, `evaluate`, plus `debug.pollEvents` for poll-based event delivery over HTTP |
| Project & views | `project.listResources`, `project.getViewCatalog`, `view.getConfig`, `view.setConfig`, `view.getComponent`, `view.setComponent`, `view.validate`, `view.getTree`, `view.save`, `view.create`, `view.delete` |
| Components & icons | `component.list`, `component.getSchema`, `icon.list`, `icon.search` |
| Language server | Document sync: `lsp.didOpen`, `lsp.didChange`, `lsp.didClose`, `lsp.reindex`; features: `lsp.diagnostics`, `lsp.documentSymbol`, `lsp.workspaceSymbol`, `lsp.hover`, `lsp.definition`, `lsp.references`, `lsp.completion` |

The headless language server indexes project scripts on the live gateway and needs no external stubs or Designer — this is the same server the extension's [gateway language features](/language/gateway-lsp) use.

## Differences from the Designer WebSocket

- **Designer-UI methods are rejected.** `designer.openResource`, `designer.getOpenTabs`, `designer.togglePreviewMode`, `showMessage`, and `browser.getCdpInfo` require a running Designer and return a JSON-RPC error on the HTTP transport.
- **`executeScript` runs in gateway scope**, not Designer scope. Designer-only APIs are unavailable.
- **No push notifications.** HTTP is request/response only; poll for debugger events with `debug.pollEvents` and for Perspective recordings with `perspective.pollRecording`.

## Typical uses

- **CI validation** — `view.validate` and `lsp.diagnostics` against a gateway spun up in Docker, gated on `GET /data/flint/health`.
- **Bulk tag or UDT provisioning** — script `tags.create` / `udt.createInstance` from a manifest.
- **Deployment smoke tests** — `executeScript` assertions after a project import.

For the full parameter and result schemas of each method, see the [JSON-RPC Reference](/module/json-rpc-reference).
