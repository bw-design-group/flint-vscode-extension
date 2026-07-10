---
title: Legacy Completion Engine
description: Python code completion without a gateway API token, using the Designer Bridge, a local script index, and Ignition stubs.
sidebar_label: Legacy Completion
---

The legacy completion engine provides Python code completion for Ignition scripts when the [gateway-backed language server](/language/gateway-lsp) is unavailable — for example, when you cannot obtain a gateway API token. It merges suggestions from a connected Designer, a local index of your project scripts, and downloaded Ignition stubs, so you still get useful `system.*` and project-script completion while editing.

:::info Prerequisites
The local script index and Ignition stubs work **fully offline** — no gateway or Designer required. `system.*` completion from the live scripting engine and Perspective `self.*` completion additionally require the **Designer Bridge module and a running, connected Designer**. See [Connecting a Designer](/getting-started/connecting-designer).
:::

## When to use this engine

Flint has two mutually exclusive language-intelligence engines, switched by `flint.languageServer.enabled`:

| Engine | Setting value | Requires | Capabilities |
|---|---|---|---|
| Gateway language server (default) | `flint.languageServer.enabled: true` | Gateway with the Designer Bridge module and an API token | Completion, hover, definition, references, diagnostics, symbols |
| Legacy completion engine | `flint.languageServer.enabled: false` | Nothing (offline), or a connected Designer for live features | Completion only |

Use the legacy engine when no gateway API token is available in your environment, or when you cannot install the Designer Bridge module on the gateway. In all other cases, the default [gateway language server](/language/gateway-lsp) is the better choice.

:::warning Completion only
The legacy engine provides **completion only**. Hover documentation, go-to-definition, find references, diagnostics, and symbol search are available exclusively through the gateway language server. Disabling `flint.languageServer.enabled` turns those features off.
:::

## Enabling the legacy engine

1. Set `flint.languageServer.enabled` to `false` in your VS Code settings.
2. Ensure `flint.enablePythonAutocomplete` is `true` (the default). This is the master switch for the legacy engine — when it is `false`, no legacy completion sources run.

<!-- SCREENSHOT: VS Code settings UI showing flint.languageServer.enabled unchecked and flint.enablePythonAutocomplete checked -->

## Completion sources

Suggestions trigger on `.` in Python files and merge results from the following sources.

| Source | Setting | Connectivity | What it provides |
|---|---|---|---|
| Designer Bridge completion | `flint.enableDesignerLspCompletion` | Connected Designer | `system.*` functions from the Designer's live scripting engine, plus project scripts known to the Designer |
| Local script index | `flint.enableLocalScriptCompletion` | Offline | Functions, classes, and constants indexed from `script-python` resources in your configured project paths |
| Ignition stubs | Automatic when downloaded | Offline | `system.*` signatures from the [ignition-api stubs](/language/ignition-stubs) |
| Perspective component completion | Automatic with a connected Designer | Connected Designer | `self.*` properties on Perspective components (see below) |

<!-- SCREENSHOT: completion popup in a project script showing merged system.* and project-script suggestions -->

### Designer Bridge completion

With a Designer connected through the [Designer Bridge](/module/overview), the extension asks the Designer for completions. Because these come from the live scripting engine, `system.*` entries reflect exactly the functions available on that gateway, including those added by installed third-party modules.

### Local script index

The extension indexes the `script-python` resources in your configured [project paths](/reference/configuration) and offers their modules, functions, classes, and constants as completions. This works entirely offline and is the only project-script source when no Designer is connected.

### Perspective `self.*` completion

When editing a Perspective component script with a Designer connected, typing `self.` completes the component's actual properties — `props`, `custom`, `meta`, and `position` — reflected live from the component's property tree in the open Designer, along with `view`, `session`, `page`, `parent`, and methods such as `getSibling`, `getChild`, and `refreshBinding`.

<!-- SCREENSHOT: self. completion inside a Perspective component event script showing live props from the Designer -->

:::note Perspective completion scope
Perspective completion covers component `self.*` expressions only. It does not complete Perspective style class names or view paths.
:::

## Settings summary

| Setting | Default | Purpose |
|---|---|---|
| `flint.languageServer.enabled` | `true` | Set to `false` to use the legacy engine |
| `flint.enablePythonAutocomplete` | `true` | Master switch for all legacy completion |
| `flint.enableDesignerLspCompletion` | `true` | Completion from a connected Designer |
| `flint.enableLocalScriptCompletion` | `true` | Completion from the local script index |

## Limitations

- Completion only — no hover, go-to-definition, references, diagnostics, or symbols in this mode.
- Designer-sourced completion resolves the identifier prefix as a string; it is not position-aware in the way the gateway language server is.
- No completion for Java classes or tag paths.
- `system.*` completion requires either a connected Designer or downloaded [Ignition stubs](/language/ignition-stubs); with neither, only the local script index contributes.

## Related pages

- [Language Intelligence Overview](/language/overview)
- [Gateway Language Server](/language/gateway-lsp) — the default, full-featured engine
- [Ignition Stubs](/language/ignition-stubs)
