---
title: Language Features Overview
description: How Flint provides Python language intelligence for Ignition scripts, and which engine powers each feature.
sidebar_label: Overview
---

Flint gives you real Python (Jython) language intelligence for Ignition project scripts directly in VS Code — completion, hover, go-to-definition, references, diagnostics, and symbols — without requiring a running Designer. The default engine talks to your gateway over HTTP, so full language features work anywhere you have gateway access.

:::info Prerequisites
The default **Gateway LSP** needs a configured gateway with an API token in `flint.config.json` and the [Designer Bridge module](/module/installation) installed on that gateway — no running Designer required. The **legacy completion** fallback works partially offline; its `system.*` completions require a connected Designer. See [Connecting a Designer](/getting-started/connecting-designer).
:::

## Two engines

Flint has two independent language-intelligence engines. You use one or the other, controlled by `flint.languageServer.enabled` (default: `true`).

| | Gateway LSP (default) | Legacy completion (fallback) |
|---|---|---|
| **Enabled by** | `flint.languageServer.enabled: true` (default) | `flint.languageServer.enabled: false` |
| **How it works** | The `flint-lsp-proxy` language server, bundled with the extension, connects to the gateway's headless Flint API over HTTP | VS Code completion provider merging local script indexing with Designer bridge responses |
| **Provides** | Completion, hover, definition, references, syntax diagnostics, document and workspace symbols | Completion only |
| **Needs** | Configured gateway + API token; Designer Bridge module on the gateway | Works offline for local script completion; a connected Designer for `system.*` completions |
| **Parser** | Jython's ANTLR Python 2.7 parser with a per-project AST index | Prefix-string matching, regex script indexing, and Ignition stubs |

The key difference for day-to-day work: the Gateway LSP delivers the full feature set with **no Designer open**. The legacy path exists for environments without gateway API access, and it only ever offers completion — no hover, definition, references, or diagnostics.

<!-- SCREENSHOT: Completion popup showing system.tag.* entries in a project script, powered by the gateway LSP -->

## Feature matrix

| Feature | Gateway LSP | Legacy completion |
|---|---|---|
| Completion (`system.*`, project scripts, local scope, keywords) | Yes — position-aware | Yes — prefix-based; `system.*` needs a connected Designer |
| Hover | Yes — signature with parameter names (project code only) | No |
| Go to definition | Yes — within a file and across project scripts | No |
| Find references | Yes — within the current file, best-effort identifier matching | No |
| Diagnostics | Yes — syntax errors only (source `flint-jython`) | No |
| Document symbols / workspace symbols | Yes | No |
| Signature help | No | No |

<!-- SCREENSHOT: Hover tooltip showing a function signature over a project script call -->

## How the Gateway LSP connects

The extension launches the bundled `flint-lsp-proxy` language server and passes it the URL, API token, and TLS settings of your selected gateway from `flint.config.json`. The proxy translates LSP requests into calls against the gateway-scope Flint API, where the actual parsing and indexing runs. If no gateway is configured or the gateway has no API token, the language server stays dormant; it starts automatically once configuration is in place, and restarts when you change gateways.

If the gateway hosts a single project, the LSP selects it automatically; with multiple projects, set the project explicitly in your gateway configuration.

The setting `flint.languageServer.proxyPath` is an advanced override for pointing at an external proxy binary — you do not need it for normal use.

See [Gateway LSP](/language/gateway-lsp) for setup and configuration details, and [Completion](/language/completion) for how the legacy engine's sources combine.

<!-- SCREENSHOT: Problems panel showing a flint-jython syntax error in a project script -->

## Ignition stubs

Independently of both engines, Flint downloads Ignition Python stubs from PyPI to power its own script indexing for legacy completion. The stubs feed Flint's completion engine — they are **not** wired into Pylance or `python.analysis.extraPaths`. See [Ignition Stubs](/language/ignition-stubs).

## Limitations

:::warning Known limits
- **Python 2.7 only.** Ignition scripts run on Jython, and the LSP parses with Jython's Python 2.7 grammar. Python 3 syntax is reported as a syntax error.
- **Diagnostics are syntax-only.** Parse errors are flagged; there is no name resolution, type checking, or other semantic analysis.
- **Hover is limited.** Signatures show parameter names only — no types, defaults, or docstrings — and there is no hover for `system.*` functions.
- **References are best-effort.** Matching is intra-file and identifier-based, not full semantic resolution.
- **No Java-class completion.** Members of Java classes (e.g. `java.util.*` imports) are not completed by either engine.
- **No tag-path completion.** Neither engine completes tag paths inside strings.
- **No signature help** in either engine.
:::

## Related pages

- [Gateway LSP](/language/gateway-lsp) — configuring the default engine
- [Completion](/language/completion) — legacy completion sources and settings
- [Ignition Stubs](/language/ignition-stubs) — stub download and management
- [Script Console](/debugging/script-console) and [Debugger](/debugging/debugger) — running and debugging scripts (the debugger, unlike the LSP, always requires a connected Designer)
