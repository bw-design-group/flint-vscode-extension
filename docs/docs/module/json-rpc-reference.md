---
title: JSON-RPC Method Reference
description: Index of every JSON-RPC 2.0 method exposed by the Flint Designer Bridge module, grouped by capability, with transport availability.
sidebar_label: JSON-RPC Reference
---

The Flint Designer Bridge module exposes a JSON-RPC 2.0 API over two transports: a loopback WebSocket served by each running Designer (ports 52400–52500) and a headless HTTP endpoint on the gateway (`POST /data/flint/rpc`). Both speak the same wire format, so a client built against one transport works against the other for any method both support. This page is an index of every method; request and response shapes are conveyed by the TypeScript and Java DTOs in the extension and module source.

:::info Prerequisites
Designer WebSocket methods require the Designer Bridge module installed on the gateway and a running Designer. Gateway HTTP methods require only the module and an API token — no Designer needed. See [Module Installation](/module/installation), [Security](/module/security), and the [Headless API](/module/headless-api).
:::

Column key: **WS** = Designer WebSocket, **HTTP** = gateway headless HTTP endpoint.

## Core and session

| Method | Purpose | WS | HTTP |
|---|---|:---:|:---:|
| `authenticate` | Authenticate the connection; all other methods are rejected until this succeeds | ✅ | ✅ |
| `ping` | Health check on an authenticated connection | ✅ | ✅ |
| `executeScript` | Run Jython with a persistent per-session variable context (Designer scope on WS, gateway scope on HTTP) | ✅ | ✅ |
| `resetSession` | Clear the persistent script session state | — | ✅ |
| `showMessage` | Display a message notification | ✅ | ✅ |
| `project.scan` | Trigger a project scan so the gateway picks up file changes | ✅ | ✅ |

## Designer navigation and workspace

| Method | Purpose | WS | HTTP |
|---|---|:---:|:---:|
| `designer.openResource` | Open a resource in the Designer workspace | ✅ | ✅ |
| `designer.getOpenTabs` | List resources currently open in the Designer | ✅ | ✅ |
| `designer.togglePreviewMode` | Toggle Perspective preview mode in the Designer | ✅ | ✅ |

## Project

| Method | Purpose | WS | HTTP |
|---|---|:---:|:---:|
| `project.listResources` | List project resources by type | ✅ | ✅ |
| `project.getViewCatalog` | Return the catalog of Perspective views in the project | ✅ | ✅ |

## View editing

| Method | Purpose | WS | HTTP |
|---|---|:---:|:---:|
| `view.getConfig` | Read a view's full configuration | ✅ | ✅ |
| `view.setConfig` | Replace a view's full configuration | ✅ | ✅ |
| `view.getComponent` | Read a single component within a view | ✅ | ✅ |
| `view.setComponent` | Update a single component within a view | ✅ | ✅ |
| `view.validate` | Validate a view configuration without saving | ✅ | ✅ |
| `view.getTree` | Return a view's component tree | ✅ | ✅ |
| `view.save` | Save a view resource | ✅ | ✅ |
| `view.create` | Create a new view | ✅ | ✅ |
| `view.delete` | Delete a view | ✅ | ✅ |

## Component schemas and icons

| Method | Purpose | WS | HTTP |
|---|---|:---:|:---:|
| `component.list` | List registered Perspective component types | ✅ | ✅ |
| `component.getSchema` | Return the property schema for a component type | ✅ | ✅ |
| `icon.list` | List available icon libraries and icons | ✅ | ✅ |
| `icon.search` | Search icons by name | ✅ | ✅ |

## Tags

| Method | Purpose | WS | HTTP |
|---|---|:---:|:---:|
| `tags.browse` | Browse a tag provider or folder | ✅ | ✅ |
| `tags.read` | Read current tag values | ✅ | ✅ |
| `tags.write` | Write tag values | ✅ | ✅ |
| `tags.getConfig` | Read tag configuration | ✅ | ✅ |
| `tags.create` | Create tags | ✅ | ✅ |
| `tags.edit` | Edit tag configuration | ✅ | ✅ |
| `tags.delete` | Delete tags | ✅ | ✅ |
| `tags.getProviders` | List tag providers | ✅ | ✅ |

## UDTs

| Method | Purpose | WS | HTTP |
|---|---|:---:|:---:|
| `udt.getDefinitions` | List UDT definitions | ✅ | ✅ |
| `udt.getDefinition` | Read a single UDT definition | ✅ | ✅ |
| `udt.createDefinition` | Create a UDT definition | ✅ | ✅ |
| `udt.createInstance` | Create an instance of a UDT | ✅ | ✅ |

## Perspective

