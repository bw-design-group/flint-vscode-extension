---
title: VS Code Settings
description: Reference for every Flint extension setting available in VS Code, grouped by feature area.
sidebar_label: Settings
---

Flint contributes a set of VS Code settings that control the project browser, language intelligence, embedded-script editing, and external tool integration. You can change any of them through **File > Preferences > Settings** (search for "Flint") or by editing `settings.json` directly.

:::info Prerequisites
All settings work offline — they configure the extension itself. Some settings enable features with their own connectivity requirements, noted per setting below (for example, `flint.enableDesignerLspCompletion` only takes effect with the Designer Bridge module and a running Designer).
:::

:::note Settings vs. configuration file
VS Code settings control *how the extension behaves* on your machine and are stored per user or per workspace. Project-level facts — project paths, gateways, environments — live in `flint.config.json` and are shared with your team. See [Configuration](/reference/configuration) for the config file schema.
:::

## General

These settings control where Flint finds its configuration and how the [Project Browser](/features/project-browser) displays resources.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `flint.configPath` | string | `""` | Custom path to the Flint configuration file (relative to the workspace or absolute). When empty, Flint searches the standard locations (`flint.config.json`, `.flint/config.json`, `.flint-config.json`, `.vscode/flint.config.json`). |
| `flint.localConfigPath` | string | `""` | Custom path to a local override config file (not version controlled). Local configs are merged on top of the base config. |
| `flint.showInheritedResources` | boolean | `true` | Show resources inherited from parent projects in the Project Browser. Inherited entries render dimmed with an `(inherited from <parent>)` suffix. |
| `flint.groupResourcesByType` | boolean | `true` | Group resources by type (with Perspective resources under a Perspective category) in the Project Browser. |
| `flint.autoRefreshProjects` | boolean | `true` | Automatically refresh the project tree when files change on disk. |
| `flint.showEmptyResourceTypes` | boolean | `false` | Show resource type nodes even when they contain no resources. |

## Language intelligence

These settings select and tune the completion engines described in [Language Features Overview](/language/overview).

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `flint.languageServer.enabled` | boolean | `true` | Use the gateway-backed Flint language server for Ignition Jython (Python 2.7) intelligence: completion, hover, go-to-definition, references, and diagnostics sourced from the selected gateway. Requires a configured gateway with an API token (see [Gateway Language Server](/language/gateway-lsp)). When disabled, Flint falls back to the legacy completion engines below. |
| `flint.languageServer.proxyPath` | string | `""` | Advanced: path to an external `flint-lsp-proxy` executable. Leave empty to use the proxy bundled with the extension (recommended). Only set this to override the bundled proxy with your own build. |
| `flint.enablePythonAutocomplete` | boolean | `true` | Master switch for the legacy Python completion engines. Only applies when `flint.languageServer.enabled` is `false`. |
| `flint.enableDesignerLspCompletion` | boolean | `true` | Enable Designer-sourced completions for `system.*` functions. Requires the Designer Bridge module and a [connected Designer](/getting-started/connecting-designer). Only applies when the gateway language server is disabled. |
| `flint.enableLocalScriptCompletion` | boolean | `true` | Enable completions for project script modules indexed from the local filesystem. Works fully offline. Only applies when the gateway language server is disabled. |

:::warning Mutually exclusive engines
The gateway language server and the legacy completion engines never run at the same time. While `flint.languageServer.enabled` is `true` (the default), the `flint.enablePythonAutocomplete`, `flint.enableDesignerLspCompletion`, and `flint.enableLocalScriptCompletion` settings have no effect.
:::

## Embedded script editing

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `flint.decodedJson.autoCloseOriginal` | boolean | `false` | Automatically close the original JSON editor when opening a decoded script view via **Flint: Edit Embedded Script** (see [Embedded Scripts](/features/embedded-scripts)). |

## External tools

These settings integrate Flint with tools outside VS Code. See [External Tools](/reference/external-tools) for setup details.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `flint.has83DesignerLauncher` | boolean | `false` | Whether the Ignition Designer Launcher (8.3+) is installed. Gates `designer://` deep links used by the gateway and Designer navigation commands. |
| `flint.hasKindlingInstalled` | boolean | `false` | Whether [Kindling](https://github.com/inductiveautomation/kindling) is installed and available on the system `PATH`. Enables **Open with Kindling** on `.gwbk`, `.modl`, `.idb`, and `.log` files. |
| `flint.kindlingExecutablePath` | string | `""` | Custom path to the Kindling executable. Useful for WSL or non-standard installations. |

:::tip
The tool-detection settings (`flint.has83DesignerLauncher`, `flint.hasKindlingInstalled`, `flint.kindlingExecutablePath`) are normally managed for you: Flint prompts on first use and remembers your answer. Use **Flint: Reset Tool Settings**, **Flint: Configure Kindling Path**, **Flint: Reset Kindling Setting**, or **Flint: Reset Designer Launcher Setting** from the Command Palette to change them interactively instead of editing JSON.
:::

## Settings that live in the config file

Some behavior is configured in `flint.config.json` rather than VS Code settings, so it can be shared across a team:

- `settings.searchHistoryLimit` — maximum number of recent searches to keep (default 50).
- `settings.showInheritedResources`, `settings.groupResourcesByType`, `settings.autoRefreshProjects` — project-level defaults for the equivalent VS Code settings.
- `modules.project-scan-endpoint.apiTokenFilePath` — gateway API token location used by the language server.

See [Configuration](/reference/configuration) for the full schema.

## Related pages

- [Configuration](/reference/configuration) — the `flint.config.json` schema
- [Commands](/reference/commands) — every Command Palette command
- [Gateway Language Server](/language/gateway-lsp) — language server setup and requirements