| Method | Purpose | WS | HTTP |
|---|---|:---:|:---:|
| `perspective.isAvailable` | Report whether the Perspective module is present | ✅ | ✅ |
| `perspective.listSessions` | List active Perspective sessions | ✅ | ✅ |
| `perspective.getSessionPages` | List pages in a session | ✅ | ✅ |
| `perspective.getPageViews` | List views on a page | ✅ | ✅ |
| `perspective.getViewComponents` | Return the live component tree of a running view | ✅ | ✅ |
| `perspective.executeScript` | Run a script in a Perspective session context | ✅ | ✅ |
| `perspective.getComponentCompletions` | Component property completions for a session context | ✅ | ✅ |
| `perspective.profileView` | Profile a view's property and binding structure | ✅ | ✅ |
| `perspective.startRecording` | Start recording session events | ✅ | ✅ |
| `perspective.stopRecording` | Stop an event recording | ✅ | ✅ |
| `perspective.pollRecording` | Poll for recorded events (primary mechanism on HTTP) | ✅ | ✅ |

## Debugging

Real breakpoint debugging backed by a `bdb.Bdb`-based Jython debugger, with genuine stack frames and variable inspection. Conditional breakpoints are supported. See [Debugger](/debugging/debugger) and its [limitations](/debugging/limitations).

| Method | Purpose | WS | HTTP |
|---|---|:---:|:---:|
| `debug.startSession` | Start a debug session | ✅ | ✅ |
| `debug.stopSession` | Stop a debug session | ✅ | ✅ |
| `debug.setBreakpoints` | Set breakpoints (conditions supported) | ✅ | ✅ |
| `debug.run` | Run a script under the debugger | ✅ | ✅ |
| `debug.continue` | Resume execution | ✅ | ✅ |
| `debug.stepOver` | Step over the current line | ✅ | ✅ |
| `debug.stepInto` | Step into a call | ✅ | ✅ |
| `debug.stepOut` | Step out of the current frame | ✅ | ✅ |
| `debug.pause` | Pause execution | ✅ | ✅ |
| `debug.getStackTrace` | Return the current stack frames | ✅ | ✅ |
| `debug.getScopes` | Return variable scopes for a frame | ✅ | ✅ |
| `debug.getVariables` | Return variables in a scope | ✅ | ✅ |
| `debug.evaluate` | Evaluate an expression in a paused frame | ✅ | ✅ |
| `debug.pollEvents` | Poll for debug events (HTTP substitute for WebSocket push) | — | ✅ |

## Language server (LSP)

:::warning Transport asymmetry
The Designer WebSocket implements only `lsp.completion` and `lsp.invalidateCache`. Hover, definition, references, diagnostics, symbols, and document sync exist **only** on the gateway HTTP endpoint, which hosts the full headless Jython language server. `lsp.hover` and `lsp.signatureHelp` are declared in the method registry but are not implemented on the Designer WebSocket. See [Gateway LSP](/language/gateway-lsp).
:::

| Method | Purpose | WS | HTTP |
|---|---|:---:|:---:|
| `lsp.completion` | Code completion (Designer hint tree on WS; live gateway hint tree plus project-script modules on HTTP) | ✅ | ✅ |
| `lsp.invalidateCache` | Invalidate the Designer's completion cache | ✅ | — |
| `lsp.didOpen` | Open a document in the headless language server | — | ✅ |
| `lsp.didChange` | Sync document edits | — | ✅ |
| `lsp.didClose` | Close a document | — | ✅ |
| `lsp.reindex` | Rebuild the project script index | — | ✅ |
| `lsp.diagnostics` | Syntax diagnostics for a document | — | ✅ |
| `lsp.documentSymbol` | Symbols in a document | — | ✅ |
| `lsp.workspaceSymbol` | Search symbols across project scripts | — | ✅ |
| `lsp.hover` | Hover documentation | — | ✅ |
| `lsp.definition` | Go to definition (intra- and cross-file into project scripts) | — | ✅ |
| `lsp.references` | Find references | — | ✅ |

## Browser / CDP

| Method | Purpose | WS | HTTP |
|---|---|:---:|:---:|
| `browser.getCdpInfo` | Report the Designer's embedded JxBrowser DevTools (CDP) port, if available | ✅ | ✅ |

## Push notifications (Designer WebSocket only)

The WebSocket transport pushes server-initiated notifications; the HTTP transport has no push channel and relies on `debug.pollEvents` and `perspective.pollRecording` instead.

| Notification | Purpose |
|---|---|
| `lsp.cacheInvalidated` | The Designer's completion cache was invalidated |
| `perspective.recordingEvent` | A recorded Perspective session event occurred |
| `perspective.recordingComplete` | A session recording finished |

:::note
Push notifications also include script-change events emitted by the Designer's script change detector, which the extension uses to keep local files in sync with Designer edits.
:::

## Related pages

- [Module Overview](/module/overview) — architecture and transports
- [Security](/module/security) — authentication for both transports
- [Headless API](/module/headless-api) — using the gateway HTTP endpoint without a Designer
